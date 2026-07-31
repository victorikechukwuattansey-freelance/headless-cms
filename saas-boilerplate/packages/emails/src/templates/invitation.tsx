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

interface InvitationEmailProps {
  inviterName: string;
  organizationName: string;
  role: string;
  inviteUrl: string;
}

export function InvitationEmail({
  inviterName,
  organizationName,
  role,
  inviteUrl,
}: InvitationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>You&apos;ve been invited to join {organizationName}</Preview>
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
            You&apos;re invited!
          </Text>
          <Text style={{ color: "#64748b", lineHeight: "1.6", margin: "0 0 16px" }}>
            <strong>{inviterName}</strong> has invited you to join{" "}
            <strong>{organizationName}</strong> as a <strong>{role}</strong>.
          </Text>
          <Button
            href={inviteUrl}
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
            Accept Invitation
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
