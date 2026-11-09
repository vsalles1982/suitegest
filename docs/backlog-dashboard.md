# Backlog — Dashboard e Impressão de Cupom (Bloco 5)

| Campo | Valor |
| --- | --- |
| Produto | Sistema de gestão não fiscal para restaurantes, pizzarias e lanchonetes |
| Módulo | Dashboard, indicadores de caixa e cupom não fiscal |
| Bloco | 5 |
| Responsável | Product Manager |
| Status | Backend implementado; ajustes de frontend, dados da empresa e reconciliação pendentes (seção 10) |
| Versão | 1.0 |
| Data | 2026-11-09 |

## 1. Contexto e objetivo

Os blocos anteriores fecharam o ciclo operacional e de gestão: cardápio,
mesas, comandas, pagamentos, garçons e estoque. O sistema já sabe **quanto
vendeu**, **quem pagou** e **qual garçom atendeu**, mas essas informações só
aparecem em telas de relatório e em consultas isoladas. Falta uma visão única
para o gerente acompanhar o movimento e falta um comprovante simples para
entregar ao cliente após o fechamento.

**Objetivo do Bloco 5:** oferecer uma visão gerencial consolidada e permitir a
impressão de um cupom **não fiscal** da comanda fechada.

**Resultado esperado:**

- O gerente abre o Dashboard e vê, em uma tela só, total vendido, ticket médio,
  volume de comandas fechadas, itens mais vendidos e a quebra por forma de
  pagamento.
- O operador imprime um cupom da comanda fechada com os dados do
  estabelecimento, os itens, o total, a forma de pagamento e, quando houver, a
  comissão do garçom.
- O cupom deixa explícito que **não é documento fiscal**.
- Os números do Dashboard reconciliam com os pagamentos registrados no
  fechamento.

**Limite de escopo:** este bloco entrega indicadores de leitura e um
comprovante não fiscal. Não há emissão de NF-e, SAT, cupom fiscal, integração
com SEFAZ, impressora fiscal, adquirente ou banco. Também não há fechamento
contábil de caixa, sangria, suprimento ou conferência de gaveta.

## 2. Escopo

### 2.1 Dentro do escopo

- `GET /reports/dashboard` — agregados de caixa para os cards do Dashboard.
- Card de total vendido.
- Card de ticket médio.
- Card de comandas fechadas, distinguindo comandas pagas de fechamentos
  legados sem pagamento.
- Lista dos itens mais vendidos.
- Quebra por forma de pagamento.
- Página `frontend/dashboard.html` consumindo a rota.
- Link de acesso ao Dashboard a partir da página inicial.
- `GET /orders/:id/receipt` — dados formatados do cupom de uma comanda
  fechada.
- Dados da empresa no cupom (nome e dados opcionais de contato).
- Impressão do cupom a partir da tela de comanda.
- Comissão do garçom no cupom, quando snapshotada no fechamento.
- Estados de carregamento, erro, vazio e responsividade.
- Testes automatizados do backend e documentação.

### 2.2 Fora do escopo

- Nota fiscal, cupom fiscal, SAT, NFC-e, NF-e ou qualquer obrigação tributária.
- Integração com impressora fiscal, gaveta, balança ou adquirente.
- Fechamento de caixa com sangria, suprimento, troco inicial ou conferência.
- Filtro de período no Dashboard nesta versão (evolução aditiva na seção 5.2).
- Comparação entre períodos, metas, gráficos históricos ou projeções.
- Ranking por garçom, por mesa ou por categoria.
- Cancelamento de pagamento, estorno ou reimpressão com numeração fiscal.
- Cadastro completo de empresa com certificado, inscrição estadual ou regime
  tributário.
- Personalização visual avançada do cupom (logo, QR Code, código de barras).

## 3. Estado de partida

O Bloco 5 já tem uma implementação parcial na árvore. Este documento
reconcilia o contrato real com o que ainda precisa ser feito; não é apenas um
desenho teórico.

### 3.1 Já existe

| Item | Situação |
| --- | --- |
| `GET /reports/dashboard` | Implementado em `backend/src/routes/reports.js`. |
| `GET /orders/:id/receipt` | Implementado em `backend/src/routes/orders.js`. |
| `frontend/dashboard.html` | Existe, com cards de total, ticket médio, comandas fechadas, top itens e formas de pagamento. |
| `frontend/dashboard.js` | Consome a rota e renderiza os blocos. |
| Link no `index.html` | Existe (“Acessar Dashboard”). |
| Botão “Imprimir Cupom” | Existe em `frontend/comanda.html`, exibido quando a comanda tem pagamento. |
| `buildReceiptHtml` | Existe em `frontend/comanda.js` e monta o HTML do cupom. |
| Testes do backend | `backend/tests/dashboard.test.js` cobre dashboard e cupom. |
| Documentação da API | `backend/README.md` descreve os dois endpoints. |

### 3.2 Ainda não existe ou está incompleto

| Lacuna | Impacto |
| --- | --- |
| Dados da empresa no schema | O cupom usa “SuiteSimulaFuncoes” fixo; não há tabela nem configuração de empresa. |
| Card “Comandas Fechadas” ligado a `closedOrders` | `dashboard.js` usa `ordersCount` (pagas) em um card rotulado “Comandas Fechadas”. |
| Cupom consumindo `GET /orders/:id/receipt` | `buildReceiptHtml` usa o objeto de `GET /orders/:id`, então `printedAt` não é usado e a empresa não aparece. |
| Botão de impressão no fechamento legado | O botão só aparece quando `order.payment` existe; comanda fechada sem pagamento não permite imprimir, embora a rota devolva `payment: null`. |
| Número da mesa no cupom | A rota devolve `tableId` (identificador interno), não `tableNumber` (número visível). |
| Comissão do garçom no HTML do cupom | O payload já traz os campos, mas `buildReceiptHtml` não os renderiza. |
| Filtro de período no Dashboard | A rota é “de todos os tempos”; não aceita `from`/`to`. |
| Alinhamento das formas de pagamento | O código aceita `dinheiro`, `cartao` e `pix`; o Bloco 2 aprovou `cash`, `credit_card`, `debit_card` e `pix`. |

### 3.3 Referências

- `docs/backlog-pagamentos.md` — contrato de pagamentos e formas canônicas.
- `docs/backlog-garcons.md` — comissão, garçom da mesa e snapshot no
  fechamento.
- `docs/backlog-estoque.md` — baixa automática e bloqueio de venda.
- `backend/README.md` — contrato resumido dos endpoints do Bloco 5.
- `CHARTER.md` — produto não fiscal e política Free First.

## 4. Modelo e origem dos dados

O Bloco 5 não cria tabelas obrigatórias para o Dashboard: ele **lê** o que os
blocos anteriores gravaram. A única adição de dados prevista é o perfil da
empresa para o cupom (seção 5.4).

### 4.1 Fontes

| Fonte | Uso no Bloco 5 |
| --- | --- |
| `payments` | Base de caixa: total vendido, ticket médio, formas de pagamento e itens vendidos. |
| `orders` | Status `closed`, `closed_at`, `employee_id` e `table_id`. |
| `order_items` | Quantidade, preço unitário congelado e produto vendido. |
| `products` | Nome atual do produto exibido no top de itens e no cupom. |
| `employees` | Nome do garçom; `commission_bps` já snapshotado em `payments`. |
| `tables` | Número visível da mesa para o cupom. |
| `company_profile` | Dados do estabelecimento no cupom (adição prevista). |

### 4.2 Regra central: base de caixa é `payments`

