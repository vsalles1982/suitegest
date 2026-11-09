# Backlog — Controle de Estoque (Bloco 4)

| Campo | Valor |
| --- | --- |
| Produto | Sistema de gestão não fiscal para restaurantes, pizzarias e lanchonetes |
| Módulo | Cardápio, estoque e baixa na venda |
| Bloco | 4 |
| Responsável | Product Manager |
| Status | Backend implementado; ajustes de frontend e contagem inicial pendentes (ver seção 11) |
| Versão | 1.1 |
| Data | 2026-11-09 |

## 1. Contexto e objetivo

O cardápio já cadastra produtos e a comanda já registra itens com preço
congelado. O sistema, porém, não sabe **quanto** de cada produto existe em
estoque. Hoje um produto esgotado continua aparecendo e sendo vendido
normalmente, e o gerente só descobre a falta quando o cliente pede.

**Objetivo do Bloco 4:** controlar a quantidade disponível de cada produto,
dar baixa automática a cada venda e avisar quando o estoque estiver baixo ou
zerado.

**Resultado esperado:**

- O produto passa a ter estoque atual e estoque mínimo.
- O gerente ajusta o estoque manualmente (compra, perda, correção).
- Abrir comanda ou adicionar item baixa o estoque na mesma transação da venda.
- Produto sem estoque não é vendido; a operação é recusada por inteiro.
- O cardápio mostra a situação do estoque e permite ajustar a quantidade.
- A comanda informa o erro de estoque insuficiente sem alterar a comanda.

**Limite de escopo:** este bloco entrega estoque **por produto vendável**, não
por insumo. Ficha técnica, receita, lote, validade, custo e movimentação
detalhada ficam para blocos futuros.

## 2. Escopo

### 2.1 Dentro do escopo

- Coluna `stock` (quantidade atual) em `products`.
- Coluna `min_stock` (estoque mínimo) em `products`.
- Migração leve e idempotente do schema inline.
- `PUT /products/:id/stock` — ajuste manual absoluto do estoque e do mínimo.
- `GET /products/low-stock` — produtos abaixo do mínimo, com o quanto falta.
- Extensão de `GET /products` e `POST /products` com os campos de estoque.
- Baixa automática em `POST /orders` (abertura) e em
  `POST /orders/:id/items` (adição).
- Bloqueio de venda quando o estoque é insuficiente.
- Coluna de estoque e ação de ajuste na tela de cardápio.
- Página dedicada de estoque (`frontend/estoque.html`).
- Tratamento do erro de estoque na comanda.
- Testes automatizados e documentação.

### 2.2 Fora do escopo

- Estoque por insumo, ficha técnica, receita ou baixa de ingredientes.
- Lote, validade, número de série ou rastreabilidade.
- Múltiplos depósitos, almoxarifados ou locais de estoque.
- Reserva de estoque para comanda aberta.
- Histórico de movimentações, auditoria e relatório de consumo.
- Pedido de compra, fornecedor, entrada de nota e custo de mercadoria.
- Custo médio, CMV, margem ou valoração de inventário.
- Reposição automática, ponto de pedido ou sugestão de compra.
- Transferência de estoque entre lojas.
- Leitor de código de barras.
- Notificação por e-mail, push ou WhatsApp.
- Estoque de adicionais (adicionais ainda não existem no produto).
- Estorno ou cancelamento de comanda com devolução de estoque.
- Permissão por perfil para ajustar estoque.
- Produto “não controlado”: nesta fase, todo produto tem estoque.
- Qualquer funcionalidade fiscal ou de inventário tributário.

## 3. Estado de partida

- `products` tinha `id`, `name`, `price`, `category_id` e `created_at`.
- Não existia `stock` nem `min_stock`.
- `GET /products` devolvia `id`, `name`, `price`, `categoryId`,
  `priceFormatted`, `createdAt` e `categoryName`.
- `POST /products` validava `name`, `price` e `categoryId`; não aceitava
  estoque.
- `POST /orders` abria a comanda com ao menos um item e usava
  `BEGIN IMMEDIATE`.
- `POST /orders/:id/items` adicionava um item e também usava
  `BEGIN IMMEDIATE`.
- `unit_price` é snapshot de `products.price` no momento da venda.
- O fechamento da comanda não alterava estoque.
- Não existia rota de cancelamento de comanda.
- `frontend/cardapio.html` exibia Nome, Categoria, Preço e Descrição; a coluna
  Descrição sempre mostrava “—”, porque `products` não tem esse campo.
- `frontend/cardapio.js` enviava apenas `name`, `price` e `categoryId`.
- `frontend/comanda.js` carregava `GET /products` para o seletor de produto e
  enviava `productId` e `quantity`.

## 4. Modelo de dados

### 4.1 Novas colunas em `products`

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `stock` | Inteiro | Sim | Quantidade atual disponível. `>= 0`. Padrão `0`. |
| `min_stock` | Inteiro | Sim | Ponto de reposição. `>= 0`. Padrão `0`. |

Definição no schema:

- `stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)`
- `min_stock INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0)`
- Na API, `min_stock` vira `minStock`.

Regras:

- Estoque é sempre **inteiro**; nunca ponto flutuante, fração ou unidade
  quebrada.
- Estoque controlado nunca fica negativo.
- `min_stock` é o limite de **alerta**, não o limite de venda: vender até
  zerar é permitido; vender abaixo de zero não.
- Todo produto é controlado nesta fase. Não existe “produto sem estoque”.
- `stock = 0` significa esgotado e bloqueia a venda.
- `min_stock = 0` significa “sem alerta de reposição”; o produto só aparece em
  `low-stock` quando o mínimo for maior que zero.

### 4.2 Por que todo produto começa controlado

A decisão implementada foi manter as colunas `NOT NULL DEFAULT 0` e tratar
todo produto como controlado. Vantagens:

- modelo simples, sem estado “não controlado”;
- o gerente sempre vê um número, nunca “—”.

Consequências:

- Todo produto existente migra com `stock = 0` e fica **esgotado** até o
  ajuste manual.
- Todo produto novo nasce com `stock = 0` e também não pode ser vendido até o
  ajuste.
- É obrigatório fazer a contagem inicial antes de liberar o sistema para
  venda (ver seção 11.2, item 1).

A alternativa “estoque anulável = não controlado” foi descartada nesta
implementação. Se o estabelecimento tiver itens que não devem ser controlados
(taxa de serviço, prato sob encomenda), será necessário um bloco futuro com
uma coluna própria de configuração.

### 4.3 Campos derivados

