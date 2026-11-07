# Backlog — CRUD de Categorias (Fase 2, revisado na Fase 5)

| Campo | Valor |
| --- | --- |
| Produto | Sistema de gestão não fiscal para restaurantes, pizzarias e lanchonetes |
| Módulo | Cardápio — Categorias |
| Fase | 2 — revisado na Fase 5 |
| Responsável | Product Manager |
| Status | Alinhado à implementação real |
| Versão | 1.1 |
| Data | 2026-11-07 |

> **Fonte da verdade:** a implementação em `backend/src/routes/categories.js` e o
> schema em `backend/src/database.js`. O Frontend já foi integrado a esse
> contrato. Alterações de comportamento exigem coordenação com Frontend e QA.

## 1. Contexto e objetivo

As categorias organizam o cardápio e são referenciadas pelos produtos. Esta
entrega define o CRUD de categorias sobre a tabela `categories` já existente,
com as colunas `id` e `name`.

**Objetivo:** permitir criar, listar, renomear e excluir categorias, com
validação de nome e proteção da integridade dos produtos que as utilizam.

**Resultado esperado:** o estabelecimento consegue manter categorias como
Pizzas, Bebidas e Sobremesas, e o Módulo de Cardápio passa a ter uma fonte
confiável para classificar produtos.

## 2. Escopo

### 2.1 Dentro do escopo

- Listagem de categorias.
- Criação de categoria com nome validado.
- Renomeação de categoria existente.
- Exclusão de categoria sem produtos vinculados.
- Bloqueio de exclusão de categoria com produtos vinculados.
- Mensagens de erro padronizadas e documentação do módulo.

### 2.2 Fora do escopo

- Alterar o schema da tabela `categories`; ela já existe com `id` e `name`.
- Campos adicionais como descrição, ordem de exibição, cor, imagem ou status
  ativo.
- Exclusão lógica, uma vez que a tabela não possui coluna de status.
- Paginação, busca textual e filtros na listagem.
- Criação ou edição de produtos por esta API.
- Autenticação, permissões e auditoria.
- Qualquer funcionalidade fiscal.

## 3. Entidade Categoria

| Campo | Tipo | Obrigatório | Regra implementada |
| --- | --- | --- | --- |
| `id` | Inteiro | Sim (gerado) | Chave primária gerada pelo banco; imutável. |
| `name` | Texto | Sim | Texto de 2 a 80 caracteres após remover espaços das pontas. |

### 3.1 Estado atual do banco

- A tabela `categories` já existe com `id` e `name`.
- `id` é inteiro, chave primária, com autoincremento.
- `name` é obrigatório e possui restrição de unicidade exata no banco.
- A comparação de unicidade diferencia maiúsculas de minúsculas.
- A categoria padrão `Geral`, com `id = 1`, é inserida na inicialização com
  `INSERT OR IGNORE`.
- O banco fica em `backend/data/suitesimula.db`, ou no caminho definido por
  `DATABASE_PATH`.

## 4. Regras de negócio implementadas

- **RN-01 — Nome obrigatório:** `name` deve ser enviado como texto. Ausente,
  nulo, vazio, apenas com espaços ou de outro tipo retorna 400.
- **RN-02 — Normalização:** apenas remover espaços das pontas com `trim`.
  Espaços internos repetidos são preservados.
- **RN-03 — Tamanho:** após o `trim`, o nome deve ter de 2 a 80 caracteres,
  inclusive.
- **RN-04 — Conteúdo livre:** não há bloqueio de caracteres especiais, símbolos,
  números ou emojis. Qualquer texto que atenda ao tamanho é aceito.
- **RN-05 — Ausência de validação de letras:** nomes como `123`, `---` ou
  `Pizzas & Cia` são aceitos.
- **RN-06 — Unicidade exata:** não pode existir outra categoria com exatamente
  o mesmo texto. A comparação diferencia maiúsculas de minúsculas e considera
  espaços internos.
- **RN-07 — Variação de caixa permitida:** `Bebidas` e `bebidas` são nomes
  diferentes e podem coexistir.
