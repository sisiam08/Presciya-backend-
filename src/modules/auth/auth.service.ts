import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { ILogInUserType, ISignUpUserType } from "../../interface";
import jwt from "jsonwebtoken";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import { ContactLabel } from "../../../generated/prisma/enums";

const jwtSecret: jwt.Secret =
  process.env.JWT_SECRET ??
  "dfasdfgsddf*&^^*%^*36472348623*&^*&^b2386t&^%^%$#^%#&%$rv6rr%R&^$&^$&$676R$&^%&^$*6v65$&^%$&%";
const jwtExpiresIn: NonNullable<jwt.SignOptions["expiresIn"]> = (process.env
  .JWT_EXPIRES_IN ?? "4d") as NonNullable<jwt.SignOptions["expiresIn"]>;

const signUp = async (userData: ISignUpUserType) => {
  const { name, email, password, phone } = userData;

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    throw createAppError("User already exists", Status.CONFLICT);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  if (phone) {
    await prisma.contactNumber.create({
      data: { userId: user.id, label: ContactLabel.DEFAULT, phone },
    });
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    jwtSecret,
    {
      expiresIn: jwtExpiresIn,
    },
  );

  return { data: user, token };
};

const logIn = async (userData: ILogInUserType) => {
  const { email, password } = userData;

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      password: true,
    },
  });

  if (!user) {
    throw createAppError("Invalid email or password", Status.UNAUTHORIZED);
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw createAppError("Invalid email or password", Status.UNAUTHORIZED);
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    jwtSecret,
    {
      expiresIn: jwtExpiresIn,
    },
  );

  const { password: _, ...userWithoutPassword } = user;

  return { data: userWithoutPassword, token };
};

const logOut = () => {};

const forgetPassword = () => {};

const resetPassword = () => {};

export const AuthServices = {
  signUp,
  logIn,
  logOut,
  forgetPassword,
  resetPassword,
};
