/**
 * tests/orders.test.js — Testes das rotas de Comanda (Fase 7).
 *
 * Execução: `npm test` (dentro de backend/) — roda com o node:test nativo.
 *
 * Os testes usam o banco real (backend/data/suitesimula.db, ou
 * DATABASE_PATH). Antes de cada teste, order_items, orders e tables são
 * limpos (nessa ordem, pela FK) e os contadores de id zerados.
 */
const { test, after } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/server');
const { getDatabase } = require('../src/database');

/** Remover espaços não separáveis (U+00A0) usado pelo Intl em moeda. */
function normalizeNbsp(text) {
  return text.replace(/\u00A0/g, ' ');
}

/** Limpa mesas/comandas (orders, order_items e tables, pela FK) e zera contadores. */
function clearOrders() {
  const db = getDatabase();
  db.prepare('DELETE FROM "order_items"').run();
  db.prepare('DELETE FROM "orders"').run();
  db.prepare('DELETE FROM "tables"').run();
  for (const tableName of ['order_items', 'orders', 'tables']) {
    db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(tableName);
  }
}

/** Seed de produtos com preços padrão redefinidos (idempotente entre execuções). */
function seedCatalog() {
  const db = getDatabase();
  db.prepare('INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)').run(1, 'Geral');
  db.prepare(
    'INSERT INTO products (name, price, category_id) VALUES (?, ?, ?) ' +
    'ON CONFLICT (category_id, name) DO NOTHING',
  ).run('Café Comanda', 4500, 1);
  db.prepare(
    'INSERT INTO products (name, price, category_id) VALUES (?, ?, ?) ' +
    'ON CONFLICT (category_id, name) DO NOTHING',
  ).run('Suco Comanda', 800, 1);
  // Restaura os preços padrão (o teste de snapshot altera o preço em disco).
  db.prepare('UPDATE products SET price = ? WHERE name = ?').run(4500, 'Café Comanda');
  db.prepare('UPDATE products SET price = ? WHERE name = ?').run(800, 'Suco Comanda');
  return db.prepare('SELECT id, price FROM products WHERE name = ?').get('Café Comanda');
}

/** Cria uma mesa de teste direto no banco e devolve a linha. */
function seedTable(number, status = 'free') {
  const db = getDatabase();
  const result = db.prepare('INSERT INTO "tables" (number, status) VALUES (?, ?)').run(number, status);
  return db.prepare('SELECT * FROM "tables" WHERE id = ?').get(result.lastInsertRowid);
}

/** POST /orders de atalho para os testes. */
async function openOrder(app, payload) {
  const response = await app.inject({ method: 'POST', url: '/orders', payload });
  assert.strictEqual(response.statusCode, 201, JSON.stringify(response.json()));
  return response.json();
}

test('POST /orders abre comanda, calcula total e ocupa a mesa', async () => {
  clearOrders();
  const cafe = seedCatalog();
  const table = seedTable(1);

  const app = await createApp({ logger: false });
  const order = await openOrder(app, {
    tableId: table.id,
    items: [
      { productId: cafe.id, quantity: 2 },
      { productId: cafe.id, quantity: 1, notes: 'Sem açúcar' },
    ],
  });

  assert.strictEqual(order.tableId, table.id);
  assert.strictEqual(order.status, 'open');
  assert.strictEqual(typeof order.createdAt, 'string');
  assert.strictEqual(order.items.length, 2);
  assert.strictEqual(order.items[0].unitPrice, 4500);
  assert.strictEqual(normalizeNbsp(order.items[0].unitPriceFormatted), 'R$ 45,00');
  assert.strictEqual(order.items[0].subtotal, 9000); // 2 * 4500
  assert.strictEqual(order.items[1].notes, 'Sem açúcar');
  assert.strictEqual(order.total, 13500); // 9000 + 4500
  assert.strictEqual(normalizeNbsp(order.totalFormatted), 'R$ 135,00');

  // Mesa passa a ocupada (mesma transação).
  const tableResponse = await app.inject({ method: 'GET', url: '/tables' });
  const tableRow = tableResponse.json().find((t) => t.id === table.id);
  assert.strictEqual(tableRow.status, 'occupied');

  await app.close();
});

test('GET /orders/:id retorna itens, subtotais e total derivados', async () => {
  clearOrders();
  const db = getDatabase();
  const cafe = seedCatalog();
  const suco = db.prepare('SELECT id, price FROM products WHERE name = ?').get('Suco Comanda');
  const table = seedTable(2);

  const app = await createApp({ logger: false });
  const created = await openOrder(app, {
    tableId: table.id,
    items: [
      { productId: cafe.id, quantity: 1 },
      { productId: suco.id, quantity: 3 },
    ],
  });

  const response = await app.inject({ method: 'GET', url: `/orders/${created.id}` });
  assert.strictEqual(response.statusCode, 200);
  const order = response.json();

  assert.strictEqual(order.id, created.id);
  assert.strictEqual(order.items[0].subtotal, 4500);
  assert.strictEqual(order.items[1].subtotal, 2400); // 3 * 800
  assert.strictEqual(normalizeNbsp(order.items[1].subtotalFormatted), 'R$ 24,00');
  assert.strictEqual(order.total, 6900);
  assert.strictEqual(normalizeNbsp(order.totalFormatted), 'R$ 69,00');
  assert.ok(order.items.every((item) => typeof item.productName === 'string'));

  await app.close();
});

