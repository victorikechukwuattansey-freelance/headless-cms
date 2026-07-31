import { NextResponse } from "next/server";
import { auth } from "@saas/auth";
import { prisma } from "@saas/database";
import { z } from "zod";
import { compare } from "bcryptjs";

const schema = z.object({
  password: z.string(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.passwordHash) {
    return NextResponse.json({ error: "Cannot delete OAuth-only account" }, { status: 400 });
  }

  const valid = await compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
