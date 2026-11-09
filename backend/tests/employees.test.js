/**
 * tests/employees.test.js — Testes do Bloco 3 (Gestão de Garçons).
 *
 *   POST /employees, GET /employees, PUT /employees/:id
 *   PUT /tables/:id/employee (atribuição de garçom à mesa)
 *
 * O banco real é usado; employees, tables, orders, payments e itens são
 * limpos antes de cada teste (e a higienização de products só porque
 * este arquivo também semeia produtos para cenários de comanda).
 */
const { test, after } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/server');
const { getDatabase } = require('../src/database');

/** Limpa o ciclo de mesas/garçons (ordem respeita as FKs). */
function clearAll() {
  const db = getDatabase();
  db.prepare('DELETE FROM "payments"').run();
  db.prepare('DELETE FROM "order_items"').run();
  db.prepare('DELETE FROM "orders"').run();
  db.prepare('DELETE FROM "tables"').run();
  db.prepare('DELETE FROM "employees"').run();
  for (const tableName of ['payments', 'order_items', 'orders', 'tables', 'employees']) {
    db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(tableName);
  }
}

/** Seed de mesa direto no banco. */
function seedTable(number) {
  const db = getDatabase();
  const result = db.prepare('INSERT INTO "tables" (number) VALUES (?)').run(number);
  return db.prepare('SELECT * FROM "tables" WHERE id = ?').get(result.lastInsertRowid);
}

/** Cria um produto de apoio (cenários de comanda com itens). */
function seedProduct(name, price) {
  const db = getDatabase();
  db.prepare('INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)').run(1, 'Geral');
  db.prepare(
    'INSERT INTO products (name, price, category_id) VALUES (?, ?, ?) ' +
    'ON CONFLICT (category_id, name) DO NOTHING',
  ).run(name, price, 1);
  return db.prepare('SELECT id, price FROM products WHERE name = ?').get(name);
}

async function createEmployee(app, payload) {
  const response = await app.inject({ method: 'POST', url: '/employees', payload });
  assert.strictEqual(response.statusCode, 201, JSON.stringify(response.json()));
  return response.json();
}

async function assignEmployee(app, tableId, employeeId) {
  return app.inject({
    method: 'PUT',
    url: `/tables/${tableId}/employee`,
    payload: { employeeId },
  });
}

/** Abre comanda com item obrigatório (falha o teste em erro). */
async function openOrder(app, tableId, productId) {
  const response = await app.inject({
    method: 'POST',
    url: '/orders',
    payload: { tableId, items: [{ productId, quantity: 1 }] },
  });
  assert.strictEqual(response.statusCode, 201, JSON.stringify(response.json()));
  return response.json();
}

test('POST /employees cria funcionário com padrões e GET lista ordenado', async () => {
  clearAll();

  const app = await createApp({ logger: false });

  const created = await createEmployee(app, { name: 'Maria Aparecida', commissionBps: 1000 });
  assert.strictEqual(created.name, 'Maria Aparecida');
  assert.strictEqual(created.commissionBps, 1000); // 10%
  assert.strictEqual(created.active, true);
  assert.strictEqual(typeof created.id, 'number');
  assert.strictEqual(typeof created.createdAt, 'string');

  // Padrões: comissão 0 e ativo.
  const plain = await createEmployee(app, { name: 'Bruno Costa' });
  assert.strictEqual(plain.commissionBps, 0);
  assert.strictEqual(plain.active, true);

  const list = (await app.inject({ method: 'GET', url: '/employees' })).json();
  assert.strictEqual(list.length, 2);
  assert.deepStrictEqual(list.map((employee) => employee.name), [
    'Bruno Costa', // ordenado por nome
    'Maria Aparecida',
  ]);

  await app.close();
});

test('POST /employees valida payload e nome duplicado (400/409)', async () => {
  clearAll();

  const app = await createApp({ logger: false });

  const cases = [
    { payload: {}, why: 'name ausente' },
    { payload: { name: 'A' }, why: 'nome curto' },
    { payload: { name: 'x'.repeat(81) }, why: 'nome longo' },
    { payload: { name: 'Carlos Lima', commissionBps: -1 }, why: 'commissionBps negativo' },
    { payload: { name: 'Carlos Lima', commissionBps: 10001 }, why: 'commissionBps acima de 100%' },
    { payload: { name: 'Carlos Lima', commissionBps: 1.5 }, why: 'commissionBps decimal' },
    { payload: { name: 'Carlos Lima', active: 'sim' }, why: 'active não boleano' },
  ];
  for (const { payload, why } of cases) {
    const response = await app.inject({ method: 'POST', url: '/employees', payload });
    assert.strictEqual(response.statusCode, 400, `esperava 400 em: ${why}`);
    assert.ok(response.json().error);
  }

  await createEmployee(app, { name: 'Carlos Lima' });
  const duplicateExact = await app.inject({
    method: 'POST',
    url: '/employees',
    payload: { name: 'Carlos Lima' },
  });
  assert.strictEqual(duplicateExact.statusCode, 409);
  const duplicateCase = await app.inject({
    method: 'POST',
    url: '/employees',
    payload: { name: 'carlos lima' }, // case-insensitive
  });
  assert.strictEqual(duplicateCase.statusCode, 409);

  const db = getDatabase();
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS total FROM employees').get().total, 1);

  await app.close();
});

