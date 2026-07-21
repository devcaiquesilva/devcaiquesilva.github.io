# Wizard de Orçamento Conversacional — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o formulário estático de `orcamento.html` por um wizard conversacional (uma pergunta por tela), com perguntas específicas por tipo de projeto, resumo ao vivo do briefing, slider de investimento, persistência de progresso e o mesmo envio por e-mail/WhatsApp que já existe hoje.

**Architecture:** Lógica de dados/regras (tipos de projeto, perguntas de branch, formatação, montagem de resumo e de mensagem de fallback) isolada em um módulo puro `src/wizard-logic.js` (testável com Node puro, sem framework). A camada de interação (`src/wizard.js`) consome esse módulo para renderizar telas, navegar, persistir em `localStorage` e enviar os dados — sem tocar em regra de negócio diretamente. HTML e CSS reaproveitam ao máximo os componentes visuais já existentes (`.type-card`, `.form-input`, `.btn-primary` etc.).

**Tech Stack:** HTML/CSS/JS vanilla (sem framework, sem bundler, sem npm — site estático servido via GitHub Pages). Node.js usado apenas como executor de testes da lógica pura (`node tests/wizard-logic.test.js`), não é dependência do site em produção.

## Global Constraints

- A URL da página continua sendo `orcamento.html` — não criar página nova (preserva SEO e todos os links existentes de `index.html`, `projetos.html`, `tecnologias.html`, `experiencia.html`, footers e nav).
- Paleta e tipografia não mudam: usar sempre as variáveis já definidas em `src/style.css` (`--blue`, `--blue-hover`, `--blue-dark`, `--cyan`, `--bg`, `--bg-soft`, `--bg-tint`, `--text`, `--text-dim`, `--text-muted`, `--border`, `--border-bright`, `--ring`, `--shadow`, `--shadow-hover`, `--radius`, `--font`, `--head`, `--ease`, `--spring`). Nunca introduzir cores novas fora dessa paleta.
- Endpoint de envio: `https://formsubmit.co/ajax/8bccbc0af1756383496ac8812fae2780` (mesmo já usado hoje) — não trocar.
- Número de WhatsApp de fallback: `5519999819875` (mesmo já usado hoje) — não trocar.
- 7 tipos de projeto no total (a opção "Automação com IA" foi removida por decisão do usuário durante o brainstorming).
- Slider de investimento cobre R$ 500 a R$ 10.000, passo de R$ 100, com o valor máximo exibido como "R$ 10.000+".
- Faixa de preço estimada em tempo real está fora de escopo desta entrega (adiada — ver spec).
- Sem dependências novas (nenhum pacote npm, nenhum CDN novo) — o projeto não tem `package.json` e deve continuar sem um.
- Spec de referência: `docs/superpowers/specs/2026-07-21-wizard-orcamento-design.md`.

---

### Task 1: Lógica pura do wizard (dados + regras) com testes em Node

**Files:**
- Create: `src/wizard-logic.js`
- Create: `tests/wizard-logic.test.js`

**Interfaces:**
- Produces (consumido por todas as tasks seguintes, via `window.WizardLogic` no browser ou `require('../src/wizard-logic.js')` no Node):
  - `PROJECT_TYPES`: `Array<{value: string, emoji: string, title: string, desc: string}>` — 7 itens.
  - `PRAZO_OPTIONS`: `Array<string>` — 4 itens.
  - `INVEST_MIN`, `INVEST_MAX`, `INVEST_STEP`: `number` (500, 10000, 100).
  - `getBranchQuestions(tipo: string): Array<{field: string, options: string[]}>` — vazio para tipos sem branch (`'Ainda não sei'`).
  - `getStepOrder(tipo: string|null): string[]` — ex.: `['tipo','branch-0','branch-1','descricao','prazo','investimento','contato','revisao']`.
  - `formatCurrency(value: number): string` — ex.: `'R$ 3.200'`, `'R$ 10.000+'` quando `value >= INVEST_MAX`.
  - `buildSummaryLines(state: object): Array<{label: string, value: string}>`.
  - `buildWhatsAppMessage(state: object): string` — URL completa `https://wa.me/...?text=...`.

- [ ] **Step 1: Escrever o arquivo de lógica pura**

Criar `src/wizard-logic.js`:

```javascript
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WizardLogic = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var PROJECT_TYPES = [
    { value: 'Site para empresa', emoji: '🏢', title: 'Site institucional', desc: 'Institucional, com a cara do seu negócio' },
    { value: 'Site pessoal', emoji: '👤', title: 'Site pessoal', desc: 'Portfólio, currículo ou marca pessoal' },
    { value: 'Loja virtual', emoji: '🛒', title: 'Loja virtual', desc: 'Para vender seus produtos online' },
    { value: 'Landing page', emoji: '📣', title: 'Landing page', desc: 'Página única para divulgar e captar clientes' },
    { value: 'Aplicativo (app)', emoji: '📱', title: 'Aplicativo', desc: 'App para Android e iOS' },
    { value: 'Sistema / plataforma', emoji: '⚙️', title: 'Sistema / plataforma', desc: 'Gestão, painéis, área de login…' },
    { value: 'Ainda não sei', emoji: '💡', title: 'Ainda não sei', desc: 'Sem problema! Me conta que eu te oriento' }
  ];

  var BRANCH_QUESTIONS = {
    'Site para empresa': [
      { field: 'Já tem site hoje?', options: ['Não tenho', 'Tenho mas está ultrapassado', 'Quero uma versão nova'] },
      { field: 'O que é mais importante?', options: ['Passar profissionalismo', 'Aparecer no Google', 'Ter formulário de contato'] }
    ],
    'Site pessoal': [
      { field: 'Qual o objetivo principal?', options: ['Currículo/carreira', 'Mostrar meu trabalho', 'Marca pessoal e conteúdo'] },
      { field: 'Já tem fotos e textos prontos?', options: ['Já tenho tudo pronto', 'Tenho parte', 'Preciso de ajuda'] }
    ],
    'Loja virtual': [
      { field: 'Quantos produtos pretende vender?', options: ['Até 10', '10 a 50', '50 a 200', 'Mais de 200'] },
      { field: 'Como vai receber pagamento?', options: ['Cartão/Pix direto no site', 'Combinar por WhatsApp', 'Ainda não sei'] }
    ],
    'Landing page': [
      { field: 'Qual ação você quer que a pessoa faça?', options: ['Preencher formulário', 'Comprar direto', 'Agendar uma conversa', 'Baixar algo'] },
      { field: 'Já tem uma campanha de anúncio?', options: ['Sim, já rodando', 'Estou planejando', 'Ainda não'] }
    ],
    'Aplicativo (app)': [
      { field: 'Para quais plataformas?', options: ['Só Android', 'Só iOS', 'Ambos'] },
      { field: 'Vai precisar de login e conta de usuário?', options: ['Sim', 'Não', 'Não sei'] }
    ],
    'Sistema / plataforma': [
      { field: 'Quantas pessoas vão usar no dia a dia?', options: ['Só eu', 'Minha equipe', 'Múltiplos clientes/empresas'] },
      { field: 'Já existe algo hoje que isso vai substituir?', options: ['Sim', 'Não, é novo', 'Mais ou menos'] }
    ]
  };

  var PRAZO_OPTIONS = ['O quanto antes', 'Em até 1 mês', 'De 1 a 3 meses', 'Sem pressa, estou planejando'];

  var INVEST_MIN = 500;
  var INVEST_MAX = 10000;
  var INVEST_STEP = 100;

  function getBranchQuestions(tipo) {
    return BRANCH_QUESTIONS[tipo] ? BRANCH_QUESTIONS[tipo].slice() : [];
  }

  function getStepOrder(tipo) {
    var steps = ['tipo'];
    getBranchQuestions(tipo).forEach(function (_, i) { steps.push('branch-' + i); });
    steps.push('descricao', 'prazo', 'investimento', 'contato', 'revisao');
    return steps;
  }

  function formatCurrency(value) {
    var v = Math.round(value);
    if (v >= INVEST_MAX) return 'R$ ' + INVEST_MAX.toLocaleString('pt-BR') + '+';
    return 'R$ ' + v.toLocaleString('pt-BR');
  }

  function buildSummaryLines(state) {
    var lines = [];
    if (state.tipo) lines.push({ label: 'Tipo de projeto', value: state.tipo });
    getBranchQuestions(state.tipo).forEach(function (q) {
      var answer = state.branchAnswers && state.branchAnswers[q.field];
      if (answer) lines.push({ label: q.field, value: answer });
    });
    if (state.descricao) lines.push({ label: 'Ideia', value: state.descricao });
    if (state.prazo) lines.push({ label: 'Prazo', value: state.prazo });
    if (typeof state.investimento === 'number') lines.push({ label: 'Investimento', value: formatCurrency(state.investimento) });
    if (state.nome) lines.push({ label: 'Nome', value: state.nome });
    if (state.whatsapp) lines.push({ label: 'WhatsApp', value: state.whatsapp });
    if (state.email) lines.push({ label: 'E-mail', value: state.email });
    return lines;
  }

  function buildWhatsAppMessage(state) {
    var msg = 'Olá, Caique! Vim pelo seu site 😊\n\n';
    buildSummaryLines(state).forEach(function (l) {
      if (l.label === 'Nome' || l.label === 'WhatsApp' || l.label === 'E-mail') return;
      msg += '📌 ' + l.label + ': ' + l.value + '\n';
    });
    msg += '\n🙋 Nome: ' + (state.nome || '-');
    return 'https://wa.me/5519999819875?text=' + encodeURIComponent(msg);
  }

  return {
    PROJECT_TYPES: PROJECT_TYPES,
    BRANCH_QUESTIONS: BRANCH_QUESTIONS,
    PRAZO_OPTIONS: PRAZO_OPTIONS,
    INVEST_MIN: INVEST_MIN,
    INVEST_MAX: INVEST_MAX,
    INVEST_STEP: INVEST_STEP,
    getBranchQuestions: getBranchQuestions,
    getStepOrder: getStepOrder,
    formatCurrency: formatCurrency,
    buildSummaryLines: buildSummaryLines,
    buildWhatsAppMessage: buildWhatsAppMessage
  };
}));
```

