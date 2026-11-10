/**
 * tests/cash.test.js — Testes do Bloco 6 (Gestão de Caixa).
 *
 *   POST /cash/shifts/open    — um turno aberto por vez (409 em duplicado).
 *   GET  /cash/shifts/current — saldo em tempo real (404 sem turno).
 *   POST /cash/transactions   — suprimento/sangria no turno aberto.
 *   POST /cash/shifts/close   — cálculo do esperado e do desvio.
 *   Integração: comanda paga em DINHEIRO com turno aberto entra como 'sale'
 *   na mesma transação do pagamento; sem turno aberto, a venda prossegue
 *   sem lançamento (decisão documentada no backend/README.md).
 */
const { test, after } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/server');
const { getDatabase } = require('../src/database');

/** O Intl.NumberFormat usa NBSP; normalizamos para comparar moeda. */
function normalizeNbsp(text) {
  return text.replace(/\u00A0/g, ' ');
}

/** Limpeza na ordem das FKs (cash_transactions → orders/cash_shifts). */
function clearAll() {
  const db = getDatabase();
  db.prepare('DELETE FROM cash_transactions').run();
  db.prepare('DELETE FROM cash_shifts').run();
  db.prepare('DELETE FROM "payments"').run();
  db.prepare('DELETE FROM "order_items"').run();
  db.prepare('DELETE FROM "orders"').run();
  db.prepare('DELETE FROM "tables"').run();
  db.prepare('DELETE FROM products').run();
  for (const tableName of [
    'cash_transactions', 'cash_shifts', 'payments',
    'order_items', 'orders', 'tables', 'products',
  ]) {
    db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(tableName);
  }
}

function seedTable(number) {
  const db = getDatabase();
  const result = db.prepare('INSERT INTO "tables" (number) VALUES (?)').run(number);
  return db.prepare('SELECT id FROM "tables" WHERE id = ?').get(result.lastInsertRowid).id;
}

/** Produto com estoque alto (a baixa do Bloco 4 não bloqueia). */
function seedProduct(name, price) {
  const db = getDatabase();
  db.prepare('INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)').run(1, 'Geral');
  db.prepare('INSERT INTO products (name, price, category_id) VALUES (?, ?, ?)')
    .run(name, price, 1);
  const id = db.prepare('SELECT id FROM products WHERE name = ?').get(name).id;
  db.prepare('UPDATE products SET stock = 9999 WHERE id = ?').run(id);
  return id;
}

async function openOrder(app, tableId, productId, quantity) {
  const response = await app.inject({
    method: 'POST', url: '/orders',
    payload: { tableId, items: [{ productId, quantity }] },
  });
  assert.strictEqual(response.statusCode, 201, JSON.stringify(response.json()));
  return response.json();
}

async function closeOrder(app, orderId, paymentMethod) {
  const response = await app.inject({
    method: 'POST', url: `/orders/${orderId}/close`,
    payload: paymentMethod ? { paymentMethod } : undefined,
  });
  assert.strictEqual(response.statusCode, 200, JSON.stringify(response.json()));
  return response.json();
}

async function openShift(app, operator = 'Operador Caixa', openingAmount = 0) {
  const response = await app.inject({
    method: 'POST', url: '/cash/shifts/open',
    payload: { operator, openingAmount },
  });
  assert.strictEqual(response.statusCode, 201, JSON.stringify(response.json()));
  return response.json();
}

test('POST /cash/shifts/open valida payload e vira 409 em turno duplicado', async () => {
  clearAll();

  const app = await createApp({ logger: false });

  const cases = [
    { payload: {}, why: 'operator ausente' },
    { payload: { operator: 'A' }, why: 'operator curto' },
    { payload: { operator: 'x'.repeat(81) }, why: 'operator longo' },
    { payload: { operator: 'Bruno Caixa', openingAmount: -1 }, why: 'fundo negativo' },
    { payload: { operator: 'Bruno Caixa', openingAmount: 1.5 }, why: 'fundo decimal' },
  ];
  for (const { payload, why } of cases) {
    const response = await app.inject({
      method: 'POST', url: '/cash/shifts/open', payload,
    });
    assert.strictEqual(response.statusCode, 400, `esperava 400 em: ${why}`);
    assert.ok(response.json().error);
  }

  // Abre com fundo de troco R$ 50,00.
  const shift = await openShift(app, 'Bruno Caixa', 5000);
  assert.strictEqual(shift.operator, 'Bruno Caixa');
  assert.strictEqual(shift.openingAmount, 5000);
  assert.strictEqual(normalizeNbsp(shift.openingAmountFormatted), 'R$ 50,00');
  assert.strictEqual(shift.status, 'open');
  assert.strictEqual(shift.closedAt, null);
  assert.strictEqual(shift.balance.expectedCash, 5000);
  assert.strictEqual(shift.balance.cashSales, 0);

  // Segunda abertura → 409 (apenas um turno aberto).
  const duplicate = await app.inject({
    method: 'POST', url: '/cash/shifts/open', payload: { operator: 'Outro Operador' },
  });
  assert.strictEqual(duplicate.statusCode, 409);
  assert.ok(duplicate.json().error.includes('turno'));

  await app.close();
});

