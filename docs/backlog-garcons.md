# Backlog — Gestão de Garçons (Bloco 3)

| Campo | Valor |
| --- | --- |
| Produto | Sistema de gestão não fiscal para restaurantes, pizzarias e lanchonetes |
| Módulo | Funcionários, atribuição de mesas e comissão |
| Bloco | 3 |
| Responsável | Product Manager |
| Status | Aprovado; implementação em andamento (ver seção 11) |
| Versão | 1.0 |
| Data | 2026-11-09 |

## 1. Contexto e objetivo

Os blocos anteriores fecharam o ciclo operacional da mesa (cardápio, mesas,
comanda, itens, fechamento e pagamento) e os relatórios de caixa. O sistema
ainda não sabe **quem** atende cada mesa: todas as comandas são anônimas e não
há como apurar a participação de cada garçom nas vendas.

**Objetivo do Bloco 3:** cadastrar garçons, atribuir mesas a eles e preservar
a responsabilidade de cada comanda, mesmo quando a mesa é transferida.

**Resultado esperado:**

- O gerente cadastra garçons com nome e percentual de comissão.
- Cada mesa pode ter um garçom responsável; um garçom pode atender várias
  mesas.
- Ao abrir a comanda, o garçom responsável pela mesa é gravado na comanda.
- No fechamento com pagamento, a comissão é calculada e congelada.
- O garçom consulta apenas as mesas atribuídas a ele.

**Limite de escopo:** este bloco entrega o cadastro, a atribuição e o snapshot
de comissão. Relatório de comissão por período, login real e fechamento de
turno ficam para blocos futuros.

## 2. Escopo

### 2.1 Dentro do escopo

- Tabela `employees` (`id`, `name`, `commission_bps`, `active`).
- Relação `tables.employee_id` — no máximo um garçom por mesa.
- Snapshot de `orders.employee_id` na abertura da comanda.
- Snapshot de comissão no pagamento (`payments.employee_id`,
  `commission_bps`, `commission_amount`).
- `POST /employees` — cadastrar garçom.
- `GET /employees` — listar garçons.
- `PUT /employees/:id` — editar nome, comissão e situação.
- `PUT /tables/:id/employee` — atribuir, trocar ou remover o garçom da mesa.
- `GET /employees/:id/tables` — listar as mesas de um garçom.
- Extensão de `GET /tables`, `GET /orders/:id`, `POST /orders` e do fechamento
  com os campos de garçom e comissão.
- Tela de gestão de garçons (`frontend/funcionarios.html`).
- Atribuição de garçom na tela de mesas (`frontend/mesas.html`).
- Painel do garçom (`frontend/meu-painel.html`).
- Testes automatizados e documentação.

### 2.2 Fora do escopo

- Login, senha, sessão e permissões por perfil.
- Aplicativo móvel ou notificação para o garçom.
- Relatório de comissão por período, turno ou forma de pagamento.
- Fechamento de turno, caixa por operador e conferência de gaveta.
- Divisão de mesa entre dois garçons (ajudante) ou comissão compartilhada.
- Comissão sobre gorjeta, taxa de serviço, desconto ou cortesia.
- Estorno de pagamento e recálculo de comissão.
- Metas, ranking ou gamificação.
- Exclusão física de funcionário (só desativação).
- Controle de ponto, escala ou jornada.
- Qualquer funcionalidade fiscal.

## 3. Estado de partida

- Tabelas existentes: `categories`, `products`, `tables`, `orders`,
  `order_items` e `payments`.
- `tables` tem `id`, `number`, `status` (`free`, `occupied`, `closed`).
- `orders` tem `id`, `table_id`, `status`, `closed_at` e `created_at`.
- `payments` tem `order_id`, `method`, `amount` e `created_at`.
- Nenhuma noção de funcionário ou responsável pela mesa.
- `GET /tables` devolve `id`, `number` e `status`.
- `POST /orders` copia o preço do produto, mas não registra quem abriu.
- O fechamento com pagamento grava o valor, mas não calcula comissão.
- O frontend já tem as páginas de funcionários e painel do garçom em
  andamento; a implementação atual está descrita na seção 11.

## 4. Modelo de dados

### 4.1 Tabela `employees`

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `id` | Inteiro | Sim (gerado) | Chave primária, imutável. |
| `name` | Texto | Sim | `trim` entre 2 e 80 caracteres; único sem diferenciar maiúsculas. |
| `commission_bps` | Inteiro | Sim | Comissão em pontos-base: `1000` = 10%, `10000` = 100%; faixa 0–10000. Padrão 0. |
| `active` | Inteiro | Sim | `1` ativo, `0` inativo. Padrão 1. |
| `created_at` | Texto | Sim (gerado) | ISO 8601 UTC. |

Regras:

