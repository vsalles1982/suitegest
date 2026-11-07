# Schema de Produtos — Persistência do Módulo de Cardápio

| Campo | Valor |
| --- | --- |
| Produto | Sistema de gestão não fiscal para restaurantes, pizzarias e lanchonetes |
| Módulo | Cardápio — persistência |
| Fase | 2 — revisado na Fase 5 |
| Responsável | Product Manager |
| Status | Alinhado à implementação real |
| Versão | 1.1 |
| Data | 2026-11-07 |

> **Fonte da verdade:** `backend/src/database.js` e
> `backend/src/routes/products.js`. O banco é criado inline, sem arquivos de
> migração `.sql` nesta versão.

## 1. Objetivo

Definir a versão persistida das tabelas `categories` e `products`, usando o
SQLite nativo do Node.js 24 (`node:sqlite`), sem instalar pacotes e sem gerar
custo.

Esta entrega cobre a base da persistência de produtos. Campos do backlog que
ainda não estão nesta versão — descrição, disponibilidade, status ativo, ordem
e vínculos com adicionais — entram em evoluções posteriores do schema.

## 2. Decisões de modelagem

- **Banco:** SQLite embarcado, em arquivo local, acessado pelo módulo nativo
  `node:sqlite` do Node.js 24. Não há servidor de banco, serviço externo ou
  dependência paga.
- **Arquivo do banco:** `backend/data/suitesimula.db`, ou o caminho definido na
  variável de ambiente `DATABASE_PATH`.
- **Inicialização inline:** o schema é um bloco de comandos
  `CREATE TABLE IF NOT EXISTS` executado por `backend/src/database.js`. Não há
  arquivos `.sql`, tabela de controle de migrações nem runner de migração nesta
  versão.
- **Conexão:** uma única conexão por processo, criada sob demanda na primeira
  operação que acessa o banco.
- **Nomenclatura:** tabela e colunas em inglês (`products`, `name`, `price`),
  seguindo o padrão técnico já usado pela API.
- **Preço:** armazenado como inteiro em centavos na coluna `price`. O nome
  `price` não muda a regra: nunca usar ponto flutuante para dinheiro.
- **Identificador:** inteiro, chave primária, gerado pelo banco e imutável.
- **Data de criação:** texto em ISO 8601, UTC, com milissegundos, gerado pelo
  banco. O cliente não informa `created_at`.
- **Integridade:** chave estrangeira para `categories`, unicidade de nome por
  categoria e validações declaradas no próprio schema.
- **Tabelas estritas:** `STRICT` impede que o SQLite aceite tipos incompatíveis
  por afinidade, especialmente texto ou decimal em `price`.

## 3. Tabelas e campos

### 3.1 `categories`

| Coluna | Tipo SQLite | Nulo | Padrão | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `INTEGER` | Não | Gerado | Chave primária, autoincremento, imutável. |
| `name` | `TEXT` | Não | — | Nome da categoria; único por igualdade exata. |

A tabela `categories` é pré-requisito da FK de `products`. O CRUD de categorias
está documentado em `docs/backlog-categorias.md`.

### 3.2 `products`

| Coluna | Tipo SQLite | Nulo | Padrão | Descrição |
| --- | --- | --- | --- | --- |
| `id` | `INTEGER` | Não | Gerado | Chave primária, autoincremento, imutável. |
| `name` | `TEXT` | Não | — | Nome do produto, de 2 a 80 caracteres após remover espaços das pontas. |
| `price` | `INTEGER` | Não | — | Preço em centavos, de 0 a 10.000.000. |
| `category_id` | `INTEGER` | Não | — | Referência obrigatória a `categories(id)`. |
| `created_at` | `TEXT` | Não | UTC agora | Data/hora de criação em ISO 8601 UTC. |

## 4. Regras de integridade

### 4.1 Regras aplicadas pelo banco

- **RI-01 — Chave primária:** `id` é `INTEGER PRIMARY KEY AUTOINCREMENT`, não
  aceita nulo, não se repete e não é reutilizado após exclusão.
