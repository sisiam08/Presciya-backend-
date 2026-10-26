import { Resend } from "resend";
import crypto from "node:crypto";
import config from "../config";

const RESEND_BASE_URL = "https://api.resend.com";
const resend = new Resend(config.resend.apiKey, { baseUrl: RESEND_BASE_URL });

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  requestId?: string;
}

// ── Core sender ───────────────────────────────────────────────────────────────

const redactEmailDetails = (value: string): string =>
  value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]")
    .replace(/\b\d{6}\b/g, "[redacted code]")
    .replace(/(?:re|sk)_[A-Za-z0-9_-]+/gi, "[redacted key]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 500);

type NetworkErrorDetails = {
  name: string;
  code?: string | number;
  message?: string;
  cause?: NetworkErrorDetails;
};

const getNetworkErrorDetails = (
  error: unknown,
  depth = 0,
): NetworkErrorDetails => {
  if (!error || typeof error !== "object") {
    return { name: "UnknownError" };
  }

  const errorLike = error as {
    name?: unknown;
    code?: unknown;
    message?: unknown;
    cause?: unknown;
  };
  const details: NetworkErrorDetails = {
    name:
      typeof errorLike.name === "string"
        ? redactEmailDetails(errorLike.name)
        : "Error",
  };

  if (
    typeof errorLike.code === "string" ||
    typeof errorLike.code === "number"
  ) {
    details.code =
      typeof errorLike.code === "string"
        ? redactEmailDetails(errorLike.code).slice(0, 100)
        : errorLike.code;
  }
  if (typeof errorLike.message === "string") {
    details.message = redactEmailDetails(errorLike.message);
  }
  if (errorLike.cause && depth < 3) {
    details.cause = getNetworkErrorDetails(errorLike.cause, depth + 1);
  }
  return details;
};

export const createResendDiagnosticFetch = (
  fetchImplementation: typeof fetch,
  options: {
    maxRetries?: number;
    sleep?: (milliseconds: number) => Promise<void>;
    random?: () => number;
  } = {},
): typeof fetch =>
  async (input, init) => {
    const maxRetries = options.maxRetries ?? 2;
    const sleep =
      options.sleep ??
      ((milliseconds: number) =>
        new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
    const random = options.random ?? Math.random;
    let requestUrl: URL | undefined;
    try {
      const inputUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      requestUrl = new URL(inputUrl);
    } catch {
      // The SDK handles malformed request inputs.
    }

    const isResendEmailRequest =
      requestUrl?.origin === RESEND_BASE_URL &&
      requestUrl.pathname === "/emails";

    for (let attempt = 0; ; attempt += 1) {
      try {
        return await fetchImplementation(input, init);
      } catch (error: unknown) {
        const networkError = getNetworkErrorDetails(error);
        const isConnectTimeout =
          networkError.code === "UND_ERR_CONNECT_TIMEOUT" ||
          networkError.cause?.code === "UND_ERR_CONNECT_TIMEOUT";

        if (
          isResendEmailRequest &&
          requestUrl &&
          isConnectTimeout &&
          attempt < maxRetries
        ) {
          const delayMs = Math.min(300 * 2 ** attempt, 2_000);
          const retryInMs = delayMs + Math.floor(random() * 200);
          console.warn(
            JSON.stringify({
              level: "warn",
              type: "email_transport_retry",
              provider: "resend",
              host: requestUrl.host,
              path: requestUrl.pathname,
              attempt: attempt + 1,
              maxAttempts: maxRetries + 1,
              errorCode: "UND_ERR_CONNECT_TIMEOUT",
              retryInMs,
              timestamp: new Date().toISOString(),
            }),
          );
          await sleep(retryInMs);
          continue;
        }

        if (isResendEmailRequest && requestUrl) {
          console.error(
            JSON.stringify({
              level: "error",
              type: "email_transport_failed",
              provider: "resend",
              host: requestUrl.host,
              path: requestUrl.pathname,
              attempts: attempt + 1,
              networkError,
              timestamp: new Date().toISOString(),
            }),
          );
        }
        throw error;
      }
    }
  };

// The SDK replaces fetch exceptions with a generic error, so capture the cause here.
globalThis.fetch = createResendDiagnosticFetch(globalThis.fetch.bind(globalThis));

const getResendFailureDetails = (error: unknown) => {
  type ResendErrorLike = {
    name?: unknown;
    code?: unknown;
    statusCode?: unknown;
    message?: unknown;
    body?: unknown;
  };

  const resendError: ResendErrorLike =
    typeof error === "object" && error !== null ? (error as ResendErrorLike) : {};

  const statusCode =
    typeof resendError.statusCode === "number"
      ? resendError.statusCode
      : null;

  const details = [
    typeof resendError.name === "string"
      ? `name=${redactEmailDetails(resendError.name)}`
      : null,
    typeof resendError.code === "string" ||
    typeof resendError.code === "number"
      ? `code=${resendError.code}`
      : null,
    typeof resendError.message === "string"
      ? redactEmailDetails(resendError.message)
      : null,
    typeof resendError.body === "string"
      ? redactEmailDetails(resendError.body)
      : null,
  ].filter((detail): detail is string => Boolean(detail));

  return { statusCode, details: details.slice(0, 5) };
};

const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    const fromAddress = config.resend.fromName
      ? `${config.resend.fromName} <${config.resend.fromEmail}>`
      : config.resend.fromEmail;

    const response = await resend.emails.send(
      {
        from: fromAddress,
        to: [options.to],
        subject: options.subject,
        text: options.text ?? "",
        html: options.html,
      },
      { idempotencyKey: crypto.randomUUID() },
    );

    if (response.error) {
      throw response.error;
    }

    console.log(
      JSON.stringify({
        level: "info",
        type: "email_delivery",
        provider: "resend",
        requestId: options.requestId,
        statusCode: 200,
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (error: unknown) {
    const { statusCode, details } = getResendFailureDetails(error);
    console.error(
      JSON.stringify({
        level: "error",
        type: "email_delivery_failed",
        provider: "resend",
        requestId: options.requestId,
        statusCode,
        details,
        timestamp: new Date().toISOString(),
      }),
    );
    throw new Error("Failed to send email. Please try again later.");
  }
};

// ── OTP verification ──────────────────────────────────────────────────────────

const sendOTPEmail = async (
  email: string,
  name: string,
  otp: string,
  requestId?: string,
): Promise<void> => {
  const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <style>
      body { font-family: 'Inter', sans-serif; color: #0b1c30; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #0058bc; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
      .content { background-color: #f8f9ff; padding: 30px; border-radius: 0 0 8px 8px; }
      .otp-box { background-color: #0058bc; color: white; padding: 20px; border-radius: 6px; text-align: center; margin-top: 20px; }
      .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 5px; font-family: 'Courier New', monospace; }
      .footer { font-size: 12px; color: #717786; margin-top: 20px; text-align: center; }
      .warning { background-color: #ffdad6; padding: 10px; border-radius: 4px; margin-top: 20px; color: #93000a; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header"><h1>Presciya Email Verification</h1></div>
      <div class="content">
        <p>Hello ${name},</p>
        <p>Thank you for signing up to Presciya! To complete your registration, please verify your email address using the OTP below:</p>
        <div class="otp-box"><div class="otp-code">${otp}</div></div>
        <p style="margin-top:20px;text-align:center;color:#717786;">This code will expire in 15 minutes</p>
        <div class="warning">
          <strong>&#9888;&#65039; Security Notice:</strong>
          <ul>
            <li>Never share this OTP with anyone</li>
            <li>Presciya staff will never ask for your OTP</li>
            <li>This code is valid for 15 minutes only</li>
          </ul>
        </div>
        <p style="margin-top:20px;color:#414755;">If you didn't request this, please ignore this email or contact our support team.</p>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} Presciya. All rights reserved.</p>
        <p>This is an automated email. Please do not reply.</p>
      </div>
    </div>
  </body>
</html>`;

  const textContent = `Hello ${name},

Thank you for signing up to Presciya! To complete your registration, please verify your email using this OTP:

${otp}

This code will expire in 15 minutes.

Never share this OTP with anyone. If you didn't request this, please ignore this email.

---
Presciya`;

  await sendEmail({
    to: email,
    subject: "Verify Your Presciya Account",
    html: htmlContent,
    text: textContent,
    ...(requestId ? { requestId } : {}),
  });
};

// ── Password reset ────────────────────────────────────────────────────────────

const sendPasswordResetEmail = async (
  email: string,
  name: string,
  resetToken: string,
  resetUrl: string,
): Promise<void> => {
  const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <style>
      body { font-family: 'Inter', sans-serif; color: #0b1c30; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #0058bc; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
      .content { background-color: #f8f9ff; padding: 30px; border-radius: 0 0 8px 8px; }
      .button { display: inline-block; background-color: #0058bc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
      .footer { font-size: 12px; color: #717786; margin-top: 20px; text-align: center; }
      .warning { background-color: #ffdad6; padding: 10px; border-radius: 4px; margin-top: 20px; color: #93000a; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header"><h1>Presciya Password Reset</h1></div>
      <div class="content">
        <p>Hello ${name},</p>
        <p>You requested a password reset for your Presciya account. Click the button below to reset your password:</p>
        <center><a href="${resetUrl}" class="button">Reset Password</a></center>
        <p style="margin-top:20px;">Or copy and paste this link in your browser:</p>
        <p style="word-break:break-all;background-color:#e5eeff;padding:10px;border-radius:4px;">${resetUrl}</p>
        <div class="warning">
          <strong>&#9888;&#65039; Security Notice:</strong>
          <ul>
            <li>This link will expire in 15 minutes</li>
            <li>Never share this link with anyone</li>
            <li>If you didn't request this, please ignore this email</li>
          </ul>
        </div>
        <p style="margin-top:20px;color:#414755;">If you have any questions, please contact our support team.</p>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} Presciya. All rights reserved.</p>
        <p>This is an automated email. Please do not reply.</p>
      </div>
    </div>
  </body>
</html>`;

  const textContent = `Hello ${name},

You requested a password reset for your Presciya account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 15 minutes.

Never share this link with anyone. If you didn't request this, please ignore this email.

---
Presciya`;

  await sendEmail({
    to: email,
    subject: "Reset Your Presciya Password",
    html: htmlContent,
    text: textContent,
  });
};

// ── Workspace invitation ──────────────────────────────────────────────────────

const sendInvitationEmail = async (
  email: string,
  name: string,
  workspaceName: string,
  invitationToken: string,
  dummyPassword?: string,
  isNewUser?: boolean,
): Promise<void> => {
  const invitationUrl = `${config.frontendUrl}/invitations/${invitationToken}`;

  const credentialsSection =
    isNewUser && dummyPassword
      ? `<div class="highlight" style="background-color:#fff3cd;border-left-color:#ff9800;">
          <p style="color:#856404;"><strong>&#9888;&#65039; Temporary Login Credentials</strong></p>
          <p style="color:#856404;margin-bottom:5px;">Your account has been created. Use these credentials to log in:</p>
          <p style="background-color:#fff;padding:10px;border-radius:4px;margin:10px 0;font-family:'Courier New',monospace;color:#0b1c30;">
            <strong>Email:</strong> ${email}<br/>
            <strong>Password:</strong> ${dummyPassword}
          </p>
          <p style="color:#d9534f;margin-top:10px;"><strong>Important:</strong> This is a temporary password. After logging in, you <strong>must immediately change your password</strong> from your account settings.</p>
        </div>`
      : "";

  const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <style>
      body { font-family: 'Inter', sans-serif; color: #0b1c30; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #0058bc; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
      .content { background-color: #f8f9ff; padding: 30px; border-radius: 0 0 8px 8px; }
      .button { display: inline-block; background-color: #0058bc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold; font-size: 14px; }
      .footer { font-size: 12px; color: #717786; margin-top: 20px; text-align: center; }
      .highlight { background-color: #e5eeff; padding: 10px; border-left: 4px solid #0058bc; margin-top: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header"><h1>You're Invited to ${workspaceName}</h1></div>
      <div class="content">
        <p>Hello ${name},</p>
        <p>You've been invited to join <strong>${workspaceName}</strong> on Presciya!</p>
        <center><a href="${invitationUrl}" class="button" style="color:white;">Accept Invitation</a></center>
        <div class="highlight">
          <p><strong>Or copy this link:</strong></p>
          <p style="word-break:break-all;margin:0;">${invitationUrl}</p>
        </div>
        ${credentialsSection}
        <p style="margin-top:20px;color:#414755;"><strong>Note:</strong> This invitation will expire in ${config.invitationExpiryDays} days.</p>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} Presciya. All rights reserved.</p>
        <p>This is an automated email. Please do not reply.</p>
      </div>
    </div>
  </body>
</html>`;

  const credentialsTextSection =
    isNewUser && dummyPassword
      ? `\n\n⚠️ TEMPORARY LOGIN CREDENTIALS\n===============================\nEmail: ${email}\nPassword: ${dummyPassword}\n\nIMPORTANT: Change this password immediately after logging in.`
      : "";

  const textContent = `Hello ${name},

You've been invited to join ${workspaceName} on Presciya!

Click the link below to accept the invitation:
${invitationUrl}

This invitation will expire in ${config.invitationExpiryDays} days.${credentialsTextSection}

---
Presciya`;

  await sendEmail({
    to: email,
    subject: `You're invited to ${workspaceName} on Presciya`,
    html: htmlContent,
    text: textContent,
  });
};

// ── Exports ───────────────────────────────────────────────────────────────────

export const emailService = {
  sendEmail,
  sendPasswordResetEmail,
  sendOTPEmail,
};

export { sendInvitationEmail };
