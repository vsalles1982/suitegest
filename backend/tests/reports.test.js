/**
 * tests/reports.test.js — Testes dos relatórios de Fechamento de Caixa
 * (Bloco 2 — GET /reports/sales e GET /reports/summary).
 *
 * Os relatórios têm a tabela payments como base (fluxo de caixa).
 * Aqui o fluxo é criado pela própria API (abrir comanda → fechar com
 * pagamento) para endossar os números de ponta a ponta.
 *
 * Datas de filtro são dias locais de America/Sao_Paulo (o mesmo fuso do
 * backend após o Bloco 2.1): os helpers usam Intl. "spToday()" é o dia
 * corrente em SP — pode diferir do dia UTC quando o teste roda entre
 * 21h e 23h59 de Brasília (UTC 00h-02h do "dia seguinte").
 */
const { test, after } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/server');
const { getDatabase } = require('../src/database');

/** Dia local de SP (YYYY-MM-DD) deslocado em N dias (base = agora). */
function spDay(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  const text = date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  assert.match(text, /^\d{4}-\d{2}-\d{2}$/); // sanidade do formato
  return text;
}

/** Remove espaços não separáveis (U+00A0) usados pelo Intl em moeda. */
function normalizeNbsp(text) {
  return text.replace(/\u00A0/g, ' ');
}

/** Limpa tudo que este arquivo toca (ordem respeita as FKs). */
function clearAll() {
  const db = getDatabase();
  db.prepare('DELETE FROM "payments"').run();
  db.prepare('DELETE FROM "order_items"').run();
  db.prepare('DELETE FROM "orders"').run();
  db.prepare('DELETE FROM "tables"').run();
  db.prepare('DELETE FROM "products"').run();
  for (const tableName of ['payments', 'order_items', 'orders', 'tables', 'products']) {
    db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(tableName);
  }
}

/** Seed de produto do arquivo (nomes exclusivos; idempotente dentro do run). */
function seedProduct(name, price) {
  const db = getDatabase();
  db.prepare('INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)').run(1, 'Geral');
  db.prepare('INSERT INTO products (name, price, category_id) VALUES (?, ?, ?)').run(name, price, 1);
  // Estoque alto: a baixa automática do Bloco 4 drena stock entre execuções.
  db.prepare('UPDATE products SET stock = 9999 WHERE name = ?').run(name);
  return db.prepare('SELECT id FROM products WHERE name = ?').get(name);
}

/** Cria mesa direto no banco. */
function seedTable(number) {
  const db = getDatabase();
  const result = db.prepare('INSERT INTO "tables" (number) VALUES (?)').run(number);
  return Number(result.lastInsertRowid);
}

/** Fluxo completo pela API: abre comanda com itens e fecha. */
async function openAndClose(app, tableId, items, paymentMethod) {
  const openResponse = await app.inject({
    method: 'POST',
    url: '/orders',
    payload: { tableId, items },
  });
  assert.strictEqual(openResponse.statusCode, 201, JSON.stringify(openResponse.json()));
  const order = openResponse.json();

  const closeResponse = await app.inject({
    method: 'POST',
    url: `/orders/${order.id}/close`,
    payload: paymentMethod ? { paymentMethod } : undefined,
  });
  assert.strictEqual(closeResponse.statusCode, 200, JSON.stringify(closeResponse.json()));
  return closeResponse.json();
}

