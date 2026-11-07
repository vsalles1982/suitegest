/**
 * routes/categories.js — CRUD de categorias do módulo de Cardápio.
 *
 * Persistência em SQLite (backend/src/database.js). Tabela conforme o
 * database.js: id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE.
 *
 * Regras de negócio tratadas pela API:
 *   - name:  texto de 2 a 80 caracteres após trim (padrão do módulo);
 *   - duplicidade de nome -> 409;
 *   - categoria não encontrada -> 404;
 *   - exclusão de categoria com produtos vinculados -> 400
 *     (proteção declarada no schema: ON DELETE RESTRICT — RI-08 do
 *     docs/schema-produtos.md).
 */
const { getDatabase } = require('../database');

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 80;

/** Monta a representação de uma categoria no contrato da API. */
function toCategoryView(row) {
  return { id: row.id, name: row.name };
}

/** Valida e normaliza o nome; retorna null com a mensagem de erro preenchida. */
function validateName(reply, name) {
  if (typeof name !== 'string') {
    reply.code(400).send({ error: 'Campo "name" é obrigatório e deve ser texto.' });
    return null;
  }
  const trimmed = name.trim();
  if (trimmed.length < NAME_MIN_LENGTH || trimmed.length > NAME_MAX_LENGTH) {
    reply.code(400).send({
      error: `Campo "name" deve ter de ${NAME_MIN_LENGTH} a ${NAME_MAX_LENGTH} caracteres após remover espaços das pontas.`,
    });
    return null;
  }
  return trimmed;
}

/** Converte erros de integridade do SQLite em erros de negócio da API. */
function sqliteErrorToReply(reply, error) {
  if (error?.code?.startsWith('SQLITE_CONSTRAINT')) {
    return reply.code(409).send({ error: 'Conflito de integridade: ' + error.message });
  }
  throw error;
}

async function categoryRoutes(fastify) {
  /** Lista todas as categorias. */
  fastify.get('/categories', async () => {
    return getDatabase()
      .prepare('SELECT * FROM categories ORDER BY id')
      .all()
      .map(toCategoryView);
  });

  /** Cria uma categoria. */
  fastify.post('/categories', async (request, reply) => {
    const name = validateName(reply, request.body?.name);
    if (name === null) return reply;

    const db = getDatabase();

    const existing = db.prepare('SELECT 1 FROM categories WHERE name = ?').get(name);
    if (existing) {
      return reply.code(409).send({ error: `Já existe uma categoria com o nome "${name}".` });
    }

    try {
      const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
      const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);

      return reply.code(201).send(toCategoryView(row));
    } catch (error) {
      return sqliteErrorToReply(reply, error);
    }
  });

  /** Atualiza o nome de uma categoria. */
  fastify.put('/categories/:id', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return reply.code(400).send({ error: 'Parâmetro "id" inválido.' });
    }

    const name = validateName(reply, request.body?.name);
    if (name === null) return reply;

    const db = getDatabase();
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!row) {
      return reply.code(404).send({ error: `Categoria ${id} não existe.` });
    }

    const duplicate = db
      .prepare('SELECT 1 FROM categories WHERE name = ? AND id != ?')
      .get(name, id);
    if (duplicate) {
      return reply.code(409).send({ error: `Já existe uma categoria com o nome "${name}".` });
    }

    try {
      db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, id);
      const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);

      return reply.code(200).send(toCategoryView(updated));
    } catch (error) {
      return sqliteErrorToReply(reply, error);
    }
  });

  /** Exclui uma categoria (bloqueada quando há produtos vinculados). */
  fastify.delete('/categories/:id', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return reply.code(400).send({ error: 'Parâmetro "id" inválido.' });
    }

    const db = getDatabase();
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!row) {
      return reply.code(404).send({ error: `Categoria ${id} não existe.` });
    }

    const { total } = db
      .prepare('SELECT COUNT(*) AS total FROM products WHERE category_id = ?')
      .get(id);
    if (total > 0) {
      return reply.code(400).send({
        error: `A categoria "${row.name}" possui ${total} produto(s) vinculado(s) e não pode ser excluída.`,
      });
    }

    try {
      db.prepare('DELETE FROM categories WHERE id = ?').run(id);
      return reply.code(200).send({ status: 'deleted', category: toCategoryView(row) });
    } catch (error) {
      return sqliteErrorToReply(reply, error);
    }
  });
}

module.exports = categoryRoutes;
