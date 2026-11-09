/**
 * routes/orders.js — Rotas de Comanda (Fase 7 — Mesas e Comandas).
 *
 * Conforme docs/backlog-mesas.md (seções 3.2, 3.3, 5 e 6):
 *   POST /orders — abre a comanda de uma mesa com ao menos um item,
 *                  ocupando a mesa, tudo em uma única transação.
 *   GET  /orders/:id — consulta a comanda com itens, subtotais e total.
 *
 * Regras principais:
 *   - unit_price é snapshot do products.price no momento da abertura.
 *   - uma mesa só tem uma comanda aberta (índice único parcial uq_orders_open_per_table).
 *   - mesa closed não recebe comanda; livre e ocupada sem comanda podem.
 *   - valores monetários são inteiros em centavos; *Formatted são derivados.
 */
const { getDatabase } = require('../database');
const { formatBRL } = require('../money');
const { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } = require('../paymentMethods');

const QUANTITY_MIN = 1;
const QUANTITY_MAX = 999;
const NOTES_MAX_LENGTH = 255;

/** Métodos de pagamento aceitos no fechamento (fonte: paymentMethods.js). */
const PAYMENT_METHODS_ACCEPTED = PAYMENT_METHODS;

/** Carimbo de tempo no mesmo formato do DEFAULT de created_at (UTC, ISO). */
function nowIsoUtc() {
  return new Date().toISOString();
}

/** Valida o id de rota (">= 0" inteiro positivo) e responde 400 se inválido. */
function validateRouteId(reply, id) {
  if (!Number.isInteger(id) || id < 1) {
    reply.code(400).send({ error: 'Parâmetro "id" inválido.' });
    return null;
  }
  return id;
}

/**
 * Valida e normaliza um item de comanda (productId, quantity, notes).
 * Retorna null com resposta de erro preenchida em caso de falha.
 * Usada tanto na abertura (itens em lista) quanto na adição (item único).
 */
function normalizeAndValidateItem(reply, rawItem, itemLabel) {
  const { productId, quantity, notes } = rawItem ?? {};

  if (!Number.isInteger(productId) || productId < 1) {
    reply.code(400).send({ error: `${itemLabel}: "productId" deve ser um inteiro positivo.` });
    return null;
  }
  if (!Number.isInteger(quantity) || quantity < QUANTITY_MIN || quantity > QUANTITY_MAX) {
    reply.code(400).send({
      error: `${itemLabel}: "quantity" deve ser um inteiro entre ${QUANTITY_MIN} e ${QUANTITY_MAX}.`,
    });
    return null;
  }
  if (notes !== undefined && notes !== null) {
    if (typeof notes !== 'string') {
      reply.code(400).send({ error: `${itemLabel}: "notes" deve ser texto.` });
      return null;
    }
    const trimmedNotes = notes.trim();
    if (trimmedNotes.length > NOTES_MAX_LENGTH) {
      reply.code(400).send({
        error: `${itemLabel}: "notes" deve ter até ${NOTES_MAX_LENGTH} caracteres.`,
      });
      return null;
    }
    return { productId, quantity, notes: trimmedNotes === '' ? null : trimmedNotes };
  }
  return { productId, quantity, notes: null };
}

/** Valida o payload de abertura; retorna null (e a resposta de erro) em falha. */
function validateOpenPayload(reply, body) {
  const tableId = body?.tableId;
  if (!Number.isInteger(tableId) || tableId < 1) {
    reply.code(400).send({ error: 'Campo "tableId" é obrigatório e deve ser um inteiro positivo.' });
    return null;
  }

  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    reply.code(400).send({ error: 'Campo "items" é obrigatório e deve conter ao menos um item.' });
    return null;
  }

  const validatedItems = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = normalizeAndValidateItem(reply, items[index], `Item ${index + 1}`);
    if (!item) return null;
    validatedItems.push(item);
  }

  return { tableId, items: validatedItems };
}

