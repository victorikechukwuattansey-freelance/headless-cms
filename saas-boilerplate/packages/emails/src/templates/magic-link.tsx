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

interface MagicLinkEmailProps {
  email: string;
  magicLinkUrl: string;
}

export function MagicLinkEmail({ email, magicLinkUrl }: MagicLinkEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Sign in to SaaS Boilerplate</Preview>
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
            Your magic sign-in link
          </Text>
          <Text style={{ color: "#64748b", lineHeight: "1.6", margin: "0 0 24px" }}>
            Click the button below to sign in as {email}. This link expires in 15 minutes.
          </Text>
          <Button
            href={magicLinkUrl}
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
            Sign in to SaaS Boilerplate
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
