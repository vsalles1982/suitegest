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

const QUANTITY_MIN = 1;
const QUANTITY_MAX = 999;
const NOTES_MAX_LENGTH = 255;

/** Valida o id de rota (">= 0" inteiro positivo) e responde 400 se inválido. */
function validateRouteId(reply, id) {
  if (!Number.isInteger(id) || id < 1) {
    reply.code(400).send({ error: 'Parâmetro "id" inválido.' });
    return null;
  }
  return id;
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

  for (let index = 0; index < items.length; index += 1) {
    const { productId, quantity, notes } = items[index] ?? {};

    if (!Number.isInteger(productId) || productId < 1) {
      reply.code(400).send({ error: `Item ${index + 1}: "productId" deve ser um inteiro positivo.` });
      return null;
    }
    if (!Number.isInteger(quantity) || quantity < QUANTITY_MIN || quantity > QUANTITY_MAX) {
      reply.code(400).send({
        error: `Item ${index + 1}: "quantity" deve ser um inteiro entre ${QUANTITY_MIN} e ${QUANTITY_MAX}.`,
      });
      return null;
    }
    if (notes !== undefined && notes !== null) {
      if (typeof notes !== 'string') {
        reply.code(400).send({ error: `Item ${index + 1}: "notes" deve ser texto.` });
        return null;
      }
      const trimmedNotes = notes.trim();
      if (trimmedNotes.length > NOTES_MAX_LENGTH) {
        reply.code(400).send({
          error: `Item ${index + 1}: "notes" deve ter até ${NOTES_MAX_LENGTH} caracteres.`,
        });
        return null;
      }
      items[index] = { ...items[index], notes: trimmedNotes === '' ? null : trimmedNotes };
    }
  }

  return { tableId, items };
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
function toOrderView(orderRow, rowsItems) {
  const items = rowsItems.map(toItemView);
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    id: orderRow.id,
    tableId: orderRow.table_id,
    status: orderRow.status,
    createdAt: orderRow.created_at,
    items,
    total,
    totalFormatted: formatBRL(total),
  };
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

      const orderResult = db
        .prepare('INSERT INTO "orders" (table_id) VALUES (?)')
        .run(tableId);
      orderId = orderResult.lastInsertRowid;

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

    return reply.code(201).send(toOrderView(orderRow, itemRows));
  });

  /** Consulta a comanda com itens, subtotais e total. */
  fastify.get('/orders/:id', async (request, reply) => {
    const id = validateRouteId(reply, Number(request.params.id));
    if (!id) return reply;

    const db = getDatabase();

    const orderRow = db.prepare('SELECT * FROM "orders" WHERE id = ?').get(id);
    if (!orderRow) {
      return reply.code(404).send({ error: `Comanda ${id} não existe.` });
    }

    const itemRows = getOrderItems(db, id);

    return reply.code(200).send(toOrderView(orderRow, itemRows));
  });
}

module.exports = orderRoutes;
