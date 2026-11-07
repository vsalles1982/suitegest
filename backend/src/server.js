/**
 * server.js — Ponto de entrada do backend SuiteSimulaFuncoes.
 *
 * Servidor HTTP baseado em Fastify.
 * Endpoint de verificação de saúde: GET /health -> { status: "ok" }
 */
const fastify = require('fastify')({
  logger: true,
});

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

/** Verificação de saúde do serviço. */
fastify.get('/health', async () => {
  return { status: 'ok' };
});

/** Inicialização do servidor. */
async function start() {
  try {
    await fastify.listen({ port: PORT, host: HOST });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Só inicia ao ser executado diretamente (permite importar para testes).
if (require.main === module) {
  start();
}

module.exports = fastify;