- `name` é único com `COLLATE NOCASE`: “Ana” e “ana” são o mesmo garçom.
- A comissão é sempre inteira em pontos-base; **nunca** usar ponto flutuante
  no banco.
- `active = 0` desliga o garçom sem apagar o histórico.
- Não há exclusão física nesta fase.

### 4.2 Relação com `tables`

| Campo | Tipo | Regra |
| --- | --- | --- |
| `employee_id` | Inteiro anulável | Referência a `employees.id`; `NULL` = mesa sem garçom. |

- Uma mesa tem no máximo um garçom: a relação é uma coluna única, não uma
  tabela de vínculos.
- Um garçom pode ter várias mesas: não existe índice único em `employee_id`.
- `ON DELETE SET NULL`: se um funcionário fosse apagado, a mesa ficaria sem
  responsável. Como não há `DELETE`, isso é apenas uma proteção.
- A atribuição é operacional e sobrevive ao ciclo
  `free → occupied → closed → free`.

### 4.3 Snapshot em `orders`

| Campo | Tipo | Regra |
| --- | --- | --- |
| `employee_id` | Inteiro anulável | Garçom responsável no instante da abertura; `NULL` se a mesa não tinha garçom. |

- É copiado de `tables.employee_id` **dentro da transação** de `POST /orders`.
- Trocar o garçom da mesa depois não altera comandas já abertas.
- O campo é a fonte de verdade para saber quem atendeu a comanda.

### 4.4 Snapshot de comissão em `payments`

| Campo | Tipo | Regra |
| --- | --- | --- |
| `employee_id` | Inteiro anulável | Garçom da comanda no fechamento. |
| `commission_bps` | Inteiro anulável | Taxa vigente no fechamento. |
| `commission_amount` | Inteiro anulável | Comissão em centavos, calculada no fechamento. |

- Preenchidos apenas no fechamento **com pagamento**.
- Sem garçom na comanda, os três campos ficam `NULL`.
- Fechamento legado sem pagamento não cria linha em `payments` e, portanto,
  não congela comissão.
- Mudanças posteriores no cadastro do garçom não reescrevem o passado.

### 4.5 Invariantes

1. `employees.name` é único sem diferenciar maiúsculas.
2. `employees.commission_bps` está entre 0 e 10000.
3. `tables.employee_id` aponta para um funcionário existente ou é `NULL`.
4. `orders.employee_id` é imutável depois da abertura.
5. `payments.commission_amount` é sempre `round(amount * commission_bps /
   10000)`, em centavos.
6. `commission_bps` e `commission_amount` são nulos juntos; nunca um sem o
   outro.
7. Nenhum valor monetário ou de comissão usa ponto flutuante.

### 4.6 Migração do schema inline

- As tabelas e colunas usam `CREATE TABLE/INDEX IF NOT EXISTS`.
- Em banco existente, `employee_id` é adicionado a `tables`, `orders` e
  `payments` com `ALTER TABLE`, protegido por `PRAGMA table_info`.
- O schema continua inline em `backend/src/database.js`, sem arquivos `.sql`
  ou tabela de migrações.
- Nenhum dado existente é apagado; mesas e comandas antigas ficam com
  `employee_id = NULL`.

## 5. Contrato da API

Convenções:

- Campos em `camelCase` na API; colunas em `snake_case` no banco.
- Erros usam `{ "error": "mensagem em português" }`, sem SQL ou stack trace.
- `active` é booleano na API e `0/1` no banco.
- `commissionBps` é inteiro; a interface converte para percentual.

### 5.1 `POST /employees`

Cadastra um garçom.

**Corpo**

```json
{ "name": "Ana", "commissionBps": 1000 }
```

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `name` | Texto | Sim | `trim` entre 2 e 80 caracteres. |
| `commissionBps` | Inteiro | Não | 0–10000; padrão 0. |
| `active` | Booleano | Não | Padrão `true`. |

**Sucesso — `201`**

```json
{
  "id": 1,
  "name": "Ana",
  "commissionBps": 1000,
  "active": true,
  "createdAt": "2026-11-09T13:20:00.000Z"
}
```

**Erros**

| Código | Situação |
| --- | --- |
| 400 | `name` ausente, não textual ou fora de 2–80; `commissionBps` não inteiro ou fora de 0–10000; `active` não booleano. |
| 409 | Já existe funcionário com o mesmo nome (sem diferenciar maiúsculas). |
| 500 | Erro interno inesperado. |

### 5.2 `GET /employees`

Lista todos os garçons, ativos e inativos, ordenados por nome e depois por
`id`.

**Sucesso — `200`**

```json
[
  { "id": 1, "name": "Ana", "commissionBps": 1000, "active": true,  "createdAt": "..." },
  { "id": 2, "name": "Bruno", "commissionBps": 800, "active": false, "createdAt": "..." }
]
```

