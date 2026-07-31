import { NextResponse } from "next/server";
import { auth } from "@saas/auth";
import { prisma } from "@saas/database";
import { generateToken } from "@saas/utils";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, role } = parsed.data;

  const org = await prisma.organization.findFirst({
    where: { memberships: { some: { userId: session.user.id, role: { in: ["OWNER", "ADMIN"] } } } },
  });

  if (!org) {
    return NextResponse.json(
      { error: "No organization or insufficient permissions" },
      { status: 403 },
    );
  }

  const existingMember = await prisma.membership.findFirst({
    where: { organizationId: org.id, user: { email } },
  });

  if (existingMember) {
    return NextResponse.json({ error: "User is already a member" }, { status: 409 });
  }

  const invitation = await prisma.invitation.create({
    data: {
      organizationId: org.id,
      email,
      role,
      token: generateToken(48),
      invitedById: session.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return NextResponse.json({ data: invitation });
}
