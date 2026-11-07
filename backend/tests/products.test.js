/**
 * tests/products.test.js — Testes das rotas do módulo de Cardápio.
 *
 * Execução: `npm test` (dentro de backend/) — roda com o node:test nativo.
 *
 * Os testes usam o banco real (backend/data/suitesimula.db, ou DATABASE_PATH).
 * Para não haver conflito de IDs nem interferência entre testes, cada teste
 * limpa a tabela products no início (DELETE FROM products) e também zera o
 * contador de AUTOINCREMENT. A categoria padrão Geral (id 1) é sempre mantida.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/server');
const { getDatabase } = require('../src/database');

/** O Intl.NumberFormat do Node usa espaço não separável (U+00A0) na moeda; normalizamos para comparar. */
function normalizeNbsp(text) {
  return text.replace(/\u00A0/g, ' ');
}

/** Remove todos os produtos e reinicia o contador de ids. */
function clearProducts() {
  const db = getDatabase();
  db.prepare('DELETE FROM products').run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'products'").run();
}

test('GET /products retorna array vazio inicialmente', async () => {
  clearProducts();

  const app = await createApp({ logger: false });

  const response = await app.inject({ method: 'GET', url: '/products' });
  assert.strictEqual(response.statusCode, 200);
  assert.deepStrictEqual(response.json(), []);

  await app.close();
});

test('POST /products insere um produto com campos calculados', async () => {
  clearProducts();

  const app = await createApp({ logger: false });

  const createResponse = await app.inject({
    method: 'POST',
    url: '/products',
    payload: {
      name: 'Pizza Margherita',
      price: 4500, // R$ 45,00 em centavos
      categoryId: 1, // Categoria "Geral"
    },
  });
  assert.strictEqual(createResponse.statusCode, 201);

  const created = createResponse.json();
  assert.strictEqual(created.name, 'Pizza Margherita');
  assert.strictEqual(created.price, 4500, 'price deve permanecer em centavos (inteiro)');
  assert.strictEqual(normalizeNbsp(created.priceFormatted), 'R$ 45,00');
  assert.strictEqual(created.categoryId, 1);
  assert.strictEqual(created.categoryName, 'Geral');
  assert.strictEqual(typeof created.id, 'number');
  assert.ok(created.id >= 1, 'id deve ser gerado automaticamente');
  assert.strictEqual(typeof created.createdAt, 'string');

  const listResponse = await app.inject({ method: 'GET', url: '/products' });
  assert.strictEqual(listResponse.statusCode, 200);
  assert.deepStrictEqual(listResponse.json(), [created]);

  await app.close();
});

test('priceFormatted formata centavos como moeda BRL', async () => {
  clearProducts();

  const app = await createApp({ logger: false });

  const createResponse = await app.inject({
    method: 'POST',
    url: '/products',
    payload: { name: 'Refrigerante', price: 4590, categoryId: 1 },
  });
  assert.strictEqual(createResponse.statusCode, 201);

  const created = createResponse.json();
  assert.strictEqual(created.price, 4590);
  assert.strictEqual(normalizeNbsp(created.priceFormatted), 'R$ 45,90');
  assert.strictEqual(created.categoryName, 'Geral');

  await app.close();
});

test('POST /products rejeita payload inválido', async () => {
  clearProducts();

  const app = await createApp({ logger: false });

  const response = await app.inject({
    method: 'POST',
    url: '/products',
    payload: { name: 'Sem preço', categoryId: 1 },
  });
  assert.strictEqual(response.statusCode, 400);
  assert.ok(response.json().error);

  await app.close();
});

test('POST /products rejeita categoria inexistente', async () => {
  clearProducts();

  const app = await createApp({ logger: false });

  const response = await app.inject({
    method: 'POST',
    url: '/products',
    payload: { name: 'Órfão de categoria', price: 1000, categoryId: 999 },
  });
  assert.strictEqual(response.statusCode, 400);
  assert.ok(response.json().error.includes('999'));

  await app.close();
});
