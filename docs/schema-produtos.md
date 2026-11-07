# Schema de Produtos — Persistência do Módulo de Cardápio

| Campo | Valor |
| --- | --- |
| Produto | Sistema de gestão não fiscal para restaurantes, pizzarias e lanchonetes |
| Módulo | Cardápio — persistência |
| Fase | 2 |
| Responsável | Product Manager |
| Status | Pronto para implementação |
| Versão | 1.0 |
| Data | 2026-11-07 |

## 1. Objetivo

Definir a primeira versão persistida da tabela `products`, usando o SQLite
nativo do Node.js 24 (`node:sqlite`), sem instalar pacotes e sem gerar custo.

Esta entrega cobre somente a base da persistência de produtos. Campos do
backlog que ainda não estão nesta versão — descrição, disponibilidade, status
ativo, ordem e vínculos com adicionais — entram em migrações posteriores.

## 2. Decisões de modelagem

- **Banco:** SQLite embarcado, em arquivo local, acessado pelo módulo nativo
  `node:sqlite` do Node.js 24. Não há servidor de banco, serviço externo ou
  dependência paga.
- **Nomenclatura:** tabela e colunas em inglês (`products`, `name`, `price`),
  seguindo o padrão técnico já usado pela API.
- **Preço:** armazenado como inteiro em centavos na coluna `price`. O nome
  `price` não muda a regra: nunca usar ponto flutuante para dinheiro.
- **Identificador:** inteiro, chave primária, gerado pelo banco e imutável.
- **Data de criação:** texto em ISO 8601, UTC, com milissegundos, gerado pelo
  banco. O cliente não informa `created_at`.
- **Integridade:** chave estrangeira para `categories`, unicidade de nome por
  categoria e validações declaradas no próprio schema.
- **Tabela estrita:** `STRICT` impede que o SQLite aceite tipos incompatíveis
  por afinidade, especialmente texto ou decimal em `price`.

## 3. Campos da tabela `products`

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
- **RI-02 — Nome obrigatório:** `name` não pode ser nulo nem vazio.
- **RI-03 — Tamanho do nome:** após remover espaços das pontas, `name` deve ter
  entre 2 e 80 caracteres.
- **RI-04 — Nome único por categoria:** não pode existir dois produtos com o
  mesmo nome na mesma categoria, sem diferenciar maiúsculas de minúsculas.
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
- **RI-11 — Integridade referencial ativa:** a conexão deve executar
  `PRAGMA foreign_keys = ON` em toda abertura. Sem isso, o SQLite não aplica a
  chave estrangeira.

### 4.2 Regras complementares da aplicação

Estas regras não são totalmente expressáveis no schema e devem ser garantidas
pela API e pelos testes:

- Remover espaços das pontas de `name` antes de gravar, para que `"Pizza"` e
  `" Pizza "` sejam considerados o mesmo nome.
- Rejeitar `price` decimal, negativo, acima do limite ou enviado como texto
  formatado (ex.: `"R$ 12,90"`).
- Rejeitar `category_id` inexistente com erro de negócio adequado, antes de
  depender apenas do erro de chave estrangeira.
- Não permitir alteração de `id` nem de `created_at`.
- Não aceitar `created_at` enviado pelo cliente.
- Garantir que a categoria esteja ativa nas regras do Módulo de Cardápio; o
  schema desta versão valida a existência, não o status.
- Gerar `priceFormatted` na leitura, a partir de `price`, sem persistir o valor
  formatado.

### 4.3 Limitação conhecida

`COLLATE NOCASE` do SQLite compara apenas letras ASCII sem diferenciar
maiúsculas de minúsculas. Para nomes com acentos, a API deve normalizar o texto
antes de comparar e gravar. A unicidade no banco continua sendo a última linha
de defesa.

## 5. SQL exato de criação

### 5.1 Pré-requisito

A tabela `products` referencia `categories(id)`. Portanto, a tabela `categories`
deve existir antes desta migração. O schema de categorias será documentado em
arquivo próprio e aplicado antes de `001_create_products.sql`.

Se o banco estiver vazio e apenas este SQL for executado, a tabela `products`
é criada, mas inserções falharão até que `categories` exista.

### 5.2 Migração `001_create_products.sql`

```sql
-- 001_create_products.sql
-- Pré-requisito: tabela categories já criada, com chave primária id INTEGER.
-- Executar com PRAGMA foreign_keys = ON antes da transação.

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

### 5.3 Controle de migrações

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
             DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
```

Cada arquivo de migração aplicado deve ser registrado em
`schema_migrations.version` com o nome do arquivo, por exemplo
`001_create_products.sql`. O registro só é gravado após o sucesso da migração.

## 6. Inicialização na primeira subida do servidor

A inicialização acontece antes de o servidor aceitar requisições:

1. **Verificar a versão do Node.js.** O processo exige Node.js 24 ou superior,
   por causa do módulo nativo `node:sqlite`.
2. **Resolver o caminho do banco.** Usar a variável de ambiente
   `DATABASE_PATH`, quando definida; caso contrário, usar
   `data/suitesimulafuncoes.db` na raiz do backend.
3. **Garantir a pasta.** Criar o diretório do arquivo caso ele não exista. O
   banco em arquivo é criado automaticamente na primeira abertura.
