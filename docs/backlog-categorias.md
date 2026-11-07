# Backlog — CRUD de Categorias (Fase 2)

| Campo | Valor |
| --- | --- |
| Produto | Sistema de gestão não fiscal para restaurantes, pizzarias e lanchonetes |
| Módulo | Cardápio — Categorias |
| Fase | 2 |
| Responsável | Product Manager |
| Status | Pronto para implementação |
| Versão | 1.0 |
| Data | 2026-11-07 |

## 1. Contexto e objetivo

As categorias organizam o cardápio e são referenciadas pelos produtos. Esta
entrega define o CRUD de categorias sobre a tabela `categories` já existente,
com as colunas `id` e `name`.

**Objetivo:** permitir criar, listar, renomear e excluir categorias, com
validação consistente do nome e proteção da integridade dos produtos que as
utilizam.

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

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `id` | Inteiro | Sim (gerado) | Chave primária gerada pelo banco; imutável. |
| `name` | Texto | Sim | Nome de exibição, de 2 a 60 caracteres, único e sem caracteres especiais. |

### 3.1 Estado atual do banco

- A tabela `categories` já existe com `id` e `name`.
- `id` é inteiro, chave primária, com autoincremento.
- `name` é obrigatório e possui restrição de unicidade exata no banco.
- A categoria padrão `Geral`, com `id = 1`, é criada na inicialização do
  sistema e é usada como categoria inicial de produtos.

A API não altera essa estrutura nesta entrega. As regras que o banco não
consegue expressar — nome sem caracteres especiais, normalização de espaços e
unicidade sem diferenciar maiúsculas de minúsculas — são responsabilidade da
camada de aplicação.

## 4. Regras de negócio

- **RN-01 — Nome obrigatório:** `name` é obrigatório; ausente, nulo, vazio ou
  composto apenas por espaços retorna erro de validação.
- **RN-02 — Normalização:** remover espaços das pontas e reduzir espaços
  internos repetidos a um único espaço antes de validar e gravar.
- **RN-03 — Tamanho:** após a normalização, o nome deve ter de 2 a 60
  caracteres.
- **RN-04 — Conteúdo permitido:** aceitar letras, incluindo acentuadas,
  números, espaços e hífen. O nome deve conter pelo menos uma letra.
- **RN-05 — Caracteres especiais proibidos:** rejeitar símbolos e pontuação,
  como `@`, `#`, `$`, `%`, `&`, `*`, `(`, `)`, `_`, `+`, `=`, `[`, `]`, `{`,
  `}`, `|`, `\`, `/`, `:`, `;`, `"`, `'`, `,`, `.`, `?`, `!`, `~`, `^` e
  emojis.
- **RN-06 — Unicidade:** não pode existir outra categoria com o mesmo nome
  normalizado, sem diferenciar maiúsculas de minúsculas. Exemplo: `Bebidas` e
  `bebidas` são considerados o mesmo nome.
- **RN-07 — Acentos:** acentos são permitidos e fazem parte do nome. `Café` e
  `Cafe` são nomes distintos nesta versão.
- **RN-08 — Categoria padrão:** a categoria `Geral` (`id = 1`) não pode ser
  excluída, pois é recriada na inicialização do sistema.
- **RN-09 — Integridade com produtos:** uma categoria com qualquer produto
  vinculado não pode ser excluída. Os produtos devem ser movidos para outra
  categoria ou excluídos antes.
- **RN-10 — Renomeação:** renomear uma categoria não altera os produtos
  vinculados; o vínculo é feito por `id`.
- **RN-11 — Exclusão física:** como a tabela não possui status ativo, excluir
  uma categoria sem produtos remove o registro definitivamente.
- **RN-12 — Identificador imutável:** `id` nunca é enviado pelo cliente nem
  alterado em uma atualização.

## 5. Endpoints

Base: raiz da API (sem prefixo de versão nesta fase). Todas as requisições e
respostas usam JSON.

| Método | Caminho | Descrição | Sucesso | Erros previstos |
| --- | --- | --- | --- | --- |
| GET | `/categories` | Lista todas as categorias em ordem alfabética. | 200 | 500 |
| POST | `/categories` | Cria uma categoria. | 201 | 400, 409, 500 |
| PUT | `/categories/:id` | Renomeia uma categoria existente. | 200 | 400, 404, 409, 500 |
| DELETE | `/categories/:id` | Exclui uma categoria sem produtos vinculados. | 204 | 404, 409, 500 |

