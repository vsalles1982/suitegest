/**
 * server.js — Ponto de entrada do backend SuiteSimulaFuncoes.
 *
 * Servidor HTTP baseado em Fastify.
 * Endpoint de verificação de saúde: GET /health -> { status: "ok" }
 *
 * CORS habilitado para o frontend de desenvolvimento (http://localhost:8090).
 */
const fastify = require('fastify')({
  logger: true,
});

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

/** Lista de origens permitidas para acesso ao backend. */
const ALLOWED_ORIGINS = new Set([
  'http://localhost:8090',
  'http://127.0.0.1:8090',
]);

/**
 * Concede acesso apenas às origens do frontend de desenvolvimento.
 * Rejeita outras origens em CORS (não impede curl/clients sem origem).
 */
async function corsOriginCheck(origin) {
  return ALLOWED_ORIGINS.has(origin);
}

/** Registro de plugins. */
async function registerPlugins() {
  await fastify.register(require('@fastify/cors'), {
    origin: corsOriginCheck,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
}

/** Verificação de saúde do serviço. */
fastify.get('/health', async () => {
  return { status: 'ok' };
});

/** Inicialização do servidor. */
async function start() {
  try {
    await registerPlugins();
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