| Campo | Tipo | Cálculo | Onde aparece |
| --- | --- | --- | --- |
| `lowStock` | Booleano | `stock < minStock` | Calculado no frontend |
| `missing` | Inteiro | `minStock - stock` | `GET /products/low-stock` |
| `stockStatus` | Texto sugerido | `"out"` se `stock = 0`; `"low"` se `0 < stock < minStock`; `"ok"` caso contrário | Ainda não exposto pela API |

Observações:

- O critério de alerta é **estrito**: `stock < minStock`. Estoque igual ao
  mínimo **não** alerta.
- Com `minStock = 0`, o produto nunca entra em `low-stock`, nem quando
  `stock = 0`. Isso é intencional: “mínimo zero” significa “não quero alerta
  de reposição”.
- A interface deve tratar `stock = 0` como “Esgotado” **independentemente** do
  mínimo; hoje ela só mostra “Estoque baixo” quando `stock < minStock`.
- `missing` é a quantidade que falta para atingir o mínimo e é usado para
  ordenar a lista de reposição.

### 4.4 Invariantes

1. `stock` é inteiro `>= 0`.
2. `min_stock` é inteiro `>= 0`.
3. Produto nunca tem `stock` negativo.
4. `lowStock` é verdadeiro apenas quando `stock < min_stock`.
5. `missing` é `min_stock - stock` e só existe em `GET /products/low-stock`.
6. Produto com `min_stock = 0` nunca aparece em `low-stock`.
7. A baixa de estoque e a gravação do item acontecem na mesma transação.
8. O valor monetário do item continua sendo o snapshot de `price`; estoque não
   altera preço.

### 4.5 Migração do schema inline

- `SCHEMA_SQL` declara as duas colunas em `CREATE TABLE products` para bancos
  novos.
- Em banco existente, as colunas são adicionadas com `ALTER TABLE`, protegidas
  por `PRAGMA table_info("products")`, no mesmo padrão dos blocos anteriores.
- A migração é idempotente: reiniciar o servidor não duplica coluna nem falha.
- Produtos existentes recebem `stock = 0` e `min_stock = 0`.
- Nenhum produto existente é apagado; todos continuam no cardápio.
- Não há tabela de migrações nem arquivo `.sql`; o schema continua inline em
  `backend/src/database.js`.
- A validação de faixa é feita na aplicação e reforçada pelo `CHECK` do banco.

## 5. Contrato da API

Convenções:

- Campos em `camelCase` na API; colunas em `snake_case` no banco.
- Erros usam `{ "error": "mensagem em português" }`, sem SQL ou stack trace.
- Estoque é sempre inteiro.
- `201` na criação de produto; `200` nas demais operações de sucesso.
- `400` para payload inválido **e** para estoque insuficiente.

### 5.1 `POST /products` (comportamento atual)

O cadastro continua recebendo apenas os campos atuais.

```json
{
  "name": "Coca-Cola 350ml",
  "price": 600,
  "categoryId": 2
}
```

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `name` | Texto | Sim | 2–80 caracteres após `trim`. |
| `price` | Inteiro | Sim | 0–10.000.000 centavos. |
| `categoryId` | Inteiro | Sim | Categoria existente. |

- O produto nasce com `stock = 0` e `minStock = 0`.
- `stock` e `minStock` enviados no corpo **não** são persistidos nesta fase;
  a contagem inicial é feita depois com `PUT /products/:id/stock`.
- Isso significa que todo produto novo precisa de um ajuste antes da primeira
  venda. É uma pendência de usabilidade registrada na seção 11.2.

**Sucesso — `201`**

```json
{
  "id": 12,
  "name": "Coca-Cola 350ml",
  "price": 600,
  "categoryId": 2,
  "priceFormatted": "R$ 6,00",
  "stock": 0,
  "minStock": 0,
  "createdAt": "2026-11-09T14:00:00.000Z",
  "categoryName": "Bebidas"
}
```

### 5.2 `GET /products`

Cada item do array inclui `stock` e `minStock`.

```json
[
  {
    "id": 12,
    "name": "Coca-Cola 350ml",
    "price": 600,
    "categoryId": 2,
    "priceFormatted": "R$ 6,00",
    "stock": 2,
    "minStock": 6,
    "createdAt": "...",
    "categoryName": "Bebidas"
  },
  {
    "id": 13,
    "name": "Pizza Margherita",
    "price": 4500,
    "categoryId": 1,
    "priceFormatted": "R$ 45,00",
    "stock": 0,
    "minStock": 5,
    "createdAt": "...",
    "categoryName": "Pizzas"
  }
]
```

- A ordem e os demais campos continuam iguais aos atuais.
- A API **não** devolve `lowStock`, `stockStatus` nem `stockControlled`; o
  frontend calcula o alerta com `stock < minStock`.
- Produto com `stock = 0` continua na listagem.

### 5.3 `PUT /products/:id/stock`

Ajusta manualmente o estoque e o mínimo de um produto. O ajuste é **absoluto**,
não incremental: o valor enviado substitui o valor atual.

**Corpo**

```json
{ "stock": 30, "minStock": 8 }
```

```json
{ "stock": 0 }
```

```json
{ "minStock": 10 }
```

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `stock` | Inteiro | Não | Ausente = não altera; inteiro `>= 0` = novo valor absoluto. |
| `minStock` | Inteiro | Não | Ausente = não altera; inteiro `>= 0` = novo mínimo. |

Regras:

1. Pelo menos um dos dois campos deve ser enviado; corpo vazio é `400`.
2. `stock: 30` define o estoque como 30, independentemente do valor anterior.
3. `stock: 0` marca o produto como esgotado.
4. `minStock` sozinho atualiza apenas o ponto de reposição.
5. `stock: null` e `minStock: null` são **rejeitados** com `400`; não existe
   desligar o controle nesta fase.
6. O ajuste não altera nome, preço, categoria nem `created_at`.
7. Dois ajustes concorrentes são serializados pelo SQLite; o último valor
   enviado prevalece (semântica de “definir valor”, não de “somar”).
8. O ajuste é permitido mesmo com comanda aberta; ele vale para as próximas
   vendas e não reescreve itens já lançados.

**Sucesso — `200`** com o produto no formato de `GET /products`.

**Erros**

| Código | Situação |
| --- | --- |
| 400 | `id` inválido; corpo sem `stock` nem `minStock`; campo presente com valor nulo, negativo, fracionário ou de outro tipo. |
| 404 | Produto inexistente. |
| 500 | Erro interno inesperado. |

**Exemplo de resposta**

```json
{
  "id": 12,
  "name": "Coca-Cola 350ml",
  "price": 600,
  "categoryId": 2,
  "priceFormatted": "R$ 6,00",
  "stock": 0,
  "minStock": 6,
  "createdAt": "...",
  "categoryName": "Bebidas"
}
```

### 5.4 `GET /products/low-stock`

