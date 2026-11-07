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
| GET    | `/tables`          | Lista mesas, ordenadas por número                | Array de `{ id, number, status }`                   |
| POST   | `/tables`          | Cadastra mesa (status inicial `free`)            | `{ id, number, status }` (201)                      |
| PUT    | `/tables/:id/status` | Fecha (`closed`) ou libera (`free`) a mesa     | `{ id, number, status }` (200)                      |
| POST   | `/orders`          | Abre comanda para mesa, com itens iniciais       | Comanda com `items`, `total`, `totalFormatted` (201)|
| GET    | `/orders/:id`      | Consulta comanda com itens, subtotais e total    | Comanda com `items`, `total`, `totalFormatted` (200)|
| POST   | `/orders/:id/close`| Fecha a comanda (itens, preços e mesa intactos)  | Comanda com `status: "closed"` (200)                |

- **Ciclo da mesa (Fase 8, `docs/backlog-fase8.md`):** abrir comanda →
  `POST /orders/:id/close` (mesa continua `occupied`) → `PUT /tables/:id/status`
  `closed` (exige comanda fechada) → `PUT /tables/:id/status` `free`.
- `409` para estados incompatíveis (comanda/mesa já fechada, mesa com comanda
  aberta, transições proibidas); `400` para destino `occupied`/corpo inválido;
  `404` para recurso inexistente.

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
  `{ id: 1, name: 'Geral' }`) e `products` — schema conforme
  `../docs/schema-produtos.md` (tabela `STRICT`, FK para `categories` com
  `ON DELETE RESTRICT`, índices `idx_products_category_id` e
  `idx_products_created_at`).
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

Os testes usam o banco real e limpam a tabela `products` antes de cada teste
(além de zerar o contador de IDs), para não haver conflito de IDs nem
interferência entre testes. A categoria `Geral` (id 1) não é removida.

## Estrutura

```
backend/
├── package.json        # Manifesto e dependências
├── README.md           # Este arquivo
└── src/
    └── server.js       # Servidor Fastify e rotas iniciais
```

## Próximos passos (escopo do CHARTER)

- Módulos de cardápio (produtos, categorias, adicionais), mesas/comandas,
  pedidos, estoque e caixa.
- Testes automatizados e documentação por módulo (definição de pronto).

**Limite explícito:** nenhuma funcionalidade fiscal (NF-e, cupom fiscal, SEFAZ) —
fora do escopo conforme o CHARTER.