test('GET /reports/summary e /reports/sales sem dados: zeros e quebra vazia', async () => {
  clearAll();

  const app = await createApp({ logger: false });

  const summary = (await app.inject({ method: 'GET', url: '/reports/summary' })).json();
  assert.strictEqual(summary.paidOrders, 0);
  assert.strictEqual(summary.totalRevenue, 0);
  assert.strictEqual(normalizeNbsp(summary.totalRevenueFormatted), 'R$ 0,00');
  assert.strictEqual(summary.averageTicket, 0);
  assert.deepStrictEqual(summary.byMethod, []);
  // Bloco 2.1: alias totalSold e topItems acompanhando o estado vazio.
  assert.strictEqual(summary.totalSold, 0);
  assert.deepStrictEqual(summary.topItems, []);
  // Bloco 2.1 (contrato do QA): ordersCount/total/totalFormatted.
  assert.strictEqual(summary.ordersCount, 0);
  assert.strictEqual(summary.total, 0);
  assert.strictEqual(normalizeNbsp(summary.totalFormatted), 'R$ 0,00');
  assert.strictEqual(summary.unpaidClosedOrders, 0);
  assert.strictEqual(summary.from, null);
  assert.strictEqual(summary.to, null);

  const today = spDay();
  const sales = (
    await app.inject({ method: 'GET', url: `/reports/sales?from=${today}&to=${today}` })
  ).json();
  assert.strictEqual(sales.paidOrders, 0);
  assert.strictEqual(sales.ordersCount, 0);
  assert.strictEqual(sales.total, 0);
  assert.strictEqual(normalizeNbsp(sales.totalFormatted), 'R$ 0,00');
  assert.deepStrictEqual(sales.byMethod, []);
  assert.deepStrictEqual(sales.topItems, []);
  assert.strictEqual(sales.from, today);
  assert.strictEqual(sales.to, today);

  await app.close();
});

