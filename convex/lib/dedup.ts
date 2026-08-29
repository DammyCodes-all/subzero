export function dedupKey(args: {
  merchant: string;
  product?: string;
  billingProvider?: string;
  price: number;
  currency: string;
}): string {
  const m = args.merchant
    .toLowerCase()
    .trim()
    .replace(/\s*\(by[^)]+\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const p = (args.product ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s*\(by[^)]+\)\s*/g, " ")
    .replace(/\s*·.*$/, "") // remove " · Google Play" suffix sometimes in product
    .replace(/\s+/g, " ")
    .trim();
  const b = (args.billingProvider ?? "").toLowerCase().trim();
  const priceBucket = Math.round(args.price * 100);
  return [m, p, b, String(priceBucket), args.currency.toLowerCase()].join("|");
}
