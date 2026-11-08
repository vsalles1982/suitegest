/**
 * routes/reports.js — Relatórios de Fechamento de Caixa (Bloco 2).
 *
 *   GET /reports/sales   — resumo de pagamentos, com filtro opcional de
 *                          período (?from=YYYY-MM-DD&to=YYYY-MM-DD, inclusivo).
 *   GET /reports/summary — o mesmo resumo, sem período (histórico completo).
 *
 * Contrato alinhado com o QA (Bloco 2.1) nos DOIS endpoints:
 *   - ordersCount  — número de comandas pagas (alias legado: paidOrders);
 *   - total / totalFormatted — valor total do período (alias legado:
 *     totalRevenue / totalRevenueFormatted / totalSold no summary);
 *   - topItems[]   — `{ productId, productName, quantity, total,
 *     totalFormatted, revenue, revenueFormatted }` (comandas PAGAS; a soma
 *     dos totais reconcilia com `total`);
 *   - byMethod[]   — `{ method, label, payments, total, totalFormatted }`.
 *
 * Campos legados preservados para compatibilidade (paidOrders, totalRevenue,
 * totalSold no summary, averageTicket, unpaidClosedOrders, from, to).
 *
 * A base é a tabela payments (fluxo de caixa): comandas fechadas sem
 * pagamento aparecem apenas em unpaidClosedOrders.
 *
 * Fuso horário (contrato do QA, implementado): o filtro por dia considera
 * America/Sao_Paulo (UTC-3 fixo, sem DST desde 2019 — BUSINESS_UTC_OFFSET
 * em paymentMethods.js). O dia local D vira o intervalo UTC
 * [D 00:00 -03:00, D+1 00:00 -03:00) comparado lexicograficamente com os
 * carimbos ISO-8601 UTC do banco. Mudar o fuso? Atualize o offset centralizado.
 */
const { getDatabase } = require('../database');
const { formatBRL } = require('../money');
const { PAYMENT_METHOD_LABELS, BUSINESS_UTC_OFFSET } = require('../paymentMethods');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Limite de itens no top dos relatórios. */
const TOP_ITEMS_LIMIT = 5;

/** Valida um parâmetro de data YYYY-MM-DD (ex.: 2026-02-31 é rejeitado). */
function isValidIsoDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime())
    && date.toISOString().slice(0, 10) === value;
}

/** Valida from/to; retorna o par normalizado ou null (com erro respondido). */
function validatePeriod(reply, query) {
  const from = query.from ? String(query.from) : null;
  const to = query.to ? String(query.to) : null;

  for (const [label, value] of [['from', from], ['to', to]]) {
    if (value !== null && !isValidIsoDate(value)) {
      reply.code(400).send({
        error: `Parâmetro "${label}" deve ser uma data YYYY-MM-DD válida (ex.: 2026-11-08).`,
      });
      return null;
    }
  }
  if (from && to && from > to) {
    reply.code(400).send({ error: 'Parâmetro "from" deve ser anterior ou igual a "to".' });
    return null;
  }

  return { from, to };
}

/**
 * Fuso America/Sao_Paulo: devolve [inicioUtc, fimUtcExclusivo) de um dia
 * local YYYY-MM-DD. 00:00 SP = 03:00 UTC (offset fixo -03:00).
 */
