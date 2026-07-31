import Link from "next/link";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@saas/ui";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "$29",
    description: "Perfect for small projects",
    features: ["5 Projects", "5 Team Members", "1GB Storage", "API Access", "Email Support"],
    cta: "Start Free Trial",
  },
  {
    name: "Pro",
    price: "$79",
    description: "For growing businesses",
    popular: true,
    features: [
      "Unlimited Projects",
      "Unlimited Team Members",
      "10GB Storage",
      "API Access",
      "Priority Support",
      "Custom Domains",
      "Advanced Analytics",
    ],
    cta: "Start Free Trial",
  },
  {
    name: "Business",
    price: "$199",
    description: "For large teams",
    features: [
      "Everything in Pro",
      "100GB Storage",
      "SSO/SAML",
      "Audit Logs",
      "Dedicated Support",
      "White Labeling",
      "SLA Guarantee",
    ],
    cta: "Contact Sales",
  },
];

export default function PricingPage() {
  return (
    <div className="py-24">
      <div className="container">
        <div className="mb-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Simple, Transparent Pricing</h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg">
            Choose the plan that fits your needs. Upgrade or downgrade at any time.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative ${plan.popular ? "border-primary scale-105 shadow-lg" : ""}`}
            >
              {plan.popular && (
                <div className="bg-primary text-primary-foreground absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-medium">
                  Most Popular
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="mb-8 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm">
                      <Check className="text-primary h-4 w-4 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/register">
                  <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                    {plan.cta}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
