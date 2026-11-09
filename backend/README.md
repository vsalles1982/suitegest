# Backend — SuiteSimulaFuncoes

Backend do sistema de gestão **não fiscal** para restaurantes, pizzarias e
lanchonetes (ver `../CHARTER.md`, seção 5). Construído com Node.js e Fastify.

## Requisitos

- Node.js >= 18 (nenhum banco de dados ou serviço externo nesta etapa inicial).

## Instalação das dependências

A partir da pasta `backend/`, execute:

```bash
npm install
```

Isso instala as dependências declaradas em `package.json` (atualmente apenas
`fastify`).

## Como rodar o servidor

Na pasta `backend/`:

```bash
# Produção / uso normal
npm start

# Desenvolvimento ( reinicia automaticamente ao alterar arquivos )
npm run dev
```

Alternativamente, diretamente:

```bash
node src/server.js
```

Por padrão o servidor escuta em `http://0.0.0.0:3000`. É possível sobrescrever
via variáveis de ambiente:

```bash
PORT=3001 HOST=127.0.0.1 npm start
```

## Endpoints

| Método | Rota               | Descrição                                        | Resposta                                            |
| ------ | ------------------ | ------------------------------------------------ | --------------------------------------------------- |
| GET    | `/health`          | Verificação de saúde do serviço                  | `{ "status": "ok" }`                                |
| GET    | `/categories`      | Lista categorias                                 | Array de `{ id, name }`                             |
| POST   | `/categories`      | Cria categoria                                   | `{ id, name }` (201)                                |
| PUT    | `/categories/:id`  | Renomeia categoria                               | `{ id, name }` (200)                                |
| DELETE | `/categories/:id`  | Exclui categoria (400 se houver produtos)        | `{ "status": "deleted", category }` (200)           |
| GET    | `/products`        | Lista produtos do cardápio                       | Array de `{ id, name, price, categoryId, ... }`     |
| POST   | `/products`        | Cadastra um produto                              | `{ id, name, price, categoryId, ... }` (201 / 400)  |
| GET    | `/tables`          | Lista mesas, com garçom atribuído                | Array de `{ id, number, status, employeeId, employeeName }` |
| POST   | `/tables`          | Cadastra mesa (status inicial `free`)            | `{ id, number, status }` (201)                      |
| PUT    | `/tables/:id/status` | Fecha (`closed`) ou libera (`free`) a mesa     | `{ id, number, status }` (200)                      |
| PUT    | `/tables/:id/employee` | Atribui garçom (`{ "employeeId": 7 }`) ou remove (`null`) | Mesa (200)                              |
| GET    | `/employees`       | Lista funcionários ordenados por nome              | Array de `{ id, name, commissionBps, active, createdAt }`  |
| POST   | `/employees`       | Cadastra funcionário (`commissionBps` em bps)      | `{ id, name, commissionBps, active }` (201)         |
| PUT    | `/employees/:id`   | Atualiza nome/comissão/atividade (parcial)         | Funcionário (200)                                   |
| POST   | `/orders`          | Abre comanda para mesa, com itens iniciais       | Comanda com `items`, `total`, `totalFormatted` (201)|
| GET    | `/orders/:id`      | Consulta comanda com itens, subtotais e total    | Comanda com `items`, `total`, `totalFormatted` (200)|
| POST   | `/orders/:id/close`| Fecha a comanda; opc. registra pagamento          | Comanda `closed` (200), com `closedAt`; com corpo, também `payment` |
| POST   | `/orders/:id/items`| Adiciona item a comanda `open` (snapshot de preço)| Comanda atualizada com novo item (201)              |
| GET    | `/reports/sales`   | Resumo de caixa, com período (query opcional)      | `{ from, to, paidOrders, totalRevenue, ... }` (200) |
| GET    | `/reports/summary` | Resumo de caixa do histórico completo              | Mesmo shape de `/reports/sales` (200)               |

- **Ciclo da mesa (Fase 8, `docs/backlog-fase8.md`):** abrir comanda →
  `POST /orders/:id/close` (mesa continua `occupied`) → `PUT /tables/:id/status`
  `closed` (exige comanda fechada) → `PUT /tables/:id/status` `free`.
- `409` para estados incompatíveis (comanda/mesa já fechada, mesa com comanda
  aberta, transições proibidas); `400` para destino `occupied`/corpo inválido;
  `404` para recurso inexistente.

