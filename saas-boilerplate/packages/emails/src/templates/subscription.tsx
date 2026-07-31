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
} from "@react-email/components";
import * as React from "react";

interface SubscriptionEmailProps {
  name: string;
  planName: string;
  amount: string;
  interval: string;
  dashboardUrl?: string;
}

export function SubscriptionEmail({
  name,
  planName,
  amount,
  interval,
  dashboardUrl = "https://app.saas.com/billing",
}: SubscriptionEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your subscription has been confirmed!</Preview>
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
          <Text
            style={{ fontSize: "24px", fontWeight: "bold", color: "#1a1a2e", margin: "0 0 16px" }}
          >
            Subscription confirmed!
          </Text>
          <Text style={{ color: "#64748b", lineHeight: "1.6", margin: "0 0 16px" }}>
            Thanks {name}! You&apos;re now subscribed to the <strong>{planName}</strong> plan at{" "}
            <strong>
              {amount}/{interval}
            </strong>
            .
          </Text>
          <Text style={{ color: "#64748b", lineHeight: "1.6", margin: "0 0 24px" }}>
            You now have access to all features in your plan. Visit the dashboard to get started.
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
            }}
          >
            Go to Dashboard
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
