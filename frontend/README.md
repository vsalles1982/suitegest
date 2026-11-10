# Frontend — SUITEGEST

PDV (ponto de venda) para restaurantes, pizzarias e lanchonetes, com gestão **não
fiscal** (conforme o `CHARTER.md`).

## Estrutura

### Tema e shell (Bloco 7)

- `theme.css` — dark mode (fundo `#0d1117`, cards `#1f2937`, destaque `#fbbf24`),
  estilos da sidebar, cards, botões (primário/secundário/perigo) e toasts.
- `theme.js` — monta/ativa a sidebar fixa e o botão de menu em telas estreitas.
- `toast.js` — notificações toast (`showToast`, `confirmToast`): canto inferior
  direito no desktop e topo no mobile (docs/backlog-ui.md, seção 8.7).
- `modal.js` — modal de formulário reutilizável (`openModal`), usado no lugar de
  `prompt`/`alert`/`confirm` nativos: foco preso, `Esc` fecha, retorno de foco,
  scroll bloqueado, validação com `aria-invalid` e `aria-describedby`.

As diretrizes visuais completas estão em [`../docs/backlog-ui.md`](../docs/backlog-ui.md).

### Telas

- `index.html` — página inicial: status do backend e cards dos módulos.
- `cardapio.html` / `cardapio.js` — cadastro de produtos, categorias, estoque e alerta de estoque baixo.
- `estoque.html` / `estoque.js` — listagem de produtos e ajuste de estoque.
- `mesas.html` / `mesas.js` — grade de mesas, abertura de comanda (modal), atribuição de garçom e liberação de mesas.
- `comanda.html` / `comanda.js` — itens da comanda, inclusion de itens, fechamento com pagamento e cupom.
- `meu-painel.html` / `meu-painel.js` — painel do garçom (mesas atribuídas).
- `caixa.html` / `caixa.js` — abertura, movimentações (sangria/suprimento) e fechamento de caixa.
- `relatorios.html` / `relatorios.js` — resumo de vendas.
- `dashboard.html` / `dashboard.js` — indicadores de vendas.
- `funcionarios.html` / `funcionarios.js` — cadastro de garçons, comissões e mesas atribuídas.
- `styles.css` — layout base (tema claro, mantido como base estrutural).
- `app.js` — verifica o status do backend via `fetch` em `http://localhost:3000/health`.

Nenhuma dependência é necessária (sem `npm install`): apenas HTML, CSS e JS puros.

## Como abrir a interface

### Opção 1 — Servidor local simples (recomendado)

Na pasta `frontend/`, inicie um servidor estático com qualquer ferramenta disponível:

```sh
# Python 3
python3 -m http.server 8000

# Node.js (se já estiver instalado)
npx serve .
```

Depois acesse: <http://localhost:8000>

### Opção 2 — Abrindo o arquivo direto

Abra o arquivo `frontend/index.html` diretamente no navegador (duplo clique ou `Ctrl+O`).

> Observação: ao abrir o arquivo direto (`file://`), o `fetch` para `http://localhost:3000/health` pode ser bloqueado pelo navegador em alguns casos. Por isso, a Opção 1 é recomendada para ver o status "Backend Online" corretamente.

## Pré-requisito — backend online

Para o status mostrar "Backend Online", o backend precisa estar rodando:

```sh
cd backend
npm start
```

O endpoint esperado é `GET http://localhost:3000/health`, que retorna `{ "status": "ok" }`.

Se o backend estiver desligado, a interface exibe "Backend Offline" em vermelho — o comportamento é esperado.
