# Backlog — Diretrizes Visuais do SUITEGEST

| Campo | Valor |
| --- | --- |
| Produto | SUITEGEST — sistema de gestão não fiscal para restaurantes, pizzarias e lanchonetes |
| Módulo | Design system, app shell, sidebar e componentes visuais |
| Bloco | Transversal (aplica-se a todos os módulos) |
| Responsável | Product Manager |
| Status | Diretriz definida; implementação atual em tema claro e sem sidebar (seção 14) |
| Versão | 1.0 |
| Data | 2026-11-10 |

## 1. Contexto e objetivo

O SUITEGEST cresceu por blocos: cardápio, mesas, comandas, pagamentos,
garçons, estoque, dashboard e caixa. Cada tela resolveu o seu problema, mas a
interface acumulou estilos pontuais, componentes duplicados e uma identidade
visual clara demais para um produto de operação de salão, usado em ambientes
com pouca luz e em jornadas longas.

**Objetivo deste documento:** definir a linguagem visual única do SUITEGEST —
paleta, tipografia, sidebar, botões e componentes — para que todas as telas
pareçam parte do mesmo produto, sejam previsíveis para o operador e mantenham
acessibilidade e legibilidade.

**Resultado esperado:**

- Uma paleta escura, com fundo `#0d1117`, cards `#1f2937`, destaque `#fbbf24`
  e texto `#f9fafb`.
- Tipografia Inter (com Roboto como alternativa) e escala de títulos e corpo
  objetiva.
- Sidebar fixa com ícones e texto, item ativo com fundo amarelo.
- Botões com estados e variantes bem definidos: primário, secundário, perigo,
  desabilitado, além de foco, carregamento e ações destrutivas.
- Cards, badges, modais e tabelas com anatomia, medidas e estados comuns.
- Critérios de aceite verificáveis para implementação e revisão.

**Limite de escopo:** este bloco define a **casca visual e os componentes**.
Não redefine regras de negócio, não altera contratos de API, não implementa
tema claro, não cria identidade de marketing e não substitui a conferência
funcional de cada módulo.

## 2. Escopo

### 2.1 Dentro do escopo

- Tokens de cor, tipografia, espaçamento, raio, sombra e movimento.
- App shell com sidebar, topbar e área de conteúdo.
- Sidebar expandida, colapsada e em gaveta no mobile.
- Escala tipográfica e regras de uso.
- Botões: primário, secundário, perigo, desabilitado, fantasma e
  carregamento.
- Cards: base, indicador (KPI), interativo e de alerta.
- Badges de status.
- Modais e diálogos de confirmação.
- Tabelas de dados.
- Formulários e campos.
- Estados de carregamento, vazio, erro, sucesso e offline.
- Ícones, foco visível e navegação por teclado.
- Acessibilidade, responsividade e microcopy.
- Critérios de aceite e checklist de migração das telas existentes.

### 2.2 Fora do escopo

- Tema claro ou alternância de tema.
- Identidade visual de marketing, logotipo desenhado, papelaria ou site.
- Ilustrações, fotografias ou banco de imagens.
- Biblioteca de ícones de terceiros ou fonte externa em tempo de execução.
- Gráficos e visualização de dados avançada.
- Animações complexas, parallax ou efeitos 3D.
- Redesenho de fluxo de telas ou mudança de regra de negócio.
- Alteração de contratos de API, banco ou testes de backend.
- Conteúdo fiscal, contábil ou de adquirente.

## 3. Estado de partida e princípios

### 3.1 O que já existe

| Item | Situação atual |
| --- | --- |
| `frontend/styles.css` | Tema **claro**: fundo `#f8fafc`, superfície `#ffffff`, texto `#1e293b`, header `#1e293b`. |
| Navegação | Cabeçalho (`app-header`) e cards de módulo na página inicial; **não há sidebar**. |
| Tipografia | Pilha de sistema (`-apple-system`, `Segoe UI`, `Roboto`, `Helvetica`, `Arial`); Inter não é carregada. |
| Botões | `.submit-button` (escuro), `.release-button` (claro) e `.module-link`; não há variantes formais. |
| Cards | `.module-card`, `.table-card` e `.order-summary-item`, com estilos próprios. |
| Badges | `.badge`, `.table-status-*` e `.low-stock-badge`, cada um com regras próprias. |
| Modais | Existem na comanda (`add-item-modal`, `payment-modal`), com `role="dialog"` e `aria-modal`, mas sem comportamento completo de foco e `Esc`. |
| Tabelas | `.products-table` e `.order-table`, com estilos duplicados e sem componente comum. |
| Estados | Existem `.empty-state` e status de backend; não há skeleton, toast ou banner offline padronizados. |
| Marca | A interface usa “SuiteSimulaFuncoes”; este documento adota **SUITEGEST** como nome de exibição. |

### 3.2 Princípios de design

1. **Operação primeiro:** a tela existe para o operador trabalhar rápido, não
   para impressionar. Hierarquia clara vence enfeite.
2. **Escuro por padrão:** o produto roda em salão, balcão e caixa, muitas vezes
   à noite. O tema escuro reduz fadiga e melhora o contraste do conteúdo.
3. **Amarelo é ação:** o destaque `#fbbf24` marca o que importa — ação
   primária, item ativo, foco e indicador. Não é cor de fundo de página.
4. **Consistência acima de criatividade:** o mesmo problema visual usa o mesmo
   componente em todas as telas.
5. **Status nunca só por cor:** todo estado crítico tem rótulo textual, ícone
   ou ambos.
6. **Acessível por construção:** contraste, foco visível, teclado e leitor de
   tela fazem parte do componente, não são retrabalho.
7. **Nada de dependência externa em tempo de execução:** fonte e ícones são
   servidos pelo próprio projeto, para funcionar offline e em rede local.
8. **Não fiscal por identidade:** nenhum componente sugere nota fiscal, cupom
   fiscal, SEFAZ ou apuração tributária.

### 3.3 Marca e tom

- Nome de exibição: **SUITEGEST**, sempre em caixa alta no wordmark.
- Assinatura institucional: “Gestão não fiscal de estabelecimentos de
  alimentação”.
- Tom de voz: direto, operacional, sem humor e sem jargão técnico.
- Rótulos de interface em **sentence case** (“Abrir caixa”, “Fechar turno”),
  exceto o wordmark e os overlines de seção.
- Não usar “SuiteSimulaFuncoes” em telas novas; a troca de marca deve ser
  tratada como migração (seção 14).

## 4. Paleta de cores

### 4.1 Cores base obrigatórias

| Token | Valor | Uso principal |
| --- | --- | --- |
| `--color-bg` | `#0d1117` | Fundo da página, topbar e áreas vazias. |
| `--color-surface` | `#1f2937` | Cards, tabelas, modais e superfícies elevadas. |
| `--color-accent` | `#fbbf24` | Ação primária, item ativo da sidebar, foco e destaque. |
| `--color-text` | `#f9fafb` | Texto principal sobre fundo e superfícies escuras. |

Essas quatro cores são obrigatórias e não podem ser substituídas por
aproximações. As demais cores derivam delas.

### 4.2 Tokens complementares