test('Fechamentos com pagamento alimentam /reports/sales e /reports/summary', async () => {
  clearAll();
  const cafe = seedProduct('Café Relatório', 4500);
  const suco = seedProduct('Suco Relatório', 800);

  const app = await createApp({ logger: false });

  // Mesa 61: café ×2 + suco ×1 = 9800, pago em dinheiro.
  const tableA = seedTable(61);
  await openAndClose(app, tableA, [
    { productId: cafe.id, quantity: 2 },
    { productId: suco.id, quantity: 1 },
  ], 'dinheiro');

  // Mesa 62: suco ×2 = 1600, pago em pix.
  const tableB = seedTable(62);
  await openAndClose(app, tableB, [{ productId: suco.id, quantity: 2 }], 'pix');

  // Mesa 63: café ×1 = 4500, fechada sem pagamento (fluxo legado):
  // entra em unpaidClosedOrders, mas NÃO em ordersCount/topItems.
  const tableC = seedTable(63);
  const unpaid = await openAndClose(app, tableC, [{ productId: cafe.id, quantity: 1 }], null);
  assert.strictEqual(unpaid.payment, null);

  const summary = (await app.inject({ method: 'GET', url: '/reports/summary' })).json();
  assert.strictEqual(summary.paidOrders, 2);
  assert.strictEqual(summary.totalRevenue, 11400); // 9800 + 1600
  assert.strictEqual(normalizeNbsp(summary.totalRevenueFormatted), 'R$ 114,00');
  assert.strictEqual(summary.averageTicket, 5700); // 11400 / 2
  assert.strictEqual(normalizeNbsp(summary.averageTicketFormatted), 'R$ 57,00');
  assert.strictEqual(summary.byMethod.length, 2);
  const [dinheiroRow, pixRow] = summary.byMethod;
  assert.strictEqual(dinheiroRow.method, 'dinheiro'); // ordenado por total (9800 > 1600)
  assert.strictEqual(dinheiroRow.label, 'Dinheiro'); // Bloco 2.1 (contrato QA)
  assert.strictEqual(dinheiroRow.payments, 1);
  assert.strictEqual(dinheiroRow.total, 9800);
  assert.strictEqual(normalizeNbsp(dinheiroRow.totalFormatted), 'R$ 98,00');
  assert.strictEqual(pixRow.method, 'pix');
  assert.strictEqual(pixRow.label, 'Pix');
  assert.strictEqual(pixRow.payments, 1);
  assert.strictEqual(pixRow.total, 1600);
  assert.strictEqual(normalizeNbsp(pixRow.totalFormatted), 'R$ 16,00');

  // Bloco 2.1: alias totalSold (= totalRevenue) e topItems das comandas
  // pagas — suco 3 unidades (1 + 2), café 2 unidades. Order C (não paga)
  // não entra (base de caixa): café = 9000, suco = 2400, soma 11400.
  assert.strictEqual(summary.totalSold, 11400);
  // Bloco 2.1 (contrato do QA): aliases ordersCount/total.
  assert.strictEqual(summary.ordersCount, 2);
  assert.strictEqual(summary.total, 11400);
  assert.strictEqual(normalizeNbsp(summary.totalFormatted), 'R$ 114,00');
  assert.strictEqual(summary.unpaidClosedOrders, 1); // mesa 63
  assert.strictEqual(summary.topItems.length, 2);
  const [sucoTop, cafeTop] = summary.topItems; // ordenado por quantidade DESC
  assert.strictEqual(sucoTop.productId, suco.id);
  assert.strictEqual(sucoTop.productName, 'Suco Relatório');
  assert.strictEqual(sucoTop.quantity, 3);
  assert.strictEqual(sucoTop.total, 2400); // Bloco 2.1 (contrato QA)
  assert.strictEqual(normalizeNbsp(sucoTop.totalFormatted), 'R$ 24,00');
  assert.strictEqual(sucoTop.revenue, 2400); // nome da 1ª versão (compat.)
  assert.strictEqual(normalizeNbsp(sucoTop.revenueFormatted), 'R$ 24,00');
  assert.strictEqual(cafeTop.productId, cafe.id);
  assert.strictEqual(cafeTop.quantity, 2);
  assert.strictEqual(cafeTop.total, 9000);
  assert.strictEqual(cafeTop.revenue, 9000);

  // Período de hoje em SP, datado pelo próprio carimbo dos pagamentos.
  // (Pagamentos feitos "agora": o dia SP pode diferir do dia UTC.)
  const today = spDay();
  const todayReport = (await app.inject({
    method: 'GET',
    url: `/reports/sales?from=${today}&to=${today}`,
  })).json();
  assert.strictEqual(todayReport.paidOrders, 2);
  assert.strictEqual(todayReport.ordersCount, 2);
  assert.strictEqual(todayReport.total, 11400);
  assert.strictEqual(todayReport.unpaidClosedOrders, 1);
  assert.strictEqual(todayReport.topItems.length, 2); // topItems também no sales

  // Período futuro e passado: vazio, sem arrastar dados.
  const tomorrow = (await app.inject({
    method: 'GET',
    url: `/reports/sales?from=${spDay(1)}&to=${spDay(1)}`,
  })).json();
  assert.strictEqual(tomorrow.paidOrders, 0);
  assert.strictEqual(tomorrow.total, 0);
  assert.strictEqual(tomorrow.unpaidClosedOrders, 0);
  assert.deepStrictEqual(tomorrow.topItems, []);

  const untilYesterday = (await app.inject({
    method: 'GET',
    url: `/reports/sales?to=${spDay(-1)}`,
  })).json();
  assert.strictEqual(untilYesterday.paidOrders, 0);

  await app.close();
});

test('GET /reports/sales valida parâmetros from/to (400)', async () => {
  clearAll();

  const app = await createApp({ logger: false });

  const cases = [
    { query: '?from=07/11/2026', why: 'formato barrado' },
    { query: '?from=2026-13-40', why: 'mês/dia impossíveis' },
    { query: '?from=2026-02-30', why: 'data inexistente' },
    { query: `?from=${spDay(1)}&to=${spDay(-1)}`, why: 'from depois de to' },
  ];
  for (const { query, why } of cases) {
    const response = await app.inject({ method: 'GET', url: `/reports/sales${query}` });
    assert.strictEqual(response.statusCode, 400, `esperava 400 em: ${why}`);
    assert.ok(response.json().error, `erro textual ausente em: ${why}`);
  }

  // Erro também fora do sales clássico: a validação vem de route comum.
  const invalidFrom = await app.inject({ method: 'GET', url: '/reports/sales?from=x' });
  assert.strictEqual(invalidFrom.statusCode, 400);

  await app.close();
});

