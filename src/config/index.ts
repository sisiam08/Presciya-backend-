import dotenv from "dotenv";
import path from "path";
import { z } from "zod";
import type { SignOptions } from "jsonwebtoken";

dotenv.config({ path: path.join(process.cwd(), ".env") });

/**
 * Central, validated configuration. Every environment-dependent value used by
 * authentication lives here — no `process.env.X` lookups are scattered through
 * the codebase and no security-sensitive value is hardcoded in source.
 */

type ExpiresIn = NonNullable<SignOptions["expiresIn"]>;

const DURATION_UNITS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Convert a duration ("15m", "7d", "3600", "45s") to milliseconds. Keeps the
 * cookie max-age and the server-side session expiry in lockstep with the token
 * lifetime instead of duplicating the number in several places.
 */
export const durationToMs = (value: string | number): number => {
  if (typeof value === "number") return value * 1000; // jsonwebtoken treats bare numbers as seconds
  const match = /^\s*(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)?\s*$/i.exec(value);
  if (!match) {
    throw new Error(`Invalid duration "${value}" (expected e.g. "15m", "7d", "3600")`);
  }
  const amount = Number(match[1]);
  const unit = (match[2] ?? "s").toLowerCase();
  const multiplier = DURATION_UNITS[unit] ?? 1000;
  return Math.round(amount * multiplier);
};

/** "1h"/"7d"/seconds — accepted by jsonwebtoken as-is. */
const durationSchema = z
  .union([z.string().regex(/^\s*\d+(?:\.\d+)?\s*(ms|s|m|h|d|w)?\s*$/i, "Invalid duration"), z.coerce.number().positive()])
  .default("1h");

/** Env booleans ("true"/"1"/"yes"/"on") — `z.coerce.boolean()` would make "false" truthy. */
const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((value) =>
    typeof value === "boolean"
      ? value
      : ["true", "1", "yes", "on"].includes(value.trim().toLowerCase()),
  );

const isProduction = process.env.NODE_ENV === "production";

const envSchema = z.object({
  // ── Application ──────────────────────────────────────────────────────────
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  APP_URL: z.string().url().default("http://localhost:3000"),
  FRONTEND_URL: z.string().url().optional(),
  /** Extra allowed origins, comma separated (e.g. staging frontends). */
  CORS_ORIGIN: z.string().optional(),

  // ── Database ─────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // ── Access / refresh tokens (independent secrets + lifetimes) ────────────
  ACCESS_TOKEN_SECRET: z.string().min(32, "ACCESS_TOKEN_SECRET must be at least 32 characters").optional(),
  ACCESS_TOKEN_EXPIRES_IN: durationSchema,
  REFRESH_TOKEN_SECRET: z.string().min(32, "REFRESH_TOKEN_SECRET must be at least 32 characters").optional(),
  REFRESH_TOKEN_EXPIRES_IN: durationSchema.default("7d"),

  // Legacy single-secret names are still honoured as a development fallback so
  // existing environments keep working, but they are never used in production.
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: durationSchema.optional(),

  // ── JWT claims validation ────────────────────────────────────────────────
  JWT_ISSUER: z.string().default("presciya-api"),
  JWT_AUDIENCE: z.string().default("presciya-web"),

  // ── Authentication cookies ───────────────────────────────────────────────
  ACCESS_TOKEN_COOKIE_NAME: z.string().default("accessToken"),
  REFRESH_TOKEN_COOKIE_NAME: z.string().default("refreshToken"),
  /** Optional overrides — default to the matching token lifetime. */
  ACCESS_TOKEN_COOKIE_MAX_AGE: z.coerce.number().int().positive().optional(),
  REFRESH_TOKEN_COOKIE_MAX_AGE: z.coerce.number().int().positive().optional(),
  COOKIE_SECURE: booleanish.optional(),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).optional(),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_PATH: z.string().default("/"),

  // ── Sessions / one-time codes ────────────────────────────────────────────
  /** Defaults to the refresh-token lifetime (a session cannot outlive it). */
  SESSION_EXPIRES_IN: durationSchema.optional(),
  OTP_EXPIRES_IN: z.string().default("15m"),
  PASSWORD_RESET_EXPIRES_IN: z.string().default("15m"),
  INVITATION_EXPIRY_DAYS: z.coerce.number().int().positive().default(7),

  // ── Password hashing ─────────────────────────────────────────────────────
  BCRYPT_SALT_ROUND: z.coerce.number().int().min(4).max(15).optional(),

  // ── Rate limiting ────────────────────────────────────────────────────────
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  GENERAL_RATE_LIMIT: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  PUBLIC_VERIFY_RATE_LIMIT: z.coerce.number().int().positive().default(30),

  // ── External services ────────────────────────────────────────────────────
  CLOUDEINARY_CLOUD_NAME: z.string().optional(),
  CLOUDEINARY_API_KEY: z.string().optional(),
  CLOUDEINARY_API_SECRET: z.string().optional(),
  NODEMAILER_HOST: z.string().optional(),
  NODEMAILER_PORT: z.coerce.number().int().positive().default(587),
  APP_USER: z.string().optional(),
  APP_PASSWORD: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  // Fail fast: a misconfigured server must not start half-working.
  throw new Error(`Invalid environment configuration:\n${problems}`);
}