test('GET /cash/shifts/current: 404 sem turno e saldo em tempo real com lançamentos', async () => {
  clearAll();

  const app = await createApp({ logger: false });

  const none = await app.inject({ method: 'GET', url: '/cash/shifts/current' });
  assert.strictEqual(none.statusCode, 404);

  await openShift(app, 'Maria Caixa', 20000); // fundo R$ 200,00

  // Suprimento R$ 50,00 e sangria R$ 30,00 → esperado 200 + 50 - 30 = 220.
  const cashIn = await app.inject({
    method: 'POST', url: '/cash/transactions',
    payload: { type: 'cash_in', amount: 5000, note: 'Troco extra' },
  });
  assert.strictEqual(cashIn.statusCode, 201, JSON.stringify(cashIn.json()));
  assert.strictEqual(cashIn.json().shiftId, 1);
  assert.strictEqual(cashIn.json().typeLabel, 'Suprimento');
  assert.strictEqual(normalizeNbsp(cashIn.json().amountFormatted), 'R$ 50,00');

  const cashOut = await app.inject({
    method: 'POST', url: '/cash/transactions',
    payload: { type: 'cash_out', amount: 3000, note: 'Fornecedor' },
  });
  assert.strictEqual(cashOut.statusCode, 201);
  assert.strictEqual(cashOut.json().typeLabel, 'Sangria');

  const current = (await app.inject({ method: 'GET', url: '/cash/shifts/current' })).json();
  assert.strictEqual(current.operator, 'Maria Caixa');
  assert.strictEqual(current.balance.opening === undefined, true);
  assert.strictEqual(current.balance.cashIn, 5000);
  assert.strictEqual(current.balance.cashOut, 3000);
  assert.strictEqual(current.balance.cashSales, 0);
  assert.strictEqual(current.balance.expectedCash, 22000);
  assert.strictEqual(normalizeNbsp(current.balance.expectedCashFormatted), 'R$ 220,00');

  await app.close();
});

test('POST /cash/transactions valida tipo/valor, exige turno e trava sangria maior que a gaveta', async () => {
  clearAll();

  const app = await createApp({ logger: false });

  // Sem turno aberto → 409.
  const noShift = await app.inject({
    method: 'POST', url: '/cash/transactions',
    payload: { type: 'cash_in', amount: 100 },
  });
  assert.strictEqual(noShift.statusCode, 409);

  await openShift(app);

  const cases = [
    { payload: { type: 'sale', amount: 100 }, why: 'venda manual não é permitida' },
    { payload: { type: 'transferencia', amount: 100 }, why: 'tipo inválido' },
    { payload: { type: 'cash_out', amount: 0 }, why: 'valor zero' },
    { payload: { type: 'cash_out', amount: -5 }, why: 'valor negativo' },
    { payload: { type: 'cash_out', amount: 2.5 }, why: 'valor decimal' },
    { payload: { type: 'cash_in', amount: 100, note: 42 }, why: 'note não texto' },
  ];
  for (const { payload, why } of cases) {
    const response = await app.inject({
      method: 'POST', url: '/cash/transactions', payload,
    });
    assert.strictEqual(response.statusCode, 400, `esperava 400 em: ${why}`);
    assert.ok(response.json().error);
  }

  // Sangria maior que a gaveta (fundo 0) → 400, nada lançado.
  const tooBigOut = await app.inject({
    method: 'POST', url: '/cash/transactions',
    payload: { type: 'cash_out', amount: 100 },
  });
  assert.strictEqual(tooBigOut.statusCode, 400);
  const db = getDatabase();
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS total FROM cash_transactions').get().total, 0);

  await app.close();
});

