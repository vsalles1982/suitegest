# CHARTER — SuiteSimulaFuncoes

Documento de fundação do projeto. Define missão, equipe, política financeira,
regras da empresa e o primeiro produto.

## 1. Missão do projeto SuiteSimulaFuncoes

Simular funções empresariais com agentes de IA, permitindo que uma empresa
opere com uma equipe de agentes especializados, papéis claros e processos
auditáveis — começando pela gestão de estabelecimentos de alimentação.

Princípios que orientam o projeto:

- **Free First:** máximo valor com o mínimo custo; priorizar modelos e
  ferramentas gratuitos.
- **Função antes de execução:** todo agente tem cargo, escopo e entregáveis
  definidos.
- **Qualidade verificável:** entrega só é concluída quando passa por testes e
  tem documentação.
- **Decisão humana:** o fundador aprova decisões críticas.

## 2. Equipe inicial

A equipe inicial é composta por cinco cargos. Cada cargo tem um modelo LLM
responsável, todos dentro da camada gratuita validada no ambiente (OpenCode Zen).

| Cargo | Modelo LLM responsável | Escopo principal |
| --- | --- | --- |
| Product Manager | `Big Pickle` | Visão de produto, priorização do backlog, critérios de aceite e comunicação com o fundador. |
| Tech Lead | `DeepSeek V4.1 Flash Free` | Arquitetura, padrões técnicos, revisão de código e coordenação entre Backend, Frontend e QA. |
| Backend | `GLM-5.3-Flash Free` | APIs, regras de negócio, persistência de dados, integrações e testes de backend. |
| Frontend | `Crouton Alpha Free` | Interface web, usabilidade, componentes, acessibilidade e testes de frontend. |
| QA | `Flint 40B Free` | Planos de teste, testes automatizados, validação de critérios de aceite e relatórios de qualidade. |

*Nota: Todos os modelos acima foram confirmados como "Free" no catálogo do OpenCode Zen no ambiente local. Modelos locais via Ollama (ex: qwen2.5) ficam reservados para contingência offline.*

Regras de composição da equipe:

- Nenhum cargo pode ser ocupado de forma acumulativa sem aprovação explícita
  do fundador.
- A troca do modelo responsável por um cargo é uma decisão crítica e exige
  aprovação do fundador.
- O Tech Lead responde pela coerência técnica entre os módulos; o Product
  Manager responde pelo escopo do produto.
- O QA tem autonomia para bloquear entregas que não atendam aos critérios de
  aceite.

## 3. Política financeira

- **Orçamento adicional: US$ 0.** O projeto não autoriza gastos adicionais.
- Usar exclusivamente modelos, serviços e ferramentas gratuitos ou já
  disponíveis no ambiente.
- É proibido contratar APIs pagas, assinaturas, infraestrutura paga ou
  qualquer serviço que gere cobrança.
- Se uma necessidade técnica exigir custo, a solução deve ser substituída por
  uma alternativa gratuita. Caso não exista alternativa, o assunto é levado ao
  fundador e permanece bloqueado até decisão explícita.
- Toda decisão que possa gerar custo deve registrar: necessidade, alternativas
  gratuitas avaliadas e recomendação.

## 4. Regras da empresa

1. **Nenhum agente trabalha sem função definida.** Todo agente deve ter cargo,
   escopo, entregáveis e critérios de conclusão antes de iniciar a execução.
2. **Código precisa passar por testes.** Nenhuma alteração de código é
   considerada concluída sem testes automatizados relevantes e execução
   aprovada. Entrega com teste falhando não é aceita.
3. **Cada módulo tem documentação.** Todo módulo deve ter documentação própria
   cobrindo objetivo, responsabilidades, interfaces, decisões relevantes e
   como executar seus testes.
4. **O fundador aprova decisões críticas.** São decisões críticas, no mínimo:
   mudança de escopo do produto, troca de modelo por cargo, alteração da
   política financeira, mudança de arquitetura que afete mais de um módulo,
   exclusão de dados ou de código, e qualquer ação irreversível.

Regras de trabalho adicionais:

- Mudanças devem ser pequenas, revisáveis e rastreáveis.
- O Tech Lead revisa alterações antes da conclusão; o QA valida os critérios de
  aceite.
- Documentação e testes fazem parte da definição de pronto, não são etapas
  opcionais posteriores.

## 5. Primeiro produto

**Sistema de gestão não fiscal para restaurantes, pizzarias e lanchonetes.**

Objetivo: apoiar a operação diária do estabelecimento com controle de salão,
pedidos, cardápio, estoque e caixa, sem qualquer responsabilidade fiscal.

Escopo inicial previsto:

- Cadastro de produtos, categorias, adicionais e composição de itens do
  cardápio.
- Abertura e gestão de mesas, comandas e pedidos (salão, balcão e retirada).
- Acompanhamento de pedidos por status, do lançamento à entrega.
- Controle simplificado de estoque de insumos e baixa por venda.
- Registro de movimentações de caixa e fechamento por turno.
- Relatórios operacionais: vendas por período, itens mais vendidos, ticket
  médio e consumo de insumos.
- Cadastro de clientes e histórico de pedidos, quando aplicável.

Fora de escopo (limite explícito do produto):

- Emissão de nota fiscal, cupom fiscal ou qualquer documento fiscal.
- Integração com SEFAZ, PDV fiscal, TEF ou obrigações tributárias.
- Cálculo de impostos e escrituração contábil.
- Gestão financeira corporativa, folha de pagamento e contabilidade formal.

Critérios de sucesso da primeira entrega:

- Um estabelecimento consegue operar o ciclo básico de pedido e caixa sem
  planilhas externas.
- Todos os módulos entregues têm testes passando e documentação publicada.
- Nenhum custo adicional gerado, em conformidade com a política financeira.
- Decisões críticas registradas e aprovadas pelo fundador.
