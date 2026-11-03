/** Normaliza um WhatsApp brasileiro para apenas dígitos com DDI 55. */
export function normalizeWhatsapp(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return `55${digits}`;
}

export function isValidBrazilianWhatsapp(input: string): boolean {
  const digits = normalizeWhatsapp(input);
  // 55 + DDD (2) + número (8 ou 9 dígitos)
  return /^55\d{2}9?\d{8}$/.test(digits);
}