Lista os produtos **abaixo** do ponto de reposição.

**Critério de inclusão**

- `stock < min_stock`.

Portanto:

- `stock = 0` e `min_stock > 0` entra, com `missing = min_stock`.
- `0 < stock < min_stock` entra, com `missing = min_stock - stock`.
- `stock = min_stock` **não** entra.
- `stock > min_stock` **não** entra.
- `min_stock = 0` **nunca** entra, nem com `stock = 0`.

**Ordenação:** `missing` decrescente (quem mais falta primeiro), depois `name`
crescente.

**Sucesso — `200`**

```json
[
  {
    "id": 13,
    "name": "Pizza Margherita",
    "price": 4500,
    "categoryId": 1,
    "priceFormatted": "R$ 45,00",
    "stock": 0,
    "minStock": 5,
    "createdAt": "...",
    "categoryName": "Pizzas",
    "missing": 5
  },
  {
    "id": 12,
    "name": "Coca-Cola 350ml",
    "price": 600,
    "categoryId": 2,
    "priceFormatted": "R$ 6,00",
    "stock": 2,
    "minStock": 6,
    "createdAt": "...",
    "categoryName": "Bebidas",
    "missing": 4
  }
]
```

- Sem produtos em falta, retorna `200` com `[]`.
- A rota não pagina, não filtra por categoria e não aceita parâmetros nesta
  fase.
- A rota é estática (`/products/low-stock`); o Fastify a resolve antes de
  qualquer rota paramétrica futura. Hoje não existe `GET /products/:id`, então
  não há conflito.

### 5.5 `POST /orders` — abertura com baixa

A abertura continua recebendo `tableId` e `items`. Para cada produto do
payload, o backend:

1. soma as quantidades do mesmo produto;
2. relê `stock` e `name` dentro da transação;
3. se `stock < quantidade`, responde `400` e desfaz a transação inteira;
4. se houver saldo, baixa o estoque e grava os itens.

**Erro de estoque — `400`**

```json
{
  "error": "Estoque insuficiente: \"Coca-Cola 350ml\" tem 2 unidade(s) e a venda pede 3. Não é possível abrir a comanda."
}
```

- O erro não cria comanda, não grava item, não baixa estoque de nenhum produto
  e não ocupa a mesa.
- A mensagem identifica o produto, a disponibilidade e a quantidade pedida.
- A validação de produto inexistente continua `400`, com mensagem própria.

### 5.6 `POST /orders/:id/items` — adição com baixa

A adição segue a mesma regra, dentro do `BEGIN IMMEDIATE` já existente:

1. valida comanda e produto;
2. relê `stock` dentro da transação;
3. se `stock < quantity`, responde `400` e desfaz a transação;
4. se houver saldo, baixa o estoque e grava o item.

**Erro de estoque — `400`**

```json
{
  "error": "Estoque insuficiente: \"Coca-Cola 350ml\" tem 2 unidade(s) e a venda pede 3."
}
```

- O item não é adicionado se o estoque for insuficiente.
- A comanda permanece exatamente como estava antes da tentativa.
- A mensagem não inclui “Não é possível abrir a comanda”, porque a comanda já
  existe.

### 5.7 Resumo de erros do bloco

| Rota | Código | Situação |
| --- | --- | --- |
| `POST /products` | 400 | `name`/`price`/`categoryId` inválidos; categoria inexistente. |
| `GET /products` | 500 | Erro interno. |
| `PUT /products/:id/stock` | 400 | `id` inválido; corpo vazio; campo inválido ou nulo. |
| `PUT /products/:id/stock` | 404 | Produto inexistente. |
| `GET /products/low-stock` | 500 | Erro interno. |
| `POST /orders` | 400 | Estoque insuficiente. |
| `POST /orders/:id/items` | 400 | Estoque insuficiente. |

Os erros já existentes (produto inexistente, mesa fechada, comanda fechada,
payload inválido) continuam com os mesmos códigos e mensagens.

## 6. Regras de negócio

### 6.1 Estoque controlado

| Situação | `stock` | `minStock` | Baixa na venda | Pode ser vendido sem saldo | Aparece em `low-stock` |
| --- | --- | --- | --- | --- | --- |
| Produto com saldo | `> 0` | `>= 0` | Sim | Depende do saldo | Só se `stock < minStock` |
| Produto esgotado | `0` | `>= 0` | Sim, mas não vende | Não | Só se `minStock > 0` |
| Produto com mínimo zero | `>= 0` | `0` | Sim | Depende do saldo | Nunca |

- Todo produto é controlado.
- Não existe produto “não controlado” nesta fase.
- Desligar o controle não é possível pela API; seria necessário um bloco
  futuro.

### 6.2 Ajuste manual

- O ajuste é sempre absoluto: o gerente informa a quantidade real contada.
- Ajustar para cima representa compra, produção ou correção de saldo.
- Ajustar para baixo representa perda, quebra, consumo interno ou correção.
- Ajustar para zero marca o produto como esgotado.
- O ajuste é permitido mesmo com comanda aberta; ele vale para as próximas
  vendas e não reescreve itens já lançados.
- Não existe ajuste negativo nem “delta”; quem quiser somar deve ler o valor
  atual e enviar o novo total.
- O ajuste não tem histórico nesta fase; não é possível saber quem alterou,
  quando ou por quê.

### 6.3 Estoque baixo

- O alerta é calculado na leitura, não persistido.
- `stock < min_stock` é o critério de alerta.
- Estoque igual ao mínimo **não** alerta.
- `min_stock = 0` nunca alerta, nem quando o estoque zera.
- O alerta é operacional: não bloqueia venda por si só. O bloqueio acontece
  apenas quando o saldo é insuficiente para a quantidade pedida.
- A lista de reposição mostra o quanto falta (`missing`) e ordena pelo maior
  faltante.

### 6.4 Estoque zero e venda acima do saldo

Decisão fechada com o fundador: **bloquear a venda**.

| Situação | Comportamento |
| --- | --- |
| `stock = 0` | `400`; nada é gravado. |
| `0 < stock < quantity` | `400`; nada é gravado. |
| `stock = quantity` | Venda permitida; estoque vira `0`. |
| `stock > quantity` | Venda permitida; estoque diminui. |

Justificativa:

- O objetivo do controle é evitar vender o que não existe.
- Permitir com alerta transformaria o estoque em informação decorativa e
  deixaria o saldo negativo, o que exige tratamento extra e confunde o
  gerente.
- O bloqueio é simples de entender e de testar.

A alternativa “permitir com alerta” fica registrada como possibilidade futura
via flag; não está implementada.

### 6.5 Ciclo de vida da venda

