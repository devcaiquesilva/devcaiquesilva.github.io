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
