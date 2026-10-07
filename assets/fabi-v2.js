/* FABI PLATFORM V2 — safe progressive enhancement */
(function(){
  'use strict';

  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, {once:true});
    else fn();
  }

  ready(function(){
    document.documentElement.classList.add('fabi-v2-ready');

    // External links: safer defaults.
    document.querySelectorAll('a[target="_blank"]').forEach(function(a){
      var rel = new Set((a.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
      rel.add('noopener'); rel.add('noreferrer');
      a.setAttribute('rel', Array.from(rel).join(' '));
    });

    // Do not present a raw "0 online" state as if it were a failure.
    var online = document.getElementById('onlineCount');
    if(online){
      var holder = online.parentElement;
      function syncOnline(){
        var n = Number(String(online.textContent || '').replace(/\D/g,'')) || 0;
        if(holder) holder.dataset.fabiZeroState = n <= 0 ? 'true' : 'false';
      }
      syncOnline();
      try { new MutationObserver(syncOnline).observe(online,{childList:true,characterData:true,subtree:true}); } catch(_){}
    }

    // Current page state for standalone navigation.
    var path = location.pathname.replace(/\/+$/,'') || '/';
    document.querySelectorAll('.fabi-nav a').forEach(function(a){
      try{
        var ap = new URL(a.href, location.href).pathname.replace(/\/+$/,'') || '/';
        if(ap === path) a.setAttribute('aria-current','page');
      }catch(_){}
    });

    // Copy command buttons.
    document.querySelectorAll('[data-copy-command]').forEach(function(btn){
      btn.addEventListener('click', async function(){
        var cmd = btn.getAttribute('data-copy-command') || '';
        try{
          await navigator.clipboard.writeText(cmd);
          var old = btn.innerHTML;
          btn.textContent = '✓';
          btn.setAttribute('aria-label','Copiado');
          setTimeout(function(){ btn.innerHTML = old; btn.setAttribute('aria-label','Copiar comando'); },1000);
        }catch(_){}
      });
    });

    // Command search/filter.
    var search = document.querySelector('[data-command-search]');
    if(search){
      search.addEventListener('input', function(){
        var q = search.value.trim().toLowerCase();
        document.querySelectorAll('[data-command-item]').forEach(function(row){
          var hay = (row.textContent || '').toLowerCase();
          row.hidden = !!q && !hay.includes(q);
        });
        document.querySelectorAll('[data-command-group]').forEach(function(group){
          var visible = Array.from(group.querySelectorAll('[data-command-item]')).some(function(x){ return !x.hidden; });
          group.hidden = !visible;
        });
      });
    }
  });
})();
