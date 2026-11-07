# Backlog — Fechamento do Ciclo da Mesa (Fase 8)

| Campo | Valor |
| --- | --- |
| Produto | Sistema de gestão não fiscal para restaurantes, pizzarias e lanchonetes |
| Módulo | Mesas e Comandas — fechamento |
| Fase | 8 |
| Responsável | Product Manager |
| Status | Pronto para implementação |
| Versão | 1.0 |
| Data | 2026-11-07 |

## 1. Contexto e objetivo

A Fase 7 entregou a abertura e a consulta de comandas. O ciclo operacional
ainda não fecha: não é possível encerrar a comanda, fechar a mesa para limpeza
nem liberá-la para um novo atendimento.

**Objetivo:** completar o ciclo da mesa com duas operações:

- `POST /orders/:id/close` — fechar a comanda.
- `PUT /tables/:id/status` — fechar a mesa (`occupied → closed`) e liberá-la
  (`closed → free`).

**Resultado esperado:** o atendente encerra a comanda, fecha a mesa para
limpeza e a libera para o próximo cliente, sem deixar comanda aberta nem mesa
presa em estado inconsistente.

## 2. Escopo

### 2.1 Dentro do escopo

- Fechamento de comanda aberta.
- Bloqueio de fechamento de comanda já fechada.
- Transição `occupied → closed` para mesa sem comanda aberta.
- Transição `closed → free` para liberar a mesa.
- Bloqueio de fechamento de mesa que ainda possui comanda aberta.
- Validações de estado, existência e integridade.
- Atomicidade das verificações e atualizações.
- Testes automatizados e documentação.

### 2.2 Fora do escopo

- Reabrir comanda fechada.
- Cancelar comanda, estornar itens ou alterar preços.
- Adicionar ou remover itens depois da abertura.
- Pagamento, divisão de conta, desconto ou taxa de serviço.
- Transição `free → occupied` por este endpoint; a ocupação continua sendo
  consequência do `POST /orders`.
- Transição `occupied → free` direta; é obrigatório passar por `closed`.
- Exclusão de mesas, transferência de mesa ou junção de comandas.
- Reserva, fila de espera e capacidade de lugares.
- Registro de data/hora de fechamento (`closed_at`).
- Baixa de estoque, caixa, documento fiscal ou integração com SEFAZ.
- Autenticação, permissões e auditoria de usuário.
- Interface visual das novas operações.

## 3. Estado de partida

- `tables.status` aceita `free`, `occupied` e `closed`.
- `orders.status` aceita `open` e `closed`.
- `POST /orders` cria comanda com pelo menos um item e deixa a mesa
  `occupied`.
- `GET /orders/:id` retorna a comanda com itens, subtotal e total.
- Índice único parcial `uq_orders_open_per_table` garante no máximo uma
  comanda aberta por mesa.
- Ainda não existem endpoint de fechamento de comanda nem transições de status
  da mesa.

## 4. Fluxo operacional esperado

1. Mesa `free` recebe `POST /orders` e passa a `occupied`.
2. Atendimento termina e o operador chama `POST /orders/:id/close`.
3. A comanda passa a `closed`; a mesa continua `occupied`.
4. Operador chama `PUT /tables/:id/status` com `closed`; a mesa passa a
   `closed`.
5. Após a limpeza, operador chama `PUT /tables/:id/status` com `free`; a mesa
   volta a `free`.

Estados intermediários válidos:

- Mesa `occupied` com comanda `open`: atendimento em andamento.
- Mesa `occupied` com comanda `closed`: atendimento encerrado, aguardando
  fechamento da mesa.
- Mesa `occupied` sem comanda: ocupação manual, se permitida pela operação
  anterior.
- Mesa `closed` sem comanda aberta: limpeza ou manutenção.

## 5. Endpoint 1 — `POST /orders/:id/close`

### 5.1 Objetivo

Encerrar uma comanda aberta, sem alterar seus itens, preços ou a mesa.

### 5.2 Regras

- `:id` deve ser inteiro positivo; inválido retorna 400.
- Comanda inexistente retorna 404.
- A comanda precisa estar `open`; se já estiver `closed`, retorna 409.
- A comanda precisa ter pelo menos um item; comanda aberta sem itens retorna
  409 e não é fechada.
- O fechamento altera somente `orders.status` para `closed`.
- Itens, quantidades, preços unitários, subtotais e total não são alterados.
- A mesa **não** é alterada por este endpoint; continua `occupied` até o
  fechamento explícito da mesa.
- O fechamento não exclui a comanda; ela permanece consultável por
  `GET /orders/:id`.
- Não é permitido reabrir a comanda por este endpoint.
- Duas requisições concorrentes de fechamento: apenas uma deve vencer; a outra
  retorna 409.
- A atualização deve ser atômica e condicionada ao status `open`.

### 5.3 Resposta de sucesso

Retorna 200 com a comanda atualizada no mesmo formato de `GET /orders/:id`:

