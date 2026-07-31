import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Button,
  Link,
  Img,
} from "@react-email/components";
import * as React from "react";

interface WelcomeEmailProps {
  name?: string;
  email: string;
  dashboardUrl?: string;
}

export function WelcomeEmail({
  name,
  email,
  dashboardUrl = "https://app.saas.com/dashboard",
}: WelcomeEmailProps) {
  const previewText = `Welcome to SaaS Boilerplate, ${name ?? "there"}!`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body
        style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#f6f9fc", padding: "40px 0" }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "40px",
            borderRadius: "8px",
            maxWidth: "600px",
            margin: "0 auto",
          }}
        >
          <Section>
            <Text
              style={{ fontSize: "32px", fontWeight: "bold", color: "#1a1a2e", margin: "0 0 8px" }}
            >
              SaaS Boilerplate
            </Text>
            <Text
              style={{ fontSize: "24px", fontWeight: "bold", color: "#1a1a2e", margin: "0 0 16px" }}
            >
              Welcome aboard{name ? `, ${name}` : ""}! 🎉
            </Text>
            <Text style={{ color: "#64748b", lineHeight: "1.6", margin: "0 0 24px" }}>
              We&apos;re thrilled to have you join us. Your account with {email} has been created
              successfully. You can now explore the dashboard and start building.
            </Text>
            <Button
              href={dashboardUrl}
              style={{
                backgroundColor: "#6366f1",
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: "bold",
                fontSize: "16px",
                display: "inline-block",
              }}
            >
              Go to Dashboard
            </Button>
          </Section>
          <Section
            style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid #e2e8f0" }}
          >
            <Text style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 8px" }}>
              If you didn&apos;t create this account, please ignore this email.
            </Text>
            <Link href="https://saas.com" style={{ color: "#6366f1", fontSize: "12px" }}>
              saas.com
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
