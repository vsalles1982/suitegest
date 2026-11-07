/**
 * tests/products.test.js — Testes das rotas do módulo de Cardápio.
 *
 * Execução: `npm test` (dentro de backend/) — roda com o node:test nativo.
 *
 * Observação: o armazenamento em memória é compartilhado entre as instâncias
 * criadas por createApp(), então os testes abaixo devem rodar em sequência:
 * primeiro o cenário de lista vazia, depois o de inserção.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/server');

test('GET /products retorna array vazio inicialmente', async () => {
  const app = await createApp({ logger: false });

  const response = await app.inject({ method: 'GET', url: '/products' });
  assert.strictEqual(response.statusCode, 200);
  assert.deepStrictEqual(response.json(), []);

  await app.close();
});

test('POST /products insere um produto', async () => {
  const app = await createApp({ logger: false });

  const createResponse = await app.inject({
    method: 'POST',
    url: '/products',
    payload: {
      name: 'Pizza Margherita',
      price: 4500, // R$ 45,00 em centavos
      categoryId: 1,
    },
  });
  assert.strictEqual(createResponse.statusCode, 201);

  const created = createResponse.json();
  assert.strictEqual(created.name, 'Pizza Margherita');
  assert.strictEqual(created.price, 4500);
  assert.strictEqual(created.categoryId, 1);
  assert.strictEqual(typeof created.id, 'number');
  assert.ok(created.id >= 1, 'id deve ser gerado automaticamente');

  const listResponse = await app.inject({ method: 'GET', url: '/products' });
  assert.strictEqual(listResponse.statusCode, 200);
  assert.deepStrictEqual(listResponse.json(), [created]);

  await app.close();
});

test('POST /products rejeita payload inválido', async () => {
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
