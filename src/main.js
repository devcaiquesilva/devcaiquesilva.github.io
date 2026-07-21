(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===== SNACKBAR + COPIAR E-MAIL ===== */
  function showSnackbar() {
    var sb = document.getElementById('snackbar');
    if (!sb) return;
    sb.classList.add('show');
    setTimeout(function () { sb.classList.remove('show'); }, 2500);
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      showSnackbar();
    } catch (e) {}
    document.body.removeChild(ta);
  }

  window.copyEmail = function (e) {
    e.preventDefault();
    var email = 'devcaiquesilva@gmail.com';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(email).then(showSnackbar).catch(function () {
        fallbackCopy(email);
      });
    } else {
      fallbackCopy(email);
    }
  };

  /* ===== REVEAL COM STAGGER ===== */
  var revealEls = document.querySelectorAll('.fade-in');
  var parentCounts = new Map();
  revealEls.forEach(function (el) {
    if (!el.style.getPropertyValue('--d')) {
      var p = el.parentElement;
      var i = parentCounts.get(p) || 0;
      parentCounts.set(p, i + 1);
      el.style.setProperty('--d', (i % 8) * 0.08 + 's');
    }
  });
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  revealEls.forEach(function (el) { observer.observe(el); });
  document.querySelectorAll('.hero .fade-in').forEach(function (el) { el.classList.add('visible'); });

  /* ===== CONTADORES DO HERO ===== */
  var stats = document.querySelectorAll('.hero-stat-num[data-target]');
  function runCount(el) {
    var target = parseFloat(el.getAttribute('data-target'));
    var suffix = el.getAttribute('data-suffix') || '';
    if (reduceMotion) { el.textContent = target + suffix; return; }
    var t0 = null, dur = 1400;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var eased = 1 - Math.pow(2, -10 * p);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) { requestAnimationFrame(step); } else { el.textContent = target + suffix; }
    }
    requestAnimationFrame(step);
  }
  if (stats.length) {
    var statObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { runCount(en.target); statObs.unobserve(en.target); }
      });
    }, { threshold: 0.6 });
    stats.forEach(function (el) { statObs.observe(el); });
  }

  /* ===== NAV: SOMBRA + MENU MOBILE ===== */
  var navEl = document.querySelector('nav');
  function onScrollNav() { navEl.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScrollNav, { passive: true });
  onScrollNav();

  var navToggle = document.querySelector('.nav-toggle');
  if (navToggle) {
    navToggle.addEventListener('click', function () {
      var open = navEl.classList.toggle('menu-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navEl.classList.contains('menu-open')) {
        navEl.classList.remove('menu-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Abrir menu');
      }
    });
  }

  /* ===== BARRA DE PROGRESSO (fallback sem scroll-timeline) ===== */
  var bar = document.querySelector('.scroll-progress');
  if (bar && !(window.CSS && CSS.supports('animation-timeline: scroll()'))) {
    var ticking = false;
    var updateBar = function () {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      bar.style.transform = 'scaleX(' + (max ? h.scrollTop / max : 0) + ')';
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(updateBar); }
    }, { passive: true });
    updateBar();
  }

  /* ===== SPOTLIGHT NOS CARDS ===== */
  if (window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
    document.querySelectorAll('.exp-card, .project-card, .service-card').forEach(function (card) {
      card.classList.add('spot');
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

})();
