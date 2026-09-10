import type { ReactNode } from "react";
import { Body, Container, Head, Html, Preview, Section, Text } from "react-email";
import { emailTheme as t } from "./theme";

type Props = {
  preview: string;
  children: ReactNode;
  manageUrl: string;
};

// Shared shell — dark SubZero card on near-black, chartreuse wordmark dot.
// Plain style objects only: Gmail strips <style>, so no classes or vars.
export function EmailLayout({ preview, children, manageUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: t.bg,
          fontFamily: t.fontSans,
          margin: "0",
          padding: "24px 0",
        }}
      >
        <Container
          style={{
            backgroundColor: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: t.radiusCard,
            margin: "0 auto",
            maxWidth: "560px",
            padding: "32px",
          }}
        >
          <Text
            style={{
              color: t.foreground,
              fontFamily: t.fontHeading,
              fontSize: "15px",
              fontWeight: "bold",
              margin: "0 0 20px",
            }}
          >
            SubZero<span style={{ color: t.primary }}>.</span>
          </Text>
          <Section>{children}</Section>
          <Text
            style={{
              borderTop: `1px solid ${t.divider}`,
              color: t.faint,
              fontSize: "12px",
              lineHeight: "18px",
              margin: "24px 0 0",
              paddingTop: "16px",
            }}
          >
            You get this because you track this subscription in SubZero.{" "}
            <a
              href={manageUrl}
              style={{ color: t.muted, textDecoration: "underline" }}
            >
              Manage notifications
            </a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