- A rota devolve **array**, seguindo o padrão de `GET /tables`.
- Não há filtro por situação nesta fase; a interface pode filtrar no cliente.
- A contagem de mesas não vem nesta rota; usar `GET /tables` ou
  `GET /employees/:id/tables`.

### 5.3 `PUT /employees/:id`

Atualiza parcialmente nome, comissão e situação. Pelo menos um campo deve ser
enviado.

**Corpo (exemplos)**

```json
{ "name": "Ana Souza" }
{ "commissionBps": 1200 }
{ "active": false }
```

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `name` | Texto | Não | Mesma validação da criação. |
| `commissionBps` | Inteiro | Não | 0–10000. |
| `active` | Booleano | Não | `false` desativa sem apagar. |

**Sucesso — `200`** com o funcionário atualizado no formato de `GET
/employees`.

**Erros**

| Código | Situação |
| --- | --- |
| 400 | `id` inválido; nenhum dos três campos enviado; campo com tipo/faixa inválida. |
| 404 | Funcionário inexistente. |
| 409 | Novo nome já pertence a outro funcionário. |
| 500 | Erro interno inesperado. |

**Desativação**

- `active: false` mantém as mesas atribuídas e o histórico de comissão.
- O garçom inativo deixa de poder receber **novas** atribuições.
- Mesas que já estavam com ele continuam apontando para ele até serem
  transferidas ou removidas manualmente.
- A interface deve oferecer “Desativar”, não “Excluir”. Não existe
  `DELETE /employees/:id` neste bloco.

### 5.4 `PUT /tables/:id/employee`

Atribui, troca ou remove o garçom responsável por uma mesa.

**Corpo**

```json
{ "employeeId": 7 }
```

```json
{ "employeeId": null }
```

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `employeeId` | Inteiro ou `null` | Sim | Inteiro positivo para atribuir; `null` para remover. |

**Sucesso — `200`**

```json
{
  "id": 2,
  "number": 2,
  "status": "occupied",
  "employeeId": 7,
  "employeeName": "Ana"
}
```

**Erros**

| Código | Situação |
| --- | --- |
| 400 | `id` da mesa inválido; `employeeId` ausente; `employeeId` não é inteiro positivo nem `null`; funcionário existe mas está inativo. |
| 404 | Mesa inexistente; funcionário inexistente. |
| 500 | Erro interno inesperado. |

**Regras**

1. A atribuição é permitida em qualquer status da mesa (`free`, `occupied` ou
   `closed`) e **não** altera o status.
2. Enviar o mesmo `employeeId` já atribuído é idempotente: retorna `200`.
3. `employeeId: null` remove a atribuição, inclusive de mesa ocupada.
4. Trocar o garçom de uma mesa ocupada **não** altera a comanda aberta; a
   próxima comanda aberta usará o novo garçom.
5. Não há limite de mesas por garçom.
6. Funcionário inativo não pode ser atribuído; para usar um garçom inativo,
   reative-o antes com `PUT /employees/:id`.

### 5.5 `GET /employees/:id/tables`

Lista as mesas atribuídas a um garçom, ordenadas por número.

**Sucesso — `200`**

```json
[
  { "id": 2, "number": 2, "status": "occupied", "employeeId": 7 },
  { "id": 5, "number": 5, "status": "free",     "employeeId": 7 }
]
```

- Garçom sem mesas retorna `200` com `[]`.
- Funcionário inativo também pode ser consultado: o histórico continua
  acessível.

**Erros**

| Código | Situação |
| --- | --- |
| 400 | `id` não inteiro ou menor que 1. |
| 404 | Funcionário inexistente. |
| 500 | Erro interno inesperado. |

> **Status:** rota ainda não implementada na árvore de trabalho (seção 11).
> Até lá, o painel do garçom filtra `GET /tables` no cliente.

### 5.6 Extensões em rotas existentes

**`GET /tables`** passa a devolver, para cada mesa:

```json
{
  "id": 2,
  "number": 2,
  "status": "free",
  "employeeId": null,
  "employeeName": null
}
```

**`POST /orders`** copia `tables.employee_id` para `orders.employee_id` dentro
da transação e devolve `employeeId` e `employeeName` na comanda.

**`GET /orders/:id`** devolve os mesmos campos, inclusive em comanda fechada.

**`POST /orders/:id/close`** com pagamento grava, na linha de `payments`:

```json
{
  "employeeId": 7,
  "employeeName": "Ana",
  "commissionBps": 1000,
  "commissionAmount": 900,
  "commissionAmountFormatted": "R$ 9,00"
}
```

- Sem garçom na comanda, os quatro campos de comissão são `null`.
- O fechamento legado sem pagamento não cria esses campos.

## 6. Regras de negócio

### 6.1 Atribuição de mesas

1. Cada mesa tem no máximo um garçom responsável.
2. Um garçom pode acumular quantas mesas forem necessárias.
3. Atribuir uma mesa a outro garçom substitui o responsável anterior; não há
   histórico de vínculo nesta fase.