| Evento | Efeito no estoque |
| --- | --- |
| Abrir comanda com itens | Baixa a quantidade de cada item. |
| Adicionar item à comanda | Baixa a quantidade do item. |
| Consultar comanda | Nenhum. |
| Fechar comanda | Nenhum. |
| Cancelar comanda | Não existe no bloco; não há reposição. |
| Ajustar estoque manualmente | Substitui o saldo; não mexe em comandas. |

- A baixa acontece **na venda**, não no fechamento: o produto sai do estoque
  quando é pedido, não quando a conta é paga.
- Fechar a comanda não devolve estoque, porque o item foi consumido.
- Como não existe cancelamento, não existe estorno automático. Correções são
  feitas por ajuste manual.
- Se uma comanda for aberta e nunca fechada, o estoque continua baixado; o
  gerente corrige manualmente se necessário.

### 6.6 Agregação de itens repetidos

- Se o mesmo produto aparecer em mais de uma linha da mesma abertura, as
  quantidades são somadas antes da verificação.
- Exemplo: duas linhas de 2 unidades do mesmo produto exigem saldo 4; se
  houver 3, a abertura inteira é recusada.
- A baixa é feita uma vez pelo total agregado.
- Na adição de item único, não há agregação; cada chamada é uma linha.

### 6.7 Concorrência

- A abertura e a adição usam `BEGIN IMMEDIATE`, o que serializa escritores.
- O estoque é lido dentro da transação, imediatamente antes da baixa.
- Duas vendas simultâneas do último item não conseguem intercalar leitura e
  escrita; a segunda encontra o saldo já atualizado e é bloqueada.
- O ajuste manual também é atômico: dois ajustes concorrentes não se
  intercalam; o último valor enviado prevalece.
- Endurecimento recomendado (não implementado): baixa condicional com
  verificação de linhas afetadas, como defesa extra contra alterações futuras
  no fluxo.

### 6.8 Integridade e rollback

- Comanda, itens, status da mesa e baixa de estoque formam uma única unidade
  transacional na abertura.
- Item e baixa formam uma única unidade transacional na adição.
- Falha em qualquer produto desfaz **tudo**: nenhuma comanda, nenhum item,
  nenhuma baixa parcial.
- O erro retornado é o do primeiro produto sem saldo na ordem do payload.
- O estoque nunca fica negativo, nem temporariamente.

## 7. Baixa automática — sequência esperada

### 7.1 Abertura de comanda (`POST /orders`)

1. Validar `tableId`, `items` e a existência da mesa.
2. Recusar mesa fechada ou com comanda aberta.
3. Abrir a transação.
4. Reler a mesa e copiar o garçom, como antes.
5. Criar a comanda.
6. Somar as quantidades por produto.
7. Para cada produto, reler `stock` e `name`.
8. Se `stock < quantidade`, desfazer a transação e responder `400`.
9. Baixar o estoque dos produtos com saldo.
10. Inserir os itens com o preço atual do cadastro.
11. Marcar a mesa como ocupada.
12. Confirmar a transação e responder `201`.

### 7.2 Adição de item (`POST /orders/:id/items`)

1. Validar `id` e o item.
2. Abrir a transação.
3. Reler a comanda; recusar inexistente ou fechada.
4. Reler o produto com `stock`.
5. Se `stock < quantity`, desfazer e responder `400`.
6. Baixar o estoque.
7. Inserir o item com o preço atual.
8. Confirmar a transação e responder `201`.

### 7.3 O que não baixa estoque

- Consulta de comanda.
- Fechamento de comanda.
- Criação ou edição de produto.
- Ajuste manual (ele substitui o saldo, não é venda).
- Relatórios.
- Qualquer operação que falhe antes do commit.

## 8. Integração com o frontend

### 8.1 Tela de cardápio — `frontend/cardapio.html` e `cardapio.js`

Implementado:

- A tabela ganhou a coluna **Estoque** e a coluna **Ações**.
- A coluna Descrição foi mantida (continua exibindo “—”).
- A célula de estoque mostra o número e um badge “Estoque baixo” quando
  `stock < minStock`.
- A ação “Ajustar Estoque” abre um `prompt` com a quantidade atual, valida
  inteiro `>= 0` e envia `PUT /products/:id/stock` com `{ stock }`.
- Após o ajuste, a lista é recarregada.
- Um link no topo leva à página de estoque (`estoque.html`).

Limitações atuais:

- O ajuste usa `prompt`/`alert`, não um diálogo próprio.
- O `prompt` ajusta apenas `stock`, não `minStock`.
- Não há badge “Esgotado” para `stock = 0`.
- Não há painel de estoque baixo no cardápio.
- O cadastro não permite informar estoque inicial; o produto nasce com zero.

### 8.2 Página de estoque — `frontend/estoque.html` e `estoque.js`

Implementado:

- Formulário com select de produto e campo “Nova Quantidade em Estoque”.
- O formulário envia `PUT /products/:id/stock` com `{ stock }` absoluto.
- Tabela com Produto, Estoque, Mínimo, Status e Ações.
- Status mostra badge “Estoque baixo” quando `stock < minStock`; caso contrário,
  “OK”.
- Ação “Ajustar Estoque” repete o ajuste por `prompt`.
- Estados de carregamento, lista vazia e erro de rede têm mensagem.

Limitações atuais:

- O formulário não permite ajustar `minStock`, embora a API aceite.
- Produto com `stock = 0` e `minStock = 0` aparece como “OK”, não “Esgotado”.
- O ajuste usa `prompt`, não um diálogo.
- A página não é linkada a partir de `index.html`; só a partir do cardápio.

### 8.3 Tela de comanda — `frontend/comanda.js`

Implementado:

- O seletor de produto continua mostrando nome e preço.
- Ao adicionar item, o backend pode responder `400` com a mensagem de estoque
  insuficiente.
- A interface exibe a mensagem do backend em um `alert` e mantém a comanda
  inalterada.

Limitações atuais:

- O seletor não mostra a quantidade disponível.
- Produto esgotado não aparece desabilitado; o atendente só descobre ao tentar
  adicionar.
- Não há aviso de estoque baixo antes do envio.
- Após adicionar item, a lista de produtos não é recarregada; o saldo exibido
  pode ficar velho.

### 8.4 Estados e acessibilidade

- Carregando: mensagem explícita em `aria-live`.
- Lista vazia: “Nenhum produto cadastrado”.
- Erro de rede: mensagem e ação de tentar novamente.
- Erro de validação: mensagem clara no `alert` ou no campo.
- Badges não dependem só de cor: sempre têm texto.
- Campos de estoque têm `label` explícito e aceitam apenas inteiros `>= 0`.
- Em telas estreitas, a tabela vira lista de cartões.

## 9. Wireframes textuais

