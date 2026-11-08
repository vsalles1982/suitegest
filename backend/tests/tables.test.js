/**
 * tests/tables.test.js — Testes das rotas do módulo de Mesas (Fase 6).
 *
 * Execução: `npm test` (dentro de backend/) — roda com o node:test nativo.
 *
 * Os testes usam o banco real (backend/data/suitesimula.db, ou DATABASE_PATH).
 * Como products.test.js e categories.test.js rodam nos mesmos dados, cada
 * teste limpa orders e tables no início (ordessas saem primeiro, pela FK).
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/server');
const { getDatabase } = require('../src/database');

/** Limpa mesas (e seus pagamentos/pedidos, pelas FKs) e reinicia os contadores de id. */
function clearTables() {
  const db = getDatabase();
  db.prepare('DELETE FROM "payments"').run();
  db.prepare('DELETE FROM "order_items"').run();
  db.prepare('DELETE FROM "orders"').run();
  db.prepare('DELETE FROM "tables"').run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'payments'").run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'tables'").run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'orders'").run();
}

/** Cria uma mesa de teste direto no banco e devolve a linha. */
function seedTable(number, status = 'free') {
  const db = getDatabase();
  const result = db.prepare('INSERT INTO "tables" (number, status) VALUES (?, ?)').run(number, status);
  return db.prepare('SELECT * FROM "tables" WHERE id = ?').get(result.lastInsertRowid);
}

/** Cria um produto de apoio (idempotente) para testes de fluxo. */
function seedProduct(name, price) {
  const db = getDatabase();
  db.prepare('INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)').run(1, 'Geral');
  db.prepare(
    'INSERT INTO products (name, price, category_id) VALUES (?, ?, ?) ' +
    'ON CONFLICT (category_id, name) DO NOTHING',
  ).run(name, price, 1);
  return db.prepare('SELECT id, price FROM products WHERE name = ?').get(name);
}

/** Abre comanda pela API e devolve o JSON (falha o teste se der erro). */
async function openOrderQuiet(app, tableId, productId, quantity) {
  const response = await app.inject({
    method: 'POST',
    url: '/orders',
    payload: { tableId, items: [{ productId, quantity }] },
  });
  assert.strictEqual(response.statusCode, 201);
  return response.json();
}

test('GET /tables retorna array vazio inicialmente', async () => {
  clearTables();

  const app = await createApp({ logger: false });

  const response = await app.inject({ method: 'GET', url: '/tables' });
  assert.strictEqual(response.statusCode, 200);
  assert.deepStrictEqual(response.json(), []);

  await app.close();
});

test('POST /tables cria mesa com status inicial "free"', async () => {
  clearTables();

  const app = await createApp({ logger: false });

  const createResponse = await app.inject({
    method: 'POST',
    url: '/tables',
    payload: { number: 5 },
  });
  assert.strictEqual(createResponse.statusCode, 201);

  const created = createResponse.json();
  assert.strictEqual(created.number, 5);
  assert.strictEqual(created.status, 'free');
  assert.strictEqual(typeof created.id, 'number');

  const listResponse = await app.inject({ method: 'GET', url: '/tables' });
  assert.deepStrictEqual(listResponse.json(), [created]);

  await app.close();
});

test('GET /tables lista ordenada por número', async () => {
  clearTables();

  const app = await createApp({ logger: false });

  // Cadastradas fora de ordem para conferir a ordenação.
  for (const number of [10, 2, 7]) {
    await app.inject({ method: 'POST', url: '/tables', payload: { number } });
  }

  const listResponse = await app.inject({ method: 'GET', url: '/tables' });
  assert.strictEqual(listResponse.statusCode, 200);
  assert.deepStrictEqual(listResponse.json().map((t) => t.number), [2, 7, 10]);

  await app.close();
});

test('POST /tables rejeita número duplicado', async () => {
  clearTables();

  const app = await createApp({ logger: false });

  await app.inject({ method: 'POST', url: '/tables', payload: { number: 1 } });

  const duplicateResponse = await app.inject({
    method: 'POST',
    url: '/tables',
    payload: { number: 1 },
  });
  assert.strictEqual(duplicateResponse.statusCode, 409);
  assert.ok(duplicateResponse.json().error.includes('1'));

  await app.close();
});

test('POST /tables rejeita payload inválido', async () => {
  clearTables();

  const app = await createApp({ logger: false });

  const missingNumber = await app.inject({ method: 'POST', url: '/tables', payload: {} });
  assert.strictEqual(missingNumber.statusCode, 400);

  const zero = await app.inject({ method: 'POST', url: '/tables', payload: { number: 0 } });
  assert.strictEqual(zero.statusCode, 400);

  const text = await app.inject({ method: 'POST', url: '/tables', payload: { number: 'mesa um' } });
  assert.strictEqual(text.statusCode, 400);

  await app.close();
});

test('PUT /tables/:id/status occupied -> closed sem comanda', async () => {
  clearTables();
  const table = seedTable(31, 'occupied');

  const app = await createApp({ logger: false });

  const response = await app.inject({
    method: 'PUT',
    url: `/tables/${table.id}/status`,
    payload: { status: 'closed' },
  });
  assert.strictEqual(response.statusCode, 200); // AC-TABLE-01
  assert.strictEqual(response.json().status, 'closed');

  await app.close();
});