Uma comanda só entra nos indicadores de **venda** quando tem pagamento
registrado. A tabela `payments` tem índice único por `order_id`, portanto cada
comanda tem no máximo um pagamento. O fechamento grava o pagamento e o
`status = 'closed'` na mesma transação, então todo pagamento pertence a uma
comanda fechada.

Consequências:

- `ordersCount` conta pagamentos, não comandas fechadas.
- `total` é a soma de `payments.amount`.
- `topItems` e `byMethod` usam somente comandas pagas.
- Comanda fechada sem pagamento (fechamento legado) **não** entra no caixa.
  Ela aparece apenas em `closedOrders` e em `unpaidClosedOrders`.

### 4.3 Invariantes

| Invariante | Condição |
| --- | --- |
| I-01 | `closedOrders = ordersCount + unpaidClosedOrders` (todo pagamento pertence a uma comanda fechada) |
| I-02 | `total = SUM(payments.amount)` |
| I-03 | `SUM(byMethod.total) = total` |
| I-04 | `SUM(byMethod.payments) = ordersCount` |
| I-05 | `SUM(topItems.total) <= total` |
| I-06 | `topItems` tem no máximo 5 linhas |
| I-07 | `averageTicket = round(total / ordersCount)` quando `ordersCount > 0`; senão `0` |
| I-08 | `receipt.total = SUM(receipt.items.subtotal)` |
| I-09 | Com pagamento, `receipt.payment.amount = receipt.total` |

> **Correção de contrato (I-05):** o `backend/README.md` afirma que a soma do
> top reconcilia exatamente com `total`. Isso só vale quando há no máximo 5
> produtos distintos vendidos. Como `topItems` é limitado a 5 linhas, a
> invariante correta é `<= total`; a igualdade é um caso particular. Ver
> D-04 na seção 10.

## 5. Contrato da API

### 5.1 `GET /reports/dashboard`

**Objetivo:** devolver, em uma chamada, todos os agregados dos cards do
Dashboard.

**Método e caminho:** `GET /reports/dashboard`

**Parâmetros:** nenhum nesta versão. A rota considera **todos os tempos**.
Parâmetros desconhecidos não alteram o resultado.

**Sucesso:** `200 OK` com JSON.

Exemplo com duas comandas pagas (R$ 25,00 em cartão e R$ 10,00 em Pix) e uma
comanda fechada sem pagamento:

```json
{
  "from": null,
  "to": null,
  "paidOrders": 2,
  "totalRevenue": 3500,
  "totalRevenueFormatted": "R$ 35,00",
  "averageTicket": 1750,
  "averageTicketFormatted": "R$ 17,50",
  "byMethod": [
    {
      "method": "cartao",
      "label": "Cartão",
      "payments": 1,
      "total": 2500,
      "totalFormatted": "R$ 25,00"
    },
    {
      "method": "pix",
      "label": "Pix",
      "payments": 1,
      "total": 1000,
      "totalFormatted": "R$ 10,00"
    }
  ],
  "unpaidClosedOrders": 1,
  "ordersCount": 2,
  "total": 3500,
  "totalFormatted": "R$ 35,00",
  "topItems": [
    {
      "productId": 1,
      "productName": "Pastel",
      "quantity": 3,
      "total": 3000,
      "totalFormatted": "R$ 30,00",
      "revenue": 3000,
      "revenueFormatted": "R$ 30,00"
    },
    {
      "productId": 2,
      "productName": "Suco",
      "quantity": 1,
      "total": 500,
      "totalFormatted": "R$ 5,00",
      "revenue": 500,
      "revenueFormatted": "R$ 5,00"
    }
  ],
  "closedOrders": 3
}
```

#### Campos

| Campo | Tipo | Unidade | Semântica |
| --- | --- | --- | --- |
| `ordersCount` | inteiro | comandas | Comandas **pagas** (uma linha em `payments`). |
| `closedOrders` | inteiro | comandas | **Todas** as comandas com `status = 'closed'`, pagas ou não. |
| `paidOrders` | inteiro | comandas | Alias legado de `ordersCount`. |
| `unpaidClosedOrders` | inteiro | comandas | Comandas fechadas sem pagamento. |
| `total` | inteiro | centavos | Total vendido (soma de `payments.amount`). |
| `totalFormatted` | texto | BRL | `total` formatado em pt-BR. |
| `totalRevenue` | inteiro | centavos | Alias legado de `total`. |
| `totalRevenueFormatted` | texto | BRL | Alias legado de `totalFormatted`. |
| `averageTicket` | inteiro | centavos | `round(total / ordersCount)`, ou `0`. |
| `averageTicketFormatted` | texto | BRL | `averageTicket` formatado. |
| `topItems[]` | lista | — | Até 5 produtos vendidos em comandas pagas. |
| `byMethod[]` | lista | — | Quebra por forma de pagamento, ordenada por valor. |
| `from` | texto/nulo | data | Sempre `null` nesta versão. |
| `to` | texto/nulo | data | Sempre `null` nesta versão. |

#### `topItems[]`

| Campo | Tipo | Semântica |
| --- | --- | --- |
| `productId` | inteiro | Identificador do produto. |
| `productName` | texto | Nome **atual** do produto no cadastro. |
| `quantity` | inteiro | Soma de unidades vendidas em comandas pagas. |
| `total` | inteiro (centavos) | Soma de `quantity * unit_price` dos itens. |
| `totalFormatted` | texto | `total` formatado. |
| `revenue` | inteiro (centavos) | Alias legado de `total`. |
| `revenueFormatted` | texto | Alias legado de `totalFormatted`. |

Ordenação: `quantity` decrescente; empate por `total` decrescente; novo
empate por `productName` crescente. Limite: 5.

#### `byMethod[]`

| Campo | Tipo | Semântica |
| --- | --- | --- |
| `method` | texto | Valor gravado em `payments.method`. |
| `label` | texto | Rótulo em português. |
| `payments` | inteiro | Quantidade de pagamentos naquela forma. |
| `total` | inteiro (centavos) | Soma dos pagamentos naquela forma. |
| `totalFormatted` | texto | `total` formatado. |

Ordenação: `total` decrescente; empate por `method` crescente.

O percentual **não** faz parte da resposta da API nesta versão. A tela calcula
`total da forma / total geral * 100` para exibição.

#### Estado vazio

Sem nenhum pagamento e sem nenhuma comanda fechada, a resposta é:

```json
{
  "from": null,
  "to": null,
  "paidOrders": 0,
  "totalRevenue": 0,
  "totalRevenueFormatted": "R$ 0,00",
  "averageTicket": 0,
  "averageTicketFormatted": "R$ 0,00",
  "byMethod": [],
  "unpaidClosedOrders": 0,
  "ordersCount": 0,
  "total": 0,
  "totalFormatted": "R$ 0,00",
  "topItems": [],
  "closedOrders": 0
}
```

Regras do estado vazio:

- Não há divisão por zero: `averageTicket` é `0`.
- Listas vazias são `[]`, nunca `null`.
- Valores monetários são `0` e `"R$ 0,00"`, nunca `NaN`.

#### Erros

A rota não tem parâmetros obrigatórios nem validação de entrada nesta versão.
O caminho feliz é sempre `200`. Erros de infraestrutura (banco indisponível)
devem seguir o padrão de erro do backend, sem inventar payload parcial.

### 5.2 Evolução aditiva: filtro de período (pendente)

O Dashboard desta versão é **de todos os tempos**. Um filtro de período é
desejável, mas não faz parte do contrato atual. Quando for implementado, deve
ser **aditivo** e seguir as mesmas regras de `/reports/sales`:

