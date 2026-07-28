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
  var hasNavigated = false;
  var EMAIL_RE = /^\S+@\S+\.\S+$/;

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

    if (hasNavigated && target) {
      var q = target.querySelector('.wizard-question');
      if (q) { q.setAttribute('tabindex', '-1'); q.focus({ preventScroll: true }); }
    }
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
    if (stepId === 'contato') {
      if (state.email && !EMAIL_RE.test(state.email.trim())) return false;
      return state.nome.trim().length > 0 && state.whatsapp.trim().length > 0;
    }
    return true;
  }

  function markContatoFields() {
    [
      ['wizardNome', !state.nome.trim()],
      ['wizardZap', !state.whatsapp.trim()],
      ['wizardEmail', !!(state.email && !EMAIL_RE.test(state.email.trim()))]
    ].forEach(function (p) {
      document.getElementById(p[0]).classList.toggle('input-invalid', p[1]);
    });
  }

  function shakeCurrentStep() {
    var section = document.querySelector('.wizard-step[data-step="' + steps[currentIndex] + '"]');
    if (!section) return;
    section.classList.remove('shake');
    void section.offsetWidth;
    section.classList.add('shake');
  }

  function goNext() {
    if (!isStepValid(currentIndex)) {
      if (steps[currentIndex] === 'contato') markContatoFields();
      shakeCurrentStep();
      return;
    }
    hasNavigated = true;

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
    hasNavigated = true;
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
    document.getElementById('wizardNome').addEventListener('input', function (e) { state.nome = e.target.value; e.target.classList.remove('input-invalid'); updateSummary(); });
    document.getElementById('wizardZap').addEventListener('input', function (e) { state.whatsapp = e.target.value; e.target.classList.remove('input-invalid'); updateSummary(); });
    document.getElementById('wizardEmail').addEventListener('input', function (e) { state.email = e.target.value; e.target.classList.remove('input-invalid'); updateSummary(); });
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
    range.min = Logic.INVEST_MIN;
    range.max = Logic.INVEST_MAX;
    range.step = Logic.INVEST_STEP;
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

    try {
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
    } catch (e) {}
  }

  /* ===== ENVIO ===== */
  var errorBox = document.getElementById('wizardError');
  var successBox = document.getElementById('briefingSuccess');

  /* EmailJS: e-mail formatado com o template do site (IDs públicos, sem risco) */
  var EMAILJS = {
    serviceId: 'service_gbh96cp',
    templateId: 'template_0mo4v36',
    publicKey: 'ATXBj7Xv4IsxZ2k63'
  };

  function buildClientWhatsAppLink() {
    var digits = (state.whatsapp || '').replace(/\D/g, '');
    if (digits.length >= 10 && digits.indexOf('55') !== 0) digits = '55' + digits;
    var primeiroNome = (state.nome || '').trim().split(' ')[0];
    var msg = 'Olá' + (primeiroNome ? ', ' + primeiroNome : '') + '! Aqui é a Paju Code 😊 Recebemos a sua ideia pelo site e já vamos te responder!';
    return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(msg);
  }

  function buildTemplateParams() {
    var extras = Logic.getBranchQuestions(state.tipo).map(function (q) {
      return q.field + ' ' + (state.branchAnswers[q.field] || '—');
    }).join('\n');
    return {
      tipo: state.tipo || '—',
      extras: extras || '—',
      descricao: state.descricao || '—',
      prazo: state.prazo || '—',
      investimento: Logic.formatCurrency(state.investimento),
      nome: state.nome || '—',
      whatsapp: state.whatsapp || '—',
      email: state.email || '—',
      reply_to: state.email || '',
      whatsapp_link: buildClientWhatsAppLink(),
      data: new Date().toLocaleString('pt-BR')
    };
  }

  function sendViaEmailJs() {
    return fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS.serviceId,
        template_id: EMAILJS.templateId,
        user_id: EMAILJS.publicKey,
        template_params: buildTemplateParams()
      })
    }).then(function (r) { if (!r.ok) throw new Error('emailjs ' + r.status); });
  }

  function sendViaFormSubmit() {
    return fetch('https://formsubmit.co/ajax/8bccbc0af1756383496ac8812fae2780', {
      method: 'POST',
      body: buildFormData(),
      headers: { 'Accept': 'application/json' }
    }).then(function (r) { if (!r.ok) throw new Error('formsubmit ' + r.status); return r.json(); });
  }

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

    sendViaEmailJs()
    .catch(function () { return sendViaFormSubmit(); })
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
      submitBtn.textContent = 'Enviar';
    });
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

  form.addEventListener('submit', submitWizard);

  document.getElementById('briefingAgain').addEventListener('click', function () {
    clearProgress();
    location.reload();
  });
})();
