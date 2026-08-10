import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

const VALID_ROLES = ["ADMIN", "TPM", "PROGRAM_MANAGER", "CLIENT", "PM", "LIMITED"] as const;

async function main() {
  const [email, name, roleArg] = process.argv.slice(2);
  if (!email || !name) {
    console.error(`Usage: npm run create-user -- <email> <name> [role]`);
    console.error(`Roles: ${VALID_ROLES.join(", ")} (defaults to LIMITED — the most restrictive)`);
    process.exit(1);
  }

  const role = (roleArg?.toUpperCase() ?? "LIMITED") as Role;
  if (!VALID_ROLES.includes(role)) {
    console.error(`Invalid role "${roleArg}". Must be one of: ${VALID_ROLES.join(", ")}`);
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
  await prisma.user.create({ data: { email: normalizedEmail, name, passwordHash, role } });

  console.log(`Created user ${normalizedEmail} with role ${role}.`);
  console.log(`Temporary password: ${tempPassword}`);
  console.log("Share this through a secure channel; there is no self-serve password reset yet.");
  if (role !== "ADMIN" && role !== "TPM" && role !== "PROGRAM_MANAGER") {
    console.log(`Note: ${role} users see nothing until an Admin assigns them to a project (Project > Team tab).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
