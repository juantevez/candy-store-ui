// Importes en centavos (enteros) para no acumular errores de punto flotante.
// La API envía los importes como texto con dos decimales ("1500.50").

import { config } from "../config.js";

const formatter = new Intl.NumberFormat(config.locale, {
  style: "currency",
  currency: config.currency,
});

export function toCents(amount) {
  return Math.round(Number.parseFloat(amount) * 100);
}

export function formatCents(cents) {
  return formatter.format(cents / 100);
}

export function formatAmount(amount) {
  return formatCents(toCents(amount));
}

// Interpreta lo que escribe el cajero: "1500", "1.500", "1500,50", "$ 1.500,50".
export function parseUserAmount(text) {
  const cleaned = String(text).replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(/\.(?=\d{3}(\D|$))/g, "");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
}
