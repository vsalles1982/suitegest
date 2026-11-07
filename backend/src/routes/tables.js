/**
 * routes/tables.js — Rotas do módulo de Mesas (Fase 6 — Mesas e Comandas).
 *
 * Nesta etapa: listagem e cadastro de mesas. Gestão de status (ocupar/liberar),
 * comandas e pedidos (tabela "orders") ficam para as próximas etapas.
 *
 * Ciclo de status de uma mesa:
 *   free     — disponível para atendimento
 *   occupied — com pedido aberto/comanda em uso
 *   closed   — encerrada para limpeza/manutenção
 */
const { getDatabase } = require('../database');

/** Monta a representação de uma mesa no contrato da API. */
function toTableView(row) {
  return { id: row.id, number: row.number, status: row.status };
}

/** Converte erros de integridade do SQLite em erros de negócio da API. */
function sqliteErrorToReply(reply, error) {
  if (error?.code?.startsWith('SQLITE_CONSTRAINT')) {
    return reply.code(409).send({ error: 'Conflito de integridade: ' + error.message });
  }
  throw error;
}

async function tableRoutes(fastify) {
  /** Lista todas as mesas, ordenadas por número. */
  fastify.get('/tables', async () => {
    return getDatabase()
      .prepare('SELECT * FROM "tables" ORDER BY number')
      .all()
      .map(toTableView);
  });

  /** Cadastra uma mesa (status inicial: free). */
  fastify.post('/tables', async (request, reply) => {
    const { number } = request.body ?? {};

    if (!Number.isInteger(number) || number < 1) {
      return reply.code(400)
        .send({ error: 'Campo "number" deve ser um inteiro maior ou igual a 1.' });
    }

    const db = getDatabase();

    const existing = db.prepare('SELECT 1 FROM "tables" WHERE number = ?').get(number);
    if (existing) {
      return reply.code(409).send({ error: `Já existe uma mesa com o número ${number}.` });
    }

    try {
      const result = db.prepare('INSERT INTO "tables" (number) VALUES (?)').run(number);
      const row = db.prepare('SELECT * FROM "tables" WHERE id = ?').get(result.lastInsertRowid);

      return reply.code(201).send(toTableView(row));
    } catch (error) {
      return sqliteErrorToReply(reply, error);
    }
  });

  /**
   * Transições de fechamento/liberação da mesa
   * (Fase 8 — docs/backlog-fase8.md, seção 6).
   *
   * Destinos aceitos: closed (occupied → closed, sem comanda aberta) e
   * free (closed → free). Ocupação segue exclusiva do POST /orders
   * (occupied → free direto e destinos "occupied" retornam 400, não 409).
   * Verificação de comanda aberta e update na mesma transação (AC-F8-03).
   */
  fastify.put('/tables/:id/status', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return reply.code(400).send({ error: 'Parâmetro "id" inválido.' });
    }

    const target = request.body?.status;
    if (target !== 'closed' && target !== 'free') {
      return reply.code(400)
        .send({ error: 'Nesta fase o status da mesa aceita apenas "closed" ou "free".' });
    }

    const db = getDatabase();
    const table = db.prepare('SELECT * FROM "tables" WHERE id = ?').get(id);
    if (!table) {
      return reply.code(404).send({ error: `Mesa ${id} não existe.` });
    }

    try {
      db.exec('BEGIN IMMEDIATE');

      if (target === 'closed') {
        if (table.status === 'closed') {
          db.exec('ROLLBACK');
          return reply.code(409).send({ error: `A mesa ${table.number} já está fechada.` });
        }
        if (table.status === 'free') {
          db.exec('ROLLBACK');
          return reply.code(409)
            .send({ error: `A mesa ${table.number} está livre; só pode ser fechada quando ocupada.` });
        }

        // occupied → closed exige comanda fechada (AC-TABLE-02).
        const openOrder = db
          .prepare("SELECT id FROM \"orders\" WHERE table_id = ? AND status = 'open'")
          .get(id);
        if (openOrder) {
          db.exec('ROLLBACK');
          return reply.code(409).send({
            error: `A mesa ${table.number} possui comanda aberta; feche a comanda antes de fechá-la.`,
          });
        }

        db.prepare("UPDATE \"tables\" SET status = 'closed' WHERE id = ?").run(id);
      } else {
        // target === 'free'
        if (table.status === 'free') {
          db.exec('ROLLBACK');
          return reply.code(409).send({ error: `A mesa ${table.number} já está livre.` });
        }
        if (table.status === 'occupied') {
          db.exec('ROLLBACK');
          return reply.code(409).send({
            error: `A mesa ${table.number} está ocupada; feche a mesa antes de liberá-la.`,
          });
        }

        db.prepare("UPDATE \"tables\" SET status = 'free' WHERE id = ?").run(id);
      }

      db.exec('COMMIT');
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch (rollbackError) {
        // Transação já encerrada — nada a fazer.
      }
      return sqliteErrorToReply(reply, error);
    }

    const updated = db.prepare('SELECT * FROM "tables" WHERE id = ?').get(id);
    return reply.code(200).send(toTableView(updated));
  });
}

module.exports = tableRoutes;
