# Backlog — Gestão de Caixa (Bloco 6)

| Campo | Valor |
| --- | --- |
| Produto | Sistema de gestão não fiscal para restaurantes, pizzarias e lanchonetes |
| Módulo | Caixa, turnos, sangria, suprimento e fechamento |
| Bloco | 6 |
| Responsável | Product Manager |
| Status | Contrato definido; implementação parcial incompatível na árvore (seção 10) |
| Versão | 1.0 |
| Data | 2026-11-09 |

## 1. Contexto e objetivo

O sistema já registra pagamentos no fechamento da comanda e mostra o resultado
de caixa no Dashboard. Falta controlar o **dinheiro físico da gaveta**: quanto
havia no início do turno, quanto entrou em dinheiro, quanto saiu em sangria,
quanto entrou em suprimento e qual foi a diferença no fechamento.

**Objetivo do Bloco 6:** controlar turnos de caixa e movimentações manuais de
dinheiro, calculando o saldo esperado e a diferença entre o esperado e a
contagem física no fechamento.

**Resultado esperado:**

- O operador abre o caixa informando o fundo de troco.
- O operador registra sangrias (retiradas) e suprimentos (entradas) de dinheiro.
- O sistema calcula o saldo esperado do turno em tempo real.
- No fechamento, o operador informa o valor contado na gaveta e o sistema
  mostra a diferença (sobra, falta ou exato).
- Só existe um turno aberto por vez.
- O histórico do turno fica registrado para conferência.

**Limite de escopo:** este bloco faz **gestão operacional de dinheiro**. Não é
fechamento contábil, não é conciliação bancária, não é controle fiscal e não
substitui a conferência humana da gaveta.

## 2. Escopo

### 2.1 Dentro do escopo

- Tabela `cash_shifts` — turnos de caixa.
- Tabela `cash_transactions` — sangrias e suprimentos.
- `POST /cash/shifts/open` — abrir caixa com valor inicial.
- `POST /cash/shifts/close` — fechar caixa e calcular a diferença.
- `POST /cash/transactions` — registrar sangria ou suprimento.
- `GET /cash/shifts/current` — consultar o turno aberto, o saldo esperado e as
  movimentações.
- Regra de um único turno aberto por vez.
- Cálculo do saldo esperado a partir da abertura, das vendas em dinheiro, dos
  suprimentos e das sangrias.
- Comparação com a contagem física no fechamento.
- Tela `frontend/caixa.html` e `frontend/caixa.js`.
- Link de acesso no `index.html`.
- Testes automatizados e documentação.

### 2.2 Fora do escopo

- Emissão de documento fiscal, SEFAZ, NF-e, NFC-e, SAT ou cupom fiscal.
- Conciliação de cartão, Pix, adquirente ou banco.
- Fechamento contábil, DRE, apuração de impostos ou lançamentos contábeis.
- Sangria/suprimento por denominação de cédula e moeda.
- Múltiplos caixas simultâneos, múltiplos operadores ou múltiplas gavetas.
- Controle de usuário, login, permissão ou assinatura do operador.
- Abertura/fechamento automático por horário.
- Histórico de turnos fechados em tela própria.
- Cancelamento, edição ou exclusão de turno ou movimentação.
- Integração com impressora de sangria, gaveta eletrônica ou balança.
- Transferência de valores entre caixas.
- Controle de troco por venda (o sistema registra o valor devido, não o valor
  entregue pelo cliente).

## 3. Estado de partida

O Bloco 6 já tem uma implementação parcial na árvore, mas **incompatível com o
contrato definido neste documento**. O código atual não deve ser tratado como
verdade para este bloco: os requisitos explícitos do produto prevalecem.

### 3.1 O que já existe

| Item | Situação |
| --- | --- |
| Tabelas `cash_shifts` e `cash_transactions` | Existem em `backend/src/database.js`, com nomes e tipos diferentes do contrato-alvo. |
| `frontend/caixa.html` | Existe, com formulário de abertura, cards e tabela de movimentações. |
| `frontend/caixa.js` | Existe, mas chama rotas que não estão registradas no backend. |
| Link “Acessar Caixa” | Existe no `index.html`. |
| Rotas de caixa | **Não existem.** `backend/src/server.js` não registra nenhum módulo de caixa. |
| Testes de caixa | **Não existem.** Não há `backend/tests/cash.test.js`. |

### 3.2 Incompatibilidades principais

| Tema | Implementação parcial | Contrato-alvo |
| --- | --- | --- |
| Coluna de abertura | `opening_amount` | `opening_balance` |
| Coluna de fechamento | `counted_amount` | `closing_balance` |
| Operador | `operator NOT NULL` | Fora do modelo deste bloco |
| Tipo de movimentação | `sale`, `cash_in`, `cash_out` | `sangria`, `suprimento` |
| Descrição | `note` | `description` |
| Vínculo com pedido | `order_id` | Fora do modelo deste bloco |
| Vendas em dinheiro | Gravadas como `cash_transactions` do tipo `sale` | Derivadas de `payments` (métodos de dinheiro) |
| Rotas | `/cash`, `/cash/open`, `/cash/movements`, `/cash/close` | `/cash/shifts/open`, `/cash/shifts/close`, `/cash/transactions`, `/cash/shifts/current` |
| Estado sem turno | Frontend espera `404` | `GET /cash/shifts/current` devolve `200` com `shift: null` |
| Entrada de valores | Centavos no formulário | Reais (BRL) na interface, centavos na API |
| Movimentação | `prompt` do navegador | Modal com campos validados |

### 3.3 Referências

- `docs/backlog-pagamentos.md` — formas de pagamento e fechamento da comanda.
- `docs/backlog-dashboard.md` — indicadores de caixa e cupom.
- `docs/backlog-garcons.md` — comissão do garçom.
- `CHARTER.md` — produto não fiscal e política Free First.
- `backend/README.md` — padrão de rotas e contratos.

## 4. Modelo de dados

O Bloco 6 cria duas tabelas. A modelagem segue o que foi pedido pelo produto:
`cash_shifts` guarda o turno; `cash_transactions` guarda **apenas movimentos
manuais** de dinheiro (sangria e suprimento). Vendas em dinheiro **não** são
gravadas em `cash_transactions`; elas são derivadas de `payments` (seção 4.3).

### 4.1 Tabela `cash_shifts`

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `id` | inteiro | sim | Chave primária, autoincremento. |
| `opened_at` | texto | sim | Data/hora de abertura em UTC ISO-8601; padrão agora. |
| `closed_at` | texto | não | Data/hora de fechamento em UTC ISO-8601; `null` enquanto aberto. |
| `opening_balance` | inteiro | sim | Fundo de troco em centavos; `>= 0`. |
| `closing_balance` | inteiro | não | Valor contado na gaveta em centavos; `null` enquanto aberto; `>= 0` quando fechado. |
| `status` | texto | sim | `open` ou `closed`; padrão `open`. |

**Restrições:**

- `opening_balance` entre `0` e `100000000` centavos (R$ 1.000.000,00).
- `closing_balance`, quando não nulo, entre `0` e `100000000` centavos.
- `status IN ('open', 'closed')`.
- Consistência de estado:
  - `status = 'open'` exige `closed_at IS NULL` e `closing_balance IS NULL`.
  - `status = 'closed'` exige `closed_at IS NOT NULL` e
    `closing_balance IS NOT NULL`.
- `opened_at` não pode ser posterior a `closed_at`.

**Índices:**

- Índice único parcial para garantir **no máximo um turno aberto**:
  `UNIQUE (status) WHERE status = 'open'`.
- Índice em `opened_at` para consultas e ordenação.
- Índice em `closed_at` para histórico futuro.

**Campos de auditoria recomendados (opcionais):**

Para não perder o resultado do fechamento caso os dados de pagamento mudem, é
recomendado persistir no fechamento:

| Campo | Tipo | Semântica |
| --- | --- | --- |
| `cash_sales` | inteiro | Vendas em dinheiro apuradas no fechamento. |
| `expected_balance` | inteiro | Saldo esperado apurado no fechamento. |
| `difference_amount` | inteiro | `closing_balance - expected_balance`. |