| Token | Valor | Uso |
| --- | --- | --- |
| `--color-surface-2` | `#111827` | Sidebar, cabeçalho de tabela, rodapé e poços. |
| `--color-border` | `#374151` | Bordas de cards, tabelas, inputs e divisores. |
| `--color-border-strong` | `#4b5563` | Bordas em hover e separadores de ênfase. |
| `--color-text-muted` | `#9ca3af` | Texto secundário, labels, legendas e ícones inativos. |
| `--color-placeholder` | `#8b949e` | Placeholder de campos. |
| `--color-accent-hover` | `#f59e0b` | Hover de botão primário e item ativo. |
| `--color-accent-active` | `#d97706` | Pressionado de botão primário. |
| `--color-accent-ink` | `#0d1117` | Texto e ícone sobre fundo amarelo. |
| `--color-accent-soft` | `rgba(251, 191, 36, 0.12)` | Fundo suave de ícone, destaque e seleção. |
| `--color-success` | `#22c55e` | Indicador positivo. |
| `--color-success-text` | `#86efac` | Texto de sucesso sobre superfície escura. |
| `--color-success-bg` | `rgba(34, 197, 94, 0.12)` | Fundo de badge/alert de sucesso. |
| `--color-success-border` | `rgba(34, 197, 94, 0.40)` | Borda de badge/alert de sucesso. |
| `--color-warning` | `#fbbf24` | Indicador de atenção. |
| `--color-warning-text` | `#fcd34d` | Texto de atenção sobre superfície escura. |
| `--color-warning-bg` | `rgba(251, 191, 36, 0.12)` | Fundo de badge/alert de atenção. |
| `--color-warning-border` | `rgba(251, 191, 36, 0.40)` | Borda de badge/alert de atenção. |
| `--color-danger` | `#dc2626` | Ação destrutiva e erro. |
| `--color-danger-hover` | `#b91c1c` | Hover de ação destrutiva. |
| `--color-danger-active` | `#991b1b` | Pressionado de ação destrutiva. |
| `--color-danger-text` | `#fca5a5` | Texto de erro sobre superfície escura. |
| `--color-danger-bg` | `rgba(220, 38, 38, 0.14)` | Fundo de badge/alert de erro. |
| `--color-danger-border` | `rgba(220, 38, 38, 0.45)` | Borda de badge/alert de erro. |
| `--color-info` | `#38bdf8` | Informação e links. |
| `--color-info-text` | `#7dd3fc` | Texto informativo sobre superfície escura. |
| `--color-info-bg` | `rgba(56, 189, 248, 0.12)` | Fundo de badge/alert informativo. |
| `--color-info-border` | `rgba(56, 189, 248, 0.40)` | Borda de badge/alert informativo. |
| `--color-focus` | `#fbbf24` | Anel de foco padrão. |
| `--color-focus-on-accent` | `#fde68a` | Anel de foco sobre botão amarelo. |
| `--color-overlay` | `rgba(0, 0, 0, 0.65)` | Fundo de modal e gaveta. |
| `--color-shadow` | `rgba(0, 0, 0, 0.40)` | Cor base de sombras. |

### 4.3 Regras de uso

- **Amarelo nunca recebe texto branco.** Texto sobre `#fbbf24` é sempre
  `#0d1117`.
- **Amarelo não é fundo de página, card ou tabela inteira.** Ele é usado em
  ações, item ativo, foco, ícones e pequenos realces.
- **Vermelho é reservado para perigo e erro.** Não usar para “ocupado” sem
  rótulo, nem para decoração.
- **Verde é sucesso e disponibilidade.** Não usar como cor genérica de
  “positivo” em gráficos sem legenda.
- **Texto principal sobre superfície escura** usa `#f9fafb`; texto secundário
  usa `#9ca3af`.
- **Links e ações textuais** usam `#fbbf24` com sublinhado no hover; não usar
  azul de navegador.
- **Não criar cores novas por tela.** Qualquer necessidade nova passa por
  token e por este documento.
- **Não usar gradientes, vidro fosco, neon ou sombras coloridas.** A estética é
  sólida, plana e legível.
- **Estados nunca dependem só da cor:** badge e alerta sempre trazem texto.

### 4.4 Contraste mínimo (WCAG 2.1 AA)

| Combinação | Contraste aprox. | Situação |
| --- | --- | --- |
| `#f9fafb` sobre `#0d1117` | 18:1 | Aprovado para texto normal. |
| `#f9fafb` sobre `#1f2937` | 14:1 | Aprovado para texto normal. |
| `#9ca3af` sobre `#0d1117` | 7,5:1 | Aprovado para texto normal. |
| `#9ca3af` sobre `#1f2937` | 5,7:1 | Aprovado para texto normal. |
| `#fbbf24` sobre `#0d1117` | 11,3:1 | Aprovado para texto normal. |
| `#0d1117` sobre `#fbbf24` | 11,3:1 | Aprovado para texto normal. |
| `#ffffff` sobre `#dc2626` | 4,9:1 | Aprovado para texto normal. |
| `#ffffff` sobre `#b91c1c` | 6,7:1 | Aprovado para texto normal. |
| `#fca5a5` sobre `#1f2937` | 7,7:1 | Aprovado para texto normal. |
| `#86efac` sobre `#1f2937` | 10,4:1 | Aprovado para texto normal. |
| `#fcd34d` sobre `#1f2937` | 10,1:1 | Aprovado para texto normal. |

Regras:

- Texto normal exige **4,5:1**; texto grande (>= 24 px ou >= 19 px em negrito)
  exige **3:1**.
- Componentes de interface (bordas de input, ícones funcionais, foco) exigem
  **3:1** contra o fundo adjacente.
- Texto desabilitado é isento de contraste, mas deve continuar legível; usar
  `#9ca3af` sobre `#1f2937`.
- Placeholder não substitui label e usa `#8b949e`.
- Toda combinação nova deve ser medida antes de entrar no produto.

## 5. Tipografia

### 5.1 Família

| Ordem | Fonte | Uso |
| --- | --- | --- |
| 1 | **Inter** | Fonte principal de toda a interface. |
| 2 | **Roboto** | Alternativa quando Inter não estiver disponível. |
| 3 | Pilha de sistema | `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Helvetica`, `Arial`, `sans-serif`. |

Regras:

- Inter deve ser **servida pelo próprio projeto** (arquivo local), sem
  depender de CDN em tempo de execução.
- Pesos permitidos: **400, 500, 600 e 700**. Não usar 300 nem 800.
- Não usar fonte decorativa, serifada ou monoespaçada na interface geral.
- Monoespaçada (`ui-monospace`, `SFMono-Regular`, `Menlo`, `Consolas`) apenas
  para valores técnicos, atalhos e identificadores.
- Números monetários, quantidades e datas usam `font-variant-numeric:
  tabular-nums` para alinhar colunas.

### 5.2 Escala tipográfica

| Token | Tamanho / entrelinha | Peso | Uso |
| --- | --- | --- | --- |
| `--text-display` | 36 / 44 px | 700 | Número grande de destaque isolado. |
| `--text-h1` | 32 / 40 px | 700 | Título da página. |
| `--text-h2` | 24 / 32 px | 600 | Título de seção. |
| `--text-h3` | 20 / 28 px | 600 | Título de card, modal e subseção. |
| `--text-h4` | 16 / 24 px | 600 | Título de bloco pequeno. |
| `--text-body-lg` | 16 / 24 px | 400 | Texto de apoio e introdução. |
| `--text-body` | 14 / 20 px | 400 | Corpo padrão, tabelas e formulários. |
| `--text-label` | 14 / 20 px | 600 | Label de campo e botão. |
| `--text-caption` | 12 / 16 px | 500 | Legenda, ajuda e metadado. |
| `--text-overline` | 11 / 16 px | 600 | Rótulo de seção, `uppercase`, `letter-spacing: 0.06em`. |
| `--text-kpi` | 28 / 36 px | 700 | Valor de card indicador. |
| `--text-kpi-lg` | 36 / 44 px | 700 | Valor de KPI principal. |
| `--text-code` | 13 / 20 px | 400 | Valor técnico em monoespaçada. |

### 5.3 Regras de composição

- **Título de página:** sempre `--text-h1`; no máximo um por tela.
- **Títulos de seção:** `--text-h2`; não pular níveis de heading.
- **Corpo:** 14 px é o padrão do produto. Textos longos e explicativos usam
  16 px.
- **Nada abaixo de 12 px** na interface. Overline de 11 px é a única exceção e
  só para rótulo curto em caixa alta.
- **Largura de linha:** 60 a 75 caracteres em blocos de texto.
- **Entrelinha:** nunca menor que 1,4 no corpo.
- **Alinhamento:** texto à esquerda; valores monetários e quantidades à
  direita; títulos de tabela alinhados com o conteúdo da coluna.
- **Letter spacing:** `-0.01em` em títulos de 32 px ou mais; `0` no corpo;
  `0.06em` em overline.
- **Itálico** não é usado para ênfase; usar peso 600 ou cor de destaque.
- **Sublinhado** apenas em links e no hover de ações textuais.

## 6. Espaçamento, raio, sombra e movimento

### 6.1 Espaçamento

