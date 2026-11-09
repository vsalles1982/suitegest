/**
 * tests/dashboard.test.js — Testes do Bloco 5 (Dashboard + Cupom).
 *
 *   GET /reports/dashboard   — cards agregados (base caixa = payments).
 *   GET /orders/:id/receipt  — dados formatados do cupom de fechamento.
 *
 * Contratos documentados no backend/README.md (o docs/backlog-dashboard.md
 * não existe no repositório): dashboard reusa os formatos do
 * /reports/summary do Bloco 2.1 + campo closedOrders; cupom devolve 409 em
 * comanda aberta e 404 em inexistente.
 */
const { test, after } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/server');
const { getDatabase } = require('../src/database');

/** O Intl.NumberFormat usa NBSP; normalizamos para comparar moeda. */
function normalizeNbsp(text) {
  return text.replace(/\u00A0/g, ' ');
}

/** Limpeza na ordem das FKs (RESTRICT). */
function clearAll() {
  const db = getDatabase();
  db.prepare('DELETE FROM "payments"').run();
  db.prepare('DELETE FROM "order_items"').run();
  db.prepare('DELETE FROM "orders"').run();
  db.prepare('DELETE FROM "tables"').run();
  db.prepare('DELETE FROM products').run();
  for (const tableName of ['payments', 'order_items', 'orders', 'tables', 'products']) {
    db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(tableName);
  }
}

function seedTable(number) {
  const db = getDatabase();
  const result = db.prepare('INSERT INTO "tables" (number) VALUES (?)').run(number);
  return db.prepare('SELECT * FROM "tables" WHERE id = ?').get(result.lastInsertRowid);
}

/** Produto com estoque alto (baixa automática do Bloco 4 não bloqueia). */
function seedProduct(name, price) {
  const db = getDatabase();
  db.prepare('INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)').run(1, 'Geral');
  db.prepare('INSERT INTO products (name, price, category_id) VALUES (?, ?, ?)')
    .run(name, price, 1);
  const id = db.prepare('SELECT id FROM products WHERE name = ?').get(name).id;
  db.prepare('UPDATE products SET stock = 9999 WHERE id = ?').run(id);
  return id;
}

/** Abre comanda (falha o teste em erro) e devolve o JSON. */
async function openOrder(app, tableId, items) {
  const response = await app.inject({ method: 'POST', url: '/orders', payload: { tableId, items } });
  assert.strictEqual(response.statusCode, 201, JSON.stringify(response.json()));
  return response.json();
}

/** Fecha comanda com pagamento (falha o teste em erro). */
async function closeOrder(app, orderId, paymentMethod) {
  const payload = paymentMethod ? { paymentMethod } : undefined;
  const response = await app.inject({
    method: 'POST',
    url: `/orders/${orderId}/close`,
    payload,
  });
  assert.strictEqual(response.statusCode, 200, JSON.stringify(response.json()));
  return response.json();
}

test('GET /reports/dashboard zerado: cards vazios sem caindo', async () => {
  clearAll();

  const app = await createApp({ logger: false });
  const dashboard = (await app.inject({ method: 'GET', url: '/reports/dashboard' })).json();

  assert.strictEqual(dashboard.ordersCount, 0); // comandas pagas
  assert.strictEqual(dashboard.closedOrders, 0); // comandas fechadas
  assert.strictEqual(dashboard.total, 0);
  assert.strictEqual(normalizeNbsp(dashboard.totalFormatted), 'R$ 0,00');
  assert.strictEqual(dashboard.averageTicket, 0); // sem divisão por zero
  assert.strictEqual(normalizeNbsp(dashboard.averageTicketFormatted), 'R$ 0,00');
  assert.deepStrictEqual(dashboard.topItems, []);
  assert.deepStrictEqual(dashboard.byMethod, []);

  await app.close();
});