const env = parsed.data;

const DEV_ACCESS_SECRET = "dev-only-access-secret-change-me-000000000000";
const DEV_REFRESH_SECRET = "dev-only-refresh-secret-change-me-000000000";

if (isProduction) {
  const missing: string[] = [];
  if (!env.ACCESS_TOKEN_SECRET && !env.JWT_SECRET) missing.push("ACCESS_TOKEN_SECRET");
  if (!env.REFRESH_TOKEN_SECRET) missing.push("REFRESH_TOKEN_SECRET");
  if (missing.length > 0) {
    throw new Error(
      `Missing required production secret(s): ${missing.join(", ")}. Refusing to start with an insecure fallback.`,
    );
  }
}

const accessSecret = env.ACCESS_TOKEN_SECRET ?? env.JWT_SECRET ?? DEV_ACCESS_SECRET;
const refreshSecret = env.REFRESH_TOKEN_SECRET ?? `${DEV_REFRESH_SECRET}`;

if (!isProduction) {
  if (!env.ACCESS_TOKEN_SECRET) {
    console.warn(
      "[config] ACCESS_TOKEN_SECRET not set — using a development fallback. Set it before deploying.",
    );
  }
  if (!env.REFRESH_TOKEN_SECRET) {
    console.warn(
      "[config] REFRESH_TOKEN_SECRET not set — using a development fallback. Set it before deploying.",
    );
  }
}

const accessExpiresIn = env.ACCESS_TOKEN_EXPIRES_IN as ExpiresIn;
const refreshExpiresIn = env.REFRESH_TOKEN_EXPIRES_IN as ExpiresIn;

// Cookie lifetimes default to the token lifetimes so they can never drift.
const accessCookieMaxAge =
  env.ACCESS_TOKEN_COOKIE_MAX_AGE ?? durationToMs(env.ACCESS_TOKEN_EXPIRES_IN);
const refreshCookieMaxAge =
  env.REFRESH_TOKEN_COOKIE_MAX_AGE ?? durationToMs(env.REFRESH_TOKEN_EXPIRES_IN);

const corsOrigins = Array.from(
  new Set(
    [env.FRONTEND_URL ?? env.APP_URL, ...(env.CORS_ORIGIN?.split(",") ?? [])]
      .map((origin) => origin.trim())
      .filter(Boolean),
  ),
);

const config = {
  env: env.NODE_ENV,
  isProduction,
  port: env.PORT,
  appUrl: env.APP_URL,
  frontendUrl: env.FRONTEND_URL ?? env.APP_URL,
  databaseUrl: env.DATABASE_URL,

  accessToken: {
    secret: accessSecret,
    expiresIn: accessExpiresIn,
    expiresInMs: durationToMs(env.ACCESS_TOKEN_EXPIRES_IN),
  },
  refreshToken: {
    secret: refreshSecret,
    expiresIn: refreshExpiresIn,
    expiresInMs: durationToMs(env.REFRESH_TOKEN_EXPIRES_IN),
  },

  jwt: {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  },

  cookie: {
    accessName: env.ACCESS_TOKEN_COOKIE_NAME,
    refreshName: env.REFRESH_TOKEN_COOKIE_NAME,
    accessMaxAge: accessCookieMaxAge,
    refreshMaxAge: refreshCookieMaxAge,
    secure: env.COOKIE_SECURE ?? isProduction,
    sameSite: env.COOKIE_SAME_SITE ?? (isProduction ? "strict" : "lax"),
    domain: env.COOKIE_DOMAIN,
    path: env.COOKIE_PATH,
  },

  session: {
    expiresInMs: durationToMs(env.SESSION_EXPIRES_IN ?? env.REFRESH_TOKEN_EXPIRES_IN),
  },
  otp: {
    expiresInMs: durationToMs(env.OTP_EXPIRES_IN),
  },
  passwordReset: {
    expiresIn: env.PASSWORD_RESET_EXPIRES_IN as ExpiresIn,
    expiresInMs: durationToMs(env.PASSWORD_RESET_EXPIRES_IN),
  },

  bcrypt: {
    // Never lower than 10 outside tests; production defaults a notch higher.
    bcryptSaltRound: env.BCRYPT_SALT_ROUND ?? (isProduction ? 12 : 10),
  },

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    general: env.GENERAL_RATE_LIMIT,
    auth: env.AUTH_RATE_LIMIT,
    publicVerify: env.PUBLIC_VERIFY_RATE_LIMIT,
  },

  cors: {
    origins: corsOrigins,
  },

  regex: {
    // Phone rules live in src/utils/phone.ts — the single source of truth.
    passwordRegex:
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  },
  cloudinary: {
    cloudinaryCloudName: env.CLOUDEINARY_CLOUD_NAME,
    cloudinaryApiKey: env.CLOUDEINARY_API_KEY,
    cloudinaryApiSecret: env.CLOUDEINARY_API_SECRET,
  },
  nodemailer: {
    host: env.NODEMAILER_HOST,
    port: env.NODEMAILER_PORT,
    auth: {
      user: env.APP_USER,
      pass: env.APP_PASSWORD,
    },
  },
  invitationExpiryDays: env.INVITATION_EXPIRY_DAYS,
};

export default config;