| Token | Valor | Uso |
| --- | --- | --- |
| `--space-1` | 4 px | Ajuste fino, ícone e texto. |
| `--space-2` | 8 px | Gap interno de badges e botões pequenos. |
| `--space-3` | 12 px | Gap de formulário e item de lista. |
| `--space-4` | 16 px | Padding padrão de célula e gap de grid. |
| `--space-5` | 24 px | Padding de card e seção. |
| `--space-6` | 32 px | Separação entre seções e padding de página. |
| `--space-7` | 48 px | Blocos de destaque e respiro de página. |
| `--space-8` | 64 px | Casos excepcionais de layout. |

- Padding de página: 32 px no desktop, 24 px no tablet e 16 px no mobile.
- Gap entre cards: 16 px.
- Gap entre seções: 32 px.
- Padding interno de card: 24 px; card compacto: 16 px.

### 6.2 Raio

| Token | Valor | Uso |
| --- | --- | --- |
| `--radius-sm` | 4 px | Código inline e detalhe pequeno. |
| `--radius-control` | 8 px | Botão, input, select e item de sidebar. |
| `--radius-card` | 12 px | Card, tabela e alerta. |
| `--radius-modal` | 16 px | Modal e gaveta. |
| `--radius-pill` | 999 px | Badge, avatar e contador. |

### 6.3 Sombra

| Token | Valor | Uso |
| --- | --- | --- |
| `--shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.35)` | Card estático e topbar. |
| `--shadow-md` | `0 4px 12px rgba(0, 0, 0, 0.35)` | Card interativo em hover. |
| `--shadow-lg` | `0 16px 40px rgba(0, 0, 0, 0.45)` | Modal, gaveta e menu flutuante. |

- No tema escuro, a separação principal vem de **borda + superfície**, não de
  sombra.
- Não usar sombra colorida, brilho ou `box-shadow` pesada em elementos
  estáticos.

### 6.4 Movimento

| Token | Valor | Uso |
| --- | --- | --- |
| `--motion-fast` | 120 ms | Hover, foco e cor. |
| `--motion-base` | 180 ms | Modal, gaveta e expansão. |
| `--motion-slow` | 240 ms | Transição de página excepcional. |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Curva padrão. |

- Animar apenas `opacity`, `transform`, `background-color`, `border-color` e
  `box-shadow`.
- Não animar layout, largura, altura ou posição de conteúdo principal.
- Com `prefers-reduced-motion: reduce`, reduzir animações a 0,01 ms e remover
  deslocamentos.

## 7. Layout e app shell

### 7.1 Estrutura

```text
┌────────────────────────────────────────────────────────────────────┐
│ Sidebar            │ Topbar (64 px)                                │
│ 240 px             ├───────────────────────────────────────────────┤
│                    │                                               │
│  SUITEGEST         │  Conteúdo da página                           │
│                    │  padding 32 px                                │
│  Operação          │  largura máxima 1280 px                       │
│  • Mesas           │                                               │
│  • Cardápio        │  ┌─────────────┐ ┌─────────────┐              │
│  • Caixa           │  │ Card        │ │ Card        │              │
│                    │  └─────────────┘ └─────────────┘              │
│  Gestão            │                                               │
│  • Dashboard       │  ┌─────────────────────────────────────────┐  │
│  • Relatórios      │  │ Tabela                                  │  │
│  • Estoque         │  └─────────────────────────────────────────┘  │
│  • Funcionários    │                                               │
│                    │                                               │
│  ● Online          │                                               │
└────────────────────┴───────────────────────────────────────────────┘
```

- Sidebar fixa à esquerda; conteúdo com margem esquerda igual à largura dela.
- Topbar fixa no topo da área de conteúdo, com 64 px de altura.
- Conteúdo em coluna única, com largura máxima de 1280 px e padding de 32 px.
- Rodapé discreto com a assinatura não fiscal, quando a página precisar.
- Não usar layout de duas colunas com sidebar à direita.

### 7.2 Sidebar expandida (>= 1024 px)

| Propriedade | Valor |
| --- | --- |
| Largura | 240 px |
| Fundo | `#111827` (`--color-surface-2`) |
| Borda direita | 1 px `#1f2937` |
| Padding | 16 px 12 px |
| Altura | 100 vh, fixa |
| Comportamento | Independente do scroll do conteúdo |

**Anatomia:**

1. **Marca:** wordmark “SUITEGEST” em 18 px, peso 700, `#f9fafb`, com um
   quadrado ou ponto de 8 px em `#fbbf24` antes do texto. Altura do bloco:
   56 px.
2. **Grupos de navegação:** rótulo overline de 11 px, `#9ca3af`, caixa alta,
   `letter-spacing: 0.06em`, margem superior de 24 px.
3. **Itens:** altura de 44 px, padding de 10 px 12 px, ícone de 20 px + texto
   de 14 px/500, gap de 12 px, raio de 8 px.
4. **Item padrão:** texto e ícone em `#9ca3af`; fundo transparente.
5. **Item em hover:** fundo `#1f2937`, texto e ícone em `#f9fafb`.
6. **Item ativo:** fundo `#fbbf24`, texto e ícone em `#0d1117`, peso 600,
   `aria-current="page"`. O amarelo ocupa o item inteiro, com raio de 8 px.
7. **Foco:** anel de 2 px `#fbbf24` com offset de 2 px; no item ativo, anel
   `#fde68a`.
8. **Contador opcional:** badge à direita; no item ativo, fundo `#0d1117` e
   texto `#fbbf24`.
9. **Rodapé:** status do serviço com ponto verde/vermelho e versão do produto
   em 12 px `#9ca3af`.

**Grupos e itens:**

| Grupo | Item | Ícone | Destino |
| --- | --- | --- | --- |
| — | Início | casa | `index.html` |
| Operação | Mesas | mesa | `mesas.html` |
| Operação | Cardápio | livro/cardápio | `cardapio.html` |
| Operação | Caixa | gaveta/carteira | `caixa.html` |
| Gestão | Dashboard | gráfico | `dashboard.html` |
| Gestão | Relatórios | documento | `relatorios.html` |
| Gestão | Estoque | caixa | `estoque.html` |
| Gestão | Funcionários | pessoas | `funcionarios.html` |
| — | Meu painel | usuário | `meu-painel.html` |

- “Comanda” não entra na sidebar: é uma tela filha de Mesas.
- A ordem dos itens é fixa; não reordenar por permissão ou por uso.
- O item da página atual fica ativo, e somente ele.

### 7.3 Sidebar colapsada (768–1023 px)

| Propriedade | Valor |
| --- | --- |
| Largura | 72 px |
| Conteúdo | Apenas ícones de 24 px, centralizados. |
| Rótulos | Visualmente ocultos, disponíveis para leitor de tela e em tooltip. |
| Item | 48 px x 48 px, raio de 8 px, centralizado. |
| Ativo | Fundo `#fbbf24`, ícone `#0d1117`. |
| Tooltip | Texto em fundo `#1f2937`, borda `#374151`, 12 px, aparece no hover e no foco. |
| Grupos | Sem rótulo visível; separados por divisor de 1 px. |

- O tooltip não pode ser o único rótulo acessível: cada item mantém
  `aria-label` ou texto oculto.
- O botão de expandir/colapsar fica no topo da sidebar e tem `aria-expanded`.

### 7.4 Sidebar em gaveta (< 768 px)

| Propriedade | Valor |
| --- | --- |
| Largura | 280 px |
| Abertura | Botão hambúrguer na topbar, com `aria-expanded` e `aria-controls`. |
| Fundo | `#111827` |
| Sobreposição | `rgba(0, 0, 0, 0.65)` |
| Fechamento | Botão “X”, clique na sobreposição, `Esc` ou seleção de item. |
| Foco | Preso dentro da gaveta enquanto aberta; devolvido ao hambúrguer ao fechar. |
| Scroll | Bloqueado no `body` enquanto aberta. |
| Item ativo | Fundo `#fbbf24`, texto `#0d1117`. |

- A gaveta entra com `transform: translateX(-100%)` para `0` em 180 ms.
- A topbar mobile tem 56 px e mantém o título da página truncado com
  reticências.

### 7.5 Topbar

