# Frontend — SuiteSimulaFuncoes

Interface inicial do sistema de gestão não fiscal para restaurantes, pizzarias e lanchonetes (conforme o `CHARTER.md`).

## Estrutura

- `index.html` — estrutura da página: título, container de status e seção de módulos (Cardápio, Mesas, Caixa).
- `styles.css` — layout limpo, responsivo e com cores neutras.
- `app.js` — verifica o status do backend via `fetch` em `http://localhost:3000/health` e exibe "Backend Online" (verde) ou "Backend Offline" (vermelho).

Nenhuma dependência é necessária (sem `npm install`).

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