test('Filtro de período respeita America/Sao_Paulo (dia local vs UTC)', async () => {
  clearAll();

  // Dois cenários com carimbos controlados, semeados direto no banco
  // (mesma comanda, re-carimbada na metade final):
  //   A = 2026-11-08T02:00Z = 23:00 de 07/11 em SP (dia local 07/11).
  //   B = 2026-11-08T03:00Z = 00:00 de 08/11 em SP (limite inicial do
  //       dia local 08/11 — deve ser capturado de forma inclusive).
  const db = getDatabase();
  db.prepare('INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)').run(1, 'Geral');
  db.prepare('INSERT INTO "tables" (number) VALUES (?)').run(71);
  const tableId = db.prepare('SELECT id FROM "tables" WHERE number = 71').get().id;
  db.prepare(
    "INSERT INTO \"orders\" (table_id, status, closed_at) VALUES (?, 'closed', ?)",
  ).run(tableId, '2026-11-08T02:00:00.000Z');
  const orderAId = db.prepare('SELECT id FROM "orders" WHERE table_id = ?').get(tableId).id;
  db.prepare(
    "INSERT INTO \"payments\" (order_id, method, amount, created_at) VALUES (?, 'dinheiro', 1000, '2026-11-08T02:00:00.000Z')",
  ).run(orderAId);

  const app = await createApp({ logger: false });

  // O dia SP 07/11 cobre 03:00Z de 07/11 a 03:00Z de 08/11 — captura A.
  const day7 = (await app.inject({
    method: 'GET',
    url: '/reports/sales?from=2026-11-07&to=2026-11-07',
  })).json();
  assert.strictEqual(day7.ordersCount, 1);
  assert.strictEqual(day7.total, 1000);
  assert.strictEqual(day7.unpaidClosedOrders, 0);

  // O dia SP 08/11 começa em 03:00Z do UTC — exclui o carimbo de A.
  const day8 = (await app.inject({
    method: 'GET',
    url: '/reports/sales?from=2026-11-08&to=2026-11-08',
  })).json();
  assert.strictEqual(day8.ordersCount, 0);
  assert.strictEqual(day8.total, 0);

  // Próxima janela: muevo o carimbo para exatamente o limite do dia
  // local 08/11 (03:00:00.000Z) — comparador inclusive.
  db.prepare(
    "UPDATE \"orders\" SET closed_at = '2026-11-08T03:00:00.000Z' WHERE id = ?",
  ).run(orderAId);
  db.prepare(
    "UPDATE \"payments\" SET created_at = '2026-11-08T03:00:00.000Z' WHERE order_id = ?",
  ).run(orderAId);

  const day8AfterBoundary = (await app.inject({
    method: 'GET',
    url: '/reports/sales?from=2026-11-08&to=2026-11-08',
  })).json();
  assert.strictEqual(day8AfterBoundary.ordersCount, 1);
  assert.strictEqual(day8AfterBoundary.total, 1000);

  // E o dia local 07/11 agora NÃO mais captura (carimbo migrou de dia).
  const day7AfterBoundary = (await app.inject({
    method: 'GET',
    url: '/reports/sales?from=2026-11-07&to=2026-11-07',
  })).json();
  assert.strictEqual(day7AfterBoundary.ordersCount, 0);

  await app.close();
});

/** Higieniza o arquivo: produtos remanescentes quebrariam FKs de outros
 * arquivos (RESTRICT em order_items.product_id) e poluem listagens. */
after(() => {
  clearAll();
});