test('Dashboard agrega caixa: total, ticket médio, fechadas, top e por forma', async () => {
  clearAll();
  const pastel = seedProduct('Pastel Dash', 1000); // R$ 10,00
  const suco = seedProduct('Suco Dash', 500); // R$ 5,00

  const app = await createApp({ logger: false });

  // Comanda 1: mesa 1, paga cartão — 2× pastel + 1 suco = R$ 25,00.
  const table1 = seedTable(61);
  const order1 = await openOrder(app, table1.id, [
    { productId: pastel, quantity: 2 },
    { productId: suco, quantity: 1 },
  ]);
  await closeOrder(app, order1.id, 'cartao');

  // Comanda 2: mesa 2, paga pix — 1× pastel = R$ 10,00.
  const table2 = seedTable(62);
  const order2 = await openOrder(app, table2.id, [{ productId: pastel, quantity: 1 }]);
  await closeOrder(app, order2.id, 'pix');

  // Comanda 3: fechada SEM pagamento (legado) — não entra no caixa.
  const table3 = seedTable(63);
  const order3 = await openOrder(app, table3.id, [{ productId: suco, quantity: 4 }]);
  await closeOrder(app, order3.id, null);

  const dashboard = (await app.inject({ method: 'GET', url: '/reports/dashboard' })).json();

  // Caixa: 25 + 10 = R$ 35,00 em 2 comandas pagas; ticket médio 17,50.
  assert.strictEqual(dashboard.ordersCount, 2);
  assert.strictEqual(dashboard.closedOrders, 3); // pagas + legado
  assert.strictEqual(dashboard.total, 3500);
  assert.strictEqual(normalizeNbsp(dashboard.totalFormatted), 'R$ 35,00');
  assert.strictEqual(dashboard.averageTicket, 1750); // round(3500 / 2)
  assert.strictEqual(normalizeNbsp(dashboard.averageTicketFormatted), 'R$ 17,50');
  assert.strictEqual(dashboard.unpaidClosedOrders, 1);

  // Top itens (base PAGAS): pastel 3 un. R$ 30,00; suco 1 un. R$ 5,00.
  assert.deepStrictEqual(dashboard.topItems.map((item) => item.productName), [
    'Pastel Dash',
    'Suco Dash',
  ]);
  assert.strictEqual(dashboard.topItems[0].quantity, 3);
  assert.strictEqual(dashboard.topItems[0].total, 3000);
  assert.strictEqual(normalizeNbsp(dashboard.topItems[0].totalFormatted), 'R$ 30,00');
  assert.strictEqual(dashboard.topItems[1].quantity, 1);
  assert.strictEqual(dashboard.topItems[1].total, 500);
  // Reconciliação: soma dos totais do top = total de caixa.
  assert.strictEqual(
    dashboard.topItems.reduce((sum, item) => sum + item.total, 0),
    dashboard.total,
  );

  // Formas de pagamento ordenadas por valor: cartão 25,00; pix 10,00.
  assert.deepStrictEqual(dashboard.byMethod.map((row) => row.method), ['cartao', 'pix']);
  assert.strictEqual(dashboard.byMethod[0].label, 'Cartão');
  assert.strictEqual(dashboard.byMethod[0].payments, 1);
  assert.strictEqual(dashboard.byMethod[0].total, 2500);
  assert.strictEqual(normalizeNbsp(dashboard.byMethod[0].totalFormatted), 'R$ 25,00');

  await app.close();
});