4. Remover o garçom (`employeeId: null`) deixa a mesa sem responsável.
5. A atribuição vale para o próximo atendimento; comandas já abertas mantêm o
   garçom do momento da abertura.
6. Mesa fechada para limpeza também pode ter responsável.
7. Funcionário inativo não recebe novas mesas.

### 6.2 Interação com o ciclo da mesa

| Operação | Efeito em `tables.employee_id` | Efeito em `orders.employee_id` |
| --- | --- | --- |
| Atribuir garçom | Atualiza | Não altera comandas existentes |
| Trocar garçom | Atualiza | Não altera comandas existentes |
| Remover garçom | Vira `NULL` | Não altera comandas existentes |
| Abrir comanda | Não altera | Copia o garçom atual da mesa |
| Fechar comanda | Não altera | Mantém o snapshot |
| Fechar/liberar mesa | Não altera | Mantém o snapshot |

### 6.3 Funcionário inativo

- Não pode ser atribuído a novas mesas.
- Continua aparecendo em `GET /employees` com `active: false`.
- Mantém as mesas que já tinha e o histórico de comissão.
- Pode ser reativado com `PUT /employees/:id` e `{ "active": true }`.
- Se uma comanda for aberta em uma mesa que ainda aponta para um garçom
  inativo, o snapshot usa esse garçom. A interface deve sinalizar a situação
  para o gerente corrigir a atribuição.

### 6.4 Concorrência

- A abertura da comanda relê a mesa dentro de `BEGIN IMMEDIATE` e copia o
  garçom no mesmo instante; uma troca concorrente não gera comanda com garçom
  “meio atribuído”.
- A atribuição de mesa é um `UPDATE` simples e atômico.
- O fechamento calcula a comissão dentro da mesma transação do pagamento.

## 7. Comissão

### 7.1 Taxa

- Armazenada em `employees.commission_bps`, inteiro de 0 a 10000.
- `1000` = 10%; `850` = 8,5%; `10000` = 100%.
- A interface exibe percentual, mas envia e recebe pontos-base.
- A taxa pode ser alterada a qualquer momento; o efeito é apenas prospectivo.

### 7.2 Momento do congelamento

| Informação | Quando é congelada | Onde |
| --- | --- | --- |
| Garçom responsável pela comanda | Abertura | `orders.employee_id` |
| Garçom da comissão | Fechamento com pagamento | `payments.employee_id` |
| Taxa aplicada | Fechamento com pagamento | `payments.commission_bps` |
| Valor da comissão | Fechamento com pagamento | `payments.commission_amount` |

Justificativa: a responsabilidade é definida quando o atendimento começa; a
comissão é apurada quando a receita é realizada. Assim, trocar o garçom da
mesa não reescreve comandas antigas e mudar a taxa não reescreve comissões já
pagas.

### 7.3 Cálculo

```text
commission_amount = round(order_total * commission_bps / 10000)
```

- `order_total` é a soma de `quantity * unit_price` dos itens, em centavos.
- `round` é o arredondamento para o inteiro mais próximo, com metade para
  cima (comportamento de `Math.round` para valores positivos).
- O resultado é sempre inteiro em centavos.
- Sem garçom, `commission_bps` e `commission_amount` são `NULL`.

**Exemplos**

| Total | BPS | Conta | Comissão |
| --- | --- | --- | --- |
| R$ 90,00 (9000) | 1000 (10%) | 9000 × 1000 ÷ 10000 = 900 | R$ 9,00 |
| R$ 45,55 (4555) | 850 (8,5%) | 4555 × 850 ÷ 10000 = 387,175 | R$ 3,87 |
| R$ 45,50 (4550) | 850 (8,5%) | 4550 × 850 ÷ 10000 = 386,75 | R$ 3,87 |
| R$ 10,00 (1000) | 0 | 0 | R$ 0,00 |

### 7.4 Universo de comissão

- Entram: comandas fechadas **com pagamento registrado**.
- Não entram: comandas abertas, comandas fechadas pelo fluxo legado sem
  pagamento e comandas sem garçom.
- A comissão fica gravada no pagamento; não há recálculo retroativo.
- O relatório agregado de comissão por garçom/período fica para o próximo
  bloco.

### 7.5 Histórico

- Renomear o garçom não altera o `employee_id` gravado; consultas exibem o
  nome atual do cadastro.
- Desativar o garçom não apaga pagamentos, comandas ou comissões.
- Como não há `DELETE`, o histórico não perde a referência.

## 8. Integração com o frontend

### 8.1 Tela de gestão — `frontend/funcionarios.html`

- Formulário com nome e comissão em percentual.
- A interface converte `%` para pontos-base antes de enviar
  (`10` → `1000`) e converte de volta para exibir.
