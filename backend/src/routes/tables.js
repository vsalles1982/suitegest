/**
 * routes/tables.js — Rotas do módulo de Mesas (Fase 6 — Mesas e Comandas).
 *
 * Nesta etapa: listagem e cadastro de mesas. Gestão de status (ocupar/liberar),
 * comandas e pedidos (tabela "orders") ficam para as próximas etapas.
 *
 * Bloco 3 (Gestão de Garçons): PUT /tables/:id/employee atribui ou remove
 * (employeeId: null) o garçom da mesa. O garçom atribuído é copiado para
 * a comanda na abertura (POST /orders, em routes/orders.js).
 *
 * Ciclo de status de uma mesa:
 *   free     — disponível para atendimento
 *   occupied — com pedido aberto/comanda em uso
 *   closed   — encerrada para limpeza/manutenção
 */
const { getDatabase } = require('../database');

/** Monta a representação de uma mesa no contrato da API. */
function toTableView(row) {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    // Bloco 3: garçom atribuído atualmente (e o nome resolvido quando
    // existir — join feito nas consultas que montam esta view).
    employeeId: row.employee_id ?? null,
    employeeName: row.employee_name ?? null,
  };
}

/** Consulta de mesa com o nome do garçom resolvido (LEFT JOIN employees). */
function getTableById(db, id) {
  return db
    .prepare(
      `SELECT t.id, t.number, t.status, t.employee_id, e.name AS employee_name
         FROM "tables" t
         LEFT JOIN employees e ON e.id = t.employee_id
        WHERE t.id = ?`,
    )
    .get(id);
}

/** Lista de mesas ordenada por número, com garçom resolvido. */
function listTables(db) {
  return db
    .prepare(
      `SELECT t.id, t.number, t.status, t.employee_id, e.name AS employee_name
         FROM "tables" t
         LEFT JOIN employees e ON e.id = t.employee_id
        ORDER BY t.number`,
    )
    .all();
}

/** Converte erros de integridade do SQLite em erros de negócio da API. */
function sqliteErrorToReply(reply, error) {
  if (error?.code?.startsWith('SQLITE_CONSTRAINT')) {
    return reply.code(409).send({ error: 'Conflito de integridade: ' + error.message });
  }
  throw error;
}

async function tableRoutes(fastify) {
  /** Lista todas as mesas, ordenadas por número (com garçom resolvido). */
  fastify.get('/tables', async () => {
    return listTables(getDatabase()).map(toTableView);
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
      const row = getTableById(db, result.lastInsertRowid);

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

    const updated = getTableById(db, id);
    return reply.code(200).send(toTableView(updated));
  });

  /**
   * Bloco 3 — atribuição de garçom à mesa: PUT /tables/:id/employee.
   *
   * Corpo: { "employeeId": 7 } atribui; { "employeeId": null } remove.
   * Regras: mesa precisa existir (404); funcionário precisa existir (404)
   * e estar ativo (400) para ser atribuído; corpo ausente/inválido → 400.
   * A atribuição é um dado operacional: sobrevive a fechamento/liberação
   * da mesa e é copiada para as comandas abertas a partir de então.
   */
  fastify.put('/tables/:id/employee', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return reply.code(400).send({ error: 'Parâmetro "id" inválido.' });
    }

    const body = request.body ?? {};
    if (!('employeeId' in body)) {
      return reply.code(400).send({ error: 'Campo "employeeId" é obrigatório (ou null para remover).' });
    }

    const employeeId = body.employeeId;
    if (employeeId !== null && (!Number.isInteger(employeeId) || employeeId < 1)) {
      return reply.code(400).send({
        error: 'Campo "employeeId" deve ser um inteiro positivo ou null para remover a atribuição.',
      });
    }

    const db = getDatabase();

    const table = db.prepare('SELECT * FROM "tables" WHERE id = ?').get(id);
    if (!table) {
      return reply.code(404).send({ error: `Mesa ${id} não existe.` });
    }

    if (employeeId !== null) {
      const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
      if (!employee) {
        return reply.code(404).send({ error: `Funcionário ${employeeId} não existe.` });
      }
      if (employee.active !== 1) {
        return reply.code(400).send({
          error: `O funcionário "${employee.name}" está inativo e não pode ser atribuído a uma mesa.`,
        });
      }
    }

    try {
      db.prepare('UPDATE "tables" SET employee_id = ? WHERE id = ?').run(employeeId, id);
    } catch (error) {
      return sqliteErrorToReply(reply, error);
    }

    const updated = getTableById(db, id);
    return reply.code(200).send(toTableView(updated));
  });
}

module.exports = tableRoutes;