- `id`, `tableId`, `status` (`closed`) e `createdAt`.
- Lista `items` com `productId`, `productName`, `quantity`, `unitPrice`,
  `subtotal` e campos formatados.
- `total` em centavos e `totalFormatted`.

### 5.4 Erros

| Código | Situação |
| --- | --- |
| 400 | `id` não inteiro, menor que 1 ou inválido. |
| 404 | Comanda inexistente. |
| 409 | Comanda já fechada ou comanda aberta sem itens. |
| 500 | Erro interno inesperado. |

## 6. Endpoint 2 — `PUT /tables/:id/status`

### 6.1 Objetivo

Executar as transições de fechamento e liberação da mesa:

- `occupied → closed`
- `closed → free`

### 6.2 Corpo e valores aceitos

O corpo é `{ "status": "..." }`. Nesta fase, os únicos destinos aceitos são:

- `closed` — fechar a mesa para limpeza/manutenção.
- `free` — liberar a mesa após a limpeza.

Enviar `occupied` ou qualquer outro valor retorna 400. A ocupação continua
acontecendo pelo `POST /orders`.

### 6.3 Regras de transição

| De | Para | Permitido | Efeito |
| --- | --- | --- | --- |
| `occupied` | `closed` | Sim, sem comanda aberta | Mesa passa a `closed`. |
| `closed` | `free` | Sim | Mesa volta a `free`. |
| `free` | `closed` | Não | Retorna 409. |
| `occupied` | `free` | Não | Retorna 409; feche a mesa antes. |
| `occupied` | `occupied` | Não | Retorna 400; destino não aceito nesta fase. |
| `closed` | `closed` | Não | Retorna 409; mesa já está fechada. |
| `free` | `free` | Não | Retorna 409; mesa já está livre. |
| `closed` | `occupied` | Não | Retorna 400; destino não aceito nesta fase. |

### 6.4 Fechamento com comanda aberta

- Antes de mudar `occupied → closed`, a API verifica se existe comanda aberta
  para a mesa.
- Se existir, retorna 409 e orienta fechar a comanda primeiro.
- A mesa não pode ser fechada enquanto houver comanda `open`.
- Comandas já `closed` não impedem o fechamento da mesa.
- A verificação e a atualização devem ocorrer na mesma transação para evitar
  corrida entre fechar a mesa e abrir/fechar uma comanda.

### 6.5 Liberação

- `closed → free` não altera comandas.
- Comandas fechadas continuam vinculadas à mesa e consultáveis.
- A mesa liberada pode receber novo `POST /orders`.

### 6.6 Validações e respostas

- Sucesso retorna 200 com `{ id, number, status }` atualizado.
- Mesa inexistente retorna 404.
- `id` não inteiro, menor que 1 ou inválido retorna 400.
- `status` ausente, `occupied` ou fora de `closed`/`free` retorna 400.
- Transição não permitida retorna 409.
- Erro inesperado retorna 500 sem detalhes internos.

## 7. Regras transversais

- **Ordem obrigatória:** fechar a comanda antes de fechar a mesa.
- **Estados independentes:** fechar a comanda não fecha a mesa; fechar a mesa
  não altera a comanda.
- **Atomicidade:** verificação de comanda aberta e atualização da mesa devem
  ser atômicas; fechamento de comanda deve usar atualização condicional.
- **Concorrência:** duas tentativas simultâneas de fechar a mesma comanda ou a
  mesma mesa não podem produzir efeitos duplicados.
- **Preço em centavos:** fechamento não altera `unit_price`, `subtotal` nem
  `total`; valores permanecem inteiros em centavos.
- **Formatação:** campos `*Formatted` continuam derivados e somente leitura.
- **Free First:** nenhuma dependência paga, serviço externo ou banco adicional.
- **Não fiscal:** nenhuma operação gera nota, cupom ou obrigação tributária.
- **Erros:** respostas usam `{ "error": "..." }`, com mensagem em português e
  sem SQL, stack trace ou caminhos internos.
- **Persistência:** status e vínculos sobrevivem ao reinício do servidor.

## 8. Critérios de aceite

### 8.1 Gerais

- [ ] **AC-F8-01** — Os dois endpoints respondem em JSON nos caminhos
  definidos e usam 200 como sucesso.
- [ ] **AC-F8-02** — Erros tratados retornam `{ "error": "..." }`, sem detalhes
  internos.
- [ ] **AC-F8-03** — Operações de verificação e atualização são atômicas.
- [ ] **AC-F8-04** — Nenhuma dependência paga é adicionada.
- [ ] **AC-F8-05** — O módulo tem documentação e testes automatizados
  aprovados.

### 8.2 `POST /orders/:id/close`

- [ ] **AC-CLOSE-01** — Fechar comanda `open` com itens retorna 200 e status
  `closed`.
- [ ] **AC-CLOSE-02** — A resposta contém a comanda com itens, subtotais e total
  inalterados.