Esses campos não fazem parte do modelo mínimo solicitado. Se não forem
persistidos, o fechamento continua devolvendo os valores calculados, mas uma
consulta histórica precisará recalcular a partir de `payments` e
`cash_transactions`. A recomendação é persistir para auditoria.

### 4.2 Tabela `cash_transactions`

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `id` | inteiro | sim | Chave primária, autoincremento. |
| `shift_id` | inteiro | sim | FK para `cash_shifts(id)`; `ON DELETE RESTRICT`. |
| `type` | texto | sim | `sangria` ou `suprimento`. |
| `amount` | inteiro | sim | Valor em centavos; `> 0` e `<= 100000000`. |
| `description` | texto | não | Motivo/observação; até 200 caracteres; obrigatório para sangria na API. |
| `created_at` | texto | sim | Data/hora em UTC ISO-8601; padrão agora. |

**Restrições:**

- `type IN ('sangria', 'suprimento')`.
- `amount > 0` e `amount <= 100000000`.
- `description`, quando informada, deve ter entre 1 e 200 caracteres após
  `trim`.
- `shift_id` não pode apontar para turno inexistente.
- Não há `UPDATE` nem `DELETE` de movimentação.

**Índices:**

- `idx_cash_transactions_shift_id` em `(shift_id, created_at)`.

**Semântica:**

- `sangria` = retirada de dinheiro da gaveta. Diminui o saldo esperado.
- `suprimento` = entrada de dinheiro na gaveta. Aumenta o saldo esperado.
- Nenhum dos dois é venda, receita, despesa ou obrigação fiscal.

### 4.3 Vendas em dinheiro: derivadas de `payments`

O saldo esperado precisa incluir as vendas recebidas em dinheiro durante o
turno. Essas vendas **não** são lançadas em `cash_transactions`; elas são
calculadas a partir da tabela `payments`, que já é a base de caixa do Bloco 2.

**Métodos considerados dinheiro:**

- `cash` — forma canônica do Bloco 2.
- `dinheiro` — forma legada aceita pelo código atual.

Os demais métodos (`credit_card`, `debit_card`, `cartao`, `pix`) **não**
entram no saldo esperado em dinheiro.

**Janela do turno:**

- Início: `payments.created_at >= shift.opened_at`.
- Fim:
  - turno aberto: `payments.created_at <= agora`;
  - turno fechado: `payments.created_at <= shift.closed_at`.

**Consulta conceitual:**

```text
cashSales = SUM(payments.amount)
  WHERE payments.method IN ('cash', 'dinheiro')
    AND payments.created_at >= shift.opened_at
    AND payments.created_at <= COALESCE(shift.closed_at, agora)
```

**Consequências:**

- Uma venda em dinheiro fora de um turno aberto não entra em nenhum turno.
- Uma venda em cartão ou Pix não aumenta o saldo esperado em dinheiro.
- Uma comanda fechada sem pagamento não entra.
- O valor considerado é o valor devido da comanda, não o valor entregue pelo
  cliente. O troco faz parte da contagem física.
- Se o método de pagamento for corrigido no futuro, o cálculo histórico pode
  mudar. Por isso a recomendação de persistir `cash_sales` no fechamento.

**Evolução futura (não necessária neste bloco):** adicionar
`payments.cash_shift_id` para vincular cada pagamento ao turno de forma
explícita. A janela temporal resolve o escopo atual sem alterar `payments`.

### 4.4 Campos derivados

| Campo | Fórmula | Onde aparece |
| --- | --- | --- |
| `cashSales` | Soma das vendas em dinheiro na janela do turno. | `summary` |
| `supplies` | Soma das transações `suprimento` do turno. | `summary` |
| `withdrawals` | Soma das transações `sangria` do turno. | `summary` |
| `expectedBalance` | `openingBalance + cashSales + supplies - withdrawals`. | `summary` |
| `closingBalance` | Valor contado informado no fechamento. | `shift` e `summary` no fechamento |
| `differenceAmount` | `closingBalance - expectedBalance`. | `summary` no fechamento |
| `differenceType` | `exact`, `overage` ou `shortage`. | `summary` no fechamento |

**Convenção de sinal da diferença:**

- `differenceAmount = 0` → `exact` (“Exato”).
- `differenceAmount > 0` → `overage` (“Sobra”).
- `differenceAmount < 0` → `shortage` (“Falta”).

O valor negativo é formatado como `-R$ 10,00` em pt-BR.

### 4.5 Invariantes

| ID | Invariante |
| --- | --- |
| I-01 | Existe no máximo um turno com `status = 'open'`. |
| I-02 | `expectedBalance = openingBalance + cashSales + supplies - withdrawals`. |
| I-03 | `differenceAmount = closingBalance - expectedBalance`. |
| I-04 | Toda `cash_transaction` pertence a um turno existente. |
| I-05 | Só é possível criar movimentação em turno aberto. |
| I-06 | Turno fechado não recebe novas movimentações e não é reaberto. |
| I-07 | `openingBalance`, `closingBalance`, `amount`, `cashSales`, `supplies`, `withdrawals`, `expectedBalance` e `differenceAmount` são inteiros em centavos. |
| I-08 | `closingBalance` e `closedAt` são nulos se e somente se o turno está aberto. |
| I-09 | `cashSales` considera apenas métodos de dinheiro na janela do turno. |
| I-10 | `transactionsCount` conta apenas `cash_transactions`, não vendas. |

### 4.6 Migração do esquema parcial

O esquema atual precisa ser reconciliado com o contrato-alvo. Como o bloco
ainda não foi liberado, a opção preferida é **recriar as tabelas** com o
schema-alvo, após backup do banco. Se houver dados que precisem ser mantidos,
usar o mapeamento abaixo.

| Origem (parcial) | Destino (alvo) | Observação |
| --- | --- | --- |
| `opening_amount` | `opening_balance` | Mesmo significado. |
| `counted_amount` | `closing_balance` | Mesmo significado. |
| `note` | `description` | Mesmo significado. |
| `type = 'cash_in'` | `type = 'suprimento'` | Entrada de dinheiro. |
| `type = 'cash_out'` | `type = 'sangria'` | Retirada de dinheiro. |
| `type = 'sale'` | — | Descartar: vendas em dinheiro passam a ser derivadas de `payments`. |
| `operator` | — | Fora do modelo deste bloco; preservar em backup se necessário. |
| `order_id` | — | Fora do modelo deste bloco; vendas vêm de `payments`. |

**Cuidados:**

- Fazer backup antes de qualquer migração.
- Validar a soma de `amount` antes e depois da migração.
- Validar que não existe mais de um turno aberto.
- Recalcular `expected_balance` e `difference_amount` dos turnos fechados, se
  os campos de auditoria forem adicionados.
- Atualizar o frontend para as rotas e os nomes de campos novos.
- Não manter as duas modelagens em paralelo.

## 5. Contrato da API

### 5.0 Convenções

- Valores monetários trafegam como **inteiros em centavos**.
- Campos formatados em BRL usam o padrão do projeto (`formatBRL`).
- Datas e horas em UTC ISO-8601; a interface exibe em `America/Sao_Paulo`.
- JSON em `camelCase`; banco em `snake_case`.
- `type` usa `sangria` e `suprimento` em minúsculas, sem acento.
- `status` usa `open` e `closed`.
- Não há autenticação neste bloco.
- Campos desconhecidos no corpo são ignorados.
- Respostas de estado do turno usam o envelope
  `{ shift, summary, transactions }`.
- `POST /cash/transactions` devolve `{ transaction, summary }`.

### 5.1 `POST /cash/shifts/open`

**Objetivo:** abrir um turno de caixa com o fundo de troco.

**Corpo:**

```json
{
  "openingBalance": 10000
}
```

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `openingBalance` | inteiro | sim | Centavos; `>= 0` e `<= 100000000`. |

**Validações:**

- Corpo ausente ou `openingBalance` ausente → `400`.
- Valor não inteiro, negativo, `NaN`, string ou acima do limite → `400`.
- Já existe turno aberto → `409`.
- `openingBalance = 0` é válido (gaveta começa vazia).

