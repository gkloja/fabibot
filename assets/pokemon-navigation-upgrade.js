/*! Fabi Pokémon · Navegação única V22 */
(()=>{
  'use strict';
  const icon=id=>`/assets/nav-${id==='collection'?'pokedex':id}.svg`;
  const primary=[['world','Mundo'],['collection','Pokédex'],['arena','Arena']];
  const groups=[
    ['Sua jornada',[
      ['missions','Missões','Objetivos e recompensas'],
      ['training','Centro de Treino','Treine a equipe, normal ou intensivo'],['farm','Fazenda','Plante e colha berries'],
      ['season','Temporada','Seu passe e progresso'],
      ['achievements','Conquistas','Marcos da sua história']
    ]],
    ['Competir e negociar',[
      ['hall','Hall da Fama','Recordes e conquistas da comunidade'],
      ['boss','World Boss','Batalha da comunidade'],
      ['ranking','Ranking','Os melhores treinadores'],
      ['market','Mercado','Trocas e leilões'],
      ['shop','Loja','Itens para sua jornada'],
      ['drops','Caixas & Drops','Caixas grátis renovadas todos os dias']
    ]]
  ];
  const tabMap={};
  const $=s=>document.querySelector(s);
  const iconImg=(id,label,cls='pk-nav-icon-img')=>`<img class="${cls}" src="${icon(id)}" alt="" aria-hidden="true" decoding="async" loading="eager">`;
  function boot(){
    const inner=$('.pk-nav-inner'),actions=$('.pk-nav-actions');if(!inner||!actions)return;
    const nav=document.createElement('nav');nav.className='pk-header-tabs';nav.setAttribute('aria-label','Áreas principais');
    nav.innerHTML=primary.map(([id,label])=>`<button type="button" class="pk-h-tab" data-pk-nav="${id}" aria-controls="pkActivePanel"><span class="pk-nav-icon" aria-hidden="true">${iconImg(id,label)}</span><span>${label}</span></button>`).join('');
    inner.insertBefore(nav,actions);
    const optionCount=groups.reduce((total,[,items])=>total+items.length,0);
    const more=document.createElement('div');
    more.className='pk-more-wrap';
    more.innerHTML=`<button type="button" class="pk-h-tab pk-more-btn" id="pkMoreBtn" aria-expanded="false" aria-controls="pkMoreMenu" aria-label="Mais opções de menu, ${optionCount} áreas" title="Ver mais opções de menu"><span class="pk-nav-icon" aria-hidden="true">${iconImg('more','Mais')}</span><span>Mais</span><b class="pk-menu-count" aria-hidden="true">${optionCount}</b></button><nav id="pkMoreMenu" class="pk-more-menu" aria-label="Outras áreas" hidden>${groups.map(([label,items])=>`<section><h2>${label}</h2>${items.map(([id,name,desc])=>`<button type="button" class="pk-more-item" data-pk-nav="${id}"><span class="pk-more-icon" aria-hidden="true">${iconImg(id,name,'pk-more-icon-img')}</span><span><b>${name}</b><small>${desc}</small></span></button>`).join('')}</section>`).join('')}</nav>`;
    nav.append(more);

    const notif=$('#pkNotifBtn');
    if(notif){
      notif.innerHTML=`${iconImg('notif','Alertas','pk-btn-icon-img')}<span>Alertas</span><b id="pkNotifBadge" class="pk-notif-badge" hidden></b>`;
      notif.setAttribute('aria-label','Abrir notificações');
      notif.title='Notificações';
    }
    const home=actions.querySelector('a[href="/"]');
    if(home){
      home.innerHTML=`${iconImg('home','Início','pk-btn-icon-img')}<span>Início</span>`;
      home.setAttribute('aria-label','Voltar ao site Fabi Bot');
    }

    const sound=document.createElement('button');
    sound.type='button';sound.id='pkSoundBtn';sound.className='pk-nav-btn';
    sound.innerHTML=`${iconImg('sound','Efeitos sonoros','pk-btn-icon-img')}<span>Sons</span>`;
    sound.setAttribute('aria-label','Ativar efeitos sonoros');sound.setAttribute('aria-pressed','false');
    actions.append(sound);

    const music=document.createElement('button');
    music.type='button';music.id='pkMusicBtn';music.className='pk-nav-btn';
    music.innerHTML=`${iconImg('music','Música de fundo','pk-btn-icon-img')}<span>Música</span>`;
    music.setAttribute('aria-label','Música de fundo');music.setAttribute('aria-pressed','false');
    actions.append(music);

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
      const raw=e.detail.tab; const tab=tabMap[raw]||raw;
      document.querySelectorAll('[data-pk-nav]').forEach(b=>{const active=b.dataset.pkNav===tab;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
      $('#pkMoreBtn').classList.toggle('active',!primary.some(([id])=>id===tab));
    });
    const measure=()=>document.documentElement.style.setProperty('--pk-header-height',`${Math.ceil(inner.getBoundingClientRect().height)}px`);
    if(window.ResizeObserver)new ResizeObserver(measure).observe(inner);measure();
    document.dispatchEvent(new CustomEvent('pk:ready'));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
