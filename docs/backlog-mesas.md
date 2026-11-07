# Backlog — Mesas e Comandas (Fase 6)

| Campo | Valor |
| --- | --- |
| Produto | Sistema de gestão não fiscal para restaurantes, pizzarias e lanchonetes |
| Módulo | Mesas e Comandas |
| Fase | 6 |
| Responsável | Product Manager |
| Status | Pronto para implementação |
| Versão | 1.0 |
| Data | 2026-11-07 |

## 1. Contexto e objetivo

A Fase 6 já possui cadastro e listagem de mesas (`GET /tables` e
`POST /tables`). As próximas etapas precisam cobrir o ciclo operacional do
salão: ocupar uma mesa, abrir a comanda, registrar itens, consultar a comanda e
fechar a mesa.

**Objetivo:** definir o contrato das três próximas operações:

- `PUT /tables/:id/status` — ocupar, fechar ou liberar uma mesa.
- `POST /orders` — abrir uma comanda vinculada a uma mesa, com seus itens.
- `GET /orders/:id` — consultar a comanda e listar seus itens.

**Resultado esperado:** o atendente consegue ocupar uma mesa, abrir a comanda
com os itens iniciais, consultar o consumo e encerrar o atendimento sem
planilhas externas.

## 2. Escopo

### 2.1 Dentro do escopo

- Transições de status da mesa entre `free`, `occupied` e `closed`.
- Abertura de comanda com pelo menos um item.
- Registro do preço do produto no momento da abertura da comanda.
- Consulta da comanda com itens, subtotais e total.
- Fechamento da mesa e encerramento da comanda aberta.
- Validações de estado, existência e integridade.
- Testes automatizados e documentação.

### 2.2 Fora do escopo

- `GET /tables` e `POST /tables`, já implementados.
- Edição, exclusão ou transferência de mesas.
- Remover ou alterar itens depois que a comanda foi aberta; adicionar itens
  passou a ser escopo da Fase 9 (seção 10).
- Cancelamento de comanda, estorno, divisão de conta ou pagamento.
- Reserva de mesa, fila de espera e capacidade de lugares.
- Fechamento financeiro, caixa, estoque e baixa de insumos.
- Impressão, documento fiscal ou integração com SEFAZ.
- Autenticação, permissões e auditoria de usuário.
- Interface visual das novas operações.

## 3. Estado atual e pré-requisitos

### 3.1 O que já existe

- Tabela `tables`: `id`, `number` (único, maior ou igual a 1) e `status`
  (`free`, `occupied` ou `closed`).
- Tabela `orders`: `id`, `table_id`, `status` (`open` ou `closed`) e
  `created_at`.
- Tabela `order_items`, criada na Fase 7 e integrada ao schema inline do banco.
- Índice único parcial `uq_orders_open_per_table`, que limita a uma comanda
  aberta por mesa.
- Rotas de mesas: `GET /tables`, `POST /tables` e `PUT /tables/:id/status`.
- Rotas de comanda: `POST /orders`, `GET /orders/:id`,
  `POST /orders/:id/close` e `POST /orders/:id/items`.

### 3.2 Schema implementado de `order_items`

Para atender `GET /orders/:id`, a tabela `order_items` foi criada na Fase 7 com
os campos abaixo.

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `id` | Inteiro | Sim (gerado) | Chave primária, imutável. |
| `order_id` | Inteiro | Sim | Referência a `orders.id`; exclusão em cascata com a comanda. |
| `product_id` | Inteiro | Sim | Referência a `products.id`; produto precisa existir. |
| `quantity` | Inteiro | Sim | Maior ou igual a 1 e menor ou igual a 999. |
| `unit_price` | Inteiro | Sim | Preço unitário em centavos, copiado de `products.price` na abertura ou na adição. |
| `notes` | Texto | Não | Observação do item, até 255 caracteres. |
| `created_at` | Texto | Sim (gerado) | ISO 8601 UTC. |

Regras da tabela `order_items`:

- O preço unitário é um **snapshot**: mudanças posteriores no preço do produto
  não alteram itens já gravados.
- O cliente não envia `unit_price`; o valor vem do cadastro do produto.
- `subtotal` não é persistido; é calculado como `quantity * unit_price`.

### 3.3 Invariantes

- Uma mesa só pode ter **uma comanda aberta** por vez.
- Uma comanda aberta mantém a mesa em `occupied`.
- Uma mesa `closed` não aceita nova comanda até ser liberada para `free`.
- Toda comanda criada pela API precisa ter pelo menos um item.
- A abertura da comanda e a atualização da mesa são atômicas na implementação
  atual.

## 4. Endpoint 1 — `PUT /tables/:id/status`

> **Atualização (Fase 8):** o contrato vigente desta rota está em
> `docs/backlog-fase8.md`. Ela aceita apenas `closed` e `free`, e fechar a mesa
> exige que a comanda já esteja fechada; não há fechamento automático da
> comanda. A ocupação continua exclusiva do `POST /orders`.

### 4.1 Objetivo