- **RN-08 — Categoria padrão sem proteção:** `Geral` pode ser renomeada ou
  excluída se não tiver produtos. Se for excluída, será recriada com `id = 1`
  na próxima inicialização do banco.
- **RN-09 — Integridade com produtos:** uma categoria com qualquer produto
  vinculado não pode ser excluída. A API responde 400 e orienta remover ou
  mover os produtos.
- **RN-10 — Renomeação:** renomear uma categoria não altera os produtos
  vinculados; o vínculo é feito por `id`.
- **RN-11 — Exclusão física:** como a tabela não possui status ativo, excluir
  uma categoria sem produtos remove o registro definitivamente.
- **RN-12 — Identificador imutável:** `id` nunca é enviado pelo cliente nem
  alterado em uma atualização. Um `id` inválido retorna 400.
- **RN-13 — Listagem sem paginação:** todas as categorias são retornadas em uma
  única resposta, ordenadas por `id` crescente.
- **RN-14 — Erros padronizados:** falhas retornam um objeto com a chave
  `error`, sem expor stack trace, SQL ou caminhos internos.

## 5. Endpoints implementados

Base: raiz da API, sem prefixo de versão. Todas as requisições e respostas usam
JSON.

| Método | Caminho | Descrição | Sucesso | Erros previstos |
| --- | --- | --- | --- | --- |
| GET | `/categories` | Lista todas as categorias por `id`. | 200 | 500 |
| POST | `/categories` | Cria uma categoria. | 201 | 400, 409, 500 |
| PUT | `/categories/:id` | Renomeia uma categoria existente. | 200 | 400, 404, 409, 500 |
| DELETE | `/categories/:id` | Exclui uma categoria sem produtos. | 200 | 400, 404, 409, 500 |

### 5.1 GET /categories

- Executa `SELECT * FROM categories ORDER BY id`.
- Retorna todas as categorias, sem paginação.
- Cada item contém somente `id` e `name`.
- A categoria `Geral` também é retornada enquanto existir.
- Lista vazia retorna 200 com coleção vazia, nunca 404.

### 5.2 POST /categories

- Corpo aceito: somente `name`; campos extras são ignorados.
- Valida o tipo e o tamanho do nome após `trim`.
- Verifica duplicidade exata antes de inserir.
- Retorna 201 com `id` gerado e `name` já sem espaços nas pontas.
- Nome duplicado exato retorna 409.
- Nome ausente, não textual ou fora do tamanho retorna 400.
- Violação de unicidade do banco também é convertida em 409.

### 5.3 PUT /categories/:id

- Substitui o nome da categoria identificada por `:id`.
- Corpo aceito: somente `name`; campos extras são ignorados.
- Aplica as mesmas regras de validação do cadastro.
- Mantém `id` inalterado.
- Categoria inexistente retorna 404.
- `id` não inteiro, menor que 1 ou inválido retorna 400.
- Nome duplicado exato em outra categoria retorna 409.
- Renomear para o mesmo nome atual, variando apenas maiúsculas/minúsculas, é
  permitido e retorna 200.

### 5.4 DELETE /categories/:id

- Exclui definitivamente a categoria quando não há produtos vinculados.
- Sucesso retorna 200 com o corpo `{ "status": "deleted", "category": { "id": 1, "name": "..." } }`.
- Categoria inexistente retorna 404.
- `id` inválido retorna 400.
- Categoria com pelo menos um produto vinculado retorna 400 e não é removida.
- A categoria padrão `Geral` não tem proteção especial: pode ser excluída se
  não houver produtos.
- Violação de integridade inesperada do banco é convertida em 409.

### 5.5 Formato de erro

Todas as falhas tratadas retornam um objeto com a chave `error` e uma mensagem
em português, sem expor detalhes internos.

| Código | Uso |
| --- | --- |
| 400 | Corpo inválido, nome inválido, `id` inválido ou categoria com produtos. |
| 404 | Categoria não encontrada no `PUT` ou no `DELETE`. |
| 409 | Nome duplicado exato ou violação de unicidade do banco. |
| 500 | Erro interno inesperado. |

## 6. Critérios de aceite

### 6.1 Gerais

