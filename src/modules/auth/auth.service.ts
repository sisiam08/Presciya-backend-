import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { ILogInUserType, ISignUpUserType } from "../../interface";
import jwt from "jsonwebtoken";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import {
  WorkspaceType,
  WorkspaceRole,
  MembershipStatus,
  SystemRole,
  LoginStatus,
  VerificationStatus,
  VerificationType,
  AuditActionType,
  AuditEntityType,
  OnboardingState,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { emailService } from "../../utils/emailService";
import { AuditService } from "../audit/audit.service";

const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const generateSlug = async (name: string, type: WorkspaceType) => {
  let baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

  if (!baseSlug) baseSlug = "ws";

  const suffix = type === "INSTITUTION" ? "inst" : "personal";
  let slug = `${baseSlug}-${suffix}`;
  let attempts = 0;
  const MAX_ATTEMPTS = 15;

  while (attempts < MAX_ATTEMPTS) {
    const existing = await prisma.workspace.findUnique({ where: { slug } });

    if (!existing) {
      return slug;
    }

    attempts++;
    slug = `${baseSlug}-${suffix}-${attempts}`;
  }

  const random = Math.random().toString(36).substring(2, 8);
  return `${baseSlug}-${suffix}-${random}`;
};

const generateTokens = (user: {
  userId: string;
  systemRole: SystemRole;
  workspaceType?: WorkspaceType;
  workspaceRole?: WorkspaceRole;
  activeWorkspaceId?: string;
}) => {
  // `jti` guarantees each token is unique even when two logins happen within
  // the same second (otherwise the refresh token string could collide and the
  // session insert would fail with a duplicate-key error).
  const accessToken = jwt.sign(
    {
      id: user.userId,
      systemRole: user.systemRole,
      workspaceType: user.workspaceType,
      workspaceRole: user.workspaceRole,
      activeWorkspaceId: user.activeWorkspaceId,
      jti: crypto.randomUUID(),
    },
    config.jwt.jwtSecret,
    {
      expiresIn: "1h",
    },
  );

  // The refresh token must carry the workspace context too, otherwise a token
  // rotation would silently drop `activeWorkspaceId` and every workspace-scoped
  // route that resolves the workspace from the token would start failing with
  // "Workspace context required".
  const refreshToken = jwt.sign(
    {
      id: user.userId,
      workspaceType: user.workspaceType,
      workspaceRole: user.workspaceRole,
      activeWorkspaceId: user.activeWorkspaceId,
      jti: crypto.randomUUID(),
    },
    config.jwt.jwtSecret,
    {
      expiresIn: "7d",
    },
  );

  return { accessToken, refreshToken };
};

const sendOTP = async (name: string, email: string) => {
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    throw createAppError("User already exists", Status.CONFLICT);
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  try {
    await prisma.oTP.deleteMany({
      where: { email },
    });

    await prisma.oTP.create({
      data: {
        email,
        otp,
        purpose: "signup",
        expiresAt,
        attempts: 0,
      },
    });
  } catch (error) {
    console.error("Failed to store OTP:", error);
    throw createAppError(
      "Failed to process signup. Please try again.",
      Status.INTERNAL_SERVER_ERROR,
    );
  }

  try {
    await emailService.sendOTPEmail(email, name, otp);
  } catch (error) {
    console.error("Failed to send OTP email:", error);
    await prisma.oTP
      .deleteMany({
        where: { email },
      })
      .catch((err: any) => console.error("Cleanup error:", err));
    throw createAppError(
      "Failed to send OTP email. Please try again.",
      Status.INTERNAL_SERVER_ERROR,
    );
  }

  return {
    message:
      "OTP sent successfully to your email. Please verify to complete signup.",
    email,
    expiresIn: "15 minutes",
  };
};

const signUp = async (
  userData: ISignUpUserType,
  deviceInfo?: string,
  ipAddress?: string,
) => {
  const { name, email, password, accountType, OTP } = userData;

  // One email maps to exactly one User, forever (Section 1.3). Guard against a
  // race where another request created the account after sendOTP.
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    throw createAppError(
      "An account with this email already exists. Please log in instead.",
      Status.CONFLICT,
    );
  }

  const otpRecord = await prisma.oTP.findUnique({
    where: { email },
  });

  if (!otpRecord) {
    throw createAppError(
      "OTP expired or not found. Please sign up again.",
      Status.BAD_REQUEST,
    );
  }

  if (new Date() > otpRecord.expiresAt) {
    await prisma.oTP.delete({
      where: { email },
    });
    throw createAppError(
      "OTP has expired. Please sign up again.",
      Status.BAD_REQUEST,
    );
  }

  // Check maximum attempts
  if (otpRecord.attempts >= otpRecord.maxAttempts) {
    await prisma.oTP.delete({
      where: { email },
    });
    throw createAppError(
      "Maximum OTP attempts exceeded. Please sign up again.",
      Status.TOO_MANY_REQUESTS,
    );
  }

  // Verify OTP
  if (otpRecord.otp !== OTP) {
    await prisma.oTP.update({
      where: { email },
      data: { attempts: otpRecord.attempts + 1 },
    });
    throw createAppError("Invalid OTP. Please try again.", Status.UNAUTHORIZED);
  }

  const hashedPassword = await bcrypt.hash(
    password,
    config.bcrypt.bcryptSaltRound,
  );

  const data = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        isVerified: true,
        emailVerifiedAt: new Date(),
        onboardingState: OnboardingState.PROFILE_SETUP,
      },
      select: {
        id: true,
        name: true,
        email: true,
        systemRole: true,
      },
    });

    if (accountType === "DOCTOR") {
      await tx.doctor.create({
        data: {
          name: user.name,
          userId: user.id,
          verificationStatus: VerificationStatus.PENDING,
        },
      });
    } else {
      await tx.institution.create({
        data: {
          name: user.name,
          userId: user.id,
          verificationStatus: VerificationStatus.PENDING,
        },
      });
    }

    const workspace = await tx.workspace.create({
      data: {
        name:
          accountType === "INSTITUTION"
            ? user.name
            : `${user.name}'s Personal Practice`,
        slug: await generateSlug(
          user.name,
          accountType === "INSTITUTION"
            ? WorkspaceType.INSTITUTION
            : WorkspaceType.PERSONAL,
        ),
        type:
          accountType === "INSTITUTION"
            ? WorkspaceType.INSTITUTION
            : WorkspaceType.PERSONAL,
        ownerId: user.id,
      },
      select: {
        id: true,
      },
    });
    await tx.membership.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });

    // Create verification request after workspace/membership exists
    await tx.verificationRequest.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        type:
          accountType === "INSTITUTION"
            ? VerificationType.INSTITUTION
            : VerificationType.PERSONAL,
        status: VerificationStatus.PENDING,
        submittedData: { name: user.name, email },
      },
    });

    return user;
  });

  // Delete OTP record after successful verification
  await prisma.oTP.delete({
    where: { email },
  });

  // Audit: Log user creation (signup)
  await AuditService.logAudit({
    userId: data.id,
    actionType: AuditActionType.CREATE,
    entityType: AuditEntityType.USER,
    entityId: data.id,
    newValues: {
      name: data.name,
      email: data.email,
      systemRole: data.systemRole,
      accountType,
    },
    metadata: {
      userName: data.name,
      userEmail: data.email,
      signupMethod: "otp",
    },
  });

  return data;
};

