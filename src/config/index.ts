import dotenv from "dotenv";
import path from "path";
import type { SignOptions } from "jsonwebtoken";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  databaseUrl: process.env.DATABASE_URL,
  appUrl: process.env.APP_URL,
  jwt: {
    jwtSecret: process.env.JWT_SECRET as string,
    jwtExpiresIn: (process.env.JWT_EXPIRES_IN ?? "7d") as NonNullable<
      SignOptions["expiresIn"]
    >,
  },
  bcrypt: {
    bcryptSaltRound: Number(process.env.BCRYPT_SALT_ROUND) || 10,
  },
  regex: {
    bdPhoneRegex: /^(?:\+?88)?01[3-9]\d{8}$/,
    passwordRegex:
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  },
  cloudinary: {
    cloudinaryCloudName: process.env.CLOUDEINARY_CLOUD_NAME,
    cloudinaryApiKey: process.env.CLOUDEINARY_API_KEY,
    cloudinaryApiSecret: process.env.CLOUDEINARY_API_SECRET,
  },
};

export default config;