- [ ] **Step 2: Escrever os testes (Node puro, sem framework)**

Criar `tests/wizard-logic.test.js`:

```javascript
const assert = require('node:assert');
const WizardLogic = require('../src/wizard-logic.js');

function test(name, fn) {
  fn();
  console.log('  ✓ ' + name);
}

console.log('wizard-logic.test.js');

test('getBranchQuestions retorna as 2 perguntas da Loja virtual', function () {
  const qs = WizardLogic.getBranchQuestions('Loja virtual');
  assert.strictEqual(qs.length, 2);
  assert.strictEqual(qs[0].field, 'Quantos produtos pretende vender?');
  assert.strictEqual(qs[1].field, 'Como vai receber pagamento?');
});

test('getBranchQuestions retorna vazio para "Ainda não sei"', function () {
  const qs = WizardLogic.getBranchQuestions('Ainda não sei');
  assert.strictEqual(qs.length, 0);
});

test('getBranchQuestions retorna vazio para tipo desconhecido/nulo', function () {
  assert.strictEqual(WizardLogic.getBranchQuestions(null).length, 0);
  assert.strictEqual(WizardLogic.getBranchQuestions('xxx').length, 0);
});

test('getStepOrder pula os passos de branch quando não existem perguntas', function () {
  const steps = WizardLogic.getStepOrder('Ainda não sei');
  assert.deepStrictEqual(steps, ['tipo', 'descricao', 'prazo', 'investimento', 'contato', 'revisao']);
});

test('getStepOrder inclui um passo por pergunta de branch', function () {
  const steps = WizardLogic.getStepOrder('Loja virtual');
  assert.deepStrictEqual(steps, ['tipo', 'branch-0', 'branch-1', 'descricao', 'prazo', 'investimento', 'contato', 'revisao']);
});

test('formatCurrency formata valores normais em BRL sem centavos', function () {
  assert.strictEqual(WizardLogic.formatCurrency(500), 'R$ 500');
  assert.strictEqual(WizardLogic.formatCurrency(3200), 'R$ 3.200');
});

test('formatCurrency mostra "+" quando atinge ou passa do teto', function () {
  assert.strictEqual(WizardLogic.formatCurrency(10000), 'R$ 10.000+');
  assert.strictEqual(WizardLogic.formatCurrency(15000), 'R$ 10.000+');
});

test('buildSummaryLines inclui tipo, perguntas de branch respondidas e demais campos', function () {
  const state = {
    tipo: 'Loja virtual',
    branchAnswers: { 'Quantos produtos pretende vender?': '10 a 50' },
    descricao: 'quero vender bolos',
    prazo: 'Em até 1 mês',
    investimento: 3200,
    nome: 'Maria'
  };
  const lines = WizardLogic.buildSummaryLines(state);
  const asMap = {};
  lines.forEach(function (l) { asMap[l.label] = l.value; });
  assert.strictEqual(asMap['Tipo de projeto'], 'Loja virtual');
  assert.strictEqual(asMap['Quantos produtos pretende vender?'], '10 a 50');
  assert.strictEqual(asMap['Investimento'], 'R$ 3.200');
  assert.strictEqual(asMap['Nome'], 'Maria');
});

test('buildSummaryLines nao inclui perguntas de branch ainda nao respondidas', function () {
  const state = { tipo: 'Loja virtual', branchAnswers: {} };
  const lines = WizardLogic.buildSummaryLines(state);
  const labels = lines.map(function (l) { return l.label; });
  assert.ok(!labels.includes('Quantos produtos pretende vender?'));
});

test('buildWhatsAppMessage retorna link wa.me com os dados do branch e nome codificados', function () {
  const state = {
    tipo: 'Loja virtual',
    branchAnswers: { 'Quantos produtos pretende vender?': '10 a 50' },
    descricao: 'quero vender bolos',
    prazo: 'Em até 1 mês',
    investimento: 3200,
    nome: 'Maria',
    whatsapp: '19999999999'
  };
  const link = WizardLogic.buildWhatsAppMessage(state);
  assert.ok(link.startsWith('https://wa.me/5519999819875?text='));
  const decoded = decodeURIComponent(link.split('?text=')[1]);
  assert.ok(decoded.includes('10 a 50'));
  assert.ok(decoded.includes('Maria'));
  assert.ok(decoded.includes('quero vender bolos'));
});

console.log('Todos os testes passaram.');
```

- [ ] **Step 3: Rodar os testes e confirmar que passam**

Run: `cd devcaiquesilva.github.io && node tests/wizard-logic.test.js`
Expected: imprime uma linha `✓` para cada um dos 11 testes e termina com `Todos os testes passaram.` (exit code 0). Se algum `assert` falhar, o script para com um stack trace do `AssertionError` — nesse caso revise a função correspondente antes de seguir.

- [ ] **Step 4: Commit**

```bash
git add src/wizard-logic.js tests/wizard-logic.test.js
git commit -m "feat: adiciona logica pura do wizard de orcamento com testes"
```

---

### Task 2: Estrutura HTML do wizard em `orcamento.html`

**Files:**
- Modify: `orcamento.html` (substitui o bloco `<!-- ORCAMENTO / BRIEFING -->`, mantém o restante do arquivo — nav, seção de contato, footer)
- Create: `src/wizard.js` (stub vazio nesta task — implementado nas Tasks 4 a 8)

**Interfaces:**
- Consumes: nenhuma (HTML puro + tags de script).
- Produces: os IDs de DOM que todas as tasks de JS seguintes vão consumir: `wizardCard`, `wizardProgressBar`, `wizardSummaryChip`, `wizardSummaryPanel`, `wizardSummaryList`, `wizardForm`, `wizardTypeGrid`, `wizardBranchSteps`, `wizardPrazoGrid`, `wizardDescricao`, `wizardInvestRange`, `wizardInvestValue`, `wizardNome`, `wizardZap`, `wizardEmail`, `wizardReviewList`, `wizardError`, `wizardWaFallback`, `wizardBackBtn`, `wizardNextBtn`, `wizardSubmitBtn`, `briefingSuccess`, `bsNome`, `briefingAgain`.

- [ ] **Step 1: Substituir a seção de briefing em `orcamento.html`**