- Lista com nome, comissão, mesas atribuídas e ações.
- Ação “Editar” deve abrir um formulário, não usar `prompt`.
- Ação “Desativar” usa `PUT /employees/:id` com `{ "active": false }`.
- Não deve existir ação “Excluir” enquanto não houver `DELETE` no contrato.
- Estados de carregamento, lista vazia e erro de rede precisam de mensagem.

### 8.2 Atribuição na tela de mesas — `frontend/mesas.html`

- Cada card de mesa tem um select “Garçom”.
- O select lista os garçons ativos; a opção vazia remove a atribuição.
- Ao mudar, envia `PUT /tables/:id/employee` com `{ "employeeId": <id> }` ou
  `{ "employeeId": null }`.
- Em sucesso, recarrega as mesas e mantém o status.
- Em erro, exibe a mensagem do backend e restaura a seleção anterior.
- A mesa mostra o nome do garçom atual, quando houver.

### 8.3 Painel do garçom — `frontend/meu-painel.html`

- Um select no topo simula o “garçom logado” (não há autenticação).
- O painel lista apenas as mesas do garçom selecionado.
- Fonte preferencial: `GET /employees/:id/tables`.
- Alternativa temporária: filtrar `GET /tables` por `employeeId` no cliente.
- Cada mesa mostra número e status com as cores já usadas no salão.
- Mesa ocupada indica “Em atendimento”; fechada indica limpeza/manutenção.
- Sem mesas, exibe “Nenhuma mesa atribuída a este garçom”.
- Erro de rede exibe mensagem e permite tentar de novo.

## 9. Wireframes textuais

### 9.1 Tela de gestão de garçons

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Voltar para a página inicial                                           │
│ Funcionários                                                             │
│ Gestão de garçons, comissões e mesas atribuídas                          │
├──────────────────────────────────────────────────────────────────────────┤
│ Adicionar Garçom                                                         │
│                                                                          │
│ Nome: [ Ana____________________ ]   Comissão (%): [ 10,00 ]              │
│                                                                          │
│                                        [ Cadastrar Garçom ]              │
├──────────────────────────────────────────────────────────────────────────┤
│ Funcionários                                                             │
│                                                                          │
│ ┌──────────────┬────────────┬──────────────────┬──────────┬───────────┐ │
│ │ Nome         │ Comissão   │ Mesas atribuídas │ Situação │ Ações     │ │
│ ├──────────────┼────────────┼──────────────────┼──────────┼───────────┤ │
│ │ Ana          │ 10,00%     │ 2, 3, 5          │ Ativo    │ [Editar]  │ │
│ │ Bruno        │ 8,00%      │ —                │ Inativo  │ [Editar]  │ │
│ └──────────────┴────────────┴──────────────────┴──────────┴───────────┘ │
│                                                                          │
│ Nenhum funcionário cadastrado → mensagem de estado vazio                 │
└──────────────────────────────────────────────────────────────────────────┘
```

**Blocos**

1. **Cabeçalho** — título, subtítulo e link de volta.
2. **Formulário de cadastro** — nome e comissão em percentual; botão
   “Cadastrar Garçom”.
3. **Tabela** — nome, comissão, mesas atribuídas, situação e ações.
4. **Ações por linha** — “Editar” (nome/comissão) e “Desativar/Reativar”.
5. **Estados** — carregando, lista vazia, erro de rede e erro de validação.

**Regras de interface**

- A comissão aceita decimais com até duas casas (`8,50`), mas é enviada como
  inteiro em pontos-base.
- O nome é obrigatório e não pode duplicar outro garçom.
- Desativar pede confirmação e explica que o histórico é preservado.
- A coluna “Mesas atribuídas” usa `GET /tables` (filtrando por `employeeId`)
  ou `GET /employees/:id/tables`; nunca inventa dados locais.

### 9.2 Atribuição de garçom na tela de mesas

```text
┌──────────────────────────────┐   ┌──────────────────────────────┐
│ Mesa 2                       │   │ Mesa 3                       │
│ [ Ocupada ]                  │   │ [ Livre ]                    │
│                              │   │                              │
│ Garçom: [ Ana          ▾ ]   │   │ Garçom: [ Selecione    ▾ ]   │
│                              │   │                              │
│ Total: R$ 90,00              │   │ Abrir comanda                │
└──────────────────────────────┘   └──────────────────────────────┘

