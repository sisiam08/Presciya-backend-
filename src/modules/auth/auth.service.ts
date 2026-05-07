import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { SignUpUserType } from "../../interface";
import jwt from "jsonwebtoken";

const jwtSecret = process.env.JWT_SECRET ?? "default-secret-key";
const jwtExpiresIn = (process.env.JWT_EXPIRES_IN ?? "7d") as jwt.SignOptions["expiresIn"];

const signUp = async (userData: SignUpUserType) => {
  const { name, email, password, phone } = userData;

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (existingUser) {
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 20);

  const data = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      phone: phone || null,
    },
  });

  const token = jwt.sign({ id: data.id, email: data.email }, jwtSecret, {
    expiresIn: jwtExpiresIn,
  });
};

const signIn = () => {};

const signOut = () => {};

const forgetPassword = () => {};

const resetPassword = () => {};

export const AuthServices = {
  signUp,
  signIn,
  signOut,
  forgetPassword,
  resetPassword,
};
