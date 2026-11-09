/**
 * tests/stock.test.js — Testes do Bloco 4 (Controle de Estoque).
 *
 *   PUT /products/:id/stock  — ajuste manual (valor absoluto, conferência).
 *   GET /products/low-stock  — produtos abaixo do ponto de reposição.
 *   Baixa automática em POST /orders e POST /orders/:id/items, com
 *   bloqueio (400) quando o estoque é insuficiente.
 *
 * Regra decidida com o fundador: estoque insuficiente BLOQUEIA a venda
 * (400) — nenhuma comanda/item é criado (transação via ROLLBACK).
 */
const { test, after } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/server');
const { getDatabase } = require('../src/database');

/** Limpeza na ordem das FKs (RESTRICT em order_items.product_id). */
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

/** Cria produto pela API (Geral id 1) e devolve a view completa. */
async function seedProductViaApi(app, name, price, stock = 0, minStock = 0) {
  const create = await app.inject({
    method: 'POST',
    url: '/products',
    payload: { name, price, categoryId: 1 },
  });
  assert.strictEqual(create.statusCode, 201, JSON.stringify(create.json()));
  const product = create.json();
  if (stock > 0 || minStock > 0) {
    const put = await app.inject({
      method: 'PUT',
      url: `/products/${product.id}/stock`,
      payload: { stock, minStock },
    });
    assert.strictEqual(put.statusCode, 200, JSON.stringify(put.json()));
    return put.json();
  }
  return product;
}

/** Cria mesa direto no banco. */
function seedTable(number) {
  const db = getDatabase();
  const result = db.prepare('INSERT INTO "tables" (number) VALUES (?)').run(number);
  return db.prepare('SELECT * FROM "tables" WHERE id = ?').get(result.lastInsertRowid);
}

/** Estoque atual do produto (leitura direta). */
function stockOf(productId) {
  return getDatabase()
    .prepare('SELECT stock, min_stock FROM products WHERE id = ?')
    .get(productId);
}

test('POST /products nasce com stock 0 e minStock 0 (aditivo na view)', async () => {
  clearAll();

  const app = await createApp({ logger: false });
  const product = await seedProductViaApi(app, 'Café Sem Estoque', 500);

  assert.strictEqual(product.stock, 0);
  assert.strictEqual(product.minStock, 0);
  // Campos legados presentes (view só cresce).
  assert.strictEqual(product.price, 500);
  assert.strictEqual(product.categoryName, 'Geral');

  const list = (await app.inject({ method: 'GET', url: '/products' })).json();
  assert.deepStrictEqual(list, [product]);

  await app.close();
});

test('PUT /products/:id/stock define valor ABSOLUTO e minStock opcional', async () => {
  clearAll();

  const app = await createApp({ logger: false });
  const product = await seedProductViaApi(app, 'Açaí Estoque', 1200);

  // Ajuste absoluto de contagem: 12 unidades e mínimo 5.
  const first = await app.inject({
    method: 'PUT',
    url: `/products/${product.id}/stock`,
    payload: { stock: 12, minStock: 5 },
  });
  assert.strictEqual(first.statusCode, 200);
  assert.strictEqual(first.json().stock, 12);
  assert.strictEqual(first.json().minStock, 5);

  // Segunda conferência: stock 10 SUBSTITUI 12 (não vira 22 — não é delta).
  const second = await app.inject({
    method: 'PUT',
    url: `/products/${product.id}/stock`,
    payload: { stock: 10 },
  });
  assert.strictEqual(second.json().stock, 10);
  assert.strictEqual(second.json().minStock, 5); // não tocado
  assert.strictEqual(stockOf(product.id).stock, 10);

  // Persistência em disco.
  assert.strictEqual(stockOf(product.id).min_stock, 5);

  await app.close();
});

test('PUT /products/:id/stock valida payload, produto e id (400/404)', async () => {
  clearAll();

  const app = await createApp({ logger: false });
  const product = await seedProductViaApi(app, 'Cerveja Estoque', 1500);

  const cases = [
    { id: product.id, payload: {}, why: 'corpo vazio' },
    { id: product.id, payload: { stock: -1 }, why: 'stock negativo' },
    { id: product.id, payload: { stock: 1.5 }, why: 'stock decimal' },
    { id: product.id, payload: { stock: '10' }, why: 'stock texto' },
    { id: product.id, payload: { minStock: -2 }, why: 'minStock negativo' },
    { id: 'abc', payload: { stock: 1 }, why: 'id não numérico' },
  ];
  for (const { id, payload, why } of cases) {
    const response = await app.inject({
      method: 'PUT',
      url: `/products/${id}/stock`,
      payload,
    });
    assert.strictEqual(response.statusCode, 400, `esperava 400 em: ${why}`);
    assert.ok(response.json().error);
  }

  // Produto inexistente (payload válido) → 404, e nada gravado.
  const missing = await app.inject({
    method: 'PUT',
    url: '/products/9999/stock',
    payload: { stock: 3 },
  });
  assert.strictEqual(missing.statusCode, 404);

  await app.close();
});