4. **Abrir a conexão.** Abrir uma única conexão SQLite pelo módulo nativo
   `node:sqlite`, sem instalar dependências.
5. **Configurar a conexão.** Executar `PRAGMA foreign_keys = ON`,
   `PRAGMA journal_mode = WAL` e `PRAGMA busy_timeout = 5000`. O
   `PRAGMA foreign_keys` deve ser executado fora de transação, pois dentro dela
   não tem efeito.
6. **Garantir o controle de migrações.** Criar `schema_migrations` se ainda não
   existir e consultar as versões já aplicadas.
7. **Aplicar migrações pendentes em ordem.** Para cada arquivo ainda não
   registrado, na ordem lexical (`001_`, `002_`, ...), abrir uma transação,
   executar o SQL, registrar a versão e confirmar. Em caso de erro, desfazer a
   transação.
8. **Criar a tabela na primeira vez.** Como `products` usa
   `CREATE TABLE IF NOT EXISTS`, a execução é idempotente. Na primeira subida, a
   tabela é criada vazia; nas seguintes, nada é recriado.
9. **Liberar o servidor.** Somente depois de todas as migrações concluídas o
   servidor começa a aceitar requisições.
10. **Falhar rápido.** Se qualquer migração falhar, o processo deve registrar o
    erro e encerrar a inicialização. Não apagar, recriar ou sobrescrever o banco
    automaticamente.

Comportamento resultante:

- Primeira subida em banco vazio: cria o arquivo, `schema_migrations` e
  `products`, e registra `001_create_products.sql`.
- Subidas seguintes: as migrações já registradas são ignoradas e os dados
  persistem no arquivo.
- O cardápio começa vazio; nenhum dado de exemplo é obrigatório.
- Uma migração futura deve ser um novo arquivo numerado, nunca uma edição do
  arquivo já aplicado.

## 7. Mapeamento entre banco e API

| Banco (`products`) | API | Observação |
| --- | --- | --- |
| `id` | `id` | Mesmo valor. |
| `name` | `name` | Texto já normalizado. |
| `price` | `price` | Inteiro em centavos, sem conversão. |
| derivado de `price` | `priceFormatted` | Gerado na leitura; não persistido. |
| `category_id` | `categoryId` | Conversão de nome no adaptador de persistência. |
| `created_at` | `createdAt` | ISO 8601 UTC. |

Toda consulta deve usar parâmetros vinculados, nunca concatenar valores na
instrução SQL.

## 8. Verificações após a criação

Comandos de inspeção que podem ser executados no banco de desenvolvimento:

```sql
PRAGMA table_info(products);
PRAGMA foreign_key_list(products);
PRAGMA index_list(products);
SELECT version, applied_at FROM schema_migrations ORDER BY version;
```

Resultados esperados:

- `products` com exatamente as colunas `id`, `name`, `price`, `category_id` e
  `created_at`.
- Chave estrangeira de `category_id` apontando para `categories(id)`.
- Índices `idx_products_category_id`, `idx_products_created_at` e o índice
  automático da restrição de unicidade.
- Migração `001_create_products.sql` registrada uma única vez.

## 9. Critérios de aceite

- [ ] **AC-SCHEMA-01** — Em banco vazio com `categories` existente, a migração
  cria `products` com as cinco colunas previstas.
- [ ] **AC-SCHEMA-02** — `id` é gerado automaticamente e não aceita nulo.
- [ ] **AC-SCHEMA-03** — Inserir produto sem `name` ou com nome vazio falha.
- [ ] **AC-SCHEMA-04** — Inserir nome com menos de 2 ou mais de 80 caracteres
  falha.
- [ ] **AC-SCHEMA-05** — Inserir dois produtos com o mesmo nome na mesma
  categoria, ignorando maiúsculas/minúsculas, falha.
- [ ] **AC-SCHEMA-06** — O mesmo nome em categorias diferentes é aceito.
- [ ] **AC-SCHEMA-07** — Inserir `price` decimal, texto ou nulo falha.
- [ ] **AC-SCHEMA-08** — Inserir `price` negativo ou acima de 10.000.000 falha.
- [ ] **AC-SCHEMA-09** — Inserir produto com `category_id` inexistente falha
  quando a integridade referencial está ativa.
- [ ] **AC-SCHEMA-10** — Excluir categoria com produto vinculado falha.
- [ ] **AC-SCHEMA-11** — `created_at` é preenchido automaticamente em UTC.
- [ ] **AC-SCHEMA-12** — Executar a inicialização duas vezes não duplica
  tabelas, índices nem registros de migração.
- [ ] **AC-SCHEMA-13** — Reiniciar o servidor preserva os produtos gravados.
- [ ] **AC-SCHEMA-14** — Falha de migração impede a subida do servidor e não
  apaga o banco existente.
- [ ] **AC-SCHEMA-15** — Nenhuma dependência paga ou pacote externo de banco é
  necessário.

## 10. Fora do escopo desta versão

- Tabela `categories` e seus campos (documentada separadamente).
- Descrição, disponibilidade, status ativo e ordem do produto.
- Vínculos com adicionais.
- Histórico de preços, auditoria e exclusão lógica.
- Backup automático, replicação e acesso concorrente por múltiplos processos.
- Interface de administração do banco.