const logIn = async (
  userData: ILogInUserType,
  deviceInfo?: string,
  ipAddress?: string,
) => {
  const { email, password } = userData;

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      password: true,
      isActive: true,
      systemRole: true,
      isVerified: true,
      onboardingState: true,
    },
  });

  if (!user) {
    throw createAppError(
      "Invalid email or password",
      Status.UNAUTHORIZED,
      true,
      "AUTH_INVALID_CREDENTIALS",
    );
  }

  if (!user.isActive) {
    throw createAppError(
      "Your account is inactive. Please contact support.",
      Status.FORBIDDEN,
    );
  }

  const profile =
    (await prisma.doctor.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        verificationStatus: true,
      },
    })) ||
    (await prisma.institution.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        verificationStatus: true,
      },
    }));

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    await prisma.loginHistory.create({
      data: {
        userId: user.id,
        ipAddress: ipAddress ?? null,
        userAgent: deviceInfo ?? null,
        status: LoginStatus.FAILED,
      },
    });
    throw createAppError(
      "Invalid email or password",
      Status.UNAUTHORIZED,
      true,
      "AUTH_INVALID_CREDENTIALS",
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const workspaces = await prisma.membership.findMany({
    where: {
      userId: user.id,
    },
    select: {
      role: true,
      status: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          ownerId: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  if (workspaces.length === 0) {
    if (user.systemRole !== SystemRole.SUPER_ADMIN) {
      throw createAppError(
        "No workspace found for this user. Please contact support.",
        Status.FORBIDDEN,
      );
    }

    const { accessToken, refreshToken } = generateTokens({
      userId: user.id,
      systemRole: user.systemRole,
    });

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        deviceInfo: deviceInfo ?? null,
        ipAddress: ipAddress ?? null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.loginHistory.create({
      data: {
        userId: user.id,
        ipAddress: ipAddress ?? null,
        userAgent: deviceInfo ?? null,
        status: LoginStatus.SUCCESS,
      },
    });

    await AuditService.logAudit({
      userId: user.id,
      actionType: AuditActionType.LOGIN,
      entityType: AuditEntityType.SYSTEM,
      metadata: {
        userEmail: user.email,
        userName: user.name,
        ipAddress,
        deviceInfo,
      },
    });

    const { password: _, ...userWithoutPassword } = user;

    return {
      data: {
        ...userWithoutPassword,
        profile,
        workspaces: [],
      },
      accessToken,
      refreshToken,
    };
  }

  // Filter workspaces with ACTIVE membership status
  const acceptedWorkspaces = workspaces.filter(
    (ws) => ws.status === MembershipStatus.ACTIVE,
  );

  // If all workspaces are pending/inactive
  if (acceptedWorkspaces.length === 0) {
    throw createAppError(
      "Your membership for all workspaces is pending. Please check your email and accept the invitations.",
      Status.FORBIDDEN,
    );
  }

  // If only one workspace is accepted (rest are pending)
  if (acceptedWorkspaces.length === 1) {
    const activeWorkspace = acceptedWorkspaces[0];

    const { accessToken, refreshToken } = generateTokens({
      userId: user.id,
      systemRole: user.systemRole,
      workspaceType: activeWorkspace?.workspace.type as WorkspaceType,
      workspaceRole: activeWorkspace?.role as WorkspaceRole,
      activeWorkspaceId: activeWorkspace?.workspace.id!,
    });

    // Store Session
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        deviceInfo: deviceInfo ?? null,
        ipAddress: ipAddress ?? null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Log Successful Login
    await prisma.loginHistory.create({
      data: {
        userId: user.id,
        ipAddress: ipAddress ?? null,
        userAgent: deviceInfo ?? null,
        status: LoginStatus.SUCCESS,
      },
    });

    // Audit: Log login
    await AuditService.logAudit({
      userId: user.id,
      actionType: AuditActionType.LOGIN,
      entityType: AuditEntityType.SYSTEM,
      metadata: {
        userEmail: user.email,
        userName: user.name,
        ipAddress,
        deviceInfo,
        workspaceId: activeWorkspace?.workspace.id,
      },
    });

    const { password: _, ...userWithoutPassword } = user;

    return {
      data: {
        ...userWithoutPassword,
        profile,
        workspaces: [
          {
            id: activeWorkspace?.workspace.id,
            name: activeWorkspace?.workspace.name,
            slug: activeWorkspace?.workspace.slug,
            type: activeWorkspace?.workspace.type as WorkspaceType,
            role: activeWorkspace?.role as WorkspaceRole,
            membershipStatus: activeWorkspace?.status as MembershipStatus,
          },
        ],
      },
      accessToken,
      refreshToken,
    };
  } else {
    // Multiple active workspaces: issue an unscoped token so the client can
    // call /auth/switch-workspace, and require an explicit workspace choice.
    // The client must never assume workspaces[0] is active (Section 5.3).
    const { accessToken, refreshToken } = generateTokens({
      userId: user.id,
      systemRole: user.systemRole,
    });

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        deviceInfo: deviceInfo ?? null,
        ipAddress: ipAddress ?? null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Log Successful Login
    await prisma.loginHistory.create({
      data: {
        userId: user.id,
        ipAddress: ipAddress ?? null,
        userAgent: deviceInfo ?? null,
        status: LoginStatus.SUCCESS,
      },
    });

    // Audit: Log login
    await AuditService.logAudit({
      userId: user.id,
      actionType: AuditActionType.LOGIN,
      entityType: AuditEntityType.SYSTEM,
      metadata: {
        userEmail: user.email,
        userName: user.name,
        ipAddress,
        deviceInfo,
        acceptedWorkspacesCount: acceptedWorkspaces.length,
        requiresWorkspaceSelection: true,
      },
    });

    const { password: _, ...userWithoutPassword } = user;

    return {
      data: {
        ...userWithoutPassword,
        profile,
        requiresWorkspaceSelection: true,
        workspaces: acceptedWorkspaces.map((ws) => ({
          id: ws.workspace.id,
          name: ws.workspace.name,
          slug: ws.workspace.slug,
          type: ws.workspace.type,
          role: ws.role,
          membershipStatus: ws.status,
        })),
      },
      accessToken,
      refreshToken,
    };
  }
};

const switchWorkspace = async (
  userId: string,
  workspaceId: string,
  deviceInfo?: string,
  ipAddress?: string,
) => {
  const workspace = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId },
    },
    select: {
      role: true,
      status: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          ownerId: true,
        },
      },
    },
  });

  if (!workspace) {
    throw createAppError(
      "You do not have access to this workspace",
      Status.FORBIDDEN,
    );
  }

  if (workspace.status !== MembershipStatus.ACTIVE) {
    throw createAppError(
      `Your membership status for this workspace is ${workspace.status}. Please contact support.`,
      Status.FORBIDDEN,
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      systemRole: true,
    },
  });

  if (!user) {
    throw createAppError("User not found", Status.NOT_FOUND);
  }

  const profile =
    (await prisma.doctor.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        verificationStatus: true,
      },
    })) ||
    (await prisma.institution.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        verificationStatus: true,
      },
    }));

  const { accessToken, refreshToken } = generateTokens({
    userId: user.id,
    systemRole: user.systemRole,
    workspaceType: workspace.workspace.type,
    workspaceRole: workspace.role,
    activeWorkspaceId: workspaceId,
  });

  // Store Session
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken,
      deviceInfo: deviceInfo ?? null,
      ipAddress: ipAddress ?? null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  // Log Successful Login
  await prisma.loginHistory.create({
    data: {
      userId: user.id,
      ipAddress: ipAddress ?? null,
      userAgent: deviceInfo ?? null,
      status: LoginStatus.SUCCESS,
    },
  });

  // Audit: Log workspace switch
  await AuditService.logAudit({
    userId: user.id,
    workspaceId,
    actionType: AuditActionType.CHANGE,
    entityType: AuditEntityType.WORKSPACE,
    metadata: {
      userEmail: user.email,
      userName: user.name,
      workspaceName: workspace.workspace.name,
      ipAddress,
      deviceInfo,
    },
  });

  return {
    data: {
      user,
      profile,
      workspace: {
        id: workspace.workspace.id,
        name: workspace.workspace.name,
        slug: workspace.workspace.slug,
        type: workspace.workspace.type,
        role: workspace.role,
        membershipStatus: workspace.status,
        ownerId: workspace.workspace.ownerId,
      },
    },
    accessToken,
    refreshToken,
  };
};

