import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const phone = process.argv[2];

  if (!phone) {
    console.error("Usage: node scripts/make-admin.mjs <phone_number>");
    process.exit(1);
  }

  const cleanPhone = phone.trim();
  console.log(`Connecting to database to upgrade phone: ${cleanPhone}...`);

  try {
    const existing = await prisma.tenant.findUnique({
      where: { phone: cleanPhone },
    });

    if (existing) {
      const updated = await prisma.tenant.update({
        where: { phone: cleanPhone },
        data: { role: "SUPER_ADMIN" },
      });
      console.log(`✅ Success: User with ID ${updated.id} (${cleanPhone}) is now SUPER_ADMIN.`);
    } else {
      const created = await prisma.tenant.create({
        data: {
          phone: cleanPhone,
          password: "admin_temp_password_change_me",
          name: "Super Admin",
          role: "SUPER_ADMIN",
          subscriptionStatus: "ACTIVE",
        },
      });
      console.log(`✅ Success: Created new SUPER_ADMIN user with ID ${created.id} (${cleanPhone}).`);
    }
  } catch (error) {
    console.error("❌ Error upgrading user:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
