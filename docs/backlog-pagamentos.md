# Backlog — Pagamentos e Fechamento de Caixa (Bloco 2)

| Campo | Valor |
| --- | --- |
| Produto | Sistema de gestão não fiscal para restaurantes, pizzarias e lanchonetes |
| Módulo | Pagamentos, fechamento de caixa e relatórios |
| Bloco | 2 |
| Responsável | Product Manager |
| Status | Aprovado; implementação em andamento com divergências a corrigir (seção 12) |
| Versão | 1.0 |
| Data | 2026-11-07 |

## 1. Contexto e objetivo

O Bloco 1 encerrou o ciclo operacional da mesa: cardápio, mesas, abertura de
comanda, itens, fechamento da comanda e liberação da mesa. O fechamento atual,
porém, não registra **como** o cliente pagou e o sistema ainda não apura vendas.

**Objetivo do Bloco 2:** registrar a forma de pagamento no fechamento da
comanda e oferecer duas leituras de caixa:

- `GET /reports/sales` — total vendido por período e por forma de pagamento.
- `GET /reports/summary` — total do dia, ticket médio e itens mais vendidos.

**Resultado esperado:** ao encerrar uma comanda, o operador escolhe a forma de
pagamento; o sistema grava o valor devido, fecha a comanda e passa a refletir a
venda nos relatórios do dia e do período.

**Limite de escopo deste bloco:** “fechamento de caixa” aqui significa registrar
pagamentos de comandas e apurar vendas. Abertura/fechamento de turno, sangria,
suprimento e conferência física de gaveta ficam para um bloco futuro.

## 2. Escopo

### 2.1 Dentro do escopo

- Quatro formas de pagamento: Dinheiro, Cartão de Crédito, Cartão de Débito e
  Pix.
- Fechamento de comanda com uma forma de pagamento.
- Registro do valor pago como o total da comanda, calculado pela API.
- Data/hora de fechamento da comanda.
- Extensão do contrato de `GET /orders/:id` com `closedAt` e `payments`.
- `GET /reports/sales` com filtro por período e agrupamento por forma de
  pagamento.
- `GET /reports/summary` com total do dia, ticket médio e itens mais vendidos.
- Modal de pagamento na tela da comanda.
- Página de resumo de vendas consumindo `GET /reports/summary`.
- Testes automatizados e documentação.

### 2.2 Fora do escopo

- Pagamento dividido em mais de uma forma na mesma comanda (split payment).
- Integração com adquirente, TEF, maquininha, Pix automático ou conciliação.
- Parcelamento, juros, bandeira do cartão e autorização.
- Desconto, acréscimo, taxa de serviço, gorjeta e cortesia.
- Estorno, cancelamento de pagamento ou devolução parcial.
- Abertura/fechamento de turno, sangria, suprimento e conferência de gaveta.
- Fechamento de caixa por operador.
- Emissão de nota fiscal, cupom fiscal ou qualquer documento fiscal.
- Baixa de estoque e custo de mercadoria.
- Autenticação, permissões e auditoria de usuário.
- Exportação CSV/PDF dos relatórios.
- Tela completa de vendas por período e forma de pagamento; neste bloco apenas
  a rota e a página de resumo.
- Funcionários, atribuição de mesas e comissão.

## 3. Estado de partida

- Tabelas existentes: `categories`, `products`, `tables`, `orders` e
  `order_items`.
- `orders` tem `id`, `table_id`, `status` (`open`/`closed`) e `created_at`.
- Não existe `closed_at` nem tabela de pagamentos.
- `POST /orders/:id/close` fecha a comanda sem corpo e sem registrar pagamento.
- `GET /orders/:id` devolve itens, subtotal e total; não devolve pagamento.
- Valores monetários são inteiros em centavos; `formatBRL` gera os campos
  `*Formatted`.
- O frontend já tem um modal de pagamento em andamento na tela da comanda e uma
  página de resumo em `frontend/relatorios.html`; ambos devem ser alinhados ao
  contrato deste documento.
- Ainda não existem as rotas `/reports/*` no início do bloco. A implementação
  em andamento já as criou; o que falta está na seção 12.

## 4. Formas de pagamento