### 5.1 GET /categories

- Retorna todas as categorias, sem paginação, pois o volume é pequeno e a lista
  alimenta seletores de produtos.
- Ordenação alfabética crescente pelo nome, sem diferenciar maiúsculas de
  minúsculas.
- Cada item contém somente `id` e `name`.
- A categoria `Geral` também é retornada.
- Lista vazia retorna 200 com coleção vazia, nunca 404.

### 5.2 POST /categories

- Corpo aceito: somente `name`.
- Aplica todas as regras de validação e normalização da seção 4.
- Verifica a unicidade antes de inserir.
- Retorna 201 com `id` gerado e `name` normalizado.
- Nome repetido retorna 409.
- Nome inválido retorna 400 com mensagem objetiva.

### 5.3 PUT /categories/:id

- Substitui o nome da categoria identificada por `:id`.
- Corpo aceito: somente `name`.
- Aplica as mesmas regras de validação do cadastro.
- Mantém `id` inalterado e ignora qualquer tentativa de alterá-lo.
- Categoria inexistente retorna 404.
- Nome igual ao de outra categoria retorna 409.
- Renomear para o mesmo nome atual, variando apenas maiúsculas/minúsculas, é
  permitido e retorna 200.

### 5.4 DELETE /categories/:id

- Exclui definitivamente a categoria quando não há produtos vinculados.
- Retorna 204 sem corpo em caso de sucesso.
- Categoria inexistente retorna 404.
- Categoria com pelo menos um produto vinculado retorna 409.
- Categoria padrão `Geral` (`id = 1`) retorna 409.
- A mensagem de conflito deve orientar a mover ou excluir os produtos antes.

### 5.5 Formato de erro

Todas as falhas retornam um objeto com a chave `error` e uma mensagem em
português, sem expor detalhes internos, stack trace, SQL ou caminhos de arquivo.

| Código | Uso |
| --- | --- |
| 400 | Corpo malformado, campo ausente ou nome que viola as regras. |
| 404 | Categoria não encontrada no `PUT` ou no `DELETE`. |
| 409 | Nome duplicado, categoria com produtos ou categoria padrão. |
| 500 | Erro interno inesperado. |

## 6. Critérios de aceite

### 6.1 Gerais

- [ ] **AC-CAT-01** — Os quatro endpoints respondem em JSON e usam os caminhos
  definidos nesta seção.
- [ ] **AC-CAT-02** — Erros retornam `{ "error": "..." }`, com mensagem clara e
  sem detalhes internos.
- [ ] **AC-CAT-03** — Nenhuma dependência paga ou pacote externo de banco é
  adicionado.
- [ ] **AC-CAT-04** — O módulo tem documentação e testes automatizados
  aprovados.

### 6.2 GET /categories

- [ ] **AC-CAT-05** — Retorna 200 e todas as categorias cadastradas.
- [ ] **AC-CAT-06** — Cada item contém apenas `id` e `name`.
- [ ] **AC-CAT-07** — A ordenação é alfabética e não diferencia maiúsculas de
  minúsculas.
- [ ] **AC-CAT-08** — Sem categorias, retorna 200 com coleção vazia.
- [ ] **AC-CAT-09** — A categoria `Geral` aparece na listagem.

### 6.3 POST /categories

- [ ] **AC-CAT-10** — Criar com nome válido retorna 201, `id` gerado e `name`
  normalizado.
- [ ] **AC-CAT-11** — O nome é obrigatório; ausente, nulo, vazio ou só com
  espaços retorna 400.
- [ ] **AC-CAT-12** — Nome com menos de 2 ou mais de 60 caracteres retorna 400.
- [ ] **AC-CAT-13** — Espaços nas pontas são removidos e espaços internos
  repetidos são reduzidos a um.