/** Monta a representação de um item da comanda no contrato da API. */
function toItemView(row) {
  const subtotal = row.quantity * row.unit_price;
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    unitPriceFormatted: formatBRL(row.unit_price),
    subtotal,
    subtotalFormatted: formatBRL(subtotal),
    // Campo do banco não listado no backlog (5.4/6.3), mas essencial para o
    // atendente na consulta da comanda. Registrar no doc para o PM.
    notes: row.notes ?? null,
  };
}

/** Monta a representação da comanda com itens, total e derivados formatados. */
function toOrderView(orderRow, rowsItems, paymentRow = null, employeeName = null) {
  const items = rowsItems.map(toItemView);
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    id: orderRow.id,
    tableId: orderRow.table_id,
    status: orderRow.status,
    createdAt: orderRow.created_at,
    // Bloco 2: carimbo do fechamento (null enquanto a comanda segue aberta).
    closedAt: orderRow.closed_at ?? null,
    // Bloco 2 (contrato do QA): pagamento da comanda — objeto com method,
    // methodLabel, amount e amountFormatted, ou null se não houver. O nome
    // do garçom (Bloco 3) é o mesmo da comanda e chega resolvido.
    payment: paymentRow ? toPaymentView(paymentRow, employeeName) : null,
    // Bloco 3: garçom que abriu a comanda (copiado da mesa na abertura).
    // O nome vem resolvido pelo chamador (linha com JOIN na consulta).
    employeeId: orderRow.employee_id ?? null,
    employeeName: employeeName ?? null,
    items,
    total,
    totalFormatted: formatBRL(total),
  };
}

/** Monta a representação do pagamento registrado no fechamento. */
function toPaymentView(paymentRow, employeeName = null) {
  return {
    id: paymentRow.id,
    orderId: paymentRow.order_id,
    method: paymentRow.method,
    methodLabel: PAYMENT_METHOD_LABELS[paymentRow.method] ?? paymentRow.method,
    amount: paymentRow.amount,
    amountFormatted: formatBRL(paymentRow.amount),
    createdAt: paymentRow.created_at,
    // Bloco 3: comissão do garçom (snapshot no fechamento; null sem garçom).
    employeeId: paymentRow.employee_id ?? null,
    employeeName: employeeName ?? null,
    commissionBps: paymentRow.commission_bps ?? null,
    commissionAmount: paymentRow.commission_amount ?? null,
    commissionAmountFormatted: paymentRow.commission_amount === null
      ? null
      : formatBRL(paymentRow.commission_amount),
  };
}

/** Linha do pagamento da comanda (ou undefined quando não pago). */
function getOrderPayment(db, orderId) {
  return db.prepare('SELECT * FROM "payments" WHERE order_id = ?').get(orderId);
}

/** Nome atual do funcionário (null quando sem garçom ou inexistente). */
function getEmployeeName(db, employeeId) {
  if (!employeeId) return null;
  const row = db.prepare('SELECT name FROM employees WHERE id = ?').get(employeeId);
  return row ? row.name : null;
}

/** Linhas dos itens da comanda (com productName resolvido), ordenadas por id. */
function getOrderItems(db, orderId) {
  return db
    .prepare(
      `SELECT oi.*, p.name AS product_name
         FROM "order_items" oi
         JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ?
        ORDER BY oi.id`,
    )
    .all(orderId);
}

/** Converte erros de integridade do SQLite em erros de negócio da API. */
function sqliteErrorToReply(reply, error) {
  if (error?.code?.startsWith('SQLITE_CONSTRAINT')) {
    return reply.code(409).send({ error: 'Conflito de integridade: ' + error.message });
  }
  throw error;
}

