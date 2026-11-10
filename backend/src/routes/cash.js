/**
 * routes/cash.js — Rotas do módulo de Gestão de Caixa (Bloco 6).
 *
 * Contrato local (o docs/backlog-caixa.md não existe no repositório;
 * desenho acordado com o fundador e documentado no backend/README.md):
 *   POST /cash/shifts/open     — abre turno (um por vez; duplicado → 409).
 *   POST /cash/shifts/close    — fecha O turno aberto, calcula o esperado
 *                                e a divergência (contagem opcional).
 *   POST /cash/transactions    — suprimento (cash_in) / sangria (cash_out)
 *                                no turno aberto; vendas ('sale') são
 *                                automáticas (orders.js, fechamento).
 *   GET  /cash/shifts/current  — turno aberto com saldo em tempo real.
 *
 * Valores em centavos (inteiro); formatados via formatBRL.
 * Decisão: comanda paga em dinheiro SEM turno aberto prossegue normal e
 * não é computada no caixa (não bloqueia a venda).
 */
const { getDatabase } = require('../database');
const { formatBRL } = require('../money');

/** Rótulos dos tipos de lançamento (resposta legível para o frontend). */
const TYPE_LABELS = {
  sale: 'Venda em dinheiro',
  cash_in: 'Suprimento',
  cash_out: 'Sangria',
};

/** Traduz erros de integridade do SQLite em erros de negócio da API. */
function sqliteErrorToReply(reply, error) {
  if (error?.code?.startsWith('SQLITE_CONSTRAINT')) {
    return reply.code(409).send({ error: 'Conflito de integridade: ' + error.message });
  }
  throw error;
}

/** Turno aberto (linha completa) ou undefined. */
function getOpenShift(db) {
  return db
    .prepare("SELECT * FROM cash_shifts WHERE status = 'open' ORDER BY id DESC")
    .get();
}

/**
 * Saldo em tempo real do turno: vendas em dinheiro ('sale' geradas no
 * fechamento das comandas), suprimentos e sangrias; expectedCash é o
 * dinheiro que DEVE estar na gaveta agora (fundo + vendas + suprimentos
 * - sangrias). Base: a própria tabela de lançamentos do turno.
 */
function buildBalance(db, shiftId, openingAmount) {
  const rows = db
    .prepare('SELECT type, SUM(amount) AS total, COUNT(*) AS count FROM cash_transactions WHERE shift_id = ? GROUP BY type')
    .all(shiftId);

  const byType = new Map(rows.map((row) => [row.type, row]));
  const sale = byType.get('sale') ?? { total: 0, count: 0 };
  const cashIn = byType.get('cash_in') ?? { total: 0, count: 0 };
  const cashOut = byType.get('cash_out') ?? { total: 0, count: 0 };

  const expectedCash = openingAmount + sale.total + cashIn.total - cashOut.total;

  return {
    cashSales: sale.total,
    cashSalesFormatted: formatBRL(sale.total),
    cashSalesCount: sale.count,
    cashIn: cashIn.total,
    cashInFormatted: formatBRL(cashIn.total),
    cashOut: cashOut.total,
    cashOutFormatted: formatBRL(cashOut.total),
    expectedCash,
    expectedCashFormatted: formatBRL(expectedCash),
  };
}

/** Monta a representação de um turno no contrato da API. */
function toShiftView(row) {
  return {
    id: row.id,
    operator: row.operator,
    openingAmount: row.opening_amount,
    openingAmountFormatted: formatBRL(row.opening_amount),
    openedAt: row.opened_at,
    status: row.status,
    closedAt: row.closed_at ?? null,
    countedAmount: row.counted_amount ?? null,
    countedAmountFormatted: row.counted_amount === null
      ? null
      : formatBRL(row.counted_amount),
  };
}

/** Monta a representação de um lançamento no contrato da API. */
function toTransactionView(row) {
  return {
    id: row.id,
    shiftId: row.shift_id,
    type: row.type,
    typeLabel: TYPE_LABELS[row.type] ?? row.type,
    amount: row.amount,
    amountFormatted: formatBRL(row.amount),
    note: row.note ?? null,
    orderId: row.order_id ?? null,
    createdAt: row.created_at,
  };
}

/** Valida um valor monetário positivo inteiro (nome do campo opcional). */
function validateAmount(reply, value, { field, minimum = 1 }) {
  if (!Number.isInteger(value) || value < minimum) {
    reply.code(400).send({
      error: `Campo "${field}" deve ser um inteiro em centavos maior ou igual a ${minimum === 0 ? 0 : 1}.`,
    });
    return false;
  }
  return true;
}

