import { Server } from "http";
import config from "./config";
import { prisma } from "./lib/prisma";

let server: Server;

async function main() {
  console.log("🚀 Starting Doctrivo server...");

  try {
    if (!config.databaseUrl) {
      throw new Error("DATABASE_URL is missing in environment variables");
    }

    console.log("🔌 Connecting to database...");

    await prisma.$connect();

    console.log("✅ Database connected successfully");

    const { default: app } = await import("./app");

    server = app.listen(config.port, async () => {
      console.log(`🌐 Server is running on port ${config.port}`);

      if (config.env !== "production") {
        try {
          const { seed } = await import("../prisma/seed");
          await seed();
        } catch (seedError: any) {
          console.warn("⚠️ Seed warning:", seedError.message);
        }
      } else {
        console.log("🚫 Skipping seed in production");
      }

      // Idempotent subscription expiry warnings (3 days before + at expiry).
      try {
        const { SubscriptionServices } = await import(
          "./modules/subscription/subscription.service"
        );
        const result = await SubscriptionServices.runExpiryChecks();
        if (result.created > 0) {
          console.log(`Subscription expiry warnings created: ${result.created}`);
        }
      } catch (expiryError: any) {
        console.warn("Subscription expiry check warning:", expiryError.message);
      }
    });

    server.on("error", (err) => {
      console.error("❌ Server error:", err);
    });
  } catch (err: any) {
    console.error("❌ Failed to start server:");
    console.error(err);

    process.exit(1);
  }
}

main();

const gracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);

  try {
    await prisma.$disconnect();
    console.log("🔌 Database disconnected");
  } catch (err) {
    console.error("❌ Error disconnecting DB:", err);
  }

  if (server) {
    server.close(() => {
      console.log("🧹 HTTP server closed");
      process.exit(0);
    });

    setTimeout(() => {
      console.error("⏰ Forced shutdown (timeout)");
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

process.on("uncaughtException", (error: Error) => {
  console.error("💥 Uncaught Exception:");
  console.error(error);
  process.exit(1);
});

process.on("unhandledRejection", (reason: any) => {
  console.error("💥 Unhandled Rejection:");
  console.error(reason);
  process.exit(1);
});

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