- [ ] **AC-CAT-01** — Os quatro endpoints respondem em JSON nos caminhos
  definidos.
- [ ] **AC-CAT-02** — Erros tratados retornam `{ "error": "..." }`, com mensagem
  clara e sem detalhes internos.
- [ ] **AC-CAT-03** — Nenhuma dependência paga ou pacote externo de banco é
  adicionado.
- [ ] **AC-CAT-04** — O módulo tem documentação e testes automatizados
  aprovados.

### 6.2 GET /categories

- [ ] **AC-CAT-05** — Retorna 200 e todas as categorias cadastradas.
- [ ] **AC-CAT-06** — Cada item contém apenas `id` e `name`.
- [ ] **AC-CAT-07** — A ordenação é crescente por `id`.
- [ ] **AC-CAT-08** — Sem categorias, retorna 200 com coleção vazia.
- [ ] **AC-CAT-09** — Em banco recém-inicializado, a categoria `Geral` (`id = 1`)
  aparece na listagem.

### 6.3 POST /categories

- [ ] **AC-CAT-10** — Criar com nome válido retorna 201, `id` gerado e `name`
  sem espaços nas pontas.
- [ ] **AC-CAT-11** — Nome ausente, nulo, vazio, só com espaços ou não textual
  retorna 400.
- [ ] **AC-CAT-12** — Nome com menos de 2 ou mais de 80 caracteres após `trim`
  retorna 400.
- [ ] **AC-CAT-13** — Espaços nas pontas são removidos.
- [ ] **AC-CAT-14** — Espaços internos repetidos são preservados.
- [ ] **AC-CAT-15** — Caracteres especiais, números e emojis são aceitos quando
  o tamanho é válido.
- [ ] **AC-CAT-16** — Nome duplicado exato retorna 409.
- [ ] **AC-CAT-17** — Nomes que diferem apenas por maiúsculas/minúsculas são
  aceitos; por exemplo, `Bebidas` e `bebidas`.
- [ ] **AC-CAT-18** — A categoria criada persiste após reinício do servidor.

### 6.4 PUT /categories/:id

- [ ] **AC-CAT-19** — Renomear categoria existente com nome válido retorna 200
  e o novo nome.
- [ ] **AC-CAT-20** — O `id` permanece o mesmo após a renomeação.
- [ ] **AC-CAT-21** — Renomear categoria inexistente retorna 404.
- [ ] **AC-CAT-22** — Nome inválido no `PUT` retorna 400 com as mesmas regras do
  `POST`.
- [ ] **AC-CAT-23** — `id` não inteiro, menor que 1 ou inválido retorna 400.
- [ ] **AC-CAT-24** — Renomear para um nome exato já usado por outra categoria
  retorna 409.
- [ ] **AC-CAT-25** — Renomear uma categoria mantém os produtos vinculados e
  suas referências intactas.
- [ ] **AC-CAT-26** — Alterar apenas a caixa do próprio nome é permitido e
  retorna 200.

### 6.5 DELETE /categories/:id

- [ ] **AC-CAT-27** — Excluir categoria sem produtos retorna 200 com
  `status: "deleted"` e os dados da categoria removida.
- [ ] **AC-CAT-28** — Excluir categoria inexistente retorna 404.
- [ ] **AC-CAT-29** — Excluir categoria com produto vinculado retorna 400, não
  remove o registro e informa a quantidade de produtos.
- [ ] **AC-CAT-30** — `id` não inteiro, menor que 1 ou inválido retorna 400.
- [ ] **AC-CAT-31** — Após a exclusão, a categoria não aparece mais na listagem.
- [ ] **AC-CAT-32** — A categoria `Geral` pode ser excluída quando não tem
  produtos e é recriada na próxima inicialização do banco.
- [ ] **AC-CAT-33** — A exclusão remove o registro do banco, não apenas da
  listagem.

## 7. Requisitos não funcionais

- **Free First:** usar somente SQLite e recursos já disponíveis; sem serviço
  pago, pacote externo de banco ou API externa.
