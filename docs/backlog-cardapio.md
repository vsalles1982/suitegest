# Backlog — Módulo de Cardápio (Fase 2)

| Campo | Valor |
| --- | --- |
| Produto | Sistema de gestão não fiscal para restaurantes, pizzarias e lanchonetes |
| Módulo | Cardápio |
| Fase | 2 |
| Responsável | Product Manager |
| Status | Pronto para refinamento técnico |
| Versão | 1.0 |
| Data | 2026-11-07 |

## 1. Contexto e objetivo

O Módulo de Cardápio é a base operacional do produto. Ele permite cadastrar e
organizar o que o estabelecimento vende, com preço, disponibilidade e adicionais,
para que os módulos seguintes (pedidos, mesas e caixa) tenham uma fonte única e
confiável de dados.

**Objetivo da Fase 2:** entregar o cadastro completo de categorias, produtos e
adicionais, com APIs de consulta e manutenção, validação consistente e
documentação, sem gerar custo adicional.

**Resultado esperado:** o estabelecimento consegue montar seu cardápio digital
no sistema, organizado por categorias, com preços em centavos e adicionais
vinculados aos produtos.

## 2. Escopo

### 2.1 Dentro do escopo

- Cadastro, consulta, atualização e inativação de categorias.
- Cadastro, consulta, atualização e inativação de produtos.
- Cadastro, consulta, atualização e inativação de adicionais.
- Vinculação e desvinculação de adicionais a produtos.
- Filtros, busca e paginação nas listagens.
- Regras de validação e mensagens de erro padronizadas.
- Documentação do módulo e testes automatizados.

### 2.2 Fora do escopo da Fase 2

- Emissão de documento fiscal, cálculo de impostos ou integração com SEFAZ.
- Controle de estoque, baixa de insumos e custo de mercadoria.
- Fluxo de pedidos, mesas, comandas e caixa.
- Fotos ou upload de imagens de produtos (evita custo de armazenamento).
- Tamanhos, sabores, combos e grupos de opções obrigatórias.
- Promoções, cupons, descontos e preços por turno.
- Autenticação e controle de permissões por perfil (tratados em módulo
  transversal futuro).
- Aplicativo móvel e integração com marketplaces.

## 3. Entidades e regras de dados

### 3.1 Categoria

Agrupa produtos para organização do cardápio (ex.: Pizzas, Bebidas, Sobremesas).

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `id` | Identificador único | Sim (gerado) | Imutável após a criação. |
| `nome` | Texto | Sim | De 2 a 60 caracteres após remover espaços nas pontas; único no sistema, sem diferenciar maiúsculas de minúsculas. |
| `descricao` | Texto | Não | Até 255 caracteres. |
| `ordem` | Inteiro | Não | Maior ou igual a 0; define a ordem de exibição; padrão 0. |
| `ativa` | Booleano | Sim | Padrão `true`; categoria inativa não pode receber novos produtos. |
| `criadoEm` | Data/hora | Sim (gerado) | Gerado pelo sistema. |
| `atualizadoEm` | Data/hora | Sim (gerado) | Atualizado a cada alteração. |

### 3.2 Produto

Item vendável do cardápio (ex.: Pizza Margherita, Refrigerante 350 ml).

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `id` | Identificador único | Sim (gerado) | Imutável após a criação. |
| `categoriaId` | Referência | Sim | Deve existir e estar ativa no momento do cadastro ou da reativação. |
| `nome` | Texto | Sim | De 2 a 80 caracteres após remover espaços nas pontas; único dentro da categoria, sem diferenciar maiúsculas de minúsculas. |
| `descricao` | Texto | Não | Até 500 caracteres. |
| `precoCentavos` | Inteiro | Sim | Maior ou igual a 0 e menor ou igual a 10.000.000 (R$ 100.000,00); nunca aceitar valor decimal, texto formatado ou negativo. |
| `disponivel` | Booleano | Sim | Padrão `true`; indica se o produto pode ser vendido agora. |
| `ativo` | Booleano | Sim | Padrão `true`; exclusão é lógica. |
| `adicionais` | Lista de referências | Não | Somente adicionais ativos podem ser vinculados; padrão lista vazia. |
| `criadoEm` | Data/hora | Sim (gerado) | Gerado pelo sistema. |
| `atualizadoEm` | Data/hora | Sim (gerado) | Atualizado a cada alteração. |

