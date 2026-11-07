/**
 * health.test.js — Teste de fumaça (smoke test) do backend SuiteSimulaFuncoes.
 *
 * Verifica se o serviço está de pé respondendo corretamente no endpoint
 * de verificação de saúde: GET /health -> { status: "ok" }.
 *
 * Usa apenas os módulos nativos do Node.js (node:test + node:assert) e o
 * fetch nativo (Node 18+), sem nenhuma dependência extra.
 */

const { test } = require('node:test');
const assert = require('node:assert');

const HEALTH_URL = process.env.HEALTH_URL || 'http://localhost:3000/health';

test('GET /health deve responder com status 200 e corpo { status: "ok" }', async (t) => {
  const response = await fetch(HEALTH_URL);
  const body = await response.json();

  assert.strictEqual(
    response.status,
    200,
    `Esperava status 200, mas recebeu ${response.status}`,
  );

  assert.deepStrictEqual(
    body,
    { status: 'ok' },
    `Corpo da resposta inesperado: ${JSON.stringify(body)}`,
  );
});