### 9.1 Cardápio com estoque (implementado)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Voltar para a página inicial                                               │
│ Cardápio                                                                     │
│ Produtos cadastrados no sistema de gestão de restaurantes                    │
├──────────────────────────────────────────────────────────────────────────────┤
│ Cadastrar Produto                                                            │
│                                                                              │
│ Nome: [ Coca-Cola 350ml________ ]   Preço em centavos: [ 600____ ]           │
│ Categoria: [ Bebidas ▾ ]                                                     │
│                                                                              │
│                                             [ Cadastrar Produto ]            │
├──────────────────────────────────────────────────────────────────────────────┤
│ Produtos                                                                     │
│ Lista de produtos carregada de /products.                                    │
│ Para controle completo, acesse a página de estoque.                          │
│                                                                              │
│ ┌──────────────────┬──────────┬──────────┬─────────┬──────────┬───────────────┐
│ │ Nome             │ Categoria│ Preço    │ Estoque │ Descrição│ Ações         │
│ ├──────────────────┼──────────┼──────────┼─────────┼──────────┼───────────────┤
│ │ Pizza Margherita │ Pizzas   │ R$ 45,00 │ 0       │ —        │ Ajustar Estoque│
│ │ Coca-Cola 350ml  │ Bebidas  │ R$ 6,00  │ 2       │ —        │ Ajustar Estoque│
│ │                  │          │          │ Estoque │          │               │
│ │                  │          │          │ baixo   │          │               │
│ │ Água mineral     │ Bebidas  │ R$ 4,00  │ 30      │ —        │ Ajustar Estoque│
│ └──────────────────┴──────────┴──────────┴─────────┴──────────┴───────────────┘
│                                                                              │
│ Nenhum produto cadastrado → mensagem de estado vazio                         │
│ Erro ao carregar produtos → mensagem + tentar novamente                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Blocos**

1. **Cabeçalho** — título, subtítulo e link de volta.
2. **Formulário** — nome, preço e categoria (sem estoque inicial nesta fase).
3. **Tabela** — nome, categoria, preço, estoque, descrição e ação.
4. **Badge** — “Estoque baixo” quando `stock < minStock`.
5. **Estados** — carregando, vazio, erro e validação.

**Regras de interface**

- O badge só aparece quando o estoque está abaixo do mínimo.
- `stock = 0` com `minStock = 0` não mostra badge hoje; é uma limitação
  registrada.
- O botão “Ajustar Estoque” fica disponível para todos os produtos.
- O ajuste é absoluto e recarrega a lista.

### 9.2 Ajuste por `prompt` (implementado)

```text
┌──────────────────────────────────────────────────────────────┐
│ Informe a nova quantidade em estoque de Coca-Cola 350ml      │
│ (atual: 2):                                                  │
│                                                              │
│ [ 12______________________________________________________ ] │
│                                                              │
│                                      [ Cancelar ]  [ OK ]    │
└──────────────────────────────────────────────────────────────┘
```

**Comportamento**

- O campo começa vazio; o valor atual aparece na mensagem.
- Cancelar não altera nada.
- Valor não inteiro ou negativo mostra “Quantidade inválida”.
- Sucesso recarrega a lista.
- Erro do backend aparece em `alert`.

### 9.3 Diálogo de ajuste (evolução recomendada)

```text
┌──────────────────────────────────────────────────┐
│ Ajustar estoque — Coca-Cola 350ml                │
├──────────────────────────────────────────────────┤
│ Estoque atual: 2                                 │
│                                                  │
│ Novo estoque: [ 12__ ]                           │
│ Estoque mínimo: [ 6___ ]                         │
│                                                  │
│                      [ Cancelar ]  [ Salvar ]    │
└──────────────────────────────────────────────────┘
```

**Ganhos em relação ao `prompt`**

- Mostra o estoque atual no corpo, não só na mensagem.
- Permite ajustar `minStock` na mesma operação.
- Erro aparece dentro do diálogo, sem perder o contexto.
- É acessível por teclado e fecha com `Esc`.

### 9.4 Página de estoque (implementada)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Voltar para Cardápio                                                       │
│ Estoque                                                                      │
│ Produtos e ajuste de estoque                                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ Ajustar Estoque                                                              │
│                                                                              │
│ Produto: [ Coca-Cola 350ml ▾ ]                                               │
│ Nova Quantidade em Estoque: [ 12__ ]                                         │
│                                                                              │
│                                             [ Ajustar Estoque ]              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Produtos em Estoque                                                          │
│ Lista de produtos carregada de /products.                                    │
│                                                                              │
│ ┌──────────────────┬─────────┬─────────┬──────────────┬────────────────┐      │
│ │ Produto          │ Estoque │ Mínimo  │ Status       │ Ações          │      │
│ ├──────────────────┼─────────┼─────────┼──────────────┼────────────────┤      │
│ │ Pizza Margherita │ 0       │ 5       │ Estoque baixo│ Ajustar Estoque│      │
│ │ Coca-Cola 350ml  │ 2       │ 6       │ Estoque baixo│ Ajustar Estoque│      │
│ │ Água mineral     │ 30      │ 10      │ OK           │ Ajustar Estoque│      │
│ └──────────────────┴─────────┴─────────┴──────────────┴────────────────┘      │
│                                                                              │
│ Nenhum produto cadastrado → mensagem de estado vazio                         │
│ Erro ao carregar produtos → mensagem + tentar novamente                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Limitações**

- Não há campo de estoque mínimo no formulário.
- Não há filtro “somente estoque baixo”.
- Não há painel separado de reposição; a tabela inteira é exibida.

### 9.5 Comanda com erro de estoque (implementado)

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Adicionar item                                                       │
│                                                                      │
│ Produto: [ Coca-Cola 350ml — R$ 6,00 ▾ ]                             │
│ Quantidade: [ 3 ]                                                    │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ Estoque insuficiente: "Coca-Cola 350ml" tem 2 unidade(s) e a     │ │
│ │ venda pede 3.                                                    │ │
│ │                                              [ OK ]              │ │
│ └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

**Comportamento**

- A mensagem vem do backend e é exibida em `alert`.
- A comanda não é alterada.
- O modal permanece aberto para o atendente corrigir a quantidade.