### 3.3 Adicional

Item opcional acrescentado a um produto (ex.: Bacon extra, Borda recheada).

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `id` | Identificador único | Sim (gerado) | Imutável após a criação. |
| `nome` | Texto | Sim | De 2 a 60 caracteres após remover espaços nas pontas; único no sistema, sem diferenciar maiúsculas de minúsculas. |
| `descricao` | Texto | Não | Até 255 caracteres. |
| `precoCentavos` | Inteiro | Sim | Maior ou igual a 0 e menor ou igual a 10.000.000; mesma regra de moeda do produto. |
| `ativo` | Booleano | Sim | Padrão `true`; adicional inativo não pode ser vinculado a novos produtos nem ofertado. |
| `criadoEm` | Data/hora | Sim (gerado) | Gerado pelo sistema. |
| `atualizadoEm` | Data/hora | Sim (gerado) | Atualizado a cada alteração. |

### 3.4 Relacionamentos

- **Categoria 1:N Produto** — todo produto pertence a exatamente uma categoria.
- **Produto N:N Adicional** — um produto pode ter vários adicionais e um
  adicional pode estar em vários produtos.
- A remoção de vínculo entre produto e adicional não exclui nenhuma das partes.

## 4. Regras de negócio

- **RN-01 — Moeda em centavos:** todo preço trafega e é armazenado como inteiro
  em centavos. A API não aceita `"R$ 12,90"`, `12.90` ou `"12,90"`.
- **RN-02 — Formatação apenas na apresentação:** a conversão para Real (R$) é
  responsabilidade da interface, nunca da API.
- **RN-03 — Nome obrigatório e normalizado:** nomes são obrigatórios, têm os
  espaços das pontas removidos e não podem ser vazios após a normalização.
- **RN-04 — Unicidade:** categorias e adicionais têm nome único no sistema;
  produtos têm nome único dentro da própria categoria.
- **RN-05 — Exclusão lógica:** `DELETE` inativa o registro (`ativo = false`),
  preservando histórico e vínculos. Não há exclusão física na Fase 2.
- **RN-06 — Categoria com produtos ativos:** não pode ser inativada enquanto
  possuir produtos ativos vinculados.
- **RN-07 — Categoria inativa:** seus produtos não podem ser tornados
  disponíveis para venda até que sejam movidos para uma categoria ativa.
- **RN-08 — Adicional inativo:** deixa de ser ofertado, mas permanece vinculado
  aos produtos para fins de histórico.
- **RN-09 — Disponibilidade independente:** `disponivel` (venda do dia) e
  `ativo` (existência no cardápio) são campos distintos.
- **RN-10 — Preço do adicional:** é sempre somado ao preço do produto quando o
  adicional for escolhido; esse cálculo pertence ao módulo de pedidos.
- **RN-11 — Sem efeito fiscal:** nenhum campo, cálculo ou endpoint do módulo
  gera documento fiscal ou obrigação tributária.
- **RN-12 — Erros padronizados:** toda falha de validação retorna mensagem
  objetiva, com o campo afetado e o motivo.

## 5. Endpoints necessários

Base: `/api/v1`. Todas as respostas usam JSON. Listagens são paginadas.

### 5.1 Categorias

| Método | Caminho | Descrição | Sucesso |
| --- | --- | --- | --- |
| GET | `/categorias` | Lista categorias com filtros `ativa`, `busca`, `pagina` e `tamanho`. | 200 |
| GET | `/categorias/{id}` | Consulta uma categoria pelo identificador. | 200 |
| POST | `/categorias` | Cria uma categoria. | 201 |
| PUT | `/categorias/{id}` | Atualiza todos os campos editáveis da categoria. | 200 |
| DELETE | `/categorias/{id}` | Inativa a categoria (exclusão lógica). | 204 |

