const MAX_FINAL_PRICE = 100_000_000;

export function isValidFinalPrice(value: unknown): value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_FINAL_PRICE) return false;
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
}

export function parseFinalPriceInput(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  if (!isValidFinalPrice(amount)) return null;
  return Math.round(amount * 100) / 100;
}

export function formatPesoAmount(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
