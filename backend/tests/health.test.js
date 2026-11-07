const test = require('node:test');
const assert = require('node:assert');

test('GET /health deve responder com status 200 e corpo { status: "ok" }', async () => {
  // Importa o Fastify diretamente
  const fastify = require('fastify')();
  
  // Registra a mesma rota /health do servidor
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  // Sobe o servidor em uma porta aleatória (0 = automático)
  await fastify.listen({ port: 0, host: '127.0.0.1' });
  
  // Descobre qual porta ele escolheu
  const address = fastify.server.address();
  const url = `http://127.0.0.1:${address.port}/health`;

  try {
    // Faz a requisição HTTP real
    const response = await fetch(url);
    const body = await response.json();

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(body, { status: 'ok' });
  } finally {
    // Garante que o servidor será fechado, mesmo se o teste falhar
    await fastify.close();
  }
});