**Sucesso:** `201 Created`.

```json
{
  "shift": {
    "id": 1,
    "openedAt": "2026-11-09T13:00:00.000Z",
    "closedAt": null,
    "openingBalance": 10000,
    "openingBalanceFormatted": "R$ 100,00",
    "closingBalance": null,
    "closingBalanceFormatted": null,
    "status": "open"
  },
  "summary": {
    "cashSales": 0,
    "cashSalesFormatted": "R$ 0,00",
    "supplies": 0,
    "suppliesFormatted": "R$ 0,00",
    "withdrawals": 0,
    "withdrawalsFormatted": "R$ 0,00",
    "expectedBalance": 10000,
    "expectedBalanceFormatted": "R$ 100,00",
    "closingBalance": null,
    "closingBalanceFormatted": null,
    "differenceAmount": null,
    "differenceFormatted": null,
    "differenceType": null,
    "differenceTypeLabel": null,
    "transactionsCount": 0
  },
  "transactions": []
}
```

**Erros:**

| Situação | Código | Exemplo de mensagem |
| --- | --- | --- |
| Corpo inválido | `400` | `Campo "openingBalance" deve ser um inteiro em centavos maior ou igual a zero.` |
| Turno já aberto | `409` | `Já existe um turno de caixa aberto (id 1). Feche-o antes de abrir outro.` |

### 5.2 `GET /cash/shifts/current`

**Objetivo:** consultar o turno aberto, o saldo esperado e as movimentações.

**Parâmetros:** nenhum.

**Turno aberto:** `200 OK` com o envelope completo.

```json
{
  "shift": {
    "id": 1,
    "openedAt": "2026-11-09T13:00:00.000Z",
    "closedAt": null,
    "openingBalance": 10000,
    "openingBalanceFormatted": "R$ 100,00",
    "closingBalance": null,
    "closingBalanceFormatted": null,
    "status": "open"
  },
  "summary": {
    "cashSales": 25000,
    "cashSalesFormatted": "R$ 250,00",
    "supplies": 5000,
    "suppliesFormatted": "R$ 50,00",
    "withdrawals": 3000,
    "withdrawalsFormatted": "R$ 30,00",
    "expectedBalance": 37000,
    "expectedBalanceFormatted": "R$ 370,00",
    "closingBalance": null,
    "closingBalanceFormatted": null,
    "differenceAmount": null,
    "differenceFormatted": null,
    "differenceType": null,
    "differenceTypeLabel": null,
    "transactionsCount": 2
  },
  "transactions": [
    {
      "id": 10,
      "shiftId": 1,
      "type": "sangria",
      "typeLabel": "Sangria",
      "amount": 3000,
      "amountFormatted": "R$ 30,00",
      "description": "Retirada para troco",
      "createdAt": "2026-11-09T15:00:00.000Z"
    },
    {
      "id": 11,
      "shiftId": 1,
      "type": "suprimento",
      "typeLabel": "Suprimento",
      "amount": 5000,
      "amountFormatted": "R$ 50,00",
      "description": "Reforço de caixa",
      "createdAt": "2026-11-09T16:00:00.000Z"
    }
  ]
}
```

**Sem turno aberto:** `200 OK`, sem tratar como erro.

```json
{
  "shift": null,
  "summary": null,
  "transactions": []
}
```

**Regras:**

- `transactions` é ordenado por `createdAt` crescente.
- O saldo exibido é o **saldo esperado**, não a contagem física.
- O saldo esperado pode mudar entre duas consultas se houver novas vendas em
  dinheiro ou movimentações.
- A rota não retorna turnos fechados; histórico fica fora do escopo.

### 5.3 `POST /cash/transactions`

**Objetivo:** registrar uma sangria ou um suprimento no turno aberto.

**Corpo:**

```json
{
  "type": "sangria",
  "amount": 3000,
  "description": "Retirada para troco"
}
```

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `type` | texto | sim | `sangria` ou `suprimento`. |
| `amount` | inteiro | sim | Centavos; `> 0` e `<= 100000000`. |
| `description` | texto | condicional | Obrigatória para `sangria`; opcional para `suprimento`; até 200 caracteres. |

**Validações:**

- `type` diferente de `sangria`/`suprimento` → `400`.
- `amount` ausente, zero, negativo, não inteiro ou acima do limite → `400`.
- `sangria` sem `description` não vazia → `400`.
- `suprimento` sem `description` é válido; `description` vazia vira `null`.
- Não existe turno aberto → `409`.
- `shiftId` no corpo é ignorado; a movimentação sempre pertence ao turno
  aberto.

**Sucesso:** `201 Created`.

```json
{
  "transaction": {
    "id": 10,
    "shiftId": 1,
    "type": "sangria",
    "typeLabel": "Sangria",
    "amount": 3000,
    "amountFormatted": "R$ 30,00",
    "description": "Retirada para troco",
    "createdAt": "2026-11-09T15:00:00.000Z"
  },
  "summary": {
    "cashSales": 25000,
    "cashSalesFormatted": "R$ 250,00",
    "supplies": 5000,
    "suppliesFormatted": "R$ 50,00",
    "withdrawals": 3000,
    "withdrawalsFormatted": "R$ 30,00",
    "expectedBalance": 37000,
    "expectedBalanceFormatted": "R$ 370,00",
    "closingBalance": null,
    "closingBalanceFormatted": null,
    "differenceAmount": null,
    "differenceFormatted": null,
    "differenceType": null,
    "differenceTypeLabel": null,
    "transactionsCount": 2
  }
}
```

**Erros:**

| Situação | Código | Exemplo de mensagem |
| --- | --- | --- |
| Tipo inválido | `400` | `Campo "type" aceita apenas: sangria, suprimento.` |
| Valor inválido | `400` | `Campo "amount" deve ser um inteiro em centavos maior que zero.` |
| Sangria sem motivo | `400` | `Campo "description" é obrigatório para sangria.` |
| Sem turno aberto | `409` | `Não há turno de caixa aberto. Abra o caixa antes de registrar movimentações.` |

**Imutabilidade:** não há rota de edição ou exclusão. Uma movimentação
registrada errada deve ser corrigida com uma movimentação oposta e descrição
explicando a correção, até que exista um fluxo próprio de estorno.

### 5.4 `POST /cash/shifts/close`

**Objetivo:** fechar o turno aberto, comparar o saldo esperado com a contagem
física e registrar a diferença.

**Corpo:**

```json
{
  "closingBalance": 36000
}
```

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `closingBalance` | inteiro | sim | Centavos; `>= 0` e `<= 100000000`. |

**Validações:**

- Corpo ausente ou `closingBalance` ausente → `400`.
- Valor não inteiro, negativo, `NaN`, string ou acima do limite → `400`.
- Não existe turno aberto → `409`.
- `closingBalance = 0` é válido (gaveta contada vazia).

**Cálculo no fechamento:**

```text
cashSales      = vendas em dinheiro na janela do turno
supplies       = SUM(cash_transactions.amount WHERE type = 'suprimento')
withdrawals    = SUM(cash_transactions.amount WHERE type = 'sangria')
expectedBalance = openingBalance + cashSales + supplies - withdrawals
differenceAmount = closingBalance - expectedBalance
```

**Sucesso:** `200 OK`.