Em `orcamento.html`, localizar o bloco que vai de `<!-- ORCAMENTO / BRIEFING -->` até o `</section>` que fecha `id="orcamento"` (linhas 43–182 do arquivo original — o `<form id="briefingForm">` inteiro e o `<div class="briefing-success">`) e substituir por:

```html
<!-- ORCAMENTO / BRIEFING -->
<section class="briefing-section page-first" id="orcamento" aria-labelledby="orcamento-title">
  <div class="glow glow-c" aria-hidden="true"></div>
  <div class="briefing-inner">

    <div class="briefing-intro fade-in">
      <div class="section-label">// seu projeto</div>
      <h1 class="section-title" id="orcamento-title">Me conta a sua ideia 💙</h1>
      <p class="briefing-text">
        Pode ser um site para a sua empresa, uma loja virtual, um aplicativo, um sistema ou só uma ideia que ainda está na cabeça. Você não precisa entender de tecnologia — essa parte é comigo. Escreve do seu jeito que eu cuido do resto.
      </p>
      <ol class="briefing-steps">
        <li><span class="step-num">1</span><span><strong>Você me conta sua ideia</strong> respondendo umas perguntinhas rápidas.</span></li>
        <li><span class="step-num">2</span><span><strong>Eu leio com atenção</strong> e te retorno em até 24h, já com perguntas e sugestões.</span></li>
        <li><span class="step-num">3</span><span><strong>Conversamos e monto uma proposta</strong> sob medida para o seu prazo e o seu bolso.</span></li>
      </ol>
      <div class="briefing-chips">
        <span class="chip">✅ Sem compromisso</span>
        <span class="chip">⚡ Resposta em até 24h</span>
        <span class="chip">💰 Orçamento gratuito</span>
      </div>
    </div>

    <div class="briefing-card wizard-card fade-in" id="wizardCard">
      <div class="wizard-progress" aria-hidden="true"><div class="wizard-progress-bar" id="wizardProgressBar"></div></div>

      <button type="button" class="wizard-summary-chip" id="wizardSummaryChip" aria-expanded="false" aria-controls="wizardSummaryPanel">
        <span>Ver meu briefing</span> <span class="wsc-arrow" aria-hidden="true">▾</span>
      </button>

      <div class="wizard-layout">
        <div class="wizard-main">

          <form id="wizardForm" novalidate>
            <input type="text" name="_honey" class="hp" tabindex="-1" autocomplete="off">

            <section class="wizard-step" data-step="tipo">
              <div class="wizard-step-label"></div>
              <h2 class="wizard-question">O que você quer criar?</h2>
              <div class="type-grid" id="wizardTypeGrid"></div>
            </section>

            <div id="wizardBranchSteps"></div>

            <section class="wizard-step" data-step="descricao" hidden>
              <div class="wizard-step-label"></div>
              <h2 class="wizard-question">Me conta um pouco da sua ideia</h2>
              <textarea class="form-textarea" id="wizardDescricao" placeholder="Ex.: Tenho uma confeitaria e queria um site com os meus doces, preços e um botão para os clientes fazerem pedidos pelo WhatsApp…"></textarea>
              <div class="form-hint">Escreve do seu jeito, sem termos técnicos. 🙂</div>
            </section>

            <section class="wizard-step" data-step="prazo" hidden>
              <div class="wizard-step-label"></div>
              <h2 class="wizard-question">Pra quando você precisa?</h2>
              <div class="type-grid wizard-choice-grid" id="wizardPrazoGrid"></div>
            </section>

            <section class="wizard-step" data-step="investimento" hidden>
              <div class="wizard-step-label"></div>
              <h2 class="wizard-question">Quanto pensa em investir?</h2>
              <div class="wizard-slider-wrap">
                <div class="wizard-slider-value" id="wizardInvestValue">R$ 2.000</div>
                <input type="range" class="wizard-slider" id="wizardInvestRange" min="500" max="10000" step="100" value="2000">
                <div class="wizard-slider-scale"><span>R$ 500</span><span>R$ 10.000+</span></div>
              </div>
              <div class="form-hint">Arraste até o valor que faz sentido pra você — é só uma referência, dá pra ajustar depois. 🙂</div>
            </section>

            <section class="wizard-step" data-step="contato" hidden>
              <div class="wizard-step-label"></div>
              <h2 class="wizard-question">Pra eu poder te responder</h2>
              <div class="form-group">
                <label class="form-label" for="wizardNome">Seu nome</label>
                <input class="form-input" id="wizardNome" type="text" autocomplete="name" placeholder="Como posso te chamar?">
              </div>
              <div class="form-group">
                <label class="form-label" for="wizardZap">Seu WhatsApp</label>
                <input class="form-input" id="wizardZap" type="tel" inputmode="tel" autocomplete="tel" placeholder="(19) 99999-9999">
              </div>
              <div class="form-group">
                <label class="form-label" for="wizardEmail">Seu e-mail <span class="opt">(opcional)</span></label>
                <input class="form-input" id="wizardEmail" type="email" autocomplete="email" placeholder="voce@email.com">
              </div>
            </section>

            <section class="wizard-step" data-step="revisao" hidden>
              <div class="wizard-step-label">Última etapa</div>
              <h2 class="wizard-question">Confere se ficou tudo certo</h2>
              <ul class="wizard-summary-list wizard-summary-list--inline" id="wizardReviewList"></ul>
              <div class="form-feedback" id="wizardError" role="alert" hidden>
                Ops! Não consegui enviar agora. 😕 Tenta de novo em instantes — ou, se preferir, <a id="wizardWaFallback" href="https://wa.me/5519999819875" target="_blank" rel="noopener">me manda direto no WhatsApp clicando aqui</a>.
              </div>
            </section>

            <div class="wizard-nav">
              <button type="button" class="btn-outline wizard-btn-back" id="wizardBackBtn" hidden>← Voltar</button>
              <button type="button" class="btn-primary wizard-btn-next" id="wizardNextBtn">Próximo →</button>
              <button type="submit" class="btn-primary btn-send wizard-btn-submit" id="wizardSubmitBtn" hidden>Enviar minha ideia 🚀</button>
            </div>

            <p class="form-privacy">🔒 Suas informações chegam direto no meu e-mail e não são compartilhadas com ninguém.</p>
          </form>

          <div class="briefing-success" id="briefingSuccess" aria-live="polite" hidden>
            <div class="bs-emoji">🎉</div>
            <h3>Ideia recebida!</h3>
            <p>Obrigado, <span id="bsNome">!</span> Vou ler tudo com atenção e te retorno em até 24 horas. Se quiser adiantar a conversa, é só me chamar no WhatsApp:</p>
            <a class="btn-whatsapp" href="https://wa.me/5519999819875?text=Ol%C3%A1%2C%20Caique!%20Acabei%20de%20enviar%20minha%20ideia%20pelo%20site%20%F0%9F%98%8A" target="_blank" rel="noopener">💬 Chamar no WhatsApp</a>
            <button type="button" class="bs-again" id="briefingAgain">← enviar outra ideia</button>
          </div>
        </div>

        <aside class="wizard-summary-panel" id="wizardSummaryPanel" aria-live="polite">
          <h3>✨ Seu briefing até agora</h3>
          <ul class="wizard-summary-list" id="wizardSummaryList">
            <li class="wizard-summary-empty">Vai preenchendo que eu vou montando aqui pra você conferir. 👀</li>
          </ul>
        </aside>
      </div>

      <noscript>
        <style>.wizard-progress, .wizard-summary-chip, .wizard-layout { display: none !important; }</style>
        <div class="form-feedback" style="margin:1.5rem">
          Esse formulário precisa de JavaScript pra funcionar. Sem problema — <a href="https://wa.me/5519999819875" target="_blank" rel="noopener">me chama direto no WhatsApp</a> que eu te ajudo por lá. 😊
        </div>
      </noscript>
    </div>

  </div>
</section>
```

O `<style>` dentro do `<noscript>` só é aplicado quando o JavaScript está desabilitado (é assim que o `<noscript>` funciona) — por isso ele esconde `.wizard-progress`, `.wizard-summary-chip` e `.wizard-layout` (que contém o form inteiro, com os grids de tipo/branch vazios já que dependem de JS para renderizar) e deixa só a mensagem de fallback visível. Com JavaScript habilitado, o navegador ignora todo o conteúdo do `<noscript>`, então o wizard funciona normalmente.

