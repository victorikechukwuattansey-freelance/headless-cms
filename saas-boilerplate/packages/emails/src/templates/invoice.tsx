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

interface InvoiceEmailProps {
  name: string;
  invoiceNumber: string;
  amount: string;
  date: string;
  invoiceUrl: string;
}

export function InvoiceEmail({ name, invoiceNumber, amount, date, invoiceUrl }: InvoiceEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your invoice from SaaS Boilerplate</Preview>
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
            Invoice #{invoiceNumber}
          </Text>
          <Text style={{ color: "#64748b", lineHeight: "1.6", margin: "0 0 8px" }}>Hi {name},</Text>
          <Text style={{ color: "#64748b", lineHeight: "1.6", margin: "0 0 16px" }}>
            Your invoice of <strong>{amount}</strong> for {date} is ready.
          </Text>
          <Button
            href={invoiceUrl}
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
            View Invoice
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
