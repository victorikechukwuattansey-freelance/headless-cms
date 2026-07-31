import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

async function main() {
  const [orgs, users, wf, ver, nodes, conns] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.workflow.count(),
    prisma.workflowVersion.count(),
    prisma.workflowNode.count(),
    prisma.workflowConnection.count(),
  ]);
  const version = await prisma.workflowVersion.findFirst({
    include: { nodes: true, connections: true },
  });
  console.log(JSON.stringify({ orgs, users, wf, ver, nodes, conns, nodeTypes: version?.nodes.map((n) => n.nodeType) }, null, 2));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