### 9.6 Comanda com estoque (evolução recomendada)

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Adicionar item                                                       │
│                                                                      │
│ Produto: [ Coca-Cola 350ml — R$ 6,00 — 2 un. ▾ ]                     │
│          ┌─────────────────────────────────────────────────────────┐ │
│          │ Coca-Cola 350ml — R$ 6,00 — 2 un.                       │ │
│          │ Pizza Margherita — R$ 45,00 — Esgotado   (desabilitado) │ │
│          │ Água mineral — R$ 4,00 — 30 un.                         │ │
│          └─────────────────────────────────────────────────────────┘ │
│                                                                      │
│ Quantidade: [ 1 ]                                                    │
│                                                                      │
│ ⚠ Restam 2 unidades de Coca-Cola 350ml.                              │
│                                                                      │
│                                            [ Adicionar item ]        │
└──────────────────────────────────────────────────────────────────────┘
```

**Ganhos**

- O atendente vê a disponibilidade antes de tentar vender.
- Produto esgotado fica desabilitado, mas visível.
- O aviso de estoque baixo aparece antes do envio.
- A decisão final continua sendo do backend.

### 9.7 Responsividade e acessibilidade

- Em telas estreitas, a tabela de produtos vira cartões com nome, preço,
  estoque e ação.
- Badges têm texto além da cor.
- O diálogo de ajuste (quando implementado) é navegável por teclado e fecha
  com `Esc`.
- Mensagens de erro e sucesso usam `aria-live="polite"`.
- Campos numéricos têm `min="0"` e `step="1"`.

## 10. Critérios de aceite

### 10.1 Gerais

- [ ] **AC-GER-01** — As rotas respondem em JSON e usam `201` na criação e
  `200` nas demais operações de sucesso.
- [ ] **AC-GER-02** — Erros tratados retornam `{ "error": "..." }`, sem SQL,
  stack trace ou caminhos internos.
- [ ] **AC-GER-03** — Estoque, mínimo e quantidades são inteiros; nenhum valor
  de estoque usa ponto flutuante.
- [ ] **AC-GER-04** — Nenhuma dependência paga, serviço externo ou
  funcionalidade fiscal é adicionada.
- [ ] **AC-GER-05** — O bloco tem documentação e testes automatizados
  aprovados.

### 10.2 Modelo e migração

- [ ] **AC-STK-01** — Após a inicialização, `products` tem as colunas `stock`
  e `min_stock`.
- [ ] **AC-STK-02** — `stock` e `min_stock` são `NOT NULL DEFAULT 0` e aceitam
  apenas inteiros `>= 0`.
- [ ] **AC-STK-03** — Produtos existentes antes da migração ficam com
  `stock = 0` e `min_stock = 0` e continuam no cardápio.
- [ ] **AC-STK-04** — A migração é idempotente: reiniciar o servidor mais de
  uma vez não duplica coluna, não apaga dado e não falha.
- [ ] **AC-STK-05** — O banco e a API nunca aceitam estoque negativo.
- [ ] **AC-STK-06** — Um banco novo já nasce com as duas colunas e com as
  validações de faixa previstas no schema.

### 10.3 Cadastro e listagem de produto

- [ ] **AC-PRD-01** — `POST /products` cria o produto com `stock = 0` e
  `minStock = 0`.
- [ ] **AC-PRD-02** — A resposta de `POST /products` inclui `stock` e
  `minStock`.
- [ ] **AC-PRD-03** — `stock` e `minStock` enviados no corpo de
  `POST /products` não são persistidos nesta fase; a contagem inicial é feita
  via `PUT /products/:id/stock`.
- [ ] **AC-PRD-04** — `GET /products` devolve `stock` e `minStock` em cada
  item.
- [ ] **AC-PRD-05** — Os campos atuais (`id`, `name`, `price`, `categoryId`,
  `priceFormatted`, `createdAt`, `categoryName`) continuam presentes e
  inalterados.
- [ ] **AC-PRD-06** — Produto com `stock = 0` continua aparecendo em
  `GET /products`.
- [ ] **AC-PRD-07** — Produto recém-criado não pode ser vendido até receber
  estoque via ajuste manual.

### 10.4 Ajuste manual de estoque

- [ ] **AC-ADJ-01** — `PUT /products/:id/stock` com `stock` válido retorna
  `200`, persiste o valor e devolve o produto atualizado.
- [ ] **AC-ADJ-02** — O ajuste é absoluto: enviar `10` quando o saldo é `3`
  define `10`, não `13`.
- [ ] **AC-ADJ-03** — `minStock` sozinho atualiza apenas o mínimo.
- [ ] **AC-ADJ-04** — `stock` e `minStock` juntos atualizam os dois campos.
- [ ] **AC-ADJ-05** — Corpo vazio ou sem campo reconhecido retorna `400`.
- [ ] **AC-ADJ-06** — `id` inválido retorna `400`; produto inexistente retorna
  `404`.
- [ ] **AC-ADJ-07** — `stock`/`minStock` negativos, fracionários ou de outro
  tipo retornam `400` e mantêm o valor anterior.
- [ ] **AC-ADJ-08** — `stock: null` e `minStock: null` retornam `400`.
- [ ] **AC-ADJ-09** — A resposta inclui `stock` e `minStock` atualizados.
- [ ] **AC-ADJ-10** — O ajuste não altera `name`, `price`, `categoryId` nem
  `createdAt`; ajustes concorrentes são serializados e o último valor enviado
  prevalece.

### 10.5 Estoque baixo

- [ ] **AC-LOW-01** — `GET /products/low-stock` retorna apenas produtos com
  `stock < minStock`.
- [ ] **AC-LOW-02** — Produto com `stock = minStock` não aparece na lista.
- [ ] **AC-LOW-03** — Produto com `minStock = 0` nunca aparece na lista, mesmo
  com `stock = 0`.
- [ ] **AC-LOW-04** — A lista é ordenada por `missing` decrescente, depois por
  `name` crescente.
- [ ] **AC-LOW-05** — Cada item inclui `missing = minStock - stock`.
- [ ] **AC-LOW-06** — Sem produtos em falta, a rota retorna `200` com `[]`.
- [ ] **AC-LOW-07** — Cada item inclui `id`, `name`, `price`, `categoryId`,
  `priceFormatted`, `categoryName`, `stock`, `minStock` e `missing`.

### 10.6 Baixa automática

- [ ] **AC-BAIXA-01** — `POST /orders` baixa o estoque de cada item na mesma
  transação da comanda.
- [ ] **AC-BAIXA-02** — `POST /orders/:id/items` baixa o estoque do item na
  mesma transação da adição.
- [ ] **AC-BAIXA-03** — Produto repetido no payload de abertura é agregado
  antes da verificação e da baixa.
- [ ] **AC-BAIXA-04** — A baixa usa exatamente a `quantity` do item.
- [ ] **AC-BAIXA-05** — Falha de estoque em qualquer item desfaz comanda,
  itens, baixas e mudança de status da mesa.
- [ ] **AC-BAIXA-06** — Fechar a comanda não altera o estoque.
- [ ] **AC-BAIXA-07** — Não existe reposição automática no fechamento nem em
  qualquer outra rota deste bloco.
- [ ] **AC-BAIXA-08** — A baixa não altera o `unit_price` snapshot do item nem
  o preço do produto.
- [ ] **AC-BAIXA-09** — O estoque nunca fica negativo, nem durante a operação.
- [ ] **AC-BAIXA-10** — A resposta de sucesso só é enviada depois do commit da
  baixa; não há `201` com estoque inconsistente.

### 10.7 Estoque zero e venda acima do saldo

- [ ] **AC-ZERO-01** — Produto com `stock = 0` retorna `400` e não cria
  comanda nem item.
- [ ] **AC-ZERO-02** — `quantity > stock` retorna `400` e não grava nada.
- [ ] **AC-ZERO-03** — `quantity = stock` é permitido e o estoque resultante é
  `0`.
- [ ] **AC-ZERO-04** — Depois de zerar, uma nova tentativa de venda do mesmo
  produto é bloqueada.
- [ ] **AC-ZERO-05** — A mensagem de erro identifica o produto e informa a
  disponibilidade e a quantidade solicitada.
- [ ] **AC-ZERO-06** — No bloqueio, a mesa permanece livre, a comanda não é
  criada e o estoque dos demais produtos não muda.
- [ ] **AC-ZERO-07** — Produto com `minStock = 0` e `stock = 0` continua
  bloqueado para venda, mesmo sem aparecer em `low-stock`.

### 10.8 Frontend

- [ ] **AC-FE-01** — A tabela de cardápio exibe Estoque e Ações para cada
  produto.
- [ ] **AC-FE-02** — O cardápio mostra o badge “Estoque baixo” quando
  `stock < minStock`.
- [ ] **AC-FE-03** — A ação “Ajustar Estoque” envia `PUT
  /products/:id/stock` com valor absoluto e recarrega a lista.
- [ ] **AC-FE-04** — A página de estoque lista Produto, Estoque, Mínimo,
  Status e Ações.
- [ ] **AC-FE-05** — O formulário da página de estoque ajusta a quantidade de
  um produto selecionado.
- [ ] **AC-FE-06** — A página de estoque mostra “Estoque baixo” quando
  `stock < minStock` e “OK” caso contrário.
- [ ] **AC-FE-07** — A comanda exibe a mensagem de estoque insuficiente e
  mantém a comanda inalterada.
- [ ] **AC-FE-08** — Carregando, lista vazia e erro de rede têm mensagem
  explícita em `aria-live`.
- [ ] **AC-FE-09** — Campos e ações têm rótulos e são navegáveis por teclado.
- [ ] **AC-FE-10** — Após um ajuste bem-sucedido, os dados são atualizados sem
  recarregar a página inteira.

## 11. Divergências e pendências

> **Levantamento de 2026-11-09** sobre a árvore de trabalho. O Bloco 4 está
> implementado no backend e parcialmente no frontend.

### 11.1 Já implementado

- Colunas `stock` e `min_stock` em `products`, com `NOT NULL DEFAULT 0` e
  `CHECK >= 0`.
- Migração leve e idempotente; produtos existentes recebem `0/0`.
- `GET /products` e `POST /products` devolvem `stock` e `minStock`.
- `PUT /products/:id/stock` com ajuste absoluto de `stock` e/ou `minStock`.
- `GET /products/low-stock` com `stock < minStock`, ordenação por `missing`
  e campo `missing`.
- Baixa automática em `POST /orders` e `POST /orders/:id/items`.
- Bloqueio de venda com `400` e rollback total.
- Agregação de produto repetido na abertura.
- Coluna de estoque, badge e ação de ajuste no cardápio.
- Página `estoque.html` com formulário e tabela de estoque.
- Testes em `backend/tests/stock.test.js` (7 testes).
- Contrato registrado em `backend/README.md`.

### 11.2 Pendências

| # | Ponto | Requisito | Implementação atual | Ação |
| --- | --- | --- | --- | --- |
| 1 | Contagem inicial obrigatória | Produtos existentes não podem ficar esgotados sem aviso | Migração define `stock = 0` para todos; nenhuma carga inicial | **Produto/Operação:** definir e executar a contagem inicial antes de liberar a venda; comunicar que todo produto nasce esgotado. |
| 2 | Estoque inicial no cadastro | Criar produto já com saldo | `POST /products` ignora `stock`/`minStock`; produto nasce `0/0` | **Backend/Frontend:** aceitar estoque inicial no cadastro ou obrigar o ajuste logo após criar. |
| 3 | Badge “Esgotado” | `stock = 0` deve ser visível como esgotado | Interface só mostra “Estoque baixo” quando `stock < minStock`; `0/0` aparece como “OK” | **Frontend:** tratar `stock = 0` como “Esgotado” independentemente do mínimo. |
| 4 | `minStock` na página de estoque | Ajustar mínimo junto com o saldo | Formulário envia apenas `{ stock }` | **Frontend:** incluir campo de estoque mínimo e enviar `minStock`. |
| 5 | Diálogo de ajuste | Substituir `prompt` por diálogo acessível | Cardápio e estoque usam `window.prompt` | **Frontend:** criar diálogo com estoque atual, novo estoque e mínimo. |
| 6 | Painel de estoque baixo | Listar reposição no cardápio | Não existe; só a tabela geral | **Frontend:** consumir `GET /products/low-stock` e exibir painel “Estoque baixo”. |
| 7 | Estoque na comanda | Mostrar disponibilidade e desabilitar esgotado | Seletor mostra só nome e preço; erro só aparece no `alert` | **Frontend:** incluir estoque no seletor, desabilitar esgotado e avisar estoque baixo. |
| 8 | Recarga após venda | Evitar saldo velho | `comanda.js` não recarrega produtos após adicionar item | **Frontend:** recarregar `GET /products` após sucesso. |
| 9 | Campos derivados na API | Facilitar filtros e integrações | API devolve só `stock` e `minStock` | **Backend:** avaliar `lowStock`/`stockStatus`; hoje o frontend duplica a regra. |
| 10 | Histórico de ajustes | Auditoria de quem alterou | Não existe | **Produto:** avaliar tabela de movimentações em bloco futuro. |
| 11 | Link no menu inicial | Descobrir a página de estoque | `index.html` não linka `estoque.html` | **Frontend:** adicionar card “Estoque” na página inicial. |
| 12 | README desatualizado | Referência ao backlog | `backend/README.md` diz que `docs/backlog-estoque.md` não existe | **Documentação:** atualizar a nota; o documento agora existe. |
| 13 | Testes isolados | Suíte completa estável | `stock.test.js` passa 7/7 sozinho; suíte completa tem 7 falhas por estado compartilhado do banco | **QA/Backend:** isolar o banco por arquivo de teste ou limpar dados de forma consistente. |
| 14 | Endurecimento da baixa | Defesa extra contra saldo negativo | Leitura e baixa dentro de `BEGIN IMMEDIATE`, sem `UPDATE` condicional | **Backend:** avaliar baixa condicional e verificação de linhas afetadas. |

### 11.3 Situação dos testes

- `backend/tests/stock.test.js`: **7/7 passam** quando executado isoladamente.
- Suíte completa (`npm test`): **63 testes, 56 passam, 7 falham**.
- As falhas são de isolamento do banco compartilhado entre arquivos de teste,
  não de regra de estoque: `stock.test.js` limpa tabelas e reinicia contadores
  que outros arquivos assumem estáveis.
- Antes de considerar o bloco pronto, a suíte completa precisa voltar a
  passar de forma determinística.

### 11.4 Observações de documentação

- `docs/backlog-cardapio.md` colocou estoque explicitamente fora do escopo da
  Fase 2. Este documento é a evolução que trata do tema; não é necessário
  reescrever o backlog do cardápio.
- `docs/schema-produtos.md` descreve o schema sem estoque. A atualização
  documental deve apontar para este bloco e registrar as duas novas colunas.
- A coluna “Descrição” da tela de cardápio nunca teve suporte no backend;
  continua exibindo “—”. Não foi removida nesta implementação.
- O fechamento de comanda e o relatório de vendas não são alterados por este
  bloco.
- `backend/README.md` foi atualizado com o contrato de estoque, mas ainda diz
  que este documento não existe.

## 12. Riscos e decisões

### 12.1 Riscos

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Todos os produtos existentes migrarem para `stock = 0` | Nenhuma venda funciona até o ajuste manual | Executar contagem inicial antes de liberar; comunicar a operação. |
| Produto novo nascer com `stock = 0` | Cadastro cria item invendável | Ajustar logo após criar ou aceitar estoque inicial no cadastro. |
| Venda simultânea do último item | Estoque negativo ou venda dupla | `BEGIN IMMEDIATE` + leitura e baixa na mesma transação. |
| Baixa parcial em comanda com vários itens | Estoque inconsistente | Transação única com rollback total. |
| Saldo divergente por venda fora do sistema | Estoque não corresponde à realidade | Ajuste manual absoluto. |
| Sem histórico de movimentação | Não é possível auditar quem ajustou | Fora do escopo; registrar como evolução futura. |
| `minStock = 0` não alerta | Produto pode zerar sem aviso de reposição | Interface deve tratar `stock = 0` como “Esgotado”; orientar o cadastro de mínimo. |
| Fechamento não repõe estoque | Gerente pode esperar devolução | Documentar que a baixa é na venda e que não há cancelamento. |
| Interface com saldo velho | Atendente tenta vender item já esgotado | Recarregar produtos após cada venda e ajuste; backend decide. |
| Ajuste concorrente | Último valor sobrescreve o anterior | Semântica de valor absoluto; documentar e testar. |
| Testes compartilhando banco | Suíte instável e falsos negativos | Isolar banco por arquivo ou limpar dados de forma consistente. |

### 12.2 Decisões adotadas na implementação

> A política de bloqueio de venda está registrada no `backend/README.md` como
> decisão fechada com o fundador. As demais decisões abaixo foram adotadas
> pela implementação e ficam sujeitas à revisão do Product Manager e do Tech
> Lead.

1. **Estoque zero bloqueia a venda** com `400`, e nada é gravado.
2. **O ajuste é absoluto**, não delta: o valor enviado substitui o saldo.
3. **Todo produto é controlado**; não existe “não controlado” nesta fase.
4. **O alerta é estrito**: `stock < minStock`.
5. **`minStock = 0` não alerta**; é uma escolha de “sem reposição
   configurada”.
6. **A baixa ocorre na venda**, não no fechamento.
7. **Não há reposição automática** no fechamento nem em cancelamento.
8. **Estoque é inteiro**; não há unidade fracionada.

### 12.3 Decisões pendentes

1. **Como fazer a contagem inicial?** Ajuste manual produto a produto, carga
   em massa ou aceitar estoque inicial no cadastro?
2. **Produto novo deve permitir estoque inicial no `POST /products`?** Hoje
   nasce `0/0` e precisa de ajuste.
3. **Deve existir “produto não controlado”?** Hoje todos são controlados;
   itens como taxa de serviço precisam de mínimo zero ou de uma coluna futura.
4. **`stock = 0` deve aparecer como “Esgotado” mesmo com `minStock = 0`?**
   Recomendação: sim, na interface.
5. **O alerta deve ser inclusivo (`<=`)?** Hoje é estrito (`<`). Inclusivo
   faria o produto no mínimo aparecer.
6. **Ajuste manual deve ter histórico?** Fora do escopo; recomendado para
   auditoria futura.
7. **Cancelamento de comanda deve repor estoque?** Não existe cancelamento
   hoje; decidir junto com a futura rota.
8. **Venda permissiva com alerta deve existir?** Hoje bloqueia; a alternativa
   ficou como possibilidade futura via flag.
9. **O estoque deve ser por produto ou por insumo?** Este bloco é por produto
   vendável; ficha técnica e insumos ficam para depois.
10. **O ajuste precisa de permissão por perfil?** Não há autenticação; fica
    para o bloco de usuários e permissões.
11. **O relatório de vendas deve mostrar consumo de estoque?** Fora do escopo
    deste bloco.
12. **A página de estoque deve entrar no menu inicial?** Recomendação: sim.

## 13. Definição de pronto

O Bloco 4 é considerado concluído quando:

- `products` tem `stock` e `min_stock` no schema e na migração idempotente.
- A contagem inicial dos produtos existentes foi executada e comunicada.
- `GET /products` e `POST /products` lidam com os campos de estoque.
- `PUT /products/:id/stock` ajusta estoque e mínimo com validação completa.
- `GET /products/low-stock` lista os produtos abaixo do mínimo com `missing`.
- `POST /orders` e `POST /orders/:id/items` baixam estoque na mesma transação.
- Estoque insuficiente ou zerado retorna `400` e desfaz a operação inteira.
- O estoque nunca fica negativo.
- A tela de cardápio mostra estoque, badge e ação de ajuste.
- A página de estoque permite ajustar saldo e mínimo.
- A comanda mostra disponibilidade, avisa sobre estoque baixo e trata o erro de
  estoque insuficiente.
- A suíte completa de testes passa de forma determinística.
- Todos os critérios de aceite estão verificados pelo QA.
- A documentação está publicada em `docs/`.
- Nenhuma dependência paga foi adicionada.
- O Product Manager validou o escopo e o Tech Lead aprovou a revisão técnica.