### 5.2 Produtos

| Método | Caminho | Descrição | Sucesso |
| --- | --- | --- | --- |
| GET | `/produtos` | Lista produtos com filtros `categoriaId`, `disponivel`, `ativo`, `busca`, `pagina` e `tamanho`. | 200 |
| GET | `/produtos/{id}` | Consulta um produto pelo identificador, incluindo adicionais vinculados. | 200 |
| POST | `/produtos` | Cria um produto. | 201 |
| PUT | `/produtos/{id}` | Atualiza os campos editáveis do produto. | 200 |
| PATCH | `/produtos/{id}/disponibilidade` | Altera apenas `disponivel` (ligar/desligar venda do dia). | 200 |
| DELETE | `/produtos/{id}` | Inativa o produto (exclusão lógica). | 204 |

### 5.3 Adicionais

| Método | Caminho | Descrição | Sucesso |
| --- | --- | --- | --- |
| GET | `/adicionais` | Lista adicionais com filtros `ativo`, `busca`, `pagina` e `tamanho`. | 200 |
| GET | `/adicionais/{id}` | Consulta um adicional pelo identificador. | 200 |
| POST | `/adicionais` | Cria um adicional. | 201 |
| PUT | `/adicionais/{id}` | Atualiza os campos editáveis do adicional. | 200 |
| DELETE | `/adicionais/{id}` | Inativa o adicional (exclusão lógica). | 204 |

### 5.4 Vínculos entre produtos e adicionais

| Método | Caminho | Descrição | Sucesso |
| --- | --- | --- | --- |
| GET | `/produtos/{produtoId}/adicionais` | Lista os adicionais vinculados ao produto. | 200 |
| POST | `/produtos/{produtoId}/adicionais/{adicionalId}` | Vincula um adicional ativo ao produto. | 204 |
| DELETE | `/produtos/{produtoId}/adicionais/{adicionalId}` | Remove o vínculo entre produto e adicional. | 204 |

### 5.5 Códigos de erro comuns

| Código | Quando usar |
| --- | --- |
| 400 | Requisição malformada ou parâmetro inválido. |
| 404 | Recurso não encontrado. |
| 409 | Conflito: nome duplicado, categoria com produtos ativos ou vínculo já existente. |
| 422 | Dados válidos em formato, mas que violam regra de negócio. |
| 500 | Erro interno inesperado, sem exposição de detalhes sensíveis. |

## 6. Critérios de aceite

### 6.1 Gerais

- [ ] **AC-GERAL-01** — Toda listagem é paginada; sem parâmetros, retorna no
  máximo 20 itens e informa total de registros e página atual.
- [ ] **AC-GERAL-02** — Todo erro de validação retorna mensagem clara, com o
  campo afetado e o motivo, sem expor detalhes internos.
- [ ] **AC-GERAL-03** — Datas são retornadas em ISO 8601, com fuso horário.
- [ ] **AC-GERAL-04** — Nenhum endpoint exige serviço pago ou dependência com
  custo; a solução roda com ferramentas gratuitas.
- [ ] **AC-GERAL-05** — Todos os endpoints têm documentação e testes
  automatizados aprovados.

### 6.2 Categorias

- [ ] **AC-CAT-01** — Criar categoria com nome válido retorna 201 e o registro
  com `id`, `ativa = true` e timestamps preenchidos.
- [ ] **AC-CAT-02** — O nome da categoria é obrigatório; nome vazio, ausente ou
  só com espaços retorna 422.
- [ ] **AC-CAT-03** — Nome com menos de 2 ou mais de 60 caracteres retorna 422.
- [ ] **AC-CAT-04** — Nome duplicado, ignorando maiúsculas/minúsculas, retorna
  409 (ex.: "Bebidas" e "bebidas").
