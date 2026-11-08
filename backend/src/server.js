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
const { closeDatabase } = require('./database');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const tableRoutes = require('./routes/tables');
const orderRoutes = require('./routes/orders');
const reportRoutes = require('./routes/reports');

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
 *
 * forceCloseConnections: fecha conexões keep-alive no shutdown, evitando
 * que app.close() espere ociosidade de navegadores.
 */
async function createApp(
  { logger = true } = {},
) {
  const app = fastify({ logger, forceCloseConnections: true });

  await registerPlugins(app);
  await app.register(productRoutes);
  await app.register(categoryRoutes);
  await app.register(tableRoutes);
  await app.register(orderRoutes);
  await app.register(reportRoutes);

  /** Verificação de saúde do serviço. */
  app.get('/health', async () => {
    return { status: 'ok' };
  });

  /**
   * F-01: fechamento do banco acoplado ao ciclo de vida da instância
   * (checkpoint do WAL + db.close()), sem passagem de callback inválida.
   */
  app.addHook('onClose', async () => {
    closeDatabase();
  });

  return app;
}

/** Inicialização do servidor. */
let runningApp = null;

/** Tempo máximo aguardando requisições em curso antes de encerrar forçado. */
const CLOSE_TIMEOUT_MS = 5000;

/** Fecha o servidor com teto de tempo (não travar o shutdown por keep-alive). */
async function closeAppWithTimeout(app) {
  return Promise.race([
    app.close(), // F-01: sem objeto de opções — era a causa do "Callback for 'close' hook is not a function".
    new Promise((resolve) => setTimeout(resolve, CLOSE_TIMEOUT_MS)),
  ]);
}

/** Encerramento gracioso: HTTP fecha primeiro, depois o banco (checkpoint do WAL). */
async function handleShutdown(signal) {
  console.log(`Sinal ${signal} recebido — encerrando o serviço...`);

  try {
    if (runningApp) {
      await closeAppWithTimeout(runningApp);
      runningApp = null;
    }
  } catch (closeError) {
    console.error('Erro ao encerrar o servidor HTTP:', closeError);
  }

  // Redundância deliberada: se o hook onClose não rodou (instance parcial),
  // fechamos explicitamente. closeDatabase() é idempotente (no-op sem handle).
  closeDatabase();
  process.exit(0);
}

/** Inicialização do servidor. */
async function start() {
  try {
    const app = await createApp();
    runningApp = app;
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    console.error(err);
    closeDatabase();
    process.exit(1);
  }
}

// Só inicia ao ser executado diretamente (permite importar para testes).
// Handlers registrados APENAS dentro do bloco require.main: os testes e os
// imports (createApp) não registram handlers de sinais — sem efeitos colaterais.
if (require.main === module) {
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  start();
}

module.exports = { createApp };