Notas importantes desta substituição:
- Os campos ocultos do FormSubmit (`_template`, `_captcha`, `_next`, `_subject`) e o `action`/`method` do form **não** vão mais no HTML — o envio passa a ser feito 100% via `fetch` montado em JS (Task 8), então não há necessidade de um `action` no `<form>`.
- O honeypot `_honey` continua no HTML (mesma proteção anti-spam de sempre) — a Task 8 vai lê-lo manualmente ao montar o envio.
- Mantém a `.briefing-intro` (texto explicativo à esquerda) exatamente como estava — só o card do formulário (`.briefing-card`) muda.

- [ ] **Step 2: Adicionar as tags de script no fim do `<body>` de `orcamento.html`**

Localizar, no fim de `orcamento.html`:

```html
<script src="src/main.js"></script>
</body>
```

Substituir por:

```html
<script src="src/wizard-logic.js"></script>
<script src="src/wizard.js"></script>
<script src="src/main.js"></script>
</body>
```

(`wizard-logic.js` precisa carregar antes de `wizard.js`, que consome `window.WizardLogic`.)

- [ ] **Step 3: Criar o stub de `src/wizard.js`**

Criar `src/wizard.js` com conteúdo mínimo (será preenchido nas Tasks 4–8):

```javascript
(function () {
  'use strict';
  // Implementado nas Tasks 4-8 do plano de wizard de orçamento.
})();
```

- [ ] **Step 4: Verificação manual — estrutura carrega sem erros**

Run: `cd devcaiquesilva.github.io && python -m http.server 8080`
Abrir `http://localhost:8080/orcamento.html` no navegador.
Expected: a página carrega, o card de orçamento aparece (ainda sem os cards de tipo de projeto, já que a renderização é feita em JS na Task 4), sem erros 404 no console do navegador (F12 → Console/Network). É esperado que a tela pareça "vazia" dentro do card — isso é normal até a Task 4.

- [ ] **Step 5: Commit**

```bash
git add orcamento.html src/wizard.js
git commit -m "feat: substitui formulario estatico pela estrutura HTML do wizard"
```

---

### Task 3: CSS do wizard

**Files:**
- Modify: `src/style.css` (adiciona nova seção ao final do arquivo, antes da seção `/* ============ RESPONSIVO ============ */`)

**Interfaces:**
- Consumes: variáveis de `:root` já existentes (ver Global Constraints).
- Produces: classes CSS consumidas pelo HTML da Task 2 e pelo JS das Tasks 4-8: `.wizard-card`, `.wizard-progress`, `.wizard-progress-bar`, `.wizard-summary-chip`, `.wsc-arrow`, `.wizard-layout`, `.wizard-main`, `.wizard-step`, `.wizard-step.shake`, `.wizard-step-label`, `.wizard-question`, `.choice-card`, `.wizard-choice-grid`, `.wizard-slider-wrap`, `.wizard-slider-value`, `.wizard-slider`, `.wizard-slider-scale`, `.wizard-nav`, `.wizard-btn-back`, `.wizard-btn-next`, `.wizard-btn-submit`, `.wizard-summary-panel`, `.wizard-summary-panel.open`, `.wizard-summary-list`, `.wizard-summary-list--inline`, `.wizard-summary-item`, `.wsi-label`, `.wsi-value`, `.wizard-summary-empty`.

- [ ] **Step 1: Adicionar a seção de CSS do wizard**

Em `src/style.css`, logo antes da linha `/* ============ RESPONSIVO ============ */`, inserir:

```css
/* ============ WIZARD DE ORÇAMENTO ============ */
.wizard-card { padding: 0; }

.wizard-progress { height: 4px; background: var(--bg-tint); border-radius: 20px 20px 0 0; overflow: hidden; }
.wizard-progress-bar { height: 100%; width: 12%; background: linear-gradient(90deg, var(--blue), var(--cyan)); transition: width 0.5s var(--ease); }

.wizard-summary-chip {
  display: none; width: 100%; align-items: center; justify-content: space-between;
  padding: 0.9rem 1.5rem; background: var(--bg-tint); border: none; border-bottom: 1px solid var(--border);
  font-family: var(--font); font-size: 0.85rem; font-weight: 800; color: var(--blue-dark); cursor: pointer;
}
.wsc-arrow { transition: transform 0.3s var(--ease); }
.wizard-summary-chip[aria-expanded="true"] .wsc-arrow { transform: rotate(180deg); }

.wizard-layout { display: grid; grid-template-columns: 1.4fr 1fr; gap: 0; }
.wizard-main { padding: 2rem; min-width: 0; }

.wizard-step-label { font-size: 11px; font-weight: 800; color: var(--blue); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5rem; min-height: 1em; }
.wizard-question { font-family: var(--head); font-size: 1.3rem; font-weight: 800; color: var(--text); margin-bottom: 1.25rem; letter-spacing: -0.01em; }

.wizard-step { animation: wizard-step-in 0.45s var(--ease) both; }
@keyframes wizard-step-in { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: none; } }
.wizard-step.shake { animation: shake 0.45s var(--ease); }

.choice-card { justify-content: center; text-align: center; }
.wizard-choice-grid.type-grid { grid-template-columns: repeat(2, 1fr); }

.wizard-slider-wrap { padding: 1.5rem 0.5rem 0.5rem; text-align: center; }
.wizard-slider-value { font-family: var(--head); font-size: 2rem; font-weight: 800; color: var(--blue); margin-bottom: 1rem; }
.wizard-slider {
  -webkit-appearance: none; appearance: none; width: 100%; height: 8px; border-radius: 999px;
  background: linear-gradient(90deg, var(--blue), var(--cyan)); outline: none; cursor: pointer;
}
.wizard-slider::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; width: 26px; height: 26px; border-radius: 50%;
  background: #fff; border: 3px solid var(--blue); box-shadow: 0 4px 10px rgba(26,110,245,0.35);
  cursor: pointer; transition: transform 0.2s var(--spring);
}
.wizard-slider::-webkit-slider-thumb:hover { transform: scale(1.12); }
.wizard-slider::-moz-range-thumb {
  width: 26px; height: 26px; border-radius: 50%; background: #fff; border: 3px solid var(--blue);
  box-shadow: 0 4px 10px rgba(26,110,245,0.35); cursor: pointer;
}
.wizard-slider-scale { display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted); font-weight: 700; margin-top: 0.5rem; }

.wizard-nav { display: flex; gap: 0.75rem; margin-top: 1.5rem; }
.wizard-btn-back { flex: 0 0 auto; }
.wizard-btn-next, .wizard-btn-submit { flex: 1; justify-content: center; }

.wizard-summary-panel {
  background: var(--bg-tint); padding: 2rem 1.75rem; border-left: 1px solid var(--border);
  border-radius: 0 20px 20px 0;
  display: flex; flex-direction: column; gap: 1rem;
}
.wizard-summary-panel h3 { font-family: var(--head); font-size: 1rem; font-weight: 800; color: var(--text); }
.wizard-summary-list { list-style: none; display: flex; flex-direction: column; gap: 0.75rem; }
.wizard-summary-item { display: flex; flex-direction: column; gap: 2px; padding-bottom: 0.75rem; border-bottom: 1px dashed var(--border); font-size: 0.85rem; }
.wsi-label { font-weight: 700; color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; }
.wsi-value { color: var(--text); font-weight: 700; overflow-wrap: break-word; }
.wizard-summary-empty { color: var(--text-muted); font-size: 0.85rem; line-height: 1.6; }

.wizard-summary-list--inline { margin-bottom: 1.5rem; }
```

- [ ] **Step 2: Adicionar os ajustes responsivos do wizard**

Dentro do bloco `@media (max-width: 960px) { ... }` já existente em `src/style.css` (que hoje contém `.briefing-inner` e `.service-grid`), adicionar as regras do wizard:

```css
  .wizard-summary-chip { display: flex; }
  .wizard-layout { grid-template-columns: 1fr; }
  .wizard-summary-panel {
    border-left: none; border-top: 1px solid var(--border); border-radius: 0;
    max-height: 0; padding: 0 1.75rem; overflow: hidden;
    transition: max-height 0.4s var(--ease), padding 0.4s var(--ease);
  }
  .wizard-summary-panel.open { max-height: 600px; padding: 1.5rem 1.75rem; }
```

