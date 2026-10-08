/*! Fabi Pokémon · Navegação única V4 */
(()=>{
  'use strict';
  const primary=[['world','Mundo','🧭'],['collection','Pokédex','◉'],['arena','Arena','⚔']];
  const groups=[['Sua jornada',[['missions','Missões','☷','Objetivos e recompensas'],['farm','Fazenda','❀','Plante e colha berries'],['season','Temporada','⚑','Seu passe e progresso'],['achievements','Conquistas','✦','Marcos da sua história']]],['Competir e negociar',[['hall','Hall da Fama','♜','Recordes e conquistas da comunidade'],['boss','World Boss','♜','Batalha da comunidade'],['ranking','Ranking','♛','Os melhores treinadores'],['market','Mercado','⇄','Trocas e leilões'],['shop','Loja','◇','Itens para sua jornada']]]];
  const $=s=>document.querySelector(s);
  function iconForTab(id){
    const paths={world:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5Z"/>',collection:'<path d="M12 5v15M3 4l9 2 9-2v15l-9 2-9-2Z"/>',arena:'<path d="m4 3 3 1 13 13-3 3L4 7Zm16 0-3 1-5 5M4 20l5-5M2 17l5 5m10-20-3 5"/>',hall:'<path d="m3 9 9-6 9 6ZM5 11v8m7-8v8m7-8v8M3 21h18"/>'};
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id]||paths.world}</svg>`;
  }
  function boot(){
    const inner=$('.pk-nav-inner'),actions=$('.pk-nav-actions');if(!inner||!actions)return;
    const nav=document.createElement('nav');nav.className='pk-header-tabs';nav.setAttribute('aria-label','Áreas principais');
    nav.innerHTML=primary.map(([id,label,icon])=>`<button type="button" class="pk-h-tab" data-pk-nav="${id}" aria-controls="pkActivePanel"><span class="pk-nav-icon" aria-hidden="true">${iconForTab(id)}</span><span>${label}</span></button>`).join('');inner.insertBefore(nav,actions);
    const optionCount=groups.reduce((total,[,items])=>total+items.length,0);
    const more=document.createElement('div');more.className='pk-more-wrap';more.innerHTML=`<button type="button" class="pk-h-tab pk-more-btn" id="pkMoreBtn" aria-expanded="false" aria-controls="pkMoreMenu" aria-label="Mais opções de menu, ${optionCount} áreas" title="Ver mais opções de menu"><span class="pk-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg></span><span>Mais</span><b class="pk-menu-count" aria-hidden="true">${optionCount}</b></button><nav id="pkMoreMenu" class="pk-more-menu" aria-label="Outras áreas" hidden>${groups.map(([label,items])=>`<section><h2>${label}</h2>${items.map(([id,name,icon,desc])=>`<button type="button" class="pk-more-item" data-pk-nav="${id}"><span aria-hidden="true">${icon}</span><span><b>${name}</b><small>${desc}</small></span></button>`).join('')}</section>`).join('')}</nav>`;nav.append(more);
    const sound=document.createElement('button');sound.type='button';sound.id='pkSoundBtn';sound.className='pk-nav-btn';sound.textContent='♪';sound.setAttribute('aria-label','Ativar efeitos sonoros');sound.setAttribute('aria-pressed','false');actions.append(sound);
    const music=document.createElement('button');music.type='button';music.id='pkMusicBtn';music.className='pk-nav-btn';music.textContent='♫';music.setAttribute('aria-label','Música de fundo');music.setAttribute('aria-pressed','false');actions.append(music);
    const alerts=$('#pkNotifBtn');alerts?.setAttribute('aria-label','Abrir notificações');
    const home=actions.querySelector('a[href="/"]');home?.setAttribute('aria-label','Voltar ao site Fabi Bot');
    function close(focus=false){$('#pkMoreMenu').hidden=true;$('#pkMoreBtn').setAttribute('aria-expanded','false');if(focus)$('#pkMoreBtn').focus()}
    document.addEventListener('click',e=>{
      const item=e.target.closest('[data-pk-nav]');
      if(item){const tab=item.dataset.pkNav;close();document.dispatchEvent(new CustomEvent('pk:navigate',{detail:{tab}}));return}
      if(e.target.closest('#pkMoreBtn')){const menu=$('#pkMoreMenu'),opening=menu.hidden;menu.hidden=!opening;$('#pkMoreBtn').setAttribute('aria-expanded',String(opening));if(opening)menu.querySelector('button')?.focus();return}
      if(!e.target.closest('.pk-more-wrap'))close();
    });
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#pkMoreMenu').hidden){e.preventDefault();close(true)}});
    document.addEventListener('focusin',e=>{if(!e.target.closest('.pk-more-wrap'))close()});
    document.addEventListener('pk:tabchange',e=>{
      const tab=e.detail.tab;
      document.querySelectorAll('[data-pk-nav]').forEach(b=>{const active=b.dataset.pkNav===tab;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
      $('#pkMoreBtn').classList.toggle('active',!primary.some(([id])=>id===tab));
    });
    const measure=()=>document.documentElement.style.setProperty('--pk-header-height',`${Math.ceil(inner.getBoundingClientRect().height)}px`);
    if(window.ResizeObserver)new ResizeObserver(measure).observe(inner);measure();
    document.dispatchEvent(new CustomEvent('pk:ready'));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
