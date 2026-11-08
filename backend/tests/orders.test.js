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

/** Limpa mesas/comandas (payments, order_items, orders e tables) e zera contadores. */
function clearOrders() {
  const db = getDatabase();
  db.prepare('DELETE FROM "payments"').run();
  db.prepare('DELETE FROM "order_items"').run();
  db.prepare('DELETE FROM "orders"').run();
  db.prepare('DELETE FROM "tables"').run();
  for (const tableName of ['payments', 'order_items', 'orders', 'tables']) {
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
  assert.strictEqual(order.closedAt, null); // ainda aberta (Bloco 2)
  assert.strictEqual(order.payment, null); // ainda sem pagamento (Bloco 2)
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

test('POST /orders/:id/close fecha comanda e preserva itens e mesa', async () => {
  clearOrders();
  const cafe = seedCatalog();
  const table = seedTable(21);

  const app = await createApp({ logger: false });
  const created = await openOrder(app, {
    tableId: table.id,
    items: [{ productId: cafe.id, quantity: 2 }],
  });

  const closeResponse = await app.inject({ method: 'POST', url: `/orders/${created.id}/close` });
  assert.strictEqual(closeResponse.statusCode, 200);

  const closed = closeResponse.json();
  assert.strictEqual(closed.status, 'closed'); // AC-CLOSE-01
  assert.strictEqual(closed.total, created.total); // AC-CLOSE-02/07
  assert.deepStrictEqual(closed.items, created.items); // itens inalterados

  // Mesa continua occupied (AC-CLOSE-08) — fechar comanda não mexe na mesa.
  const tableResponse = await app.inject({ method: 'GET', url: '/tables' });
  const tableRow = tableResponse.json().find((t) => t.id === table.id);
  assert.strictEqual(tableRow.status, 'occupied');

  // GET após fechamento mantém status closed e itens (AC-CLOSE-09).
  const getResponse = await app.inject({ method: 'GET', url: `/orders/${created.id}` });
  assert.strictEqual(getResponse.statusCode, 200);
  assert.strictEqual(getResponse.json().status, 'closed');

  await app.close();
});

test('POST /orders/:id/close em comanda já fechada retorna 409', async () => {
  clearOrders();
  const cafe = seedCatalog();
  const table = seedTable(22);

  const app = await createApp({ logger: false });
  const created = await openOrder(app, {
    tableId: table.id,
    items: [{ productId: cafe.id, quantity: 1 }],
  });
  await app.inject({ method: 'POST', url: `/orders/${created.id}/close` });

  const second = await app.inject({ method: 'POST', url: `/orders/${created.id}/close` });
  assert.strictEqual(second.statusCode, 409); // AC-CLOSE-03

  // Registro continua fechado e intacto.
  const order = await app.inject({ method: 'GET', url: `/orders/${created.id}` });
  assert.strictEqual(order.json().status, 'closed');

  await app.close();
});

test('POST /orders/:id/close em comanda aberta sem itens retorna 409', async () => {
  clearOrders();
  const table = seedTable(23);

  // Comanda aberta criada direto no banco, sem itens (estado fora do fluxo
  // da API, mas possível em vida real — cobre AC-CLOSE-06).
  const db = getDatabase();
  const result = db.prepare('INSERT INTO "orders" (table_id) VALUES (?)').run(table.id);
  const orderId = Number(result.lastInsertRowid);

  const app = await createApp({ logger: false });

  const response = await app.inject({ method: 'POST', url: `/orders/${orderId}/close` });
  assert.strictEqual(response.statusCode, 409);

  // Permanece open.
  const order = await app.inject({ method: 'GET', url: `/orders/${orderId}` });
  assert.strictEqual(order.json().status, 'open');

  await app.close();
});

test('POST /orders/:id/close trata id inválido e comanda inexistente', async () => {
  clearOrders();

  const app = await createApp({ logger: false });

  const invalid = await app.inject({ method: 'POST', url: '/orders/abc/close' });
  assert.strictEqual(invalid.statusCode, 400); // AC-CLOSE-05

  const missing = await app.inject({ method: 'POST', url: '/orders/9999/close' });
  assert.strictEqual(missing.statusCode, 404); // AC-CLOSE-04

  await app.close();
});

test('Fluxo completo: abrir → fechar comanda → fechar mesa → liberar', async () => {
  clearOrders();
  const cafe = seedCatalog();
  const table = seedTable(24);

  const app = await createApp({ logger: false });
  const order = await openOrder(app, {
    tableId: table.id,
    items: [{ productId: cafe.id, quantity: 1 }],
  });

  // AC-FLOW-02: fechar a mesa antes da comanda → 409, mesa permanece occupied.
  const premature = await app.inject({
    method: 'PUT',
    url: `/tables/${table.id}/status`,
    payload: { status: 'closed' },
  });
  assert.strictEqual(premature.statusCode, 409);
  const stillOccupied = await app.inject({ method: 'GET', url: '/tables' });
  assert.strictEqual(
    stillOccupied.json().find((t) => t.id === table.id).status,
    'occupied',
  );

  // Encerrar comanda → mesa fecha → mesa liberada.
  await app.inject({ method: 'POST', url: `/orders/${order.id}/close` });

  await app.inject({
    method: 'PUT',
    url: `/tables/${table.id}/status`,
    payload: { status: 'closed' },
  });
  await app.inject({
    method: 'PUT',
    url: `/tables/${table.id}/status`,
    payload: { status: 'free' },
  });

  const finalTable = await app.inject({ method: 'GET', url: '/tables' });
  assert.strictEqual(
    finalTable.json().find((t) => t.id === table.id).status,
    'free', // AC-FLOW-01
  );

  // Comanda fechada segue consultável com itens e total (AC-FLOW-03).
  const finalOrder = await app.inject({ method: 'GET', url: `/orders/${order.id}` });
  assert.strictEqual(finalOrder.json().status, 'closed');
  assert.strictEqual(finalOrder.json().items.length, 1);

  await app.close();
});


test('POST /orders/:id/items adiciona item com snapshot de preço', async () => {
  clearOrders();
  seedCatalog();
  const db = getDatabase();
  const cafe = db.prepare('SELECT id, price FROM products WHERE name = ?').get('Café Comanda');
  const suco = db.prepare('SELECT id, price FROM products WHERE name = ?').get('Suco Comanda');
  const table = seedTable(41);

  const app = await createApp({ logger: false });
  const created = await openOrder(app, {
    tableId: table.id,
    items: [{ productId: cafe.id, quantity: 1 }],
  });

  const addResponse = await app.inject({
    method: 'POST',
    url: `/orders/${created.id}/items`,
    payload: { productId: suco.id, quantity: 2, notes: 'Com gelo' },
  });
  assert.strictEqual(addResponse.statusCode, 201);

  const updated = addResponse.json();
  assert.strictEqual(updated.id, created.id);
  assert.strictEqual(updated.items.length, 2); // AC: segunda linha independente
  const added = updated.items[1];
  assert.strictEqual(added.productId, suco.id);
  assert.strictEqual(added.quantity, 2);
  assert.strictEqual(added.unitPrice, 800); // preço do cadastro, não do cliente
  assert.strictEqual(normalizeNbsp(added.unitPriceFormatted), 'R$ 8,00');
  assert.strictEqual(added.notes, 'Com gelo');
  assert.strictEqual(added.subtotal, 1600); // 2 * 800
  assert.strictEqual(updated.total, created.total + 1600);
  assert.strictEqual(normalizeNbsp(updated.totalFormatted), 'R$ 61,00');

  // GET devolve o mesmo contrato.
  const getResponse = await app.inject({ method: 'GET', url: `/orders/${created.id}` });
  assert.deepStrictEqual(getResponse.json(), updated);

  // Payload inválido de item único (quantity fora da faixa).
  const invalidQuantity = await app.inject({
    method: 'POST',
    url: `/orders/${created.id}/items`,
    payload: { productId: cafe.id, quantity: 1000 },
  });
  assert.strictEqual(invalidQuantity.statusCode, 400);

  await app.close();
});

test('POST /orders/:id/items rejeita comanda fechada e produto inexistente', async () => {
  clearOrders();
  seedCatalog();
  const db = getDatabase();
  const cafe = db.prepare('SELECT id, price FROM products WHERE name = ?').get('Café Comanda');
  const table = seedTable(42);

  const app = await createApp({ logger: false });
  const created = await openOrder(app, {
    tableId: table.id,
    items: [{ productId: cafe.id, quantity: 1 }],
  });

  // Fecha a comanda primeiro.
  await app.inject({ method: 'POST', url: `/orders/${created.id}/close` });

  const closedAttempt = await app.inject({
    method: 'POST',
    url: `/orders/${created.id}/items`,
    payload: { productId: cafe.id, quantity: 1 },
  });
  assert.strictEqual(closedAttempt.statusCode, 409);
  assert.ok(closedAttempt.json().error.includes('fechada'));

  // Comanda permanece fechada e intacta (nenhum item novo).
  const closedOrder = await app.inject({ method: 'GET', url: `/orders/${created.id}` });
  assert.strictEqual(closedOrder.json().status, 'closed');
  assert.strictEqual(closedOrder.json().items.length, 1);

  // Comanda aberta + produto inexistente → 400 e comanda intacta.
  const freeTable = seedTable(43);
  const extraOrder = await openOrder(app, {
    tableId: freeTable.id,
    items: [{ productId: cafe.id, quantity: 1 }],
  });

  const missingProduct = await app.inject({
    method: 'POST',
    url: `/orders/${extraOrder.id}/items`,
    payload: { productId: 9999, quantity: 1 },
  });
  assert.strictEqual(missingProduct.statusCode, 400);
  const afterMissing = await app.inject({ method: 'GET', url: `/orders/${extraOrder.id}` });
  assert.strictEqual(afterMissing.json().items.length, 1);

  await app.close();
});

test('POST /orders/:id/items trata comanda inexistente e id inválido', async () => {
  clearOrders();
  seedCatalog();

  const app = await createApp({ logger: false });

  const missing = await app.inject({
    method: 'POST',
    url: '/orders/9999/items',
    payload: { productId: 1, quantity: 1 },
  });
  assert.strictEqual(missing.statusCode, 404);

  const invalidId = await app.inject({
    method: 'POST',
    url: '/orders/abc/items',
    payload: { productId: 1, quantity: 1 },
  });
  assert.strictEqual(invalidId.statusCode, 400);

  const missingProduct = await app.inject({
    method: 'POST',
    url: '/orders/0/items',
    payload: { productId: 1, quantity: 1 },
  });
  assert.strictEqual(missingProduct.statusCode, 400);

  await app.close();
});

test('POST /orders/:id/close com paymentMethod registra pagamento e closed_at', async () => {
  clearOrders();
  const cafe = seedCatalog();
  const table = seedTable(25); // café ×2 = R$ 90,00 (9000 centavos)

  const app = await createApp({ logger: false });
  const created = await openOrder(app, {
    tableId: table.id,
    items: [{ productId: cafe.id, quantity: 2 }],
  });

  const closeResponse = await app.inject({
    method: 'POST',
    url: `/orders/${created.id}/close`,
    payload: { paymentMethod: 'cartao' },
  });
  assert.strictEqual(closeResponse.statusCode, 200);

  const closed = closeResponse.json();
  assert.strictEqual(closed.status, 'closed');
  assert.ok(typeof closed.closedAt === 'string' && closed.closedAt.length > 0); // Bloco 2
  assert.ok(closed.payment, 'resposta do fechamento deveria trazer payment');
  assert.strictEqual(closed.payment.method, 'cartao');
  assert.strictEqual(closed.payment.methodLabel, 'Cartão'); // Bloco 2.1 (contrato QA)
  assert.strictEqual(closed.payment.amount, 9000); // snapshot do total, em centavos
  assert.strictEqual(normalizeNbsp(closed.payment.amountFormatted), 'R$ 90,00');
  assert.ok(typeof closed.payment.createdAt === 'string');
  assert.strictEqual(closed.payment.orderId, created.id);

  // Persistência: exatamente um pagamento, valor = soma dos itens
  // (comparações campo a campo: linhas do node:sqlite têm prototype próprio).
  const db = getDatabase();
  const paymentRows = db.prepare('SELECT order_id, method, amount FROM "payments"').all();
  assert.strictEqual(paymentRows.length, 1);
  assert.strictEqual(paymentRows[0].order_id, created.id);
  assert.strictEqual(paymentRows[0].method, 'cartao');
  assert.strictEqual(paymentRows[0].amount, 9000);

  // Fechamento duplo: 409 e nenhum pagamento extra (índice único).
  const second = await app.inject({
    method: 'POST',
    url: `/orders/${created.id}/close`,
    payload: { paymentMethod: 'pix' },
  });
  assert.strictEqual(second.statusCode, 409);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS total FROM "payments"').get().total, 1);

  // GET mostra a comanda fechada com o mesmo closedAt e o pagamento
  // (contrato do QA Bloco 2.1: payment e methodLabel presentes no GET).
  const getResponse = await app.inject({ method: 'GET', url: `/orders/${created.id}` });
  const fetched = getResponse.json();
  assert.strictEqual(fetched.status, 'closed');
  assert.strictEqual(fetched.closedAt, closed.closedAt);
  assert.strictEqual(fetched.payment.method, 'cartao');
  assert.strictEqual(fetched.payment.methodLabel, 'Cartão');
  assert.strictEqual(fetched.payment.amount, 9000);
  await app.close();
});

test('POST /orders/:id/close sem corpo continua funcionando (legado, sem pagamento)', async () => {
  clearOrders();
  const cafe = seedCatalog();
  const table = seedTable(26);

  const app = await createApp({ logger: false });
  const created = await openOrder(app, {
    tableId: table.id,
    items: [{ productId: cafe.id, quantity: 1 }],
  });

  const response = await app.inject({ method: 'POST', url: `/orders/${created.id}/close` });
  assert.strictEqual(response.statusCode, 200);

  const closed = response.json();
  assert.strictEqual(closed.status, 'closed');
  assert.ok(typeof closed.closedAt === 'string'); // closed_at grava nos dois fluxos
  assert.strictEqual(closed.payment, null); // fluxo legado: payment explícito e nulo

  const db = getDatabase();
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS total FROM "payments"').get().total, 0);

  // GET também expõe payment nulo na comanda legada.
  const fetched = await app.inject({ method: 'GET', url: `/orders/${created.id}` });
  assert.strictEqual(fetched.json().payment, null);

  await app.close();
});

test('POST /orders/:id/close rejeita paymentMethod inválido e comanda permanece aberta', async () => {
  clearOrders();
  const cafe = seedCatalog();
  const table = seedTable(27);

  const app = await createApp({ logger: false });
  const created = await openOrder(app, {
    tableId: table.id,
    items: [{ productId: cafe.id, quantity: 1 }],
  });

  // paymentMethod presente e inválido → 400. (null/ausente = fechamento
  // legado sem pagamento, caso coberto pelo teste anterior.)
  for (const paymentMethod of ['credito', 'BILL', '', 123]) {
    const response = await app.inject({
      method: 'POST',
      url: `/orders/${created.id}/close`,
      payload: { paymentMethod },
    });
    assert.strictEqual(response.statusCode, 400, `esperava 400 para paymentMethod=${paymentMethod}`);
    assert.ok(response.json().error);
  }

  // Nenhum pagamento gravado e comanda segue aberta (nada parcial).
  const db = getDatabase();
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS total FROM "payments"').get().total, 0);
  const order = await app.inject({ method: 'GET', url: `/orders/${created.id}` });
  assert.strictEqual(order.json().status, 'open');

  await app.close();
});

/** Higieniza o banco após o arquivo: order_items órfãs quebrariam o
 * DELETE FROM products (FK RESTRICT) nos outros arquivos de teste. */
after(() => {
  clearOrders();
});
