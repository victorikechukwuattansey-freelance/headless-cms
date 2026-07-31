import { prisma } from "@saas/database";
import { sendEmail } from "@saas/emails";
import type { NotificationPayload } from "../types";

export class EmailChannel {
  async send(payload: NotificationPayload): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user?.email) return;

    await sendEmail({
      to: user.email,
      subject: payload.title,
      html: payload.message ?? payload.title,
    });
  }

  async sendBulk(payloads: NotificationPayload[]): Promise<void> {
    const userIds = [...new Set(payloads.map((p) => p.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true },
    });

    const emailMap = new Map(users.map((u) => [u.id, u.email]));
    const emailPayloads = payloads.filter((p) => emailMap.has(p.userId));

    await Promise.all(
      emailPayloads.map((p) =>
        sendEmail({
          to: emailMap.get(p.userId)!,
          subject: p.title,
          html: p.message ?? p.title,
        }),
      ),
    );
  }
}
