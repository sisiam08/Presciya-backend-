import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { UserRole } from "../generated/prisma/enums";

export async function seed() {
  console.log("Starting seed...");

  // Create a seed admin
  const hashedPassword = await bcrypt.hash("@SuperAdmin@123!", 10);

  const admin = await prisma.user.upsert({
    where: {
      email: "superadmin@admin.com",
    },
    update: {},
    create: {
      name: "Super Admin",
      email: "superadmin@admin.com",
      password: hashedPassword,
      role: UserRole.ADMIN,
    },
  });

  console.log("Created admin:", admin.email);

  console.log("Seed completed successfully!");
}