Controlar o ciclo operacional da mesa. O corpo aceito é `{ "status": "..." }`,
com um dos valores `occupied`, `closed` ou `free`.

### 4.2 Semântica dos estados

| Estado | Significado |
| --- | --- |
| `free` | Mesa livre, disponível para atendimento. |
| `occupied` | Mesa em atendimento, com ou sem comanda aberta. |
| `closed` | Mesa encerrada para limpeza ou manutenção; não recebe comanda. |

“Fechar a mesa” significa `occupied → closed`. “Liberar a mesa” significa
`closed → free`.

### 4.3 Transições permitidas

| De | Para | Permitido | Efeito |
| --- | --- | --- | --- |
| `free` | `occupied` | Sim | Mesa passa a ocupada; nenhuma comanda é criada. |
| `occupied` | `closed` | Sim | Fecha a mesa e encerra a comanda aberta, se existir. |
| `closed` | `free` | Sim | Mesa volta a ficar disponível. |
| `free` | `closed` | Não | Retorna 409. |
| `occupied` | `occupied` | Não | Retorna 409; mesa já está ocupada. |
| `closed` | `closed` | Não | Retorna 409; mesa já está fechada. |
| `occupied` | `free` | Não | Retorna 409; feche a mesa antes de liberá-la. |
| `closed` | `occupied` | Não | Retorna 409; libere a mesa antes de ocupá-la. |
| `free` | `free` | Não | Retorna 409; mesa já está livre. |

### 4.4 Fechamento com comanda

- Ao receber `closed` para uma mesa `occupied`, a API deve verificar se existe
  comanda aberta.
- Se existir comanda aberta, ela precisa ter pelo menos um item; caso contrário,
  retorna 409 e nada é alterado.
- Se a validação passar, a comanda é marcada como `closed` e a mesa como
  `closed`, na mesma transação.
- Se não existir comanda aberta, a mesa pode ser fechada normalmente.
- Uma falha ao fechar a comanda não pode deixar a mesa fechada pela metade.

### 4.5 Validações e respostas

- Sucesso retorna 200 com `{ id, number, status }` atualizado.
- Mesa inexistente retorna 404.
- `id` não inteiro, menor que 1 ou inválido retorna 400.
- `status` ausente ou fora de `occupied`, `closed` e `free` retorna 400.
- Transição não permitida retorna 409.
- Erro inesperado retorna 500 sem detalhes internos.

## 5. Endpoint 2 — `POST /orders`

### 5.1 Objetivo

Abrir uma comanda para uma mesa, com os itens iniciais, e garantir que a mesa
fique ocupada.

### 5.2 Corpo da requisição

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `tableId` | Inteiro | Sim | Mesa existente e não fechada. |
| `items` | Lista | Sim | Pelo menos um item; lista vazia é rejeitada. |
| `items[].productId` | Inteiro | Sim | Produto existente. |
| `items[].quantity` | Inteiro | Sim | De 1 a 999. |
| `items[].notes` | Texto | Não | Até 255 caracteres. |

O cliente não envia preço. A API lê `products.price` no momento da abertura e
grava o valor em `order_items.unit_price`.

### 5.3 Regras de abertura

- A mesa precisa existir; caso contrário, retorna 404.
- A mesa não pode estar `closed`; retorna 409.
- A mesa pode estar `free` ou `occupied` **sem comanda aberta**; nos dois casos
  a comanda é criada e a mesa fica `occupied`.
- Se a mesa já tiver comanda aberta, retorna 409 e nenhuma comanda nova é
  criada.
- Cada item precisa referenciar um produto existente; produto inexistente
  retorna 400.
- `quantity` deve ser inteiro entre 1 e 999.
- `items` ausente, nulo ou vazio retorna 400.
- Itens repetidos para o mesmo produto são permitidos e viram linhas
  separadas.
- A criação da comanda, dos itens e a atualização da mesa devem ocorrer em uma
  única transação.
- O total é a soma de `quantity * unit_price` de todos os itens, em centavos.

### 5.4 Resposta de sucesso

Retorna 201 com a comanda criada:

- `id`, `tableId`, `status` (`open`) e `createdAt`.
- Lista `items` com `id`, `productId`, `productName`, `quantity`, `unitPrice`,
  `unitPriceFormatted`, `subtotal` e `subtotalFormatted`.
- `total` em centavos e `totalFormatted` derivado.
- `unitPrice`, `subtotal` e `total` são inteiros em centavos.
- `productName` é resolvido a partir do cadastro do produto.
- `priceFormatted`, `subtotalFormatted` e `totalFormatted` usam BRL e são
  gerados pela API, conforme a regra de contrato do CHARTER.

### 5.5 Erros

| Código | Situação |
| --- | --- |
| 400 | Corpo inválido, `tableId` inválido, itens vazios, quantidade inválida ou produto inexistente. |
| 404 | Mesa inexistente. |
| 409 | Mesa fechada ou mesa com comanda já aberta. |
| 500 | Erro interno inesperado. |

