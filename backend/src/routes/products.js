/**
 * routes/products.js — Rotas de produtos do módulo de Cardápio.
 *
 * "Banco de dados" temporário em memória, para os primeiros testes de API.
 * Será substituído por persistência real em uma etapa posterior.
 *
 * Um produto tem:
 *   - id:             inteiro, gerado automaticamente (sequencial)
 *   - name:           string, obrigatória
 *   - price:          inteiro em centavos (ex.: 4590 = R$ 45,90)
 *   - priceFormatted: string, calculado por esta API (ex.: "R$ 45,90")
 *   - categoryId:     inteiro, obrigatório por enquanto
 *   - categoryName:   string, mock temporário (ex.: "Categoria 1")
 */

/** Armazenamento em memória compartilhado pelas instâncias criadas por createApp(). */
const products = [];

let nextId = 1;

/** Formatador de moeda do Node (padrão BRL, locale pt-BR). */
const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/**
 * Monta a representação de um produto no contrato da API:
 * mantém price em centavos (inteiro) e adiciona campos calculados.
 */
function toProductView({ id, name, price, categoryId }) {
  const view = {
    id,
    name,
    price,
    categoryId,
    priceFormatted: brlFormatter.format(price / 100),
  };

  if (Number.isInteger(categoryId)) {
    // Mock temporário — será buscado da tabela de categorias quando ela existir.
    view.categoryName = `Categoria ${categoryId}`;
  }

  return view;
}

async function productRoutes(fastify) {
  /** Lista todos os produtos cadastrados. */
  fastify.get('/products', async () => {
    return products.map(toProductView);
  });

  /** Cadastra um novo produto. */
  fastify.post('/products', async (request, reply) => {
    const { name, price, categoryId } = request.body ?? {};

    if (typeof name !== 'string' || name.trim() === '') {
      return reply.code(400).send({ error: 'Campo "name" é obrigatório e deve ser texto.' });
    }
    if (!Number.isInteger(price) || price < 0) {
      return reply.code(400).send({ error: 'Campo "price" deve ser um inteiro em centavos (>= 0).' });
    }
    if (!Number.isInteger(categoryId)) {
      return reply.code(400).send({ error: 'Campo "categoryId" deve ser um inteiro.' });
    }

    const product = { id: nextId++, name: name.trim(), price, categoryId };
    products.push(product);

    return reply.code(201).send(toProductView(product));
  });
}

module.exports = productRoutes;
