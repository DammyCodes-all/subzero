// Email theme tokens — mirrors src/app/globals.css (:root) as
// inline-style-safe values. Email clients strip <style> and CSS vars,
// so the app theme is hardcoded here. Update both when rebranding.
export const emailTheme = {
  bg: "#0b1310",
  card: "#141c18",
  border: "rgba(249,247,242,0.15)",
  divider: "rgba(249,247,242,0.12)",
  metaBg: "rgba(249,247,242,0.06)",
  foreground: "#f9f7f2",
  muted: "rgba(249,247,242,0.6)",
  faint: "rgba(249,247,242,0.4)",
  primary: "#e6ff2b",
  onPrimary: "#0b1310",
  danger: "#e4383d",
  radiusCard: "12px",
  radiusInner: "8px",
  fontSans: "Inter, Arial, Helvetica, sans-serif",
  fontHeading: "'Space Grotesk', Inter, Arial, Helvetica, sans-serif",
} as const;
