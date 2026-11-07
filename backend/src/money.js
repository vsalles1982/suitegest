/**
 * money.js — Formatação de moeda BRL a partir de centavos (inteiro).
 *
 * Regra de contrato do CHARTER: valores monetários trafegam como inteiros em
 * centavos; a representação formatada é gerada em campos explícitos
 * (priceFormatted, unitPriceFormatted, subtotalFormatted, totalFormatted).
 */
const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** Formata centavos como moeda BRL (ex.: 4590 -> "R$ 45,90"). */
function formatBRL(cents) {
  return brlFormatter.format(cents / 100);
}

module.exports = { formatBRL };