test('PUT /tables/:id/status occupied -> closed é bloqueado com comanda aberta', async () => {
  clearTables();
  const product = seedProduct('Suco Mesas F8', 800);
  const table = seedTable(32, 'occupied'); // id 1 neste run

  const db = getDatabase();
  db.prepare('INSERT INTO "orders" (table_id) VALUES (?)').run(table.id);

  const app = await createApp({ logger: false });

  const response = await app.inject({
    method: 'PUT',
    url: `/tables/${table.id}/status`,
    payload: { status: 'closed' },
  });
  assert.strictEqual(response.statusCode, 409); // AC-TABLE-02
  assert.ok(response.json().error.includes('comanda aberta'));

  // Mesamoranda comanda inalterados (nada parcial).
  const tableRow = await app.inject({ method: 'GET', url: '/tables' });
  assert.strictEqual(tableRow.json()[0].status, 'occupied');
  const orderRow = db.prepare('SELECT status FROM "orders" WHERE table_id = ?').get(table.id);
  assert.strictEqual(orderRow.status, 'open');
  assert.ok(product.id >= 1);

  await app.close();
});

test('PUT /tables/:id/status closed -> free e depois free -> free (409)', async () => {
  clearTables();
  const table = seedTable(33, 'closed');

  const app = await createApp({ logger: false });

  const freeResponse = await app.inject({
    method: 'PUT',
    url: `/tables/${table.id}/status`,
    payload: { status: 'free' },
  });
  assert.strictEqual(freeResponse.statusCode, 200); // AC-TABLE-04
  assert.strictEqual(freeResponse.json().status, 'free');

  const again = await app.inject({
    method: 'PUT',
    url: `/tables/${table.id}/status`,
    payload: { status: 'free' },
  });
  assert.strictEqual(again.statusCode, 409); // AC-TABLE-08

  await app.close();
});

test('PUT /tables/:id/status bloqueia transições inválidas (409)', async () => {
  clearTables();
  const freeTable = seedTable(34, 'free'); // id 1
  const occupiedTable = seedTable(35, 'occupied'); // id 2
  const closedTable = seedTable(36, 'closed'); // id 3

  const app = await createApp({ logger: false });

  const freeClosed = await app.inject({
    method: 'PUT',
    url: `/tables/${freeTable.id}/status`,
    payload: { status: 'closed' },
  });
  assert.strictEqual(freeClosed.statusCode, 409); // AC-TABLE-05

  const occupiedFree = await app.inject({
    method: 'PUT',
    url: `/tables/${occupiedTable.id}/status`,
    payload: { status: 'free' },
  });
  assert.strictEqual(occupiedFree.statusCode, 409); // AC-TABLE-06

  const closedAgain = await app.inject({
    method: 'PUT',
    url: `/tables/${closedTable.id}/status`,
    payload: { status: 'closed' },
  });
  assert.strictEqual(closedAgain.statusCode, 409); // AC-TABLE-07

  await app.close();
});

test('PUT /tables/:id/status valida corpo (400) e id/mesa (400/404)', async () => {
  clearTables();
  const table = seedTable(37, 'occupied');

  const app = await createApp({ logger: false });

  const invalidBodies = [
    {}, // ausente
    { status: 'occupied' }, // destino não aceito nesta fase (AC-TABLE-09)
    { status: 'matando saudade' }, // desconhecido
  ];
  for (const payload of invalidBodies) {
    const response = await app.inject({
      method: 'PUT',
      url: `/tables/${table.id}/status`,
      payload,
    });
    assert.strictEqual(response.statusCode, 400, JSON.stringify(payload));
    assert.ok(response.json().error);
  }

  const brokenId = await app.inject({
    method: 'PUT',
    url: '/tables/abc/status',
    payload: { status: 'closed' },
  });
  assert.strictEqual(brokenId.statusCode, 400); // AC-TABLE-11

  const zeroId = await app.inject({
    method: 'PUT',
    url: '/tables/0/status',
    payload: { status: 'closed' },
  });
  assert.strictEqual(zeroId.statusCode, 400);

  const missing = await app.inject({
    method: 'PUT',
    url: '/tables/9999/status',
    payload: { status: 'free' },
  });
  assert.strictEqual(missing.statusCode, 404); // AC-TABLE-10

  await app.close();
});

test('Ciclo F8: mesa liberada não toca comandas fechadas e aceita nova comanda', async () => {
  clearTables();
  const product = seedProduct('Esfiha Ciclo F8', 3000);
  const table = seedTable(38, 'occupied'); // id 1

  // Comanda aberta (com itens) criada pela própria API.
  const app = await createApp({ logger: false });
  const order = await openOrderQuiet(app, table.id, product.id, 2);

  // Encerra comanda → fecha mesa → libera mesa.
  await app.inject({ method: 'POST', url: `/orders/${order.id}/close` });
  await app.inject({ method: 'PUT', url: `/tables/${table.id}/status`, payload: { status: 'closed' } });

  const freeResponse = await app.inject({
    method: 'PUT',
    url: `/tables/${table.id}/status`,
    payload: { status: 'free' },
  });
  assert.strictEqual(freeResponse.statusCode, 200);

  // Comanda fechada permanece fechada e consultável (AC-TABLE-12).
  const closedOrder = await app.inject({ method: 'GET', url: `/orders/${order.id}` });
  assert.strictEqual(closedOrder.statusCode, 200);
  assert.strictEqual(closedOrder.json().status, 'closed');
  assert.strictEqual(closedOrder.json().items.length, 1);

  // Mesa liberada aceita nova comanda (AC-TABLE-13).
  const secondOrder = await openOrderQuiet(app, table.id, product.id, 1);
  assert.strictEqual(secondOrder.status, 'open');

  await app.close();
});