test('PUT /employees/:id atualiza campos parcialmente (incl. desativar)', async () => {
  clearAll();

  const app = await createApp({ logger: false });
  const employee = await createEmployee(app, { name: 'Diego Souza', commissionBps: 500 });

  // Comissão ajustada para 10%.
  const commissionUpdate = await app.inject({
    method: 'PUT',
    url: `/employees/${employee.id}`,
    payload: { commissionBps: 1000 },
  });
  assert.strictEqual(commissionUpdate.statusCode, 200);
  assert.strictEqual(commissionUpdate.json().commissionBps, 1000);
  assert.strictEqual(commissionUpdate.json().name, 'Diego Souza'); // não tocado

  // Desativação preserva o registro e o histórico (não há DELETE).
  const deactivate = await app.inject({
    method: 'PUT',
    url: `/employees/${employee.id}`,
    payload: { active: false },
  });
  assert.strictEqual(deactivate.statusCode, 200);
  assert.strictEqual(deactivate.json().active, false);
  assert.strictEqual(deactivate.json().commissionBps, 1000);

  // Reativação e renomeação.
  const rename = await app.inject({
    method: 'PUT',
    url: `/employees/${employee.id}`,
    payload: { active: true, name: 'Diego S. Souza' },
  });
  assert.strictEqual(rename.json().name, 'Diego S. Souza');
  assert.strictEqual(rename.json().active, true);

  // Erros: id inexistente/inválido, campos inválidos e corpo vazio.
  const missing = await app.inject({
    method: 'PUT',
    url: `/employees/9999`,
    payload: { name: 'Alguém Novo' },
  });
  assert.strictEqual(missing.statusCode, 404);

  const invalid = await app.inject({
    method: 'PUT',
    url: '/employees/abc',
    payload: { name: 'Alguém Novo' },
  });
  assert.strictEqual(invalid.statusCode, 400);

  const noFields = await app.inject({ method: 'PUT', url: `/employees/${employee.id}`, payload: {} });
  assert.strictEqual(noFields.statusCode, 400);

  const badActive = await app.inject({
    method: 'PUT',
    url: `/employees/${employee.id}`,
    payload: { active: 1 },
  });
  assert.strictEqual(badActive.statusCode, 400);

  // Renomeação para nome existente → 409.
  await createEmployee(app, { name: 'Elaine Prado' });
  const renameDuplicate = await app.inject({
    method: 'PUT',
    url: `/employees/${employee.id}`,
    payload: { name: 'elaine prado' },
  });
  assert.strictEqual(renameDuplicate.statusCode, 409);

  await app.close();
});

test('PUT /tables/:id/employee atribui, reatribui e remove garçom', async () => {
  clearAll();

  const app = await createApp({ logger: false });
  const maria = await createEmployee(app, { name: 'Maria Funcionária' });
  const bruno = await createEmployee(app, { name: 'Bruno Funcionário' });
  const table = seedTable(81);

  // Atribuição inicial.
  const assign = await assignEmployee(app, table.id, maria.id);
  assert.strictEqual(assign.statusCode, 200);
  assert.strictEqual(assign.json().employeeId, maria.id);
  assert.strictEqual(assign.json().employeeName, 'Maria Funcionária');

  // Reatribuição (outro garçom assume a mesa).
  const reassign = await assignEmployee(app, table.id, bruno.id);
  assert.strictEqual(reassign.json().employeeId, bruno.id);

  // Remover a atribuição (null) deixa a mesa sem garçom.
  const unassign = await assignEmployee(app, table.id, null);
  assert.strictEqual(unassign.statusCode, 200);
  assert.strictEqual(unassign.json().employeeId, null);
  assert.strictEqual(unassign.json().employeeName, null);

  // GET /tables reflete o estado persistido.
  const list = (await app.inject({ method: 'GET', url: '/tables' })).json();
  assert.strictEqual(list[0].employeeId, null);

  await app.close();
});