```json
{
  "shift": {
    "id": 1,
    "openedAt": "2026-11-09T13:00:00.000Z",
    "closedAt": "2026-11-09T23:00:00.000Z",
    "openingBalance": 10000,
    "openingBalanceFormatted": "R$ 100,00",
    "closingBalance": 36000,
    "closingBalanceFormatted": "R$ 360,00",
    "status": "closed"
  },
  "summary": {
    "cashSales": 25000,
    "cashSalesFormatted": "R$ 250,00",
    "supplies": 5000,
    "suppliesFormatted": "R$ 50,00",
    "withdrawals": 3000,
    "withdrawalsFormatted": "R$ 30,00",
    "expectedBalance": 37000,
    "expectedBalanceFormatted": "R$ 370,00",
    "closingBalance": 36000,
    "closingBalanceFormatted": "R$ 360,00",
    "differenceAmount": -1000,
    "differenceFormatted": "-R$ 10,00",
    "differenceType": "shortage",
    "differenceTypeLabel": "Falta",
    "transactionsCount": 2
  },
  "transactions": [
    {
      "id": 10,
      "shiftId": 1,
      "type": "sangria",
      "typeLabel": "Sangria",
      "amount": 3000,
      "amountFormatted": "R$ 30,00",
      "description": "Retirada para troco",
      "createdAt": "2026-11-09T15:00:00.000Z"
    },
    {
      "id": 11,
      "shiftId": 1,
      "type": "suprimento",
      "typeLabel": "Suprimento",
      "amount": 5000,
      "amountFormatted": "R$ 50,00",
      "description": "Reforço de caixa",
      "createdAt": "2026-11-09T16:00:00.000Z"
    }
  ]
}
```

**Diferença:**

| `differenceAmount` | `differenceType` | Rótulo |
| --- | --- | --- |
| `0` | `exact` | Exato |
| `> 0` | `overage` | Sobra |
| `< 0` | `shortage` | Falta |

- O fechamento **não bloqueia** diferença diferente de zero.
- A diferença é registrada e exibida; a decisão sobre o que fazer é humana.
- O turno passa para `closed` e não pode ser reaberto.
- Um novo turno pode ser aberto depois do fechamento.

**Erros:**

| Situação | Código | Exemplo de mensagem |
| --- | --- | --- |
| Valor inválido | `400` | `Campo "closingBalance" deve ser um inteiro em centavos maior ou igual a zero.` |
| Sem turno aberto | `409` | `Não há turno de caixa aberto para fechar.` |
| Turno já fechado | `409` | `O turno de caixa já está fechado.` |

### 5.5 Objetos de resposta

#### `shift`

| Campo | Tipo | Semântica |
| --- | --- | --- |
| `id` | inteiro | Identificador do turno. |
| `openedAt` | texto | Abertura em UTC ISO-8601. |
| `closedAt` | texto/nulo | Fechamento em UTC ISO-8601; `null` se aberto. |
| `openingBalance` | inteiro | Fundo de troco em centavos. |
| `openingBalanceFormatted` | texto | Fundo formatado. |
| `closingBalance` | inteiro/nulo | Contagem física em centavos; `null` se aberto. |
| `closingBalanceFormatted` | texto/nulo | Contagem formatada. |
| `status` | texto | `open` ou `closed`. |

#### `summary`

| Campo | Tipo | Semântica |
| --- | --- | --- |
| `cashSales` | inteiro | Vendas em dinheiro no turno. |
| `cashSalesFormatted` | texto | Vendas formatadas. |
| `supplies` | inteiro | Total de suprimentos. |
| `suppliesFormatted` | texto | Suprimentos formatados. |
| `withdrawals` | inteiro | Total de sangrias. |
| `withdrawalsFormatted` | texto | Sangrias formatadas. |
| `expectedBalance` | inteiro | Saldo esperado. |
| `expectedBalanceFormatted` | texto | Saldo esperado formatado. |
| `closingBalance` | inteiro/nulo | Contagem física; `null` se aberto. |
| `closingBalanceFormatted` | texto/nulo | Contagem formatada. |
| `differenceAmount` | inteiro/nulo | Diferença; `null` se aberto. |
| `differenceFormatted` | texto/nulo | Diferença formatada. |
| `differenceType` | texto/nulo | `exact`, `overage` ou `shortage`; `null` se aberto. |
| `differenceTypeLabel` | texto/nulo | `Exato`, `Sobra` ou `Falta`; `null` se aberto. |
| `transactionsCount` | inteiro | Quantidade de sangrias + suprimentos. |

#### `transaction`

| Campo | Tipo | Semântica |
| --- | --- | --- |
| `id` | inteiro | Identificador da movimentação. |
| `shiftId` | inteiro | Turno dono da movimentação. |
| `type` | texto | `sangria` ou `suprimento`. |
| `typeLabel` | texto | `Sangria` ou `Suprimento`. |
| `amount` | inteiro | Valor em centavos. |
| `amountFormatted` | texto | Valor formatado. |
| `description` | texto/nulo | Motivo/observação. |
| `createdAt` | texto | Data/hora em UTC ISO-8601. |

### 5.6 Resumo de erros do bloco

| Endpoint | Código | Quando |
| --- | --- | --- |
| `POST /cash/shifts/open` | `400` | Corpo ou `openingBalance` inválido. |
| `POST /cash/shifts/open` | `409` | Já existe turno aberto. |
| `GET /cash/shifts/current` | `200` | Sempre; `shift: null` quando não há turno. |
| `POST /cash/transactions` | `400` | Tipo, valor ou descrição inválidos. |
| `POST /cash/transactions` | `409` | Sem turno aberto. |
| `POST /cash/shifts/close` | `400` | Corpo ou `closingBalance` inválido. |
| `POST /cash/shifts/close` | `409` | Sem turno aberto ou turno já fechado. |
| Qualquer rota | `500` | Falha de infraestrutura. |

## 6. Regras de negócio

### 6.1 Um único turno aberto

- Só pode existir um turno com `status = 'open'`.
- A regra é garantida por índice único parcial no banco e por transação na
  abertura.
- Tentar abrir um segundo turno retorna `409` e não cria linha.
- O turno anterior precisa estar `closed` para abrir outro.
- Não há turno “em espera” nem fila de turnos.

### 6.2 Abertura

- A abertura exige o fundo de troco (`openingBalance`).
- O fundo de troco pode ser zero.
- A abertura grava `opened_at` com o horário do servidor em UTC.
- A abertura não cria venda, receita ou movimentação.
- O saldo esperado inicial é igual ao fundo de troco.
- O operador deve abrir o caixa antes de receber dinheiro, para que as vendas
  entrem no turno.

### 6.3 Vendas em dinheiro

- São lidas de `payments`, não de `cash_transactions`.
- Métodos de dinheiro: `cash` e `dinheiro`.
- Cartão, débito, crédito e Pix não entram no saldo esperado em dinheiro.
- A janela é `[opened_at, agora]` para turno aberto e
  `[opened_at, closed_at]` para turno fechado.
- Venda em dinheiro fora de um turno aberto não entra em nenhum turno.
- O valor é o valor devido da comanda, não o valor entregue pelo cliente.
- Comissão não é descontada automaticamente do caixa (ver 6.11).

### 6.4 Sangria e suprimento

- **Sangria:** retirada de dinheiro da gaveta. Diminui o saldo esperado.
- **Suprimento:** entrada de dinheiro na gaveta. Aumenta o saldo esperado.
- Só podem ser registrados em turno aberto.
- A movimentação pertence sempre ao turno aberto; não é possível escolher
  outro turno no corpo.
- `amount` é sempre positivo; o tipo define o sinal.
- Sangria exige descrição (motivo). Suprimento tem descrição opcional.
- Nenhum dos dois é venda, receita, despesa ou documento fiscal.
- Movimentações são imutáveis; não há edição nem exclusão.

### 6.5 Saldo esperado

```text
saldo esperado =
    fundo de troco
  + vendas em dinheiro do turno
  + suprimentos
  - sangrias
```

- O saldo esperado é uma estimativa operacional, não um saldo bancário.
- Ele é recalculado a cada consulta do turno aberto.
- Ele é calculado uma última vez no fechamento.
- Ele não inclui cartão, Pix, comissão, impostos ou contas a pagar.
- Ele não inclui dinheiro que entrou antes da abertura (já está no fundo).
- Ele não inclui dinheiro que entrou depois do fechamento.

### 6.6 Fechamento e diferença

- O fechamento exige a contagem física (`closingBalance`).
- A contagem física é o dinheiro total na gaveta no momento do fechamento,
  incluindo o fundo de troco.
- `differenceAmount = closingBalance - expectedBalance`.
- `0` → exato; `> 0` → sobra; `< 0` → falta.
- O fechamento não bloqueia por diferença; ele registra o resultado.
- O turno passa para `closed` e recebe `closed_at` e `closing_balance`.
- O turno fechado não aceita novas movimentações.
- O turno fechado não é reaberto; para continuar, abre-se um novo turno.
- O fechamento é atômico: ou grava status, data, contagem e resultado, ou não
  grava nada.