Select aberto:
┌──────────────────────────────┐
│ ( ) Selecione um garçom      │  ← remove a atribuição
│ (•) Ana                      │
│ ( ) Bruno                    │
└──────────────────────────────┘
```

**Interações**

- Trocar o select envia a atribuição imediatamente.
- A opção vazia remove o garçom da mesa.
- O status da mesa não muda ao atribuir ou remover.
- Se o backend recusar (garçom inativo, mesa inexistente), a interface mostra
  o erro e volta à seleção anterior.
- A lista de garçons é carregada de `GET /employees`; inativos não aparecem
  para novas atribuições.

### 9.3 Painel do garçom

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Voltar para a página inicial                                           │
│ Meu Painel                                                               │
│ Mesas atribuídas ao garçom logado                                        │
├──────────────────────────────────────────────────────────────────────────┤
│ Garçom: [ Ana ▾ ]   (simula o login)                                     │
│                                                                          │
│ Minhas Mesas                                                             │
│                                                                          │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐                │
│ │ Mesa 2         │ │ Mesa 3         │ │ Mesa 5         │                │
│ │ [ Ocupada ]    │ │ [ Livre ]      │ │ [ Fechada ]    │                │
│ │ Em atendimento │ │ Disponível     │ │ Limpeza        │                │
│ └────────────────┘ └────────────────┘ └────────────────┘                │
│                                                                          │
│ Nenhuma mesa atribuída a este garçom → mensagem                          │
│ Erro ao carregar mesas → mensagem + tentar novamente                     │
└──────────────────────────────────────────────────────────────────────────┘
```

**Blocos**

1. **Cabeçalho** — título e link de volta.
2. **Seletor de garçom** — simula o login; em produção seria substituído por
   autenticação.
3. **Grade de mesas** — número, status e descrição curta.
4. **Estados** — sem garçom selecionado, garçom sem mesas, carregando e erro.

**Fora do painel nesta fase**

- Abrir comanda, adicionar itens e fechar comanda continuam nas telas
  existentes.
- Vendas do turno, comissão estimada e ranking não são exibidos porque não há
  rota de agregação neste bloco.

### 9.4 Acessibilidade e responsividade

- Rótulos explícitos em todos os campos e selects.
- Foco visível e navegação por teclado.
- Mensagens de erro associadas ao campo ou à região (`aria-live`).
- Em telas estreitas, a tabela de funcionários vira lista de cartões.
- Contraste suficiente para os badges de status.

## 10. Critérios de aceite

### 10.1 Gerais

- [ ] **AC-GER-01** — As rotas respondem em JSON e usam `201` na criação e
  `200` nas demais operações de sucesso.
- [ ] **AC-GER-02** — Erros tratados retornam `{ "error": "..." }`, sem SQL,
  stack trace ou caminhos internos.
- [ ] **AC-GER-03** — Comissão e valores monetários são inteiros (bps e
  centavos), sem ponto flutuante no banco.
- [ ] **AC-GER-04** — Nenhuma dependência paga, serviço externo ou
  funcionalidade fiscal é adicionada.
- [ ] **AC-GER-05** — O bloco tem documentação e testes automatizados
  aprovados.

### 10.2 Funcionários

- [ ] **AC-EMP-01** — `POST /employees` com nome válido retorna `201`,
  persiste o funcionário e devolve `id`, `name`, `commissionBps`, `active` e
  `createdAt`.
- [ ] **AC-EMP-02** — Sem `commissionBps`, a comissão é `0`; sem `active`, o
  funcionário nasce ativo.
- [ ] **AC-EMP-03** — `name` sofre `trim`; menos de 2 ou mais de 80
  caracteres retorna `400`.
- [ ] **AC-EMP-04** — `commissionBps` não inteiro, negativo ou maior que
  10000 retorna `400`.
- [ ] **AC-EMP-05** — Nome duplicado, inclusive com diferença de maiúsculas,
  retorna `409` e não cria registro.
- [ ] **AC-EMP-06** — `GET /employees` retorna array ordenado por nome,
  incluindo ativos e inativos.
- [ ] **AC-EMP-07** — `PUT /employees/:id` atualiza apenas os campos
  enviados e retorna o funcionário atualizado.
- [ ] **AC-EMP-08** — `PUT /employees/:id` sem nenhum campo reconhecido
  retorna `400`.
- [ ] **AC-EMP-09** — `PUT /employees/:id` em funcionário inexistente retorna
  `404`; `id` inválido retorna `400`.
- [ ] **AC-EMP-10** — `PUT /employees/:id` com nome de outro funcionário
  retorna `409`.
- [ ] **AC-EMP-11** — Desativar com `{ "active": false }` retorna `200`,
  mantém mesas e histórico e impede novas atribuições.
- [ ] **AC-EMP-12** — Reativar com `{ "active": true }` volta a permitir
  atribuições.
- [ ] **AC-EMP-13** — Não existe rota `DELETE /employees/:id`; exclusão
  física não é possível pela API.
- [ ] **AC-EMP-14** — Os dados persistem após reinício do servidor.

### 10.3 Atribuição de mesas

- [ ] **AC-ASG-01** — `PUT /tables/:id/employee` com funcionário ativo
  retorna `200` e grava `tables.employee_id`.
