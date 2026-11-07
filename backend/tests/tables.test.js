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

/** Limpa mesas (e seus pedidos, pela FK) e reinicia os contadores de id. */
function clearTables() {
  const db = getDatabase();
  db.prepare('DELETE FROM "orders"').run();
  db.prepare('DELETE FROM "tables"').run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'tables'").run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'orders'").run();
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
