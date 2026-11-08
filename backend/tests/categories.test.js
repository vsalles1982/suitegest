/**
 * tests/categories.test.js — Testes do CRUD de categorias.
 *
 * Execução: `npm test` (dentro de backend/) — roda com o node:test nativo.
 *
 * Os testes usam o banco real (backend/data/suitesimula.db, ou DATABASE_PATH).
 * Antes de cada teste, todas as categorias exceto a padrão "Geral" (id 1)
 * são removidas — produtos órfãos dessas categorias também são, para não
 * colidir com a FK de products.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/server');
const { getDatabase } = require('../src/database');

/** Remove categorias criadas em testes, preservando a padrão "Geral" (id 1). */
function clearCategories() {
  const db = getDatabase();

  // Produtos de categorias não padrão saem primeiro (FK com ON DELETE RESTRICT).
  db.prepare('DELETE FROM products WHERE category_id != 1').run();
  db.prepare('DELETE FROM categories WHERE id != 1').run();

  // Garante a categoria padrão no banco (INSERT OR IGNORE).
  db.prepare('INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)').run(1, 'Geral');
}

test('GET /categories lista apenas a categoria padrão após limpeza', async () => {
  clearCategories();

  const app = await createApp({ logger: false });

  const response = await app.inject({ method: 'GET', url: '/categories' });
  assert.strictEqual(response.statusCode, 200);
  assert.deepStrictEqual(response.json(), [{ id: 1, name: 'Geral' }]);

  await app.close();
});

test('POST /categories cria uma categoria', async () => {
  clearCategories();

  const app = await createApp({ logger: false });

  const createResponse = await app.inject({
    method: 'POST',
    url: '/categories',
    payload: { name: 'Bebidas' },
  });
  assert.strictEqual(createResponse.statusCode, 201);

  const created = createResponse.json();
  assert.strictEqual(created.name, 'Bebidas');
  assert.strictEqual(typeof created.id, 'number');
  assert.ok(created.id >= 1);

  const listResponse = await app.inject({ method: 'GET', url: '/categories' });
  const list = listResponse.json();
  assert.ok(list.some((category) => category.id === created.id && category.name === 'Bebidas'));

  await app.close();
});

test('POST /categories rejeita nome duplicado', async () => {
  clearCategories();

  const app = await createApp({ logger: false });

  const response = await app.inject({
    method: 'POST',
    url: '/categories',
    payload: { name: 'Geral' },
  });
  assert.strictEqual(response.statusCode, 409);
  assert.ok(response.json().error.includes('Geral'));

  await app.close();
});

test('PUT /categories/:id atualiza o nome', async () => {
  clearCategories();

  const app = await createApp({ logger: false });

  const createResponse = await app.inject({
    method: 'POST',
    url: '/categories',
    payload: { name: 'Sobremesas' },
  });
  const { id } = createResponse.json();

  const updateResponse = await app.inject({
    method: 'PUT',
    url: `/categories/${id}`,
    payload: { name: 'Doces' },
  });
  assert.strictEqual(updateResponse.statusCode, 200);

  const updated = updateResponse.json();
  assert.strictEqual(updated.id, id);
  assert.strictEqual(updated.name, 'Doces');

  const listResponse = await app.inject({ method: 'GET', url: '/categories' });
  const names = listResponse.json().map((category) => category.name);
  assert.ok(names.includes('Doces'));
  assert.ok(!names.includes('Sobremesas'));

  await app.close();
});

test('PUT /categories/:id rejeita duplicidade e categoria inexistente', async () => {
  clearCategories();

  const app = await createApp({ logger: false });

  // Duplicidade: tentar renomear uma categoria copiando o nome de "Geral".
  const createResponse = await app.inject({
    method: 'POST',
    url: '/categories',
    payload: { name: 'Combos' },
  });
  const { id } = createResponse.json();

  const duplicateResponse = await app.inject({
    method: 'PUT',
    url: `/categories/${id}`,
    payload: { name: 'Geral' },
  });
  assert.strictEqual(duplicateResponse.statusCode, 409);

  // Categoria inexistente.
  const notFoundResponse = await app.inject({
    method: 'PUT',
    url: '/categories/9999',
    payload: { name: 'Nada a ver' },
  });
  assert.strictEqual(notFoundResponse.statusCode, 404);

  await app.close();
});

test('DELETE /categories/:id exclui e trata categoria inexistente', async () => {
  clearCategories();

  const app = await createApp({ logger: false });

  const createResponse = await app.inject({
    method: 'POST',
    url: '/categories',
    payload: { name: 'Temporária' },
  });
  const { id } = createResponse.json();

  const deleteResponse = await app.inject({ method: 'DELETE', url: `/categories/${id}` });
  assert.strictEqual(deleteResponse.statusCode, 200);

  const listResponse = await app.inject({ method: 'GET', url: '/categories' });
  const names = listResponse.json().map((category) => category.name);
  assert.ok(!names.includes('Temporária'));

  // Excluir de novo -> 404.
  const notFoundResponse = await app.inject({ method: 'DELETE', url: `/categories/${id}` });
  assert.strictEqual(notFoundResponse.statusCode, 404);

  await app.close();
});

test('DELETE de categoria com produtos vinculados é bloqueado', async () => {
  clearCategories();

  const db = getDatabase();
  // Idempotência: banco real persiste, então removemos qualquer leftover
  // deste teste antes de inserir e ao final.
  db.prepare('DELETE FROM products WHERE name = ?').run('Produto trava');
  const insertProduct = () =>
    db.prepare('INSERT INTO products (name, price, category_id) VALUES (?, ?, ?)')
      .run('Produto trava', 1000, 1);

  const app = await createApp({ logger: false });

  // Produto vinculado à categoria padrão Geral (id 1).
  insertProduct();

  const deleteResponse = await app.inject({ method: 'DELETE', url: '/categories/1' });
  assert.strictEqual(deleteResponse.statusCode, 400);
  assert.ok(deleteResponse.json().error.includes('produto'));

  // A categoria padrão continua existindo.
  const listResponse = await app.inject({ method: 'GET', url: '/categories' });
  assert.ok(listResponse.json().some((category) => category.id === 1));

  // app.close() agora dispara onClose -> closeDatabase(): reabrir o handle.
  await app.close();
  const freshDb = getDatabase();
  freshDb.prepare('DELETE FROM products WHERE name = ?').run('Produto trava');
});