test('Fechamento calcula esperado: fundo + vendas em dinheiro + suprimentos - sangrias', async () => {
  clearAll();
  const bolinho = seedProduct('Bolinho Caixa', 1000); // R$ 10,00
  const suco = seedProduct('Suco Caixa', 500);

  const app = await createApp({ logger: false });
  const table = seedTable(71);

  // Turno aberto com fundo R$ 100,00.
  await openShift(app, 'Operador Fechamento', 10000);

  // Comanda 1: dinheiro → entra no caixa (R$ 20,00).
  const cashOrder = await openOrder(app, table, bolinho, 2);
  await closeOrder(app, cashOrder.id, 'dinheiro');

  // Comanda 2: pix NÃO entra no caixa.
  const pixOrder = await openOrder(app, table, suco, 4); // R$ 20,00 pix
  await closeOrder(app, pixOrder.id, 'pix');

  // Movimentações manuais: +10, -3 → esperado 100 + 20 + 10 - 3 = 127,00.
  await app.inject({
    method: 'POST', url: '/cash/transactions',
    payload: { type: 'cash_in', amount: 1000 },
  });
  await app.inject({
    method: 'POST', url: '/cash/transactions',
    payload: { type: 'cash_out', amount: 300 },
  });

  // Fechamento com contagem divergente: contou R$ 120,00 → desvio -7,00.
  const close = await app.inject({
    method: 'POST', url: '/cash/shifts/close',
    payload: { countedAmount: 12000 },
  });
  assert.strictEqual(close.statusCode, 200, JSON.stringify(close.json()));

  const closed = close.json();
  assert.strictEqual(closed.status, 'closed');
  assert.ok(closed.closedAt);
  assert.strictEqual(closed.countedAmount, 12000);
  assert.strictEqual(closed.balance.cashSales, 2000);
  assert.strictEqual(closed.balance.cashSalesCount, 1);
  assert.strictEqual(closed.balance.expectedCash, 12700);
  assert.strictEqual(normalizeNbsp(closed.balance.expectedCashFormatted), 'R$ 127,00');
  assert.strictEqual(closed.variance, -700); // 120 - 127
  assert.strictEqual(normalizeNbsp(closed.varianceFormatted), '-R$ 7,00');

  // Persistência: turno fechado com contagem e carimbo.
  const row = getDatabase()
    .prepare('SELECT status, closed_at, counted_amount FROM cash_shifts')
    .get();
  assert.strictEqual(row.status, 'closed');
  assert.strictEqual(row.counted_amount, 12000);
  assert.strictEqual(row.closed_at, closed.closedAt);

  // Turno encerrado: fechar de novo → 409; abrir novo turno → permitido.
  const reclose = await app.inject({ method: 'POST', url: '/cash/shifts/close', payload: {} });
  assert.strictEqual(reclose.statusCode, 409);
  const reopen = await openShift(app, 'Turno Seguinte');
  assert.strictEqual(reopen.balance.expectedCash, 0); // turno novo começa do zero

  await app.close();
});

test('Venda em dinheiro sem turno aberto: pagamento prossegue sem lançamento no caixa', async () => {
  clearAll();
  const pastel = seedProduct('Pastel Sem Turno', 900);

  const app = await createApp({ logger: false });
  const table = seedTable(72);

  // Nenhum turno aberto: pagamento em dinheiro segue normal (decisão).
  const order = await openOrder(app, table, pastel, 1);
  const closed = await closeOrder(app, order.id, 'dinheiro');
  assert.strictEqual(closed.payment.amount, 900);

  // Abre turno agora: ele NÃO herda a venda anterior (sem 'sale' pendente).
  const shift = await openShift(app, 'Operador Tarde');
  assert.strictEqual(shift.balance.cashSales, 0);
  assert.strictEqual(shift.balance.cashSalesCount, 0);

  // Uma venda no turno novo é computada no caixa.
  const order2 = await openOrder(app, table, pastel, 2); // R$ 18,00 dinheiro
  await closeOrder(app, order2.id, 'dinheiro');
  const current = (await app.inject({ method: 'GET', url: '/cash/shifts/current' })).json();
  assert.strictEqual(current.balance.cashSales, 1800);
  assert.strictEqual(current.balance.cashSalesCount, 1);
  assert.strictEqual(current.balance.expectedCash, 1800);

  await app.close();
});

/** Higieniza o arquivo (FKs RESTRICT nos outros). */
after(() => {
  clearAll();
});
