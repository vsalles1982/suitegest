/**
 * server.js — Ponto de entrada do backend SuiteSimulaFuncoes.
 *
 * Servidor HTTP baseado em Fastify.
 * Endpoint de verificação de saúde: GET /health -> { status: "ok" }
 * Módulo de Cardápio: GET/POST /products
 *
 * CORS habilitado para o frontend de desenvolvimento (http://localhost:8090).
 */
const fastify = require('fastify');
const productRoutes = require('./routes/products');

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
async function registerPlugins(app) {
  await app.register(require('@fastify/cors'), {
    origin: corsOriginCheck,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
}

/**
 * Cria uma instância da aplicação Fastify com plugins e rotas registrados.
 * Usada tanto pelo servidor real (start) quanto pelos testes (app.inject).
 */
async function createApp(
  { logger = true } = {},
) {
  const app = fastify({ logger });

  await registerPlugins(app);
  await app.register(productRoutes);

  return app;
}

/** Inicialização do servidor. */
async function start() {
  try {
    const app = await createApp();
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

// Só inicia ao ser executado diretamente (permite importar para testes).
if (require.main === module) {
  start();
}

module.exports = { createApp };