| Valor na API | Rótulo na interface | Observações |
| --- | --- | --- |
| `cash` | Dinheiro | O troco é calculado na interface; a API grava apenas o valor devido. |
| `credit_card` | Cartão de Crédito | Registro manual; sem integração com adquirente. |
| `debit_card` | Cartão de Débito | Registro manual; sem integração com adquirente. |
| `pix` | Pix | Registro manual; sem integração com banco ou PSP. |

Regras:

- A API usa os valores em inglês, seguindo o padrão dos demais enums do sistema
  (`free`, `occupied`, `open`, `closed`).
- A interface exibe os rótulos em português.
- Os quatro valores são obrigatórios no contrato; `card` genérico não é aceito.
- Não há diferença de comportamento entre as formas no fechamento: todas
  registram o total da comanda e entram nos relatórios.
- A escolha da forma é operacional. O sistema **não** confirma pagamento com
  maquininha, banco ou adquirente.

## 5. Modelo de dados

### 5.1 Tabela `payments`

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `id` | Inteiro | Sim (gerado) | Chave primária. |
| `order_id` | Inteiro | Sim | Referência a `orders.id`; exclusão em cascata. |
| `method` | Texto | Sim | `cash`, `credit_card`, `debit_card` ou `pix`. |
| `amount` | Inteiro | Sim | Valor em centavos; maior ou igual a 0. |
| `created_at` | Texto | Sim (gerado) | ISO 8601 UTC. |

Regras:

- No Bloco 2 é gravada **uma linha por comanda fechada**.
- O índice único `uq_payments_order` em `order_id` garante essa invariante no
  banco. Split payment exigirá remover esse índice em um bloco futuro.
- `amount` é o total da comanda no momento do fechamento, não um valor enviado
  pelo cliente.
- `amount` aceita 0 para o caso de comanda com total zerado.
- Índices: `idx_payments_order_id`, `idx_payments_created_at` e
  `uq_payments_order` (único).

### 5.2 Coluna `orders.closed_at`

- Nova coluna `closed_at TEXT`, anulável.
- Preenchida na mesma transação que fecha a comanda.
- Comandas abertas permanecem com `closed_at = NULL`.
- Comandas fechadas antes do Bloco 2 ficam com `closed_at = NULL` e sem
  pagamento; elas não entram nos relatórios.

### 5.3 Migração do schema inline

- Em banco novo, `closed_at` entra no `CREATE TABLE "orders"`.
- Em banco existente, a coluna é adicionada com `ALTER TABLE "orders" ADD COLUMN
  closed_at TEXT`, protegida por verificação em `PRAGMA table_info("orders")`.
- A tabela `payments` e seus índices usam `CREATE TABLE/INDEX IF NOT EXISTS`.
- Não há exclusão de dados nem recriação de tabelas.
- O schema continua inline em `backend/src/database.js`, sem arquivos `.sql` ou
  tabela de migrações.

### 5.4 Extensão da representação da comanda

`GET /orders/:id`, `POST /orders`, `POST /orders/:id/items` e
`POST /orders/:id/close` passam a devolver:

- `closedAt`: texto ISO UTC ou `null`.
- `payments`: lista de pagamentos; vazia em comanda aberta.

Cada pagamento:

| Campo | Tipo | Regra |
| --- | --- | --- |
| `id` | Inteiro | Chave primária. |
| `method` | Texto | Enum da seção 4. |
| `methodLabel` | Texto | Rótulo em português gerado pela API. |
| `amount` | Inteiro | Centavos. |
| `amountFormatted` | Texto | BRL gerado por `formatBRL`. |
| `createdAt` | Texto | ISO UTC. |

## 6. Fechamento com pagamento — `POST /orders/:id/close`

### 6.1 Objetivo

Fechar uma comanda aberta registrando a forma de pagamento e o valor devido,
sem alterar itens, preços ou o status da mesa.

### 6.2 Corpo da requisição

```json
{ "paymentMethod": "cash" }
```

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `paymentMethod` | Texto | Condicional | Obrigatório quando há corpo; `cash`, `credit_card`, `debit_card` ou `pix`. |

O cliente **não envia valor**. A API calcula o total da comanda e grava esse
valor em `payments.amount`.

**Compatibilidade:** corpo ausente é aceito apenas para não quebrar o fluxo da
Fase 8 — a comanda fecha sem pagamento e fica fora dos relatórios. A interface
sempre envia `paymentMethod`; o fechamento sem pagamento é um caminho legado,
não o fluxo normal.