const refreshToken = async (
  token: string,
  deviceInfo?: string,
  ipAddress?: string,
) => {
  let decoded: any;
  try {
    decoded = jwt.verify(token, config.jwt.jwtSecret);
  } catch (error) {
    throw createAppError("Invalid refresh token", Status.UNAUTHORIZED);
  }

  const session = await prisma.session.findUnique({
    where: { refreshToken: token },
    include: { user: true },
  });

  if (!session || !session.isActive || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.updateMany({
        where: { userId: session.userId },
        data: { isActive: false },
      });
    }
    throw createAppError(
      "Session expired or token reused. Please log in again.",
      Status.UNAUTHORIZED,
    );
  }

  const user = session.user;
  const { accessToken, refreshToken: newRefreshToken } = generateTokens({
    userId: user.id,
    systemRole: user.systemRole,
    workspaceType: decoded.workspaceType,
    workspaceRole: decoded.workspaceRole,
    activeWorkspaceId: decoded.activeWorkspaceId,
  });

  // Rotate Session Token
  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshToken: newRefreshToken,
      ipAddress: ipAddress ?? null,
      deviceInfo: deviceInfo ?? null,
      lastUsedAt: new Date(),
    },
  });

  return { accessToken, refreshToken: newRefreshToken };
};

const logOut = async (token: string, userId?: string) => {
  const session = await prisma.session.findUnique({
    where: { refreshToken: token },
  });

  if (session) {
    await prisma.session.update({
      where: { id: session.id },
      data: { isActive: false },
    });

    // Audit: Log logout
    await AuditService.logAudit({
      userId: session.userId,
      actionType: AuditActionType.LOGOUT,
      entityType: AuditEntityType.WORKSPACE,
      metadata: {
        sessionId: session.id,
      },
    });
  }
};