async function cashRoutes(fastify) {
  /** Abre um novo turno de caixa (fundo de troco opcional). */
  fastify.post('/cash/shifts/open', async (request, reply) => {
    const body = request.body ?? {};
    const operator = typeof body.operator === 'string' ? body.operator.trim() : '';
    if (operator.length < 2 || operator.length > 80) {
      return reply.code(400).send({
        error: 'Campo "operator" é obrigatório (texto de 2 a 80 caracteres).',
      });
    }
    if (body.openingAmount !== undefined
      && !validateAmount(reply, body.openingAmount, { field: 'openingAmount', minimum: 0 })) {
      return reply;
    }

    const db = getDatabase();

    // Regra central do Bloco 6: apenas um turno aberto.
    const current = getOpenShift(db);
    if (current) {
      return reply.code(409).send({
        error: `Já existe um turno de caixa aberto (id ${current.id}, operador "${current.operator}"); feche-o antes de abrir outro.`,
      });
    }

    try {
      const result = db
        .prepare('INSERT INTO cash_shifts (operator, opening_amount) VALUES (?, ?)')
        .run(operator, body.openingAmount ?? 0);
      const row = db.prepare('SELECT * FROM cash_shifts WHERE id = ?').get(result.lastInsertRowid);

      return reply.code(201).send({
        ...toShiftView(row),
        // Saldo inicial completo (tudo zerado exceto o fundo de troco).
        balance: buildBalance(db, row.id, row.opening_amount),
      });
    } catch (error) {
      return sqliteErrorToReply(reply, error);
    }
  });

  /** Turno aberto com saldo em tempo real (404 quando não há turno). */
  fastify.get('/cash/shifts/current', async (_request, reply) => {
    const db = getDatabase();
    const shift = getOpenShift(db);
    if (!shift) {
      return reply.code(404).send({ error: 'Não há turno de caixa aberto.' });
    }

    return reply.code(200).send({
      ...toShiftView(shift),
      balance: buildBalance(db, shift.id, shift.opening_amount),
    });
  });

  /** Suprimento (cash_in) ou sangria (cash_out) no turno aberto. */
  fastify.post('/cash/transactions', async (request, reply) => {
    const body = request.body ?? {};
    const type = body.type;
    if (type !== 'cash_in' && type !== 'cash_out') {
      return reply.code(400).send({
        error: 'Campo "type" aceita apenas "cash_in" (suprimento) ou "cash_out" (sangria).',
      });
    }
    if (!validateAmount(reply, body.amount, { field: 'amount' })) {
      return reply;
    }
    if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') {
      return reply.code(400).send({ error: 'Campo "note" deve ser texto.' });
    }

    const db = getDatabase();

    // Sem turno aberto não há onde lançar.
    const shift = getOpenShift(db);
    if (!shift) {
      return reply.code(409).send({
        error: 'Não há turno de caixa aberto; abra um turno antes de lançar movimentações.',
      });
    }
    // Sangria não pode deixar a gaveta negativa.
    const { expectedCash } = buildBalance(db, shift.id, shift.opening_amount);
    if (type === 'cash_out' && body.amount > expectedCash) {
      return reply.code(400).send({
        error: `Sangria de ${formatBRL(body.amount)} excede o dinheiro em caixa (${formatBRL(expectedCash)}).`,
      });
    }

    try {
      const result = db
        .prepare('INSERT INTO cash_transactions (shift_id, type, amount, note) VALUES (?, ?, ?, ?)')
        .run(shift.id, type, body.amount, body.note ?? null);
      const row = db
        .prepare('SELECT * FROM cash_transactions WHERE id = ?')
        .get(result.lastInsertRowid);

      return reply.code(201).send(toTransactionView(row));
    } catch (error) {
      return sqliteErrorToReply(reply, error);
    }
  });

  /**
   * Fecha O turno aberto. Corpo opcional: { "countedAmount": n } — dinheiro
   * contado na gaveta; o esperado é calculado (fundo + vendas em dinheiro +
   * suprimentos - sangrias) e a divergência (variance = contado - esperado)
   * vai na resposta. Tudo em BEGIN IMMEDIATE: pagamento concorrente vira
   * 'sale' do próximo turno.
   */
  fastify.post('/cash/shifts/close', async (request, reply) => {
    const body = request.body ?? {};
    if (body.countedAmount !== undefined
      && !validateAmount(reply, body.countedAmount, { field: 'countedAmount', minimum: 0 })) {
      return reply;
    }

    const db = getDatabase();

    try {
      db.exec('BEGIN IMMEDIATE');

      const shift = getOpenShift(db);
      if (!shift) {
        db.exec('ROLLBACK');
        return reply.code(409).send({ error: 'Não há turno de caixa aberto para fechar.' });
      }

      const balance = buildBalance(db, shift.id, shift.opening_amount);

      db.prepare(
        "UPDATE cash_shifts SET status = 'closed', closed_at = ?, counted_amount = ? WHERE id = ?",
      ).run(
        new Date().toISOString(),
        body.countedAmount ?? null,
        shift.id,
      );

      db.exec('COMMIT');

      const closed = db.prepare('SELECT * FROM cash_shifts WHERE id = ?').get(shift.id);
      const variance = body.countedAmount === undefined
        ? null
        : body.countedAmount - balance.expectedCash;

      return reply.code(200).send({
        ...toShiftView(closed),
        balance,
        variance,
        varianceFormatted: variance === null ? null : formatBRL(variance),
      });
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch (rollbackError) {
        // Transação já encerrada — nada a fazer.
      }
      return sqliteErrorToReply(reply, error);
    }
  });
}

module.exports = cashRoutes;
