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
