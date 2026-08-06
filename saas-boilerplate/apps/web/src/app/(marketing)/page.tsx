import Link from "next/link";
import { Button } from "@saas/ui";
import { ArrowRight, Check, BarChart3, Users, CreditCard, Shield, Zap, Globe } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Built on Next.js 15 with React Server Components for optimal performance.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "CSRF, CSP, rate limiting, RBAC, and audit logging out of the box.",
  },
  {
    icon: CreditCard,
    title: "Multi-Provider Payments",
    description: "Stripe and Lemon Squeezy with subscription management baked in.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Multi-tenant with organizations, teams, and role-based access.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description: "Real-time metrics, usage tracking, and revenue analytics.",
  },
  {
    icon: Globe,
    title: "Multi-Language Ready",
    description: "Built for global teams with i18n architecture.",
  },
];

const pricing = [
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
    ],
    cta: "Contact Sales",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden py-24 lg:py-32">
        <div className="from-primary/5 to-primary/5 absolute inset-0 bg-gradient-to-br via-transparent" />
        <div className="relative container">
          <div className="mx-auto max-w-4xl text-center">
            <div className="bg-muted mb-6 inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium">
              Launch your SaaS in hours
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Build Your SaaS{" "}
              <span className="from-primary bg-gradient-to-r to-purple-600 bg-clip-text text-transparent">
                Faster Than Ever
              </span>
            </h1>
            <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg">
              A production-ready Next.js boilerplate with authentication, payments, teams, and
              everything you need to launch your SaaS product.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/auth/register">
                <Button size="lg" className="w-full sm:w-auto">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted/50 py-24">
        <div className="container">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything You Need</h2>
            <p className="text-muted-foreground mt-4 text-lg">
              All the tools to launch and scale your SaaS product.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-card group relative rounded-xl border p-6 transition-all hover:shadow-lg"
              >
                <div className="bg-primary/10 mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                  <feature.icon className="text-primary h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-24">
        <div className="container">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Simple, Transparent Pricing
            </h2>
            <p className="text-muted-foreground mt-4 text-lg">Start free, upgrade as you grow.</p>
          </div>
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={`bg-card relative rounded-xl border p-8 transition-all hover:shadow-lg ${plan.popular ? "border-primary scale-105 shadow-lg" : ""}`}
              >
                {plan.popular && (
                  <div className="bg-primary text-primary-foreground absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-medium">
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p className="text-muted-foreground mt-2 text-sm">{plan.description}</p>
                <div className="mt-6 mb-8">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <ul className="mb-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm">
                      <Check className="text-primary h-4 w-4" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/register">
                  <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/50 py-24">
        <div className="container max-w-4xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to Launch?</h2>
          <p className="text-muted-foreground mt-4 text-lg">
            Start building your SaaS product today with everything you need included.
          </p>
          <div className="mt-10">
            <Link href="/auth/register">
              <Button size="lg">
                Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
