import { NextResponse } from "next/server";
import { auth } from "@saas/auth";
import { prisma } from "@saas/database";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2).optional(),
  bio: z.string().max(500).optional(),
  timezone: z.string().optional(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { name, bio, timezone } = parsed.data;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { ...(name && { name }) },
    }),
    prisma.profile.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, bio, timezone },
      update: { ...(bio !== undefined && { bio }), ...(timezone !== undefined && { timezone }) },
    }),
  ]);

  return NextResponse.json({ success: true });
}
