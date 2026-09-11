import type { ReactNode } from "react";
import { Head, Html, Img, Preview, Section, Text } from "react-email";
import { emailTheme as t } from "./theme";

type Props = {
  preview: string;
  children: ReactNode;
  manageUrl: string;
  logoUrl: string;
};

// Classic fixed-width email shell. react-email's Container only sets
// max-width, which Gmail ignores on tables, so the mail stretched to the
// full pane width. The width="560" attribute is what Gmail actually
// respects; max-width keeps small screens fluid. Plain style objects only:
// Gmail strips <style>, so no classes or vars.
export function EmailLayout({ preview, children, manageUrl, logoUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        style={{ backgroundColor: t.bg, fontFamily: t.fontSans }}
      >
        <tbody>
          <tr>
            <td align="center" style={{ padding: "24px 12px" }}>
              <table
                role="presentation"
                width="560"
                align="center"
                cellPadding={0}
                cellSpacing={0}
                style={{
                  margin: "0 auto",
                  maxWidth: "560px",
                  width: "100%",
                }}
              >
                <tbody>
                  <tr>
                    <td style={{ padding: "20px", textAlign: "left" }}>
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
                        You get this because you track this subscription in
                        SubZero.{" "}
                        <a
                          href={manageUrl}
                          style={{
                            color: t.muted,
                            textDecoration: "underline",
                          }}
                        >
                          Manage notifications
                        </a>
                      </Text>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </Html>
  );
}