test('PUT /tables/:id/employee valida mesa, funcionário e atividade', async () => {
  clearAll();

  const app = await createApp({ logger: false });
  const inactive = await createEmployee(app, { name: 'Inativo Silva', active: false });
  const table = seedTable(82);

  // Funcionário inexistente → 404; inativo → 400; mesa inexistente → 404.
  const missingEmployee = await assignEmployee(app, table.id, 9999);
  assert.strictEqual(missingEmployee.statusCode, 404);

  const inactiveEmployee = await assignEmployee(app, table.id, inactive.id);
  assert.strictEqual(inactiveEmployee.statusCode, 400);
  assert.ok(inactiveEmployee.json().error.includes('inativo'));

  // Mesa inexistente (mesmo com payload válido).
  const activeEmployee = await createEmployee(app, { name: 'Ativo Nome' });
  const missingTable = await app.inject({
    method: 'PUT',
    url: '/tables/9999/employee',
    payload: { employeeId: activeEmployee.id },
  });
  assert.strictEqual(missingTable.statusCode, 404);

  const db = getDatabase();

  // Corpo inválido: sem employeeId, id não inteiro, negativo.
  const noField = await app.inject({
    method: 'PUT',
    url: `/tables/${table.id}/employee`,
    payload: {},
  });
  assert.strictEqual(noField.statusCode, 400);

  const garbage = await app.inject({
    method: 'PUT',
    url: `/tables/${table.id}/employee`,
    payload: { employeeId: 'abc' },
  });
  assert.strictEqual(garbage.statusCode, 400);

  const negative = await injectNegative(app, table.id);
  assert.strictEqual(negative.statusCode, 400);

  // Nada foi atribuído: mesa segue sem employee_id (sem efeitos parciais).
  const tableRow = db.prepare('SELECT employee_id FROM "tables" WHERE id = ?').get(table.id);
  assert.strictEqual(tableRow.employee_id, null);

  await app.close();
});

/** Atalho para o caso employeeId negativo (mantido pequeno). */
async function injectNegative(app, tableId) {
  return app.inject({
    method: 'PUT',
    url: `/tables/${tableId}/employee`,
    payload: { employeeId: -5 },
  });
}

test('Comanda registra o garçom da mesa na abertura e a mesa não muda', async () => {
  clearAll();
  const product = seedProduct('Pão Garçom', 1000);

  const app = await createApp({ logger: false });
  const waiter = await createEmployee(app, { name: 'Garçom Abertura' });
  const table = seedTable(83);
  await assignEmployee(app, table.id, waiter.id);

  const order = await openOrder(app, table.id, product.id);
  assert.strictEqual(order.employeeId, waiter.id); // copiado da mesa
  assert.strictEqual(order.employeeName, 'Garçom Abertura');

  // GET expõe o mesmo garçom.
  const fetched = await app.inject({ method: 'GET', url: `/orders/${order.id}` });
  assert.strictEqual(fetched.json().employeeId, waiter.id);
  assert.strictEqual(fetched.json().employeeName, 'Garçom Abertura');

  // Comanda em mesa SEM garçom: campos nulos.
  const freeTable = seedTable(84);
  const plainOrder = await openOrder(app, freeTable.id, product.id);
  assert.strictEqual(plainOrder.employeeId, null);
  assert.strictEqual(plainOrder.employeeName, null);

  await app.close();
});

test('close calcula a comissão do garçom (snapshot de bps no fechamento)', async () => {
  clearAll();
  const product = seedProduct('Pizza Garçom', 9000); // 1× = R$ 90,00

  const app = await createApp({ logger: false });
  const waiter = await createEmployee(app, { name: 'Garçom Comissão', commissionBps: 1000 }); // 10%
  const table = seedTable(85);
  await assignEmployee(app, table.id, waiter.id);

  const order = await openOrder(app, table.id, product.id); // total 9000
  const closeResponse = await app.inject({
    method: 'POST',
    url: `/orders/${order.id}/close`,
    payload: { paymentMethod: 'cartao' },
  });
  assert.strictEqual(closeResponse.statusCode, 200);

  const payment = closeResponse.json().payment;
  assert.strictEqual(payment.employeeId, waiter.id);
  assert.strictEqual(payment.employeeName, 'Garçom Comissão');
  assert.strictEqual(payment.commissionBps, 1000);
  assert.strictEqual(payment.commissionAmount, 900); // 9000 * 10%
  assert.strictEqual(payment.amount, 9000);

  // Atribuição da mesa permanece; a comanda segue com o garçom.
  const tables = (await app.inject({ method: 'GET', url: '/tables' })).json();
  assert.strictEqual(
    tables.find((row) => row.id === table.id).employeeId,
    waiter.id,
  );

  await app.close();
});

test('Sem garçom: fechamento grava comissão nula (células todas null)', async () => {
  clearAll();
  const product = seedProduct('Água Sem Garçom', 500);

  const app = await createApp({ logger: false });
  const table = seedTable(86); // sem atribuição
  const order = await openOrder(app, table.id, product.id);

  const closeResponse = await app.inject({
    method: 'POST',
    url: `/orders/${order.id}/close`,
    payload: { paymentMethod: 'pix' },
  });
  assert.strictEqual(closeResponse.statusCode, 200);

  const payment = closeResponse.json().payment;
  assert.strictEqual(payment.employeeId, null);
  assert.strictEqual(payment.employeeName, null);
  assert.strictEqual(payment.commissionBps, null);
  assert.strictEqual(payment.commissionAmount, null);
  assert.strictEqual(payment.commissionAmountFormatted, null);

  await app.close();
});

/** Higieniza o arquivo: FKs de outros testes (RESTRICT) e detritos. */
after(() => {
  clearAll();
});
