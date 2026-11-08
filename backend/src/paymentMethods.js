/**
 * paymentMethods.js — Constantes dos métodos de pagamento (Bloco 2).
 *
 * Ponto único usado por orders.js (fechamento) e reports.js (relatórios),
 * para que aceitação e rótulos de exibição nunca divergirem.
 *
 * America/Sao_Paulo é UTC-3 fixo (sem horário de verão desde 2019);
 * documentos gravados em português começam com maiúscula (Dinheiro...).
 */
const PAYMENT_METHOD_LABELS = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'Pix',
};

const PAYMENT_METHODS = new Set(Object.keys(PAYMENT_METHOD_LABELS));

/** Fuso adotado no backend (uma decisão só, importável em qualquer lugar). */
const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';
/** Offset fixo do BUSINESS_TIME_ZONE em relação ao UTC (não há DST em SP). */
const BUSINESS_UTC_OFFSET = '-03:00';

module.exports = {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  BUSINESS_TIME_ZONE,
  BUSINESS_UTC_OFFSET,
};