test('snapshot: alterar preço do produto depois não muda a comanda', async () => {
  clearOrders();
  const db = getDatabase();
  const cafe = seedCatalog(); // re-semeia com os preços padrão (4500 / 800)
  const table = seedTable(3);

  const app = await createApp({ logger: false });
  const created = await openOrder(app, {
    tableId: table.id,
    items: [{ productId: cafe.id, quantity: 1 }],
  });
  assert.strictEqual(created.items[0].unitPrice, 4500);

  // Preço do produto muda após a abertura...
  db.prepare('UPDATE products SET price = ? WHERE id = ?').run(9900, cafe.id);

  const orderResponse = await app.inject({ method: 'GET', url: `/orders/${created.id}` });
  const order = orderResponse.json();
  assert.strictEqual(order.items[0].unitPrice, 4500, 'unit_price é snapshot');
  assert.strictEqual(order.total, 4500);

  // ...e o novo POST usa o preço atualizado (novo snapshot).
  const freeTable = seedTable(4);
  const novo = await openOrder(app, { tableId: freeTable.id, items: [{ productId: cafe.id, quantity: 1 }] });
  assert.strictEqual(novo.items[0].unitPrice, 9900);

  await app.close();
});

test('POST /orders rejeita mesa com comanda aberta (409)', async () => {
  clearOrders();
  const cafe = seedCatalog();
  const table = seedTable(5);

  const app = await createApp({ logger: false });
  await openOrder(app, { tableId: table.id, items: [{ productId: cafe.id, quantity: 1 }] });

  const second = await app.inject({
    method: 'POST',
    url: '/orders',
    payload: { tableId: table.id, items: [{ productId: cafe.id, quantity: 1 }] },
  });
  assert.strictEqual(second.statusCode, 409);
  assert.ok(second.json().error.includes('comanda aberta'));

  await app.close();
});

test('POST /orders permite mesa occupied SEM comanda aberta', async () => {
  clearOrders();
  const cafe = seedCatalog();
  const table = seedTable(6, 'occupied');

  const app = await createApp({ logger: false });
  const order = await openOrder(app, {
    tableId: table.id,
    items: [{ productId: cafe.id, quantity: 1 }],
  });
  assert.strictEqual(order.status, 'open');

  await app.close();
});

test('POST /orders rejeita mesa fechada (409) e inexistente (404)', async () => {
  clearOrders();
  const cafe = seedCatalog();
  const closedTable = seedTable(7, 'closed');

  const app = await createApp({ logger: false });

  const closed = await app.inject({
    method: 'POST',
    url: '/orders',
    payload: { tableId: closedTable.id, items: [{ productId: cafe.id, quantity: 1 }] },
  });
  assert.strictEqual(closed.statusCode, 409);

  const missing = await app.inject({
    method: 'POST',
    url: '/orders',
    payload: { tableId: 9999, items: [{ productId: cafe.id, quantity: 1 }] },
  });
  assert.strictEqual(missing.statusCode, 404);

  await app.close();
});

test('POST /orders valida payload: itens, produto e quantidade (400)', async () => {
  clearOrders();
  const cafe = seedCatalog();
  const table = seedTable(8);

  const app = await createApp({ logger: false });

  const cases = [
    { payload: { tableId: table.id },                       why: 'items ausente' },
    { payload: { tableId: table.id, items: [] },            why: 'items vazio' },
    { payload: { tableId: table.id, items: [{ productId: 9999, quantity: 1 }] }, why: 'produto inexistente' },
    { payload: { tableId: table.id, items: [{ productId: cafe.id, quantity: 0 }] }, why: 'quantity 0' },
    { payload: { tableId: table.id, items: [{ productId: cafe.id, quantity: 1000 }] }, why: 'quantity > 999' },
    { payload: { tableId: table.id, items: [{ productId: cafe.id, quantity: 1.5 }] }, why: 'quantity decimal' },
    { payload: { items: [{ productId: cafe.id, quantity: 1 }] }, why: 'tableId ausente' },
    { payload: { tableId: -1, items: [{ productId: cafe.id, quantity: 1 }] }, why: 'tableId negativo' },
  ];

  for (const { payload, why } of cases) {
    const response = await app.inject({ method: 'POST', url: '/orders', payload });
    assert.strictEqual(response.statusCode, 400, `esperava 400 em: ${why}`);
    assert.ok(response.json().error, `erro textual ausente em: ${why}`);
  }

  await app.close();
});

test('GET /orders/:id valida id e comanda inexistente', async () => {
  clearOrders();

  const app = await createApp({ logger: false });

  const invalid = await app.inject({ method: 'GET', url: '/orders/abc' });
  assert.strictEqual(invalid.statusCode, 400);

  const missing = await app.inject({ method: 'GET', url: '/orders/9999' });
  assert.strictEqual(missing.statusCode, 404);

  await app.close();
});

/** Higieniza o banco após o arquivo: order_items órfãs quebrariam o
 * DELETE FROM products (FK RESTRICT) nos outros arquivos de teste. */
after(() => {
  clearOrders();
});
