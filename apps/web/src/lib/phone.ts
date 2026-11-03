/** Máscara de WhatsApp brasileiro: (19) 99999-0000 */
export function maskPhone(value: string): string {
  const d = value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function isValidPhone(value: string): boolean {
  const d = value.replace(/\D/g, "");
  return /^\d{2}9?\d{8}$/.test(d);
}

/** Formata dígitos com DDI (5519999990000) para exibição. */
export function formatPhone(digits: string): string {
  return maskPhone(digits.replace(/^55/, ""));
}

export function whatsappLink(phoneDigits: string, message?: string): string {
  const number = phoneDigits.replace(/\D/g, "");
  const full = number.startsWith("55") ? number : `55${number}`;
  return `https://wa.me/${full}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
