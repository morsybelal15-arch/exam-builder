import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:password@localhost:5432/exambuilder?schema=public";

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedAdmin() {
  const phone = "01141159039";
  const rawPassword = "Adminbelal011$";

  console.log(`Seeding Super Admin: ${phone}...`);
  try {
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const admin = await prisma.tenant.upsert({
      where: { phone },
      update: {
        role: "SUPER_ADMIN",
        password: hashedPassword,
        subscriptionStatus: "ACTIVE",
        name: "Belal Morsy (مدير النظام)",
        planType: "مدير النظام الشامل (Super Admin)",
      },
      create: {
        phone,
        password: hashedPassword,
        name: "Belal Morsy (مدير النظام)",
        role: "SUPER_ADMIN",
        subscriptionStatus: "ACTIVE",
        planType: "مدير النظام الشامل (Super Admin)",
      },
    });

    console.log("Super Admin seeded successfully:", {
      id: admin.id,
      phone: admin.phone,
      role: admin.role,
      name: admin.name,
    });
  } catch (err) {
    console.error("Error seeding super admin:", err.message);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

seedAdmin();
