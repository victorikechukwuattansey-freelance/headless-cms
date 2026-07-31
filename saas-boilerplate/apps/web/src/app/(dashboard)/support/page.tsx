import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@saas/ui";
import { MessageSquare, BookOpen, Mail, LifeBuoy } from "lucide-react";
import Link from "next/link";

const supportOptions = [
  {
    icon: BookOpen,
    title: "Documentation",
    description: "Check our comprehensive docs",
    href: "/docs",
  },
  { icon: MessageSquare, title: "Community", description: "Ask the community for help", href: "#" },
  {
    icon: Mail,
    title: "Email Support",
    description: "Get in touch with our team",
    href: "mailto:support@saas.com",
  },
  {
    icon: LifeBuoy,
    title: "Priority Support",
    description: "For Pro and Business plans",
    href: "#",
  },
];

export default function SupportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Support</h1>
        <p className="text-muted-foreground">We&apos;re here to help you succeed.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {supportOptions.map((option) => {
          const Icon = option.icon;
          return (
            <Link key={option.title} href={option.href}>
              <Card className="cursor-pointer transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-start gap-4">
                  <div className="bg-primary/10 rounded-lg p-2">
                    <Icon className="text-primary h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{option.title}</CardTitle>
                    <CardDescription>{option.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
