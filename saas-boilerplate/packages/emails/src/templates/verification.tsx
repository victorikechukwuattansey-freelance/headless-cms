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

interface VerificationEmailProps {
  email: string;
  verificationUrl: string;
}

export function VerificationEmail({ email, verificationUrl }: VerificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Verify your email address for SaaS Boilerplate</Preview>
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
            Verify your email
          </Text>
          <Text style={{ color: "#64748b", lineHeight: "1.6", margin: "0 0 24px" }}>
            Please click the button below to verify your email address ({email}). This link expires
            in 24 hours.
          </Text>
          <Button
            href={verificationUrl}
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
            Verify Email
          </Button>
          <Text style={{ color: "#94a3b8", fontSize: "12px", marginTop: "24px" }}>
            If you didn&apos;t request this, please ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
