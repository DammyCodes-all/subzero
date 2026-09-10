import { render, toPlainText } from "@react-email/render";
import type { ReactElement } from "react";

// Single choke point for email rendering. render() is async — every
// caller must await, or the body ships as "[object Promise]".
export async function renderEmail(element: ReactElement) {
  const html = await render(element);
  const text = toPlainText(html);
  return { html, text };
}