- [ ] **AC-CAT-05** — A listagem pode filtrar por `ativa` e buscar por parte do
  nome, sem diferenciar maiúsculas/minúsculas.
- [ ] **AC-CAT-06** — Consultar categoria inexistente retorna 404.
- [ ] **AC-CAT-07** — Atualizar categoria com dados válidos retorna 200 e
  preserva `id` e `criadoEm`.
- [ ] **AC-CAT-08** — Inativar categoria sem produtos ativos retorna 204 e
  altera `ativa` para `false`.
- [ ] **AC-CAT-09** — Inativar categoria com produtos ativos retorna 409 e não
  altera o registro.
- [ ] **AC-CAT-10** — Categoria inativa não pode ser usada como categoria de um
  novo produto (retorna 422).

### 6.3 Produtos

- [ ] **AC-PROD-01** — Criar produto com dados válidos retorna 201 e o registro
  com `id`, `ativo = true`, `disponivel = true` e timestamps preenchidos.
- [ ] **AC-PROD-02** — O nome do produto é obrigatório; nome vazio, ausente ou
  só com espaços retorna 422.
- [ ] **AC-PROD-03** — O nome deve ter de 2 a 80 caracteres; fora disso, retorna
  422.
- [ ] **AC-PROD-04** — O preço deve ser informado em centavos, como inteiro; valor
  ausente, negativo, decimal ou texto formatado retorna 422.
- [ ] **AC-PROD-05** — Preço acima de 10.000.000 centavos retorna 422.
- [ ] **AC-PROD-06** — Preço igual a 0 é aceito (item gratuito ou cortesia).
- [ ] **AC-PROD-07** — `categoriaId` é obrigatório; ausente retorna 422 e
  inexistente retorna 404.
- [ ] **AC-PROD-08** — Produto com nome duplicado na mesma categoria retorna
  409, ignorando maiúsculas/minúsculas; o mesmo nome em outra categoria é
  permitido.
- [ ] **AC-PROD-09** — A listagem pode filtrar por categoria, disponibilidade e
  status ativo, além de buscar por parte do nome.
- [ ] **AC-PROD-10** — Consultar produto inexistente retorna 404.
- [ ] **AC-PROD-11** — Atualizar produto com dados válidos retorna 200 e preserva
  `id` e `criadoEm`.
- [ ] **AC-PROD-12** — `PATCH /produtos/{id}/disponibilidade` altera somente
  `disponivel` e não modifica os demais campos.
- [ ] **AC-PROD-13** — Produto de categoria inativa não pode ser marcado como
  `disponivel = true` (retorna 422).
- [ ] **AC-PROD-14** — Inativar produto retorna 204 e mantém o registro
  consultável com `ativo = false`.
- [ ] **AC-PROD-15** — Produto inativo não aparece na listagem padrão, mas pode
  ser incluído com filtro `ativo = false`.
- [ ] **AC-PROD-16** — Produto inativo não pode ser vinculado a novos adicionais
  (retorna 422).

### 6.4 Adicionais

- [ ] **AC-ADI-01** — Criar adicional com dados válidos retorna 201 e o registro
  com `id`, `ativo = true` e timestamps preenchidos.
- [ ] **AC-ADI-02** — O nome do adicional é obrigatório; nome vazio, ausente ou
  só com espaços retorna 422.
- [ ] **AC-ADI-03** — O nome deve ter de 2 a 60 caracteres; fora disso, retorna
  422.
- [ ] **AC-ADI-04** — O preço deve ser inteiro em centavos, maior ou igual a 0;
  valor inválido retorna 422.
- [ ] **AC-ADI-05** — Nome duplicado, ignorando maiúsculas/minúsculas, retorna
  409.
- [ ] **AC-ADI-06** — Consultar adicional inexistente retorna 404.
- [ ] **AC-ADI-07** — Atualizar adicional com dados válidos retorna 200 e
  preserva `id` e `criadoEm`.