### 6.3 Regras

1. `:id` precisa ser inteiro positivo; caso contrário, `400`.
2. Quando há corpo, `paymentMethod` ausente ou inválido retorna `400` mesmo que
   a comanda não exista.
3. Comanda inexistente retorna `404`.
4. Comanda já `closed` retorna `409` e não cria pagamento duplicado.
5. Comanda aberta sem itens retorna `409` e não é fechada.
6. O total é calculado dentro da transação, somando `quantity * unit_price` de
   todos os itens.
7. A API grava uma linha em `payments` com `method = paymentMethod` e
   `amount = total`.
8. A comanda passa para `status = 'closed'` e recebe `closed_at` UTC.
9. A mesa **não** é alterada; continua `occupied` até o fechamento explícito da
   mesa.
10. Comanda com total 0 fecha com pagamento de `amount = 0`.
11. A operação é atômica: validação, cálculo, inserção do pagamento e
    fechamento ocorrem em `BEGIN IMMEDIATE`; erro executa `ROLLBACK`.
12. Duas requisições concorrentes de fechamento: apenas uma vence; a outra
    recebe `409` e não grava pagamento.
13. Não há split payment neste bloco: apenas uma forma por comanda.
14. Sem corpo, a comanda fecha com `closed_at` e sem linha em `payments`; esse
    caso não conta como venda nos relatórios.

### 6.4 Resposta de sucesso

Retorna `200` com a comanda no formato de `GET /orders/:id`, incluindo:

- `id`, `tableId`, `status` (`closed`), `createdAt`, `closedAt`.
- `items` com os mesmos campos já existentes.
- `total` e `totalFormatted` inalterados em relação ao fechamento.
- `payments` com uma linha contendo `method`, `methodLabel`, `amount`,
  `amountFormatted` e `createdAt`.

### 6.5 Erros

| Código | Situação |
| --- | --- |
| 400 | `id` inválido; corpo presente com `paymentMethod` ausente, desconhecido ou `card` genérico. |
| 404 | Comanda inexistente. |
| 409 | Comanda já fechada; comanda aberta sem itens; fechamento concorrente. |
| 500 | Erro interno inesperado. |

### 6.6 Mudança de contrato

- O fluxo normal passa a exigir `paymentMethod`; o frontend sempre o envia.
- Chamadas sem corpo continuam aceitas por compatibilidade com a Fase 8 e
  fecham a comanda sem pagamento. Esses testes permanecem válidos.
- O frontend em andamento precisa trocar `cash`/`card`/`pix` por
  `cash`/`credit_card`/`debit_card`/`pix`; hoje o enum não bate com o backend
  e apenas Pix funciona (ver seção 12).
- Comandas fechadas antes desta mudança permanecem no banco, mas sem pagamento
  e sem `closed_at`; não entram nos relatórios.

## 7. Relatório de vendas — `GET /reports/sales`

### 7.1 Objetivo

Apurar o total vendido em um período e distribuir o valor por forma de
pagamento.

### 7.2 Parâmetros de consulta

| Parâmetro | Formato | Obrigatório | Regra |
| --- | --- | --- | --- |
| `from` | `YYYY-MM-DD` | Não | Início do período, inclusive. |
| `to` | `YYYY-MM-DD` | Não | Fim do período, inclusive. |

Regras:

- Sem `from` e `to`, o período é o dia atual.
- Apenas `from` informado: `to = from`.
- Apenas `to` informado: `from = to`.
- As datas são interpretadas no fuso `America/Sao_Paulo` (UTC-3).
- O banco armazena timestamps em UTC; a API converte o intervalo local para
  UTC antes de consultar.
- `from` maior que `to` retorna `400`.
- Formato inválido ou data inexistente retorna `400`.

### 7.3 Resposta de sucesso