Dentro do bloco `@media (max-width: 768px) { ... }` já existente (o grande bloco que já ajusta `.briefing-inner`, `.form-row` etc.), adicionar:

```css
  .wizard-main { padding: 1.5rem; }
  .wizard-question { font-size: 1.1rem; }
  .wizard-choice-grid.type-grid { grid-template-columns: 1fr; }
```

- [ ] **Step 3: Verificação manual — visual do wizard**

Com o servidor local do Step 4 da Task 2 ainda rodando (ou reiniciar com `python -m http.server 8080`), recarregar `http://localhost:8080/orcamento.html`.
Expected: o card de orçamento aparece com a barra de progresso fina no topo, cantos arredondados preservados, e (mesmo sem conteúdo dinâmico ainda) nenhuma quebra visual de layout. Redimensionar a janela para menos de 960px de largura e confirmar que não há erro de layout (o painel lateral, quando existir conteúdo, deve ir para baixo).

- [ ] **Step 4: Commit**

```bash
git add src/style.css
git commit -m "feat: adiciona estilos do wizard de orcamento"
```

---

### Task 4: Renderização dos steps e navegação básica

**Files:**
- Modify: `src/wizard.js` (substitui o conteúdo stub da Task 2)

**Interfaces:**
- Consumes: `WizardLogic.PROJECT_TYPES`, `WizardLogic.PRAZO_OPTIONS`, `WizardLogic.getBranchQuestions`, `WizardLogic.getStepOrder` (de `src/wizard-logic.js`, Task 1); os IDs de DOM da Task 2.
- Produces (usado pelas Tasks 5–8, todas dentro do mesmo IIFE de `wizard.js` — variáveis de módulo, não globais): `state` (objeto de estado central), `steps` (array atual de ids de step), `currentIndex`, e as funções `showStep(index)`, `goNext()`, `goBack()`, `isStepValid(index)`, `recomputeSteps()`, `updateStepLabels()`.

- [ ] **Step 1: Substituir `src/wizard.js` pela versão com estado, renderização e navegação**

```javascript
(function () {
  'use strict';
  var Logic = window.WizardLogic;
  var form = document.getElementById('wizardForm');
  if (!form || !Logic) return;

  var state = {
    tipo: null,
    branchAnswers: {},
    descricao: '',
    prazo: null,
    investimento: 2000,
    nome: '',
    whatsapp: '',
    email: ''
  };

  var steps = Logic.getStepOrder(null);
  var currentIndex = 0;
  var lastRenderedTipo = null;

  var backBtn = document.getElementById('wizardBackBtn');
  var nextBtn = document.getElementById('wizardNextBtn');
  var submitBtn = document.getElementById('wizardSubmitBtn');
  var progressBar = document.getElementById('wizardProgressBar');

  /* ===== RENDER: TIPO ===== */
  function renderTypeGrid() {
    var grid = document.getElementById('wizardTypeGrid');
    grid.innerHTML = '';
    Logic.PROJECT_TYPES.forEach(function (t) {
      var label = document.createElement('label');
      label.className = 'type-card';
      label.innerHTML =
        '<input type="radio" name="wizardTipo" value="' + t.value + '">' +
        '<span class="tc-emoji">' + t.emoji + '</span>' +
        '<span><span class="tc-title">' + t.title + '</span>' +
        '<span class="tc-desc">' + t.desc + '</span></span>';
      grid.appendChild(label);
    });
  }

  /* ===== RENDER: BRANCH STEPS (dependem do tipo escolhido) ===== */
  function renderBranchSteps(tipo) {
    var container = document.getElementById('wizardBranchSteps');
    container.innerHTML = '';
    Logic.getBranchQuestions(tipo).forEach(function (q, i) {
      var section = document.createElement('section');
      section.className = 'wizard-step';
      section.setAttribute('data-step', 'branch-' + i);
      section.hidden = true;

      var grid = document.createElement('div');
      grid.className = 'type-grid wizard-choice-grid';
      q.options.forEach(function (opt) {
        var label = document.createElement('label');
        label.className = 'type-card choice-card';
        label.innerHTML =
          '<input type="radio" name="wizardBranch' + i + '" value="' + opt + '">' +
          '<span class="tc-title">' + opt + '</span>';
        grid.appendChild(label);
      });

      var labelDiv = document.createElement('div');
      labelDiv.className = 'wizard-step-label';
      var h2 = document.createElement('h2');
      h2.className = 'wizard-question';
      h2.textContent = q.field;

      section.appendChild(labelDiv);
      section.appendChild(h2);
      section.appendChild(grid);
      container.appendChild(section);
    });
  }

  /* ===== RENDER: PRAZO ===== */
  function renderPrazoGrid() {
    var grid = document.getElementById('wizardPrazoGrid');
    grid.innerHTML = '';
    Logic.PRAZO_OPTIONS.forEach(function (opt) {
      var label = document.createElement('label');
      label.className = 'type-card choice-card';
      label.innerHTML =
        '<input type="radio" name="wizardPrazo" value="' + opt + '">' +
        '<span class="tc-title">' + opt + '</span>';
      grid.appendChild(label);
    });
  }

  /* ===== NAVEGACAO ===== */
  function recomputeSteps() {
    steps = Logic.getStepOrder(state.tipo);
  }

  function updateStepLabels() {
    steps.forEach(function (stepId, i) {
      if (stepId === 'revisao') return;
      var section = document.querySelector('.wizard-step[data-step="' + stepId + '"]');
      if (!section) return;
      var labelEl = section.querySelector('.wizard-step-label');
      if (labelEl) labelEl.textContent = 'Passo ' + (i + 1) + ' de ' + (steps.length - 1);
    });
  }

  function showStep(index) {
    document.querySelectorAll('.wizard-step').forEach(function (el) { el.hidden = true; });
    var stepId = steps[index];
    var target = document.querySelector('.wizard-step[data-step="' + stepId + '"]');
    if (target) target.hidden = false;

    backBtn.hidden = index === 0;
    var isLast = index === steps.length - 1;
    nextBtn.hidden = isLast;
    submitBtn.hidden = !isLast;

    progressBar.style.width = (((index + 1) / steps.length) * 100) + '%';
  }

  function isStepValid(index) {
    var stepId = steps[index];
    if (stepId === 'tipo') return !!state.tipo;
    if (stepId.indexOf('branch-') === 0) {
      var qIndex = parseInt(stepId.split('-')[1], 10);
      var q = Logic.getBranchQuestions(state.tipo)[qIndex];
      return !!(q && state.branchAnswers[q.field]);
    }
    if (stepId === 'descricao') return state.descricao.trim().length >= 10;
    if (stepId === 'prazo') return !!state.prazo;
    if (stepId === 'investimento') return true;
    if (stepId === 'contato') return state.nome.trim().length > 0 && state.whatsapp.trim().length > 0;
    return true;
  }

  function shakeCurrentStep() {
    var section = document.querySelector('.wizard-step[data-step="' + steps[currentIndex] + '"]');
    if (!section) return;
    section.classList.remove('shake');
    void section.offsetWidth;
    section.classList.add('shake');
  }

  function goNext() {
    if (!isStepValid(currentIndex)) { shakeCurrentStep(); return; }

    if (steps[currentIndex] === 'tipo' && state.tipo !== lastRenderedTipo) {
      recomputeSteps();
      renderBranchSteps(state.tipo);
      bindBranchEvents();
      updateStepLabels();
      lastRenderedTipo = state.tipo;
    }

    currentIndex++;
    showStep(currentIndex);
  }

  function goBack() {
    if (currentIndex === 0) return;
    currentIndex--;
    showStep(currentIndex);
  }

  /* ===== EVENTOS DE CAMPO ===== */
  function bindTypeEvents() {
    document.getElementById('wizardTypeGrid').addEventListener('change', function (e) {
      if (e.target.name !== 'wizardTipo') return;
      state.tipo = e.target.value;
      document.querySelectorAll('#wizardTypeGrid .type-card').forEach(function (c) { c.classList.remove('selected'); });
      e.target.closest('.type-card').classList.add('selected');
    });
  }

  function bindBranchEvents() {
    var container = document.getElementById('wizardBranchSteps');
    Logic.getBranchQuestions(state.tipo).forEach(function (q, i) {
      var section = container.querySelector('.wizard-step[data-step="branch-' + i + '"]');
      if (!section) return;
      section.addEventListener('change', function (e) {
        if (e.target.name !== 'wizardBranch' + i) return;
        state.branchAnswers[q.field] = e.target.value;
        section.querySelectorAll('.type-card').forEach(function (c) { c.classList.remove('selected'); });
        e.target.closest('.type-card').classList.add('selected');
      });
    });
  }

  function bindPrazoEvents() {
    document.getElementById('wizardPrazoGrid').addEventListener('change', function (e) {
      if (e.target.name !== 'wizardPrazo') return;
      state.prazo = e.target.value;
      document.querySelectorAll('#wizardPrazoGrid .type-card').forEach(function (c) { c.classList.remove('selected'); });
      e.target.closest('.type-card').classList.add('selected');
    });
  }

  function bindDescricaoEvents() {
    document.getElementById('wizardDescricao').addEventListener('input', function (e) {
      state.descricao = e.target.value;
    });
  }

  function bindContatoEvents() {
    document.getElementById('wizardNome').addEventListener('input', function (e) { state.nome = e.target.value; });
    document.getElementById('wizardZap').addEventListener('input', function (e) { state.whatsapp = e.target.value; });
    document.getElementById('wizardEmail').addEventListener('input', function (e) { state.email = e.target.value; });
  }

  /* ===== NAVEGACAO POR TECLADO ===== */
  form.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    if (e.target.tagName === 'TEXTAREA') return;
    if (steps[currentIndex] === 'revisao') return;
    e.preventDefault();
    goNext();
  });

  /* ===== INIT ===== */
  renderTypeGrid();
  renderPrazoGrid();
  bindTypeEvents();
  bindPrazoEvents();
  bindDescricaoEvents();
  bindContatoEvents();
  updateStepLabels();
  showStep(currentIndex);

  nextBtn.addEventListener('click', goNext);
  backBtn.addEventListener('click', goBack);
})();
```