## 6. Endpoint 3 — `GET /orders/:id`

### 6.1 Objetivo

Consultar uma comanda e listar seus itens, subtotais e total.

### 6.2 Regras

- Retorna 200 com a comanda e todos os itens vinculados.
- A comanda pode estar `open` ou `closed`; comandas fechadas continuam
  consultáveis.
- Os itens são ordenados por `id` crescente.
- Cada item contém `id`, `productId`, `productName`, `quantity`, `unitPrice`,
  `unitPriceFormatted`, `subtotal` e `subtotalFormatted`.
- `unitPrice` e `subtotal` são inteiros em centavos.
- `subtotal` é `quantity * unitPrice`.
- O total da comanda é a soma dos subtotais, em centavos.
- `total` e `totalFormatted` acompanham a resposta.
- Comanda existente sem itens retorna 200 com lista vazia; esse estado não deve
  ocorrer em comandas criadas pela API.
- Comanda inexistente retorna 404.
- `id` não inteiro, menor que 1 ou inválido retorna 400.

### 6.3 Resposta de sucesso

Retorna 200 com:

- `id`, `tableId`, `status`, `createdAt` e lista `items`.
- Os mesmos campos monetários e derivados definidos para `POST /orders`.
- Não expor dados internos do banco, SQL ou stack trace.

## 7. Regras transversais

- **Uma comanda por mesa:** a API verifica a existência de comanda aberta antes
  de criar outra. Em concorrência, a operação deve ser protegida por transação;
  um índice único parcial para comanda aberta por mesa é melhoria recomendada.
- **Preço em centavos:** todos os valores monetários são inteiros em centavos.
  A formatação para Real é feita em campos explícitos `*Formatted`.
- **Snapshot de preço:** a comanda preserva o preço do produto no momento da
  abertura.
- **Atomicidade:** abrir comanda e fechar mesa com comanda são operações
  transacionais.
- **Free First:** nenhuma dependência paga, serviço externo ou banco adicional.
- **Não fiscal:** nenhuma operação gera nota, cupom ou obrigação tributária.
- **Erros:** respostas de erro usam `{ "error": "..." }`, com mensagem em
  português e sem detalhes internos.
- **Consistência de status:** somente `free`, `occupied` e `closed` são aceitos
  para mesas; somente `open` e `closed` são gravados em comandas.

## 8. Critérios de aceite

### 8.1 Gerais

- [ ] **AC-MESA-01** — Os três endpoints respondem em JSON nos caminhos
  definidos e usam os códigos de sucesso previstos: 200 para mesa e consulta,
  201 para abertura de comanda.
- [ ] **AC-MESA-02** — Erros tratados retornam `{ "error": "..." }`, sem SQL,
  stack trace ou caminhos internos.
- [ ] **AC-MESA-03** — Operações que alteram mesa e comanda juntas são atômicas.
- [ ] **AC-MESA-04** — Nenhuma dependência paga é adicionada.
- [ ] **AC-MESA-05** — O módulo tem documentação e testes automatizados
  aprovados.

### 8.2 `PUT /tables/:id/status`

- [ ] **AC-TABLE-01** — Ocupar mesa `free` retorna 200 e status `occupied`.
- [ ] **AC-TABLE-02** — Tentar ocupar mesa já `occupied` retorna 409 e mantém o
  status.
- [ ] **AC-TABLE-03** — Fechar mesa `occupied` retorna 200 e status `closed`.
- [ ] **AC-TABLE-04** — Fechar mesa `occupied` com comanda aberta contendo itens
  encerra a comanda e retorna 200.
- [ ] **AC-TABLE-05** — Fechar mesa com comanda aberta sem itens retorna 409 e
  não altera mesa nem comanda.
- [ ] **AC-TABLE-06** — Fechar mesa `free` retorna 409 e mantém o status.
- [ ] **AC-TABLE-07** — Tentar fechar mesa já `closed` retorna 409.
- [ ] **AC-TABLE-08** — Liberar mesa `closed` retorna 200 e status `free`.
- [ ] **AC-TABLE-09** — Tentar liberar mesa `occupied` retorna 409.
- [ ] **AC-TABLE-10** — Status inválido ou ausente retorna 400.
- [ ] **AC-TABLE-11** — Mesa inexistente retorna 404.
- [ ] **AC-TABLE-12** — `id` não inteiro, menor que 1 ou inválido retorna 400.

### 8.3 `POST /orders`

- [ ] **AC-ORDER-01** — Abrir comanda em mesa `free` com um item válido retorna
  201, status `open`, e a mesa passa a `occupied`.
- [ ] **AC-ORDER-02** — Abrir comanda em mesa `occupied` sem comanda aberta é
  permitido e retorna 201.
- [ ] **AC-ORDER-03** — Abrir comanda em mesa que já tem comanda aberta retorna
  409 e não cria outra.
