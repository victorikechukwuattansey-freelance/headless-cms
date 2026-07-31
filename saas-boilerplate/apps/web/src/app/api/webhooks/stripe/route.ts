import { NextRequest, NextResponse } from "next/server";
import { handleStripeWebhook } from "@saas/payments/stripe";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature") ?? "";
    const result = await handleStripeWebhook(body, signature);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}
