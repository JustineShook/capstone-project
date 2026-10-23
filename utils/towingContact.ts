/** Format a profile phone number for tel:/sms: URIs without changing its snapshot value. */
export function normalizeTowingContactNumber(phone: string): string {
  const trimmed = phone.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return "";
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export function buildTowingContactUrl(scheme: "tel" | "sms", phone?: string | null): string | null {
  if (!phone?.trim()) return null;
  const normalized = normalizeTowingContactNumber(phone);
  return normalized ? `${scheme}:${normalized}` : null;
}
