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

  /* ===== LINHA DA TIMELINE (preenche conforme o scroll) ===== */
  var tlProgress = document.querySelector('.timeline-line-progress');
  if (tlProgress && !reduceMotion) {
    var tlLine = tlProgress.parentElement;
    var tlTicking = false;
    var updateTimeline = function () {
      var viewH = window.innerHeight || document.documentElement.clientHeight;
      var r = tlLine.getBoundingClientRect();
      var p = r.height ? (viewH - r.top) / r.height : 1;
      p = Math.max(0, Math.min(1, p));
      tlProgress.style.transform = 'scaleY(' + p.toFixed(4) + ')';
      tlTicking = false;
    };
    /* capture pega o scroll de qualquer contêiner, não só da window */
    document.addEventListener('scroll', function () {
      if (!tlTicking) { tlTicking = true; requestAnimationFrame(updateTimeline); }
    }, { capture: true, passive: true });
    window.addEventListener('resize', updateTimeline);
    updateTimeline();
  }

  /* ===== TILT 3D (cards com data-tilt) ===== */
  if (window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
    document.querySelectorAll('[data-tilt]').forEach(function (el) {
      var max = parseFloat(el.getAttribute('data-tilt')) || 6;
      el.classList.add('tilt');
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--rx', (-py * max).toFixed(2) + 'deg');
        el.style.setProperty('--ry', (px * max).toFixed(2) + 'deg');
      });
      el.addEventListener('pointerleave', function () {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ===== FILTRO DE TECNOLOGIAS ===== */
  var filterBar = document.querySelector('.filter-bar');
  if (filterBar) {
    var techCards = document.querySelectorAll('.tech-grid .tech-card');
    filterBar.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter-chip');
      if (!btn) return;
      filterBar.querySelectorAll('.filter-chip').forEach(function (b) {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      var filtro = btn.getAttribute('data-filter');
      techCards.forEach(function (card) {
        card.classList.remove('fade-in', 'visible');
        card.style.removeProperty('--d');
        card.hidden = filtro !== 'all' && card.getAttribute('data-cat') !== filtro;
      });
    });
  }

  /* ===== CONSTELAÇÃO DE PARTÍCULAS (hero da home) ===== */
  var heroCanvas = document.getElementById('heroCanvas');
  if (heroCanvas && !reduceMotion && window.matchMedia('(min-width: 769px)').matches) {
    (function () {
      var ctx = heroCanvas.getContext('2d');
      var hero = heroCanvas.parentElement;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var W = 0, H = 0, parts = [], raf = null, onScreen = true;
      var mouse = { x: -9999, y: -9999 };
      var LINK = 130, MOUSE_LINK = 170;
      /* cores adaptadas ao modo claro/escuro */
      var darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var DOT_COLOR = darkMode ? 'rgba(122,177,255,0.55)' : 'rgba(26,110,245,0.35)';
      var LINE_RGB = darkMode ? '122,177,255' : '26,110,245';
      var MOUSE_RGB = darkMode ? '38,201,242' : '0,180,230';
      var LINE_ALPHA = darkMode ? 0.2 : 0.14;
      var MOUSE_ALPHA = darkMode ? 0.3 : 0.22;

      function resize() {
        W = hero.clientWidth;
        H = hero.clientHeight;
        heroCanvas.width = W * dpr;
        heroCanvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var n = Math.min(70, Math.round(W / 20));
        parts = [];
        for (var i = 0; i < n; i++) {
          parts.push({
            x: Math.random() * W, y: Math.random() * H,
            vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
            r: 1.2 + Math.random() * 1.8
          });
        }
      }

      function frame() {
        ctx.clearRect(0, 0, W, H);
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i];
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > W) p.vx *= -1;
          if (p.y < 0 || p.y > H) p.vy *= -1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = DOT_COLOR;
          ctx.fill();
          for (var j = i + 1; j < parts.length; j++) {
            var q = parts[j];
            var dx = p.x - q.x, dy = p.y - q.y;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d < LINK) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(q.x, q.y);
              ctx.strokeStyle = 'rgba(' + LINE_RGB + ',' + (LINE_ALPHA * (1 - d / LINK)).toFixed(3) + ')';
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
          var mdx = p.x - mouse.x, mdy = p.y - mouse.y;
          var md = Math.sqrt(mdx * mdx + mdy * mdy);
          if (md < MOUSE_LINK) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = 'rgba(' + MOUSE_RGB + ',' + (MOUSE_ALPHA * (1 - md / MOUSE_LINK)).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
        raf = (onScreen && !document.hidden) ? requestAnimationFrame(frame) : null;
      }

      function start() { if (!raf) raf = requestAnimationFrame(frame); }

      hero.addEventListener('pointermove', function (e) {
        var r = heroCanvas.getBoundingClientRect();
        mouse.x = e.clientX - r.left;
        mouse.y = e.clientY - r.top;
      });
      hero.addEventListener('pointerleave', function () { mouse.x = -9999; mouse.y = -9999; });
      window.addEventListener('resize', resize);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        if (onScreen) start();
      }).observe(hero);

      resize();
      start();
    })();
  }

  /* ===== BOTAO FLUTUANTE DO WHATSAPP ===== */
  if (!document.querySelector('.whatsapp-float')) {
    var waBtn = document.createElement('a');
    waBtn.className = 'whatsapp-float';
    waBtn.href = 'https://wa.me/5519999819875?text=' + encodeURIComponent('Olá, Caique! Vim pelo seu site 😊');
    waBtn.target = '_blank';
    waBtn.rel = 'noopener';
    waBtn.setAttribute('aria-label', 'Conversar no WhatsApp');
    waBtn.innerHTML = '<svg viewBox="0 0 32 32" width="30" height="30" fill="#fff" aria-hidden="true"><path d="M16.001 3C9.373 3 4 8.373 4 15c0 2.386.697 4.61 1.902 6.484L4 29l7.723-1.865A11.94 11.94 0 0 0 16.001 27C22.628 27 28 21.627 28 15S22.628 3 16.001 3zm0 21.818a9.77 9.77 0 0 1-4.985-1.363l-.357-.212-4.583 1.107 1.127-4.463-.232-.366A9.78 9.78 0 0 1 6.182 15c0-5.42 4.4-9.818 9.819-9.818 5.418 0 9.818 4.398 9.818 9.818 0 5.419-4.4 9.818-9.818 9.818zm5.396-7.35c-.295-.148-1.746-.86-2.017-.959-.27-.099-.467-.148-.664.148-.197.296-.762.958-.934 1.155-.172.198-.344.222-.639.074-.295-.148-1.244-.459-2.37-1.464-.876-.782-1.468-1.748-1.64-2.044-.172-.296-.018-.456.13-.603.134-.133.296-.345.443-.518.148-.173.197-.296.296-.494.099-.198.05-.371-.025-.519-.074-.148-.664-1.6-.91-2.192-.24-.577-.484-.499-.664-.508l-.566-.01c-.198 0-.519.074-.79.371-.271.296-1.036 1.012-1.036 2.469 0 1.457 1.06 2.864 1.208 3.062.148.198 2.086 3.186 5.055 4.467.706.305 1.257.487 1.686.623.708.225 1.353.193 1.862.117.568-.085 1.746-.714 1.992-1.403.246-.69.246-1.28.172-1.403-.074-.123-.27-.198-.567-.346z"/></svg>';
    document.body.appendChild(waBtn);
  }

})();
