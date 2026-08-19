import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ORG_NAME = 'Acme Realty';
const AGENT_NAMES = ['Ada Obi', 'Ben Musa', 'Chidi Eze'];
const LEAD_PHONES = ['+2348010000001', '+2348010000002', '+2348010000003', '+2348010000004'];
const DEV_PASSWORD = 'password123';

async function getOrCreateOrganization(): Promise<{ id: string; name: string }> {
  const existing = await prisma.organization.findFirst({ where: { name: ORG_NAME } });
  if (existing) return existing;
  return prisma.organization.create({ data: { name: ORG_NAME } });
}

async function seed() {
  const org = await getOrCreateOrganization();
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const users = [
    { email: 'admin@acme.test', name: 'Admin User', role: Role.ADMIN },
    { email: 'agent@acme.test', name: 'Agent User', role: Role.AGENT },
    { email: 'user@acme.test', name: 'Regular User', role: Role.USER },
  ];
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { role: user.role, organizationId: org.id, passwordHash },
      create: { email: user.email, name: user.name, role: user.role, organizationId: org.id, passwordHash },
    });
  }

  let agents = await prisma.agent.findMany({ where: { organizationId: org.id } });
  if (agents.length === 0) {
    for (const name of AGENT_NAMES) {
      agents.push(await prisma.agent.create({ data: { organizationId: org.id, name } }));
    }
  }

  if ((await prisma.leadProfile.count({ where: { organizationId: org.id } })) === 0) {
    const leads = await Promise.all(
      LEAD_PHONES.map((phone, index) =>
        prisma.leadProfile.create({
          data: { organizationId: org.id, phone, name: `Lead ${phone.slice(-4)}`, score: (index + 1) * 25 },
        }),
      ),
    );
    if (agents.length > 0) {
      await prisma.leadProfile.update({
        where: { id: leads[0].id },
        data: { agentId: agents[0].id, status: 'assigned' },
      });
    }
  }

  if ((await prisma.booking.count({ where: { organizationId: org.id } })) === 0) {
    const lead = await prisma.leadProfile.findFirst({ where: { organizationId: org.id } });
    if (lead) {
      await prisma.booking.create({
        data: { organizationId: org.id, leadId: lead.id, at: new Date(Date.now() + 86_400_000) },
      });
    }
  }

  if ((await prisma.deal.count({ where: { organizationId: org.id } })) === 0) {
    const lead = await prisma.leadProfile.findFirst({ where: { organizationId: org.id } });
    if (lead) {
      await prisma.deal.create({
        data: { organizationId: org.id, amount: 125_000, stage: 'proposed' },
      });
    }
  }

  const summary = {
    organization: org.id,
    users: await prisma.user.count({ where: { organizationId: org.id } }),
    agents: await prisma.agent.count({ where: { organizationId: org.id } }),
    leads: await prisma.leadProfile.count({ where: { organizationId: org.id } }),
    bookings: await prisma.booking.count({ where: { organizationId: org.id } }),
    deals: await prisma.deal.count({ where: { organizationId: org.id } }),
  };
  console.log(`Seed complete for ${org.name}`, summary);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());