### 6.7 Ciclo de vida

```text
sem turno
   │
   │ POST /cash/shifts/open
   ▼
 open ──────────────────────────────┐
   │                                │
   │ POST /cash/transactions        │
   │ (sangria/suprimento)           │
   │                                │
   │ POST /cash/shifts/close        │
   ▼                                │
 closed                             │
   │                                │
   │ POST /cash/shifts/open         │
   ▼                                │
 novo open ─────────────────────────┘
```

- Não há `DELETE`.
- Não há `PUT`/`PATCH`.
- Não há reabertura.
- Não há cancelamento de turno.
- O histórico permanece no banco.

### 6.8 Fuso horário e virada de dia

- `opened_at`, `closed_at` e `created_at` são gravados em UTC ISO-8601.
- A interface exibe em `America/Sao_Paulo` (UTC-3 fixo, sem horário de verão).
- O turno **não** é um dia fiscal; pode atravessar a meia-noite.
- Não há fechamento automático à meia-noite.
- O operador decide quando abrir e fechar.
- A janela de vendas em dinheiro usa os carimbos UTC, não o dia local.

### 6.9 Concorrência e transações

- Abertura, fechamento e movimentação usam transação com bloqueio de escrita.
- A abertura usa a restrição de unicidade do turno aberto; duas aberturas
  concorrentes: uma vence, a outra recebe `409`.
- O fechamento lê o turno aberto, calcula e atualiza condicionado a
  `status = 'open'`; se outra operação fechou antes, recebe `409`.
- A movimentação verifica o turno aberto dentro da transação; se o turno foi
  fechado, recebe `409`.
- Uma venda em dinheiro concorrente com o fechamento ou entra antes do
  fechamento ou fica fora do turno. O operador deve evitar fechar o caixa com
  comandas em processo de pagamento.
- Não há idempotência por chave de requisição; a interface deve desabilitar o
  botão enquanto a requisição está em andamento.

### 6.10 Produto não fiscal

- A gestão de caixa é operacional, não fiscal.
- Sangria e suprimento não são receita, despesa, imposto ou obrigação
  tributária.
- O sistema não emite documento fiscal, não transmite para SEFAZ e não apura
  tributos.
- Nenhuma tela do Bloco 6 pode sugerir nota fiscal, cupom fiscal ou
  escrituração contábil.
- O rodapé do sistema continua “Gestão não fiscal de estabelecimentos de
  alimentação”.

### 6.11 Comissão e outras saídas de dinheiro

- A comissão do garçom é um snapshot de gestão (Bloco 3), não uma saída
  automática de caixa.
- Se a comissão for paga em dinheiro da gaveta, o operador deve registrar uma
  **sangria** com descrição “Pagamento de comissão — [garçom]”.
- Se houver qualquer outra saída de dinheiro (fornecedor, troco, despesa),
  registrar sangria.
- O sistema não desconta comissão, imposto, cartão ou Pix do saldo esperado.
- O saldo esperado é estritamente dinheiro físico.

### 6.12 Exemplos de reconciliação

**Exemplo 1 — falta:**

```text
Abertura:        R$ 100,00
Vendas dinheiro: R$ 250,00
Suprimentos:     R$  50,00
Sangrias:        R$  30,00
Saldo esperado:  R$ 370,00
Contagem física: R$ 360,00
Diferença:      -R$  10,00 (Falta)
```

**Exemplo 2 — sobra:**

```text
Saldo esperado:  R$ 370,00
Contagem física: R$ 380,00
Diferença:       +R$ 10,00 (Sobra)
```

**Exemplo 3 — exato:**

```text
Saldo esperado:  R$ 370,00
Contagem física: R$ 370,00
Diferença:        R$ 0,00 (Exato)
```

### 6.13 O que não afeta o saldo esperado

- Vendas em cartão de crédito.
- Vendas em cartão de débito.
- Vendas em Pix.
- Comissão do garçom.
- Estoque.
- Contas a pagar e a receber.
- Impostos.
- Troco entregue ao cliente (o valor devido já está na venda).
- Dinheiro recebido fora do turno.
- Dinheiro que já estava na gaveta antes da abertura.

## 7. Integração com o frontend

### 7.1 Página e estados

A tela `frontend/caixa.html` deve ter três estados principais:

1. **Sem turno aberto:** formulário de abertura.
2. **Turno aberto:** cards de resumo, ações e tabela de movimentações.
3. **Resultado do fechamento:** resumo do turno fechado e ação de abrir novo
   caixa.

A tela consulta `GET /cash/shifts/current` ao carregar. Se `shift` for `null`,
mostra o formulário de abertura. Se houver turno, mostra o resumo.

### 7.2 Abertura

- Campo “Valor inicial (R$)” com máscara de moeda.
- O valor é convertido para centavos antes de enviar.
- Botão “Abrir Caixa”.
- Validação local: valor maior ou igual a zero, com no máximo duas casas.
- Durante o envio, desabilitar o botão e mostrar “Abrindo…”.
- Em `409`, mostrar a mensagem do backend e recarregar o estado.
- Em sucesso, recarregar `GET /cash/shifts/current`.

### 7.3 Movimentações

- Botões “Sangria” e “Suprimento”.
- Modal com:
  - tipo (fixo pelo botão ou selecionável);
  - valor em reais;
  - descrição/motivo;
  - prévia do saldo esperado após a movimentação.
- Sangria exige motivo; suprimento tem motivo opcional.
- O valor é convertido para centavos antes de enviar.
- Durante o envio, desabilitar o botão.
- Em sucesso, fechar o modal, atualizar o resumo e a tabela.
- Em erro, manter o modal aberto e mostrar a mensagem.

### 7.4 Fechamento

- Botão “Fechar Caixa”.
- Modal com:
  - saldo esperado (somente leitura);
  - campo “Valor contado (R$)”;
  - diferença calculada em tempo real;
  - rótulo “Exato”, “Sobra” ou “Falta”;
  - aviso quando a diferença não é zero.
- O fechamento não é bloqueado por diferença.
- Quando a diferença não é zero, pedir confirmação explícita antes de enviar.
- Durante o envio, desabilitar o botão.
- Em sucesso, mostrar o resultado do fechamento.
- Em `409`, mostrar a mensagem e recarregar o estado.

### 7.5 Resultado do fechamento

Mostrar:

- fundo de troco;
- vendas em dinheiro;
- suprimentos;
- sangrias;
- saldo esperado;
- valor contado;
- diferença com sinal e rótulo;
- data/hora de abertura e fechamento;
- botão “Abrir novo caixa”.

O resultado deve permanecer visível até o usuário iniciar um novo turno ou
recarregar a página.

### 7.6 Formatação, acessibilidade e responsividade

- Valores em BRL com vírgula decimal e duas casas.
- Datas em `America/Sao_Paulo`, formato `dd/mm/aaaa hh:mm`.
- Diferença negativa com sinal explícito (`-R$ 10,00`).
- Não usar apenas cor para indicar sobra/falta; usar rótulo textual.
- `aria-live="polite"` na área de mensagens.
- Modais com foco no primeiro campo, fechamento por `Esc` e botão “Cancelar”.
- Tabela com `<thead>`, `<th scope="col">` e `<tbody>`.
- Cards empilhados em telas estreitas.
- Tabela com rolagem horizontal em telas estreitas.
- Botões com rótulos claros e estados de carregamento.
- Nenhuma informação essencial depende de cor.

### 7.7 Tratamento de erros

- Erro de rede: “Erro ao carregar caixa. Verifique se o backend está online.”
- Erro de validação: exibir a mensagem do backend no formulário/modal.
- `409` de abertura: “Já existe um turno aberto.”
- `409` de movimentação/fechamento: “Não há turno aberto.”
- Nunca abrir modal vazio ou apagar o formulário antes da confirmação do
  servidor.

## 8. Wireframes textuais

### 8.1 Caixa sem turno aberto

