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
    -- Bloco 4 (Controle de Estoque): quantidade em estoque e mínimo para
    -- alerta de reposição. Produtos existentes migram com stock = 0.
    stock       INTEGER NOT NULL DEFAULT 0
                        CHECK (stock >= 0),
    min_stock   INTEGER NOT NULL DEFAULT 0
                        CHECK (min_stock >= 0),
    CONSTRAINT products_name_per_category_unique
      UNIQUE (category_id, name)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_products_category_id
    ON products (category_id);

  CREATE INDEX IF NOT EXISTS idx_products_created_at
    ON products (created_at);

  -- Bloco 6 (Gestão de Caixa): turnos de caixa e lançamentos.
  -- Um turno aberto por vez (abrir/fechar é um ciclo: open → close).
  -- opening_amount é o fundo de troco; counted_amount é o dinheiro contado
  -- no fechamento (null até fechar) — a divergência (variance) é derivada.
  CREATE TABLE IF NOT EXISTS cash_shifts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    operator       TEXT    NOT NULL
                           CHECK (length(trim(operator)) BETWEEN 2 AND 80),
    opening_amount INTEGER NOT NULL DEFAULT 0
                           CHECK (opening_amount >= 0),
    opened_at      TEXT    NOT NULL
                           DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    closed_at      TEXT,
    counted_amount INTEGER,
    status         TEXT    NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open', 'closed'))
  ) STRICT;

  -- Lançamentos do turno. 'sale' é gerado AUTOMATICAMENTE quando uma
  -- comanda é fechada com pagamento em dinheiro e há turno aberto;
  -- 'cash_in'/'cash_out' são suprimento/sangria manuais.
  CREATE TABLE IF NOT EXISTS cash_transactions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id   INTEGER NOT NULL
                       REFERENCES cash_shifts (id)
                       ON UPDATE CASCADE
                       ON DELETE RESTRICT,
    type       TEXT    NOT NULL
                       CHECK (type IN ('sale', 'cash_in', 'cash_out')),
    amount     INTEGER NOT NULL
                       CHECK (amount > 0),
    note       TEXT,
    order_id   INTEGER
                       REFERENCES "orders" (id)
                       ON UPDATE CASCADE
                       ON DELETE SET NULL,
    created_at TEXT    NOT NULL
                       DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_cash_transactions_shift
    ON cash_transactions (shift_id);

  -- Bloco 6 (pendência do QA): dados do estabelecimento impressos no
  -- cupom. Uma linha (id 1, semeadura abaixo); editar sob demanda.
  CREATE TABLE IF NOT EXISTS company_profile (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    name   TEXT NOT NULL,
    address TEXT,
    phone  TEXT
  ) STRICT;

  -- fallback do cupom: sem cadastro do estabelecimento, o nome é
  -- "SUITEGEST" (semeado aqui e editável sob demanda).  INSERT OR IGNORE INTO company_profile (id, name) VALUES (1, 'SUITEGEST');

  -- Bloco 3 (Gestão de Garçons): funcionários e atribuição às mesas.
  -- commission_bps é a comissão em basis points (1000 = 10%; 10000 = 100%).
  -- active = 0 desliga o funcionário sem apagar histórico.
  CREATE TABLE IF NOT EXISTS "employees" (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL UNIQUE COLLATE NOCASE
                           CHECK (length(trim(name)) BETWEEN 2 AND 80),
    commission_bps INTEGER NOT NULL DEFAULT 0
                           CHECK (commission_bps >= 0 AND commission_bps <= 10000),
    active         INTEGER NOT NULL DEFAULT 1
                           CHECK (active IN (0, 1)),
    created_at     TEXT    NOT NULL
                           DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ) STRICT;

  -- Fase 6 — Mesas (comandas/pedidos entram nas próximas etapas).
  -- Mesas: número único (em outros estabelecimentos pode haver mesas de
  -- "salão" e "balcão"; por enquanto, número global). status controla o
  -- ciclo operacional simples: livre, ocupada ou fechada (limpeza).
  -- employee_id (Bloco 3): garçom atualmente atribuído à mesa; copiado
  -- para a comanda no momento da abertura (quem abriu/atende).
  -- "tables" é nome usado entre aspas no SQL por legibilidade.
  CREATE TABLE IF NOT EXISTS "tables" (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    number      INTEGER NOT NULL UNIQUE CHECK (number >= 1),
    status      TEXT    NOT NULL
                        DEFAULT 'free'
                        CHECK (status IN ('free', 'occupied', 'closed')),
    employee_id INTEGER
                        REFERENCES employees (id)
                        ON UPDATE CASCADE
                        ON DELETE SET NULL
  ) STRICT;

  -- Tabela de orders criada agora (estrutura da Fase 6); as rotas de pedido
  -- virão em etapa posterior.
  CREATE TABLE IF NOT EXISTS "orders" (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id    INTEGER NOT NULL
                        REFERENCES "tables" (id)
                        ON UPDATE CASCADE
                        ON DELETE RESTRICT,
    employee_id INTEGER
                        REFERENCES employees (id)
                        ON UPDATE CASCADE
                        ON DELETE SET NULL,
    status      TEXT    NOT NULL
                        DEFAULT 'open'
                        CHECK (status IN ('open', 'closed')),
    closed_at TEXT, -- carimbo do fechamento (Bloco 2; null enquanto aberta)
    created_at TEXT   NOT NULL
                      DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_orders_table_id
    ON "orders" (table_id);

  CREATE INDEX IF NOT EXISTS idx_orders_created_at
    ON "orders" (created_at);

  -- Invariante: no máximo UMA comanda aberta por mesa
  -- (recomendação da seção 7 do docs/backlog-mesas.md).
  CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_open_per_table
    ON "orders" (table_id) WHERE status = 'open';

  -- Itens da comanda (backlog-mesas.md, seção 3.2). unit_price é um
  -- snapshot do products.price no momento da abertura; subtotal não é
  -- persistido (calculado como quantity * unit_price na leitura).
  CREATE TABLE IF NOT EXISTS "order_items" (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL
               REFERENCES "orders" (id)
               ON UPDATE CASCADE
               ON DELETE CASCADE,
    product_id INTEGER NOT NULL
               REFERENCES products (id)
               ON UPDATE CASCADE
               ON DELETE RESTRICT,
    quantity   INTEGER NOT NULL
               CHECK (quantity >= 1 AND quantity <= 999),
    unit_price INTEGER NOT NULL
               CHECK (unit_price >= 0),
    notes      TEXT CHECK (notes IS NULL OR length(notes) <= 255),
    created_at TEXT    NOT NULL
               DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_order_items_order_id
    ON "order_items" (order_id);

  -- Bloco 2 (Fechamento de Caixa): pagamento registrado no fechamento da
  -- comanda. amount é o total da comanda em centavos, snapshot do momento
  -- do fechamento (soma de quantity * unit_price dos order_items). Um
  -- comanda tem no máximo um pagamento (índice único em order_id).
  -- Bloco 3: employee_id/commission_bps/commission_amount são o snapshot
  -- da comissão do garçom no fechamento (bps = basis points; 1000 = 10%).
  -- Nulos quando a comanda não tem garçom (ou fechamento legado).
  CREATE TABLE IF NOT EXISTS "payments" (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id          INTEGER NOT NULL
                      REFERENCES "orders" (id)
                      ON UPDATE CASCADE
                      ON DELETE CASCADE,
    employee_id       INTEGER
                      REFERENCES employees (id)
                      ON UPDATE CASCADE
                      ON DELETE SET NULL,
    method            TEXT    NOT NULL
                      CHECK (method IN ('dinheiro', 'cartao', 'pix')),
    amount            INTEGER NOT NULL
                      CHECK (amount >= 0),
    commission_bps    INTEGER
                      CHECK (commission_bps IS NULL
                             OR (commission_bps >= 0 AND commission_bps <= 10000)),
    commission_amount INTEGER
                      CHECK (commission_amount IS NULL OR commission_amount >= 0),
    created_at        TEXT    NOT NULL
                      DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_payments_order_id
    ON "payments" (order_id);

  CREATE INDEX IF NOT EXISTS idx_payments_created_at
    ON "payments" (created_at);

  CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_order
    ON "payments" (order_id);
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

  // Migração leve (Bloco 2): bancos criados antes deste bloco não têm
  // closed_at em "orders". Idempotente: só roda quando a coluna ausente.
  const orderColumns = instance.prepare('PRAGMA table_info("orders")').all();
  if (!orderColumns.some((column) => column.name === 'closed_at')) {
    instance.exec('ALTER TABLE "orders" ADD COLUMN closed_at TEXT;');
  }

  // O índice da coluna migrada fica aqui (depois do ALTER TABLE) para
  // não falhar na ordem de criação em bancos pré-existentes.
  instance.exec('CREATE INDEX IF NOT EXISTS idx_orders_closed_at ON "orders" (closed_at);');

  // Migração leve (Bloco 3): employee_id nas tabelas e comissão em payments.
  // Idempotente: cada coluna só é adicionada quando ausente.
  const hasColumn = (table, column) => instance
    .prepare(`PRAGMA table_info("${table}")`)
    .all()
    .some((entry) => entry.name === column);

  if (!hasColumn('tables', 'employee_id')) {
    instance.exec(
      'ALTER TABLE "tables" ADD COLUMN employee_id INTEGER REFERENCES employees (id);',
    );
  }
  if (!hasColumn('orders', 'employee_id')) {
    instance.exec(
      'ALTER TABLE "orders" ADD COLUMN employee_id INTEGER REFERENCES employees (id);',
    );
  }
  if (!hasColumn('payments', 'employee_id')) {
    instance.exec(
      'ALTER TABLE "payments" ADD COLUMN employee_id INTEGER REFERENCES employees (id);',
    );
  }
  if (!hasColumn('payments', 'commission_bps')) {
    instance.exec('ALTER TABLE "payments" ADD COLUMN commission_bps INTEGER;');
  }
  if (!hasColumn('payments', 'commission_amount')) {
    instance.exec('ALTER TABLE "payments" ADD COLUMN commission_amount INTEGER;');
  }

  // Índices das colunas migradas (depois dos ALTER TABLE, mesma razão).
  instance.exec('CREATE INDEX IF NOT EXISTS idx_tables_employee_id ON "tables" (employee_id);');
  instance.exec('CREATE INDEX IF NOT EXISTS idx_orders_employee_id ON "orders" (employee_id);');
  instance.exec('CREATE INDEX IF NOT EXISTS idx_payments_employee_id ON "payments" (employee_id);');

  // Migração leve (Bloco 4): estoque nos produtos. Produtos pré-existentes
  // migram com stock = 0 (o ajuste manual via PUT /products/:id/stock
  // é a forma de atribuir a contagem real de cada item).
  if (!hasColumn('products', 'stock')) {
    instance.exec(
      'ALTER TABLE products ADD COLUMN stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0);',
    );
  }
  if (!hasColumn('products', 'min_stock')) {
    instance.exec(
      'ALTER TABLE products ADD COLUMN min_stock INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0);',
    );
  }

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

/**
 * Fecha a conexão do banco de forma controlada:
 * faz checkpoint do WAL (PRAGMA wal_checkpoint(TRUNCATE)) antes de fechar,
 * garantindo que os dados vão para o arquivo principal mesmo que o processo
 * morra logo em seguida (achado F-01 do relatório de QA da Fase 7).
 */
function closeDatabase() {
  if (!db) return;

  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch (checkpointError) {
    // Checkpoint pode falhar com outros leitores ativos; o close() abaixo
    // ainda tenta consolidar o que for possível.
    console.error('Falha no checkpoint do WAL:', checkpointError.message);
  }

  try {
    db.close();
  } catch (closeError) {
    console.error('Falha ao fechar o banco:', closeError.message);
  } finally {
    db = null;
  }
}

module.exports = { getDatabase, closeDatabase };
