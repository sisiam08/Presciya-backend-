import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import config from "../config";

const connectionString = config.databaseUrl;

// PrismaPg uses the pg driver adapter (required for Neon serverless / pg package)
const adapter = new PrismaPg({ connectionString });

const prisma = new PrismaClient({
  adapter,
  log: [
    { level: "warn", emit: "stdout" },
    { level: "error", emit: "stdout" },
  ],
});

export { prisma };
