import { PrismaClient } from "../generated/client";
import { createHash, randomBytes } from "node:crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const iterations = 100_000;
  const hash = createHash("sha256")
    .update(salt + password)
    .digest("hex");
  return `sha256$${iterations}$${salt}$${hash}`;
}

async function main() {
  const email = "admin@example.com";
  const orgSlug = "demo-org";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Seed: demo user already exists, skipping.");
    return;
  }

  const org = await prisma.organization.create({
    data: {
      name: "Demo Organization",
      slug: orgSlug,
      plan: "free",
      status: "ACTIVE",
      settings: { region: "eu-west" },
    },
  });

  const user = await prisma.user.create({
    data: {
      email,
      username: "admin",
      displayName: "Demo Admin",
      passwordHash: hashPassword("demo-password"),
      status: "ACTIVE",
      emailVerified: true,
      timezone: "UTC",
      locale: "en",
    },
  });

  await prisma.membership.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      role: "OWNER",
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      organizationId: org.id,
      name: "Default Workspace",
      description: "Primary workspace for demo organization",
      visibility: "private",
      createdById: user.id,
    },
  });

  const workflow = await prisma.workflow.create({
    data: {
      organizationId: org.id,
      workspaceId: workspace.id,
      name: "Demo: AI Text Workflow",
      description: "Manual trigger → AI summarize → log output",
      status: "DRAFT",
      triggerType: "MANUAL",
      currentVersion: 1,
      tags: ["demo", "ai"],
      createdById: user.id,
      updatedById: user.id,
    },
  });

  const nodes = [
    {
      nodeKey: "trigger-1",
      nodeType: "manual-trigger",
      category: "TRIGGER",
      positionX: 40,
      positionY: 120,
      configuration: {},
      metadata: { label: "Manual Trigger" },
    },
    {
      nodeKey: "ai-1",
      nodeType: "ai-chat",
      category: "AI",
      positionX: 320,
      positionY: 120,
      configuration: {
        provider: "ollama",
        model: "llama3.2",
        systemPrompt: "You are a concise summarizer.",
        userPrompt: "Summarize the following text:\n\n{{trigger.text}}",
        temperature: 0.3,
        maxTokens: 512,
      },
      metadata: { label: "AI Summarize" },
    },
    {
      nodeKey: "log-1",
      nodeType: "log-output",
      category: "UTILITY",
      positionX: 600,
      positionY: 120,
      configuration: {
        message: "Summary produced: {{ai-1.output.text}}",
      },
      metadata: { label: "Log Output" },
    },
  ];

  const connections = [
    {
      sourceNode: "trigger-1",
      targetNode: "ai-1",
      sourcePort: "out",
      targetPort: "in",
    },
    {
      sourceNode: "ai-1",
      targetNode: "log-1",
      sourcePort: "out",
      targetPort: "in",
    },
  ];

  const definition = { nodes, connections };

  await prisma.workflowVersion.create({
    data: {
      workflowId: workflow.id,
      version: 1,
      schemaVersion: 1,
      checksum: createHash("sha256").update(JSON.stringify(definition)).digest("hex"),
      definition: definition,
      publishedById: user.id,
      nodes: {
        create: nodes.map((n) => ({ ...n })),
      },
      connections: {
        create: connections.map((c) => ({ ...c })),
      },
    },
  });

  const prompt = await prisma.prompt.create({
    data: {
      organizationId: org.id,
      title: "Concise Summarizer",
      content: "You are a concise summarizer. Summarize the user's text in under 100 words.",
      version: 1,
      status: "PUBLISHED",
      tags: ["summarize"],
      createdById: user.id,
      publishedAt: new Date(),
    },
  });

  await prisma.agent.create({
    data: {
      organizationId: org.id,
      name: "Demo Summarizer Agent",
      description: "Summarizes text with Ollama",
      status: "PUBLISHED",
      provider: "ollama",
      model: "llama3.2",
      temperature: 0.3,
      topP: 1,
      maxTokens: 512,
      systemPrompt: prompt.content,
      memoryPolicy: "none",
      createdById: user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      actorId: user.id,
      actorType: "user",
      action: "SEED_INITIALIZED",
      entity: "organization",
      entityId: org.id,
      metadata: { note: "Initial seed data created" },
    },
  });

  console.log("Seed complete.");
  console.log(`  Organization: ${org.slug} (${org.id})`);
  console.log(`  User:         ${email} / demo-password`);
  console.log(`  Workflow:     ${workflow.name} (version 1, draft)`);
  console.log(`  Prompt:       ${prompt.title}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
