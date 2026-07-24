import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const [email, name] = process.argv.slice(2);
  if (!email || !name) {
    console.error("Usage: npm run create-user -- <email> <name>");
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    console.error(`User ${normalizedEmail} already exists.`);
    process.exit(1);
  }

  const tempPassword = randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  await prisma.user.create({ data: { email: normalizedEmail, name, passwordHash } });

  console.log(`Created user ${normalizedEmail}.`);
  console.log(`Temporary password: ${tempPassword}`);
  console.log("Share this with the PM through a secure channel; there is no self-serve password reset yet.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
