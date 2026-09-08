import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function main() {
  const [inputEmail, inputPassword] = process.argv.slice(2);
  const email = typeof inputEmail === 'string' ? normalizeEmail(inputEmail) : '';
  const password = typeof inputPassword === 'string' ? inputPassword : '';

  if (!email || !password) {
    throw new Error('Usage: npm run db:reset-password --workspace @agency-os/api -- <email> <password>');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!existingUser) {
    throw new Error(`User not found: ${email}`);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { email },
    data: {
      password: passwordHash,
      isActive: true,
      isEmailVerified: true,
      deletedAt: null,
      emailVerifyToken: null,
      passwordResetToken: null,
      passwordResetExpiry: null,
    },
  });

  console.log(`Reset local password for: ${existingUser.email}`);
  console.log(`New local password: ${password}`);
}

main()
  .catch((error) => {
    console.error('Failed to reset local user password');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