test('GET /products/low-stock lista abaixo do mínimo com missing e ordem por falta', async () => {
  clearAll();

  const app = await createApp({ logger: false });
  await seedProductViaApi(app, 'Refrigerante Baixo', 700, 2, 10); // falta 8
  await seedProductViaApi(app, 'Suco Crítico', 600, 1, 5); // falta 4
  await seedProductViaApi(app, 'Água Ok', 300, 50, 10); // acima
  await seedProductViaApi(app, 'Café Sem Mínimo', 500, 0, 0); // mínimo 0 nunca alerta

  const list = (await app.inject({ method: 'GET', url: '/products/low-stock' })).json();
  assert.strictEqual(list.length, 2);
  // Ordenado por quantidade faltante (maior primeiro): Refrigerante falta 8.
  assert.deepStrictEqual(list.map((row) => row.name), [
    'Refrigerante Baixo',
    'Suco Crítico',
  ]);
  assert.strictEqual(list[0].stock, 2);
  assert.strictEqual(list[0].minStock, 10);
  assert.strictEqual(list[0].missing, 8);
  assert.strictEqual(list[1].missing, 4);

  // Ajuste que cura: repor o Refrigerante o tira da lista.
  const healedPut = await app.inject({
    method: 'PUT',
    url: `/products/${list[0].id}/stock`,
    payload: { stock: 10 }, // stock = minStock → não falta
  });
  assert.strictEqual(healedPut.statusCode, 200);
  const healed = (await app.inject({ method: 'GET', url: '/products/low-stock' })).json();
  assert.deepStrictEqual(healed.map((row) => row.name), ['Suco Crítico']);

  await app.close();
});

test('POST /orders dá baixa no estoque (itens repetidos somam por produto)', async () => {
  clearAll();

  const app = await createApp({ logger: false });
  const product = await seedProductViaApi(app, 'Torta Estoque', 2500, 10, 0);
  const table = seedTable(41);

  const response = await app.inject({
    method: 'POST',
    url: '/orders',
    payload: {
      tableId: table.id,
      items: [
        { productId: product.id, quantity: 3 },
        { productId: product.id, quantity: 4 }, // mesmo produto: soma 7
      ],
    },
  });
  assert.strictEqual(response.statusCode, 201, JSON.stringify(response.json()));

  const current = stockOf(product.id);
  assert.strictEqual(current.stock, 3); // 10 - 7

  await app.close();
});

test('POST /orders bloqueia venda sem estoque (400) e não deixa comanda nem baixa parcial', async () => {
  clearAll();

  const app = await createApp({ logger: false });
  const product = await seedProductViaApi(app, 'Mousse Estoque', 1800, 2, 0);
  const table = seedTable(42);

  const response = await app.inject({
    method: 'POST',
    url: '/orders',
    payload: {
      tableId: table.id,
      items: [{ productId: product.id, quantity: 5 }],
    },
  });
  assert.strictEqual(response.statusCode, 400);
  assert.ok(response.json().error.includes('Estoque insuficiente'));
  assert.ok(response.json().error.includes('Mousse Estoque'));

  // Nada aconteceu: comanda não abriu, mesa não ocupou, estoque intacto.
  assert.strictEqual(stockOf(product.id).stock, 2);
  const tables = (await app.inject({ method: 'GET', url: '/tables' })).json();
  assert.strictEqual(tables.find((row) => row.id === table.id).status, 'free');

  // Edge exato: venda da quantidade exata é permitida e zera o estoque.
  const exact = await app.inject({
    method: 'POST',
    url: '/orders',
    payload: { tableId: table.id, items: [{ productId: product.id, quantity: 2 }] },
  });
  assert.strictEqual(exact.statusCode, 201);
  assert.strictEqual(stockOf(product.id).stock, 0);

  await app.close();
});

test('POST /orders/:id/items dá baixa e bloqueia insuficiente (400, item não inserido)', async () => {
  clearAll();

  const app = await createApp({ logger: false });
  const product = await seedProductViaApi(app, 'Pudim Estoque', 1400, 4, 0);
  const table = seedTable(43);

  const open = await app.inject({
    method: 'POST',
    url: '/orders',
    payload: { tableId: table.id, items: [{ productId: product.id, quantity: 1 }] },
  });
  assert.strictEqual(open.statusCode, 201);
  const orderId = open.json().id;

  // Baixa comum: +2 → 4 - 1 - 2 = 1.
  const add = await app.inject({
    method: 'POST',
    url: `/orders/${orderId}/items`,
    payload: { productId: product.id, quantity: 2 },
  });
  assert.strictEqual(add.statusCode, 201, JSON.stringify(add.json()));
  assert.strictEqual(stockOf(product.id).stock, 1);

  // Insuficiente: pede 3, há 1 → 400 e item não inserido (ROLLBACK).
  const blocked = await app.inject({
    method: 'POST',
    url: `/orders/${orderId}/items`,
    payload: { productId: product.id, quantity: 3 },
  });
  assert.strictEqual(blocked.statusCode, 400);
  assert.ok(blocked.json().error.includes('Estoque insuficiente'));

  const fetched = await app.inject({ method: 'GET', url: `/orders/${orderId}` });
  assert.strictEqual(fetched.json().items.length, 2); // só os dois itens baixados

  await app.close();
});

/** Higieniza o arquivo (FKs de outros testes usam RESTRICT). */
after(() => {
  clearAll();
});