- **RI-02 — Nome do produto obrigatório:** `name` não pode ser nulo nem vazio.
- **RI-03 — Tamanho do nome do produto:** após remover espaços das pontas,
  `name` deve ter entre 2 e 80 caracteres.
- **RI-04 — Nome único por categoria:** não pode existir dois produtos com o
  mesmo nome na mesma categoria, sem diferenciar maiúsculas de minúsculas para
  caracteres ASCII.
- **RI-05 — Preço obrigatório e inteiro:** `price` não pode ser nulo e, por a
  tabela ser `STRICT`, precisa ser inteiro; texto e números decimais são
  rejeitados.
- **RI-06 — Faixa do preço:** `price` deve estar entre 0 e 10.000.000 centavos,
  inclusive.
- **RI-07 — Categoria obrigatória:** `category_id` não pode ser nulo e precisa
  existir em `categories`.
- **RI-08 — Exclusão de categoria:** uma categoria referenciada por produto não
  pode ser excluída (`ON DELETE RESTRICT`).
- **RI-09 — Atualização de categoria:** se o `id` da categoria mudar, a
  referência é atualizada em cascata (`ON UPDATE CASCADE`).
- **RI-10 — Data de criação:** `created_at` não pode ser nulo e recebe o horário
  UTC atual quando o registro é inserido.
- **RI-11 — Integridade referencial ativa:** a conexão executa
  `PRAGMA foreign_keys = ON` na abertura. Sem isso, o SQLite não aplica a chave
  estrangeira.
- **RI-12 — Categoria única por igualdade exata:** `categories.name` é
  `NOT NULL UNIQUE`; a comparação do banco diferencia maiúsculas de minúsculas.

### 4.2 Regras complementares da aplicação

Estas regras não são totalmente expressáveis no schema e são garantidas pela
API e pelos testes:

- Remover espaços das pontas de `products.name` antes de gravar.
- Rejeitar `price` decimal, negativo, acima do limite ou enviado como texto
  formatado (ex.: `"R$ 12,90"`).
- Rejeitar `category_id` inexistente com erro de negócio adequado, antes de
  depender apenas do erro de chave estrangeira.
- Não permitir alteração de `id` nem de `created_at`.
- Não aceitar `created_at` enviado pelo cliente.
- Garantir as regras de categoria ativa quando esse campo existir; o schema
  desta versão valida a existência, não o status.
- Gerar `priceFormatted` e `categoryName` na leitura, sem persistir esses
  valores.

### 4.3 Limitações conhecidas

- `COLLATE NOCASE` do SQLite compara apenas letras ASCII sem diferenciar
  maiúsculas de minúsculas. Para nomes com acentos, a API deve normalizar o
  texto antes de comparar e gravar.
- `categories.name` usa unicidade exata e diferencia maiúsculas de minúsculas.
- A validação de caracteres especiais em nomes de categoria não existe nesta
  versão; ver `docs/backlog-categorias.md`.

## 5. SQL exato executado na inicialização

O bloco abaixo é a parte de `SCHEMA_SQL` em `backend/src/database.js`
responsável por categorias, produtos e índices. O mesmo bloco também cria as
tabelas da Fase 6 (`tables` e `orders`), fora do escopo deste documento.

```sql
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
```

### 5.1 Por que inline

A decisão da Fase 5 foi manter a criação do schema inline, no próprio
`database.js`, para simplificar a primeira versão e evitar um runner de
migrações antes de existir necessidade real de evolução coordenada.

- `CREATE TABLE IF NOT EXISTS` torna a execução idempotente.
- A ordem das instruções garante que `categories` exista antes de `products`.
- Não há tabela `schema_migrations` nesta versão.
- Não há arquivos `001_*.sql` nem execução de scripts externos.
- O SQL acima é o contrato efetivamente executado pelo servidor.

## 6. Inicialização na primeira subida do servidor

A inicialização do banco é **lazy**: acontece na primeira chamada de
`getDatabase()`, normalmente na primeira requisição que acessa dados. O servidor
Fastify pode começar a escutar antes disso.