- `?from=YYYY-MM-DD&to=YYYY-MM-DD`, ambos opcionais e inclusivos.
- Sem parâmetros, o comportamento continua “todos os tempos”.
- Datas inválidas → `400` com mensagem clara.
- `from > to` → `400`.
- O dia é interpretado em `America/Sao_Paulo` (UTC-3 fixo, sem horário de
  verão), convertido para o intervalo UTC correspondente.
- O filtro se aplica à data do **pagamento** (`payments.created_at`) para os
  cards de caixa e à data de fechamento (`orders.closed_at`) para
  `closedOrders` e `unpaidClosedOrders`.

Enquanto essa evolução não existir, a tela não deve exibir filtro de período
“meio implementado”. Um seletor visível que não altera os números é pior do
que a ausência do seletor.

### 5.3 `GET /orders/:id/receipt`

**Objetivo:** devolver os dados formatados de uma comanda fechada para montar
o cupom não fiscal.

**Método e caminho:** `GET /orders/:id/receipt`

**Pré-condição:** a comanda precisa existir e estar `closed`. O cupom é
comprovante de fechamento; comanda aberta não gera cupom.

**Sucesso:** `200 OK` com JSON.

> O exemplo abaixo representa o **contrato-alvo**. A implementação atual ainda
> não devolve `tableNumber` nem `company` (ver D-07 e D-08 na seção 10).

Exemplo de comanda com pagamento em dinheiro e garçom com 10% de comissão:

```json
{
  "orderId": 42,
  "tableId": 7,
  "tableNumber": 7,
  "items": [
    {
      "productName": "Pizza Marguerita",
      "quantity": 2,
      "unitPrice": 4500,
      "unitPriceFormatted": "R$ 45,00",
      "subtotal": 9000,
      "subtotalFormatted": "R$ 90,00"
    }
  ],
  "total": 9000,
  "totalFormatted": "R$ 90,00",
  "payment": {
    "method": "dinheiro",
    "methodLabel": "Dinheiro",
    "amount": 9000,
    "amountFormatted": "R$ 90,00",
    "employeeId": 3,
    "employeeName": "João Silva",
    "commissionBps": 1000,
    "commissionAmount": 900,
    "commissionAmountFormatted": "R$ 9,00"
  },
  "company": {
    "name": "Nome do Estabelecimento",
    "addressLine": "Rua Exemplo, 123 — Centro — São Paulo/SP",
    "phone": "(11) 99999-9999",
    "footer": "Obrigado pela preferência!"
  },
  "closedAt": "2026-11-09T23:15:00.000Z",
  "printedAt": "2026-11-09T23:16:10.000Z"
}
```

#### Campos

| Campo | Tipo | Semântica |
| --- | --- | --- |
| `orderId` | inteiro | Identificador da comanda. |
| `tableId` | inteiro | Identificador interno da mesa. |
| `tableNumber` | inteiro | Número visível da mesa (alvo; ver D-07). |
| `items[]` | lista | Itens na ordem de inserção. |
| `items[].productName` | texto | Nome atual do produto. |
| `items[].quantity` | inteiro | Quantidade vendida. |
| `items[].unitPrice` | inteiro (centavos) | Preço unitário congelado no item. |
| `items[].unitPriceFormatted` | texto | Preço unitário formatado. |
| `items[].subtotal` | inteiro (centavos) | `quantity * unitPrice`. |
| `items[].subtotalFormatted` | texto | Subtotal formatado. |
| `total` | inteiro (centavos) | Soma dos subtotais. |
| `totalFormatted` | texto | Total formatado. |
| `payment` | objeto/nulo | `null` em fechamento legado sem pagamento. |
| `payment.method` | texto | Valor gravado no pagamento. |
| `payment.methodLabel` | texto | Rótulo em português. |
| `payment.amount` | inteiro (centavos) | Valor pago; igual ao total da comanda. |
| `payment.amountFormatted` | texto | Valor pago formatado. |
| `payment.employeeId` | inteiro/nulo | Garçom snapshotado no fechamento. |
| `payment.employeeName` | texto/nulo | Nome atual do garçom. |
| `payment.commissionBps` | inteiro/nulo | Comissão em basis points (`1000` = 10%). |
| `payment.commissionAmount` | inteiro/nulo | Comissão em centavos. |
| `payment.commissionAmountFormatted` | texto/nulo | Comissão formatada. |
| `company` | objeto | Dados do estabelecimento (alvo; ver 5.4). |
| `company.name` | texto | Nome de exibição do estabelecimento. |
| `company.addressLine` | texto/nulo | Endereço em uma linha. |
| `company.phone` | texto/nulo | Telefone de contato. |
| `company.footer` | texto/nulo | Mensagem livre de rodapé. |
| `closedAt` | texto | Data/hora do fechamento em UTC ISO-8601. |
| `printedAt` | texto | Data/hora do pedido de impressão em UTC ISO-8601. |

#### Erros

| Situação | Código | Corpo |
| --- | --- | --- |
| `id` não numérico ou inválido | `400` | `{ "error": "..." }` |
| Comanda inexistente | `404` | `{ "error": "Comanda N não existe." }` |
| Comanda aberta | `409` | `{ "error": "A comanda N está aberta; o cupom é impresso após o fechamento." }` |
| Comanda fechada sem pagamento | `200` | `payment: null` (não é erro) |

O `409` não altera a comanda, não cria pagamento e não grava nada.

### 5.4 Dados da empresa no cupom (alvo)

Não existe hoje tabela, rota ou configuração de empresa. O cupom usa o nome
fixo “SuiteSimulaFuncoes”. Para atender ao requisito de “dados da empresa”, o
Bloco 5 define a seguinte fonte mínima:

**Tabela `company_profile` (linha única):**

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `id` | inteiro | sim | Sempre `1`. |
| `name` | texto | sim | Nome de exibição; 1 a 80 caracteres. |
| `address_line` | texto | não | Até 160 caracteres; endereço em uma linha. |
| `phone` | texto | não | Até 20 caracteres; telefone de contato. |
| `footer` | texto | não | Até 120 caracteres; mensagem de rodapé. |

**Semeadura:** `name = 'SuiteSimulaFuncoes'`, demais campos `null`. A
migração deve ser idempotente.

**Consumo:** `GET /orders/:id/receipt` inclui `company` com os campos acima.
Se a tabela ou a linha não existir, a rota usa o fallback
`{ "name": "SuiteSimulaFuncoes", "addressLine": null, "phone": null, "footer": null }`.

**Fora do escopo:** CNPJ, inscrição estadual, regime tributário, certificado
digital e qualquer dado fiscal. O produto é não fiscal; a identificação da
empresa é apenas comercial. Se o estabelecimento quiser exibir um documento,
pode usar `footer` como texto livre, sem validação do sistema.

**Edição:** uma tela de configuração da empresa não faz parte deste bloco.
Enquanto ela não existir, a alteração é feita diretamente na configuração
local do estabelecimento, e o cupom continua funcionando com o fallback.

### 5.5 Resumo de erros do bloco

| Endpoint | Código | Quando |
| --- | --- | --- |
| `GET /reports/dashboard` | `200` | Sempre no caminho feliz. |
| `GET /reports/dashboard` | `500` | Falha de infraestrutura. |
| `GET /orders/:id/receipt` | `400` | `id` inválido. |
| `GET /orders/:id/receipt` | `404` | Comanda inexistente. |
| `GET /orders/:id/receipt` | `409` | Comanda aberta. |
| `GET /orders/:id/receipt` | `500` | Falha de infraestrutura. |

## 6. Regras de negócio

### 6.1 Total vendido