### Fechamento de Caixa (Bloco 2) — contratos alinhados ao QA (2.1)

- **`POST /orders/:id/close`** aceita corpo **opcional**:
  `{"paymentMethod": "dinheiro" | "cartao" | "pix"}`.
  - Com o corpo: registra um pagamento na tabela `payments`
    (`amount` = total da comanda em centavos, snapshot dos itens) e grava
    `closed_at` na comanda, tudo em **uma única transação** — nunca existe
    fechamento sem pagamento correspondente (nem o contrário).
  - Sem o corpo (fluxo legado da Fase 8): fecha sem pagamento, e ainda
    assim grava `closed_at`.
  - `paymentMethod` inválido → `400` e a comanda **permanece aberta**
    (operação sem efeitos parciais). Duplo fechamento → `409`, sem segundo
    pagamento (índice único `uq_payments_order`).
- **Contrato do QA (2.1) em `GET /orders/:id`** (e consequentemente em
  todos os retornos de comanda): o objeto `payment` (ou `null`) está
  sempre presente, com `method`, `methodLabel` ('Dinheiro', 'Cartão',
  'Pix'), `amount`, `amountFormatted` e `createdAt`. Também há `closedAt`
  (null enquanto aberta). Rótulos e métodos centralizados em
  `src/paymentMethods.js`.
- **Relatórios** (`backend/src/routes/reports.js`) — os DOIS endpoints
  (`/reports/sales` e `/reports/summary`) retornam os campos do QA:
  - `ordersCount` — nº de comandas **pagas** (alias legado: `paidOrders`);
  - `total` / `totalFormatted` — valor total do período (aliases legados:
    `totalRevenue` / `totalRevenueFormatted` / `totalSold` no summary);
  - `topItems[]` — itens mais vendidos das comandas **pagas**:
    `{ productId, productName, quantity, total, totalFormatted }`
    (com `revenue` / `revenueFormatted` legados; top 5, ordem por
    `quantity DESC`);
  - `byMethod[]` — `{ method, label, payments, total, totalFormatted }`
    (ex.: `label: 'Dinheiro'`).
  - Compatibilidade frontend (Bloco 2.1): `totalSold`, `paidOrders`,
    `totalRevenue*`, `averageTicket`, `unpaidClosedOrders`, `from`, `to`
    continuam presentes.
  - Sendo a `payments` a base (fluxo de caixa), comanda fechada sem
    pagamento não entra em `ordersCount`/`total`/`topItems` — conta
    apenas em `unpaidClosedOrders`.
  - **Fuso horário (implementado, era pendência):** o filtro por dia usa
    America/Sao_Paulo (UTC-3 fixo; constante `BUSINESS_UTC_OFFSET` em
    `src/paymentMethods.js`). O dia local D corresponde ao intervalo UTC
    `[D 00:00-03:00, D+1 00:00-03:00)` — fechamentos entre 21h e 23h59 de
    Brasília contam no dia local correto. Para mudar o fuso, ajuste só a
    constante (SP não tem horário de verão desde 2019).
- Migração leve: bancos pré-existentes ganham a coluna `orders.closed_at`
  via `ALTER TABLE` idempotente na inicialização.

### Gestão de Garçons (Bloco 3)

*Desenho local: o `docs/backlog-garcons.md` não existe no repositório;
contratos a seguir acertados com o fundador e documentados aqui.*

- **Tabela `employees`**: `id`, `name` (único, case-insensitive),
  `commission_bps` (basis points — **1000 = 10%**, faixa 0..10000),
  `active` (0/1 boleano na API) e `created_at`. Sem DELETE: desativar via
  `active: false` preserva o histórico.
- **Atribuição de garçom**: `PUT /tables/:id/employee` com
  `{ "employeeId": 7 }` (funcionário precisa existir — 404 — e estar
  ativo — 400) ou `{ "employeeId": null }` para remover. A atribuição
  sobrevive ao fechamento/liberação da mesa.
- **Quem abriu a comanda**: `POST /orders` copia o `employee_id` da mesa
  para a comanda **dentro da transação** (re-lê a mesa para não pegar
  atribuição concorrente). Comanda expõe `employeeId` e `employeeName`.