```text
┌──────────────────────────────────────────────────────────────┐
│ ← Voltar para a página inicial                                │
│ Caixa                                                         │
│ Abertura, movimentações e fechamento de caixa por turno       │
├──────────────────────────────────────────────────────────────┤
│ Caixa fechado                                                 │
│ Não há turno aberto. Informe o valor inicial para abrir.      │
│                                                               │
│ Valor inicial (R$)                                            │
│ [ R$ 0,00                                                  ]  │
│                                                               │
│ [ Abrir Caixa ]                                               │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 Caixa aberto

```text
┌──────────────────────────────────────────────────────────────┐
│ ← Voltar para a página inicial                                │
│ Caixa                                                         │
│ Turno aberto em 09/11/2026 10:00                              │
├──────────────────────────────────────────────────────────────┤
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐     │
│ │ Saldo inicial  │ │ Vendas em      │ │ Suprimentos    │     │
│ │                │ │ dinheiro       │ │                │     │
│ │ R$ 100,00      │ │ R$ 250,00      │ │ R$ 50,00       │     │
│ └────────────────┘ └────────────────┘ └────────────────┘     │
│ ┌────────────────┐ ┌────────────────────────────────────┐     │
│ │ Sangrias       │ │ Saldo esperado                     │     │
│ │ R$ 30,00       │ │ R$ 370,00                          │     │
│ └────────────────┘ └────────────────────────────────────┘     │
│                                                               │
│ [ Atualizar ] [ Sangria ] [ Suprimento ] [ Fechar Caixa ]     │
│                                                               │
│ Movimentações                                                 │
│ ┌────────────┬────────────────────────┬────────────────────┐ │
│ │ Tipo       │ Descrição              │ Valor              │ │
│ ├────────────┼────────────────────────┼────────────────────┤ │
│ │ Sangria    │ Retirada para troco    │ R$ 30,00           │ │
│ │ Suprimento │ Reforço de caixa       │ R$ 50,00           │ │
│ └────────────┴────────────────────────┴────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 8.3 Modal de sangria/suprimento

```text
┌──────────────────────────────────────────────────┐
│ Registrar sangria                            [X] │
│                                                   │
│ Valor (R$)                                        │
│ [ R$ 0,00                                      ]  │
│                                                   │
│ Motivo *                                          │
│ [ Retirada para troco                          ]  │
│                                                   │
│ Saldo esperado atual:      R$ 370,00              │
│ Saldo após a movimentação: R$ 340,00              │
│                                                   │
│ [ Cancelar ]                    [ Registrar ]     │
└──────────────────────────────────────────────────┘
```

Para suprimento, o título muda para “Registrar suprimento” e o motivo é
opcional.

### 8.4 Modal de fechamento

```text
┌──────────────────────────────────────────────────┐
│ Fechar caixa                                 [X] │
│                                                   │
│ Saldo esperado:           R$ 370,00               │
│                                                   │
│ Valor contado (R$)                                │
│ [ R$ 360,00                                    ]  │
│                                                   │
│ Diferença:                -R$ 10,00 (Falta)       │
│                                                   │
│ ⚠ A diferença não é zero. Confira a contagem.     │
│                                                   │
│ [ Cancelar ]                    [ Fechar caixa ]  │
└──────────────────────────────────────────────────┘
```

### 8.5 Resultado do fechamento

```text
┌──────────────────────────────────────────────────────────────┐
│ Caixa fechado com sucesso                                     │
│                                                               │
│ Abertura:                09/11/2026 10:00                     │
│ Fechamento:              09/11/2026 20:00                     │
│                                                               │
│ Saldo inicial:           R$ 100,00                            │
│ Vendas em dinheiro:      R$ 250,00                            │
│ Suprimentos:             R$  50,00                            │
│ Sangrias:                R$  30,00                            │
│ Saldo esperado:          R$ 370,00                            │
│ Valor contado:           R$ 360,00                            │
│ Diferença:               -R$ 10,00 (Falta)                    │
│                                                               │
│ [ Abrir novo caixa ]                                          │
└──────────────────────────────────────────────────────────────┘
```

### 8.6 Mobile

```text
┌──────────────────────────────┐
│ ← Voltar                     │
│ Caixa                        │
│ Turno aberto 09/11 10:00     │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ Saldo inicial            │ │
│ │ R$ 100,00                │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Vendas em dinheiro       │ │
│ │ R$ 250,00                │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Suprimentos              │ │
│ │ R$ 50,00                 │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Sangrias                 │ │
│ │ R$ 30,00                 │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Saldo esperado           │ │
│ │ R$ 370,00                │ │
│ └──────────────────────────┘ │
│                              │
│ [ Sangria ] [ Suprimento ]   │
│ [ Fechar Caixa ]             │
│                              │
│ Movimentações                │
│ ┌──────────┬──────────────┐  │
│ │ Tipo     │ Valor        │  │
│ ├──────────┼──────────────┤  │
│ │ Sangria  │ R$ 30,00     │  │
│ └──────────┴──────────────┘  │
└──────────────────────────────┘
```

### 8.7 Estados vazios e de erro

```text
Sem movimentações
  Nenhuma sangria ou suprimento registrado.

Sem turno aberto
  Não há turno aberto. Informe o valor inicial para abrir o caixa.

Erro de rede
  Erro ao carregar caixa. Verifique se o backend está online.

Erro de validação
  Campo "amount" deve ser um inteiro em centavos maior que zero.

Turno já aberto
  Já existe um turno de caixa aberto (id 1). Feche-o antes de abrir outro.
```

## 9. Critérios de aceite

### 9.1 Modelo e migração

- **AC-CAIXA-01.** A tabela `cash_shifts` existe com `id`, `opened_at`,
  `closed_at`, `opening_balance`, `closing_balance` e `status`.
- **AC-CAIXA-02.** `opening_balance` é inteiro em centavos, `>= 0`; o valor
  máximo aceito é `100000000`.
- **AC-CAIXA-03.** `closing_balance` é nulo enquanto o turno está aberto e
  inteiro `>= 0` quando o turno está fechado.
- **AC-CAIXA-04.** `status` aceita apenas `open` e `closed`, e o banco impede
  estados inconsistentes (`open` com data/contagem de fechamento, ou `closed`
  sem elas).
- **AC-CAIXA-05.** O banco impede mais de um turno aberto ao mesmo tempo.
- **AC-CAIXA-06.** A tabela `cash_transactions` existe com `id`, `shift_id`,
  `type`, `amount`, `description` e `created_at`.
- **AC-CAIXA-07.** `type` aceita apenas `sangria` e `suprimento`; `amount` é
  inteiro `> 0`; `description` tem no máximo 200 caracteres.
- **AC-CAIXA-08.** `shift_id` referencia `cash_shifts(id)` e não permite apagar
  um turno com movimentações.
- **AC-CAIXA-09.** A migração do esquema parcial mapeia `opening_amount` →
  `opening_balance`, `counted_amount` → `closing_balance`, `note` →
  `description`, `cash_in` → `suprimento` e `cash_out` → `sangria`.
- **AC-CAIXA-10.** A migração descarta `sale`, `operator` e `order_id` do
  modelo-alvo, com backup e validação de somas.

### 9.2 Abertura

- **AC-CAIXA-11.** `POST /cash/shifts/open` com `openingBalance` válido
  responde `201` e cria um turno `open`.
- **AC-CAIXA-12.** O turno criado tem `closedAt = null`,
  `closingBalance = null` e saldo esperado igual ao valor inicial.
- **AC-CAIXA-13.** `openingBalance = 0` é aceito.
- **AC-CAIXA-14.** Abrir com turno já aberto responde `409` e não cria uma
  segunda linha.
- **AC-CAIXA-15.** `openingBalance` ausente, negativo, fracionário, texto ou
  acima do limite responde `400`.
- **AC-CAIXA-16.** A abertura grava `opened_at` em UTC ISO-8601.

### 9.3 Consulta do turno atual

- **AC-CAIXA-17.** `GET /cash/shifts/current` com turno aberto responde `200`
  com `shift`, `summary` e `transactions`.