Fluxo efetivo:

1. **Verificar a versão do Node.js.** O projeto exige Node.js 24 ou superior,
   por causa do módulo nativo `node:sqlite`.
2. **Resolver o caminho do banco.** Usar `DATABASE_PATH`, quando definida; caso
   contrário, usar `backend/data/suitesimula.db`.
3. **Garantir a pasta.** Criar o diretório do arquivo caso ele não exista. O
   banco em arquivo é criado automaticamente na primeira abertura.
4. **Abrir a conexão.** Criar uma única conexão SQLite com `DatabaseSync`, sem
   instalar dependências.
5. **Configurar a conexão.** Executar, nesta ordem:
   `PRAGMA busy_timeout = 5000`, `PRAGMA foreign_keys = ON` e
   `PRAGMA journal_mode = WAL`. Os pragmas são executados fora de transação.
6. **Criar o schema inline.** Executar o bloco `SCHEMA_SQL` com
   `CREATE TABLE IF NOT EXISTS` e `CREATE INDEX IF NOT EXISTS`. Na primeira vez,
   as tabelas são criadas; nas seguintes, nada é recriado.
7. **Garantir a categoria padrão.** Executar
   `INSERT OR IGNORE INTO categories (id, name) VALUES (1, 'Geral')`.
8. **Reutilizar a conexão.** Guardar a instância em memória e devolvê-la nas
   chamadas seguintes, sem reabrir o banco a cada requisição.
9. **Persistir entre reinícios.** Os dados permanecem no arquivo
   `suitesimula.db`; o modo WAL também cria os arquivos auxiliares
   `suitesimula.db-wal` e `suitesimula.db-shm`.

Comportamento em caso de falha:

- Um erro na abertura ou no SQL propaga para a operação que chamou
  `getDatabase()`.
- O processo não apaga, recria nem sobrescreve o banco automaticamente.
- Não há transação envolvendo a criação do schema nesta versão.
- Não há verificação antecipada no boot; a falha aparece na primeira operação
  que usa o banco.

## 7. Mapeamento entre banco e API

| Banco (`products`) | API | Observação |
| --- | --- | --- |
| `id` | `id` | Mesmo valor. |
| `name` | `name` | Texto já normalizado com `trim`. |
| `price` | `price` | Inteiro em centavos, sem conversão. |
| derivado de `price` | `priceFormatted` | Gerado na leitura; não persistido. |
| `category_id` | `categoryId` | Conversão de nome no adaptador de persistência. |
| derivado de `category_id` | `categoryName` | Nome resolvido na leitura; não persistido. |
| `created_at` | `createdAt` | ISO 8601 UTC. |

Toda consulta usa parâmetros vinculados, nunca concatenação de valores na
instrução SQL.

## 8. Verificações após a criação

Comandos de inspeção que podem ser executados no banco de desenvolvimento:

```sql
PRAGMA table_info(products);
PRAGMA foreign_key_list(products);
PRAGMA index_list(products);
PRAGMA journal_mode;
SELECT id, name FROM categories ORDER BY id;
```

Resultados esperados:

- `products` com exatamente as colunas `id`, `name`, `price`, `category_id` e
  `created_at`.
- Chave estrangeira de `category_id` apontando para `categories(id)`.
- Índices `idx_products_category_id`, `idx_products_created_at` e o índice
  automático da restrição de unicidade.
- `journal_mode` igual a `wal`.
- Categoria `Geral` com `id = 1` presente após a inicialização.
- Nenhuma tabela `schema_migrations` nesta versão.

## 9. Critérios de aceite

- [ ] **AC-SCHEMA-01** — Na primeira inicialização, o bloco inline cria
  `categories` e `products` com as colunas previstas.
- [ ] **AC-SCHEMA-02** — `products.id` é gerado automaticamente e não aceita
  nulo.
- [ ] **AC-SCHEMA-03** — Inserir produto sem `name` ou com nome vazio falha.
- [ ] **AC-SCHEMA-04** — Inserir nome com menos de 2 ou mais de 80 caracteres
  falha.