```json
{
  "from": "2026-11-01",
  "to": "2026-11-07",
  "timezone": "America/Sao_Paulo",
  "ordersCount": 12,
  "total": 123456,
  "totalFormatted": "R$ 1.234,56",
  "byMethod": [
    {
      "method": "cash",
      "label": "Dinheiro",
      "ordersCount": 4,
      "total": 30000,
      "totalFormatted": "R$ 300,00"
    },
    {
      "method": "credit_card",
      "label": "Cartão de Crédito",
      "ordersCount": 5,
      "total": 60000,
      "totalFormatted": "R$ 600,00"
    },
    {
      "method": "debit_card",
      "label": "Cartão de Débito",
      "ordersCount": 2,
      "total": 20000,
      "totalFormatted": "R$ 200,00"
    },
    {
      "method": "pix",
      "label": "Pix",
      "ordersCount": 1,
      "total": 13456,
      "totalFormatted": "R$ 134,56"
    }
  ]
}
```

### 7.4 Regras

- Considera apenas comandas com `status = 'closed'`, `closed_at` dentro do
  período e pelo menos um pagamento registrado.
- Comandas abertas, canceladas ou fechadas sem pagamento ficam fora.
- `ordersCount` é o número de comandas pagas no período.
- `total` é a soma dos pagamentos do período, em centavos.
- `byMethod` sempre traz as quatro formas, inclusive com `total = 0` e
  `ordersCount = 0`.
- A soma de `byMethod[].total` é igual a `total`.
- A soma de `byMethod[].ordersCount` é igual a `ordersCount` neste bloco, pois
  cada comanda tem uma única forma.
- `total` e `byMethod[].total` são inteiros em centavos; os campos
  `*Formatted` usam BRL.
- Sem comandas no período, retorna `200` com zeros.
- A rota é somente leitura e não altera dados.

### 7.5 Erros

| Código | Situação |
| --- | --- |
| 400 | `from` ou `to` com formato inválido, data inexistente ou `from > to`. |
| 500 | Erro interno inesperado. |

## 8. Resumo do dia — `GET /reports/summary`

### 8.1 Objetivo

Mostrar o desempenho de um dia: total vendido, ticket médio, quantidade de
comandas, itens vendidos e itens mais vendidos.

### 8.2 Parâmetros de consulta

| Parâmetro | Formato | Obrigatório | Regra |
| --- | --- | --- | --- |
| `date` | `YYYY-MM-DD` | Não | Dia de referência; padrão é hoje. |
| `limit` | Inteiro | Não | Quantidade de itens mais vendidos; padrão 10, mínimo 1, máximo 50. |

Regras:

- A data é interpretada no fuso `America/Sao_Paulo` (UTC-3).
- Formato inválido ou data inexistente retorna `400`.
- `limit` não inteiro, menor que 1 ou maior que 50 retorna `400`.

### 8.3 Resposta de sucesso

```json
{
  "date": "2026-11-07",
  "timezone": "America/Sao_Paulo",
  "ordersCount": 12,
  "total": 123456,
  "totalFormatted": "R$ 1.234,56",
  "averageTicket": 10288,
  "averageTicketFormatted": "R$ 102,88",
  "itemsSold": 47,
  "topItems": [
    {
      "productId": 3,
      "productName": "Pizza Margherita",
      "quantity": 15,
      "total": 67500,
      "totalFormatted": "R$ 675,00"
    }
  ]
}
```

### 8.4 Regras

- Considera apenas comandas com `status = 'closed'`, `closed_at` no dia e pelo
  menos um pagamento registrado.
- `ordersCount` é o número de comandas pagas no dia.
- `total` é a soma dos pagamentos do dia, em centavos.
- `averageTicket` é `round(total / ordersCount)` em centavos, com metade para
  cima; quando `ordersCount = 0`, o valor é `0`.
- `itemsSold` é a soma das quantidades de todos os itens dessas comandas.
- `topItems` agrupa por `product_id` e calcula:
  - `quantity`: soma das quantidades;
  - `total`: soma de `quantity * unit_price`, em centavos.
- A ordenação de `topItems` é: quantidade decrescente, total decrescente,
  `productId` crescente.
- `limit` padrão 10, máximo 50.
- `productName` é resolvido no cadastro atual do produto; não é snapshot
  histórico.
- Sem comandas no dia, retorna `200` com `total = 0`, `ordersCount = 0`,
  `averageTicket = 0`, `itemsSold = 0` e `topItems = []`.
- A rota é somente leitura e não altera dados.

### 8.5 Erros

| Código | Situação |
| --- | --- |
| 400 | `date` inválida; `limit` fora de 1–50 ou não inteiro. |
| 500 | Erro interno inesperado. |