- [ ] **AC-ORDER-04** — Abrir comanda em mesa `closed` retorna 409.
- [ ] **AC-ORDER-05** — Mesa inexistente retorna 404.
- [ ] **AC-ORDER-06** — `tableId` ausente ou inválido retorna 400.
- [ ] **AC-ORDER-07** — `items` ausente, nulo ou vazio retorna 400.
- [ ] **AC-ORDER-08** — Item com produto inexistente retorna 400 e não cria
  comanda.
- [ ] **AC-ORDER-09** — Quantidade zero, negativa, decimal ou maior que 999
  retorna 400.
- [ ] **AC-ORDER-10** — O preço unitário é lido do produto, não do cliente.
- [ ] **AC-ORDER-11** — Alterar o preço do produto depois da abertura não muda
  o valor da comanda.
- [ ] **AC-ORDER-12** — Itens repetidos do mesmo produto são aceitos como linhas
  separadas.
- [ ] **AC-ORDER-13** — O total é a soma exata de `quantity * unitPrice` em
  centavos.
- [ ] **AC-ORDER-14** — A comanda e seus itens persistem após reinício do
  servidor.

### 8.4 `GET /orders/:id`

- [ ] **AC-ORDER-15** — Comanda existente retorna 200 com `id`, `tableId`,
  `status`, `createdAt` e `items`.
- [ ] **AC-ORDER-16** — Todos os itens da comanda são retornados com
  `productId`, `productName`, `quantity`, `unitPrice`, `subtotal` e campos
  formatados.
- [ ] **AC-ORDER-17** — `subtotal` é igual a `quantity * unitPrice`.
- [ ] **AC-ORDER-18** — `total` é a soma dos subtotais.
- [ ] **AC-ORDER-19** — Comanda `closed` continua acessível e mantém seus itens.
- [ ] **AC-ORDER-20** — Comanda inexistente retorna 404.
- [ ] **AC-ORDER-21** — `id` não inteiro, menor que 1 ou inválido retorna 400.
- [ ] **AC-ORDER-22** — A resposta não expõe detalhes internos do banco.

## 9. Notas de Implementação (Fase 7)

> **Fonte:** `backend/src/routes/orders.js`, `backend/src/database.js` e
> `backend/src/money.js`.

### 9.1 Escopo efetivamente implementado

> Esta seção registra o estado da Fase 7. O fechamento de comanda e a gestão
> de status da mesa vieram na Fase 8 (`docs/backlog-fase8.md`); a adição de
> itens em comanda aberta veio na Fase 9 (seção 10).

- `POST /orders`: abre a comanda com pelo menos um item, grava os itens e
  coloca a mesa em `occupied`.
- `GET /orders/:id`: retorna a comanda com itens, subtotais, total e campos
  formatados.
- Na Fase 7 ainda não existiam `PUT /tables/:id/status`, fechamento de comanda,
  cancelamento nem inclusão de novos itens após a abertura.
- Naquele momento, a comanda permanecia com `status = open` e a mesa
  permanecia `occupied`.

### 9.2 Persistência

- A tabela `order_items` foi adicionada ao schema inline de
  `backend/src/database.js`.
- Campos: `id`, `order_id`, `product_id`, `quantity`, `unit_price`, `notes` e
  `created_at`.
- Restrições: `quantity` entre 1 e 999; `unit_price >= 0`; `notes` com até 255
  caracteres; FKs com `ON DELETE CASCADE` para a comanda e
  `ON DELETE RESTRICT` para o produto.
- `subtotal` não é persistido; é calculado na leitura como
  `quantity * unit_price`.
- O índice `idx_order_items_order_id` acelera a busca dos itens.
- O índice único parcial `uq_orders_open_per_table` garante, no banco, no
  máximo uma comanda aberta por mesa.
- `orders.status` continua aceitando apenas `open` e `closed`.

### 9.3 Abertura da comanda — `POST /orders`

Fluxo implementado:

1. Valida `tableId` como inteiro positivo.
2. Exige `items` como lista com pelo menos um item.
3. Valida cada item: `productId` inteiro positivo, `quantity` inteira de 1 a
   999 e `notes` textual de até 255 caracteres.
4. Aplica `trim` em `notes`; texto vazio vira `null`.
5. Retorna 404 se a mesa não existir.
6. Retorna 409 se a mesa estiver `closed`.
7. Retorna 409 se a mesa já tiver comanda aberta.
8. Busca cada produto uma única vez e retorna 400 se algum não existir.
9. Executa a abertura em transação `BEGIN IMMEDIATE`:
   - insere a comanda em `orders`;
   - insere os itens em `order_items`;
   - usa `products.price` como `unit_price`;
   - atualiza a mesa para `occupied`;
   - confirma com `COMMIT`.
10. Em erro, executa `ROLLBACK` e converte violação de integridade em 409.
11. Retorna 201 com a comanda relida do banco.

Detalhes relevantes:

- O preço unitário é **snapshot** de `products.price` no momento da abertura.
- O cliente não envia preço; `unitPrice` é sempre lido do cadastro.
- Itens repetidos do mesmo produto são aceitos como linhas separadas.
- A leitura dos produtos ocorre antes da transação; a gravação usa o preço
  capturado nessa leitura.