const logoutAll = async (userId: string) => {
  await prisma.session.updateMany({
    where: { userId },
    data: { isActive: false },
  });

  // Audit: Log logout all sessions
  await AuditService.logAudit({
    userId,
    actionType: AuditActionType.LOGOUT,
    entityType: AuditEntityType.SYSTEM,
    metadata: {
      message: "All sessions logged out",
    },
  });
};

const forgetPassword = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    throw createAppError("User not found with this email", Status.NOT_FOUND);
  }

  // Generate a secure short-lived reset token (expires in 15m)
  const resetToken = jwt.sign(
    { id: user.id, purpose: "reset_password" },
    config.jwt.jwtSecret,
    { expiresIn: "15m" },
  );

  // Generate reset URL with token
  const resetUrl = `${config.appUrl}/reset-password?token=${resetToken}`;

  // Send password reset email
  try {
    await emailService.sendPasswordResetEmail(
      user.email,
      user.name,
      resetToken,
      resetUrl,
    );
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    throw createAppError(
      "Failed to send reset email. Please try again later.",
      Status.INTERNAL_SERVER_ERROR,
    );
  }

  return {
    message:
      "Password reset email sent successfully. Please check your email for the reset link.",
  };
};

const resetPassword = async (token: string, newPassword: string) => {
  let decoded: any;
  try {
    decoded = jwt.verify(token, config.jwt.jwtSecret);
  } catch (error) {
    throw createAppError("Invalid or expired reset token", Status.UNAUTHORIZED);
  }

  if (decoded.purpose !== "reset_password") {
    throw createAppError("Invalid token purpose", Status.BAD_REQUEST);
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
  });

  if (!user) {
    throw createAppError("User not found", Status.NOT_FOUND);
  }

  const hashedPassword = await bcrypt.hash(
    newPassword,
    config.bcrypt.bcryptSaltRound,
  );

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await tx.session.updateMany({
      where: { userId: user.id },
      data: { isActive: false },
    });
  });

  // Audit: Log password change
  await AuditService.logAudit({
    userId: user.id,
    actionType: AuditActionType.PASSWORD_CHANGE,
    entityType: AuditEntityType.USER,
    entityId: user.id,
    metadata: {
      userEmail: user.email,
      method: "password_reset",
      allSessionsLoggedOut: true,
    },
  });
};

const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatar: true,
      isActive: true,
      systemRole: true,
      isVerified: true,
      emailVerifiedAt: true,
      onboardingState: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw createAppError("User not found", Status.NOT_FOUND);
  }

  const profile =
    (await prisma.doctor.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        bmdcNumber: true,
        specialization: true,
        verificationStatus: true,
      },
    })) ||
    (await prisma.institution.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        tradeLicenseNo: true,
        website: true,
        verificationStatus: true,
      },
    }));

  const workspaces = await prisma.membership.findMany({
    where: { userId: user.id },
    select: {
      role: true,
      status: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          ownerId: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  return {
    user,
    profile,
    workspaces: workspaces.map((ws) => ({
      id: ws.workspace.id,
      name: ws.workspace.name,
      slug: ws.workspace.slug,
      type: ws.workspace.type,
      role: ws.role,
      membershipStatus: ws.status,
      ownerId: ws.workspace.ownerId,
    })),
  };
};

export const AuthServices = {
  sendOTP,
  signUp,
  logIn,
  switchWorkspace,
  getCurrentUser,
  refreshToken,
  logOut,
  logoutAll,
  forgetPassword,
  resetPassword,
};