- [ ] **AC-ASG-02** — A resposta inclui `employeeId` e `employeeName`.
- [ ] **AC-ASG-03** — Mesa inexistente retorna `404`.
- [ ] **AC-ASG-04** — Funcionário inexistente retorna `404`.
- [ ] **AC-ASG-05** — Funcionário inativo retorna `400` e a mesa permanece
  inalterada.
- [ ] **AC-ASG-06** — `{ "employeeId": null }` remove a atribuição e retorna
  `200`.
- [ ] **AC-ASG-07** — Corpo sem `employeeId` ou com tipo inválido retorna
  `400`.
- [ ] **AC-ASG-08** — Atribuir o mesmo funcionário novamente é idempotente e
  retorna `200`.
- [ ] **AC-ASG-09** — A atribuição funciona em mesa `free`, `occupied` e
  `closed`, sem alterar o status.
- [ ] **AC-ASG-10** — Um garçom pode ter várias mesas simultaneamente.
- [ ] **AC-ASG-11** — Cada mesa tem no máximo um garçom; nova atribuição
  substitui a anterior.
- [ ] **AC-ASG-12** — `GET /tables` devolve `employeeId` e `employeeName`
  atualizados.
- [ ] **AC-ASG-13** — `GET /employees/:id/tables` devolve apenas as mesas do
  garçom, ordenadas por número.
- [ ] **AC-ASG-14** — `GET /employees/:id/tables` de garçom sem mesas
  retorna `200` com `[]`; de garçom inexistente retorna `404`.
- [ ] **AC-ASG-15** — Trocar o garçom de uma mesa ocupada não altera a
  comanda já aberta.

### 10.4 Comissão e histórico

- [ ] **AC-COM-01** — `POST /orders` copia `tables.employee_id` para
  `orders.employee_id` na abertura.
- [ ] **AC-COM-02** — Mesa sem garçom gera comanda com `employeeId = null`.
- [ ] **AC-COM-03** — A resposta da comanda inclui `employeeId` e
  `employeeName`.
- [ ] **AC-COM-04** — Trocar o garçom depois da abertura não altera
  `orders.employee_id` nem comissões já gravadas.
- [ ] **AC-COM-05** — O fechamento com pagamento grava `employee_id`,
  `commission_bps` e `commission_amount` no pagamento.
- [ ] **AC-COM-06** — `commission_amount` é `round(total * bps / 10000)`, em
  centavos, com metade para cima.
- [ ] **AC-COM-07** — Comanda sem garçom grava os três campos de comissão
  como `null`.
- [ ] **AC-COM-08** — Mudar a taxa do garçom depois do fechamento não altera
  pagamentos antigos.
- [ ] **AC-COM-09** — Fechamento legado sem pagamento não cria comissão.
- [ ] **AC-COM-10** — Desativar o garçom não apaga comissões nem comandas.
- [ ] **AC-COM-11** — A resposta do pagamento inclui `commissionBps`,
  `commissionAmount` e `commissionAmountFormatted`.

### 10.5 Frontend

- [ ] **AC-FE-01** — A tela de funcionários cadastra um garçom e atualiza a
  lista.
- [ ] **AC-FE-02** — A comissão é exibida em percentual e enviada em
  pontos-base.
- [ ] **AC-FE-03** — Editar altera nome e/ou comissão sem recarregar a
  página.
- [ ] **AC-FE-04** — Desativar usa `PUT` e não `DELETE`; a lista mostra a
  situação.
- [ ] **AC-FE-05** — A tela de mesas permite atribuir, trocar e remover o
  garçom de uma mesa.
- [ ] **AC-FE-06** — O painel do garçom mostra apenas as mesas do garçom
  selecionado.
- [ ] **AC-FE-07** — Lista vazia, carregamento e erro de rede têm mensagem
  explícita.
- [ ] **AC-FE-08** — Campos e selects têm rótulos e são navegáveis por
  teclado.

## 11. Divergências da implementação atual

> **Levantamento de 2026-11-09** sobre a árvore de trabalho (Bloco 3 ainda não
> commitado). O documento prevalece como requisito.

### 11.1 Já implementado

- Tabela `employees` no schema inline, com as restrições da seção 4.1.
- `tables.employee_id`, `orders.employee_id` e as três colunas de comissão em
  `payments`, com migração leve.
- `POST /employees`, `GET /employees` e `PUT /employees/:id`.
- `PUT /tables/:id/employee`.
- `GET /tables` com `employeeId` e `employeeName`.
- `POST /orders` copiando o garçom da mesa dentro da transação.
- `GET /orders/:id` e o fechamento devolvendo `employeeId` e `employeeName`.
- Comissão calculada e congelada no fechamento com pagamento.
- Testes de cadastro, edição, atribuição, snapshot e comissão em
  `backend/tests/employees.test.js` e `backend/tests/orders.test.js`.