- É a soma de `payments.amount` de todas as comandas pagas.
- Não inclui comanda fechada sem pagamento.
- Não inclui comanda aberta.
- O valor é sempre em centavos no backend e formatado em pt-BR na resposta.

### 6.2 Comandas fechadas versus comandas pagas

- **Comanda fechada** (`closedOrders`): `orders.status = 'closed'`. Inclui
  fechamentos com e sem pagamento.
- **Comanda paga** (`ordersCount`): existe linha em `payments`. É a base do
  caixa.
- **Comanda fechada sem pagamento** (`unpaidClosedOrders`): fechamento legado
  da Fase 8, mantido por compatibilidade.
- O card “Comandas Fechadas” deve mostrar `closedOrders`, não `ordersCount`.
- Quando houver fechamentos sem pagamento, o card deve deixar a diferença
  explícita com uma legenda do tipo “N com pagamento”. O gerente não pode
  confundir volume de atendimento com volume de caixa.

### 6.3 Ticket médio

- `averageTicket = round(total / ordersCount)`.
- A divisão usa comandas **pagas**, não comandas fechadas.
- Se `ordersCount = 0`, o ticket é `0` e formatado como `"R$ 0,00"`.
- Nunca retornar `NaN`, `Infinity` ou `null`.

### 6.4 Itens mais vendidos

- Base: comandas pagas (`payments`).
- Agrupa por produto.
- `quantity` soma unidades vendidas.
- `total` soma `quantity * unit_price` dos snapshots.
- Ordena por quantidade decrescente, depois por total decrescente, depois por
  nome crescente.
- Limita a 5 linhas.
- O nome exibido é o nome **atual** do produto no cadastro. Se o produto for
  renomeado, cupons e relatórios antigos passam a mostrar o novo nome; o preço
  permanece congelado no item.
- A soma dos totais do top é **menor ou igual** ao total vendido. A igualdade
  só ocorre quando há no máximo 5 produtos distintos vendidos.

### 6.5 Formas de pagamento

- A base é `payments.method`.
- A API devolve `method` e `label`.
- O rótulo é em português.
- A soma dos totais por forma é igual ao total vendido.
- A soma das quantidades por forma é igual ao número de comandas pagas.
- O percentual é calculado na tela, não na API.
- Formas sem pagamento não aparecem; não há linha “R$ 0,00”.

**Formas canônicas do Bloco 2:** `cash` (Dinheiro), `credit_card` (Cartão de
Crédito), `debit_card` (Cartão de Débito) e `pix` (Pix).

**Formas legadas aceitas pelo código atual:** `dinheiro` (Dinheiro),
`cartao` (Cartão) e `pix` (Pix).

O Bloco 5 deve rotular corretamente as quatro formas canônicas **e** as formas
legadas durante a transição. Um valor desconhecido não pode quebrar a tela:
o fallback é exibir o próprio `method`. Ver D-03.

### 6.6 Emissão do cupom

- Só comanda `closed` gera cupom.
- Comanda aberta → `409`.
- Comanda inexistente → `404`.
- `id` inválido → `400`.
- O cupom não altera a comanda, o pagamento, o estoque ou a comissão.
- Reimpressões são permitidas e não geram numeração fiscal.
- `printedAt` é o carimbo do pedido de impressão; não é persistido e muda a
  cada requisição.
- O cupom é um comprovante de conferência, não um documento contábil.

### 6.7 Snapshot versus dado atual

| Dado no cupom | Origem | Comportamento |
| --- | --- | --- |
| Preço unitário | `order_items.unit_price` | Congelado na venda. |
| Subtotal | `quantity * unit_price` | Derivado do snapshot. |
| Total | Soma dos subtotais | Derivado do snapshot. |
| Comissão | `payments.commission_bps` e `commission_amount` | Congelada no fechamento. |
| Nome do garçom | `employees.name` | Nome atual. |
| Nome do produto | `products.name` | Nome atual. |
| Número da mesa | `tables.number` | Número atual. |

Decisão: o produto é não fiscal e o cupom é um comprovante simples. Não é
necessário snapshotar nome do produto ou da mesa. A comissão, por ter valor
monetário, permanece snapshotada.

### 6.8 Comissão do garçom

- A comissão é snapshotada no fechamento com pagamento.
- `commissionBps` é basis points: `1000` = 10%, `1250` = 12,5%.
- `commissionAmount = round(total * commissionBps / 10000)`.
- Sem garçom atribuído à comanda, `employeeId`, `employeeName`,
  `commissionBps` e `commissionAmount` são `null`.
- O cupom exibe a comissão **apenas** quando `commissionAmount` não é nulo.
- A comissão é informativa e **não** altera o total pago pelo cliente.
- A comissão não é uma linha de pagamento; é um dado de gestão.
- O percentual exibido usa vírgula decimal em pt-BR (ex.: `12,5%`).

### 6.9 Fechamento legado sem pagamento

- `payment` é `null`.
- O total do cupom continua sendo a soma dos itens.
- O cupom deve exibir “Pagamento não registrado” (ou omitir a linha de forma
  consistente), nunca um rótulo vazio ou “undefined”.
- A comissão não aparece.
- O fechamento legado não entra no Dashboard de caixa; aparece em
  `closedOrders` e `unpaidClosedOrders`.

### 6.10 Reimpressão e `printedAt`

- A impressão pode ser repetida quantas vezes forem necessárias.
- Cada requisição devolve um novo `printedAt`.
- Nenhum contador de vias é gravado.
- O conteúdo do cupom é o mesmo, exceto o carimbo de impressão.
- A reimpressão não muda `closedAt`, `total`, `payment` ou comissão.

### 6.11 Produto não fiscal

O cupom deve conter, de forma visível:

- a expressão **“CUPOM NÃO FISCAL”** no topo; e
- a expressão **“Documento sem valor fiscal”** no rodapé.

O sistema não valida, não transmite e não armazena documento fiscal. Nenhuma
tela do Bloco 5 pode sugerir emissão de nota, cupom fiscal ou obrigação
tributária.

### 6.12 Fuso horário

O Dashboard desta versão não filtra por data. O cupom exibe `closedAt` e
`printedAt` em UTC ISO-8601 no payload; a formatação para o usuário é
responsabilidade da tela, em `America/Sao_Paulo` (UTC-3 fixo).

Quando o filtro de período for implementado (5.2), a regra de fuso é a mesma de
`/reports/sales`: dia local em `America/Sao_Paulo`, convertido para o intervalo
UTC correspondente.

### 6.13 Reconciliação

Antes de considerar o bloco pronto, os números precisam fechar:

- `closedOrders = ordersCount + unpaidClosedOrders`.
- `total = SUM(byMethod.total)`.
- `ordersCount = SUM(byMethod.payments)`.
- `SUM(topItems.total) <= total`.
- `averageTicket = round(total / ordersCount)`.
- `receipt.total = SUM(receipt.items.subtotal)`.
- Com pagamento, `receipt.payment.amount = receipt.total`.

## 7. Integração com o frontend

### 7.1 Dashboard — `frontend/dashboard.html` e `frontend/dashboard.js`

**Estado atual:** a página existe, consome `GET /reports/dashboard`, mostra
três cards e duas tabelas. O card “Comandas Fechadas” está ligado a
`ordersCount`, o que é um defeito de contrato.

**Comportamento alvo:**

- Buscar a rota ao carregar a página.
- Exibir estado de carregamento enquanto a resposta não chega.
- Exibir mensagem de erro amigável se o backend estiver offline ou devolver
  erro HTTP.
