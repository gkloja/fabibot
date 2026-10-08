/*! Pokémon Adventure · Navigation Upgrade */
(function () {
  'use strict';
  const PRIMARY = [
    { id: 'world', label: 'Mundo', icon: 'fa-compass' },
    { id: 'collection', label: 'Pokédex', icon: 'fa-book' },
    { id: 'missions', label: 'Missões', icon: 'fa-list-check' },
    { id: 'arena', label: 'Arena', icon: 'fa-hand-fist' },
    { id: 'market', label: 'Mercado', icon: 'fa-right-left' },
    { id: 'hall', label: 'Hall da Fama', icon: 'fa-landmark' }
  ];
  const SECONDARY = [
    { id: 'farm', label: 'Fazenda', icon: 'fa-seedling' },
    { id: 'boss', label: 'Boss', icon: 'fa-dragon' },
    { id: 'season', label: 'Temporada', icon: 'fa-ticket' },
    { id: 'ranking', label: 'Ranking', icon: 'fa-trophy' },
    { id: 'shop', label: 'Loja', icon: 'fa-cart-shopping' },
    { id: 'achievements', label: 'Conquistas', icon: 'fa-medal' }
  ];
  const DOCK = [
    { id: 'world', label: 'Mundo', icon: 'fa-compass' },
    { id: 'collection', label: 'Pokédex', icon: 'fa-book' },
    { id: 'missions', label: 'Missões', icon: 'fa-list-check' },
    { id: 'arena', label: 'Arena', icon: 'fa-hand-fist' },
    { id: 'more', label: 'Mais', icon: 'fa-ellipsis' }
  ];
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function currentTab() {
    const active = $('.pk-tab.active[data-tab]');
    if (active) return active.getAttribute('data-tab');
    try {
      const u = new URL(location.href);
      return u.searchParams.get('tab') || sessionStorage.getItem('pk_last_tab') || 'world';
    } catch (_) { return 'world'; }
  }
  function go(tab) {
    if (!tab) return;
    try { sessionStorage.setItem('pk_last_tab', tab); } catch (_) {}
    const btn = $(`.pk-tab[data-tab="${tab}"]`);
    if (btn) { btn.click(); setTimeout(sync, 30); return; }
    try {
      const u = new URL(location.href);
      u.searchParams.set('tab', tab);
      history.replaceState(null, '', u.toString());
    } catch (_) {}
    const fake = document.createElement('button');
    fake.className = 'pk-tab';
    fake.setAttribute('data-action', 'tab');
    fake.setAttribute('data-tab', tab);
    fake.style.display = 'none';
    document.body.appendChild(fake);
    fake.click();
    setTimeout(() => fake.remove(), 0);
    setTimeout(sync, 80);
  }
  function ensureHeaderScaffold() {
    const actions = $('.pk-nav-actions');
    const inner = $('.pk-nav-inner');
    if (!inner) return;
    if (actions && !$('#pkSoundBtn')) {
      const b=document.createElement('button');b.id='pkSoundBtn';b.className='pk-nav-btn';b.type='button';b.textContent='♪';b.title='Ativar efeitos sonoros';b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed','false');actions.appendChild(b);
    }
    if (!$('.pk-header-tabs')) {
      const tabs = document.createElement('nav');
      tabs.className = 'pk-header-tabs';
      tabs.setAttribute('aria-label', 'Atalhos principais');
      tabs.innerHTML = PRIMARY.map(t =>
        `<button type="button" class="pk-h-tab" title="${t.label}" aria-label="${t.label}" data-pk-nav="${t.id}"><i class="fa-solid ${t.icon}" aria-hidden="true"></i><span class="pk-h-label">${t.label}</span></button>`
      ).join('');
      if (actions) inner.insertBefore(tabs, actions);
      else inner.appendChild(tabs);
    }
    if (!$('.pk-more-wrap') && actions) {
      const wrap = document.createElement('div');
      wrap.className = 'pk-more-wrap';
      wrap.innerHTML =
        `<button type="button" class="pk-more-btn" id="pkMoreBtn" aria-expanded="false" aria-haspopup="true"><i class="fa-solid fa-layer-group" aria-hidden="true"></i><span>Mais</span></button>` +
        `<div class="pk-more-menu" id="pkMoreMenu" role="menu"></div>`;
      actions.insertBefore(wrap, actions.firstChild);
      $('#pkMoreMenu', wrap).innerHTML = SECONDARY.map(t =>
        `<button type="button" class="pk-more-item" role="menuitem" data-pk-nav="${t.id}"><i class="fa-solid ${t.icon}" aria-hidden="true"></i><span>${t.label}</span></button>`
      ).join('');
    }
  }
  function ensureDock() {
    if ($('.pk-dock')) return;
    const dock = document.createElement('nav');
    dock.className = 'pk-dock';
    dock.setAttribute('aria-label', 'Navegação rápida');
    dock.innerHTML = DOCK.map(t =>
      `<button type="button" class="pk-dock-btn" data-pk-dock="${t.id}"><i class="fa-solid ${t.icon}" aria-hidden="true"></i><span>${t.label}</span></button>`
    ).join('');
    document.body.appendChild(dock);
    document.body.classList.add('pk-has-dock');
  }
  function sync() {
    const tab = currentTab();
    $$('.pk-h-tab').forEach(el => el.classList.toggle('active', el.getAttribute('data-pk-nav') === tab));
    $$('.pk-more-item').forEach(el => el.classList.toggle('active', el.getAttribute('data-pk-nav') === tab));
    $$('.pk-dock-btn').forEach(el => {
      const id = el.getAttribute('data-pk-dock');
      el.classList.toggle('active', id === tab || (id === 'more' && SECONDARY.some(s => s.id === tab)));
    });
    $$('.pk-tab[data-tab]').forEach(el => el.classList.toggle('active', el.getAttribute('data-tab') === tab));
  }
  function closeMore() {
    const btn = $('#pkMoreBtn'), menu = $('#pkMoreMenu');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (menu) menu.classList.remove('open');
  }
  function toggleMore() {
    const btn = $('#pkMoreBtn'), menu = $('#pkMoreMenu');
    if (!btn || !menu) return;
    const open = menu.classList.contains('open');
    if (open) closeMore();
    else { menu.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
  }
  function bind() {
    document.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-pk-nav]');
      if (nav) { e.preventDefault(); go(nav.getAttribute('data-pk-nav')); closeMore(); return; }
      const dock = e.target.closest('[data-pk-dock]');
      if (dock) {
        e.preventDefault();
        const id = dock.getAttribute('data-pk-dock');
        if (id === 'more') { toggleMore(); return; }
        go(id); closeMore(); return;
      }
      if (e.target.closest('#pkMoreBtn')) { e.preventDefault(); toggleMore(); return; }
      if (!e.target.closest('.pk-more-wrap')) closeMore();
      if (e.target.closest('.pk-tab[data-tab]')) setTimeout(sync, 30);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMore(); });
    const app = $('#pkApp');
    if (app) {
      new MutationObserver(() => { ensureHeaderScaffold(); sync(); })
        .observe(app, { childList: true, subtree: true });
    }
  }
  function boot() {
    ensureHeaderScaffold();
    ensureDock();
    bind();
    sync();
    const params = new URLSearchParams(location.search);
    if (!params.has('tab') && !params.has('trade') && !params.has('auction')) {
      let last = null;
      try { last = sessionStorage.getItem('pk_last_tab'); } catch (_) {}
      if (last && last !== 'world') {
        let attempts = 0;
        const timer = setInterval(() => {
          if ($('.pk-tab[data-tab]')) { clearInterval(timer); go(last); }
          else if (++attempts > 40) clearInterval(timer);
        }, 250);
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
