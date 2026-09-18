import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import config from "../src/config";
import { SystemRole } from "../generated/prisma/client";

export async function seed() {
  console.log("Starting seed...");

  const hashedPassword = await bcrypt.hash(
    "@SuperAdmin@123!",
    config.bcrypt.bcryptSaltRound,
  );

  const admin = await prisma.user.upsert({
    where: { email: "superadmin@admin.com" },
    update: { isVerified: true, emailVerifiedAt: new Date() },
    create: {
      name: "Super Admin",
      email: "superadmin@admin.com",
      password: hashedPassword,
      systemRole: SystemRole.SUPER_ADMIN,
      isVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.log("Created super admin:", admin.email);
  console.log("Seed completed successfully!");
}