- A transação cobre comanda, itens e status da mesa; uma falha não deixa
  comanda parcialmente criada.
- O índice único parcial é a última defesa contra duas aberturas simultâneas
  para a mesma mesa.

### 9.4 Consulta da comanda — `GET /orders/:id`

- Valida `id` como inteiro positivo; inválido retorna 400.
- Comanda inexistente retorna 404.
- Junta `order_items` com `products` para resolver `productName`.
- Ordena os itens por `order_items.id`.
- Comandas `open` e `closed` são consultáveis.
- `subtotal`, `total` e os campos `*Formatted` são derivados na leitura.
- Comanda existente sem itens retorna 200 com `items` vazio, embora a API de
  abertura não permita criar comanda vazia.

### 9.5 Contrato de dinheiro e formatação

- `unitPrice`, `subtotal` e `total` são inteiros em centavos.
- `unitPriceFormatted`, `subtotalFormatted` e `totalFormatted` são gerados por
  `formatBRL` em `backend/src/money.js`, com `Intl.NumberFormat` pt-BR/BRL.
- Não há uso de ponto flutuante para calcular valores monetários.
- O total é a soma dos subtotais inteiros; não há arredondamento.
- O nome do produto **não** é snapshot: é resolvido pelo cadastro atual na
  leitura. Apenas o preço é preservado.

### 9.6 Limitações e diferenças em relação ao backlog

| Tema | Situação atual |
| --- | --- |
| Fechar mesa/comanda | Não implementado; `orders.status` e mesa permanecem abertos/ocupados. |
| Adicionar itens depois da abertura | Implementado na Fase 9 por `POST /orders/:id/items` (seção 10). |
| Cancelar comanda | Não implementado. |
| `PUT /tables/:id/status` | Não implementado nesta etapa; ocupação ocorre no `POST /orders`. |
| Valor total persistido | Não persistido; calculado na leitura. |
| `closed_at` | Não existe na tabela `orders`. |
| Nome do produto | Resolvido no momento da leitura, não congelado na comanda. |

### 9.7 Integração com o Frontend

- `frontend/comanda.js` consome `GET /orders/:id`.
- O identificador da comanda é lido da query string (`?id=...`).
- A tela prioriza os campos formatados enviados pelo Backend
  (`unitPriceFormatted`, `subtotalFormatted`, `totalFormatted`).
- Erros 404 são exibidos como “Comanda não encontrada”; falhas de rede ou
  outros códigos mostram mensagem genérica.
- A tela não calcula preço a partir do produto; usa o snapshot devolvido pela
  comanda.

## 10. Fase 9: Gestão da Comanda

| Campo | Valor |
| --- | --- |
| Fase | 9 |
| Rota | `POST /orders/:id/items` |
| Status | Implementado; aguardando validação de QA |
| Fonte | `backend/src/routes/orders.js`, `backend/tests/orders.test.js` e `frontend/comanda.js` |

### 10.1 Contexto e objetivo

A Fase 7 permitiu abrir e consultar a comanda; a Fase 8 permitiu fechar a
comanda e a mesa. Faltava o caso mais comum do salão: o cliente pede mais um
item durante o atendimento.

**Objetivo:** permitir adicionar um item a uma comanda `open`, preservando o
preço do produto no momento da adição e devolvendo a comanda atualizada.

### 10.2 Escopo

**Dentro do escopo**

- Adicionar um item por requisição a uma comanda aberta.
- Validar produto, quantidade e observação.
- Gravar `unit_price` como snapshot de `products.price` no momento da adição.
- Devolver a comanda completa com itens, subtotais e total recalculados.
- Botão e modal "Adicionar Item" na tela da comanda.

**Fora do escopo**

- Remover item, alterar quantidade ou editar observação.
- Adicionar vários itens em uma única requisição.
- Reabrir comanda fechada.
- Desconto, taxa de serviço, cancelamento e estorno.
- Pagamento, caixa, estoque e documento fiscal.
- Funcionários, atribuição de mesas e comissão (seção 11).

### 10.3 Contrato

`POST /orders/:id/items`

Corpo com um único item:

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `productId` | Inteiro | Sim | Produto existente; inteiro positivo. |
| `quantity` | Inteiro | Sim | De 1 a 999. |
| `notes` | Texto | Não | Até 255 caracteres; sofre `trim`; texto vazio vira `null`. |

O cliente não envia preço. A API lê `products.price` dentro da transação.

**Sucesso:** `201` com a comanda completa, no mesmo formato de
`GET /orders/:id`:

- `id`, `tableId`, `status`, `createdAt`, `items`, `total` e
  `totalFormatted`.
- O item novo aparece ao final da lista, que é ordenada por `order_items.id`.
- Cada item traz `id`, `productId`, `productName`, `quantity`, `unitPrice`,
  `unitPriceFormatted`, `subtotal`, `subtotalFormatted` e `notes`.

### 10.4 Regras e ordem de validação