- [ ] **AC-ADI-08** — Inativar adicional retorna 204 e mantém o registro
  consultável com `ativo = false`.
- [ ] **AC-ADI-09** — Adicional inativo não aparece na listagem padrão, mas pode
  ser incluído com filtro `ativo = false`.

### 6.5 Vínculos produto–adicional

- [ ] **AC-VINC-01** — Vincular adicional ativo a produto ativo retorna 204 e o
  adicional passa a aparecer na consulta do produto.
- [ ] **AC-VINC-02** — Vincular adicional inativo retorna 422.
- [ ] **AC-VINC-03** — Vincular adicional a produto inexistente ou adicional
  inexistente retorna 404.
- [ ] **AC-VINC-04** — Vincular o mesmo adicional duas vezes ao mesmo produto
  retorna 409.
- [ ] **AC-VINC-05** — Remover vínculo existente retorna 204 e o adicional deixa
  de aparecer na consulta do produto.
- [ ] **AC-VINC-06** — Remover vínculo inexistente retorna 404.
- [ ] **AC-VINC-07** — Inativar um adicional não remove seus vínculos
  existentes; ele apenas deixa de ser ofertado.
- [ ] **AC-VINC-08** — A listagem de adicionais de um produto retorna apenas os
  vínculos daquele produto.

## 7. Requisitos não funcionais

- **Free First:** nenhuma biblioteca, API, banco ou serviço pago. A escolha da
  stack é do Tech Lead, desde que gratuita e local.
- **Desempenho:** listagens com até 1.000 produtos devem responder em até
  500 ms no ambiente local de desenvolvimento.
- **Paginação:** obrigatória em todas as listagens; tamanho padrão 20, máximo
  100 itens por página.
- **Consistência:** validações devem ocorrer na API, independentemente de
  validação na interface.
- **Segurança:** entradas são validadas e erros internos não expõem stack trace,
  SQL ou caminhos de arquivo.
- **Acessibilidade:** a interface futura deve seguir boas práticas de contraste,
  foco e navegação por teclado.
- **Documentação:** o módulo terá documentação de entidades, endpoints, regras e
  execução de testes.

## 8. Dependências, riscos e decisões pendentes

### 8.1 Dependências

- Definição da stack gratuita e do banco de dados pelo Tech Lead.
- Padrão de erros e paginação compartilhado com os demais módulos.
- Estrutura de autenticação e permissões, prevista para módulo transversal.

### 8.2 Riscos

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Preço tratado como decimal ou texto | Erros de cobrança e arredondamento | Contrato da API exige inteiro em centavos e testes cobrem o caso. |
| Exclusão física de registros | Perda de histórico | Exclusão lógica obrigatória na Fase 2. |
| Categoria inativada com produtos ativos | Produtos indisponíveis sem explicação | Bloqueio com 409 e mensagem orientando a mover os produtos. |
| Escopo crescer para tamanhos e combos | Atraso da Fase 2 | Tamanhos, sabores e combos explicitamente fora do escopo. |
| Dependência paga disfarçada | Violação da política financeira | Revisão de dependências pelo Tech Lead antes do merge. |

### 8.3 Decisões pendentes

- Confirmar BRL como moeda única da Fase 2.
- Confirmar se o identificador será UUID ou inteiro sequencial (decisão técnica
  do Tech Lead, sem impacto no contrato funcional).
- Confirmar se a disponibilidade será por produto ou também por categoria no
  futuro.

## 9. Definição de pronto

O Módulo de Cardápio é considerado concluído quando:

- Todos os endpoints das seções 5.1 a 5.4 estão implementados e documentados.
- Todos os critérios de aceite da seção 6 estão verificados pelo QA.
- Os testes automatizados passam na íntegra.
- A documentação do módulo está publicada em `docs/`.
- Nenhuma dependência paga foi adicionada.
- O Product Manager validou o escopo e o Tech Lead aprovou a revisão técnica.