- Exibir estado vazio com zeros e listas vazias quando não houver venda.
- Card “Total Vendido” → `totalFormatted`.
- Card “Ticket Médio” → `averageTicketFormatted`.
- Card “Comandas Fechadas” → `closedOrders`.
- Legenda do card de comandas: quando `unpaidClosedOrders > 0`, mostrar
  “`ordersCount` com pagamento”; quando for zero, mostrar apenas o número.
- Tabela “Itens Mais Vendidos” → `topItems`, colunas Produto, Quantidade e
  Total.
- Tabela “Formas de Pagamento” → `byMethod`, colunas Forma, Total e %.
- Percentual calculado no cliente: `total da forma / total geral * 100`,
  com uma casa decimal e vírgula pt-BR.
- Se `total = 0`, o percentual é `—` e não há divisão por zero.
- Não exibir filtro de período nesta versão.

**Formatação:**

- Usar `totalFormatted`, `averageTicketFormatted` e `totalFormatted` dos itens
  quando disponíveis.
- Fallback para formatação local em BRL quando o campo formatado faltar.
- Não somar strings; usar os valores numéricos em centavos para cálculo.

**Navegação:** o link “Acessar Dashboard” no `index.html` deve continuar
levando à página.

### 7.2 Cupom — `frontend/comanda.html` e `frontend/comanda.js`

**Estado atual:** o botão “Imprimir Cupom” aparece quando a comanda tem
pagamento. O clique monta o HTML a partir de `lastOrder` (resposta de
`GET /orders/:id`) e chama `print()`. O HTML usa nome fixo
“SuiteSimulaFuncoes”, não mostra comissão e não usa `printedAt`.

**Comportamento alvo:**

1. O botão só aparece quando a comanda está `closed`. Comanda aberta não
   mostra o botão.
2. O clique busca `GET /orders/:id/receipt` (e não reaproveita o objeto da
   comanda).
3. Enquanto busca, o botão fica desabilitado com texto “Gerando cupom…”.
4. Se a busca falhar, mostrar mensagem clara; não abrir janela vazia.
5. Se o navegador bloquear o pop-up, avisar “Permita pop-ups para imprimir o
   cupom.”.
6. Montar o HTML com os dados da resposta.
7. Escrever o documento na janela, fechar o documento e chamar `print()`.
8. Escapar todo texto dinâmico (nome de produto, empresa, garçom, rodapé)
   contra HTML injection.
9. Permitir reimpressão pelo mesmo botão.
10. Não exibir o cupom como modal dentro da comanda; a janela de impressão é
    separada.

**Conteúdo obrigatório do cupom:**

- Nome da empresa.
- Endereço e telefone, quando configurados.
- “CUPOM NÃO FISCAL”.
- Número da comanda.
- Número da mesa.
- Data e hora do fechamento.
- Itens com quantidade, preço unitário e subtotal.
- Total.
- Forma de pagamento (ou “Pagamento não registrado”).
- Garçom e comissão, quando houver.
- “Documento sem valor fiscal”.
- Rodapé configurado, quando houver.

### 7.3 Estados, acessibilidade e responsividade

- `aria-live="polite"` na área de conteúdo do Dashboard.
- Tabelas com `<thead>`, `<th scope="col">` e `<tbody>`.
- Mensagens de erro e vazio em texto visível, não apenas em cor.
- Cards empilhados em telas estreitas.
- Tabelas com rolagem horizontal em telas estreitas, sem cortar colunas.
- Contraste suficiente no cupom impresso (preto sobre branco).
- Fonte monoespaçada no cupom.
- Nenhuma informação essencial depende de cor.

## 8. Wireframes textuais

### 8.1 Dashboard — desktop

```text
┌──────────────────────────────────────────────────────────────────┐
│ ← Voltar para a página inicial                                    │
│ Dashboard                                                         │
│ Indicadores de vendas do estabelecimento                          │
├──────────────────────────────────────────────────────────────────┤
│ Indicadores                                                       │
│ Dados carregados de http://localhost:3000/reports/dashboard       │
│                                                                   │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐         │
│ │ Total Vendido  │ │ Ticket Médio   │ │   Comandas     │         │
│ │                │ │                │ │   Fechadas     │         │
│ │   R$ 350,00    │ │   R$ 17,50     │ │       3        │         │
│ │                │ │                │ │ 2 com pagamento│         │
│ └────────────────┘ └────────────────┘ └────────────────┘         │
│                                                                   │
│ Itens Mais Vendidos                                               │
│ ┌──────────────────────────┬────────────┬──────────────────────┐ │
│ │ Produto                  │ Quantidade │ Total                │ │
│ ├──────────────────────────┼────────────┼──────────────────────┤ │
│ │ Pastel                   │ 3          │ R$ 30,00             │ │
│ │ Suco                     │ 1          │ R$ 5,00              │ │
│ └──────────────────────────┴────────────┴──────────────────────┘ │
│                                                                   │
│ Formas de Pagamento                                               │
│ ┌──────────────────────────┬────────────┬──────────────────────┐ │
│ │ Forma de Pagamento       │ Total      │ %                    │ │
│ ├──────────────────────────┼────────────┼──────────────────────┤ │
│ │ Cartão                   │ R$ 25,00   │ 71,4%                │ │
│ │ Pix                      │ R$ 10,00   │ 28,6%                │ │
│ └──────────────────────────┴────────────┴──────────────────────┘ │
├──────────────────────────────────────────────────────────────────┤
│ SuiteSimulaFuncoes — Gestão não fiscal de estabelecimentos...     │
└──────────────────────────────────────────────────────────────────┘
```

### 8.2 Dashboard — estados vazio e erro

```text
Estado vazio
┌──────────────────────────────────────────────────────────────────┐
│ Total Vendido   Ticket Médio   Comandas Fechadas                 │
│   R$ 0,00         R$ 0,00             0                          │
│                                                                   │
│ Itens Mais Vendidos                                               │
│   Nenhuma venda registrada.                                       │
│                                                                   │
│ Formas de Pagamento                                               │
│   Nenhum pagamento registrado.                                    │
└──────────────────────────────────────────────────────────────────┘

Erro
┌──────────────────────────────────────────────────────────────────┐
│ Erro ao carregar dashboard. Verifique se o backend está online.  │
└──────────────────────────────────────────────────────────────────┘
```

### 8.3 Dashboard — mobile

```text
┌──────────────────────────────┐
│ ← Voltar                     │
│ Dashboard                    │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ Total Vendido            │ │
│ │ R$ 350,00                │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Ticket Médio             │ │
│ │ R$ 17,50                 │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Comandas Fechadas        │ │
│ │ 3                        │ │
│ │ 2 com pagamento          │ │
│ └──────────────────────────┘ │
│                              │
│ Itens Mais Vendidos          │
│ ┌──────────┬──────┬────────┐ │
│ │ Produto  │ Qtd  │ Total  │ │
│ ├──────────┼──────┼────────┤ │
│ │ Pastel   │ 3    │ R$30,00│ │
│ └──────────┴──────┴────────┘ │
│                              │
│ Formas de Pagamento          │
│ ┌──────────┬────────┬──────┐ │
│ │ Forma    │ Total  │ %    │ │
│ ├──────────┼────────┼──────┤ │
│ │ Cartão   │ R$25,00│ 71,4%│ │
│ └──────────┴────────┴──────┘ │
└──────────────────────────────┘
```

### 8.4 Cupom — 80 mm