1. `:id` precisa ser inteiro positivo; caso contrário, `400`.
2. O corpo é validado antes de consultar a comanda: item inválido retorna
   `400` mesmo que a comanda não exista.
3. Comanda inexistente retorna `404`.
4. Comanda `closed` retorna `409`; nenhum item é gravado.
5. Produto inexistente retorna `400`; a comanda permanece intacta.
6. `unit_price` é o preço do cadastro no instante da adição.
7. O mesmo produto pode ser adicionado novamente e vira uma nova linha; não há
   agrupamento automático.
8. O endpoint não altera `orders.status`, `orders.created_at` nem o status da
   mesa.
9. `subtotal` e `total` não são persistidos; são calculados na leitura, em
   centavos.
10. Verificação do estado da comanda, leitura do produto e inserção ocorrem em
    `BEGIN IMMEDIATE`; erro executa `ROLLBACK`.
11. Violação de integridade é convertida em `409`.
12. O endpoint não valida o status da mesa: assume que uma comanda aberta
    pertence a uma mesa `occupied`.

Consequências do snapshot:

- Se o preço do produto mudar entre duas adições, a mesma comanda pode ter
  linhas do mesmo produto com `unitPrice` diferentes.
- Alterar o preço depois não modifica linhas já gravadas.

Concorrência com `POST /orders/:id/close`:

- As duas operações usam `BEGIN IMMEDIATE`, então são serializadas.
- Se a adição vencer, o fechamento seguinte enxerga o item e o total novo.
- Se o fechamento vencer, a adição recebe `409` e não grava nada.

### 10.5 Erros

| Código | Situação |
| --- | --- |
| 400 | `id` inválido; `productId` ausente/inválido; `quantity` fora de 1–999; `notes` não textual ou acima de 255; produto inexistente. |
| 404 | Comanda inexistente. |
| 409 | Comanda já `closed`. |
| 500 | Erro interno inesperado. |

### 10.6 Integração com o Frontend

- `frontend/comanda.html` ganhou o botão "Adicionar Item" e um modal com
  select de produto e campo de quantidade (`min="1"`, `step="1"`).
- `frontend/comanda.js` carrega `GET /products` ao abrir o modal e mostra
  `priceFormatted` na opção quando disponível.
- Em `201`, o modal fecha e a comanda é recarregada por `GET /orders/:id`.
- Em `400`, `404` ou `409`, o erro do backend é exibido em `alert`.
- Falha de rede mostra mensagem genérica.
- O modal atual não envia `notes`; o campo existe na API e pode ser exposto
  em uma próxima rodada de interface.
- O select é desabilitado quando não há produtos ou quando o carregamento
  falha.
- A tela ainda não esconde nem desabilita "Adicionar Item" para comanda
  `closed`; a tentativa retorna `409` e o erro aparece em `alert`. Desabilitar
  o botão conforme o status fica como melhoria de interface.

### 10.7 Critérios de aceite

**Gerais**

- [ ] **AC-ITEM-01** — A rota responde em JSON e usa `201` no sucesso.
- [ ] **AC-ITEM-02** — Erros tratados retornam `{ "error": "..." }`, sem SQL,
  stack trace ou caminhos internos.
- [ ] **AC-ITEM-03** — Verificação e inserção são atômicas.
- [ ] **AC-ITEM-04** — Nenhuma dependência paga é adicionada.
- [ ] **AC-ITEM-05** — A rota tem documentação e testes automatizados.

**Adição de item**

- [ ] **AC-ITEM-06** — Adicionar item válido a comanda `open` retorna `201`,
  inclui o item e aumenta o total.
- [ ] **AC-ITEM-07** — `unitPrice` vem de `products.price`; preço enviado pelo
  cliente é ignorado.
- [ ] **AC-ITEM-08** — Alterar o preço do produto depois da adição não muda
  linhas já gravadas.
- [ ] **AC-ITEM-09** — Adicionar o mesmo produto novamente cria uma linha
  separada.
- [ ] **AC-ITEM-10** — `quantity` zero, negativa, decimal ou maior que 999
  retorna `400`.
- [ ] **AC-ITEM-11** — `productId` ausente, não inteiro ou menor que 1 retorna
  `400`.
- [ ] **AC-ITEM-12** — `notes` não textual ou acima de 255 caracteres retorna
  `400`; texto vazio é gravado como `null`.
- [ ] **AC-ITEM-13** — Produto inexistente retorna `400` e não insere item.
- [ ] **AC-ITEM-14** — Comanda inexistente retorna `404`.
- [ ] **AC-ITEM-15** — `id` não inteiro, menor que 1 ou inválido retorna `400`.
- [ ] **AC-ITEM-16** — Comanda `closed` retorna `409` e não recebe item.
- [ ] **AC-ITEM-17** — A adição não altera `orders.status`, `created_at` nem
  o status da mesa.
- [ ] **AC-ITEM-18** — A resposta é idêntica ao `GET /orders/:id` seguinte.
- [ ] **AC-ITEM-19** — `subtotal` é `quantity * unitPrice` e `total` é a soma
  dos subtotais, em centavos.
