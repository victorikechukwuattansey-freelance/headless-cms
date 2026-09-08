import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = 'admin@agency-os.local';
const DEFAULT_ADMIN_PASSWORD = 'Admin1234!';
const DEFAULT_ADMIN_NAME = 'Local Admin';

const getSeedConfig = () => ({
  email: (process.env.ADMIN_SEED_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase(),
  password: process.env.ADMIN_SEED_PASSWORD || DEFAULT_ADMIN_PASSWORD,
  name: (process.env.ADMIN_SEED_NAME || DEFAULT_ADMIN_NAME).trim(),
});

async function main() {
  const { email, password, name } = getSeedConfig();
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password: passwordHash,
      role: 'ADMIN',
      isActive: true,
      isEmailVerified: true,
      deletedAt: null,
      emailVerifyToken: null,
      passwordResetToken: null,
      passwordResetExpiry: null,
    },
    create: {
      email,
      name,
      password: passwordHash,
      role: 'ADMIN',
      isActive: true,
      isEmailVerified: true,
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  console.log(`Seeded local admin user: ${user.email}`);
  console.log(`Local admin password: ${password}`);
}

main()
  .catch((error) => {
    console.error('Failed to seed local admin user');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