| Propriedade | Valor |
| --- | --- |
| Altura | 64 px no desktop; 56 px no mobile. |
| Fundo | `#0d1117` com borda inferior de 1 px `#1f2937`. |
| Conteúdo à esquerda | Título da página ou breadcrumb curto. |
| Conteúdo à direita | Ações contextuais, status e menu do usuário. |
| Comportamento | Fixa no topo da área de conteúdo. |

- Não duplicar o título da página no conteúdo e na topbar.
- Breadcrumb máximo de dois níveis: “Mesas / Comanda 12”.
- Ações da topbar usam botões secundários ou fantasma, nunca dois primários.

### 7.6 Grid e breakpoints

| Faixa | Largura | Sidebar | Padding da página | Colunas de card |
| --- | --- | --- | --- | --- |
| Mobile | < 640 px | Gaveta | 16 px | 1 |
| Mobile grande | 640–767 px | Gaveta | 16 px | 1 ou 2 |
| Tablet | 768–1023 px | Colapsada (72 px) | 24 px | 2 |
| Desktop | 1024–1279 px | Expandida (240 px) | 32 px | 2 ou 3 |
| Desktop largo | >= 1280 px | Expandida (240 px) | 32 px | 3 ou 4 |

- Grid de cards: `repeat(auto-fit, minmax(220px, 1fr))`, gap de 16 px.
- Grid de formulário: `repeat(auto-fit, minmax(200px, 1fr))`, gap de 16 px.
- Conteúdo principal nunca ultrapassa 1280 px.
- Em 360 px de largura, não pode haver rolagem horizontal da página; apenas
  dentro de tabelas.

## 8. Componentes

### 8.1 Botões

**Anatomia:** altura mínima, padding horizontal, raio de 8 px, texto de 14 px
peso 600, ícone opcional de 16 px ou 20 px, gap de 8 px. Ícone sempre
`currentColor`.

**Variantes:**

| Variante | Fundo | Texto | Borda | Hover | Pressionado | Foco | Uso |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Primário | `#fbbf24` | `#0d1117` | nenhuma | `#f59e0b` | `#d97706` | anel `#fde68a` | Ação principal da tela ou do modal. |
| Secundário | transparente | `#f9fafb` | 1 px `#374151` | fundo `#1f2937` | fundo `#111827` | anel `#fbbf24` | Ação alternativa, cancelar, voltar. |
| Perigo | `#dc2626` | `#ffffff` | nenhuma | `#b91c1c` | `#991b1b` | anel `#fca5a5` | Excluir, fechar turno com diferença, ação irreversível. |
| Fantasma | transparente | `#9ca3af` | nenhuma | fundo `#1f2937`, texto `#f9fafb` | fundo `#111827` | anel `#fbbf24` | Ação terciária e ícone de linha. |
| Desabilitado | `#1f2937` | `#9ca3af` | 1 px `#374151` | igual | igual | nenhum | Ação indisponível. |

**Tamanhos:**

| Tamanho | Altura | Padding | Texto | Uso |
| --- | --- | --- | --- | --- |
| Pequeno | 32 px | 6 px 12 px | 13 px | Ação dentro de tabela e card compacto. |
| Médio | 40 px | 10 px 16 px | 14 px | Padrão do produto. |
| Grande | 48 px | 12 px 24 px | 16 px | Abertura de caixa e ação de destaque. |
| Ícone | 40 px x 40 px | — | — | Ação compacta com `aria-label`. |

**Regras:**

- **Um único botão primário por contexto** (tela, modal ou seção de ações).
- **Perigo nunca é o botão padrão** de um formulário; exige confirmação.
- **Desabilitado** usa o atributo `disabled` e, quando necessário,
  `aria-disabled="true"`; não apenas opacidade.
- **Carregamento:** mantém a largura, mostra spinner de 16 px e texto
  “Salvando…”, com `aria-busy="true"`; fica desabilitado durante a requisição.
- **Foco visível:** anel de 2 px com offset de 2 px; nunca remover sem
  substituto.
- **Toque:** alvo mínimo de 44 px x 44 px no mobile, mesmo para botão pequeno.
- **Não usar botão como link.** Navegação usa `<a>` com aparência de botão
  quando necessário.
- **Não empilhar dois botões primários** lado a lado.
- **Texto do botão é verbo no infinitivo:** “Abrir caixa”, “Registrar sangria”,
  “Fechar turno”.

**Estados obrigatórios por variante:**

| Estado | Primário | Secundário | Perigo | Desabilitado |
| --- | --- | --- | --- | --- |
| Repouso | Sim | Sim | Sim | Sim |
| Hover | Sim | Sim | Sim | Não se aplica |
| Foco por teclado | Sim | Sim | Sim | Não se aplica |
| Pressionado | Sim | Sim | Sim | Não se aplica |
| Carregando | Sim | Sim | Sim | Não se aplica |
| Desabilitado | Sim | Sim | Sim | Sim |

### 8.2 Cards

**Card base:**

| Propriedade | Valor |
| --- | --- |
| Fundo | `#1f2937` |
| Borda | 1 px `#374151` |
| Raio | 12 px |
| Padding | 24 px |
| Sombra | `--shadow-sm` |
| Título | 16 px/600, `#f9fafb` |
| Texto | 14 px/400, `#9ca3af` |
| Gap interno | 8 px a 12 px |

**Variantes:**

| Variante | Aparência | Uso |
| --- | --- | --- |
| Base | Card padrão, sem hover. | Agrupar conteúdo estático. |
| Indicador (KPI) | Overline + valor grande + variação + ícone em `--color-accent-soft`. | Total vendido, ticket médio, comandas, saldo esperado. |
| Interativo | Card clicável com hover de borda `#fbbf24` e sombra média. | Atalho de módulo, mesa, produto. |
| Alerta | Borda esquerda de 4 px na cor semântica + ícone + título + ação. | Estoque baixo, caixa aberto, erro de integração. |

**Card indicador:**

```text
┌────────────────────────────────┐
│ VENDAS NO TURNO          [◔]   │
│                                │
│ R$ 1.250,00                    │
│ +12% vs. turno anterior        │
└────────────────────────────────┘
```

- Overline: 11 px/600, `#9ca3af`, caixa alta.
- Valor: 28 px/700 ou 36 px/700, `#f9fafb`, `tabular-nums`.
- Variação: badge de 12 px; positiva em verde, negativa em vermelho, neutra em
  cinza.
- Ícone: 40 px x 40 px, fundo `--color-accent-soft`, ícone `#fbbf24`.
- O card inteiro pode ser link; nesse caso, o foco acompanha o card e o nome
  acessível é o título + valor.

**Regras:**

- Card estático não tem hover nem cursor de clique.
- Card interativo tem hover, foco visível e alvo de clique em toda a área.
- Não usar mais de um estilo de card na mesma grade.
- Não usar card como container de página inteira.
- Não aninhar cards dentro de cards sem necessidade.

### 8.3 Badges

**Anatomia:** pill de raio 999 px, padding de 4 px 10 px, texto de 12 px/600
em caixa alta, `letter-spacing: 0.04em`, ícone ou ponto opcional de 6 px.
Sempre com texto; cor nunca é o único indicador.

| Variante | Fundo | Texto | Borda | Uso |
| --- | --- | --- | --- | --- |
| Neutro | `#374151` | `#f9fafb` | `#4b5563` | Estado sem ênfase, fechado, arquivado. |
| Sucesso | `rgba(34, 197, 94, 0.12)` | `#86efac` | `rgba(34, 197, 94, 0.40)` | Livre, pago, exato, online. |
| Atenção | `rgba(251, 191, 36, 0.12)` | `#fcd34d` | `rgba(251, 191, 36, 0.40)` | Reservada, pendente, sobra, estoque mínimo. |
| Perigo | `rgba(220, 38, 38, 0.14)` | `#fca5a5` | `rgba(220, 38, 38, 0.45)` | Ocupada, falta, erro, cancelado. |
| Informação | `rgba(56, 189, 248, 0.12)` | `#7dd3fc` | `rgba(56, 189, 248, 0.40)` | Informativo, em preparo, dica. |

**Mapa de status do produto:**

