import type { ReactNode } from "react";
import { Body, Container, Head, Html, Img, Preview, Section, Text } from "react-email";
import { emailTheme as t } from "./theme";

type Props = {
  preview: string;
  children: ReactNode;
  manageUrl: string;
  logoUrl: string;
};

// Flat dark shell — mirrors the app: near-black background, brand row on
// top, content straight on the background (no enclosing card). Plain style
// objects only: Gmail strips <style>, so no classes or vars.
export function EmailLayout({ preview, children, manageUrl, logoUrl }: Props) {
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
            margin: "0 auto",
            maxWidth: "560px",
            padding: "20px",
          }}
        >
          <div style={{ marginBottom: "20px" }}>
            <Img
              src={logoUrl}
              alt="SubZero"
              width="120"
              height="30"
              style={{ display: "block" }}
            />
          </div>
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
