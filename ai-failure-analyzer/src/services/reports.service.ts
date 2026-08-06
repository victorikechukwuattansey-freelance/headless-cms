import { prisma } from '../db.js';

export async function listReports(limit = 50) {
  return prisma.report.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 200),
    select: {
      id: true,
      summary: true,
      failureType: true,
      confidence: true,
      sourceFormat: true,
      redactions: true,
      createdAt: true,
    },
  });
}

export async function getReport(id: string) {
  return prisma.report.findUnique({
    where: { id },
    include: {
      steps: { orderBy: { order: 'asc' } },
      evidences: true,
    },
  });
}

export async function deleteReport(id: string) {
  return prisma.report.delete({ where: { id } });
}