## 9. Regras transversais

- **Dinheiro em centavos:** `amount`, `total`, `averageTicket` e os totais dos
  relatórios são inteiros em centavos; a formatação BRL é feita em campos
  explícitos `*Formatted`.
- **Sem ponto flutuante:** cálculos monetários usam inteiros; o único
  arredondamento é o ticket médio, com metade para cima.
- **Fuso horário:** timestamps são armazenados em UTC; os relatórios usam
  `America/Sao_Paulo` e devolvem o campo `timezone`.
- **Atomicidade:** fechar comanda, gravar pagamento e preencher `closed_at`
  ocorrem na mesma transação.
- **Concorrência:** fechamento duplo não cria pagamento duplicado; a segunda
  requisição recebe `409`.
- **Somente leitura:** as rotas de relatório não criam, alteram nem excluem
  dados.
- **Erros:** respostas usam `{ "error": "..." }`, em português, sem SQL, stack
  trace ou caminhos internos.
- **Free First:** nenhuma dependência paga, serviço externo, adquirente ou banco
  adicional.
- **Não fiscal:** nenhuma operação gera nota, cupom ou obrigação tributária.
- **Sem autenticação:** as rotas seguem o padrão aberto das fases anteriores;
  permissões ficam para um bloco futuro.
- **Compatibilidade:** campos novos na comanda (`closedAt`, `payments`) são
  aditivos; a mudança obrigatória de `paymentMethod` é a única quebra de
  contrato.
- **Desempenho:** os relatórios usam os índices de `orders.closed_at`,
  `payments.order_id`, `payments.created_at` e `order_items.order_id`.

## 10. Integração com o Frontend

### 10.1 Tela da comanda

- O botão "Fechar Comanda" abre o modal de pagamento em vez de fechar direto.
- O modal mostra o total da comanda e as quatro formas de pagamento:
  Dinheiro, Cartão de Crédito, Cartão de Débito e Pix.
- O operador escolhe uma forma e confirma.
- A requisição envia `{ "paymentMethod": "<enum>" }` para
  `POST /orders/:id/close`.
- Em `200`, a tela informa o sucesso e volta para `mesas.html`; a mesa continua
  `occupied` até o fechamento explícito.
- Em `400`, `404` ou `409`, a mensagem do backend é exibida e o modal permanece
  aberto.
- Para Dinheiro, a tela pode ter um campo local de "valor recebido" e calcular o
  troco; esse valor não é enviado à API.
- O modal atual precisa ser ajustado: envia `cash`/`card`/`pix`, mas o backend
  aceita `dinheiro`/`cartao`/`pix`; deve passar a enviar
  `cash`/`credit_card`/`debit_card`/`pix` (seção 12).

### 10.2 Página de resumo

- `frontend/relatorios.html` consome `GET /reports/summary`.
- Exibe total vendido, ticket médio, quantidade de comandas e a tabela de itens
  mais vendidos.
- Usa os campos formatados quando disponíveis.
- Mostra estados de carregamento, erro de rede e ausência de vendas.
- A tela de vendas por período e forma de pagamento fica para um bloco futuro;
  a rota `GET /reports/sales` já fica disponível para consumo.

## 11. Critérios de aceite

### 11.1 Gerais

- [ ] **AC-PAY-01** — `POST /orders/:id/close` e as duas rotas de relatório
  respondem em JSON e usam `200` no sucesso.
- [ ] **AC-PAY-02** — Erros tratados retornam `{ "error": "..." }`, sem SQL,
  stack trace ou caminhos internos.
- [ ] **AC-PAY-03** — Valores monetários são inteiros em centavos e os campos
  `*Formatted` usam BRL.
- [ ] **AC-PAY-04** — Nenhuma dependência paga, integração externa ou
  funcionalidade fiscal é adicionada.
- [ ] **AC-PAY-05** — O bloco tem documentação e testes automatizados
  aprovados.

### 11.2 Fechamento com pagamento

- [ ] **AC-PAY-06** — Fechar comanda aberta com `cash` retorna `200`, grava
  pagamento com método `cash` e valor igual ao total, e define `closedAt`.
