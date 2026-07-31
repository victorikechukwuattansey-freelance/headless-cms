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

interface PasswordResetEmailProps {
  email: string;
  resetUrl: string;
}

export function PasswordResetEmail({ email, resetUrl }: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your password for SaaS Boilerplate</Preview>
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
            Reset your password
          </Text>
          <Text style={{ color: "#64748b", lineHeight: "1.6", margin: "0 0 24px" }}>
            Someone requested a password reset for {email}. Click below to set a new password. This
            link expires in 1 hour.
          </Text>
          <Button
            href={resetUrl}
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
            Reset Password
          </Button>
          <Text style={{ color: "#94a3b8", fontSize: "12px", marginTop: "24px" }}>
            If you didn&apos;t request this, please ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