- [ ] **Step 2: Verificação manual — fluxo de navegação completo**

Com `python -m http.server 8080` rodando na raiz do projeto, abrir `http://localhost:8080/orcamento.html`.

Checklist manual (sem isso passar, não avançar para a Task 5):
1. A tela 1 mostra os 7 cards de tipo de projeto (sem "Automação com IA").
2. Clicar em "Próximo" sem selecionar nada faz o card "tremer" (shake) e não avança.
3. Selecionar "Loja virtual" e clicar "Próximo" → aparece a pergunta "Quantos produtos pretende vender?" com 4 opções.
4. Responder e clicar "Próximo" → aparece "Como vai receber pagamento?" com 3 opções.
5. Responder e avançar → aparece a tela de descrição livre.
6. Digitar menos de 10 caracteres e tentar avançar → treme e não avança; digitar 10+ caracteres → avança.
7. Continuar até a tela de prazo (cards) → investimento (ainda sem estilo de slider funcional pleno, ok por enquanto) → contato → revisão. Na tela de revisão o botão vira "Enviar minha ideia 🚀" (ainda sem funcionar de fato — Task 8).
8. Clicar "Voltar" em qualquer tela retorna à anterior mantendo as respostas.
9. Voltar até a tela 1 e escolher "Ainda não sei" → ao avançar, pula direto para a tela de descrição (sem perguntas de branch).
10. Repetir o passo 3 escolhendo cada um dos outros 5 tipos (Site institucional, Site pessoal, Landing page, Aplicativo, Sistema/plataforma) e confirmar que as perguntas de branch corretas aparecem (conferir contra a tabela da spec).
11. **Round-trip sem trocar o tipo:** escolher "Loja virtual", responder as duas perguntas de branch, clicar "Voltar" duas vezes até a tela 1 (sem trocar a seleção) e clicar "Próximo" de novo. Expected: as duas perguntas de branch aparecem com as respostas anteriores ainda marcadas (não voltam em branco). Esse é o guard `state.tipo !== lastRenderedTipo` em `goNext()` — sem ele, `renderBranchSteps` recria os cards do zero e perde a marcação visual mesmo com `state.branchAnswers` intacto.

- [ ] **Step 3: Commit**

```bash
git add src/wizard.js
git commit -m "feat: implementa renderizacao dos steps e navegacao do wizard"
```

---

### Task 5: Slider de investimento

**Files:**
- Modify: `src/wizard.js`

**Interfaces:**
- Consumes: `Logic.formatCurrency` (Task 1), `#wizardInvestRange`/`#wizardInvestValue` (Task 2), `state` (Task 4).
- Produces: `bindInvestSlider()`, chamada no bloco `/* ===== INIT ===== */`.

- [ ] **Step 1: Adicionar a função do slider**

Em `src/wizard.js`, logo antes do comentário `/* ===== INIT ===== */`, inserir:

```javascript
  /* ===== SLIDER DE INVESTIMENTO ===== */
  function bindInvestSlider() {
    var range = document.getElementById('wizardInvestRange');
    var valueEl = document.getElementById('wizardInvestValue');
    function update() {
      state.investimento = parseInt(range.value, 10);
      valueEl.textContent = Logic.formatCurrency(state.investimento);
    }
    range.addEventListener('input', update);
    update();
  }

```

No bloco `/* ===== INIT ===== */` já existente (criado na Task 4), localizar:

```javascript
  bindDescricaoEvents();
  bindContatoEvents();
  updateStepLabels();
```

Substituir por:

```javascript
  bindDescricaoEvents();
  bindContatoEvents();
  bindInvestSlider();
  updateStepLabels();
```

- [ ] **Step 2: Verificação manual — slider**

No navegador (`http://localhost:8080/orcamento.html`), navegar até a tela de investimento.
Expected: o valor exibido acima da barra começa em "R$ 2.000"; arrastar até o mínimo mostra "R$ 500"; arrastar até o máximo mostra "R$ 10.000+" (com o sinal de mais); arrastar para um valor intermediário como 3200 mostra "R$ 3.200".

- [ ] **Step 3: Commit**

```bash
git add src/wizard.js
git commit -m "feat: adiciona slider de investimento ao wizard"
```

---

### Task 6: Resumo ao vivo (painel lateral + chip mobile)

**Files:**
- Modify: `src/wizard.js`

**Interfaces:**
- Consumes: `Logic.buildSummaryLines` (Task 1), `#wizardSummaryList`/`#wizardSummaryPanel`/`#wizardSummaryChip`/`#wizardReviewList` (Task 2).
- Produces: `renderSummaryInto(listEl)`, `updateSummary()`, `renderReview()` — `renderReview()` é chamado pela Task 4's `showStep()` quando `stepId === 'revisao'` (esta task modifica `showStep` para adicionar essa chamada) e por todos os handlers de campo que hoje já existem (esta task adiciona `updateSummary()` a cada um deles).

- [ ] **Step 1: Adicionar as funções de resumo**

Em `src/wizard.js`, logo antes do comentário `/* ===== INIT ===== */`, inserir (após a função `bindInvestSlider` da Task 5):

```javascript
  /* ===== RESUMO AO VIVO ===== */
  function renderSummaryInto(listEl) {
    var lines = Logic.buildSummaryLines(state);
    listEl.innerHTML = '';
    if (!lines.length) {
      var empty = document.createElement('li');
      empty.className = 'wizard-summary-empty';
      empty.textContent = 'Vai preenchendo que eu vou montando aqui pra você conferir. 👀';
      listEl.appendChild(empty);
      return;
    }
    lines.forEach(function (l) {
      var li = document.createElement('li');
      li.className = 'wizard-summary-item';
      var labelSpan = document.createElement('span');
      labelSpan.className = 'wsi-label';
      labelSpan.textContent = l.label;
      var valueSpan = document.createElement('span');
      valueSpan.className = 'wsi-value';
      valueSpan.textContent = l.value;
      li.appendChild(labelSpan);
      li.appendChild(valueSpan);
      listEl.appendChild(li);
    });
  }

  function updateSummary() {
    renderSummaryInto(document.getElementById('wizardSummaryList'));
  }

  function renderReview() {
    renderSummaryInto(document.getElementById('wizardReviewList'));
  }

  function bindSummaryChip() {
    var chip = document.getElementById('wizardSummaryChip');
    var panel = document.getElementById('wizardSummaryPanel');
    chip.addEventListener('click', function () {
      var open = panel.classList.toggle('open');
      chip.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

```

