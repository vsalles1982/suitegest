/**
 * routes/employees.js — Rotas do módulo de Garçons (Bloco 3).
 *
 *   POST /employees      — cadastra funcionário (name, commissionBps?, active?).
 *   GET  /employees      — lista funcionários (id, name, commissionBps,
 *                          active, createdAt).
 *   PUT  /employees/:id  — atualiza nome/comissão/atividade (parcial, exige
 *                          ao menos um campo).
 *
 * Contrato (docs/backlog-garcons.md ainda não existe no repositório —
 * desenho documentado no backend/README.md e acordado com o fundador):
 *   - commission_bps em basis points: 1000 = 10%; faixa 0..10000 (inteiro).
 *   - active é boleano na API (persistido como 0/1 no STRICT do SQLite).
 *   - name único (case-insensitive) → 409 em duplicado.
 *   - Desativar (active: false) preserva o histórico; a comissão continua
 *     válida em comandas fechadas depois (snapshot no fechamento).
 */
const { getDatabase } = require('../database');

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 80;
const COMMISSION_BPS_MAX = 10000;

/** Converte erros de integridade do SQLite em erros de negócio da API. */
function sqliteErrorToReply(reply, error) {
  if (error?.code?.startsWith('SQLITE_CONSTRAINT')) {
    return reply.code(409).send({ error: 'Conflito de integridade: ' + error.message });
  }
  throw error;
}

/** Monta a representação de um funcionário no contrato da API. */
function toEmployeeView(row) {
  return {
    id: row.id,
    name: row.name,
    commissionBps: row.commission_bps,
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

/**
 * Valida e normaliza name/commissionBps/active de um payload parcial.
 * Retorna null (com resposta de erro) em falha, e um objeto só com os
 * campos presentes quando válido (undefined = campo não enviado).
 */
function validateEmployeeFields(reply, body, { partial }) {
  const fields = {};

  const name = body?.name;
  if (name !== undefined) {
    if (typeof name !== 'string') {
      reply.code(400).send({ error: 'Campo "name" deve ser texto.' });
      return null;
    }
    const trimmed = name.trim();
    if (trimmed.length < NAME_MIN_LENGTH || trimmed.length > NAME_MAX_LENGTH) {
      reply.code(400).send({
        error: `Campo "name" deve ter entre ${NAME_MIN_LENGTH} e ${NAME_MAX_LENGTH} caracteres.`,
      });
      return null;
    }
    fields.name = trimmed;
  } else if (!partial) {
    reply.code(400).send({ error: 'Campo "name" é obrigatório.' });
    return null;
  }

  const commissionBps = body?.commissionBps;
  if (commissionBps !== undefined) {
    if (!Number.isInteger(commissionBps)
      || commissionBps < 0
      || commissionBps > COMMISSION_BPS_MAX) {
      reply.code(400).send({
        error: `Campo "commissionBps" deve ser um inteiro entre 0 e ${COMMISSION_BPS_MAX} (1000 = 10%).`,
      });
      return null;
    }
    fields.commissionBps = commissionBps;
  } else if (!partial) {
    fields.commissionBps = 0; // padrão da criação: sem comissão
  }

  const active = body?.active;
  if (active !== undefined) {
    if (typeof active !== 'boolean') {
      reply.code(400).send({ error: 'Campo "active" deve ser boleano.' });
      return null;
    }
    fields.active = active ? 1 : 0;
  } else if (!partial) {
    fields.active = 1; // padrão da criação: ativo
  }

  return fields;
}

/** Cláusulas SET para o UPDATE — só-de-campos-enviados e sempre com nome. */
function buildEmployeeUpdate(fields) {
  const sets = [];
  const params = [];
  if (fields.name !== undefined) {
    sets.push('name = ?');
    params.push(fields.name);
  }
  if (fields.commissionBps !== undefined) {
    sets.push('commission_bps = ?');
    params.push(fields.commissionBps);
  }
  if (fields.active !== undefined) {
    sets.push('active = ?');
    params.push(fields.active);
  }
  return { setSql: sets.join(', '), params };
}

async function employeeRoutes(fastify) {
  /** Lista os funcionários, ordenados por nome. */
  fastify.get('/employees', async () => {
    const rows = getDatabase()
      .prepare('SELECT * FROM employees ORDER BY name, id')
      .all();
    return rows.map(toEmployeeView);
  });

  /** Cadastra um funcionário (comissão padrão 0, ativo). */
  fastify.post('/employees', async (request, reply) => {
    const fields = validateEmployeeFields(reply, request.body, { partial: false });
    if (!fields) return reply;

    const db = getDatabase();

    const existing = db
      .prepare('SELECT id FROM employees WHERE name = ? COLLATE NOCASE')
      .get(fields.name);
    if (existing) {
      return reply.code(409).send({
        error: `Já existe um funcionário chamado "${fields.name}".`,
      });
    }

    try {
      const result = db
        .prepare('INSERT INTO employees (name, commission_bps, active) VALUES (?, ?, ?)')
        .run(fields.name, fields.commissionBps, fields.active);
      const row = db
        .prepare('SELECT * FROM employees WHERE id = ?')
        .get(result.lastInsertRowid);

      return reply.code(201).send(toEmployeeView(row));
    } catch (error) {
      return sqliteErrorToReply(reply, error);
    }
  });

  /** Atualiza nome, comissão e/ou atividade de um funcionário (parcial). */
  fastify.put('/employees/:id', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return reply.code(400).send({ error: 'Parâmetro "id" inválido.' });
    }

    // PUT parcial: exige ao menos um campo para não confundir com no-op.
    const body = request.body ?? {};
    if (body.name === undefined
      && body.commissionBps === undefined
      && body.active === undefined) {
      return reply.code(400).send({
        error: 'Informe ao menos um campo: "name", "commissionBps" ou "active".',
      });
    }

    const fields = validateEmployeeFields(reply, body, { partial: true });
    if (!fields) return reply;

    const db = getDatabase();

    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!employee) {
      return reply.code(404).send({ error: `Funcionário ${id} não existe.` });
    }

    if (fields.name !== undefined
      && fields.name.toLowerCase() !== employee.name.toLowerCase()) {
      const duplicate = db
        .prepare('SELECT id FROM employees WHERE name = ? COLLATE NOCASE')
        .get(fields.name);
      if (duplicate) {
        return reply.code(409).send({
          error: `Já existe um funcionário chamado "${fields.name}".`,
        });
      }
    }

    try {
      const { setSql, params } = buildEmployeeUpdate(fields);
      db.prepare(`UPDATE employees SET ${setSql} WHERE id = ?`).run(...params, id);
    } catch (error) {
      return sqliteErrorToReply(reply, error);
    }

    const updated = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    return reply.code(200).send(toEmployeeView(updated));
  });
}

module.exports = employeeRoutes;
