/**
 * Fabi Bot — Theme controller (dark / light)
 * Shared across pages. Persists preference and syncs UI.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'theme';
  var STORAGE_DARK = 'darkMode';
  var THEME_COLOR_DARK = '#080d12';
  var THEME_COLOR_LIGHT = '#f9fafb';

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
    // Prefer system preference when no stored choice
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    } catch (_) {}
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
    var video = document.getElementById('fabiMascot');
    var img = document.getElementById('fabiCtaImg');
    if (!video && !img) return;

    if (theme === 'light') {
      // Prefer static image in light mode — video with dark plate looks harsh on white
      if (video) {
        video.classList.add('is-light-fallback');
        try {
          video.pause();
        } catch (_) {}
      }
      if (img) {
        img.classList.add('is-light-visible');
        img.style.display = 'block';
      }
    } else {
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
        // keep fallback logic of the page; only hide if video is active
        if (video && !video.classList.contains('is-light-fallback')) {
          img.style.display = 'none';
        }
      }
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

  function ensureToggleButton() {
    if (document.getElementById('fabiThemeToggle')) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'fabiThemeToggle';
    btn.className = 'fabi-theme-toggle';
    btn.setAttribute('aria-label', 'Alternar tema');
    btn.innerHTML =
      '<i class="fas fa-sun fabi-theme-icon-sun" aria-hidden="true"></i>' +
      '<i class="fas fa-moon fabi-theme-icon-moon" aria-hidden="true"></i>';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      toggleTheme();
    });

    // Prefer existing floating-theme slot if present
    var legacy = document.querySelector('.floating-theme');
    if (legacy) {
      legacy.replaceWith(btn);
    } else {
      document.body.appendChild(btn);
    }
  }

  // Public API
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

  // Back-compat for index.html old helpers
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