```text
┌────────────────────────────────────────┐
│            NOME DA EMPRESA             │
│     Rua Exemplo, 123 — Centro          │
│        São Paulo/SP — (11) 99999-9999  │
│                                        │
│           CUPOM NÃO FISCAL             │
├────────────────────────────────────────┤
│ Comanda #42                  Mesa 7    │
│ Fechamento: 09/11/2026 20:15           │
├────────────────────────────────────────┤
│ ITEM                        QTD  VALOR │
│ Pizza Marguerita             2  R$90,00│
│   2 x R$ 45,00                         │
│ Suco de laranja              1   R$5,00│
├────────────────────────────────────────┤
│ TOTAL                          R$95,00 │
│ Pagamento: Dinheiro                    │
│ Garçom: João Silva                     │
│ Comissão (10%):                 R$9,50 │
├────────────────────────────────────────┤
│        Documento sem valor fiscal      │
│        Obrigado pela preferência!      │
└────────────────────────────────────────┘
```

Regras visuais do cupom:

- Largura de impressão de 80 mm, com margem de 4 mm.
- Fonte monoespaçada, corpo entre 10 e 12 pt.
- Nome da empresa centralizado e em destaque.
- “CUPOM NÃO FISCAL” centralizado e visível.
- Itens alinhados à esquerda; valores alinhados à direita.
- Total em negrito.
- Comissão em linha separada, menor, apenas quando existir.
- Rodapé centralizado.
- Nada de cores dependentes de impressora colorida.
- Se o conteúdo passar de uma página, o cabeçalho não se repete e o rodapé
  fica na última página.

### 8.5 Cupom — fechamento legado sem pagamento

```text
┌────────────────────────────────────────┐
│            NOME DA EMPRESA             │
│           CUPOM NÃO FISCAL             │
├────────────────────────────────────────┤
│ Comanda #43                  Mesa 2    │
│ Fechamento: 09/11/2026 20:20           │
├────────────────────────────────────────┤
│ ITEM                        QTD  VALOR │
│ Café                        1   R$5,00 │
├────────────────────────────────────────┤
│ TOTAL                           R$5,00 │
│ Pagamento não registrado               │
├────────────────────────────────────────┤
│        Documento sem valor fiscal      │
│        Obrigado pela preferência!      │
└────────────────────────────────────────┘
```

### 8.6 Cupom — estados de impressão

```text
Comanda aberta
  [ botão “Imprimir Cupom” oculto ]
  (o cupom só existe após o fechamento)

Gerando cupom
  [ Gerando cupom… ]  (botão desabilitado)

Pop-up bloqueado
  “Permita pop-ups para imprimir o cupom.”

Erro ao buscar cupom
  “Erro ao gerar cupom. Verifique se o backend está online.”
```

## 9. Critérios de aceite

### 9.1 Dashboard — contrato

- **AC-DASH-01.** `GET /reports/dashboard` responde `200` com JSON, sem
  autenticação e sem parâmetros obrigatórios.
- **AC-DASH-02.** Sem pagamentos e sem comandas fechadas, a resposta traz
  `ordersCount = 0`, `closedOrders = 0`, `total = 0`,
  `totalFormatted = "R$ 0,00"`, `averageTicket = 0`,
  `averageTicketFormatted = "R$ 0,00"`, `topItems = []` e `byMethod = []`.
- **AC-DASH-03.** `total` é a soma de `payments.amount` em centavos; com duas
  comandas pagas de R$ 25,00 e R$ 10,00, `total = 3500` e
  `totalFormatted = "R$ 35,00"`.
- **AC-DASH-04.** `ordersCount` conta comandas pagas (linhas em `payments`),
  não comandas fechadas.
- **AC-DASH-05.** `closedOrders` conta todas as comandas com
  `status = 'closed'`, incluindo fechamentos sem pagamento.
- **AC-DASH-06.** `unpaidClosedOrders` conta comandas fechadas sem pagamento e
  `closedOrders = ordersCount + unpaidClosedOrders`.
- **AC-DASH-07.** `averageTicket = round(total / ordersCount)`; com
  `total = 3500` e `ordersCount = 2`, `averageTicket = 1750`.
- **AC-DASH-08.** Com `ordersCount = 0`, `averageTicket` é `0` e não há
  divisão por zero, `NaN` ou `Infinity`.
- **AC-DASH-09.** `topItems` tem no máximo 5 linhas e é ordenado por
  `quantity` decrescente, depois `total` decrescente, depois `productName`
  crescente.
- **AC-DASH-10.** `topItems` considera somente comandas pagas; comanda
  fechada sem pagamento não entra no top.
- **AC-DASH-11.** Cada item de `topItems` traz `productId`, `productName`,
  `quantity`, `total`, `totalFormatted`, `revenue` e `revenueFormatted`, com
  `total = revenue` e os formatados coerentes.
- **AC-DASH-12.** `SUM(topItems.total) <= total`; a igualdade ocorre quando há
  no máximo 5 produtos distintos vendidos.
- **AC-DASH-13.** `byMethod` considera somente pagamentos, traz `method`,
  `label`, `payments`, `total` e `totalFormatted`, e é ordenado por `total`
  decrescente e depois por `method` crescente.
- **AC-DASH-14.** `SUM(byMethod.total) = total` e
  `SUM(byMethod.payments) = ordersCount`.
- **AC-DASH-15.** `byMethod` não inclui formas sem pagamento nem comandas
  fechadas sem pagamento.
- **AC-DASH-16.** Os rótulos de `byMethod` estão em português e cobrem as
  quatro formas canônicas (`cash`, `credit_card`, `debit_card`, `pix`) e as
  formas legadas (`dinheiro`, `cartao`, `pix`).
- **AC-DASH-17.** Um `method` desconhecido não quebra a resposta: o backend
  pode devolver o próprio valor em `label` ou omiti-lo, e a tela exibe o valor
  bruto como fallback legível.
- **AC-DASH-18.** A rota é de todos os tempos nesta versão: não aceita
  `from`/`to` e parâmetros desconhecidos não alteram os números.
- **AC-DASH-19.** Os campos legados `paidOrders`, `totalRevenue`,
  `totalRevenueFormatted`, `unpaidClosedOrders`, `from` e `to` continuam
  presentes para compatibilidade.
- **AC-DASH-20.** Nenhum campo numérico retorna `null`, `NaN` ou `Infinity`;
  valores ausentes usam `0`.

### 9.2 Dashboard — frontend

- **AC-DASH-21.** O card “Total Vendido” exibe `totalFormatted`.
- **AC-DASH-22.** O card “Ticket Médio” exibe `averageTicketFormatted`.
- **AC-DASH-23.** O card “Comandas Fechadas” exibe `closedOrders`, não
  `ordersCount`.
- **AC-DASH-24.** Quando `unpaidClosedOrders > 0`, o card de comandas mostra
  uma legenda com `ordersCount` com pagamento; quando for zero, a legenda não
  aparece ou mostra apenas o total.
- **AC-DASH-25.** A tabela “Itens Mais Vendidos” exibe produto, quantidade e
  total formatado; sem itens, mostra “Nenhuma venda registrada.”.
- **AC-DASH-26.** A tabela “Formas de Pagamento” exibe forma, total formatado
  e percentual com uma casa decimal e vírgula pt-BR; sem pagamentos, mostra
  “Nenhum pagamento registrado.”.
- **AC-DASH-27.** O percentual é calculado no cliente e, quando `total = 0`,
  exibe `—` sem divisão por zero.
- **AC-DASH-28.** A página mostra estado de carregamento e, em erro de rede ou
  HTTP, uma mensagem clara sem deixar conteúdo antigo visível.
- **AC-DASH-29.** O Dashboard é acessível pelo link “Acessar Dashboard” da
  página inicial.
- **AC-DASH-30.** Em tela estreita, os cards empilham e as tabelas não cortam
  colunas; a página mantém `aria-live="polite"` e cabeçalhos de tabela
  semânticos.