- Páginas `funcionarios.html`, `meu-painel.html` e atribuição em `mesas.html`.

### 11.2 Pendências

| # | Ponto | Requisito | Implementação atual | Ação |
| --- | --- | --- | --- | --- |
| 1 | `GET /employees/:id/tables` | Rota da seção 5.5 | Não existe | **Backend:** implementar; o painel hoje filtra `GET /tables` no cliente. |
| 2 | Testes do Bloco 3 | Cobertura de funcionários, atribuição e comissão | `employees.test.js` cobre cadastro, edição, atribuição, snapshot e comissão | **Resolvido:** falta apenas o teste de `GET /employees/:id/tables`, que depende do item 1. |
| 3 | Ação “Excluir” na tela | Apenas desativar | `funcionarios.js` chama `DELETE /employees/:id` | **Frontend:** trocar por “Desativar” com `PUT active: false`. |
| 4 | Edição por `prompt` | Formulário na própria tela | `funcionarios.js` usa `window.prompt` | **Frontend:** substituir por edição inline ou modal. |
| 5 | Coluna “Mesas atribuídas” | Números das mesas | `GET /employees` não devolve `tables` nem `tablesCount` | **Frontend:** juntar com `GET /tables` ou usar a rota do item 1. |
| 6 | Garçom inativo em mesa | Impedir novas atribuições; sinalizar | Atribuição bloqueia, mas mesa pode continuar com inativo | **Produto:** decidir se desativar deve bloquear ou limpar mesas (seção 12). |
| 7 | Filtro de ativos no painel | Só garçons ativos para atribuir | `mesas.js` lista todos e o backend recusa inativo com `400` | **Frontend:** filtrar `active` na lista de atribuição. |
| 8 | `commission` duplicado no payload | Enviar apenas `commissionBps` | `funcionarios.js` envia `commission` e `commissionBps` | **Frontend:** remover o campo redundante; o backend ignora chaves desconhecidas. |

## 12. Riscos e decisões pendentes

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Troca de garçom depois da abertura | Comissão vai para o garçom errado | Snapshot de `orders.employee_id` na abertura. |
| Mudança de taxa depois do fechamento | Comissão histórica muda | Snapshot de `commission_bps` e `commission_amount` no pagamento. |
| Exclusão física de funcionário | Perda de histórico | Não expor `DELETE`; usar `active = false`. |
| Garçom inativo com mesas | Atribuição inconsistente | Bloquear novas atribuições e sinalizar na interface; decidir tratamento das mesas existentes. |
| Nome duplicado | Confusão operacional | `UNIQUE COLLATE NOCASE` e `409`. |
| Sem autenticação | Painel simula login por select | Documentado; login real em bloco futuro. |
| Sem relatório de comissão | Gerente não vê total por garçom | Dados já gravados; rota e tela no próximo bloco. |
| Comissão sobre comanda sem pagamento | Cálculo incorreto | Comissão só no fechamento com pagamento. |
| Mesa fechada com garçom | Dúvida operacional | Permitido; atribuição sobrevive ao ciclo da mesa. |
| Arredondamento | Diferença de centavos | Regra explícita de metade para cima. |

Decisões pendentes para o fundador ou Tech Lead:

1. Desativar um garçom com mesas deve **bloquear** a operação, **limpar** as
   atribuições automaticamente ou **manter** tudo como está? (Hoje: mantém.)
2. A comissão deve continuar incidindo apenas sobre comandas pagas ou também
   sobre comandas fechadas sem pagamento?
3. A taxa aplicada deve ser a do **fechamento** (atual) ou a do **momento da
   abertura** da comanda?
4. Atribuir mesa `closed` (em limpeza) é permitido? (Hoje: sim.)
5. Uma mesa pode ter um garçom “ajudante” além do responsável? (Fora do
   escopo.)
6. O relatório de comissão por garçom e período entra no Bloco 4?
7. O painel do garçom precisa de login real antes de ir para produção?
8. O nome do garçom em relatórios históricos deve ser o atual ou um snapshot
   do momento? (Hoje: nome atual.)

## 13. Definição de pronto

O Bloco 3 é considerado concluído quando:

- `employees` e as colunas de garçom/comissão fazem parte do schema e dos
  testes.
- As cinco rotas da seção 5 estão implementadas e documentadas.
- `POST /orders` grava o garçom da mesa na abertura.
- O fechamento com pagamento grava a comissão congelada.
- A tela de funcionários cadastra, edita e desativa garçons.
- A tela de mesas atribui, troca e remove garçons.
- O painel do garçom lista apenas as mesas dele.
- Todos os critérios de aceite estão verificados pelo QA.
- Os testes automatizados passam na íntegra.
- A documentação está publicada em `docs/`.
- Nenhuma dependência paga foi adicionada.
- O Product Manager validou o escopo e o Tech Lead aprovou a revisão técnica.
