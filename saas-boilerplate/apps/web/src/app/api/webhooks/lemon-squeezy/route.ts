import { NextRequest, NextResponse } from "next/server";
import { handleLemonSqueezyWebhook } from "@saas/payments/lemon-squeezy";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-signature") ?? "";
    const result = await handleLemonSqueezyWebhook(body, signature);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Lemon Squeezy webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}