- [ ] **Step 2: Conectar `updateSummary()` aos pontos de mudança de estado**

Em `src/wizard.js`, dentro de `showStep(index)` (Task 4), adicionar a chamada de `renderReview()` quando o step for a revisão. Localizar:

```javascript
    progressBar.style.width = (((index + 1) / steps.length) * 100) + '%';
  }
```

Substituir por:

```javascript
    progressBar.style.width = (((index + 1) / steps.length) * 100) + '%';

    if (stepId === 'revisao') renderReview();
  }
```

Em cada handler de campo já existente, adicionar `updateSummary();` ao final. Localizar e ajustar os quatro handlers:

```javascript
  function bindTypeEvents() {
    document.getElementById('wizardTypeGrid').addEventListener('change', function (e) {
      if (e.target.name !== 'wizardTipo') return;
      state.tipo = e.target.value;
      document.querySelectorAll('#wizardTypeGrid .type-card').forEach(function (c) { c.classList.remove('selected'); });
      e.target.closest('.type-card').classList.add('selected');
      updateSummary();
    });
  }
```

```javascript
      section.addEventListener('change', function (e) {
        if (e.target.name !== 'wizardBranch' + i) return;
        state.branchAnswers[q.field] = e.target.value;
        section.querySelectorAll('.type-card').forEach(function (c) { c.classList.remove('selected'); });
        e.target.closest('.type-card').classList.add('selected');
        updateSummary();
      });
```

```javascript
  function bindPrazoEvents() {
    document.getElementById('wizardPrazoGrid').addEventListener('change', function (e) {
      if (e.target.name !== 'wizardPrazo') return;
      state.prazo = e.target.value;
      document.querySelectorAll('#wizardPrazoGrid .type-card').forEach(function (c) { c.classList.remove('selected'); });
      e.target.closest('.type-card').classList.add('selected');
      updateSummary();
    });
  }
```

```javascript
  function bindDescricaoEvents() {
    document.getElementById('wizardDescricao').addEventListener('input', function (e) {
      state.descricao = e.target.value;
      updateSummary();
    });
  }
```

E em `bindInvestSlider` (Task 5), na função `update`, adicionar a chamada:

```javascript
    function update() {
      state.investimento = parseInt(range.value, 10);
      valueEl.textContent = Logic.formatCurrency(state.investimento);
      updateSummary();
    }
```

Por fim, no bloco `/* ===== INIT ===== */` (já modificado pela Task 5), localizar:

```javascript
  bindInvestSlider();
  updateStepLabels();
  showStep(currentIndex);

  nextBtn.addEventListener('click', goNext);
  backBtn.addEventListener('click', goBack);
```

Substituir por:

```javascript
  bindInvestSlider();
  bindSummaryChip();
  updateStepLabels();
  showStep(currentIndex);
  updateSummary();

  nextBtn.addEventListener('click', goNext);
  backBtn.addEventListener('click', goBack);
```

- [ ] **Step 3: Verificação manual — resumo ao vivo**

No navegador, em viewport larga (desktop): preencher o wizard (qualquer tipo) e confirmar que o painel "✨ Seu briefing até agora" à direita vai ganhando uma linha nova a cada resposta, na ordem: Tipo de projeto → perguntas de branch → Ideia → Prazo → Investimento → (Nome/WhatsApp/E-mail ao preencher a tela de contato). Redimensionar para menos de 960px e confirmar que o painel lateral some e em seu lugar aparece o botão "Ver meu briefing ▾" no topo do card, que expande/recolhe ao clicar. Chegar até a tela de revisão e confirmar que a lista ali mostra o mesmo conteúdo completo.

- [ ] **Step 4: Commit**

```bash
git add src/wizard.js
git commit -m "feat: adiciona resumo ao vivo do briefing (painel e chip mobile)"
```

---

### Task 7: Persistência de progresso em `localStorage`

**Files:**
- Modify: `src/wizard.js`

**Interfaces:**
- Consumes: `state`, `steps`, `currentIndex`, `recomputeSteps`, `renderBranchSteps`, `bindBranchEvents`, `updateStepLabels`, `updateSummary` (todas já definidas nas Tasks 4 e 6).
- Produces: `saveProgress()`, `loadProgress()`, `clearProgress()` — `saveProgress()` passa a ser chamada por `goNext()`, `goBack()` e por todos os handlers de campo; `clearProgress()` é consumida pela Task 8 (após envio bem-sucedido) e pelo botão "enviar outra" (Task 8).

- [ ] **Step 1: Adicionar as funções de persistência**

Em `src/wizard.js`, logo antes do comentário `/* ===== INIT ===== */`, inserir (após as funções de resumo da Task 6):

```javascript
  /* ===== PERSISTENCIA (localStorage) ===== */
  var STORAGE_KEY = 'wizardOrcamentoState';

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: state, currentIndex: currentIndex }));
    } catch (e) {}
  }

  function clearProgress() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  function loadProgress() {
    var raw;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return; }
    if (!raw) return;
    var saved;
    try { saved = JSON.parse(raw); } catch (e) { return; }
    if (!saved || !saved.state) return;

    state.tipo = saved.state.tipo || null;
    state.branchAnswers = saved.state.branchAnswers || {};
    state.descricao = saved.state.descricao || '';
    state.prazo = saved.state.prazo || null;
    state.investimento = typeof saved.state.investimento === 'number' ? saved.state.investimento : 2000;
    state.nome = saved.state.nome || '';
    state.whatsapp = saved.state.whatsapp || '';
    state.email = saved.state.email || '';

    if (state.tipo) {
      var typeInput = document.querySelector('#wizardTypeGrid input[value="' + state.tipo + '"]');
      if (typeInput) { typeInput.checked = true; typeInput.closest('.type-card').classList.add('selected'); }
      recomputeSteps();
      renderBranchSteps(state.tipo);
      bindBranchEvents();
      Logic.getBranchQuestions(state.tipo).forEach(function (q, i) {
        var answer = state.branchAnswers[q.field];
        if (!answer) return;
        var input = document.querySelector('#wizardBranchSteps [data-step="branch-' + i + '"] input[value="' + answer + '"]');
        if (input) { input.checked = true; input.closest('.type-card').classList.add('selected'); }
      });
      updateStepLabels();
      lastRenderedTipo = state.tipo;
    }

    document.getElementById('wizardDescricao').value = state.descricao;
    if (state.prazo) {
      var prazoInput = document.querySelector('#wizardPrazoGrid input[value="' + state.prazo + '"]');
      if (prazoInput) { prazoInput.checked = true; prazoInput.closest('.type-card').classList.add('selected'); }
    }
    document.getElementById('wizardInvestRange').value = state.investimento;
    document.getElementById('wizardInvestValue').textContent = Logic.formatCurrency(state.investimento);
    document.getElementById('wizardNome').value = state.nome;
    document.getElementById('wizardZap').value = state.whatsapp;
    document.getElementById('wizardEmail').value = state.email;

    currentIndex = Math.min(saved.currentIndex || 0, steps.length - 1);
  }

```

- [ ] **Step 2: Chamar `saveProgress()` nos pontos de mudança e `loadProgress()` na inicialização**

Em `goNext()` e `goBack()` (Task 4), adicionar `saveProgress();` ao final de cada uma:

```javascript
  function goNext() {
    if (!isStepValid(currentIndex)) { shakeCurrentStep(); return; }

    if (steps[currentIndex] === 'tipo' && state.tipo !== lastRenderedTipo) {
      recomputeSteps();
      renderBranchSteps(state.tipo);
      bindBranchEvents();
      updateStepLabels();
      lastRenderedTipo = state.tipo;
    }

    currentIndex++;
    showStep(currentIndex);
    saveProgress();
  }

  function goBack() {
    if (currentIndex === 0) return;
    currentIndex--;
    showStep(currentIndex);
    saveProgress();
  }
```

