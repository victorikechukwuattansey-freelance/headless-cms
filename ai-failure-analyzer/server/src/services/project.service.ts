import { prisma } from '../db.js';

/**
 * MVP has no auth — every log lands in the first project (created for the
 * demo user on first use).
 */
export async function resolveProject(): Promise<{ id: string }> {
  const existing = await prisma.project.findFirst({ orderBy: { createdAt: 'asc' } });
  if (existing) return existing;

  const user = await prisma.user.upsert({
    where: { email: 'owner@example.com' },
    update: {},
    create: { email: 'owner@example.com', name: 'Demo Owner' },
  });
  return prisma.project.create({
    data: { name: 'Default project', description: 'Auto-created when the first log was uploaded', userId: user.id },
  });
}