- **Comissão no fechamento** (`POST /orders/:id/close` com corpo):
  `payments` ganhou as colunas snapshot `employee_id`, `commission_bps` e
  `commission_amount` — `amount * bps / 10000`, arredondado para inteiro
  (metade para cima). Inseridas na mesma transação do pagamento; sem
  garçom (ou fechamento legado) ficam `null`. A resposta do pagamento
  traz `employeeId`, `employeeName`, `commissionBps`,
  `commissionAmount` e `commissionAmountFormatted`.
- **Migração leve (idempotente na inicialização)**: colunas
  `tables.employee_id`, `orders.employee_id`,
  `payments.employee_id/commission_bps/commission_amount` via
  `ALTER TABLE` sob `PRAGMA table_info`, com índices em `employee_id`.

Erros comuns: `404` (recurso inexistente), `409` (nome duplicado de categoria) e
`400` (validação de payload ou categoria com produtos vinculados ao excluir).

- `price` é um **inteiro em centavos** (ex.: `4500` = R$ 45,00).
- `id` é gerado automaticamente (sequencial).
- Payload inválido no `POST` retorna `400` com `{ "error": "..." }`.

Exemplo de teste rápido:

```bash
curl http://localhost:3000/health
curl -X POST http://localhost:3000/products \
  -H 'Content-Type: application/json' \
  -d '{"name":"Pizza Margherita","price":4500,"categoryId":1}'
```

## Persistência

A partir desta versão o backend usa **SQLite nativo** (`node:sqlite`, sem
pacotes externos):

- Arquivo do banco: `backend/data/suitesimula.db` (criado automaticamente na
  primeira execução). Para usar outro caminho, defina a variável
  `DATABASE_PATH`.
- Tabelas: `categories` (inicializada com a categoria padrão
  `{ id: 1, name: 'Geral' }`), `products` — schema conforme
  `../docs/schema-produtos.md` (tabela `STRICT`, FK para `categories` com
  `ON DELETE RESTRICT`, índices `idx_products_category_id` e
  `idx_products_created_at`) — além de `"tables"`, `"orders"` (com
  `status` e `closed_at`), `"order_items"` (snapshot de `unit_price` no
  item) e `"payments"` (fechamento de caixa; um pagamento por comanda,
  `method` em `dinheiro`/`cartao`/`pix`, `amount` em centavos).
- Pragmas na abertura: `foreign_keys = ON`, `journal_mode = WAL` e
  `busy_timeout = 5000`.
- Dados persistem entre execuções do servidor.
- **Encerramento gracioso:** `SIGINT`/`SIGTERM` (Ctrl+C ou `kill`) fecham o HTTP
  primeiro e depois o banco com checkpoint do WAL — dados íntegros no arquivo
  `data/suitesimula.db`, sem dependência de arquivos `-wal`/`-shm` temporários.

## Testes

Os testes usam o `node:test` nativo (sem dependências adicionais):

```bash
cd backend
npm install   # necessário uma vez, para as dependências de runtime
npm test
```

Os testes usam o banco real e limpam as tabelas de operação (`payments`,
`order_items`, `orders`, `tables`, `products`, `employees`) antes de cada
teste (além de zerar os contadores de ID), para não haver conflito de IDs
nem interferência entre testes. A categoria `Geral` (id 1) não é removida.

## Estrutura

```
backend/
├── package.json        # Manifesto e dependências
├── README.md           # Este arquivo
├── data/               # suitesimula.db (SQLite, criado na primeira execução)
├── tests/              # node:test — orders, tables, categories, products, reports
└── src/
    ├── server.js       # App Fastify (createApp) e shutdown gracioso
    ├── database.js     # SQLite, schema e migração leve
    ├── money.js        # formatBRL (centavos -> moeda)
    ├── paymentMethods.js # métodos/rótulos de pagamento e fuso do negócio
    └── routes/         # products, categories, tables, orders, reports, employees
```

## Próximos passos (escopo do CHARTER)

- Módulos de cardápio (produtos, categorias, adicionais), mesas/comandas,
  pedidos, estoque e caixa.
- Testes automatizados e documentação por módulo (definição de pronto).

**Limite explícito:** nenhuma funcionalidade fiscal (NF-e, cupom fiscal, SEFAZ) —
fora do escopo conforme o CHARTER.