- [ ] **AC-PAY-07** — O mesmo vale para `credit_card`, `debit_card` e `pix`.
- [ ] **AC-PAY-08** — O valor gravado é calculado pela API; nenhum valor
  enviado pelo cliente é aceito ou usado.
- [ ] **AC-PAY-09** — Corpo presente com `paymentMethod` ausente, desconhecido
  ou `card` retorna `400` e a comanda continua `open`.
- [ ] **AC-PAY-10** — Fechar comanda já `closed` retorna `409` e não cria
  segundo pagamento.
- [ ] **AC-PAY-11** — Fechar comanda aberta sem itens retorna `409`.
- [ ] **AC-PAY-12** — Comanda inexistente retorna `404`; `id` inválido retorna
  `400`.
- [ ] **AC-PAY-13** — Após o pagamento, a mesa continua `occupied`.
- [ ] **AC-PAY-14** — `GET /orders/:id` devolve `closedAt` e `payments`; em
  comanda aberta, `closedAt` é `null` e `payments` é vazio.
- [ ] **AC-PAY-15** — Duas requisições concorrentes de fechamento resultam em
  um `200` e um `409`, com apenas um pagamento gravado.
- [ ] **AC-PAY-16** — Pagamento e `closed_at` persistem após reinício do
  servidor.
- [ ] **AC-PAY-17** — Comanda com total 0 fecha com pagamento de valor 0.
- [ ] **AC-PAY-18** — Fechar sem corpo continua permitido por compatibilidade:
  grava `closed_at`, não cria pagamento e a comanda fica fora dos relatórios.
- [ ] **AC-PAY-19** — Falha em qualquer etapa não deixa comanda fechada sem
  pagamento nem pagamento sem comanda fechada.
- [ ] **AC-PAY-20** — A resposta do fechamento contém `methodLabel` em
  português e `amountFormatted` em BRL.

### 11.3 `GET /reports/sales`

- [ ] **AC-SALES-01** — A rota retorna `200` com `from`, `to`, `timezone`,
  `ordersCount`, `total`, `totalFormatted` e `byMethod`.
- [ ] **AC-SALES-02** — `byMethod` sempre contém as quatro formas, inclusive
  com zero.
- [ ] **AC-SALES-03** — A soma de `byMethod[].total` é igual a `total`.
- [ ] **AC-SALES-04** — Apenas comandas fechadas, com pagamento e com
  `closed_at` no período entram no cálculo.
- [ ] **AC-SALES-05** — O filtro de datas é inclusivo e respeita o fuso
  `America/Sao_Paulo`.
- [ ] **AC-SALES-06** — Sem parâmetros, o período é o dia atual.
- [ ] **AC-SALES-07** — Informar apenas `from` ou apenas `to` usa a mesma data
  para as duas pontas.
- [ ] **AC-SALES-08** — Data inválida, data inexistente ou `from > to` retorna
  `400`.
- [ ] **AC-SALES-09** — Período sem vendas retorna `200` com totais e contadores
  zerados.
- [ ] **AC-SALES-10** — Comandas abertas ou fechadas sem pagamento não entram
  no relatório.
- [ ] **AC-SALES-11** — `ordersCount` total é a soma de `ordersCount` por forma
  neste bloco.
- [ ] **AC-SALES-12** — A resposta inclui `timezone` e não expõe detalhes
  internos do banco.

### 11.4 `GET /reports/summary`

- [ ] **AC-SUM-01** — A rota retorna `200` com `date`, `timezone`,
  `ordersCount`, `total`, `totalFormatted`, `averageTicket`,
  `averageTicketFormatted`, `itemsSold` e `topItems`.
- [ ] **AC-SUM-02** — `total` é a soma dos pagamentos das comandas pagas no dia.
- [ ] **AC-SUM-03** — `averageTicket` é `round(total / ordersCount)`, com metade
  para cima.
- [ ] **AC-SUM-04** — Sem comandas, `averageTicket` é `0`.
- [ ] **AC-SUM-05** — `topItems` é ordenado por quantidade decrescente, total
  decrescente e `productId` crescente.
- [ ] **AC-SUM-06** — `limit` padrão é 10, máximo 50; valor inválido retorna
  `400`.
- [ ] **AC-SUM-07** — `date` inválida retorna `400`.
- [ ] **AC-SUM-08** — `itemsSold` é a soma das quantidades dos itens das
  comandas pagas no dia.
