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

    if (stepId === 'revisao') renderReview();
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
    saveProgress();
  }

  function goBack() {
    if (currentIndex === 0) return;
    currentIndex--;
    showStep(currentIndex);
    saveProgress();
  }

  /* ===== EVENTOS DE CAMPO ===== */
  function bindTypeEvents() {
    document.getElementById('wizardTypeGrid').addEventListener('change', function (e) {
      if (e.target.name !== 'wizardTipo') return;
      state.tipo = e.target.value;
      document.querySelectorAll('#wizardTypeGrid .type-card').forEach(function (c) { c.classList.remove('selected'); });
      e.target.closest('.type-card').classList.add('selected');
      updateSummary();
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
        updateSummary();
      });
    });
  }

  function bindPrazoEvents() {
    document.getElementById('wizardPrazoGrid').addEventListener('change', function (e) {
      if (e.target.name !== 'wizardPrazo') return;
      state.prazo = e.target.value;
      document.querySelectorAll('#wizardPrazoGrid .type-card').forEach(function (c) { c.classList.remove('selected'); });
      e.target.closest('.type-card').classList.add('selected');
      updateSummary();
    });
  }

  function bindDescricaoEvents() {
    document.getElementById('wizardDescricao').addEventListener('input', function (e) {
      state.descricao = e.target.value;
      updateSummary();
    });
  }

  function bindContatoEvents() {
    document.getElementById('wizardNome').addEventListener('input', function (e) { state.nome = e.target.value; updateSummary(); });
    document.getElementById('wizardZap').addEventListener('input', function (e) { state.whatsapp = e.target.value; updateSummary(); });
    document.getElementById('wizardEmail').addEventListener('input', function (e) { state.email = e.target.value; updateSummary(); });
  }

  /* ===== NAVEGACAO POR TECLADO ===== */
  form.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    if (e.target.tagName === 'TEXTAREA') return;
    if (steps[currentIndex] === 'revisao') return;
    e.preventDefault();
    goNext();
  });

  /* ===== SLIDER DE INVESTIMENTO ===== */
  function bindInvestSlider() {
    var range = document.getElementById('wizardInvestRange');
    var valueEl = document.getElementById('wizardInvestValue');
    function update() {
      state.investimento = parseInt(range.value, 10);
      valueEl.textContent = Logic.formatCurrency(state.investimento);
      updateSummary();
    }
    range.addEventListener('input', update);
    update();
  }

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
})();