| Contexto | Valor | Variante | Rótulo |
| --- | --- | --- | --- |
| Mesa | livre | Sucesso | Livre |
| Mesa | ocupada | Perigo | Ocupada |
| Mesa | reservada | Atenção | Reservada |
| Mesa | fechada | Neutro | Fechada |
| Caixa | open | Sucesso | Aberto |
| Caixa | closed | Neutro | Fechado |
| Estoque | abaixo do mínimo | Perigo | Estoque baixo |
| Pagamento | pago | Sucesso | Pago |
| Pagamento | pendente | Atenção | Pendente |
| Fechamento | exact | Sucesso | Exato |
| Fechamento | overage | Atenção | Sobra |
| Fechamento | shortage | Perigo | Falta |
| Serviço | online | Sucesso | Online |
| Serviço | offline | Perigo | Offline |
| Serviço | verificando | Atenção | Verificando |

- Badge não é botão. Se precisar ser clicável, usar botão com aparência de
  badge e foco visível.
- Badge de contagem usa apenas número e `aria-label` com o total por extenso.
- Não usar badge para frases longas; máximo de 24 caracteres.

### 8.4 Modais

**Anatomia:**

```text
┌──────────────────────────────────────────────────┐
│ Título do modal                              [X] │
│ Texto de apoio opcional                          │
│                                                  │
│ Label                                            │
│ [ Campo                                      ]   │
│ Texto de ajuda ou erro                           │
│                                                  │
│ [ Cancelar ]                    [ Ação primária ]│
└──────────────────────────────────────────────────┘
```

| Propriedade | Valor |
| --- | --- |
| Sobreposição | `rgba(0, 0, 0, 0.65)` |
| Container | `#1f2937`, borda `#374151`, raio 16 px, sombra `--shadow-lg` |
| Largura | 400 px (confirmação), 560 px (formulário), 800 px (conteúdo) |
| Padding | 24 px |
| Título | 20 px/600, `#f9fafb` |
| Texto de apoio | 14 px/400, `#9ca3af` |
| Rodapé | Ações alinhadas à direita; primária por último |
| Botão fechar | 40 px x 40 px, fantasma, `aria-label="Fechar"` |

**Comportamento obrigatório:**

- `role="dialog"` e `aria-modal="true"`.
- `aria-labelledby` aponta para o título; `aria-describedby` para o texto de
  apoio, quando existir.
- Foco inicial no primeiro campo ou no botão de ação; nunca no `body`.
- Foco preso dentro do modal enquanto aberto.
- `Esc` fecha, exceto quando houver operação em andamento.
- Clique na sobreposição fecha apenas modais não destrutivos.
- Ao fechar, o foco volta ao elemento que abriu o modal.
- Scroll do `body` bloqueado enquanto o modal está aberto.
- Apenas um modal por vez; não abrir modal sobre modal.
- Ação destrutiva usa botão de perigo e pede confirmação explícita.
- Durante o envio, o botão primário entra em carregamento e os demais ficam
  desabilitados.
- No mobile, o modal vira folha inferior: largura total, raio superior de
  16 px, altura máxima de 90 vh e rolagem interna.

**Diálogo de confirmação:**

- Título curto e direto: “Fechar caixa com diferença?”
- Corpo explica a consequência em uma ou duas frases.
- Ação de confirmação repete o verbo: “Fechar caixa”.
- Ação de cancelar vem antes, à esquerda da confirmação.
- Nunca usar “OK” e “Cancelar” genéricos.

### 8.5 Tabelas

**Anatomia:**

| Propriedade | Valor |
| --- | --- |
| Container | Fundo `#1f2937`, borda 1 px `#374151`, raio 12 px, `overflow-x: auto` |
| Tabela | Largura 100%, `border-collapse: collapse`, largura mínima de 640 px |
| Cabeçalho | Fundo `#111827`, texto 12 px/600, `#9ca3af`, caixa alta, `letter-spacing: 0.04em` |
| Célula | Padding 14 px 16 px, texto 14 px/400, `#f9fafb`, borda inferior `#374151` |
| Última linha | Sem borda inferior |
| Hover de linha | Fundo `#111827` ou `rgba(255, 255, 255, 0.02)` |
| Valores | Alinhados à direita, `tabular-nums` |
| Ações | Última coluna, alinhadas à direita, botões de ícone com `aria-label` |
| Densidade | Confortável: 48 px por linha; compacta: 40 px |

**Regras:**

- `<caption>` ou título visível acima da tabela descreve o conteúdo.
- `th` com `scope="col"`; primeira coluna de identificação com `scope="row"`
  quando fizer sentido.
- Cabeçalho fixo (`position: sticky`) em listas com mais de 15 linhas.
- Ordenação indicada por ícone e `aria-sort`; o cabeçalho é um botão.
- Não usar apenas cor para indicar linha selecionada; incluir ícone ou texto.
- Coluna de ações nunca fica oculta no mobile; a tabela rola horizontalmente.
- Em telas menores que 640 px, exibir dica visual de rolagem (“Deslize para
  ver mais”) ou queda para cards, quando a tabela tiver poucas colunas.
- Estados de tabela:
  - **Carregando:** 3 a 5 linhas skeleton com `aria-busy`.
  - **Vazio:** ícone, título, explicação e ação primária.
  - **Erro:** ícone, mensagem e botão “Tentar novamente”.
- Paginação, quando existir, fica no rodapé do container, com “Anterior”,
  “Próxima” e contador “Página 1 de 4”.

### 8.6 Formulários

| Elemento | Especificação |
| --- | --- |
| Label | 14 px/600, `#f9fafb`, acima do campo, sempre visível. |
| Obrigatório | Texto “obrigatório” para leitor de tela ou asterisco com legenda. |
| Input | Fundo `#0d1117`, borda 1 px `#374151`, raio 8 px, altura 40 px, padding 10 px 12 px. |
| Texto do input | 14 px/400, `#f9fafb`. |
| Placeholder | `#8b949e`; nunca substitui label. |
| Foco | Borda `#fbbf24` + anel de 3 px `rgba(251, 191, 36, 0.35)`. |
| Erro | Borda `#dc2626`, mensagem 12 px `#fca5a5` com ícone. |
| Ajuda | 12 px/400, `#9ca3af`, abaixo do campo. |
| Desabilitado | Fundo `#1f2937`, texto `#9ca3af`, cursor `not-allowed`. |
| Select | Mesma aparência do input, com seta nativa ou ícone de 16 px. |
| Checkbox/radio | `accent-color: #fbbf24`, alvo de 44 px, label clicável. |
| Moeda | Alinhamento à direita, `tabular-nums`, máscara BRL. |
| Busca | Ícone de lupa à esquerda e botão limpar quando houver texto. |

**Regras:**

- Validação no `blur` e no envio; não validar a cada tecla.
- Mensagem de erro específica: “Informe um valor maior ou igual a zero.”
- `aria-invalid="true"` e `aria-describedby` ligando campo, ajuda e erro.
- Resumo de erros no topo do formulário quando houver mais de um.
- Não usar `prompt`, `alert` ou `confirm` do navegador.
- Não desabilitar o botão de envio por validação; validar ao enviar e mostrar
  o erro.
- Ordem de tabulação segue a ordem visual.
- Campos relacionados ficam no mesmo grupo com `fieldset` e `legend` quando
  necessário.

### 8.7 Estados de tela

| Estado | Aparência | Comportamento |
| --- | --- | --- |
| Carregando | Skeleton de card/linha ou spinner central. | `aria-busy="true"`; não mostrar conteúdo parcial. |
| Vazio | Ícone de 32 px, título 16 px/600, texto 14 px `#9ca3af`, ação primária opcional. | Explicar o que fazer, não apenas “Nada aqui”. |
| Erro | Ícone de alerta, título, mensagem curta e “Tentar novamente”. | Mensagem sem jargão; manter o contexto da tela. |
| Sucesso | Toast no canto inferior direito (desktop) ou topo (mobile), 4 s. | `aria-live="polite"`, botão de fechar, não bloqueia a tela. |
| Erro de ação | Toast `role="alert"` ou mensagem inline no formulário. | Permanece até o usuário fechar ou corrigir. |
| Offline | Banner fixo no topo do conteúdo, fundo `--color-danger-bg`, texto `#fca5a5`. | Informar que os dados podem estar desatualizados. |