- **Consistência:** validar o nome na API mesmo que a interface também valide.
- **Integridade:** a checagem de produtos vinculados acontece antes da exclusão;
  a FK `ON DELETE RESTRICT` permanece como última defesa.
- **Concorrência:** a restrição `UNIQUE` do banco cobre duplicidade exata; em
  caso de corrida, o erro é convertido em 409.
- **Desempenho:** a listagem deve responder em até 300 ms no ambiente local com
  até 200 categorias.
- **Segurança:** consultas parametrizadas, entradas validadas e erros internos
  não expostos.
- **Limite fiscal:** o módulo não calcula impostos nem gera documento fiscal.

## 8. Notas de implementação (Fase 5)

Esta seção registra as diferenças entre o backlog original e a implementação
que foi integrada ao Frontend. O comportamento abaixo é o contrato vigente.

| Tema | Backlog original | Implementação atual |
| --- | --- | --- |
| Tamanho do nome | 2 a 60 caracteres | 2 a 80 caracteres |
| Caracteres especiais | Bloqueados | Não há bloqueio; qualquer texto é aceito |
| Letra obrigatória | Sim | Não há exigência de letra |
| Normalização | Espaços internos reduzidos | Apenas `trim` nas pontas |
| Unicidade | Sem diferenciar maiúsculas | Exata e sensível a maiúsculas/minúsculas |
| Categoria padrão | `Geral` protegida | Pode ser excluída se não tiver produtos |
| Ordenação da listagem | Alfabética | Por `id` crescente |
| DELETE com sucesso | 204 sem corpo | 200 com `{ status, category }` |
| DELETE com produtos | 409 | 400 |
| `id` inválido | Não especificado | 400 |

Consequências conhecidas:

- `Bebidas` e `bebidas` podem coexistir, embora sejam visualmente semelhantes.
- Nomes como `Pizzas & Cia`, `123` ou com emoji são aceitos.
- Espaços internos duplicados são preservados, por exemplo `Pizzas  Doces`.
- Excluir `Geral` sem produtos faz a categoria reaparecer após reiniciar o
  servidor, pois a inicialização executa `INSERT OR IGNORE` para `id = 1`.
- O Frontend deve tratar `DELETE` de sucesso como 200 com corpo, não como 204.
- O Frontend não pode depender de ordenação alfabética; a lista vem por `id`.

Melhorias futuras, não implementadas nesta fase:

- Validar caracteres permitidos e exigir ao menos uma letra.
- Tornar a unicidade insensível a maiúsculas/minúsculas e normalizar espaços
  internos.
- Definir se `Geral` deve ser protegida contra exclusão e renomeação.
- Padronizar o código de conflito de exclusão com produtos em 409.
- Adicionar paginação e busca quando o volume justificar.

## 9. Riscos e decisões pendentes

| Risco | Impacto | Mitigação atual |
| --- | --- | --- |
| Nomes com caracteres especiais | Dados inconsistentes ou difíceis de exibir | Aceitos por decisão de implementação; validação futura. |
| Duplicatas por caixa | Confusão visual e operacional | Unicidade exata no banco; avaliação futura. |
| Exclusão de `Geral` | Categoria reaparece após reinício | Comportamento conhecido e documentado. |
| `DELETE` com 400 em vez de 409 | Semântica HTTP menos precisa | Frontend já integrado ao 400; mudança exige coordenação. |
| Sem versionamento de migrations | Evolução do schema menos rastreável | Registrado como melhoria futura no `docs/schema-produtos.md`. |

Decisões que exigem aprovação do fundador antes de mudar o contrato:

- Alterar tamanho, validação ou regra de unicidade do nome.
- Proteger `Geral` contra exclusão.
- Mudar os códigos de resposta já consumidos pelo Frontend.

## 10. Definição de pronto

O CRUD de Categorias é considerado concluído quando:

- Os quatro endpoints estão implementados e documentados.
- Todos os critérios de aceite estão verificados pelo QA.
- Os testes automatizados passam na íntegra.
- A documentação está publicada em `docs/`.
- Nenhuma dependência paga foi adicionada.
- O Product Manager validou o escopo e o Tech Lead aprovou a revisão técnica.
