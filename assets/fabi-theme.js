/**
 * Fabi Bot — Theme controller (dark / light)
 * Toggle lives in the page header/navbar — not floating.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'theme';
  var STORAGE_DARK = 'darkMode';
  var THEME_COLOR_DARK = '#080d12';
  var THEME_COLOR_LIGHT = '#f4f7f5';

  function safeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  }

  function resolveInitialTheme() {
    var stored = safeGet(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    var darkFlag = safeGet(STORAGE_DARK);
    if (darkFlag === 'false') return 'light';
    if (darkFlag === 'true') return 'dark';
    // Padrão sempre escuro — não segue o tema do sistema
    return 'dark';
  }

  function updateMetaThemeColor(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'light' ? THEME_COLOR_LIGHT : THEME_COLOR_DARK);
    }
    var scheme = document.querySelector('meta[name="color-scheme"]');
    if (scheme) {
      scheme.setAttribute('content', theme === 'light' ? 'light dark' : 'dark light');
    }
  }

  function updateToggleLabel(theme) {
    var btn = document.getElementById('fabiThemeToggle');
    if (!btn) return;
    var isLight = theme === 'light';
    btn.setAttribute('aria-label', isLight ? 'Ativar modo escuro' : 'Ativar modo claro');
    btn.setAttribute('title', isLight ? 'Modo escuro' : 'Modo claro');
  }

  function polishMascotForTheme(theme) {
    // Mantém o vídeo/GIF do mascote rodando nos dois temas.
    // O visual no claro é tratado só por CSS (máscara + sombra).
    var video = document.getElementById('fabiMascot');
    var img = document.getElementById('fabiCtaImg');
    if (video) {
      video.classList.remove('is-light-fallback');
      video.style.display = '';
      try {
        if (video.paused && video.readyState >= 2) {
          var p = video.play();
          if (p && typeof p.catch === 'function') p.catch(function () {});
        }
      } catch (_) {}
    }
    if (img) {
      img.classList.remove('is-light-visible');
      // só mostra a imagem se o vídeo não existir / falhar
      if (video) img.style.display = 'none';
    }
  }

  function applyTheme(theme, options) {
    options = options || {};
    var isLight = theme === 'light';
    var root = document.documentElement;
    var body = document.body;

    root.setAttribute('data-theme', theme);
    root.style.colorScheme = isLight ? 'light' : 'dark';
    root.classList.toggle('light-mode', isLight);
    root.classList.toggle('dark-mode', !isLight);

    if (body) {
      body.classList.toggle('light-mode', isLight);
      body.classList.toggle('dark-mode', !isLight);
    }

    safeSet(STORAGE_KEY, theme);
    safeSet(STORAGE_DARK, isLight ? 'false' : 'true');
    updateMetaThemeColor(theme);
    updateToggleLabel(theme);
    polishMascotForTheme(theme);

    if (!options.silent) {
      try {
        window.dispatchEvent(
          new CustomEvent('fabi-theme-change', { detail: { theme: theme, isLight: isLight } })
        );
      } catch (_) {}
    }
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || resolveInitialTheme();
    applyTheme(current === 'light' ? 'dark' : 'light');
  }

  function createToggleButton() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'fabiThemeToggle';
    btn.className = 'fabi-theme-toggle icon-btn';
    btn.setAttribute('aria-label', 'Alternar tema');
    btn.innerHTML =
      '<i class="fas fa-sun fabi-theme-icon-sun" aria-hidden="true"></i>' +
      '<i class="fas fa-moon fabi-theme-icon-moon" aria-hidden="true"></i>';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleTheme();
    });
    return btn;
  }

  function findHeaderMount() {
    // Priority: known action bars / right side of headers
    var selectors = [
      '.right-nav',
      '.pk-nav-actions',
      '.fabi-topbar-in',
      '.fabi-nav',
      '.navbar .nav-content',
      'header .pk-nav-inner',
      'header.fabi-topbar',
      'nav.navbar',
      'header'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) return { el: el, selector: selectors[i] };
    }
    return null;
  }

  function ensureToggleButton() {
    // Remove floating leftovers
    var floating = document.querySelectorAll('.fabi-theme-toggle.floating, .floating-theme');
    for (var i = 0; i < floating.length; i++) {
      if (floating[i].id !== 'fabiThemeToggle') floating[i].remove();
    }

    var existing = document.getElementById('fabiThemeToggle');
    if (existing) {
      // If still floating at body root, move into header
      var mount = findHeaderMount();
      if (mount && !mount.el.contains(existing)) {
        placeInHeader(existing, mount);
      }
      return;
    }

    var btn = createToggleButton();
    var mountInfo = findHeaderMount();
    if (mountInfo) {
      placeInHeader(btn, mountInfo);
    } else {
      // Fallback only if no header exists yet — try again shortly
      document.body.appendChild(btn);
      btn.classList.add('fabi-theme-fallback');
      setTimeout(function () {
        var m = findHeaderMount();
        if (m && btn.parentNode === document.body) placeInHeader(btn, m);
      }, 400);
    }
  }

  function placeInHeader(btn, mountInfo) {
    var el = mountInfo.el;
    var sel = mountInfo.selector;
    btn.classList.remove('fabi-theme-fallback');
    btn.classList.add('fabi-theme-toggle');

    if (sel === '.right-nav') {
      // Index: before profile container
      var profile = document.getElementById('profileContainer');
      if (profile && profile.parentNode === el) {
        el.insertBefore(btn, profile);
      } else {
        el.appendChild(btn);
      }
      return;
    }

    if (sel === '.pk-nav-actions') {
      // Pokémon: first action (left of alerts)
      el.insertBefore(btn, el.firstChild);
      return;
    }

    if (sel === '.fabi-topbar-in' || sel === '.fabi-nav') {
      // V2 pages: append next to nav links
      var nav = el.classList.contains('fabi-nav') ? el : el.querySelector('.fabi-nav');
      if (nav) {
        nav.appendChild(btn);
      } else {
        el.appendChild(btn);
      }
      return;
    }

    if (sel === '.navbar .nav-content') {
      var right = el.querySelector('.right-nav');
      if (right) {
        var profile2 = document.getElementById('profileContainer');
        if (profile2 && profile2.parentNode === right) right.insertBefore(btn, profile2);
        else right.appendChild(btn);
      } else {
        el.appendChild(btn);
      }
      return;
    }

    el.appendChild(btn);
  }

  window.FabiTheme = {
    apply: applyTheme,
    toggle: toggleTheme,
    get: function () {
      return document.documentElement.getAttribute('data-theme') || resolveInitialTheme();
    },
    isLight: function () {
      return this.get() === 'light';
    }
  };

  window.aplicarTemaEscuro = function () {
    applyTheme('dark');
  };
  window.aplicarTemaClaro = function () {
    applyTheme('light');
  };
  window.toggleDarkMode = function () {
    toggleTheme();
  };

  function boot() {
    var theme = resolveInitialTheme();
    applyTheme(theme, { silent: true });
    ensureToggleButton();
    updateToggleLabel(theme);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
