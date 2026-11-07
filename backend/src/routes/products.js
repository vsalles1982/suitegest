/**
 * routes/products.js — Rotas de produtos do módulo de Cardápio.
 *
 * Persistência em SQLite (backend/src/database.js), conforme
 * docs/schema-produtos.md. Regras complementares da aplicação (seção 4.2):
 * trim de name, validação de preço e de categoria antes da gravação,
 * priceFormatted gerado na leitura (não persistido).
 *
 * Mapeamento banco -> API (docs/schema-produtos.md, seção 7):
 *   category_id -> categoryId
 *   created_at  -> createdAt
 */
const { getDatabase } = require('../database');
const { formatBRL } = require('../money');

/**
 * Monta a representação de um produto no contrato da API.
 * Recebe a linha do banco (+ o nome da categoria, quando resolvido):
 * mantém price em centavos (inteiro) e adiciona campos calculados.
 */
function toProductView(row, categoryName) {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    categoryId: row.category_id,
    priceFormatted: formatBRL(row.price),
    createdAt: row.created_at,
    categoryName: categoryName ?? `Categoria ${row.category_id}`,
  };
}

/** Mapa id -> nome das categorias (tabela pequena: leitura direta). */
function getCategoryNamesById() {
  const rows = getDatabase().prepare('SELECT id, name FROM categories').all();
  return new Map(rows.map((row) => [row.id, row.name]));
}

/** Traduz erros de integridade do SQLite em erros de negócio da API. */
function sqliteErrorToReply(reply, error) {
  if (error?.code?.startsWith('SQLITE_CONSTRAINT')) {
    return reply.code(400).send({ error: 'Violação de integridade: ' + error.message });
  }
  throw error;
}

async function productRoutes(fastify) {
  /** Lista todos os produtos cadastrados. */
  fastify.get('/products', async () => {
    const db = getDatabase();
    const categoryNames = getCategoryNamesById();

    return db
      .prepare('SELECT * FROM products')
      .all()
      .map((row) => toProductView(row, categoryNames.get(row.category_id)));
  });

  /** Cadastra um novo produto. */
  fastify.post('/products', async (request, reply) => {
    const { name, price, categoryId } = request.body ?? {};

    // Validações da aplicação (docs/schema-produtos.md, seção 4.2).
    if (typeof name !== 'string') {
      return reply.code(400).send({ error: 'Campo "name" é obrigatório e deve ser texto.' });
    }
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      return reply.code(400)
        .send({ error: 'Campo "name" deve ter de 2 a 80 caracteres após remover espaços das pontas.' });
    }
    if (!Number.isInteger(price) || price < 0 || price > 10000000) {
      return reply.code(400)
        .send({ error: 'Campo "price" deve ser um inteiro em centavos entre 0 e 10.000.000.' });
    }
    if (!Number.isInteger(categoryId)) {
      return reply.code(400).send({ error: 'Campo "categoryId" deve ser um inteiro.' });
    }

    const db = getDatabase();

    // Regra RI-07: rejeita categoria inexistente com erro de negócio,
    // antes de depender apenas do erro de chave estrangeira.
    const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
    if (!category) {
      return reply.code(400).send({ error: `Categoria ${categoryId} não existe.` });
    }

    try {
      const result = db
        .prepare('INSERT INTO products (name, price, category_id) VALUES (?, ?, ?)')
        .run(trimmedName, price, categoryId);

      const row = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
      const categoryNames = getCategoryNamesById();

      return reply.code(201).send(toProductView(row, categoryNames.get(row.category_id)));
    } catch (error) {
      return sqliteErrorToReply(reply, error);
    }
  });
}

module.exports = productRoutes;