- Skeleton usa `#1f2937` com brilho sutil; com movimento reduzido, fica
  estático.
- Nunca usar tela em branco durante o carregamento.
- Nunca apagar o formulário antes da confirmação do servidor.

### 8.8 Ícones

- Ícones em SVG inline, 16 px, 20 px ou 24 px, traço de 1,75 px,
  `stroke="currentColor"`, `fill="none"`.
- Não usar emoji como ícone de interface.
- Não carregar biblioteca de ícones por CDN.
- Ícone decorativo: `aria-hidden="true"` e `focusable="false"`.
- Ícone funcional sem texto: `aria-label` no botão e tooltip visual.
- Ícone nunca é o único indicador de status; acompanha texto ou badge.
- Ícones da sidebar: 20 px expandida e 24 px colapsada.

## 9. Acessibilidade

- Meta: **WCAG 2.1 nível AA**.
- Contraste conforme a seção 4.4.
- Toda função disponível por mouse deve funcionar por teclado.
- Foco visível em todos os elementos interativos, com anel de 2 px e offset de
  2 px.
- Não remover `outline` sem substituto visível.
- Ordem de headings: um `h1` por página, sem pular níveis.
- Landmarks: `header`, `nav`, `main` e `footer`; sidebar é `nav` com
  `aria-label="Navegação principal"`.
- Link “Pular para o conteúdo” como primeiro elemento focável.
- Item ativo da navegação com `aria-current="page"`.
- Modais com foco preso, `Esc` e retorno de foco.
- Tabelas com `caption`, `th scope` e `aria-sort` quando ordenáveis.
- Formulários com label associado, `aria-invalid` e `aria-describedby`.
- Mensagens dinâmicas em região `aria-live` (`polite` para sucesso,
  `assertive` para erro crítico).
- Imagens com `alt`; imagens decorativas com `alt=""`.
- Não usar texto dentro de imagem para informação essencial.
- Suportar zoom de 200% sem perda de conteúdo ou sobreposição.
- Alvos de toque de 44 px x 44 px no mobile.
- Respeitar `prefers-reduced-motion`.
- Idioma da página: `lang="pt-BR"`.
- Não usar cor como único meio de transmitir informação.

## 10. Responsividade

- Testar em 360, 390, 768, 1024, 1280 e 1440 px de largura.
- Em 360 px, a página não pode ter rolagem horizontal; apenas a tabela pode
  rolar dentro do próprio container.
- Sidebar: expandida >= 1024 px; colapsada de 768 a 1023 px; gaveta < 768 px.
- Cards empilham em uma coluna abaixo de 640 px.
- Formulários passam para uma coluna abaixo de 640 px.
- Botões primários de formulário ocupam a largura total no mobile.
- Modais viram folha inferior no mobile.
- Topbar reduz para 56 px e o título é truncado.
- Tabelas mantêm largura mínima e rolam horizontalmente com dica visual.
- Nenhum conteúdo essencial é escondido no mobile; se não couber, rola.
- Áreas de toque não ficam sobrepostas.
- Texto não é cortado com `overflow: hidden` sem reticências e título
  acessível.

## 11. Conteúdo e microcopy

- Idioma: português do Brasil.
- Rótulos de botão: verbo no infinitivo, sentence case.
- Títulos de página: substantivo curto (“Caixa”, “Dashboard”, “Estoque”).
- Mensagens de erro: o que aconteceu + o que fazer.
  - Bom: “Não foi possível abrir o caixa. Verifique se já existe um turno
    aberto.”
  - Ruim: “Erro 409.”
- Mensagens de vazio: explicam o próximo passo.
  - Bom: “Nenhuma sangria ou suprimento registrado. Use os botões acima para
    lançar uma movimentação.”
- Valores monetários: `R$ 1.234,56`, com vírgula decimal e duas casas.
- Datas: `dd/mm/aaaa`; data e hora: `dd/mm/aaaa hh:mm`.
- Percentuais: `12,5%`.
- Quantidades: separador de milhar do pt-BR.
- Não usar “OK”, “Submit”, “Salvar alterações” genérico quando houver verbo
  melhor.
- Não usar termos fiscais, contábeis ou de adquirente.
- Rodapé institucional: “SUITEGEST — Gestão não fiscal de estabelecimentos de
  alimentação”.

## 12. Wireframes textuais

Os símbolos usados nos wireframes são apenas placeholders de layout. Na
implementação, todo ícone é SVG inline de 16, 20 ou 24 px, conforme a seção
8.8; nenhum símbolo Unicode ou emoji é usado como ícone de interface.

### 12.1 App shell desktop

```text
┌──────────────────────────────────────────────────────────────────────┐
│ ■ SUITEGEST          │ Dashboard                    [Atualizar]      │
│                      ├───────────────────────────────────────────────┤
│ OPERAÇÃO             │ Indicadores do turno                          │
│ ▸ Mesas              │ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│ ▸ Cardápio           │ │ VENDAS     │ │ TICKET     │ │ COMANDAS   │  │
│ █ Caixa              │ │ R$ 1.250   │ │ R$ 62,50   │ │ 20         │  │
│                      │ └────────────┘ └────────────┘ └────────────┘  │
│ GESTÃO               │                                               │
│ ▸ Dashboard          │ Últimas comandas                              │
│ ▸ Relatórios         │ ┌───────────────────────────────────────────┐ │
│ ▸ Estoque            │ │ Mesa │ Total │ Status │ Horário          │ │
│ ▸ Funcionários       │ ├──────┼───────┼────────┼──────────────────┤ │
│                      │ │ 12   │ 120,00│ Pago   │ 20:14            │ │
│ ● Online             │ └──────┴───────┴────────┴──────────────────┘ │
└──────────────────────┴───────────────────────────────────────────────┘
```

### 12.2 Sidebar colapsada

```text
┌────────┐
│   ■    │
│        │
│  ⌂     │
│  ▤     │
│  ▣     │
│  ◈     │
│        │
│  ▥     │
│  ▦     │
│  ◫     │
│  ☺     │
│        │
│  ●     │
└────────┘
```

### 12.3 Sidebar mobile em gaveta

```text
┌──────────────────────────┐
│ ■ SUITEGEST          [X] │
│                          │
│ OPERAÇÃO                 │
│ ⌂ Início                 │
│ ▤ Mesas                  │
│ ▣ Cardápio               │
│ █ Caixa                  │
│                          │
│ GESTÃO                   │
│ ◈ Dashboard              │
│ ▥ Relatórios             │
│ ▦ Estoque                │
│ ☺ Funcionários           │
└──────────────────────────┘
```

### 12.4 Botões

```text
[ Abrir caixa ]      primário: fundo amarelo, texto escuro
[ Cancelar ]         secundário: borda cinza, fundo transparente
[ Excluir ]          perigo: fundo vermelho, texto branco
[ Salvando… ]        carregando: spinner + texto, desabilitado
[ Indisponível ]     desabilitado: fundo escuro, texto cinza
```

### 12.5 Card indicador

```text
┌──────────────────────────────────┐
│ SALDO ESPERADO             [◔]   │
│                                  │
│ R$ 370,00                        │
│ Turno aberto às 10:00            │
└──────────────────────────────────┘
```

### 12.6 Badges

```text
( Livre )      verde
( Ocupada )    vermelho
( Reservada )  amarelo
( Fechada )    cinza
( Estoque baixo ) vermelho
```

### 12.7 Modal

```text
┌──────────────────────────────────────────────────┐
│ Registrar sangria                            [X] │
│ Informe o valor retirado da gaveta.              │
│                                                  │
│ Valor (R$) *                                     │
│ [ R$ 0,00                                      ] │
│                                                  │
│ Motivo *                                         │
│ [ Retirada para troco                          ] │
│                                                  │
│ [ Cancelar ]                    [ Registrar ]    │
└──────────────────────────────────────────────────┘
```

### 12.8 Tabela