async function orderRoutes(fastify) {
  /** Abre uma comanda para uma mesa, com ao menos um item inicial. */
  fastify.post('/orders', async (request, reply) => {
    const payload = validateOpenPayload(reply, request.body);
    if (!payload) return reply;
    const { tableId, items } = payload;

    const db = getDatabase();

    // 404 — mesa inexistente (mesmo com payload válido).
    const table = db.prepare('SELECT * FROM "tables" WHERE id = ?').get(tableId);
    if (!table) {
      return reply.code(404).send({ error: `Mesa ${tableId} não existe.` });
    }

    // 409 — mesa fechada não recebe comanda (backlog-mesas.md, 5.3).
    if (table.status === 'closed') {
      return reply.code(409).send({ error: `A mesa ${table.number} está fechada e não recebe comanda.` });
    }

    // 409 — mesa já tem comanda aberta (invariante: uma comanda por mesa).
    const openOrder = db
      .prepare("SELECT id FROM \"orders\" WHERE table_id = ? AND status = 'open'")
      .get(tableId);
    if (openOrder) {
      return reply.code(409).send({
        error: `A mesa ${table.number} já possui uma comanda aberta.`,
      });
    }

    // 400 — produtos inexistentes (preço é lido do cadastro no próximo passo).
    const productRows = new Map();
    const uniqueProductIds = [...new Set(items.map((item) => item.productId))];
    const selectProduct = db.prepare('SELECT id, name, price FROM products WHERE id = ?');
    for (const productId of uniqueProductIds) {
      const product = selectProduct.get(productId);
      if (!product) {
        return reply.code(400).send({ error: `Produto ${productId} não existe.` });
      }
      productRows.set(productId, product);
    }

    // Operação atômica: comanda + itens + status da mesa (backlog-mesas.md, 5.3).
    let orderId;
    try {
      db.exec('BEGIN IMMEDIATE');

      // Bloco 3: re-lê a mesa dentro da transação para copiar o garçom
      // atribuído no instante da abertura (a leitura pré-transação pode
      // ter mudado por PUT /tables/:id/employee concorrente).
      const tableNow = db.prepare('SELECT * FROM "tables" WHERE id = ?').get(tableId);
      if (!tableNow || tableNow.status !== table.status) {
        db.exec('ROLLBACK');
        return reply.code(409).send({
          error: `O estado da mesa ${tableId} mudou durante a abertura; tente novamente.`,
        });
      }

      const orderResult = db
        .prepare('INSERT INTO "orders" (table_id, employee_id) VALUES (?, ?)')
        .run(tableId, tableNow.employee_id ?? null);
      orderId = orderResult.lastInsertRowid;

      // Bloco 4: baixa de estoque. A leitura do estoque é feita DENTRO da
      // transação (BEGIN IMMEDIATE serializa escritas; não há corrida de
      // duas comandas consumindo as mesmas unidades). Quantidades são
      // somadas por productId (o mesmo produto pode vir em dois itens).
      // Estoque insuficiente BLOQUEIA a venda (400) — decisão documentada
      // no backend/README.md; transação íntegra via ROLLBACK.
      const deduct = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
      const stockByProduct = new Map();
      for (const item of items) {
        const sum = (stockByProduct.get(item.productId) ?? 0) + item.quantity;
        stockByProduct.set(item.productId, sum);
      }
      for (const [productId, quantity] of stockByProduct) {
        const { stock, name } = db
          .prepare('SELECT stock, name FROM products WHERE id = ?')
          .get(productId);
        if (stock < quantity) {
          db.exec('ROLLBACK');
          return reply.code(400).send({
            error: `Estoque insuficiente: "${name}" tem ${stock} unidade(s) e a venda pede ${quantity}. Não é possível abrir a comanda.`,
          });
        }
        deduct.run(quantity, productId);
      }

      const insertItem = db.prepare(
        'INSERT INTO "order_items" (order_id, product_id, quantity, unit_price, notes) VALUES (?, ?, ?, ?, ?)',
      );
      for (const item of items) {
        const product = productRows.get(item.productId);
        insertItem.run(
          orderId,
          product.id,
          item.quantity,
          product.price, // preço lido do cadastro, não do cliente (AC-ORDER-10)
          item.notes ?? null,
        );
      }

      db.prepare("UPDATE \"tables\" SET status = 'occupied' WHERE id = ?").run(tableId);

      db.exec('COMMIT');
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch (rollbackError) {
        // ROLLBACK falhou porque a transação já encerrou — nada a fazer.
      }
      return sqliteErrorToReply(reply, error);
    }

    const orderRow = db.prepare('SELECT * FROM "orders" WHERE id = ?').get(orderId);
    const itemRows = getOrderItems(db, orderId);
    const orderEmployeeName = getEmployeeName(db, orderRow.employee_id);

    return reply.code(201).send(toOrderView(orderRow, itemRows, null, orderEmployeeName));
  });

  /** Consulta a comanda com itens, subtotais, total e pagamento. */
  fastify.get('/orders/:id', async (request, reply) => {
    const id = validateRouteId(reply, Number(request.params.id));
    if (!id) return reply;

    const db = getDatabase();

    const orderRow = db.prepare('SELECT * FROM "orders" WHERE id = ?').get(id);
    if (!orderRow) {
      return reply.code(404).send({ error: `Comanda ${id} não existe.` });
    }

    const itemRows = getOrderItems(db, id);
    const paymentRow = getOrderPayment(db, id);
    const orderEmployeeName = getEmployeeName(db, orderRow.employee_id);
    const paymentEmployeeName = paymentRow ? getEmployeeName(db, paymentRow.employee_id) : null;

    return reply.code(200)
      .send(toOrderView(
        orderRow,
        itemRows,
        paymentRow,
        orderEmployeeName ?? paymentEmployeeName,
      ));
  });

  /**
   * Bloco 5 — cupom para impressão: GET /orders/:id/receipt.
   *
   * Contrato (backend/README.md; o docs/backlog-dashboard.md cobre só o
   * dashboard e não existe no repositório): itens com subtotais e total
   * formatados, forma de pagamento (quando houver) com comissão do garçom
   * snapshotada, closedAt (data/hora do fechamento) e printedAt (carimbo
   * do pedido de impressão). Comanda ABERTA → 409 (cupom é comprovante
   * de comanda fechada); comanda inexistente → 404; id inválido → 400.
   * Fechamento legado (sem pagamento) devolve payment: null.
   */
  fastify.get('/orders/:id/receipt', async (request, reply) => {
    const id = validateRouteId(reply, Number(request.params.id));
    if (!id) return reply;

    const db = getDatabase();

    const orderRow = db.prepare('SELECT * FROM "orders" WHERE id = ?').get(id);
    if (!orderRow) {
      return reply.code(404).send({ error: `Comanda ${id} não existe.` });
    }
    if (orderRow.status !== 'closed') {
      return reply.code(409)
        .send({ error: `A comanda ${id} está aberta; o cupom é impresso após o fechamento.` });
    }

    const paymentRow = getOrderPayment(db, id);
    const itemRows = getOrderItems(db, id);
    const items = itemRows.map((row) => {
      const view = toItemView(row);
      return {
        productName: row.product_name,
        quantity: view.quantity,
        unitPrice: view.unitPrice,
        unitPriceFormatted: view.unitPriceFormatted,
        subtotal: view.subtotal,
        subtotalFormatted: view.subtotalFormatted,
      };
    });
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);

    let payment = null;
    if (paymentRow) {
      payment = {
        method: paymentRow.method,
        methodLabel: PAYMENT_METHOD_LABELS[paymentRow.method] ?? paymentRow.method,
        amount: paymentRow.amount,
        amountFormatted: formatBRL(paymentRow.amount),
        // Bloco 3: comissão (snapshot do fechamento; null sem garçom).
        employeeId: paymentRow.employee_id ?? null,
        employeeName: getEmployeeName(db, paymentRow.employee_id),
        commissionBps: paymentRow.commission_bps ?? null,
        commissionAmount: paymentRow.commission_amount ?? null,
        commissionAmountFormatted: paymentRow.commission_amount === null
          ? null
          : formatBRL(paymentRow.commission_amount),
      };
    }

    return reply.code(200).send({
      orderId: orderRow.id,
      tableId: orderRow.table_id,
      items,
      total,
      totalFormatted: formatBRL(total),
      payment,
      closedAt: orderRow.closed_at,
      printedAt: nowIsoUtc(),
    });
  });

  /**
   * Fecha uma comanda aberta (Fase 8 — docs/backlog-fase8.md, seção 5;
   * evolução do Bloco 2 — fechamento com pagamento).
   *
   * Corpo opcional: { "paymentMethod": "dinheiro" | "cartao" | "pix" }.
   *   - com paymentMethod: registra um pagamento na tabela payments com
   *     amount = total da comanda (snapshot dos order_items) e grava
   *     closed_at na comanda, tudo na mesma transação;
   *   - sem corpo (_fluxo legado da Fase 8): fecha sem pagamento, também
   *     gravando closed_at.
   *
   * Apenas orders.status muda para closed (mesa e itens ficam intactos).
   * O UPDATE é condicional a status = 'open' dentro de transação, de modo
   * que um fechamento duplo (concorrência ou repetição) vence só na
   * primeira chamada; a segunda recebe 409 (AC-CLOSE-10). Pagamento e
   * fechamento partilham a transação: nunca existe fechamento vencedor
   * sem o pagamento correspondente (nem o contrário).
   */
  fastify.post('/orders/:id/close', async (request, reply) => {
    const id = validateRouteId(reply, Number(request.params.id));
    if (!id) return reply;

    // Corpo ausente = fechamento legado sem pagamento. Presente, o
    // paymentMethod é obrigatório e precisa ser um dos três métodos.
    const paymentMethod = request.body?.paymentMethod ?? null;
    if (paymentMethod !== null && !PAYMENT_METHODS_ACCEPTED.has(paymentMethod)) {
      return reply.code(400).send({
        error: `Campo "paymentMethod" aceita apenas: ${[...PAYMENT_METHODS_ACCEPTED].join(', ')}.`,
      });
    }

    const db = getDatabase();

    const orderRow = db.prepare('SELECT * FROM "orders" WHERE id = ?').get(id);
    if (!orderRow) {
      return reply.code(404).send({ error: `Comanda ${id} não existe.` });
    }
    if (orderRow.status === 'closed') {
      return reply.code(409).send({ error: `A comanda ${id} já está fechada.` });
    }

    // AC-CLOSE-06: comanda aberta sem itens não fecha.
    const { total: itemCount } = db
      .prepare('SELECT COUNT(*) AS total FROM "order_items" WHERE order_id = ?')
      .get(id);
    if (itemCount === 0) {
      return reply.code(409)
        .send({ error: `A comanda ${id} está aberta sem itens e não pode ser fechada.` });
    }

    try {
      db.exec('BEGIN IMMEDIATE');

      // Atualização atômica e condicionada ao status open, registrando o
      // carimbo do fechamento na mesma linha.
      const result = db
        .prepare(
          "UPDATE \"orders\" SET status = 'closed', closed_at = ? WHERE id = ? AND status = 'open'",
        )
        .run(nowIsoUtc(), id);
      if (result.changes === 0) {
        db.exec('ROLLBACK');
        return reply.code(409).send({ error: `A comanda ${id} já está fechada.` });
      }

      // O total é recalculado DENTRO da transação (a mesma leitura que
      // protege o fechamento cobre o pagamento): snapshot imutável do valor.
      let payment = null;
      if (paymentMethod !== null) {
        const { total } = db
          .prepare(
            'SELECT COALESCE(SUM(quantity * unit_price), 0) AS total FROM "order_items" WHERE order_id = ?',
          )
          .get(id);

        // Bloco 3: comissão do garçom (snapshot dos bps no fechamento).
        // employee_id vem da comanda (quem abriu, copiado da mesa);
        // sem garçom, as colunas de comissão ficam null. Arredondamento
        // em inteiro (centavos * bps / 10000), metade para cima.
        const orderInTx = db
          .prepare('SELECT employee_id FROM "orders" WHERE id = ?')
          .get(id);
        const orderEmployeeId = orderInTx?.employee_id ?? null;
        let employeeId = null;
        let commissionBps = null;
        let commissionAmount = null;
        if (orderEmployeeId) {
          const employee = db
            .prepare('SELECT id, commission_bps FROM employees WHERE id = ?')
            .get(orderEmployeeId);
          if (employee) {
            employeeId = employee.id;
            commissionBps = employee.commission_bps;
            commissionAmount = Math.round(total * commissionBps / 10000);
          }
        }

        const paymentResult = db
          .prepare(
            'INSERT INTO "payments" (order_id, employee_id, method, amount, commission_bps, commission_amount) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(id, employeeId, paymentMethod, total, commissionBps, commissionAmount);
        payment = db
          .prepare('SELECT * FROM "payments" WHERE id = ?')
          .get(paymentResult.lastInsertRowid);
      }

      db.exec('COMMIT');

      // Contrato do QA: a comanda sempre traz payment (null quando legado).
      const updated = db.prepare('SELECT * FROM "orders" WHERE id = ?').get(id);
      const itemRows = getOrderItems(db, id);
      const orderEmployeeName = getEmployeeName(db, updated.employee_id);
      const paymentEmployeeName = payment ? getEmployeeName(db, payment.employee_id) : null;
      return reply.code(200)
        .send(toOrderView(updated, itemRows, payment, orderEmployeeName ?? paymentEmployeeName));
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch (rollbackError) {
        // Transação já encerrada — nada a fazer.
      }
      return sqliteErrorToReply(reply, error);
    }
  });

  /**
   * Adiciona um item a uma comanda aberta (evolução da Fase 6).
   *
   * Regras: comanda precisa existir (404) e estar open (409 em closed);
   * produto precisa existir (400). unit_price é snapshot do products.price
   * lido dentro da transação. Insert do item e verificação de estado
   * ocorrem em BEGIN IMMEDIATE para não permitir corrida entre
   * fechamento e adição. O total da comanda é derivado na leitura
   * (soma dos subtotais) — nada de "total" é persistido (backlog-mesas §3.2).
   */
  fastify.post('/orders/:id/items', async (request, reply) => {
    const id = validateRouteId(reply, Number(request.params.id));
    if (!id) return reply;

    const item = normalizeAndValidateItem(reply, request.body, 'Item');
    if (!item) return reply;

    const db = getDatabase();

    try {
      db.exec('BEGIN IMMEDIATE');

      // Verificações e inserção atômicas: comanda não pode virar closed
      // no meio da operação (ou vice-versa).
      const orderRow = db.prepare('SELECT * FROM "orders" WHERE id = ?').get(id);
      if (!orderRow) {
        db.exec('ROLLBACK');
        return reply.code(404).send({ error: `Comanda ${id} não existe.` });
      }
      if (orderRow.status === 'closed') {
        db.exec('ROLLBACK');
        return reply.code(409)
          .send({ error: `A comanda ${id} está fechada; itens não podem ser adicionados.` });
      }

      const product = db
        .prepare('SELECT id, name, price, stock FROM products WHERE id = ?')
        .get(item.productId);
      if (!product) {
        db.exec('ROLLBACK');
        return reply.code(400).send({ error: `Produto ${item.productId} não existe.` });
      }

      // Bloco 4: baixa de estoque do item único — mesma regra da abertura
      // (insuficiente bloqueia a venda, 400; transação via ROLLBACK).
      if (product.stock < item.quantity) {
        db.exec('ROLLBACK');
        return reply.code(400).send({
          error: `Estoque insuficiente: "${product.name}" tem ${product.stock} unidade(s) e a venda pede ${item.quantity}.`,
        });
      }
      db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?')
        .run(item.quantity, product.id);

      // Snapshot de preço no momento da adição (mesma regra da abertura).
      db.prepare(
        'INSERT INTO "order_items" (order_id, product_id, quantity, unit_price, notes) VALUES (?, ?, ?, ?, ?)',
      ).run(id, product.id, item.quantity, product.price, item.notes);

      db.exec('COMMIT');
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch (rollbackError) {
        // Transação já encerrada — nada a fazer.
      }
      return sqliteErrorToReply(reply, error);
    }

    const updated = db.prepare('SELECT * FROM "orders" WHERE id = ?').get(id);
    const updatedName = getEmployeeName(db, updated.employee_id);
    return reply.code(201).send(toOrderView(updated, getOrderItems(db, id), null, updatedName));
  });
}

module.exports = orderRoutes;
