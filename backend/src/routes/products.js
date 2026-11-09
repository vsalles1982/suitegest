/**
 * routes/products.js — Rotas de produtos do módulo de Cardápio.
 *
 * Persistência em SQLite (backend/src/database.js), conforme
 * docs/schema-produtos.md. Regras complementares da aplicação (seção 4.2):
 * trim de name, validação de preço e de categoria antes da gravação,
 * priceFormatted gerado na leitura (não persistido).
 *
 * Bloco 4 (Controle de Estoque): produtos ganham stock (unidades disponíveis)
 * e min_stock (ponto de reposição). Contrato local (o docs/backlog-estoque.md
 * não existe no repositório; desenho acordado com o fundador e documentado
 * no backend/README.md):
 *   - PUT /products/:id/stock  — ajuste manual por CONFERÊNCIA de contagem:
 *     o corpo { stock: n } define o valor absoluto (não é delta), pois é como
 *     se conta estoque no balcão. { minStock } opcional ajusta o mínimo.
 *   - GET /products/low-stock  — produtos com stock < min_stock.
 *   - Vendas (POST /orders e /orders/:id/items) dão BAIXA no estoque e
 *     BLOQUEIAM (400) quando não há unidades suficientes — decisão fechada
 *     com o fundador; venda permissiva com alerta pode vir depois via flag.
 *
 * Mapeamento banco -> API (docs/schema-produtos.md, seção 7):
 *   category_id -> categoryId
 *   stock       -> stock
 *   min_stock   -> minStock
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
    // Bloco 4: estoque atual e mínimo (aditivo — não quebra clientes antigos).
    stock: row.stock,
    minStock: row.min_stock,
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

  /**
   * Bloco 4 — ajuste manual de estoque: PUT /products/:id/stock.
   *
   * Corpo: { "stock": 12 } (obrigatório, inteiro >= 0 — valor ABSOLUTO,
   * resultado da conferência de contagem) e { "minStock": 5 } (opcional,
   * inteiro >= 0, ponto de reposição). Erros: id inválido/mesa inexistente
   * (400/404), payload sem stock nem minStock (400), valores inválidos (400).
   */
  fastify.put('/products/:id/stock', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return reply.code(400).send({ error: 'Parâmetro "id" inválido.' });
    }

    const body = request.body ?? {};
    if (!Number.isInteger(body.stock) && !Number.isInteger(body.minStock)) {
      return reply.code(400).send({
        error: 'Informe "stock" (inteiro >= 0) e/ou "minStock" (inteiro >= 0).',
      });
    }

    const updates = {};
    if (body.stock !== undefined) {
      if (!Number.isInteger(body.stock) || body.stock < 0) {
        return reply.code(400).send({ error: 'Campo "stock" deve ser um inteiro maior ou igual a 0.' });
      }
      updates.stock = body.stock;
    }
    if (body.minStock !== undefined) {
      if (!Number.isInteger(body.minStock) || body.minStock < 0) {
        return reply.code(400).send({ error: 'Campo "minStock" deve ser um inteiro maior ou igual a 0.' });
      }
      updates.minStock = body.minStock;
    }

    const db = getDatabase();

    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
    if (!product) {
      return reply.code(404).send({ error: `Produto ${id} não existe.` });
    }

    const setSql = [
      updates.stock !== undefined ? 'stock = ?' : null,
      updates.minStock !== undefined ? 'min_stock = ?' : null,
    ].filter(Boolean).join(', ');
    const params = [
      updates.stock !== undefined ? updates.stock : null,
      updates.minStock !== undefined ? updates.minStock : null,
    ].filter((value) => value !== null);

    try {
      db.prepare(`UPDATE products SET ${setSql} WHERE id = ?`).run(...params, id);
    } catch (error) {
      return sqliteErrorToReply(reply, error);
    }

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    const categoryNames = getCategoryNamesById();
    return reply.code(200).send(toProductView(updated, categoryNames.get(updated.category_id)));
  });

  /**
   * Bloco 4 — produtos abaixo do ponto de reposição: GET /products/low-stock.
   * Lista produtos com stock < min_stock (minStock 0 nunca aparece — sem
   * mínimo configurado, não há reposição esperada). Cada item traz stock,
   * minStock e missing (quantas unidades faltam para atingir o mínimo).
   */
  fastify.get('/products/low-stock', async () => {
    const db = getDatabase();
    const categoryNames = getCategoryNamesById();

    const rows = db
      .prepare('SELECT * FROM products WHERE stock < min_stock ORDER BY (min_stock - stock) DESC, name')
      .all();

    return rows.map((row) => ({
      ...toProductView(row, categoryNames.get(row.category_id)),
      missing: row.min_stock - row.stock,
    }));
  });
}

module.exports = productRoutes;