```text
┌──────────────────────────────────────────────────────────────┐
│ Movimentações                                                │
│ ┌────────────┬────────────────────────┬────────────────────┐ │
│ │ TIPO       │ DESCRIÇÃO              │ VALOR              │ │
│ ├────────────┼────────────────────────┼────────────────────┤ │
│ │ Sangria    │ Retirada para troco    │       R$ 30,00     │ │
│ │ Suprimento │ Reforço de caixa       │       R$ 50,00     │ │
│ └────────────┴────────────────────────┴────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 12.9 Estado vazio

```text
┌──────────────────────────────────────────────────┐
│                    [ ícone ]                     │
│           Nenhuma movimentação                   │
│  Use os botões acima para registrar sangria ou   │
│  suprimento neste turno.                         │
│                                                  │
│              [ Registrar sangria ]               │
└──────────────────────────────────────────────────┘
```

## 13. Critérios de aceite

### 13.1 Tokens e paleta

- **AC-UI-01.** O fundo da aplicação usa `#0d1117`; cards, tabelas e modais
  usam `#1f2937`; o destaque usa `#fbbf24`; o texto principal usa `#f9fafb`.
- **AC-UI-02.** Todos os tokens da seção 4 existem como variáveis globais e são
  a única fonte de cor dos componentes.
- **AC-UI-03.** Texto sobre `#fbbf24` é sempre `#0d1117`; nenhum texto branco
  aparece sobre amarelo.
- **AC-UI-04.** As combinações de texto e fundo atendem a 4,5:1 para texto
  normal e 3:1 para texto grande e componentes.
- **AC-UI-05.** Não há cores hexadecimais soltas em componentes; novos usos
  passam por token.
- **AC-UI-06.** Amarelo não é usado como fundo de página, card inteiro ou
  tabela inteira.

### 13.2 Tipografia

- **AC-UI-07.** A interface usa Inter como fonte principal e Roboto como
  alternativa, com fallback de sistema.
- **AC-UI-08.** A fonte é servida pelo próprio projeto e a interface funciona
  offline sem requisição a CDN.
- **AC-UI-09.** A escala da seção 5.2 é aplicada: `h1` 32 px, `h2` 24 px,
  `h3` 20 px, corpo 14 px e legenda 12 px.
- **AC-UI-10.** Nenhum texto de interface fica abaixo de 12 px.
- **AC-UI-11.** Valores monetários, quantidades e datas usam `tabular-nums` e
  alinhamento adequado.
- **AC-UI-12.** Há apenas um `h1` por página e a hierarquia de headings não
  pula níveis.

### 13.3 Sidebar e layout

- **AC-UI-13.** Em telas com 1024 px ou mais, a sidebar tem 240 px, ícones de
  20 px e texto visível em todos os itens.
- **AC-UI-14.** O item ativo da sidebar tem fundo `#fbbf24`, texto e ícone
  `#0d1117`, peso 600 e `aria-current="page"`.
- **AC-UI-15.** Itens inativos usam `#9ca3af` e têm hover com fundo `#1f2937`
  e texto `#f9fafb`.
- **AC-UI-16.** Entre 768 e 1023 px, a sidebar colapsa para 72 px, mostra
  apenas ícones e mantém rótulo acessível e tooltip.
- **AC-UI-17.** Abaixo de 768 px, a navegação vira gaveta de 280 px com
  sobreposição, fechamento por `Esc`, clique fora e botão “X”.
- **AC-UI-18.** A gaveta prende o foco, bloqueia o scroll do `body` e devolve o
  foco ao botão hambúrguer ao fechar.
- **AC-UI-19.** Todas as páginas usam o mesmo app shell: sidebar, topbar de
  64 px e conteúdo com padding de 32 px no desktop.
- **AC-UI-20.** Em 360 px de largura, a página não tem rolagem horizontal;
  apenas tabelas rolam dentro do próprio container.

### 13.4 Botões

- **AC-UI-21.** Existem as variantes primário, secundário, perigo, fantasma e
  desabilitado, com as cores e estados da seção 8.1.
- **AC-UI-22.** Cada tela ou modal tem no máximo um botão primário.
- **AC-UI-23.** Botões têm estados de repouso, hover, foco por teclado,
  pressionado e carregando.
- **AC-UI-24.** O botão desabilitado usa `disabled` e não responde a clique,
  hover ou foco.
- **AC-UI-25.** O botão em carregamento mantém a largura, mostra spinner,
  define `aria-busy="true"` e impede envio duplicado.
- **AC-UI-26.** Ações destrutivas usam a variante perigo e exigem confirmação
  em modal.
- **AC-UI-27.** Alvos de toque têm no mínimo 44 px x 44 px no mobile.
- **AC-UI-28.** Navegação usa `<a>` e ação usa `<button>`; não há botão
  navegando nem link executando ação.

### 13.5 Componentes

- **AC-UI-29.** Cards base, indicador, interativo e de alerta seguem a
  anatomia e as medidas da seção 8.2.
- **AC-UI-30.** Cards estáticos não têm hover; cards interativos têm hover,
  foco visível e nome acessível.
- **AC-UI-31.** Badges usam as cinco variantes e sempre trazem texto; nenhum
  status depende apenas de cor.
- **AC-UI-32.** Modais seguem a anatomia da seção 8.4, com `role="dialog"`,
  `aria-modal`, foco preso, `Esc`, retorno de foco e scroll bloqueado.
- **AC-UI-33.** No mobile, modais viram folha inferior com altura máxima de
  90 vh e rolagem interna.
- **AC-UI-34.** Tabelas usam cabeçalho, `th scope`, alinhamento numérico à
  direita, container com rolagem e estados de carregamento, vazio e erro.
- **AC-UI-35.** Formulários têm label visível, foco em `#fbbf24`, erro com
  `aria-invalid` e `aria-describedby`, e não usam `prompt`, `alert` ou
  `confirm`.
- **AC-UI-36.** Existem estados padronizados de carregamento, vazio, erro,
  sucesso e offline, com `aria-live` quando dinâmicos.
- **AC-UI-37.** Ícones são SVG inline, usam `currentColor`, têm 16, 20 ou
  24 px e não vêm de CDN.
- **AC-UI-38.** Nenhum componente usa emoji como ícone de interface.

### 13.6 Acessibilidade e conteúdo

- **AC-UI-39.** Toda função é operável por teclado, com foco visível e ordem
  de tabulação lógica.
- **AC-UI-40.** A página tem link “Pular para o conteúdo”, landmarks e
  `lang="pt-BR"`.
- **AC-UI-41.** A interface suporta zoom de 200% sem perda de conteúdo.
- **AC-UI-42.** Com `prefers-reduced-motion`, animações e deslocamentos são
  reduzidos.
- **AC-UI-43.** Valores usam BRL, datas usam `dd/mm/aaaa` e textos estão em
  pt-BR.
- **AC-UI-44.** Nenhuma tela, componente ou mensagem sugere nota fiscal,
  cupom fiscal, SEFAZ ou apuração tributária.
- **AC-UI-45.** O rodapé e a marca usam “SUITEGEST — Gestão não fiscal de
  estabelecimentos de alimentação”.

## 14. Divergências e pendências

### 14.1 Divergências encontradas

| ID | Divergência | Impacto | Encaminhamento |
| --- | --- | --- | --- |
| D-01 | `styles.css` usa tema claro (`#f8fafc`, `#ffffff`, `#1e293b`). | Contraste e identidade não correspondem ao SUITEGEST. | Migrar para os tokens escuros deste documento. |
| D-02 | Não existe sidebar; a navegação é um cabeçalho com cards de módulo. | O operador não navega entre módulos em profundidade. | Criar app shell com sidebar e aplicá-lo a todas as páginas. |
| D-03 | A tipografia é a pilha de sistema; Inter não é carregada. | Aparência varia por sistema operacional. | Empacotar Inter localmente e definir a escala. |
| D-04 | Botões usam `.submit-button`, `.release-button` e `.module-link`, sem variantes. | Estados e hierarquia inconsistentes. | Criar as variantes primário, secundário, perigo, fantasma e desabilitado. |
| D-05 | Cards têm três implementações diferentes (`.module-card`, `.table-card`, `.order-summary-item`). | Medidas e hierarquia divergem. | Unificar em um componente de card com variantes. |
| D-06 | Badges têm regras duplicadas (`.badge`, `.table-status-*`, `.low-stock-badge`). | Cores e tamanhos inconsistentes. | Unificar nas cinco variantes da seção 8.3. |
| D-07 | Modais da comanda não têm `Esc`, foco preso nem retorno de foco. | Acessibilidade incompleta. | Aplicar o comportamento da seção 8.4. |
| D-08 | Tabelas usam `.products-table` e `.order-table` com estilos duplicados. | Manutenção e comportamento divergem. | Criar componente de tabela comum. |
| D-09 | Não há skeleton, toast, banner offline nem estado de erro padronizado. | Telas ficam em branco ou usam mensagens soltas. | Implementar os estados da seção 8.7. |
| D-10 | A interface exibe “SuiteSimulaFuncoes”. | Marca diverge do nome definido para o produto. | Trocar para SUITEGEST após aprovação da marca. |
| D-11 | Não há tokens de espaçamento, raio, sombra e movimento. | Valores mágicos se espalham pelo CSS. | Criar os tokens das seções 5 e 6. |
| D-12 | O destaque amarelo não é usado de forma sistemática. | Ação principal não se distingue do resto. | Aplicar `#fbbf24` em ação primária, item ativo e foco. |