- [ ] **AC-CAT-14** — Nome com caractere especial, símbolo ou emoji retorna 400.
- [ ] **AC-CAT-15** — Nome sem nenhuma letra, como `123` ou `---`, retorna 400.
- [ ] **AC-CAT-16** — Nome duplicado exato retorna 409.
- [ ] **AC-CAT-17** — Nome duplicado ignorando maiúsculas/minúsculas retorna
  409; por exemplo, `Bebidas` e `bebidas`.
- [ ] **AC-CAT-18** — A unicidade é global: qualquer nome duplicado na lista
  de categorias é conflito, pois categorias não são aninhadas.
- [ ] **AC-CAT-19** — A categoria criada persiste após reinício do servidor.

### 6.4 PUT /categories/:id

- [ ] **AC-CAT-20** — Renomear categoria existente com nome válido retorna 200
  e o novo nome.
- [ ] **AC-CAT-21** — O `id` permanece o mesmo após a renomeação.
- [ ] **AC-CAT-22** — Renomear categoria inexistente retorna 404.
- [ ] **AC-CAT-23** — Nome inválido no `PUT` retorna 400, com as mesmas regras
  do `POST`.
- [ ] **AC-CAT-24** — Renomear para um nome já usado por outra categoria retorna
  409.
- [ ] **AC-CAT-25** — Renomear uma categoria mantém os produtos vinculados e
  suas referências intactas.
- [ ] **AC-CAT-26** — Alterar apenas a caixa do próprio nome é permitido e
  retorna 200.

### 6.5 DELETE /categories/:id

- [ ] **AC-CAT-27** — Excluir categoria sem produtos retorna 204 e remove o
  registro.
- [ ] **AC-CAT-28** — Excluir categoria inexistente retorna 404.
- [ ] **AC-CAT-29** — Excluir categoria com produto vinculado retorna 409 e não
  remove o registro.
- [ ] **AC-CAT-30** — Excluir a categoria padrão `Geral` retorna 409.
- [ ] **AC-CAT-31** — Após a exclusão, a categoria não aparece mais na listagem.
- [ ] **AC-CAT-32** — A exclusão não afeta produtos quando não há vínculo.

## 7. Requisitos não funcionais

- **Free First:** usar somente SQLite e recursos já disponíveis; sem serviço
  pago, pacote externo de banco ou API externa.
- **Consistência:** validar o nome na API mesmo que a interface também valide.
- **Integridade:** a checagem de produtos vinculados deve acontecer antes da
  exclusão, e a FK `ON DELETE RESTRICT` permanece como última defesa.
- **Concorrência:** a restrição `UNIQUE` do banco cobre duplicidade exata;
  duplicidade apenas por caixa deve ser tratada pela aplicação. Em caso de
  corrida, o erro de unicidade do banco deve ser convertido em 409.
- **Desempenho:** a listagem deve responder em até 300 ms no ambiente local com
  até 200 categorias.
- **Segurança:** consultas parametrizadas, entradas validadas e erros internos
  não expostos.
- **Limite fiscal:** o módulo não calcula impostos nem gera documento fiscal.

## 8. Riscos e decisões pendentes

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Unicidade case-insensitive apenas na aplicação | Duplicatas em requisições concorrentes | Converter violação de unicidade em 409 e avaliar índice único normalizado em migração futura. |
| Exclusão física sem histórico | Perda de rastreabilidade | Bloquear categorias com produtos e registrar a decisão de não usar exclusão lógica nesta versão. |
| Categoria padrão recriada na inicialização | Categoria reaparece após exclusão | Bloquear a exclusão de `Geral`. |
| Nomes com acentos e `NOCASE` do SQLite | Comparação inconsistente | Normalizar na aplicação e testar `Café`, `cafe` e `Cafés`. |

Decisões pendentes para o fundador ou Tech Lead:

- Confirmar se a categoria `Geral` pode ser renomeada ou deve permanecer
  imutável.
- Confirmar se a unicidade deve ignorar acentos em uma fase futura.

## 9. Definição de pronto

O CRUD de Categorias é considerado concluído quando:

- Os quatro endpoints estão implementados e documentados.
- Todos os critérios de aceite estão verificados pelo QA.
- Os testes automatizados passam na íntegra.
- A documentação está publicada em `docs/`.
- Nenhuma dependência paga foi adicionada.
- O Product Manager validou o escopo e o Tech Lead aprovou a revisão técnica.