- [ ] **AC-SUM-09** — Dia sem vendas retorna totais zerados e `topItems` vazio.
- [ ] **AC-SUM-10** — `topItems` considera apenas itens de comandas pagas no
  dia.
- [ ] **AC-SUM-11** — O total de cada item é a soma de
  `quantity * unit_price`, em centavos.
- [ ] **AC-SUM-12** — `productName` é resolvido no cadastro atual e os valores
  têm campos formatados em BRL.

### 11.5 Frontend

- [ ] **AC-FE-01** — O botão "Fechar Comanda" abre o modal de pagamento.
- [ ] **AC-FE-02** — O modal oferece Dinheiro, Cartão de Crédito, Cartão de
  Débito e Pix.
- [ ] **AC-FE-03** — Confirmar envia `paymentMethod` para
  `POST /orders/:id/close`.
- [ ] **AC-FE-04** — Em sucesso, a tela informa o fechamento e volta para
  `mesas.html`; a mesa continua ocupada.
- [ ] **AC-FE-05** — Em erro, a mensagem do backend é exibida e o modal
  permanece aberto.
- [ ] **AC-FE-06** — A página de resumo carrega `GET /reports/summary` e exibe
  total, ticket médio, comandas e itens mais vendidos.
- [ ] **AC-FE-07** — A página de resumo trata carregamento, erro de rede e
  ausência de vendas.

### 11.6 Relatórios — regras compartilhadas

- [ ] **AC-REP-01** — As rotas de relatório são somente leitura e não alteram
  dados.
- [ ] **AC-REP-02** — As duas rotas usam o mesmo fuso e o mesmo universo de
  comandas pagas.
- [ ] **AC-REP-03** — As respostas não expõem SQL, stack trace ou caminhos
  internos.
- [ ] **AC-REP-04** — Os índices definidos na seção 9 existem no schema.

## 12. Divergências da implementação atual

> **Levantamento de 2026-11-07** sobre a árvore de trabalho (código do Bloco 2
> ainda não commitado). O documento prevalece como requisito. Onde a
> divergência era apenas de nomenclatura ou compatibilidade, o próprio
> documento foi ajustado: a tabela chama-se `payments` e o fechamento sem
> corpo continua aceito como caminho legado.

| # | Ponto | Documento (requisito) | Implementação atual | Ação |
| --- | --- | --- | --- | --- |
| 1 | Formas de pagamento | `cash`, `credit_card`, `debit_card`, `pix` | `dinheiro`, `cartao`, `pix` no `CHECK` de `payments.method` e em `PAYMENT_METHODS` | **Backend:** trocar o enum. Como o bloco não foi commitado, alterar o `CHECK` antes do merge; em banco já criado, recriar a tabela ou aceitar os dois conjuntos na transição. |
| 2 | Frontend × backend | Quatro opções alinhadas ao enum | Modal envia `cash`, `card`, `pix`; backend aceita `dinheiro`, `cartao`, `pix` | **Frontend:** alinhar os valores. Hoje **Dinheiro e Cartão retornam `400`**; apenas Pix fecha. |
| 3 | `GET /reports/summary` | Total do dia, ticket médio, `itemsSold` e `topItems`, com `date` e `limit` | Histórico completo, sem `topItems`, sem `date`/`limit` | **Backend:** implementar o contrato da seção 8. |
| 4 | Fuso dos relatórios | `America/Sao_Paulo` | `date(created_at)` do SQLite, ou seja, dia UTC | **Backend:** converter o intervalo local para UTC antes da consulta. |
| 5 | Representação da comanda | `payments` (lista) em `GET /orders/:id` e no close, com `methodLabel` | `payment` singular, só na resposta do close; `GET /orders/:id` não traz pagamento | **Backend:** montar `payments` em `toOrderView` e incluir `methodLabel`. |
| 6 | `GET /reports/sales` | `ordersCount`, `byMethod[].label` e `byMethod[].ordersCount`; quatro formas sempre presentes | `paidOrders`, `byMethod[].payments`, sem `label`, apenas métodos com pagamento | **Backend:** ajustar os nomes e completar as quatro formas com zero. `unpaidClosedOrders` pode permanecer como campo extra informativo. |
| 7 | Comandas fechadas sem pagamento | Fora dos relatórios | Contadas em `unpaidClosedOrders` | **Baixa:** manter o campo se for útil para o caixa; não somar ao faturamento. |
| 8 | Nome da tabela | `payments` (era `order_payments`) | `payments` + `uq_payments_order` | **Resolvido no documento:** requisito ajustado ao nome implementado. |
| 9 | Obrigatoriedade do close | Corpo opcional; `paymentMethod` obrigatório quando presente | Corpo opcional (fluxo legado) | **Resolvido no documento:** legado aceito, mas a interface sempre envia a forma. |