### 14.2 Pendências

1. Criar os tokens globais de cor, tipografia, espaçamento, raio, sombra e
   movimento.
2. Empacotar a fonte Inter localmente e configurar o fallback Roboto.
3. Criar o app shell com sidebar expandida, colapsada e gaveta.
4. Migrar `styles.css` do tema claro para o tema escuro.
5. Aplicar o app shell em `index.html`, `mesas.html`, `cardapio.html`,
   `comanda.html`, `caixa.html`, `dashboard.html`, `relatorios.html`,
   `estoque.html`, `funcionarios.html` e `meu-painel.html`.
6. Substituir botões pontuais pelas variantes da seção 8.1.
7. Unificar cards, badges, modais e tabelas em componentes comuns.
8. Implementar estados de carregamento, vazio, erro, sucesso e offline.
9. Revisar todos os modais para foco preso, `Esc` e retorno de foco.
10. Auditar contraste e navegação por teclado em todas as telas.
11. Testar responsividade em 360, 390, 768, 1024, 1280 e 1440 px.
12. Atualizar `frontend/README.md` com o padrão visual e os tokens.
13. Definir oficialmente a marca SUITEGEST e remover o nome antigo das telas.
14. Adicionar checklist visual ao processo de revisão de cada bloco.

### 14.3 Situação dos testes

- Não há teste automatizado de interface ou de contraste.
- A validação atual é manual e não cobre todos os componentes.
- A conclusão deste bloco exige checklist manual por tela e por breakpoint.
- Recomenda-se, no futuro, teste de regressão visual e auditoria automatizada
  de acessibilidade.

## 15. Riscos e decisões

### 15.1 Riscos

| ID | Risco | Probabilidade | Impacto | Mitigação |
| --- | --- | --- | --- | --- |
| R-01 | Texto branco sobre amarelo ser usado por engano. | Média | Alto | Regra explícita e revisão de contraste. |
| R-02 | Migração do tema claro deixar telas com cores antigas. | Alta | Médio | Busca por hexadecimais soltos e checklist por página. |
| R-03 | Sidebar não ser adotada em todas as páginas. | Média | Alto | App shell único e checklist de migração. |
| R-04 | Sidebar colapsada esconder a função dos ícones. | Média | Médio | Tooltip, `aria-label` e teste com operador. |
| R-05 | Modal sem foco preso travar a navegação por teclado. | Média | Alto | Componente único e teste de teclado. |
| R-06 | Tabela larga causar rolagem horizontal na página. | Média | Médio | Container com `overflow-x` e largura mínima. |
| R-07 | Fonte externa bloquear a interface offline. | Baixa | Alto | Fonte local e fallback de sistema. |
| R-08 | Amarelo em excesso cansar a vista e perder hierarquia. | Média | Médio | Reservar para ação, foco e item ativo. |
| R-09 | Status só por cor excluir daltônicos. | Média | Alto | Texto e ícone em todo badge. |
| R-10 | Troca de marca quebrar textos, testes ou documentação. | Baixa | Médio | Migração planejada e busca pelo nome antigo. |
| R-11 | Tema escuro reduzir legibilidade em telas ruins. | Média | Médio | Contraste AA e teste em monitor real. |
| R-12 | Componentes duplicados voltarem por pressa. | Alta | Médio | Revisão de código e catálogo de componentes. |

### 15.2 Decisões adotadas

1. O produto adota tema escuro como única aparência neste bloco.
2. As cores base são `#0d1117`, `#1f2937`, `#fbbf24` e `#f9fafb`.
3. Texto sobre amarelo é sempre `#0d1117`.
4. Amarelo é reservado para ação, foco, item ativo e destaque.
5. A fonte principal é Inter, com Roboto como alternativa, servida localmente.
6. O corpo padrão é 14 px; textos longos usam 16 px.
7. A sidebar tem 240 px, ícones de 20 px e texto visível no desktop.
8. O item ativo da sidebar tem fundo amarelo e texto escuro.
9. A sidebar colapsa para 72 px no tablet e vira gaveta no mobile.
10. O app shell é único para todas as páginas.
11. Botões têm cinco variantes e estados completos.
12. Só existe um botão primário por contexto.
13. Ações destrutivas usam vermelho e confirmação.
14. Cards, badges, modais e tabelas são componentes únicos com variantes.
15. Status sempre tem texto, nunca só cor.
16. Modais prendem foco, fecham com `Esc` e devolvem o foco.
17. Tabelas rolam dentro do container e não escondem colunas essenciais.
18. Ícones são SVG inline com `currentColor`, sem CDN.
19. A meta de acessibilidade é WCAG 2.1 AA.
20. A marca exibida é SUITEGEST.
21. Não há tema claro, gradientes, vidro fosco ou efeitos 3D.
22. O produto continua não fiscal em toda a interface.

### 15.3 Decisões pendentes

1. A marca SUITEGEST substitui oficialmente SuiteSimulaFuncoes?
2. O produto terá tema claro no futuro?
3. Qual conjunto de ícones será usado como base (desenho próprio ou conjunto
   aberto)?
4. A sidebar terá contador de itens por módulo?
5. Haverá densidade compacta configurável para tabelas?
6. O logo terá símbolo próprio além do wordmark?
7. A fonte será empacotada como arquivo local ou via build?
8. Haverá teste de regressão visual automatizado?
9. O rodapé institucional aparece em todas as páginas ou só na inicial?
10. O status do serviço fica na sidebar ou apenas na topbar?

## 16. Definição de pronto

O bloco de diretrizes visuais só é considerado concluído quando:

- [ ] Os tokens de cor, tipografia, espaçamento, raio, sombra e movimento
      existem e são usados por todos os componentes.
- [ ] O tema escuro substituiu o tema claro em todas as telas.
- [ ] A fonte Inter está empacotada localmente, com fallback Roboto.
- [ ] O app shell com sidebar, topbar e conteúdo está aplicado em todas as
      páginas.
- [ ] A sidebar expandida, colapsada e em gaveta funciona nos breakpoints
      definidos.
- [ ] O item ativo da sidebar tem fundo amarelo, texto escuro e
      `aria-current="page"`.
- [ ] As cinco variantes de botão existem com todos os estados.
- [ ] Cards, badges, modais e tabelas seguem este documento.
- [ ] Modais têm foco preso, `Esc`, retorno de foco e scroll bloqueado.
- [ ] Tabelas têm cabeçalho acessível, alinhamento numérico e estados de
      carregamento, vazio e erro.
- [ ] Formulários têm label, foco, erro acessível e não usam `prompt`.
- [ ] Existem estados padronizados de carregamento, vazio, erro, sucesso e
      offline.
- [ ] Todas as combinações de cor passam no contraste AA.
- [ ] A navegação por teclado funciona em todas as telas.
- [ ] A interface suporta zoom de 200% e `prefers-reduced-motion`.
- [ ] A interface funciona em 360, 768, 1024 e 1440 px.
- [ ] A marca exibida é SUITEGEST e o rodapé não fiscal está padronizado.
- [ ] Nenhuma tela sugere documento fiscal.
- [ ] `frontend/README.md` aponta para este documento.
- [ ] O checklist visual foi aplicado na revisão de todos os módulos.