test('GET /orders/:id/receipt devolve cupom completo com pagamento e comissão', async () => {
  clearAll();
  const pizza = seedProduct('Pizza Cupom', 4500); // R$ 45,00

  const app = await createApp({ logger: false });

  // Garçom com 10% atribuído à mesa (transação copia para a comanda).
  const employeeId = Number(getDatabase()
    .prepare('INSERT INTO employees (name, commission_bps, active) VALUES (?, ?, 1)')
    .run('Garçom Cupom', 1000).lastInsertRowid);
  const table = seedTable(64);
  getDatabase().prepare('UPDATE "tables" SET employee_id = ? WHERE id = ?').run(employeeId, table.id);

  const order = await openOrder(app, table.id, [
    { productId: pizza, quantity: 2 }, // R$ 90,00
  ]);
  const closed = await closeOrder(app, order.id, 'dinheiro');

  const response = await app.inject({ method: 'GET', url: `/orders/${order.id}/receipt` });
  assert.strictEqual(response.statusCode, 200, JSON.stringify(response.json()));

  const receipt = response.json();
  assert.strictEqual(receipt.orderId, order.id);
  assert.strictEqual(receipt.tableId, table.id);

  // Itens formatados para impressão.
  assert.strictEqual(receipt.items.length, 1);
  assert.strictEqual(receipt.items[0].productName, 'Pizza Cupom');
  assert.strictEqual(receipt.items[0].quantity, 2);
  assert.strictEqual(receipt.items[0].unitPrice, 4500);
  assert.strictEqual(normalizeNbsp(receipt.items[0].unitPriceFormatted), 'R$ 45,00');
  assert.strictEqual(receipt.items[0].subtotal, 9000);
  assert.strictEqual(normalizeNbsp(receipt.items[0].subtotalFormatted), 'R$ 90,00');

  // Total deriva dos itens e casa com o pagamento do fechamento.
  assert.strictEqual(receipt.total, 9000);
  assert.strictEqual(normalizeNbsp(receipt.totalFormatted), 'R$ 90,00');
  assert.strictEqual(receipt.payment.method, 'dinheiro');
  assert.strictEqual(receipt.payment.methodLabel, 'Dinheiro');
  assert.strictEqual(receipt.payment.amount, 9000);
  assert.strictEqual(normalizeNbsp(receipt.payment.amountFormatted), 'R$ 90,00');

  // Comissão snapshotada no fechamento (Bloco 3): 10% de R$ 90,00.
  assert.strictEqual(receipt.payment.employeeId, employeeId);
  assert.strictEqual(receipt.payment.employeeName, 'Garçom Cupom');
  assert.strictEqual(receipt.payment.commissionBps, 1000);
  assert.strictEqual(receipt.payment.commissionAmount, 900);
  assert.strictEqual(normalizeNbsp(receipt.payment.commissionAmountFormatted), 'R$ 9,00');

  // Datas/horas: fechamento gravado e carimbo de impressão presente.
  assert.strictEqual(receipt.closedAt, closed.closedAt);
  assert.ok(receipt.closedAt);
  assert.ok(Date.parse(receipt.printedAt) > Date.parse(receipt.closedAt) - 60_000);

  await app.close();
});

test('GET /orders/:id/receipt: comanda aberta 409, inexistente 404, id ruim 400 e sem pagamento payment null', async () => {
  clearAll();
  const suco = seedProduct('Suco Cupom', 500);

  const app = await createApp({ logger: false });
  const table = seedTable(65);

  const open = await openOrder(app, table.id, [{ productId: suco, quantity: 1 }]);
  const openReceipt = await app.inject({ method: 'GET', url: `/orders/${open.id}/receipt` });
  assert.strictEqual(openReceipt.statusCode, 409);
  assert.ok(openReceipt.json().error.includes('aberta'));

  // Legado: fechado sem pagamento — cupom sai com payment null.
  await closeOrder(app, open.id, null);
  const legacy = (await app.inject({ method: 'GET', url: `/orders/${open.id}/receipt` })).json();
  assert.strictEqual(legacy.payment, null);
  assert.strictEqual(legacy.total, 500);
  assert.strictEqual(normalizeNbsp(legacy.totalFormatted), 'R$ 5,00');

  const missing = await app.inject({ method: 'GET', url: '/orders/9999/receipt' });
  assert.strictEqual(missing.statusCode, 404);

  const invalid = await app.inject({ method: 'GET', url: '/orders/abc/receipt' });
  assert.strictEqual(invalid.statusCode, 400);

  await app.close();
});

/** Higieniza o arquivo (FKs RESTRICT nos outros arquivos). */
after(() => {
  clearAll();
});