- **AC-CAIXA-18.** Sem turno aberto, a rota responde `200` com
  `{ "shift": null, "summary": null, "transactions": [] }`.
- **AC-CAIXA-19.** `summary.cashSales` soma apenas pagamentos com método
  `cash` ou `dinheiro` dentro da janela do turno.
- **AC-CAIXA-20.** Vendas em cartão, débito, crédito e Pix não entram em
  `cashSales`.
- **AC-CAIXA-21.** Pagamentos fora da janela do turno não entram em
  `cashSales`.
- **AC-CAIXA-22.** `expectedBalance = openingBalance + cashSales + supplies -
  withdrawals`.
- **AC-CAIXA-23.** `transactions` vem ordenado por `createdAt` crescente e
  traz `typeLabel` e `amountFormatted`.
- **AC-CAIXA-24.** `transactionsCount` conta apenas sangrias e suprimentos, não
  vendas.

### 9.4 Sangria e suprimento

- **AC-CAIXA-25.** `POST /cash/transactions` com `type = 'sangria'`, valor
  positivo e descrição responde `201` e diminui o saldo esperado.
- **AC-CAIXA-26.** `POST /cash/transactions` com `type = 'suprimento'` e valor
  positivo responde `201` e aumenta o saldo esperado.
- **AC-CAIXA-27.** Suprimento sem descrição é aceito; descrição vazia vira
  `null`.
- **AC-CAIXA-28.** Sangria sem descrição não vazia responde `400`.
- **AC-CAIXA-29.** Tipo diferente de `sangria`/`suprimento`, valor zero,
  negativo, fracionário ou acima do limite responde `400`.
- **AC-CAIXA-30.** Movimentação sem turno aberto responde `409` e não cria
  linha.
- **AC-CAIXA-31.** A movimentação sempre pertence ao turno aberto; `shiftId`
  enviado no corpo é ignorado.
- **AC-CAIXA-32.** A resposta da movimentação inclui `transaction` e o
  `summary` atualizado.
- **AC-CAIXA-33.** Movimentações não podem ser editadas ou excluídas pelas
  rotas do bloco.

### 9.5 Fechamento

- **AC-CAIXA-34.** `POST /cash/shifts/close` com `closingBalance` válido
  responde `200`, marca o turno como `closed`, grava `closed_at` e
  `closing_balance`.
- **AC-CAIXA-35.** `differenceAmount = closingBalance - expectedBalance`.
- **AC-CAIXA-36.** Diferença zero retorna `differenceType = "exact"` e rótulo
  “Exato”.
- **AC-CAIXA-37.** Diferença positiva retorna `differenceType = "overage"` e
  rótulo “Sobra”.
- **AC-CAIXA-38.** Diferença negativa retorna `differenceType = "shortage"` e
  rótulo “Falta”.
- **AC-CAIXA-39.** O fechamento não é bloqueado por diferença diferente de
  zero.
- **AC-CAIXA-40.** Fechar sem turno aberto responde `409`; fechar duas vezes
  não cria segundo fechamento.
- **AC-CAIXA-41.** Depois do fechamento, novas movimentações respondem `409`.
- **AC-CAIXA-42.** A resposta do fechamento inclui o resumo completo e as
  movimentações do turno.
- **AC-CAIXA-43.** `closingBalance` ausente, negativo, fracionário, texto ou
  acima do limite responde `400`.

### 9.6 Concorrência e integridade

- **AC-CAIXA-44.** Duas aberturas concorrentes resultam em um único turno
  aberto; a perdedora recebe `409`.
- **AC-CAIXA-45.** Fechamento e movimentação concorrentes não deixam
  movimentação em turno fechado nem saldo inconsistente.
- **AC-CAIXA-46.** O fechamento é atômico: em erro, nada é gravado.
- **AC-CAIXA-47.** Valores monetários são inteiros em centavos em todas as
  rotas; não há arredondamento de fração de centavo.

### 9.7 Frontend

- **AC-CAIXA-48.** A tela `caixa.html` consulta `GET /cash/shifts/current` ao
  carregar.
- **AC-CAIXA-49.** Sem turno, a tela mostra o formulário de abertura; com
  turno, mostra cards, ações e tabela de movimentações.
- **AC-CAIXA-50.** O formulário de abertura aceita BRL, converte para centavos
  e valida valor maior ou igual a zero.
- **AC-CAIXA-51.** Os botões “Sangria” e “Suprimento” abrem modal com valor e
  motivo; sangria exige motivo.
- **AC-CAIXA-52.** O modal mostra a prévia do saldo esperado após a
  movimentação.
- **AC-CAIXA-53.** O modal de fechamento mostra o saldo esperado, o valor
  contado e a diferença calculada em tempo real.
- **AC-CAIXA-54.** Quando a diferença não é zero, a interface pede confirmação
  explícita antes de fechar.
- **AC-CAIXA-55.** O resultado do fechamento mostra abertura, vendas em
  dinheiro, suprimentos, sangrias, saldo esperado, valor contado e diferença
  com rótulo.
- **AC-CAIXA-56.** A tela tem estados de carregamento, erro e lista vazia.
- **AC-CAIXA-57.** A tela é responsiva e acessível: cards empilhados, tabela
  com rolagem, `aria-live`, modais com foco e `Esc`.
- **AC-CAIXA-58.** O link “Acessar Caixa” no `index.html` continua levando à
  página.

### 9.8 Não fiscal

- **AC-CAIXA-59.** Nenhuma tela ou resposta do Bloco 6 menciona nota fiscal,
  cupom fiscal, SEFAZ ou apuração tributária.
- **AC-CAIXA-60.** Sangria e suprimento são tratados como movimentos internos
  de dinheiro, não como receita ou despesa.

## 10. Divergências e pendências

### 10.1 O que já existe

- Tabelas parciais `cash_shifts` e `cash_transactions` em
  `backend/src/database.js`.
- Página `frontend/caixa.html` e script `frontend/caixa.js`.
- Link “Acessar Caixa” no `index.html`.
- Nenhuma rota de caixa registrada em `backend/src/server.js`.
- Nenhum teste de caixa.

### 10.2 Divergências encontradas

| ID | Divergência | Impacto | Encaminhamento |
| --- | --- | --- | --- |
| D-01 | `cash_shifts` usa `opening_amount`/`counted_amount` em vez de `opening_balance`/`closing_balance`. | Contrato e frontend não batem com o modelo pedido. | Migrar o schema para os nomes-alvo. |
| D-02 | `cash_shifts` exige `operator`, ausente no modelo pedido. | Abertura falharia sem operador; campo não previsto. | Remover do modelo deste bloco; preservar em backup. |
| D-03 | `cash_transactions` usa `note` em vez de `description`. | Payload e tela divergem. | Renomear na migração. |
| D-04 | `cash_transactions` usa `sale`, `cash_in` e `cash_out` em vez de `sangria`/`suprimento`. | Tipo `sale` duplica a apuração de vendas. | Migrar `cash_in`/`cash_out`; descartar `sale`; vendas vêm de `payments`. |
| D-05 | `cash_transactions` tem `order_id`, ausente no modelo pedido. | Vínculo desnecessário para o escopo. | Remover; vendas vêm de `payments`. |
| D-06 | Não há rotas de caixa registradas. | A tela não funciona. | Implementar as quatro rotas da seção 5. |
| D-07 | O frontend chama `/cash`, `/cash/open`, `/cash/movements` e `/cash/close`. | Endpoints não existem no contrato. | Reescrever para `/cash/shifts/*` e `/cash/transactions`. |
| D-08 | O frontend espera `404` para “sem turno”. | O contrato devolve `200` com `shift: null`. | Ajustar a leitura do estado. |
| D-09 | O frontend usa `prompt` para movimentação e fechamento. | UX ruim, sem validação e sem prévia. | Substituir por modais da seção 8. |
| D-10 | O frontend pede valores em centavos. | Usuário precisa calcular centavos. | Aceitar BRL e converter para centavos. |
| D-11 | O frontend usa “Saldo Atual” para o saldo esperado. | Pode ser confundido com contagem física. | Rotular “Saldo esperado”. |
| D-12 | Não há testes de caixa. | Regras críticas sem cobertura. | Criar `backend/tests/cash.test.js`. |
| D-13 | O frontend envia `initialAmount`/`countedAmount` e espera `balance`/`movements`. | Payload e resposta não batem com o contrato-alvo. | Usar `openingBalance`/`closingBalance`, `summary.expectedBalance` e `transactions`. |
| D-14 | O `CHECK` atual de `payments.method` aceita `dinheiro`, `cartao` e `pix`, enquanto o contrato-alvo do Bloco 2 usa `cash`, `credit_card`, `debit_card` e `pix`. | Se o caixa somar apenas um dos nomes de dinheiro, `cashSales` fica zerado ou incompleto durante a transição. | Somar `cash` e `dinheiro`; acompanhar a migração do enum no Bloco 2. |