**Ordem sugerida de correção**

1. Itens 1 e 2 — corrigir o enum no backend e no frontend; sem isso o fluxo
   principal de pagamento não funciona.
2. Itens 3 e 4 — implementar o `summary` diário e o fuso local.
3. Itens 5 e 6 — alinhar o contrato das respostas.
4. Item 7 — decidir se `unpaidClosedOrders` fica.

**Testes a atualizar**

- `backend/tests/orders.test.js` usa `cartao` e espera `payment` singular;
  precisa usar `credit_card`/`debit_card` e `payments`.
- `frontend/relatorios.js` já tolera vários nomes de campo, mas depende de
  `topItems`, que o `summary` atual não devolve.
- O teste do fluxo legado sem corpo continua válido.

## 13. Riscos e decisões pendentes

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Enum de pagamento divergente entre frontend e backend | Formas escolhidas retornam `400` | Corrigir os dois lados antes do merge (seção 12). |
| Comandas antigas sem pagamento | Ficam fora dos relatórios | Documentado; backfill manual se necessário. |
| Registro manual de cartão/Pix | Divergência entre sistema e adquirente | Deixar claro que não há conciliação; futuro bloco de integração. |
| Fuso horário | Vendas perto da meia-noite caem no dia errado | Fuso fixo `America/Sao_Paulo`, timestamps UTC e campo `timezone`. |
| Ticket médio arredondado | Pequena diferença de centavos | Regra explícita de metade para cima. |
| Produto renomeado | Relatório histórico mostra nome atual | Documentado; snapshot de nome fica para o futuro. |
| Sem split payment | Cliente não consegue pagar parte em dinheiro e parte em cartão | Fora do escopo do Bloco 2; o índice único `uq_payments_order` precisa ser removido quando o split entrar. |
| Sem estorno/cancelamento | Pagamento errado não pode ser desfeito pela API | Fora do escopo; registrar como limitação. |
| Sem fechamento de turno | Não há conferência de gaveta | Bloco futuro de caixa. |
| Sem autenticação | Qualquer cliente acessa relatórios | Padrão atual do projeto; permissões em bloco futuro. |

Decisões pendentes para o fundador ou Tech Lead:

- Confirmar se o Bloco 2 aceita **uma** forma de pagamento por comanda ou se
  split payment entra agora.
- Confirmar o fuso fixo `America/Sao_Paulo` ou se o estabelecimento precisa
  configurar outro fuso.
- Confirmar se comandas antigas sem pagamento devem ser ignoradas ou
  classificadas manualmente.
- Confirmar se o valor de pagamento deve ser sempre o total da comanda ou se o
  operador poderá ajustar o valor em um bloco futuro.
- Confirmar se a tela de vendas por período/forma de pagamento entra neste
  bloco ou no próximo.
- Confirmar se o ticket médio deve considerar apenas comandas pagas ou todas as
  comandas fechadas.

## 14. Definição de pronto

O Bloco 2 é considerado concluído quando:

- `POST /orders/:id/close` aceita `paymentMethod` e registra o pagamento.
- `orders.closed_at` e `payments` fazem parte do schema e dos testes.
- As divergências da seção 12 estão corrigidas.
- `GET /reports/sales` e `GET /reports/summary` estão implementadas e
  documentadas.
- O modal de pagamento da comanda oferece as quatro formas e fecha a comanda.
- A página de resumo consome `GET /reports/summary`.
- Todos os critérios de aceite estão verificados pelo QA.
- Os testes automatizados passam na íntegra.
- A documentação está publicada em `docs/`.
- Nenhuma dependência paga foi adicionada.
- O Product Manager validou o escopo e o Tech Lead aprovou a revisão técnica.