- [ ] **AC-ITEM-20** — Adição e fechamento concorrentes não gravam item em
  comanda fechada.
- [ ] **AC-ITEM-21** — O item persiste após reinício do servidor.

**Frontend**

- [ ] **AC-ITEM-22** — O botão abre o modal e lista os produtos cadastrados.
- [ ] **AC-ITEM-23** — Adicionar com sucesso fecha o modal e recarrega a
  comanda com o novo item e o total atualizado.
- [ ] **AC-ITEM-24** — Erro do backend é exibido ao usuário e o modal
  permanece aberto.
- [ ] **AC-ITEM-25** — Sem produtos cadastrados, o select fica desabilitado e
  a tela informa o motivo.

## 11. Esboço — Gestão de Funcionários e Atribuição de Mesas

> **Status:** esboço para discussão. Não é escopo aprovado e não deve ser
> implementado antes da validação do fundador e da revisão do Tech Lead.

### 11.1 Objetivo

Dar ao salão a noção de responsabilidade: cada garçom tem um conjunto de
mesas, as vendas dessas mesas são atribuídas a ele e uma comissão é calculada
sobre o consumo. A tela precisa responder, de relance:

- Quem está no turno?
- Quais mesas cada garçom atende?
- Quanto cada garçom vendeu e quanto tem a receber de comissão?

### 11.2 Modelo de dados preliminar

| Entidade | Campos propostos | Observações |
| --- | --- | --- |
| `employees` | `id`, `name`, `role`, `commission_bps`, `active`, `created_at` | `commission_bps` em pontos-base (1000 = 10%), sem ponto flutuante. |
| `table_assignments` | `id`, `employee_id`, `table_id`, `assigned_at`, `unassigned_at` | `unassigned_at` nulo = vínculo ativo; histórico preservado. |
| `orders` | `employee_id`, `commission_bps` | Snapshot do responsável e da taxa no fechamento da comanda. |

Regras propostas:

- Uma mesa tem no máximo um garçom ativo por vez.
- Um garçom pode acumular várias mesas.
- Transferir mesa encerra o vínculo anterior e cria outro, sem apagar o
  histórico.
- A comissão é calculada por comanda fechada, em centavos.
- A taxa é congelada no fechamento; mudanças posteriores no cadastro do
  funcionário não reescrevem o passado.
- Comanda sem garçom atribuído não gera comissão.
- Funcionário não é usuário de login nesta fase; é um registro operacional.
- Desligar um funcionário significa `active = false`, não exclusão.

