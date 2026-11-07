/**
 * database.js — Inicialização do SQLite nativo (node:sqlite do Node.js 24).
 *
 * "Banco de dados" no arquivo backend/data/suitesimula.db (ou em
 * DATABASE_PATH, quando definida). Sem servidores de banco, sem pacotes.
 *
 * Schema da tabela products conforme docs/schema-produtos.md (seções 4, 5 e 7).
 * A tabela categories (pré-requisito da FK) usa o formato definido pela tarefa:
 * id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, tabela STRICT.
 * Fase 6: tabelas "tables" (mesas) e "orders" (pedidos) — estrutura inicial.
 *
 * Na primeira execução é inserida a categoria padrão { id: 1, name: 'Geral' },
 * com INSERT OR IGNORE — usada para testar com categoryId: 1.
 */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

/** Conexão única por processo. */
let db = null;

/** Caminho padrão do arquivo do banco (raiz do backend). */
const DEFAULT_DATABASE_PATH = path.join(__dirname, '..', 'data', 'suitesimula.db');

/**
 * Criação das tabelas e índices (idempotente).
 * A tabela products é exatamente a migração 001_create_products.sql do
 * docs/schema-produtos.md (seção 5.2).
 */
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS categories (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT    NOT NULL UNIQUE
  ) STRICT;

  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL COLLATE NOCASE
                        CHECK (length(trim(name)) BETWEEN 2 AND 80),
    price       INTEGER NOT NULL
                        CHECK (price >= 0 AND price <= 10000000),
    category_id INTEGER NOT NULL
                        REFERENCES categories (id)
                        ON UPDATE CASCADE
                        ON DELETE RESTRICT,
    created_at  TEXT    NOT NULL
                        DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT products_name_per_category_unique
      UNIQUE (category_id, name)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_products_category_id
    ON products (category_id);

  CREATE INDEX IF NOT EXISTS idx_products_created_at
    ON products (created_at);

  -- Fase 6 — Mesas (comandas/pedidos entram nas próximas etapas).
  -- Mesas: número único (em outros estabelecimentos pode haver mesas de
  -- "salão" e "balcão"; por enquanto, número global). status controla o
  -- ciclo operacional simples: livre, ocupada ou fechada (limpeza).
  -- "tables" é nome usado entre aspas no SQL por legibilidade.
  CREATE TABLE IF NOT EXISTS "tables" (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    number INTEGER NOT NULL UNIQUE CHECK (number >= 1),
    status TEXT    NOT NULL
                   DEFAULT 'free'
                   CHECK (status IN ('free', 'occupied', 'closed'))
  ) STRICT;

  -- Tabela de orders criada agora (estrutura da Fase 6); as rotas de pedido
  -- virão em etapa posterior.
  CREATE TABLE IF NOT EXISTS "orders" (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id  INTEGER NOT NULL
                      REFERENCES "tables" (id)
                      ON UPDATE CASCADE
                      ON DELETE RESTRICT,
    status    TEXT    NOT NULL
                      DEFAULT 'open'
                      CHECK (status IN ('open', 'closed')),
    created_at TEXT   NOT NULL
                      DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_orders_table_id
    ON "orders" (table_id);

  CREATE INDEX IF NOT EXISTS idx_orders_created_at
    ON "orders" (created_at);
`;

/** Criação completa do banco: arquivo, pragmas, schema e categoria padrão. */
function initialize() {
  const databasePath = process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH;

  // Garante a pasta do banco (o arquivo é criado pelo próprio SQLite).
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const instance = new DatabaseSync(databasePath);

  // PRAGMAs fora de transação (a FK não tem efeito dentro de uma).
  // busy_timeout primeiro: evita "database is locked" enquanto outro processo
  // (ex.: execução paralela dos testes) ainda mantém um lock no arquivo.
  instance.exec('PRAGMA busy_timeout = 5000;');
  instance.exec('PRAGMA foreign_keys = ON;');
  instance.exec('PRAGMA journal_mode = WAL;');

  instance.exec(SCHEMA_SQL);

  // Categoria padrão para testes/uso inicial — id 1 é ignorado se já existir.
  instance
    .prepare('INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)')
    .run(1, 'Geral');

  return instance;
}

/** Retorna a conexão inicializada (inicializa na primeira chamada). */
function getDatabase() {
  if (!db) {
    db = initialize();
  }
  return db;
}

module.exports = { getDatabase };
