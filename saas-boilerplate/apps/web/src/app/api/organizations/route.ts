import { NextResponse } from "next/server";
import { auth } from "@saas/auth";
import { prisma } from "@saas/database";
import { generateSlug } from "@saas/utils";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const org = await prisma.organization.create({
    data: {
      name,
      slug: generateSlug(name) + "-" + Math.random().toString(36).slice(2, 7),
      ownerId: session.user.id,
      memberships: {
        create: { userId: session.user.id, role: "OWNER" },
      },
    },
  });

  return NextResponse.json({ data: org });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgs = await prisma.organization.findMany({
    where: { memberships: { some: { userId: session.user.id } } },
    include: { _count: { select: { memberships: true } } },
  });

  return NextResponse.json({ data: orgs });
}
