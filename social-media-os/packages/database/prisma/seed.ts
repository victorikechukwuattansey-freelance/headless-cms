import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const org = await prisma.organization.create({
    data: {
      name: 'Acme Corp',
      slug: 'acme-corp',
      subscriptionTier: 'PRO',
    },
  });

  const user = await prisma.user.create({
    data: {
      email: 'admin@acme.com',
      name: 'Admin User',
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      organizationId: org.id,
      name: 'Main',
      slug: 'main',
    },
  });

  await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      role: 'OWNER',
    },
  });

  const brandVoice = await prisma.brandVoice.create({
    data: {
      workspaceId: workspace.id,
      name: 'Default Brand Voice',
      personality: ['Professional', 'Friendly', 'Innovative'],
      audience: 'B2B SaaS professionals and decision-makers',
      writingStyle: 'Clear, concise, with a focus on value propositions and data-driven insights',
      forbiddenWords: ['synergy', 'game-changer', 'disrupt'],
      approvedTerms: ['platform', 'solution', 'integrate'],
    },
  });

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { brandVoiceId: brandVoice.id },
  });

  const post = await prisma.post.create({
    data: {
      workspaceId: workspace.id,
      authorId: user.id,
      content: { text: 'Excited to announce our new AI-powered social media management platform!' },
      postType: 'TEXT',
      status: 'DRAFT',
      platforms: ['LINKEDIN', 'TWITTER'],
    },
  });

  await prisma.postVersion.create({
    data: {
      postId: post.id,
      platform: 'LINKEDIN',
      content: 'Excited to announce our new AI-powered social media management platform! Built for modern teams who need to move faster.',
      status: 'DRAFT',
    },
  });

  await prisma.postVersion.create({
    data: {
      postId: post.id,
      platform: 'TWITTER',
      content: 'Excited to announce our new AI-powered social media management platform! 🚀',
      status: 'DRAFT',
    },
  });

  const workflow = await prisma.workflow.create({
    data: {
      workspaceId: workspace.id,
      name: 'Blog to Social',
      description: 'When a new blog is published, repurpose it across all connected platforms',
      trigger: { type: 'webhook', config: { url: '/webhooks/blog-published' } },
      actions: [
        { type: 'ai_repurpose', config: { source: 'blog', platforms: ['LINKEDIN', 'TWITTER', 'FACEBOOK'] }, order: 1 },
        { type: 'generate_images', config: { count: 3, style: 'professional' }, order: 2 },
        { type: 'schedule_posts', config: { spacing: 'daily' }, order: 3 },
      ],
      isActive: true,
    },
  });

  console.log('Seed complete.');
  console.log(`  Organization: ${org.id}`);
  console.log(`  User: ${user.id}`);
  console.log(`  Workspace: ${workspace.id}`);
  console.log(`  Brand Voice: ${brandVoice.id}`);
  console.log(`  Post: ${post.id}`);
  console.log(`  Workflow: ${workflow.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