### 11.3 Esboço da tela (texto)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Funcionários e Mesas              Turno: [Jantar ▾]  Data: [07/11/2026]│
├──────────────────┬──────────────────────────────────────────────────────┤
│ EQUIPE           │ SALÃO                                               │
│ [Buscar...]      │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│                  │  │ Mesa 1 │ │ Mesa 2 │ │ Mesa 3 │ │ Mesa 4 │        │
│ ● Ana            │  │ Livre  │ │ Ocupada│ │ Ocupada│ │ Fechada│        │
│   Garçom         │  │   —    │ │  Ana   │ │  Ana   │ │   —    │        │
│   3 mesas        │  └────────┘ └────────┘ └────────┘ └────────┘        │
│   R$ 320,00      │                                                     │
│   Comissão 10%   │  ┌────────┐ ┌────────┐ ┌────────┐                   │
│                  │  │ Mesa 5 │ │ Mesa 6 │ │ Mesa 7 │                   │
│ ● Bruno          │  │ Ocupada│ │ Livre  │ │ Livre  │                   │
│   Garçom         │  │ Bruno  │ │   —    │ │   —    │                   │
│   2 mesas        │  └────────┘ └────────┘ └────────┘                   │
│   R$ 150,00      │                                                     │
│   Comissão 8%    │  Clique em uma mesa para atribuir ou trocar garçom. │
│                  │                                                     │
│ [+ Novo funcionário]                                                    │
├──────────────────┴──────────────────────────────────────────────────────┤
│ DETALHES — Ana                                          [Editar]        │
│ Mesas: 2, 3 · Vendas: R$ 320,00 · Comissão: R$ 32,00                   │
│ Turno: Jantar · Última atualização: 19:42                              │
│ [Transferir mesa]  [Remover mesa]  [Desativar funcionário]             │
└─────────────────────────────────────────────────────────────────────────┘
```

**Blocos da tela**

1. **Cabeçalho** — título, seletor de turno/data e resumo do turno (total
   vendido e total de comissões).
2. **Coluna Equipe** — funcionários ativos com nome, cargo, número de mesas,
   vendas do turno e taxa de comissão. Inclui busca por nome e filtro
   "somente ativos".
3. **Salão** — grade de mesas reutilizando as cores de status atuais: livre,
   ocupada e fechada. Cada mesa mostra número, status e o garçom responsável
   (ou "—").
4. **Detalhes do funcionário** — ao selecionar alguém, destaca as mesas dele
   e mostra vendas, comissão e ações.
5. **Modal "Novo funcionário"** — nome, cargo, comissão (%) e ativo.
6. **Modal de atribuição** — ao clicar numa mesa, lista os funcionários
   ativos com as ações "Atribuir", "Trocar" e "Remover".

**Interações**

- Clicar no funcionário destaca as mesas dele no salão.
- Clicar na mesa abre a atribuição; a mesa não precisa estar ocupada para
  receber um responsável.
- Atribuir uma mesa já ocupada por outro garçom pede confirmação de troca.
- A tela atualiza vendas e comissão quando uma comanda é fechada.
- Carregamento, lista vazia, erro de rede e ausência de mesas precisam de
  mensagem explícita.
- Layout responsivo: a coluna Equipe vira aba ou drawer em telas estreitas.
- Acessibilidade: navegação por teclado, foco preso no modal e rótulos nos
  campos.

### 11.4 Regras de comissão (proposta)

- Taxa em pontos-base inteiros; exibir como percentual.
- Base de cálculo: total da comanda fechada, em centavos.
- Arredondamento: metade para cima no centavo; registrar a regra no contrato.
- Comissão calculada no fechamento da comanda e congelada junto com a taxa.
- Relatórios por funcionário e por período (turno, dia, intervalo).
- Comandas sem garçom não entram no cálculo.
- Estorno, cancelamento e pagamento ficam fora desta fase; quando existirem,
  precisam definir se a comissão é recalculada.

### 11.5 Dúvidas para o fundador

1. A comissão incide sobre o total bruto ou sobre o valor líquido de
   descontos? (Hoje não há desconto.)
2. A comissão nasce no fechamento da comanda ou só após o pagamento?
3. Uma mesa pode ter mais de um garçom (ajudante) ou apenas um responsável?
4. Atribuir mesa livre é permitido? O vínculo sobrevive ao ciclo
   livre → ocupada → fechada → livre?
5. Quem pode transferir mesa? (Não há autenticação nesta fase.)
6. A taxa é por funcionário, por cargo ou por equipe?
7. Se a mesa for transferida depois da abertura, a comissão fica com quem
   abriu ou com quem fechou? (Recomendação: congelar no fechamento.)
8. A comissão deve ser persistida ou calculada sob demanda?
9. Qual regra de arredondamento vale para centavos?
10. "Funcionário" precisa de login e permissões agora ou é apenas cadastro
    operacional?

### 11.6 Próximos passos sugeridos

1. Fundador valida o modelo e responde às dúvidas da seção 11.5.
2. Product Manager transforma o esboço em `docs/backlog-fase10.md`.
3. Tech Lead revisa o schema (novas tabelas e snapshot em `orders`).
4. QA escreve o plano de teste antes da implementação.

## 12. Riscos e decisões pendentes

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Duas aberturas simultâneas para a mesma mesa | Duas comandas abertas | Transação `BEGIN IMMEDIATE` e índice único parcial `uq_orders_open_per_table` implementados. |
| Mesa ocupada manualmente sem comanda | Fechamento sem consumo | Permitido nesta fase; a comanda só é exigida quando existir. |
| Alteração de preço do produto | Divergência entre cardápio e comanda | Snapshot em `order_items.unit_price`. |
| Edição ou remoção de item | Item lançado errado só pode ser corrigido fora da API | Adição implementada na Fase 9; remoção e edição continuam fora do escopo. |
| Fechamento de mesa sem baixa de estoque | Estoque inconsistente | Estoque está fora do escopo da Fase 6. |
| Status `closed` ambíguo | Confusão entre “fechada” e “livre” | Documentado: `closed` é limpeza/manutenção; `free` é disponível. |
| Comissão calculada com a taxa atual do funcionário | Relatórios antigos mudam quando a taxa muda | Congelar `commission_bps` na comanda no fechamento (proposta da seção 11). |
| Transferência de mesa depois da abertura | Comissão vai para o garçom errado | Congelar `employee_id` na comanda no fechamento (proposta da seção 11). |

Decisões pendentes para o fundador ou Tech Lead:

- Confirmar se itens poderão ser removidos ou ter a quantidade alterada e em
  qual fase.
- Confirmar se ocupar uma mesa sem comanda deve ser permitido no longo prazo.
- Confirmar o modelo de funcionários, atribuição de mesas e comissão da
  seção 11 antes de abrir a próxima fase.

## 13. Definição de pronto

O módulo de Mesas e Comandas é considerado concluído quando:

- Os endpoints das Fases 6 a 9 estão implementados e documentados.
- A tabela `order_items` faz parte do schema e dos testes.
- `POST /orders/:id/items` está coberto por testes automatizados.
- Todos os critérios de aceite estão verificados pelo QA.
- Os testes automatizados passam na íntegra.
- A documentação está publicada em `docs/`.
- Nenhuma dependência paga foi adicionada.
- O Product Manager validou o escopo e o Tech Lead aprovou a revisão técnica.