No bloco `/* ===== INIT ===== */`, a ordem importa: `loadProgress()` precisa rodar **depois** de `renderTypeGrid()`/`renderPrazoGrid()` (para os inputs já existirem no DOM) e **antes** de `showStep(currentIndex)` (para restaurar o índice correto antes de exibir). Ajustar o bloco para:

```javascript
  /* ===== INIT ===== */
  renderTypeGrid();
  renderPrazoGrid();
  bindTypeEvents();
  bindPrazoEvents();
  bindDescricaoEvents();
  bindContatoEvents();
  bindInvestSlider();
  bindSummaryChip();
  updateStepLabels();
  loadProgress();
  showStep(currentIndex);
  updateSummary();

  nextBtn.addEventListener('click', goNext);
  backBtn.addEventListener('click', goBack);
```

- [ ] **Step 3: Verificação manual — progresso restaurado**

No navegador, preencher o wizard até a metade (ex.: até a tela de prazo, com tipo "Loja virtual" e as duas respostas de branch preenchidas). Recarregar a página (F5). Expected: o wizard reabre exatamente na tela de prazo, com "Loja virtual" já selecionado na tela 1 (conferir voltando) e as respostas de branch já marcadas. Abrir o DevTools → Application → Local Storage e confirmar a chave `wizardOrcamentoState` com o JSON do estado.

- [ ] **Step 4: Commit**

```bash
git add src/wizard.js
git commit -m "feat: adiciona persistencia de progresso do wizard em localStorage"
```

---

### Task 8: Envio final (FormSubmit + fallback WhatsApp) e tela de sucesso

**Files:**
- Modify: `src/wizard.js`

**Interfaces:**
- Consumes: `Logic.getBranchQuestions`, `Logic.formatCurrency`, `Logic.buildWhatsAppMessage` (Task 1); `clearProgress` (Task 7); `#wizardForm`, `#wizardSubmitBtn`, `#wizardError`, `#wizardWaFallback`, `#briefingSuccess`, `#bsNome`, `#briefingAgain` (Task 2).
- Produces: `buildFormData()`, `submitWizard(event)` — conclui o fluxo do wizard.

- [ ] **Step 1: Adicionar a lógica de envio**

Em `src/wizard.js`, logo antes do comentário `/* ===== INIT ===== */`, inserir (após as funções de persistência da Task 7):

```javascript
  /* ===== ENVIO ===== */
  var errorBox = document.getElementById('wizardError');
  var successBox = document.getElementById('briefingSuccess');

  function buildFormData() {
    var fd = new FormData();
    var honey = form.querySelector('.hp');
    fd.append('_honey', honey ? honey.value : '');
    fd.append('_template', 'table');
    fd.append('_captcha', 'false');
    fd.append('_subject', '💙 Nova ideia de projeto — ' + (state.nome || 'cliente pelo site'));

    fd.append('Tipo de projeto', state.tipo || '-');
    Logic.getBranchQuestions(state.tipo).forEach(function (q) {
      fd.append(q.field, state.branchAnswers[q.field] || '-');
    });
    fd.append('Descrição da ideia', state.descricao);
    fd.append('Prazo', state.prazo || '-');
    fd.append('Investimento', Logic.formatCurrency(state.investimento));
    fd.append('Nome', state.nome);
    fd.append('WhatsApp', state.whatsapp);
    if (state.email) fd.append('E-mail', state.email);
    return fd;
  }

  function submitWizard(e) {
    e.preventDefault();
    errorBox.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando… ⏳';

    fetch('https://formsubmit.co/ajax/8bccbc0af1756383496ac8812fae2780', {
      method: 'POST',
      body: buildFormData(),
      headers: { 'Accept': 'application/json' }
    })
    .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
    .then(function () {
      clearProgress();
      document.getElementById('bsNome').textContent = (state.nome || 'você') + '!';
      form.hidden = true;
      successBox.hidden = false;
      successBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    })
    .catch(function () {
      document.getElementById('wizardWaFallback').href = Logic.buildWhatsAppMessage(state);
      errorBox.hidden = false;
      errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    })
    .finally(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar minha ideia 🚀';
    });
  }

```

- [ ] **Step 2: Conectar o submit do form e o botão "enviar outra"**

No bloco `/* ===== INIT ===== */`, adicionar ao final:

```javascript
  form.addEventListener('submit', submitWizard);

  document.getElementById('briefingAgain').addEventListener('click', function () {
    clearProgress();
    location.reload();
  });
```

- [ ] **Step 3: Verificação manual — envio com sucesso**

No navegador, completar o wizard inteiro até a tela de revisão e clicar em "Enviar minha ideia 🚀". Expected: o botão mostra "Enviando… ⏳" brevemente, depois o formulário some e aparece a tela "Ideia recebida! 🎉" com o nome preenchido corretamente e o botão do WhatsApp. Verificar (na caixa de e-mail associada ao FormSubmit, ou nos logs de rede do DevTools) que a requisição POST foi enviada com todos os campos esperados, incluindo as respostas de branch. Verificar que `localStorage.getItem('wizardOrcamentoState')` retorna `null` após o envio.

- [ ] **Step 4: Verificação manual — fallback de falha de envio**

Trocar temporariamente, só para este teste, a URL do fetch em `src/wizard.js` por uma inválida (ex.: `https://formsubmit.co/ajax/000000000000000000000000000000`), recarregar, preencher e enviar. Expected: aparece a caixa de erro vermelha com o link "me manda direto no WhatsApp clicando aqui" — clicar nesse link e confirmar que abre o WhatsApp Web/app com uma mensagem pré-formatada contendo tipo de projeto, respostas de branch, ideia, prazo, investimento e nome. Depois de confirmar, **reverter a URL para a original** (`8bccbc0af1756383496ac8812fae2780`) antes de continuar.

- [ ] **Step 5: Commit**

```bash
git add src/wizard.js
git commit -m "feat: implementa envio do wizard com fallback de whatsapp"
```

---

### Task 9: Verificação manual end-to-end final

**Files:** nenhum arquivo novo — esta task só valida o que já foi implementado nas Tasks 1–8.

- [ ] **Step 1: Rodar a suíte de testes de lógica**

Run: `cd devcaiquesilva.github.io && node tests/wizard-logic.test.js`
Expected: `Todos os testes passaram.`

- [ ] **Step 2: Checklist manual completo (repetir para os 7 tipos de projeto)**

Com `python -m http.server 8080` rodando, em `http://localhost:8080/orcamento.html`, para cada um dos 7 tipos de projeto (Site institucional, Site pessoal, Loja virtual, Landing page, Aplicativo, Sistema/plataforma, Ainda não sei):
- Completar o wizard do início ao fim.
- Confirmar que as perguntas de branch (quando existem) batem com a tabela da spec.
- Confirmar que "Ainda não sei" pula direto para a descrição.
- Confirmar que o resumo lateral/chip mostra todas as respostas corretamente na tela de revisão.
- Enviar e confirmar a tela de sucesso.

- [ ] **Step 3: Checklist de mobile**

Usando o modo responsivo do DevTools (largura ≤ 480px): repetir o fluxo para um tipo de projeto e confirmar que o chip "Ver meu briefing ▾" funciona, os cards de tipo/branch/prazo ficam em coluna única, e os botões de navegação continuam visíveis e clicáveis sem cortar conteúdo.

- [ ] **Step 4: Checklist de persistência**

Preencher parcialmente, recarregar a página (F5) no meio do fluxo, confirmar que retoma de onde parou. Completar o envio e confirmar que o `localStorage` é limpo.

- [ ] **Step 5: Checklist sem JavaScript**

No navegador, desabilitar JavaScript (DevTools → Command Menu → "Disable JavaScript", ou `about:config` equivalente) e recarregar `orcamento.html`. Expected: aparece a mensagem de fallback incentivando contato via WhatsApp, sem tela em branco nem erros visuais. Reabilitar o JavaScript depois do teste.

- [ ] **Step 6: Atualizar o status da spec**

Em `docs/superpowers/specs/2026-07-21-wizard-orcamento-design.md`, alterar a linha `**Status:** aprovado, pronto para plano de implementação` para `**Status:** implementado e verificado manualmente`.

- [ ] **Step 7: Commit final**

```bash
git add docs/superpowers/specs/2026-07-21-wizard-orcamento-design.md
git commit -m "docs: marca spec do wizard de orcamento como implementada"
```
