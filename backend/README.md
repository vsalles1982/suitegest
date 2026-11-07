# Backend — SuiteSimulaFuncoes

Backend do sistema de gestão **não fiscal** para restaurantes, pizzarias e
lanchonetes (ver `../CHARTER.md`, seção 5). Construído com Node.js e Fastify.

## Requisitos

- Node.js >= 18 (nenhum banco de dados ou serviço externo nesta etapa inicial).

## Instalação das dependências

A partir da pasta `backend/`, execute:

```bash
npm install
```

Isso instala as dependências declaradas em `package.json` (atualmente apenas
`fastify`).

## Como rodar o servidor

Na pasta `backend/`:

```bash
# Produção / uso normal
npm start

# Desenvolvimento ( reinicia automaticamente ao alterar arquivos )
npm run dev
```

Alternativamente, diretamente:

```bash
node src/server.js
```

Por padrão o servidor escuta em `http://0.0.0.0:3000`. É possível sobrescrever
via variáveis de ambiente:

```bash
PORT=3001 HOST=127.0.0.1 npm start
```

## Endpoints

| Método | Rota        | Descrição                          | Resposta                                       |
| ------ | ----------- | ---------------------------------- | ---------------------------------------------- |
| GET    | `/health`   | Verificação de saúde do serviço    | `{ "status": "ok" }`                           |
| GET    | `/products` | Lista produtos do cardápio         | Array de `{ id, name, price, categoryId }`     |
| POST   | `/products` | Cadastra um produto (201 on ok)    | `{ id, name, price, categoryId }`              |

- `price` é um **inteiro em centavos** (ex.: `4500` = R$ 45,00).
- `id` é gerado automaticamente (sequencial).
- Payload inválido no `POST` retorna `400` com `{ "error": "..." }`.

Exemplo de teste rápido:

```bash
curl http://localhost:3000/health
curl -X POST http://localhost:3000/products \
  -H 'Content-Type: application/json' \
  -d '{"name":"Pizza Margherita","price":4500,"categoryId":1}'
```

## Testes

Os testes usam o `node:test` nativo (sem dependências adicionais):

```bash
cd backend
npm install   # necessário uma vez, para as dependências de runtime
npm test
```

O armazenamento de produtos ainda é em memória (compartilhado por testes e
processo do servidor). Ao reiniciar o servidor, os dados voltam ao estado
inicial — persistência real virá em etapa posterior.

## Estrutura

```
backend/
├── package.json        # Manifesto e dependências
├── README.md           # Este arquivo
└── src/
    └── server.js       # Servidor Fastify e rotas iniciais
```

## Próximos passos (escopo do CHARTER)

- Módulos de cardápio (produtos, categorias, adicionais), mesas/comandas,
  pedidos, estoque e caixa.
- Testes automatizados e documentação por módulo (definição de pronto).

**Limite explícito:** nenhuma funcionalidade fiscal (NF-e, cupom fiscal, SEFAZ) —
fora do escopo conforme o CHARTER.