- [ ] **AC-CLOSE-03** — Fechar comanda já `closed` retorna 409 e não altera o
  registro.
- [ ] **AC-CLOSE-04** — Comanda inexistente retorna 404.
- [ ] **AC-CLOSE-05** — `id` não inteiro, menor que 1 ou inválido retorna 400.
- [ ] **AC-CLOSE-06** — Comanda aberta sem itens retorna 409 e permanece
  `open`.
- [ ] **AC-CLOSE-07** — Os itens, quantidades, preços unitários, subtotais e
  total não mudam no fechamento.
- [ ] **AC-CLOSE-08** — A mesa continua `occupied` após fechar a comanda.
- [ ] **AC-CLOSE-09** — `GET /orders/:id` após o fechamento retorna status
  `closed` e os mesmos itens.
- [ ] **AC-CLOSE-10** — Duas requisições simultâneas de fechamento resultam em
  um sucesso e um 409.

### 8.3 `PUT /tables/:id/status`

- [ ] **AC-TABLE-01** — `occupied → closed` sem comanda aberta retorna 200 e
  status `closed`.
- [ ] **AC-TABLE-02** — `occupied → closed` com comanda aberta retorna 409 e
  mantém mesa e comanda inalteradas.
- [ ] **AC-TABLE-03** — Após `POST /orders/:id/close`, `occupied → closed`
  retorna 200.
- [ ] **AC-TABLE-04** — `closed → free` retorna 200 e status `free`.
- [ ] **AC-TABLE-05** — Mesa `free` não pode ir para `closed`; retorna 409.
- [ ] **AC-TABLE-06** — Mesa `occupied` não pode ir direto para `free`; retorna
  409.
- [ ] **AC-TABLE-07** — Mesa `closed` não pode ser fechada novamente; retorna
  409.
- [ ] **AC-TABLE-08** — Mesa `free` não pode ser liberada novamente; retorna
  409.
- [ ] **AC-TABLE-09** — `status` ausente, `occupied` ou valor desconhecido
  retorna 400.
- [ ] **AC-TABLE-10** — Mesa inexistente retorna 404.
- [ ] **AC-TABLE-11** — `id` não inteiro, menor que 1 ou inválido retorna 400.
- [ ] **AC-TABLE-12** — `closed → free` não altera comandas já fechadas.
- [ ] **AC-TABLE-13** — Mesa liberada aceita novo `POST /orders`.

### 8.4 Fluxo completo

- [ ] **AC-FLOW-01** — Abrir comanda, fechar comanda, fechar mesa e liberar
  mesa conclui o ciclo com status finais `closed` na comanda e `free` na mesa.
- [ ] **AC-FLOW-02** — Tentar fechar a mesa antes da comanda retorna 409 e não
  deixa a mesa em estado parcial.
- [ ] **AC-FLOW-03** — Após o ciclo, os itens e o total da comanda permanecem
  disponíveis para consulta.
- [ ] **AC-FLOW-04** — Falha em qualquer etapa não deixa comanda aberta com
  mesa `free` nem mesa fechada com comanda aberta.

## 9. Riscos e decisões pendentes

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Fechamento de mesa concorrente com abertura de comanda | Mesa fechada com comanda aberta | Verificação e atualização na mesma transação. |
| Fechamento duplo de comanda | Efeitos duplicados | `UPDATE` condicional em `status = 'open'`; segunda requisição recebe 409. |
| Comanda fechada e mesa esquecida em `occupied` | Mesa presa | Fluxo explícito em duas etapas e documentação; interface deve orientar. |
| Mesa fechada sem comanda | Fechamento sem consumo | Permitido nesta fase; a regra só bloqueia comanda `open`. |
| Ausência de `closed_at` | Sem histórico de quando fechou | Registrado como melhoria futura. |
| `409` para comanda já fechada | Repetição não idempotente | Frontend deve tratar 409 como estado já concluído. |

Decisões pendentes para o fundador ou Tech Lead:

- Confirmar se fechar uma comanda já fechada deve continuar retornando 409 ou
  passar a ser idempotente com 200.
- Confirmar se `occupied → closed` deve ser permitido sem nenhuma comanda.
- Confirmar se será necessário registrar `closed_at` em uma fase futura.
- Confirmar se a transição `free → occupied` será reativada no endpoint de
  status ou continuará exclusiva do `POST /orders`.

## 10. Definição de pronto

O fechamento do ciclo da mesa é considerado concluído quando:

- `POST /orders/:id/close` e `PUT /tables/:id/status` estão implementados e
  documentados.
- Todos os critérios de aceite estão verificados pelo QA.
- Os testes automatizados passam na íntegra.
- O fluxo completo abrir → fechar comanda → fechar mesa → liberar está coberto
  por teste de integração.
- A documentação está publicada em `docs/`.
- Nenhuma dependência paga foi adicionada.
- O Product Manager validou o escopo e o Tech Lead aprovou a revisão técnica.
