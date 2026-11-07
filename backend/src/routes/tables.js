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
}

module.exports = tableRoutes;