### 9.3 Cupom — contrato

- **AC-CUPOM-01.** `GET /orders/:id/receipt` responde `200` para comanda
  fechada e devolve `orderId`, `tableId`, `items`, `total`, `totalFormatted`,
  `payment`, `closedAt` e `printedAt`.
- **AC-CUPOM-02.** Os itens vêm na ordem de inserção e cada um traz
  `productName`, `quantity`, `unitPrice`, `unitPriceFormatted`, `subtotal` e
  `subtotalFormatted`.
- **AC-CUPOM-03.** `total` é a soma dos subtotais dos itens e
  `totalFormatted` corresponde ao valor em BRL.
- **AC-CUPOM-04.** Com pagamento, `payment.amount = total` e
  `payment.amountFormatted` corresponde ao total.
- **AC-CUPOM-05.** Com pagamento, `payment` traz `method`, `methodLabel`,
  `amount`, `amountFormatted`, `employeeId`, `employeeName`, `commissionBps`,
  `commissionAmount` e `commissionAmountFormatted`.
- **AC-CUPOM-06.** Em comanda de R$ 90,00 com garçom de 10%,
  `commissionBps = 1000` e `commissionAmount = 900`
  (`"R$ 9,00"`).
- **AC-CUPOM-07.** Sem garçom atribuído, `employeeId`, `employeeName`,
  `commissionBps` e `commissionAmount` são `null`.
- **AC-CUPOM-08.** Em fechamento legado sem pagamento, `payment` é `null` e o
  total continua sendo a soma dos itens.
- **AC-CUPOM-09.** Comanda aberta responde `409` e não sofre alteração.
- **AC-CUPOM-10.** Comanda inexistente responde `404` e `id` inválido responde
  `400`.
- **AC-CUPOM-11.** `closedAt` é o carimbo do fechamento e `printedAt` é um
  carimbo UTC ISO-8601 do momento da requisição.
- **AC-CUPOM-12.** `printedAt` não altera a comanda, o pagamento ou a
  comissão; reimpressões geram novos `printedAt` e o mesmo conteúdo.
- **AC-CUPOM-13.** O cupom inclui `company.name` e usa o fallback
  “SuiteSimulaFuncoes” quando a configuração não existir.
- **AC-CUPOM-14.** O cupom inclui `company.addressLine`, `company.phone` e
  `company.footer` quando configurados, e omite as linhas quando nulos.
- **AC-CUPOM-15.** O cupom inclui `tableNumber` (número visível da mesa) e usa
  `tableId` como fallback quando o número não estiver disponível.

### 9.4 Cupom — impressão e frontend

- **AC-CUPOM-16.** O botão “Imprimir Cupom” só aparece para comanda fechada;
  comanda aberta não mostra o botão.
- **AC-CUPOM-17.** O clique busca `GET /orders/:id/receipt`, e não reaproveita
  o objeto de `GET /orders/:id`.
- **AC-CUPOM-18.** Durante a busca, o botão fica desabilitado com texto
  “Gerando cupom…”; em erro, a tela mostra mensagem clara e não abre janela
  vazia.
- **AC-CUPOM-19.** Se o pop-up for bloqueado, o usuário recebe o aviso
  “Permita pop-ups para imprimir o cupom.”.
- **AC-CUPOM-20.** O cupom impresso contém nome da empresa, “CUPOM NÃO
  FISCAL”, número da comanda, mesa, data/hora do fechamento, itens com
  quantidade/preço unitário/subtotal, total, forma de pagamento, garçom e
  comissão quando houver, e “Documento sem valor fiscal”.
- **AC-CUPOM-21.** Em fechamento legado, o cupom mostra “Pagamento não
  registrado” e não mostra comissão.
- **AC-CUPOM-22.** A comissão é exibida apenas quando `commissionAmount` não é
  nulo; o percentual usa vírgula pt-BR (ex.: `12,5%`).
- **AC-CUPOM-23.** O cupom usa largura de 80 mm, fonte monoespaçada, margem de
  4 mm e não corta valores ou nomes longos na impressão.
- **AC-CUPOM-24.** Todo texto dinâmico do cupom é escapado; nome de produto,
  empresa, garçom e rodapé não podem injetar HTML.
- **AC-CUPOM-25.** A reimpressão é permitida e produz o mesmo cupom, sem
  numeração fiscal e sem alterar dados.
- **AC-CUPOM-26.** O cupom não exibe CNPJ, inscrição estadual, chave de acesso
  ou qualquer campo fiscal.

## 10. Divergências e pendências

### 10.1 Já implementado

- `GET /reports/dashboard` com os agregados de caixa e `closedOrders`.
- `GET /orders/:id/receipt` com itens, total, pagamento, comissão, `closedAt`
  e `printedAt`.
- Página `frontend/dashboard.html` com cards e tabelas.
- Link do Dashboard no `index.html`.
- Botão “Imprimir Cupom” na comanda.
- Testes `backend/tests/dashboard.test.js` (4 testes, 4 passando em banco
  isolado).
- Contrato resumido no `backend/README.md`.

### 10.2 Divergências encontradas

| ID | Divergência | Impacto | Encaminhamento |
| --- | --- | --- | --- |
| D-01 | O card “Comandas Fechadas” usa `ordersCount` (pagas) em vez de `closedOrders` (todas as fechadas). | O número exibido não corresponde ao rótulo. | Corrigir `dashboard.js` e adicionar AC de frontend. |
| D-02 | O Dashboard é “de todos os tempos” e não tem filtro de período. | O gerente não consegue ver “hoje” ou um intervalo. | Manter como está nesta versão; evolução aditiva documentada em 5.2. |
| D-03 | O código aceita `dinheiro`, `cartao` e `pix`; o Bloco 2 aprovou `cash`, `credit_card`, `debit_card` e `pix`. | Rótulos e quebra por forma podem ficar incompletos ou inconsistentes. | Bloco 5 rotula as quatro formas canônicas e as legadas; a migração de valores é do Bloco 2. Não alterar `docs/backlog-pagamentos.md`. |
| D-04 | O `backend/README.md` afirma que a soma do top reconcilia exatamente com o total. | Falso quando há mais de 5 produtos distintos. | Documentar a invariante correta (`<=`) e ajustar o README em tarefa de documentação. |
| D-05 | `buildTopItems` usa `p.created_at` (alias de `products`) no filtro de período, em vez de `pay.created_at`. | O filtro de período de `/reports/sales` pode excluir venda de produto antigo ou incluir produto criado no período sem venda. | Não afeta o Dashboard (sem período), mas deve ser corrigido no Bloco 2/relatórios. |
| D-06 | O cupom no frontend não chama `GET /orders/:id/receipt`; monta o HTML a partir de `GET /orders/:id`. | `printedAt` não é usado, a empresa não aparece e a comissão não é renderizada. | Migrar o clique para a rota de cupom. |
| D-07 | A rota de cupom devolve `tableId`, não `tableNumber`. | O cupom pode mostrar o identificador interno da mesa em vez do número visível. | Adicionar `tableNumber` ao payload com JOIN em `tables`; fallback para `tableId`. |
| D-08 | Não existe configuração de empresa; o cupom usa “SuiteSimulaFuncoes” fixo. | O cupom não atende ao requisito de dados da empresa. | Criar `company_profile` e incluir `company` no payload (5.4). |
| D-09 | O nome do produto no cupom é o atual do cadastro, não um snapshot. | Renomear um produto altera cupons antigos. | Decisão aceita para produto não fiscal; documentar. |
| D-10 | O fechamento legado sem pagamento não entra no caixa, mas conta em `closedOrders`. | Pode gerar dúvida no card de comandas. | Legenda “N com pagamento” no card e distinção explícita na documentação. |
| D-11 | `printedAt` não é persistido. | Não há histórico de quantas vias foram impressas. | Decisão aceita; reimpressão livre e sem numeração fiscal. |
| D-12 | Não há teste de frontend para o vínculo dos cards. | O defeito D-01 não é pego pela suíte. | Adicionar verificação manual no roteiro de QA ou teste de DOM quando houver infraestrutura. |
| D-13 | O botão “Imprimir Cupom” só aparece quando há `payment`; comanda fechada sem pagamento não permite imprimir. | O fechamento legado fica sem comprovante, apesar de a rota devolver `payment: null`. | Exibir o botão quando `status = 'closed'` e tratar `payment: null` no HTML. |