### 10.3 Pendências

1. Migrar o schema para `opening_balance`, `closing_balance`,
   `description`, `sangria`/`suprimento`, removendo `operator`, `order_id` e
   `sale`.
2. Implementar `POST /cash/shifts/open`.
3. Implementar `GET /cash/shifts/current`.
4. Implementar `POST /cash/transactions`.
5. Implementar `POST /cash/shifts/close`.
6. Centralizar o cálculo de vendas em dinheiro e a lista de métodos de
   dinheiro.
7. Persistir, se aprovado, `cash_sales`, `expected_balance` e
   `difference_amount` no fechamento.
8. Reescrever `frontend/caixa.js` para as novas rotas e payloads.
9. Substituir `prompt` por modais com validação e prévia.
10. Adicionar estados de carregamento, erro e resultado de fechamento.
11. Criar testes de abertura, movimentação, fechamento, concorrência e
    validação.
12. Atualizar `backend/README.md` com as rotas de caixa.
13. Revisar o link e o texto do módulo no `index.html`.

### 10.4 Situação dos testes

- Não existe `backend/tests/cash.test.js`.
- Não há rotas de caixa para testar.
- A suíte atual do backend não cobre o Bloco 6.
- A implementação parcial do frontend não é funcional contra o backend atual.
- A conclusão do bloco exige testes próprios, executados em banco isolado.

### 10.5 Observações de documentação

- `docs/backlog-pagamentos.md` define as formas de pagamento; o caixa lê
  `payments` e não altera aquele contrato.
- O enum de `payments.method` está em transição entre `dinheiro`/`cartao` e
  `cash`/`credit_card`/`debit_card`; o caixa trata `cash` e `dinheiro` como
  dinheiro e não depende da conclusão dessa migração.
- `docs/backlog-dashboard.md` usa a mesma base de caixa; o Dashboard não deve
  ser alterado por este bloco.
- `docs/backlog-garcons.md` define a comissão; o caixa não a desconta
  automaticamente.
- `backend/README.md` deve apontar para este documento após a implementação.
- O código parcial atual não é a fonte da verdade para este bloco; os
  requisitos explícitos do produto prevalecem.

## 11. Riscos e decisões

### 11.1 Riscos

| ID | Risco | Probabilidade | Impacto | Mitigação |
| --- | --- | --- | --- | --- |
| R-01 | Duas aberturas concorrentes criarem dois turnos abertos. | Média | Alto | Índice único parcial + transação. |
| R-02 | Venda em dinheiro fora do turno não entrar no saldo. | Alta | Médio | Abrir o caixa antes de operar; documentar o limite; futuro vínculo por `shift_id`. |
| R-03 | Venda em dinheiro concorrente com o fechamento ficar de fora. | Média | Alto | Transação de fechamento; orientar não fechar com comandas em pagamento. |
| R-04 | Métodos de pagamento divergentes (`cash` vs `dinheiro`) não serem somados. | Média | Alto | Lista centralizada de métodos de dinheiro. |
| R-05 | Diferença negativa ser formatada ou interpretada errado. | Média | Médio | Convenção de sinal e rótulos explícitos. |
| R-06 | Migração do schema parcial perder dados. | Média | Alto | Backup, mapeamento e validação de somas. |
| R-07 | Comissão paga da gaveta não ser registrada como sangria. | Alta | Médio | Orientar o operador; documentar a regra 6.11. |
| R-08 | Frontend usar `prompt` e permitir valores inválidos. | Alta | Médio | Substituir por modais validados. |
| R-09 | Saldo esperado ser confundido com saldo bancário. | Média | Baixo | Rotular “Saldo esperado” e explicar a natureza operacional. |
| R-10 | Falta de operador/autoria das movimentações. | Média | Médio | Fora do escopo atual; futuro `opened_by`/`closed_by`. |
| R-11 | Movimentação errada não poder ser corrigida. | Média | Médio | Movimentação oposta com descrição; futuro estorno. |
| R-12 | Fechamento sem conferência física gerar diferença artificial. | Baixa | Alto | Exigir contagem física e confirmação quando houver diferença. |

### 11.2 Decisões adotadas

1. O modelo do produto prevalece sobre o schema parcial atual.
2. `cash_transactions` guarda apenas sangria e suprimento.
3. Vendas em dinheiro são derivadas de `payments`, não gravadas como
   movimentação.
4. Métodos de dinheiro: `cash` e `dinheiro`.
5. Só existe um turno aberto, garantido no banco.
6. `GET /cash/shifts/current` devolve `200` com `shift: null` quando não há
   turno.
7. O saldo exibido no turno aberto é o saldo esperado.
8. `differenceAmount = closingBalance - expectedBalance`.
9. Diferença zero é `exact`; positiva é `overage`; negativa é `shortage`.
10. O fechamento não bloqueia diferença.
11. Sangria exige descrição; suprimento tem descrição opcional.
12. Turno fechado não é reaberto nem editado.
13. Não há exclusão de turno ou movimentação.
14. O turno pode atravessar a meia-noite.
15. Não há operador/autoria neste bloco.
16. Não há integração fiscal, bancária ou de adquirente.
17. A interface aceita BRL e converte para centavos.
18. A tela usa modais, não `prompt`.

### 11.3 Decisões pendentes

1. Persistir `cash_sales`, `expected_balance` e `difference_amount` no
   fechamento.
2. Adicionar `payments.cash_shift_id` para vínculo explícito.
3. Adicionar operador/autoria (`opened_by`, `closed_by`).
4. Criar histórico de turnos fechados.
5. Criar fluxo de estorno/correção de movimentação.
6. Exigir justificativa quando a diferença não for zero.
7. Bloquear venda em dinheiro sem turno aberto.
8. Definir limite máximo de abertura/fechamento por configuração.

## 12. Definição de pronto

O Bloco 6 só é considerado concluído quando:

- [ ] `cash_shifts` e `cash_transactions` seguem o modelo-alvo.
- [ ] A migração do schema parcial foi aplicada com backup e validação.
- [ ] `POST /cash/shifts/open` está implementado e testado.
- [ ] `GET /cash/shifts/current` está implementado e testado.
- [ ] `POST /cash/transactions` está implementado e testado.
- [ ] `POST /cash/shifts/close` está implementado e testado.
- [ ] Apenas um turno pode ficar aberto por vez.
- [ ] Sangria diminui e suprimento aumenta o saldo esperado.
- [ ] Vendas em dinheiro entram no saldo esperado; cartão/Pix não entram.
- [ ] O fechamento calcula e devolve a diferença com sinal e rótulo.
- [ ] O fechamento não bloqueia diferença diferente de zero.
- [ ] Turno fechado não aceita movimentação nem reabertura.
- [ ] O frontend usa as rotas novas e não usa `prompt`.
- [ ] O frontend mostra abertura, turno aberto, movimentações e resultado do
      fechamento.
- [ ] O frontend aceita BRL e converte para centavos.
- [ ] A tela tem estados de carregamento, erro e vazio.
- [ ] A tela é responsiva e acessível.
- [ ] Os testes de caixa passam em banco isolado.
- [ ] `backend/README.md` documenta as rotas de caixa.
- [ ] Nenhuma tela ou resposta sugere documento fiscal.
- [ ] `docs/backlog-pagamentos.md` permanece inalterado.