function localDayUtcRange(localDay) {
  const start = new Date(`${localDay}T00:00:00${BUSINESS_UTC_OFFSET}`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return [start.toISOString(), end.toISOString()];
}

/** Troca os filtros por dia local pelos limites UTC correspondentes. */
function periodToUtcBounds({ from, to }) {
  const bounds = [];
  if (from) {
    const [start] = localDayUtcRange(from);
    bounds.push({ column: 'created_at', op: '>=', value: start });
  }
  if (to) {
    const [, end] = localDayUtcRange(to);
    bounds.push({ column: 'created_at', op: '<', value: end });
  }
  return bounds;
}

/**
 * Agregação principal (valores em centavos). Período já validado e convertido
 * para bounds UTC (`periodToUtcBounds`) — comparações lexicográficas com os
 * carimbos ISO-8601 UTC gravados pelo banco.
 */
function buildSalesReport(db, { from, to }) {
  const bounds = periodToUtcBounds({ from, to });

  // Pagamentos: total, contagem e quebra por método (uma consulta só).
  const paymentClauses = bounds.map((bound) => [`p.created_at ${bound.op} ?`, bound.value]);
  const paymentWhere = paymentClauses.length > 0
    ? `WHERE ${paymentClauses.map(([clause]) => clause).join(' AND ')}`
    : '';
  const paymentParams = paymentClauses.map(([, value]) => value);

  const paymentRows = db
    .prepare(
      `SELECT p.method,
              COUNT(*)     AS count,
              SUM(p.amount) AS total
         FROM "payments" p
         ${paymentWhere}
        GROUP BY p.method
        ORDER BY total DESC, p.method`,
    )
    .all(...paymentParams);

  const totalRevenue = paymentRows.reduce((sum, row) => sum + row.total, 0);
  const paidOrders = paymentRows.reduce((sum, row) => sum + row.count, 0);

  // Comandas fechadas sem pagamento: janela sobre closed_at (o equivalente
  // temporal dos carimbos do fechamento).
  const unpaidClauses = bounds.map((bound) => [`o.closed_at ${bound.op} ?`, bound.value]);
  const unpaidParams = unpaidClauses.map(([, value]) => value);
  const unpaidConditions = [
    "o.status = 'closed'",
    'p2.id IS NULL',
    ...unpaidClauses.map(([clause]) => clause),
  ].join(' AND ');
  const { total: unpaidClosedOrders } = db
    .prepare(
      `SELECT COUNT(*) AS total
         FROM "orders" o
         LEFT JOIN "payments" p2 ON p2.order_id = o.id
        WHERE ${unpaidConditions}`,
    )
    .get(...unpaidParams);

  return {
    from,
    to,
    paidOrders,
    totalRevenue,
    totalRevenueFormatted: formatBRL(totalRevenue),
    averageTicket: paidOrders > 0 ? Math.round(totalRevenue / paidOrders) : 0,
    averageTicketFormatted: formatBRL(
      paidOrders > 0 ? Math.round(totalRevenue / paidOrders) : 0,
    ),
    byMethod: paymentRows.map((row) => ({
      method: row.method,
      label: PAYMENT_METHOD_LABELS[row.method],
      payments: row.count,
      total: row.total,
      totalFormatted: formatBRL(row.total),
    })),
    unpaidClosedOrders,
  };
}

/**
 * Itens mais vendidos entre as comandas PAGAS (mesma base de caixa dos
 * demais campos). quantity soma unidades vendidas; total/revenue são o
 * valor em centavos (soma quantity * unit_price dos snapshots). Em empate
 * de quantidade, desempata por revenue e depois pelo nome.
 */
function buildTopItems(db, bounds, limit = TOP_ITEMS_LIMIT) {
  const clauses = bounds.map((bound) => [`p.created_at ${bound.op} ?`, bound.value]);
  const where = clauses.length > 0 ? `WHERE ${clauses.map(([c]) => c).join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT oi.product_id   AS productId,
              p.name          AS productName,
              SUM(oi.quantity)              AS quantity,
              SUM(oi.quantity * oi.unit_price) AS revenue
         FROM "payments" pay
         JOIN "orders" o ON o.id = pay.order_id
         JOIN "order_items" oi ON oi.order_id = o.id
         JOIN products p ON p.id = oi.product_id
         ${where}
        GROUP BY oi.product_id, p.name
        ORDER BY quantity DESC, revenue DESC, p.name
        LIMIT ?`,
    )
    .all(...clauses.map(([, value]) => value), limit);

  return rows.map((row) => ({
    productId: row.productId,
    productName: row.productName,
    quantity: row.quantity,
    // Bloco 2.1: total/totalFormatted (contrato do QA); revenue* são os
    // nomes da primeira versão, mantidos por compatibilidade.
    total: row.revenue,
    totalFormatted: formatBRL(row.revenue),
    revenue: row.revenue,
    revenueFormatted: formatBRL(row.revenue),
  }));
}

/** Monta a resposta do endpoint (campos legados + aliases do QA). */
function buildSalesPayload(db, period) {
  const report = buildSalesReport(db, period);
  const bounds = periodToUtcBounds(period);

  return {
    ...report,
    // Aliases do contrato do QA (campos legados preservados).
    ordersCount: report.paidOrders,
    total: report.totalRevenue,
    totalFormatted: report.totalRevenueFormatted,
    topItems: buildTopItems(db, bounds),
  };
}

async function reportRoutes(fastify) {
  /** Resumo com filtro opcional de período (from/to inclusivos, fuso SP). */
  fastify.get('/reports/sales', async (request, reply) => {
    const period = validatePeriod(reply, request.query ?? {});
    if (!period) return reply;

    return reply.code(200).send(buildSalesPayload(getDatabase(), period));
  });

  /**
   * Resumo histórico completo (equivale a /reports/sales sem período).
   * O alias totalSold do Bloco 2.1 (frontend) continua aqui.
   */
  fastify.get('/reports/summary', async (_request, reply) => {
    const payload = buildSalesPayload(getDatabase(), { from: null, to: null });

    return reply.code(200).send({
      ...payload,
      totalSold: payload.totalRevenue,
    });
  });
}

module.exports = reportRoutes;