### 10.3 Pendências

1. Corrigir o vínculo do card “Comandas Fechadas” para `closedOrders`.
2. Adicionar a legenda “N com pagamento” quando houver fechamento legado.
3. Migrar a impressão para `GET /orders/:id/receipt`.
4. Renderizar empresa, número da mesa, data/hora e comissão no cupom.
5. Criar `company_profile` com migração idempotente e fallback.
6. Adicionar `company` e `tableNumber` ao payload do cupom.
7. Ampliar o mapa de rótulos para as quatro formas canônicas e as legadas.
8. Revisar o README para corrigir a invariante do top (D-04).
9. Corrigir o filtro de período de `buildTopItems` (D-05).
10. Exibir o botão de impressão para toda comanda fechada, inclusive sem
    pagamento (D-13).
11. Cobrir o cupom impresso com um roteiro manual de QA (80 mm, pop-up,
    reimpressão, legado sem pagamento).

### 10.4 Situação dos testes

- `backend/tests/dashboard.test.js`: 4 testes, 4 passando em banco isolado
  (`DATABASE_PATH` temporário), executado em 2026-11-09.
- Cobertura atual:
  - dashboard zerado;
  - agregação de caixa com comanda paga em cartão, paga em Pix e fechada sem
    pagamento;
  - cupom completo com pagamento e comissão;
  - cupom com comanda aberta (`409`), inexistente (`404`), `id` inválido
    (`400`) e fechamento legado (`payment: null`).
- Lacunas de teste:
  - vínculo do card de frontend com `closedOrders`;
  - empresa no cupom;
  - `tableNumber`;
  - mais de 5 produtos no top (invariante `<=`);
  - rótulos das quatro formas canônicas;
  - reimpressão e `printedAt`.
- A suíte completa do backend tem problemas de isolamento de banco
  compartilhado entre arquivos de teste (herdados dos Blocos 3 e 4). O teste
  do Bloco 5 passa isolado; a correção do isolamento não faz parte deste
  bloco.

### 10.5 Observações de documentação

- `backend/README.md` é a referência resumida atual e deve apontar para este
  documento depois da revisão.
- `docs/backlog-pagamentos.md` não deve ser alterado por este bloco; a
  divergência de formas de pagamento é registrada aqui e resolvida no Bloco 2.
- `docs/backlog-garcons.md` define a comissão; este documento apenas a
  consome no cupom.
- `docs/backlog-estoque.md` define a baixa; o Dashboard não lê estoque.

## 11. Riscos e decisões

### 11.1 Riscos

| ID | Risco | Probabilidade | Impacto | Mitigação |
| --- | --- | --- | --- | --- |
| R-01 | O gerente confundir comandas fechadas com comandas pagas. | Alta | Médio | Card com `closedOrders` e legenda “N com pagamento”. |
| R-02 | O Dashboard “de todos os tempos” não responder “como foi hoje?”. | Alta | Médio | Documentar o limite; evolução aditiva de período. |
| R-03 | Formas de pagamento divergentes gerarem quebra de rótulo ou soma. | Média | Alto | Mapa de rótulos canônico + legado; fallback para o valor bruto. |
| R-04 | O cupom imprimir nome de produto com HTML e quebrar o layout. | Média | Alto | Escapar todo texto dinâmico. |
| R-05 | O cupom mostrar mesa errada (id interno). | Média | Médio | Incluir `tableNumber` com JOIN em `tables`. |
| R-06 | O cupom ser confundido com documento fiscal. | Baixa | Alto | “CUPOM NÃO FISCAL” no topo e “Documento sem valor fiscal” no rodapé. |
| R-07 | A soma do top não fechar com o total e parecer erro de caixa. | Média | Médio | Documentar `<=`; não prometer igualdade. |
| R-08 | O filtro de período de `/reports/sales` usar data de produto. | Média | Alto | Corrigir D-05 antes de expor período no Dashboard. |
| R-09 | Reimpressão sem controle gerar dúvida sobre vias. | Baixa | Baixo | Documentar reimpressão livre e `printedAt` informativo. |
| R-10 | Dados da empresa sem tela de configuração ficarem fixos. | Média | Baixo | Fallback e configuração local documentada. |

### 11.2 Decisões adotadas

1. O Dashboard é uma visão **de todos os tempos** nesta versão; período é
   evolução aditiva.
2. A base de caixa é `payments`; comanda fechada sem pagamento não entra no
   caixa.
3. `closedOrders` é o card de volume de atendimento; `ordersCount` é caixa.
4. O ticket médio usa comandas pagas.
5. O top de itens é limitado a 5 e usa comandas pagas.
6. O percentual por forma de pagamento é calculado no cliente.
7. O cupom só existe para comanda fechada.
8. A comissão é snapshot do fechamento e não altera o total.
9. O cupom é não fiscal e não exibe dados fiscais.
10. Reimpressão é livre; `printedAt` não é persistido.
11. O nome do produto e o número da mesa são lidos do cadastro atual.
12. O preço unitário e a comissão são snapshots.
13. A empresa é configurada em `company_profile` com fallback.
14. O Bloco 5 não altera `docs/backlog-pagamentos.md`.

### 11.3 Decisões pendentes

1. Criar ou não uma tela de configuração da empresa neste bloco.
2. Persistir ou não o histórico de impressões.
3. Adicionar filtro de período já na próxima versão ou em bloco próprio.
4. Unificar `cartao` em `credit_card`/`debit_card` no Bloco 2.
5. Exibir logo no cupom (fora do escopo atual).

## 12. Definição de pronto

O Bloco 5 só é considerado concluído quando:

- [ ] `GET /reports/dashboard` está implementado e coberto por testes.
- [ ] O card “Comandas Fechadas” exibe `closedOrders`.
- [ ] A legenda de comandas pagas aparece quando há fechamento legado.
- [ ] `topItems` e `byMethod` reconciliam com o total.
- [ ] Os rótulos das formas de pagamento cobrem canônicas e legadas.
- [ ] `GET /orders/:id/receipt` está implementado e coberto por testes.
- [ ] O cupom inclui `company` e `tableNumber`.
- [ ] O cupom é impresso a partir de `GET /orders/:id/receipt`.
- [ ] O cupom exibe empresa, itens, total, pagamento e comissão.
- [ ] O cupom exibe “CUPOM NÃO FISCAL” e “Documento sem valor fiscal”.
- [ ] O cupom trata fechamento legado sem pagamento.
- [ ] O cupom escapa todo texto dinâmico.
- [ ] O layout de 80 mm foi validado em impressão ou pré-visualização.
- [ ] O Dashboard tem estados de carregamento, erro e vazio.
- [ ] A página é responsiva e acessível.
- [ ] Os testes do Bloco 5 passam isolados.
- [ ] `backend/README.md` aponta para este documento.
- [ ] `docs/backlog-pagamentos.md` permanece inalterado.