- [ ] **AC-SCHEMA-05** — Inserir dois produtos com o mesmo nome na mesma
  categoria, ignorando maiúsculas/minúsculas ASCII, falha.
- [ ] **AC-SCHEMA-06** — O mesmo nome de produto em categorias diferentes é
  aceito.
- [ ] **AC-SCHEMA-07** — Inserir `price` decimal, texto ou nulo falha.
- [ ] **AC-SCHEMA-08** — Inserir `price` negativo ou acima de 10.000.000 falha.
- [ ] **AC-SCHEMA-09** — Inserir produto com `category_id` inexistente falha
  quando a integridade referencial está ativa.
- [ ] **AC-SCHEMA-10** — Excluir categoria com produto vinculado falha.
- [ ] **AC-SCHEMA-11** — `created_at` é preenchido automaticamente em UTC.
- [ ] **AC-SCHEMA-12** — O arquivo padrão é `backend/data/suitesimula.db` e
  `DATABASE_PATH` sobrescreve o caminho.
- [ ] **AC-SCHEMA-13** — Executar a inicialização duas vezes no mesmo arquivo
  não duplica tabelas, índices nem a categoria `Geral`.
- [ ] **AC-SCHEMA-14** — Reiniciar o servidor preserva os produtos gravados.
- [ ] **AC-SCHEMA-15** — A conexão aplica `foreign_keys = ON`,
  `journal_mode = WAL` e `busy_timeout = 5000`.
- [ ] **AC-SCHEMA-16** — Falha na inicialização não apaga nem sobrescreve o
  banco existente.
- [ ] **AC-SCHEMA-17** — Nenhum arquivo `.sql`, runner de migração ou tabela
  `schema_migrations` é necessário para criar o banco.
- [ ] **AC-SCHEMA-18** — Nenhuma dependência paga ou pacote externo de banco é
  necessário.

## 10. Notas de implementação (Fase 5)

- A criação do schema passou a ser **inline**, em `backend/src/database.js`, com
  `CREATE TABLE IF NOT EXISTS` e `CREATE INDEX IF NOT EXISTS`.
- O arquivo do banco é `suitesimula.db` — caminho padrão
  `backend/data/suitesimula.db`, com override por `DATABASE_PATH`.
- A promessa anterior de migrações versionadas em arquivos `.sql` e tabela
  `schema_migrations` foi removida. Ela não corresponde ao código atual.
- Não há transação em volta do DDL nem bloqueio de subida do servidor em caso
  de falha; a inicialização é lazy e o erro aparece na primeira operação que
  usa o banco.
- A categoria `Geral` é garantida com `INSERT OR IGNORE` a cada inicialização
  de processo, sem sobrescrever um nome já alterado no `id = 1`.
- O mesmo bloco inline também cria `tables` e `orders` da Fase 6.
- O Frontend e as rotas de produtos consomem o schema como ele está; alterações
  de colunas exigem coordenação entre Backend, Frontend e QA.

## 11. Melhorias futuras

- Adotar migrações versionadas em arquivos `.sql`, executadas em ordem e
  registradas em `schema_migrations`.
- Envolver cada migração em transação e registrar falhas sem deixar schema
  parcial.
- Inicializar e validar o banco no boot, falhando rápido antes de aceitar
  requisições.
- Criar rotina de backup do arquivo antes de mudanças destrutivas.
- Adicionar `updated_at`, status ativo e demais campos do backlog de produtos
  por novas migrações.
- Revisar restrições de nome e unicidade de categorias.
- Documentar e testar o comportamento com múltiplos processos concorrentes.

## 12. Fora do escopo desta versão

- Runner de migrações e arquivos `.sql`.
- Tabela `schema_migrations`.
- Descrição, disponibilidade, status ativo e ordem do produto.
- Vínculos com adicionais.
- Histórico de preços, auditoria e exclusão lógica.
- Backup automático, replicação e acesso concorrente por múltiplos processos.
- Interface de administração do banco.
