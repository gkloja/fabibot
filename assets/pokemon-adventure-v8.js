(()=>{
'use strict';
const PROXY_HOST='https://orange-hill-2e61.gbscabral15.workers.dev';
const BACKEND='http://br2.bronxyshost.com:4009';
const BACKEND_HOST=BACKEND.replace(/^https?:\/\//,'').replace(/\/$/,'');
const API_URL=PROXY_HOST+'/'+BACKEND_HOST+'/proxy?url=';

// Mesmo padrão usado no conectar.html:
// o destino COMPLETO vai dentro do parâmetro ?url= do Worker.
function proxyUrl(target){
  return API_URL+encodeURIComponent(String(target||''));
}
const CATALOG_URL='/assets/pokemons.json';
let LOCAL_CATALOG=null;
const APP_ID='6ba779b7-14c6-4a31-b955-0c8567a9039b';
const state={profile:null,ranking:[],market:null,tradeTarget:null,tab:'world',biome:'random',busy:false,query:'',rarity:'all',timer:null,rankTimer:null,rankMode:'global',pixWatch:null};
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fmt=n=>Number(n||0).toLocaleString('pt-BR');
const pct=n=>`${Math.round(Number(n||0)*100)}%`;
const R_LABEL={common:'Comum',uncommon:'Incomum',rare:'Raro',epic:'Épico',legendary:'Lendário',mythical:'Mítico'};
const R_EMOJI={common:'⚪',uncommon:'🔵',rare:'🟣',epic:'🟠',legendary:'🟡',mythical:'🔴'};
const TYPE_PT={normal:'Normal',fire:'Fogo',water:'Água',electric:'Elétrico',grass:'Planta',ice:'Gelo',fighting:'Lutador',poison:'Veneno',ground:'Terra',flying:'Voador',psychic:'Psíquico',bug:'Inseto',rock:'Pedra',ghost:'Fantasma',dark:'Sombrio',dragon:'Dragão',steel:'Aço',fairy:'Fada'};

async function loadLocalCatalog(){
  if(LOCAL_CATALOG)return LOCAL_CATALOG;
  const res=await fetch(CATALOG_URL,{cache:'no-store'});
  if(!res.ok)throw new Error(`Catálogo local HTTP ${res.status}`);
  const data=await res.json();
  if(!data||typeof data!=='object')throw new Error('Catálogo local inválido.');
  LOCAL_CATALOG=data;
  return data;
}
function localSpecies(id){
  if(!LOCAL_CATALOG)return null;
  if(Array.isArray(LOCAL_CATALOG))return LOCAL_CATALOG.find(x=>Number(x?.id)===Number(id))||null;
  return LOCAL_CATALOG[String(id)]||LOCAL_CATALOG[Number(id)]||null;
}


function session(){
  let s={};
  for(const key of ['fabi_session','neconecta_user_session']){
    try{const x=JSON.parse(localStorage.getItem(key)||'null');if(x&&typeof x==='object')s={...s,...x};}catch(_){ }
  }
  return {numero:String(s.numero||s.telefone||s.phone||'').replace(/\D/g,''),nome:String(s.nome||s.username||s.name||'Treinador').slice(0,80),avatar:s.avatar||s.foto||s.fotoPerfil||'/flogo.jpg'};
}
function backendTarget(path){
  if(!path)return BACKEND;
  if(/^https?:\/\//i.test(path))return path;
  return BACKEND.replace(/\/$/,'')+(String(path).startsWith('/')?'':'/')+String(path);
}
function targetWithAuth(path){
  const u=session();
  const target=new URL(backendTarget(path));
  if(u.numero)target.searchParams.set('numero',u.numero);
  if(u.nome)target.searchParams.set('nome',u.nome);
  return target.toString();
}
function endpoint(path){return proxyUrl(backendTarget(path))}
function withAuth(path){return proxyUrl(targetWithAuth(path))}
async function api(path,opts={}){
  const method=(opts.method||'GET').toUpperCase();
  const u=session();
  let body=opts.body||null;

  if(method!=='GET'&&method!=='HEAD'){
    body={...(body||{}),contaNumero:u.numero,nomeUsuario:u.nome,nomeConta:u.nome};
  }

  // GET não envia headers personalizados: evita preflight CORS desnecessário.
  const requestOptions={method,mode:'cors'};
  if(method!=='GET'&&method!=='HEAD'){
    requestOptions.headers={'Content-Type':'application/json',...(opts.headers||{})};
    requestOptions.body=body?JSON.stringify(body):undefined;
  }

  let res;
  try{
    res=await fetch(method==='GET'?withAuth(path):endpoint(path),requestOptions);
  }catch(fetchErr){
    const e=new Error('Falha ao acessar o Proxy da Fabi.');
    e.cause=fetchErr;
    e.stage='proxy';
    throw e;
  }

  const raw=await res.text();
  let data;
  try{
    data=raw?JSON.parse(raw):{};
  }catch(_){
    const e=new Error(`Resposta inválida do backend (HTTP ${res.status}).`);
    e.status=res.status;
    e.preview=raw.slice(0,180);
    e.stage='backend-response';
    throw e;
  }

  if(!res.ok||data.success===false){
    const e=new Error(data.error||data.message||`Backend respondeu HTTP ${res.status}.`);
    e.status=res.status;
    e.remainingMs=data.remainingMs;
    e.energyCost=data.energyCost;
    e.stage='backend';
    throw e;
  }
  return data;
}
function imageUrl(sp){
  const id=Number(sp?.id||sp?.speciesId||0);
  return id?proxyUrl(`${BACKEND}/pokemon/images/artwork_${id}.png`):'/flogo.jpg';
}
function fallback(sp){
  const id=Number(sp?.id||sp?.speciesId||0);
  const local=id?localSpecies(id):null;
  return sp?.artworkFallback||sp?.artwork||local?.artwork||local?.sprite||'/flogo.jpg';
}
function timeLeft(iso){const ms=Date.parse(iso||0)-Date.now();if(ms<=0)return'PRONTO';const h=Math.floor(ms/3600000),m=Math.ceil((ms%3600000)/60000);return h?`${h}h ${m}min`:`${Math.max(1,m)}min`}
function xpNeed(l){return 100+(Math.max(1,Number(l))-1)*45}
function seasonTimeLeft(iso){const ms=Math.max(0,Date.parse(iso||0)-Date.now());const d=Math.ceil(ms/86400000);if(d>=2)return `${d}d`;const h=Math.ceil(ms/3600000);return h?`${h}h`:'encerrando';}
function toast(msg,type='ok'){const w=$('#pkToastWrap');if(!w)return;const t=document.createElement('div');t.className='pk-toast'+(type==='err'?' err':'');t.textContent=msg;w.appendChild(t);setTimeout(()=>t.remove(),4200)}
function setBusy(v){state.busy=v;$$('[data-action]').forEach(b=>{if(b.tagName==='BUTTON')b.disabled=v})}
function rarityLabel(r){return R_LABEL[r]||r}
function typesLabel(arr){return (arr||[]).map(t=>TYPE_PT[t]||t).join(' / ')}

async function initOneSignal(){
  const u=session();if(!u.numero)return;
  window.OneSignalDeferred=window.OneSignalDeferred||[];
  window.OneSignalDeferred.push(async OneSignal=>{
    try{
      await OneSignal.init({appId:APP_ID,serviceWorkerPath:'/sw.js',serviceWorkerParam:{scope:'/'},notifyButton:{enable:false},allowLocalhostAsSecureOrigin:true});
      if(OneSignal.login) await OneSignal.login(u.numero);
      syncNotifButton(OneSignal.Notifications?.permission===true);
    }catch(e){console.warn('[Pokemon OneSignal]',e)}
  });
}
async function requestNotifications(){
  const u=session();if(!u.numero){toast('Entre na sua conta primeiro.','err');return}
  window.OneSignalDeferred=window.OneSignalDeferred||[];
  window.OneSignalDeferred.push(async OneSignal=>{
    try{
      if(OneSignal.login)await OneSignal.login(u.numero);
      if(OneSignal.Notifications?.requestPermission)await OneSignal.Notifications.requestPermission();
      const granted=OneSignal.Notifications?.permission===true;
      await api('/api/pokemon-adventure/notifications',{method:'POST',body:{enabled:granted}});
      syncNotifButton(granted);toast(granted?'Avisos Pokémon ativados.':'Permissão de notificação não foi concedida.',granted?'ok':'err');
    }catch(e){toast(e.message,'err')}
  });
}
function syncNotifButton(on){const b=$('#pkNotifBtn');if(!b)return;b.classList.toggle('active',!!on);const s=b.querySelector('span');if(s)s.textContent=on?'Avisos ativos':'Avisos'}

async function boot(){
  const u=session();
  const user=$('#pkUser');
  if(user)user.innerHTML=u.numero
    ?`<span class="pk-dot"></span><strong>${esc(u.nome)}</strong><span>· conta ${esc(u.numero.slice(-4).padStart(4,'•'))}</span>`
    :'<span class="pk-dot"></span><strong>Visitante</strong>';

  // O catálogo é 100% estático e vem da própria Vercel.
  try{
    await loadLocalCatalog();
  }catch(e){
    e.message='Catálogo Pokémon: '+(e.message||'não foi possível carregar /assets/pokemons.json');
    renderError(e);
    return;
  }

  if(!u.numero){renderLogin();return}
  initOneSignal();

  // Health é somente diagnóstico: nunca mais bloqueia a abertura do jogo.
  api('/api/pokemon-adventure/health')
    .then(h=>console.log('[Pokémon Adventure][health]',h))
    .catch(e=>console.warn('[Pokémon Adventure][health]',e.message));

  try{
    const d=await api('/api/pokemon-adventure/profile');
    state.profile=d.profile;
    const tradeSlug=new URLSearchParams(location.search).get('trade');
    if(tradeSlug){
      state.tab='market';
      await loadMarket(true);
      await loadTradeTargetBySlug(tradeSlug);
    }
    render();
    startClock();
    startLiveRanking();
  }catch(e){
    e.message='Perfil Pokémon: '+(e.message||'falha ao carregar');
    renderError(e);
  }
}
function render(){
  const p=state.profile;if(!p)return;
  const a=$('#pkApp');
  if(!p.collection?.length){a.innerHTML=starterHTML(p);bindFallbacks();return}
  const need=xpNeed(p.trainer.level),xpPct=Math.min(100,(p.trainer.xp/need)*100);
  a.innerHTML=`${heroHTML(p,xpPct)}${resourcesHTML(p)}${quickHTML(p)}${tabsHTML()}
  <div class="pk-panel ${state.tab==='world'?'active':''}">${worldHTML(p)}</div>
  <div class="pk-panel ${state.tab==='collection'?'active':''}">${collectionHTML(p)}</div>
  <div class="pk-panel ${state.tab==='farm'?'active':''}">${farmHTML(p)}</div>
  <div class="pk-panel ${state.tab==='missions'?'active':''}">${missionsHTML(p)}</div>
  <div class="pk-panel ${state.tab==='arena'?'active':''}">${arenaHTML(p)}</div>
  <div class="pk-panel ${state.tab==='season'?'active':''}">${seasonHTML(p)}</div>
  <div class="pk-panel ${state.tab==='ranking'?'active':''}">${rankingHTML()}</div>
  <div class="pk-panel ${state.tab==='market'?'active':''}">${marketHTML(p)}</div>
  <div class="pk-panel ${state.tab==='shop'?'active':''}">${shopHTML(p)}</div>
  <div class="pk-panel ${state.tab==='achievements'?'active':''}">${achievementsHTML(p)}</div>`;
  bindFallbacks();
  if(state.tab==='ranking'&&!state.ranking.length)loadRanking(true);
  if(state.tab==='market'&&!state.market)loadMarket(true);
}
function starterHTML(p){const starters=[{id:1,name:'Bulbasaur',type:'Planta / Veneno'},{id:4,name:'Charmander',type:'Fogo'},{id:7,name:'Squirtle',type:'Água'},{id:25,name:'Pikachu',type:'Elétrico'}];return `<section class="pk-hero"><div class="pk-eyebrow">◉ POKÉMON ADVENTURE</div><h1 class="pk-title">Escolha quem vai iniciar <span>sua história.</span></h1><p class="pk-subtitle">Seu primeiro parceiro começa no nível 5. A partir daqui, sua coleção cresce com exploração, treino, missões, baús gratuitos e Arena.</p><div class="pk-starters">${starters.map(x=>`<button class="pk-starter" data-action="starter" data-id="${x.id}"><img src="${imageUrl(x)}" data-fallback="/flogo.jpg" alt="${x.name}"><strong>${x.name}</strong><span>${x.type}</span></button>`).join('')}</div><div class="pk-card" style="margin-top:14px"><div class="pk-card-head"><div><h3>Progressão separada dos Golds</h3><p>Baús aleatórios continuam gratuitos/ganhos jogando. A Loja PIX vende somente cosméticos fixos e não altera chances, CP ou ranking.</p></div><div class="pk-icon">🧭</div></div></div></section>`}
function heroHTML(p,xpPct){const c=p.champion;return `<section class="pk-hero"><div class="pk-hero-grid"><div><div class="pk-eyebrow">◉ FABI POKÉMON ADVENTURE</div><h1 class="pk-title">Explore. Capture. <span>Evolua.</span></h1><p class="pk-subtitle">Cada região consome energia, os grupos podem receber Pokémon Drops e seu perfil público mostra as maiores conquistas da jornada.</p><div class="pk-profile-line"><span class="pk-pill">Nível ${p.trainer.level} · ${esc(p.trainer.title)}</span><span class="pk-pill">${p.league?.icon||'🏆'} ${esc(p.league?.label||'Liga')} · ${fmt(p.trainer.arenaRating)}</span><span class="pk-pill">🏁 ${esc(p.season?.id||'Temporada')} · ${fmt(p.season?.points||0)} pts</span><span class="pk-pill">📚 ${fmt(p.stats.uniquePokemon)} espécies</span><span class="pk-pill">⭐ Score ${fmt(p.stats.score)}</span><span class="pk-pill">🔥 ${fmt(p.trainer.streak)}d</span></div><div class="pk-actions" style="margin-top:12px"><a class="pk-ghost pk-link-btn" href="${esc(p.social?.profileUrl||'#')}" target="_blank" rel="noopener">👤 Perfil público</a><button class="pk-ghost" data-action="tab" data-tab="market">🔄 Trocas e Leilões</button></div><div class="pk-xp"><span style="width:${xpPct}%"></span></div></div>${c?championHTML(c):'<div class="pk-champion"><div class="pk-champion-copy"><small>Parceiro principal</small><h3>Nenhum selecionado</h3><p>Abra sua coleção e escolha um Pokémon.</p></div></div>'}</div></section>`}
function championHTML(c){return `<div class="pk-champion"><img src="${imageUrl(c.species)}" data-fallback="${esc(fallback(c.species))}" alt="${esc(c.name)}"><div class="pk-champion-copy"><small>⭐ Parceiro principal</small><h3>${c.shiny?'✨ ':''}${esc(c.name)}</h3><p>Lv.${c.level} · CP ${fmt(c.cp)}<br>${esc(rarityLabel(c.rarity))} · ${esc(typesLabel(c.types))}</p><div class="pk-actions"><button class="pk-ghost" data-action="openmon" data-uid="${esc(c.uid)}">Detalhes</button></div></div></div>`}
function resourcesHTML(p){const r=p.resources;return `<section class="pk-resources"><div class="pk-resource pk-energy"><small>⚡ Energia</small><strong>${r.energy}/${r.maxEnergy}</strong></div><div class="pk-resource"><small>🔴 Poké Ball</small><strong>${fmt(r.pokeballs)}</strong></div><div class="pk-resource"><small>🔵 Great Ball</small><strong>${fmt(r.greatballs)}</strong></div><div class="pk-resource"><small>🟡 Ultra Ball</small><strong>${fmt(r.ultraballs)}</strong></div><button class="pk-resource pk-resource-btn" data-action="tab" data-tab="shop"><small>✨ Pó Estelar</small><strong>${fmt(r.stardust)}</strong><em>usar</em></button><div class="pk-resource"><small>🎟️ Tickets</small><strong>${fmt(r.trainingTickets)}</strong></div></section>`}
function tabsHTML(){
  const t=[['world','🧭 Mundo'],['collection','📚 Pokédex'],['farm','🌱 Fazenda'],['missions','📋 Missões'],['arena','⚔️ Arena'],['season','🎫 Temporada'],['ranking','🏆 Ranking'],['market','🔄 Mercado'],['shop','🛒 Loja'],['achievements','🏅 Conquistas']];
  return `<nav class="pk-tabs" aria-label="Pokémon Adventure">${t.map(([id,l])=>`<button class="pk-tab ${state.tab===id?'active':''}" data-action="tab" data-tab="${id}">${l}</button>`).join('')}</nav>`
}
function quickHTML(p){
  const sp=p.seasonPass||{};
  const remaining=sp.endAt?seasonTimeLeft(sp.endAt):'28d';
  return `<section class="pk-quick">
    <button data-action="quick-hunt">🧭<span><b>Aventura rápida</b><small>Trilha Livre · ⚡1</small></span></button>
    <button data-action="tab" data-tab="farm">🌱<span><b>Fazenda</b><small>${Object.values(p.farm?.pantry||{}).reduce((a,b)=>a+Number(b||0),0)} berries</small></span></button>
    <button data-action="openmon" data-uid="${esc(p.championUid||'')}">🏋️<span><b>Treinar parceiro</b><small>${esc(p.champion?.name||'Escolha um')}</small></span></button>
    <button data-action="tab" data-tab="season">🎫<span><b>${esc(sp.id||'Temporada 01')}</b><small>Nível ${fmt(sp.unlockedTier||1)} · ${esc(remaining)}</small></span></button>
  </section>`
}
function worldHTML(p){return `<div class="pk-grid"><section class="pk-card pk-col-8"><div class="pk-card-head"><div><h3>🗺️ Mapa de Exploração</h3><p>Escolha uma região. Quanto maior o custo, maior o bônus potencial de raridade.</p></div><div class="pk-icon">🧭</div></div>${worldEventHTML(p)}${radarHTML(p)}${p.activeEncounter?encounterHTML(p.activeEncounter):biomesHTML(p)}</section><aside class="pk-card pk-col-4"><div class="pk-card-head"><div><h3>🎁 Central de Baús</h3><p>Todos são gratuitos e recarregam com o tempo.</p></div><div class="pk-icon">📦</div></div><div class="pk-chests">${chestHTML(p,'supply','📦','Baú de Suprimentos',p.boxCooldowns.supplyReadyAt,'4h','Itens garantidos · 12% Pokémon')}${chestHTML(p,'expedition','🧭','Baú de Expedição',p.boxCooldowns.expeditionReadyAt,'8h','Pokémon garantido · até Épico')}${chestHTML(p,'daily','🎁','Baú Diário',p.boxCooldowns.dailyReadyAt,'24h','Pokémon garantido · pode vir Lendário/Mítico')}</div><div class="pk-actions"><button class="pk-ghost" data-action="notif">🔔 Avisar quando ficar pronto</button></div></aside></div>`}
function worldEventHTML(p){const e=p.worldEvent||{};return `<div class="pk-world-event"><i class="fa-solid fa-bolt"></i><div><b>${esc(e.title||'Evento do mundo')}</b><span>${esc(e.description||'Um evento especial está acontecendo hoje.')}</span></div></div>`}
function radarHTML(p){const r=p.radar||{charge:0,max:5};const pc=Math.min(100,(r.charge/r.max)*100);return `<div class="pk-radar"><div class="pk-radar-top"><b>📡 Radar de Exploração</b><span>${r.charge}/${r.max}</span></div><div class="pk-radar-bar"><span style="width:${pc}%"></span></div><div style="color:var(--muted);font-size:.66rem;margin-top:7px">Ao completar o Radar, a próxima aventura recebe promoção de raridade e chance Shiny melhorada.</div></div>`}
function biomesHTML(p){return `<div class="pk-biomes">${Object.entries(p.biomes||{}).map(([id,b])=>`<article class="pk-biome-card"><div class="pk-biome-top"><strong>${b.icon} ${esc(b.label)}</strong><em>⚡ ${b.energyCost||1}</em></div><span>${esc(b.desc||'Região de exploração.')}</span>${b.rareBoost?`<small>+${Math.round(b.rareBoost*100)}% bônus de promoção</small>`:''}<button class="pk-biome-go" data-action="hunt-biome" data-biome="${id}" ${Number(p.resources.energy||0)<Number(b.energyCost||1)?'disabled':''}>${Number(p.resources.energy||0)<Number(b.energyCost||1)?'Energia insuficiente':'Explorar agora'}</button></article>`).join('')}</div>`}
function encounterHTML(e){
  const s=e.species||{},rarity=String(s.rarity||'common'),needsBattle=['legendary','mythical'].includes(rarity),weakened=e.weakened===true;
  return `<div class="pk-encounter">
    <div class="pk-rarity">${e.shiny?'✨ SHINY · ':''}${R_EMOJI[rarity]||''} ${esc(rarityLabel(rarity))}</div>
    <img src="${imageUrl(s)}" data-fallback="${esc(fallback(s))}" alt="${esc(s.name)}">
    <h2>${esc(s.name)}</h2>
    <div style="color:var(--muted);font-size:.74rem">${esc(typesLabel(s.types))} · ${esc(pct((e.captureChances||{}).poke||0))} com Poké Ball</div>
    ${e.radarBoosted?'<div class="pk-pill" style="margin:10px auto 0;width:max-content">📡 Radar ativado</div>':''}
    ${weakened?'<div class="pk-weakened">⚔️ Enfraquecido · +18% de chance de captura</div>':needsBattle?'<div class="pk-wild-warning">🔥 Lendário/Mítico: vença uma batalha antes de tentar capturar.</div>':'<div class="pk-wild-hint">⚔️ Batalhar é opcional, mas enfraquecer aumenta a captura em +18%.</div>'}
    <div class="pk-actions" style="justify-content:center;margin:12px 0">
      ${!weakened?`<button class="pk-secondary" data-action="wild-battle">⚔️ Batalhar para enfraquecer</button>`:''}
    </div>
    <div class="pk-ball-grid">
      ${[['poke','🔴','Poké Ball'],['great','🔵','Great Ball'],['ultra','🟡','Ultra Ball']].map(([k,ic,n])=>`<button class="pk-ball" data-action="capture" data-ball="${k}" ${(needsBattle&&!weakened)?'disabled':''}><strong>${ic} ${n}</strong><span>${pct(Math.min(.98,Number(e.captureChances?.[k]||0)+(weakened?.18:0)))}</span></button>`).join('')}
    </div>
    <div style="margin-top:10px;color:var(--muted);font-size:.66rem">Tentativas: ${e.attempts||0}/${e.maxAttempts||3} · encontro expira em 10 min</div>
  </div>`
}
function chestHTML(p,type,icon,name,readyAt,cooldown,note){const ready=Date.parse(readyAt)<=Date.now();let odds='';if(type==='daily')odds='<span>55% Incomum</span><span>32% Raro</span><span>8% Épico</span><span>4% Lendário</span><span>1% Mítico</span>';else if(type==='expedition')odds='<span>32% Comum</span><span>40% Incomum</span><span>25% Raro</span><span>3% Épico</span>';return `<div class="pk-chest ${ready?'ready':''}"><div class="pk-chest-row"><div class="pk-chest-icon">${icon}</div><div class="pk-chest-copy"><b>${name}</b><span>${esc(note)} · recarga ${cooldown}</span><span class="pk-chest-time" data-ready-at="${esc(readyAt)}">${ready?'PRONTO':timeLeft(readyAt)}</span></div></div>${odds?`<div class="pk-odds">${odds}</div>`:''}<div class="pk-actions"><button class="${ready?'pk-primary':'pk-ghost'}" data-action="box" data-box="${type}" ${ready?'':'disabled'}>${ready?'Abrir agora':'Recarregando'}</button></div></div>`}
function collectionHTML(p){let list=p.collection||[];const q=state.query.trim().toLowerCase();if(q)list=list.filter(x=>`${x.name} ${x.number} ${(x.types||[]).join(' ')}`.toLowerCase().includes(q));if(state.rarity!=='all')list=list.filter(x=>x.rarity===state.rarity);list=list.slice().sort((a,b)=>b.cp-a.cp);return `<section class="pk-card"><div class="pk-card-head"><div><h3>📚 Sua Pokédex</h3><p>${p.stats.uniquePokemon} espécies · ${p.stats.totalPokemon} Pokémon individuais</p></div><div class="pk-icon">📚</div></div><div class="pk-search-row"><input class="pk-search" data-field="query" value="${esc(state.query)}" placeholder="Buscar por nome, número ou tipo"><select class="pk-select" data-field="rarity"><option value="all">Todas as raridades</option>${Object.keys(R_LABEL).map(k=>`<option value="${k}" ${state.rarity===k?'selected':''}>${R_LABEL[k]}</option>`).join('')}</select></div>${list.length?`<div class="pk-collection">${list.map(x=>monCard(x,p.championUid)).join('')}</div>`:'<div class="pk-empty"><b>Nenhum Pokémon encontrado</b>Altere os filtros ou faça novas aventuras.</div>'}</section>`}
function monCard(x,champ){
  const rec=x.recovery||{},recovering=rec.recovering===true;
  return `<button class="pk-mon ${recovering?'recovering':''}" data-action="openmon" data-uid="${esc(x.uid)}">
    ${x.shiny?'<span class="pk-shiny">✨ Shiny</span>':''}
    ${champ===x.uid?'<span class="pk-champ">⭐ Parceiro</span>':''}
    ${recovering?`<span class="pk-recovery-chip">💚 ${esc(timeLeft(rec.readyAt))}</span>`:''}
    <div class="pk-mon-img"><img src="${imageUrl(x.species)}" data-fallback="${esc(fallback(x.species))}" alt="${esc(x.name)}"></div>
    <div class="pk-mon-body"><strong>${R_EMOJI[x.rarity]||''} ${esc(x.name)}</strong><div class="pk-mon-meta"><span>Lv.${x.level}</span><span>CP ${fmt(x.cp)}</span></div></div>
  </button>`
}
function farmTime(ms){if(ms<=0)return 'PRONTO';const m=Math.ceil(ms/60000);return m<60?`${m} min`:`${Math.ceil(m/60)}h`}
function farmHTML(p){const f=p.farm||{};const pantry=f.pantry||{};return `<div class="pk-grid"><section class="pk-card pk-col-8"><div class="pk-card-head"><div><h3>🌱 Fazenda Pokémon</h3><p>Use Pó Estelar para plantar. Colha berries e alimente seu parceiro para aumentar Laço e melhorar Treino Intensivo.</p></div><div class="pk-icon">🌱</div></div><div class="pk-pantry">${Object.entries(f.crops||{}).map(([k,c])=>`<span>${c.icon} ${c.label}: <b>${fmt(pantry[k]||0)}</b></span>`).join('')}</div><div class="pk-farm-grid">${(f.plots||[]).map(plot=>{if(plot.locked)return `<div class="pk-plot locked"><b>🔒 Canteiro ${plot.id}</b><span>Desbloqueie subindo seu nível.</span></div>`;if(plot.crop){return `<div class="pk-plot ${plot.crop.ready?'ready':''}"><b>${plot.crop.config.icon} ${plot.crop.config.label}</b><span>${plot.crop.ready?'Pronto para colher':`Pronto em ${farmTime(plot.crop.remainingMs)}`}</span><button class="${plot.crop.ready?'pk-primary':'pk-ghost'}" data-action="harvest" data-plot="${plot.id}" ${plot.crop.ready?'':'disabled'}>${plot.crop.ready?'Colher agora':'Crescendo…'}</button></div>`}return `<div class="pk-plot"><b>▫️ Canteiro ${plot.id}</b><span>Escolha o que plantar</span><div class="pk-crop-buttons">${Object.entries(f.crops||{}).map(([k,c])=>`<button data-action="plant" data-plot="${plot.id}" data-crop="${k}" title="${c.label}">${c.icon}<small>${c.cost}✨</small></button>`).join('')}</div></div>`}).join('')}</div></section><aside class="pk-card pk-col-4"><div class="pk-card-head"><div><h3>✨ Para que serve o Pó Estelar?</h3><p>Agora ele é a moeda de progresso da jornada.</p></div><div class="pk-icon">✨</div></div><ul class="pk-help-list"><li>🌱 Plantar berries na Fazenda</li><li>🏋️ Treino Intensivo</li><li>🌟 Evoluir Pokémon</li><li>🔴 Comprar Balls e Tickets</li><li>🔬 Pesquisa com Pokémon garantido</li></ul><button class="pk-primary" data-action="tab" data-tab="shop">Abrir Loja de Pó Estelar</button></aside></div>`}
function shopHTML(p){const sh=p.shop||{};return `<div class="pk-grid"><section class="pk-card pk-col-7"><div class="pk-card-head"><div><h3>✨ Loja de Pó Estelar</h3><p>Itens exatos. Nada aqui usa dinheiro real.</p></div><div class="pk-balance">${fmt(p.resources.stardust)} ✨</div></div><div class="pk-shop-grid">${(sh.stardustItems||[]).map(i=>`<article class="pk-shop-item"><i>${i.icon}</i><div><b>${esc(i.label)}</b><span>${esc(i.description)}</span></div><button data-action="dust-buy" data-item="${esc(i.id)}">${fmt(i.cost)} ✨</button></article>`).join('')}</div><div class="pk-card-head" style="margin-top:22px"><div><h3>🔬 Pesquisa do Dia</h3><p>Pokémon específico e garantido. As ofertas mudam diariamente.</p></div></div><div class="pk-research-grid">${(sh.researchOffers||[]).map(o=>`<article class="pk-research"><img src="${imageUrl(o.species)}" data-fallback="${esc(fallback(o.species))}"><div><small>${esc(rarityLabel(o.rarity))}</small><b>${esc(o.species.name)}</b><span>${fmt(o.cost)} ✨</span></div><button data-action="research-buy" data-offer="${esc(o.id)}">Resgatar</button></article>`).join('')}</div></section><aside class="pk-card pk-col-5"><div class="pk-card-head"><div><h3>💚 Loja PIX · Apoie a Fabi</h3><p>Somente cosméticos fixos. Não vende baú aleatório, Pokémon aleatório ou vantagem competitiva.</p></div><div class="pk-icon">💚</div></div><div class="pk-pix-list">${(sh.pixProducts||[]).map(i=>`<article class="pk-pix-item"><div><b>${i.icon} ${esc(i.label)}</b><span>${esc(i.description)}</span><strong>R$ ${Number(i.price).toFixed(2).replace('.',',')}</strong></div><button data-action="pix-buy" data-product="${esc(i.id)}">Comprar</button></article>`).join('')}</div><div class="pk-safe-note">🔒 Pagamento PIX é processado no backend. As compras desta seção não entram no cálculo de Score, CP, chances ou ranking.</div></aside></div>`}
function missionsHTML(p){const all=[...(p.missions?.daily||[]).map(x=>({...x,kind:'Diária'})),...(p.missions?.weekly||[]).map(x=>({...x,kind:'Semanal'}))];return `<div class="pk-grid"><section class="pk-card pk-col-7"><div class="pk-card-head"><div><h3>📋 Missões</h3><p>Recompensas ganhas jogando. Missões diárias e semanais renovam automaticamente.</p></div><div class="pk-icon">📋</div></div>${all.map(m=>missionHTML(m)).join('')}</section><aside class="pk-card pk-col-5"><div class="pk-card-head"><div><h3>🎯 Progresso</h3><p>Seu histórico nesta jornada.</p></div><div class="pk-icon">📈</div></div>${[['Aventuras',p.counters.hunts],['Capturas',p.counters.captures],['Treinos',p.counters.trainings],['Batalhas',p.counters.battles],['Vitórias',p.counters.wins],['Evoluções',p.counters.evolutions]].map(([n,v])=>`<div class="pk-rank-row"><div>•</div><div class="pk-rank-user"><b>${n}</b></div><div>${fmt(v)}</div></div>`).join('')}</aside></div>`}
function missionHTML(m){const done=Number(m.progress||0)>=Number(m.target||1);const pc=Math.min(100,(Number(m.progress||0)/Math.max(1,Number(m.target||1)))*100);return `<div class="pk-mission"><div class="pk-mission-top"><div><b>${m.kind} · ${esc(m.title)}</b><p>${esc(m.description)}</p></div><div>${m.claimed?'✅':done?'🎁':'⏳'}</div></div><div class="pk-progress"><span style="width:${pc}%"></span></div><div class="pk-reward">${Math.min(m.progress||0,m.target||1)}/${m.target} · ${esc(m.rewardText||'')}</div>${done&&!m.claimed?`<div class="pk-actions"><button class="pk-primary" data-action="claim" data-id="${esc(m.id)}">Coletar recompensa</button></div>`:''}</div>`}
function arenaHTML(p){
  if(p.activeBattle)return `<section class="pk-card"><div class="pk-card-head"><div><h3>⚔️ Batalha em andamento</h3><p>Escolha o golpe. Velocidade define quem age primeiro em cada turno.</p></div><div class="pk-icon">⚔️</div></div>${battleHTML(p.activeBattle)}</section>`;
  const c=p.champion,rec=c?.recovery||{};
  return `<section class="pk-card"><div class="pk-card-head"><div><h3>⚔️ Arena dos Treinadores</h3><p>Combate por turnos. Você escolhe cada golpe; o adversário reage automaticamente.</p></div><div class="pk-icon">⚔️</div></div>
  ${c?`<div class="pk-arena-board"><div class="pk-fighter"><img src="${imageUrl(c.species)}" data-fallback="${esc(fallback(c.species))}"><b>${esc(c.name)}</b><div style="color:var(--muted);font-size:.7rem;margin-top:4px">Lv.${c.level} · CP ${fmt(c.cp)}</div>${rec.recovering?`<div class="pk-recovery-note">💚 Recuperando · ${esc(timeLeft(rec.readyAt))}</div>`:''}</div><div class="pk-vs">VS</div><div class="pk-fighter"><div style="height:130px;display:grid;place-items:center;font-size:3rem">❔</div><b>Oponente compatível</b><div style="color:var(--muted);font-size:.7rem;margin-top:4px">Matchmaking por força</div></div></div>
  <div class="pk-actions" style="justify-content:center">
    ${rec.recovering?`<button class="pk-secondary" data-action="recover" data-uid="${esc(c.uid)}">✨ Recuperar agora · ${fmt(rec.stardustCost)} Pó</button>`:`<button class="pk-primary" data-action="battle-start" ${p.daily.battles>=5?'disabled':''}>${p.daily.battles>=5?'Limite diário atingido':`Entrar na Arena · ${p.daily.battles}/5`}</button>`}
  </div>`:'<div class="pk-empty"><b>Escolha seu parceiro principal</b>Abra sua Pokédex e marque um Pokémon com ⭐.</div>'}
  <div class="pk-safe-note">💡 Derrota coloca seu Pokémon em recuperação por um período. Você pode esperar gratuitamente ou gastar Pó Estelar para antecipar a volta.</div>
  </section>`
}
function rankingHTML(){return `<section class="pk-card"><div class="pk-card-head"><div><div class="pk-live">● AO VIVO · 15s</div><h3>🏆 Ranking Pokémon</h3><p>Global mede toda a jornada. Temporada reinicia o placar competitivo periodicamente.</p></div><div class="pk-rank-switch"><button class="${state.rankMode==='global'?'active':''}" data-action="rank-mode" data-mode="global">Global</button><button class="${state.rankMode==='season'?'active':''}" data-action="rank-mode" data-mode="season">Temporada</button></div></div>${state.ranking.length?`<div class="pk-ranking">${state.ranking.map(r=>rankRow(r)).join('')}</div>`:'<div class="pk-empty"><b>Carregando ranking…</b>Buscando os treinadores mais fortes.</div>'}</section>`}
function rankRow(r){const medal=r.position===1?'🥇':r.position===2?'🥈':r.position===3?'🥉':`${r.position}º`;return `<div class="pk-rank-row"><div class="pk-rank-pos">${medal}</div><div class="pk-rank-user"><b>${esc(r.userName)}</b><span>${r.league?.icon||'🏆'} ${esc(r.league?.label||'Liga')} · Arena ${fmt(r.arenaRating)} · ${fmt(r.uniquePokemon)} espécies</span></div><div class="pk-rank-best">${r.best?`<img src="${imageUrl(r.best.species)}" data-fallback="${esc(fallback(r.best.species))}"><span>${esc(r.best.name)}<br>${state.rankMode==='season'?`${fmt(r.seasonPoints)} pts`:`Score ${fmt(r.score)}`}</span>`:`<span>${state.rankMode==='season'?`${fmt(r.seasonPoints)} pts`:`Score ${fmt(r.score)}`}</span>`}</div></div>`}

function marketTime(ms){ms=Math.max(0,Number(ms)||0);const h=Math.floor(ms/3600000),m=Math.ceil((ms%3600000)/60000);return h?`${h}h ${m}min`:`${Math.max(1,m)}min`}
function auctionCard(a){
  const poke=a.pokemon||{name:a.species?.name,rarity:a.species?.rarity,species:a.species};
  const current=Number(a.currentBid||0),min=current?current+Math.max(10,Math.ceil(current*.05)):Number(a.startBid||0);
  return `<article class="pk-auction-card ${a.isLeader?'leader':''}">
    <div class="pk-auction-img"><img src="${imageUrl(poke.species||a.species)}" data-fallback="${esc(fallback(poke.species||a.species))}" alt="${esc(poke.name||'Pokémon')}"></div>
    <div class="pk-auction-copy"><small>${a.kind==='daily'?'🏛️ LEILÃO DA LIGA':'👤 LEILÃO DE JOGADOR'}</small><h4>${poke.shiny?'✨ ':''}${esc(poke.name||a.species?.name||'Pokémon')}</h4><p>${esc(rarityLabel(poke.rarity||a.species?.rarity))}${poke.cp?` · CP ${fmt(poke.cp)}`:''}<br>⏳ ${esc(marketTime(a.remainingMs))}</p><strong>${fmt(current||a.startBid)} ✨</strong>${a.currentBidderName?`<span>Líder: ${esc(a.currentBidderName)}</span>`:''}</div>
    <div class="pk-auction-action">${a.isMine?'<span>Seu leilão</span>':`<button class="pk-primary" data-action="auction-bid" data-auction="${esc(a.id)}" data-min="${min}">${a.isLeader?'Aumentar lance':'Dar lance'} · ${fmt(min)}✨</button>`}</div>
  </article>`
}
function tradeCard(t,p){
  const incoming=t.incoming===true;
  return `<article class="pk-trade-card"><header><span>${incoming?'📥 RECEBIDA':'📤 ENVIADA'}</span><small>${esc(t.id)}</small></header><div class="pk-trade-vs"><div><img src="${imageUrl(t.offer.species)}" data-fallback="${esc(fallback(t.offer.species))}"><b>${esc(t.offer.name)}</b><small>${esc(t.fromName)}</small></div><strong>⇄</strong><div><img src="${imageUrl(t.request.species)}" data-fallback="${esc(fallback(t.request.species))}"><b>${esc(t.request.name)}</b><small>${esc(t.toName)}</small></div></div>${incoming?`<div class="pk-actions"><button class="pk-primary" data-action="trade-resolve" data-id="${esc(t.id)}" data-accept="1">Aceitar</button><button class="pk-danger" data-action="trade-resolve" data-id="${esc(t.id)}" data-accept="0">Recusar</button></div>`:'<div class="pk-safe-note">Aguardando resposta do outro treinador.</div>'}</article>`
}
function marketHTML(p){
  const m=state.market;
  if(!m)return `<section class="pk-card"><div class="pk-card-head"><div><h3>🔄 Mercado Pokémon</h3><p>Carregando trocas e leilões...</p></div><div class="pk-icon">🔄</div></div></section>`;
  const eligible=m.eligiblePokemon||[];
  return `<div class="pk-grid">
    <section class="pk-card pk-col-8"><div class="pk-card-head"><div><h3>🔨 Leilões ao vivo</h3><p>Todo dia a Liga coloca Pokémon conhecidos no leilão. Jogadores também podem vender os próprios Pokémon por Pó Estelar.</p></div><button class="pk-ghost" data-action="market-refresh">Atualizar</button></div>
      <div class="pk-auction-grid">${(m.auctions||[]).length?(m.auctions||[]).map(auctionCard).join(''):'<div class="pk-empty"><b>Nenhum leilão ativo</b>Volte mais tarde.</div>'}</div>
      <div class="pk-market-form"><h4>Colocar meu Pokémon no leilão</h4><div class="pk-market-fields"><select id="pkAuctionPokemon">${eligible.map(x=>`<option value="${esc(x.uid)}">${x.shiny?'✨ ':''}${esc(x.name)} · CP ${fmt(x.cp)}</option>`).join('')}</select><input id="pkAuctionStart" type="number" min="50" value="250" placeholder="Lance inicial"><select id="pkAuctionHours"><option value="6">6 horas</option><option value="12" selected>12 horas</option><option value="24">24 horas</option></select><button class="pk-primary" data-action="auction-create" ${eligible.length?'':'disabled'}>Criar leilão</button></div><small>Taxa da Liga: 5% somente se vender. Pokémon parceiro, em recuperação ou já negociado não pode ser listado.</small></div>
    </section>
    <aside class="pk-card pk-col-4"><div class="pk-card-head"><div><h3>🔄 Troca direta</h3><p>Procure um treinador pelo nome ou código do perfil público.</p></div><div class="pk-icon">🤝</div></div>
      <div class="pk-trade-search"><input id="pkTradeSearch" placeholder="Nome ou código do perfil"><button class="pk-secondary" data-action="trade-search">Buscar</button></div>
      <div id="pkTradeTarget">${state.tradeTarget?tradeTargetHTML(state.tradeTarget,eligible):'<div class="pk-safe-note">Abra o perfil de outro treinador ou pesquise aqui para montar uma proposta.</div>'}</div>
    </aside>
    <section class="pk-card pk-col-12"><div class="pk-card-head"><div><h3>📨 Propostas pendentes</h3><p>Pokémon usados em uma proposta ficam bloqueados até a resposta.</p></div></div><div class="pk-trades-grid">${(m.trades||[]).length?(m.trades||[]).map(t=>tradeCard(t,p)).join(''):'<div class="pk-empty"><b>Nenhuma proposta pendente</b>Quando alguém quiser trocar com você, aparecerá aqui.</div>'}</div></section>
  </div>`
}
function tradeTargetHTML(target,eligible){
  const list=target.tradeCollection||[];
  return `<div class="pk-trade-target"><div class="pk-target-head"><b>${esc(target.userName)}</b><a href="/pokemon-profile.html?p=${encodeURIComponent(target.slug)}" target="_blank">ver perfil</a></div><label>Você oferece</label><select id="pkTradeOwn">${eligible.map(x=>`<option value="${esc(x.uid)}">${esc(x.name)} · CP ${fmt(x.cp)}</option>`).join('')}</select><label>Você quer</label><select id="pkTradeWant">${list.map(x=>`<option value="${esc(x.uid)}">${x.shiny?'✨ ':''}${esc(x.name)} · CP ${fmt(x.cp)}</option>`).join('')}</select><button class="pk-primary" data-action="trade-create" data-slug="${esc(target.slug)}" ${eligible.length&&list.length?'':'disabled'}>Enviar proposta</button></div>`
}
async function loadMarket(silent=false){try{const d=await api('/api/pokemon-adventure/market');state.market=d;if(d.profile)state.profile=d.profile;if(state.tab==='market')render()}catch(e){if(!silent)toast(e.message,'err')}}
async function loadTradeTargetBySlug(slug){
  try{
    const pub=await fetch(proxyUrl(`${BACKEND}/api/pokemon-adventure/public-profile/${encodeURIComponent(slug)}`),{mode:'cors'});
    const raw=await pub.json();
    if(!pub.ok||raw.success===false)throw new Error(raw.error||'Perfil não encontrado.');
    if(String(raw.profile?.slug||'')===String(state.profile?.social?.publicSlug||''))throw new Error('Escolha outro treinador para propor troca.');
    state.tradeTarget=raw.profile;
    if(state.tab==='market')render();
  }catch(e){toast(e.message,'err')}
}
async function loadTradeTarget(q){try{const d=await api('/api/pokemon-adventure/profiles/search?q='+encodeURIComponent(q));const row=(d.rows||[])[0];if(!row){toast('Treinador não encontrado.','err');return}const pub=await fetch(proxyUrl(`${BACKEND}/api/pokemon-adventure/public-profile/${encodeURIComponent(row.slug)}`),{mode:'cors'});const raw=await pub.json();if(!pub.ok||raw.success===false)throw new Error(raw.error||'Perfil não encontrado.');state.tradeTarget=raw.profile;render()}catch(e){toast(e.message,'err')}}
function achievementsHTML(p){return `<section class="pk-card"><div class="pk-card-head"><div><h3>🏅 Conquistas</h3><p>Marcos permanentes da sua jornada.</p></div><div class="pk-icon">🏅</div></div><div class="pk-ach-grid">${(p.achievements||[]).map(a=>`<div class="pk-ach ${a.unlocked?'unlocked':''}"><b>${a.unlocked?'🏆':'🔒'} ${esc(a.title)}</b><p>${esc(a.desc)}</p><small>${esc(a.rewardText||'')}</small></div>`).join('')}</div></section>`}
function detailHTML(x,p){
  const ev=x.evolution;
  const base=(x.species&&x.species.stats)||x.baseStats||{};
  const stats=x.currentStats&&Number(x.currentStats.hp)>0?x.currentStats:base;
  const ivTotal=Number.isFinite(Number(x.iv?.total))?Number(x.iv.total):Math.round((Object.values(x.ivs||{}).reduce((a,b)=>a+Number(b||0),0)/90)*100);
  const rec=x.recovery||{recovering:false};
  return `<div class="pk-modal-top"><div><div class="pk-eyebrow">${x.shiny?'✨ SHINY · ':''}${esc(rarityLabel(x.rarity))}</div><h2 style="margin:8px 0 0">${esc(x.name)} <span style="color:var(--muted);font-size:.7em">#${esc(x.number)}</span></h2></div><button class="pk-modal-close" data-action="close">✕</button></div>
  <div class="pk-detail-hero"><img src="${imageUrl(x.species)}" data-fallback="${esc(fallback(x.species))}" alt="${esc(x.name)}"><div><p style="color:var(--muted);line-height:1.6;font-size:.78rem">${esc(typesLabel(x.types))}<br>Lv.${x.level} · XP ${fmt(x.xp)} · CP ${fmt(x.cp)}<br>IV ${Math.max(0,ivTotal)}%</p><div class="pk-actions"><button class="pk-primary" data-action="champion" data-uid="${esc(x.uid)}">⭐ Definir parceiro</button>${ev&&x.level>=Number(ev.minLevel||999)?`<button class="pk-secondary" data-action="evolve" data-uid="${esc(x.uid)}">🌟 Evoluir para ${esc(ev.name)}</button>`:''}</div></div></div>
  <div class="pk-stats">${[['HP',stats.hp],['Ataque',stats.attack],['Defesa',stats.defense],['Atq. Especial',stats.specialAttack],['Def. Especial',stats.specialDefense],['Velocidade',stats.speed]].map(([n,v])=>`<div class="pk-stat"><span>${n}</span><b>${fmt(v||0)}</b></div>`).join('')}</div>
  ${rec.recovering?`<div class="pk-recovery-box"><div><b>💚 Em recuperação</b><span>Disponível em ${esc(timeLeft(rec.readyAt))}. Enquanto isso não pode treinar nem batalhar.</span></div><button class="pk-secondary" data-action="recover" data-uid="${esc(x.uid)}">✨ Acelerar · ${fmt(rec.stardustCost)} Pó</button></div>`:''}
  <div class="pk-card" style="margin-top:12px"><div class="pk-card-head"><div><h3>💚 Cuidado e Laço</h3><p>Laço ${x.care?.bond||0}/100 · Humor ${x.care?.mood||50}/100. Berries favoritas mantêm um bônus temporário para Treino Intensivo.</p></div></div><div class="pk-berry-row">${Object.entries(p.farm?.pantry||{}).filter(([,v])=>v>0).map(([k,v])=>`<button class="pk-ghost" data-action="feed" data-uid="${esc(x.uid)}" data-berry="${k}">${k} ×${v}</button>`).join('')||'<span style="color:var(--muted);font-size:.72rem">Sua despensa está vazia. Visite a Fazenda.</span>'}</div></div>
  <div class="pk-card" style="margin-top:12px"><div class="pk-card-head"><div><h3>🏋️ Centro de Treino</h3><p>Treino normal: 3 grátis/dia e depois Tickets. Intensivo: 160✨, até 2/dia, com ganhos maiores.</p></div></div><div class="pk-train-grid">${[['balanced','Equilibrado'],['attack','Ataque'],['defense','Defesa'],['hp','HP'],['speed','Velocidade'],['specialAttack','Atq. Esp.'],['specialDefense','Def. Esp.']].map(([k,n])=>`<div><b>${n}</b><button data-action="train" data-mode="standard" data-uid="${esc(x.uid)}" data-focus="${k}" ${rec.recovering?'disabled':''}>Normal</button><button class="intensive" data-action="train" data-mode="intensive" data-uid="${esc(x.uid)}" data-focus="${k}" ${rec.recovering?'disabled':''}>Intensivo · 160✨</button></div>`).join('')}</div></div>`
}

function battleHTML(b){
  if(!b)return '';
  const own=b.own||{},opp=b.opponent?.pokemon||{},ownPct=Math.max(0,Math.min(100,(Number(own.hp||0)/Math.max(1,Number(own.maxHp||1)))*100)),oppPct=Math.max(0,Math.min(100,(Number(opp.hp||0)/Math.max(1,Number(opp.maxHp||1)))*100));
  return `<div class="pk-turn-battle">
    <div class="pk-battle-side">
      <div class="pk-battle-pokemon"><img src="${imageUrl(own.species)}" data-fallback="${esc(fallback(own.species))}"><div><strong>${esc(own.name)}</strong><span>Lv.${own.level} · CP ${fmt(own.cp)}</span></div></div>
      <div class="pk-hp-line"><b>${fmt(own.hp)}/${fmt(own.maxHp)} HP</b><div><span style="width:${ownPct}%"></span></div></div>
    </div>
    <div class="pk-battle-center"><span>TURNO ${fmt(b.turn||1)}</span><b>VS</b><small>${esc(b.mode==='wild'?'Pokémon selvagem':b.opponent?.userName||'Treinador')}</small></div>
    <div class="pk-battle-side opponent">
      <div class="pk-battle-pokemon"><img src="${imageUrl(opp.species)}" data-fallback="${esc(fallback(opp.species))}"><div><strong>${esc(opp.name)}</strong><span>Lv.${opp.level} · CP ${fmt(opp.cp)}</span></div></div>
      <div class="pk-hp-line enemy"><b>${fmt(opp.hp)}/${fmt(opp.maxHp)} HP</b><div><span style="width:${oppPct}%"></span></div></div>
    </div>
    <div class="pk-moves">${(own.moves||[]).map((m,i)=>`<button data-action="battle-move" data-move="${i}"><span>${esc(m.name)}</span><small>${esc(TYPE_PT[m.type]||m.type)} · Poder ${fmt(m.power)} · ${Math.round(Number(m.accuracy||0)*100)}%</small></button>`).join('')}</div>
    <div class="pk-battle-log">${(b.log||[]).length?(b.log||[]).slice(-6).map(x=>`<p>${esc(x)}</p>`).join(''):'<p>A batalha começou. Escolha seu primeiro golpe.</p>'}</div>
  </div>`
}

function battleResultHTML(d){
  const b=d.battle||{},r=d.result||b.result||{},win=r.win===true,mode=r.mode||b.mode;
  return `<div class="pk-modal-top"><div><div class="pk-eyebrow">${mode==='wild'?'🌿 BATALHA SELVAGEM':'⚔️ ARENA'}</div><h2 style="margin:8px 0 0">${win?'🏆 Vitória!':'💥 Seu Pokémon foi derrotado'}</h2></div><button class="pk-modal-close" data-action="close">✕</button></div>
  <div class="pk-battle-result ${win?'win':'loss'}"><div class="pk-result-icon">${win?'🏆':'💚'}</div>
  <p>${mode==='wild'?(win?'O Pokémon selvagem foi enfraquecido. Suas chances de captura aumentaram em +18%.':'O Pokémon selvagem escapou. Seu parceiro precisa se recuperar antes de outra batalha.'):(win?`Você venceu a Arena. Rating: ${fmt(r.ratingBefore)} → ${fmt(r.ratingAfter)}.`:`Você perdeu a Arena. Rating: ${fmt(r.ratingBefore)} → ${fmt(r.ratingAfter)}.`)}</p>
  ${r.recovery?.recovering?`<div class="pk-recovery-box"><div><b>Recuperação iniciada</b><span>${esc(timeLeft(r.recovery.readyAt))}</span></div><button class="pk-secondary" data-action="recover" data-uid="${esc(b.own?.uid||'')}">✨ Acelerar · ${fmt(r.recovery.stardustCost)} Pó</button></div>`:''}
  <div class="pk-actions" style="justify-content:center"><button class="pk-primary" data-action="battle-done" data-mode="${esc(mode)}">${mode==='wild'&&win?'Voltar para capturar':'Continuar'}</button></div></div>`
}

function seasonHTML(p){
  const sp=p.seasonPass||{},tiers=sp.tiers||[],progressInTier=Math.max(0,Number(sp.points||0)-((Number(sp.unlockedTier||1)-1)*50)),pctTier=Math.min(100,(progressInTier/50)*100);
  const product=(p.shop?.pixProducts||[]).find(x=>x.id==='seasonPass');
  return `<section class="pk-card pk-season-card">
    <div class="pk-card-head"><div><div class="pk-live">● TEMPORADA ATIVA · 28 DIAS</div><h3>🎫 ${esc(sp.title||'Temporada 01 · Origem')}</h3><p>08/10/2026 inicia a Temporada 01. Cada temporada dura 4 semanas e tem 30 níveis.</p></div><div class="pk-icon">🎫</div></div>
    <div class="pk-season-summary"><div><small>Pontos</small><strong>${fmt(sp.points||0)}</strong></div><div><small>Nível do Passe</small><strong>${fmt(sp.unlockedTier||1)}/30</strong></div><div><small>Termina em</small><strong>${esc(sp.endAt?seasonTimeLeft(sp.endAt):'—')}</strong></div><div><small>Premium</small><strong>${sp.premium?'Ativo ✅':'Não ativo'}</strong></div></div>
    <div class="pk-season-progress"><span style="width:${pctTier}%"></span></div>
    <div class="pk-safe-note">A trilha grátis entrega recursos conquistáveis. O Premium é opcional e entrega apenas cosméticos, títulos e molduras — não aumenta CP, dano, captura ou ranking.</div>
    ${!sp.premium&&product?`<div class="pk-season-premium"><div><b>✨ Passe Premium ${esc(sp.id||'S01')}</b><span>${esc(product.description||'Recompensas cosméticas fixas.')}</span></div><button class="pk-primary" data-action="pix-buy" data-product="seasonPass">Ativar · R$ ${Number(product.price||9.9).toFixed(2).replace('.',',')}</button></div>`:''}
    <div class="pk-pass-grid">${tiers.map(t=>`<article class="pk-pass-tier ${t.unlocked?'unlocked':'locked'}"><header><b>Nível ${t.tier}</b><span>${fmt(t.requiredPoints)} pts</span></header>
      <div class="pk-pass-track"><small>GRÁTIS</small><p>${esc(t.free?.label||'—')}</p><button data-action="season-claim" data-tier="${t.tier}" data-track="free" ${!t.unlocked||t.free?.claimed?'disabled':''}>${t.free?.claimed?'Coletado ✓':t.unlocked?'Coletar':'Bloqueado'}</button></div>
      <div class="pk-pass-track premium"><small>PREMIUM</small><p>${esc(t.premium?.label||'Cosmético em níveis especiais')}</p>${t.premium?.available?`<button data-action="season-claim" data-tier="${t.tier}" data-track="premium" ${!sp.premium||!t.unlocked||t.premium?.claimed?'disabled':''}>${t.premium?.claimed?'Coletado ✓':sp.premium&&t.unlocked?'Coletar':'Bloqueado'}</button>`:'<span class="pk-pass-empty">—</span>'}</div>
    </article>`).join('')}</div>
  </section>`
}
function bindFallbacks(){$$('img[data-fallback]').forEach(img=>{img.onerror=()=>{const fb=img.dataset.fallback;if(fb&&img.src!==fb){img.onerror=null;img.src=fb}else img.src='/flogo.jpg'}})}
function openModal(html){const m=$('#pkModal'),c=$('#pkModalCard');c.innerHTML=html;m.classList.add('open');m.setAttribute('aria-hidden','false');bindFallbacks()}
function closeModal(){const m=$('#pkModal');m.classList.remove('open');m.setAttribute('aria-hidden','true')}

async function refresh(silent=false){try{const d=await api('/api/pokemon-adventure/profile');state.profile=d.profile;render()}catch(e){if(!silent)toast(e.message,'err')}}
async function action(path,body,success){if(state.busy)return;setBusy(true);try{const d=await api(path,{method:'POST',body});state.profile=d.profile||state.profile;if(success)await success(d);else render();return d}catch(e){toast(e.message,'err');throw e}finally{setBusy(false)}}
async function loadRanking(silent=false){try{const d=await api('/api/pokemon-adventure/ranking?limit=40&mode='+encodeURIComponent(state.rankMode));state.ranking=d.ranking||[];if(state.tab==='ranking')render()}catch(e){if(!silent)toast(e.message,'err')}}
function startLiveRanking(){clearInterval(state.rankTimer);state.rankTimer=setInterval(()=>loadRanking(true),15000)}

async function chestCinematic(type,data){const box={supply:['📦','Baú de Suprimentos'],expedition:['🧭','Baú de Expedição'],daily:['🎁','Baú Diário']}[type]||['📦','Baú'];const cine=$('#pkCinematic'),stage=$('#pkCineStage');cine.classList.add('open');cine.setAttribute('aria-hidden','false');stage.innerHTML=`<div class="pk-cine-rays"></div><div class="pk-chest-anim opening">${box[0]}</div><h2 class="pk-cine-title">Abrindo ${box[1]}…</h2><p class="pk-cine-sub">Sincronizando sua recompensa.</p>`;await sleep(900);$('.pk-chest-anim',stage)?.classList.add('reveal');await sleep(550);const p=data.pokemon;stage.innerHTML=`<div class="pk-reveal-card">${p?`<div class="pk-rarity">${p.shiny?'✨ SHINY · ':''}${R_EMOJI[p.rarity]||''} ${esc(rarityLabel(p.rarity))}</div><img src="${imageUrl(p.species)}" data-fallback="${esc(fallback(p.species))}" alt="${esc(p.name)}"><h2 style="margin:0 0 4px">${esc(p.name)}</h2><div style="color:var(--muted);font-size:.75rem">Lv.${p.level} · CP ${fmt(p.cp)}</div>`:'<div style="font-size:4rem">✨</div><h2>Recompensa coletada</h2>'}<div class="pk-reward-list">${rewardPills(data.rewards)}</div><div class="pk-actions" style="justify-content:center"><button class="pk-primary" data-action="closecine">Continuar jornada</button></div></div>`;bindFallbacks()}
function rewardPills(r={}){const labels={pokeballs:'🔴 Poké Ball',greatballs:'🔵 Great Ball',ultraballs:'🟡 Ultra Ball',stardust:'✨ Pó Estelar',trainingTickets:'🎟️ Ticket',energy:'⚡ Energia'};return Object.entries(r).filter(([,v])=>v).map(([k,v])=>`<span>${labels[k]||k} +${fmt(v)}</span>`).join('')}
async function captureCinematic(ball,data){const cine=$('#pkCinematic'),stage=$('#pkCineStage');cine.classList.add('open');cine.setAttribute('aria-hidden','false');stage.innerHTML=`<div class="pk-capture-ball">${ball==='ultra'?'🟡':ball==='great'?'🔵':'🔴'}</div><h2 class="pk-cine-title">Tentando capturar…</h2><p class="pk-cine-sub">Aguarde o resultado.</p>`;await sleep(1500);if(data.success){stage.innerHTML=`<div class="pk-reveal-card"><div class="pk-capture-success" style="font-size:2.8rem">✓</div><h2>${data.pokemon.shiny?'✨ ':''}${esc(data.pokemon.name)} capturado!</h2><img src="${imageUrl(data.pokemon.species)}" data-fallback="${esc(fallback(data.pokemon.species))}"><div class="pk-reward-list"><span>Lv.${data.pokemon.level}</span><span>CP ${fmt(data.pokemon.cp)}</span><span>${esc(rarityLabel(data.pokemon.rarity))}</span></div><div class="pk-actions" style="justify-content:center"><button class="pk-primary" data-action="closecine">Adicionar à equipe</button></div></div>`}else{stage.innerHTML=`<div class="pk-reveal-card"><div class="pk-capture-fail" style="font-size:2.8rem">${data.fled?'💨':'!'}</div><h2>${data.fled?'O Pokémon fugiu!':'Ele escapou da Ball.'}</h2><p class="pk-cine-sub">${data.fled?'Faça outra aventura para encontrar um novo Pokémon.':`Você ainda tem ${data.remaining} tentativa(s).`}</p><div class="pk-actions" style="justify-content:center"><button class="pk-primary" data-action="closecine">Continuar</button></div></div>`}bindFallbacks()}
async function huntCinematic(d){const cine=$('#pkCinematic'),stage=$('#pkCineStage');cine.classList.add('open');stage.innerHTML=`<div class="pk-cine-rays"></div><div style="font-size:4rem">🧭</div><h2 class="pk-cine-title">Explorando ${esc(d.adventure?.biome||'região')}…</h2><p class="pk-cine-sub">Rastreando sinais e pegadas.</p>`;await sleep(850);stage.innerHTML=`<div class="pk-reveal-card"><div class="pk-rarity">${d.encounter.shiny?'✨ SHINY · ':''}${esc(rarityLabel(d.encounter.species.rarity))}</div><img src="${imageUrl(d.encounter.species)}" data-fallback="${esc(fallback(d.encounter.species))}"><h2>${esc(d.encounter.species.name)}</h2><p class="pk-cine-sub">Um Pokémon selvagem apareceu!</p><div class="pk-actions" style="justify-content:center"><button class="pk-primary" data-action="closecine">Tentar captura</button></div></div>`;bindFallbacks()}
function closeCine(){const c=$('#pkCinematic');c.classList.remove('open');c.setAttribute('aria-hidden','true');render()}

async function openPix(productId){try{const d=await action('/api/pokemon-adventure/shop/pix/create',{productId},()=>{});const tx=d.transactionId;openModal(`<div class="pk-modal-top"><div><div class="pk-eyebrow">💚 COMPRA FIXA · PIX</div><h2>${esc(d.product.label)}</h2></div><button class="pk-modal-close" data-action="close">✕</button></div><div class="pk-pix-modal">${d.qrCode?`<img src="${esc(d.qrCode)}" alt="QR Code PIX">`:''}<p>R$ ${Number(d.product.price).toFixed(2).replace('.',',')} · expira em 30 min</p><textarea readonly id="pkPixCode">${esc(d.copyPaste||'')}</textarea><div class="pk-actions"><button class="pk-primary" data-action="copy-pix">Copiar PIX</button><button class="pk-ghost" data-action="pix-status" data-tx="${esc(tx)}">Já paguei</button></div><div id="pkPixState" class="pk-safe-note">Aguardando pagamento. O backend também verifica automaticamente a cada 30 segundos.</div></div>`);startPixWatch(tx);}catch(_){} }
function startPixWatch(tx){clearInterval(state.pixWatch);let n=0;state.pixWatch=setInterval(async()=>{if(++n>120){clearInterval(state.pixWatch);return}try{const d=await api('/api/pokemon-adventure/shop/pix/'+encodeURIComponent(tx));const box=$('#pkPixState');if(box)box.textContent=d.transaction.status==='approved'?'✅ Pagamento aprovado e item liberado.':`Status: ${d.transaction.status}`;if(d.transaction.status==='approved'){clearInterval(state.pixWatch);state.profile=d.profile||state.profile;toast('Compra aprovada!');setTimeout(()=>{closeModal();render()},900)}}catch(_){}},5000)}
async function click(e){const el=e.target.closest('[data-action]');if(!el)return;const act=el.dataset.action;
  if(act==='tab'){state.tab=el.dataset.tab;if(state.tab==='market')await loadMarket(true);render();return}
  if(act==='biome'){state.biome=el.dataset.biome;render();return}
  if(act==='quick-hunt'){try{const d=await action('/api/pokemon-adventure/hunt',{biome:'random'},()=>{});await huntCinematic(d)}catch(_){}return}
  if(act==='hunt-biome'){try{const d=await action('/api/pokemon-adventure/hunt',{biome:el.dataset.biome||'random'},()=>{});await huntCinematic(d)}catch(_){}return}
  if(act==='rank-mode'){state.rankMode=el.dataset.mode||'global';state.ranking=[];await loadRanking(true);render();return}

  if(act==='market-refresh'){await loadMarket(false);return}
  if(act==='auction-create'){
    const pokemon=$('#pkAuctionPokemon')?.value,startBid=Number($('#pkAuctionStart')?.value||0),hours=Number($('#pkAuctionHours')?.value||12);
    if(!pokemon){toast('Escolha um Pokémon para leiloar.','err');return}
    try{const d=await action('/api/pokemon-adventure/market/auction/create',{pokemon,startBid,hours},()=>{});state.profile=d.profile||state.profile;state.market=null;await loadMarket(true);toast('Leilão criado!')}catch(_){}
    return
  }
  if(act==='auction-bid'){
    const min=Number(el.dataset.min||0),amount=Number(prompt(`Lance mínimo: ${fmt(min)} Pó Estelar`,String(min))||0);if(!amount)return;
    try{const d=await action('/api/pokemon-adventure/market/auction/bid',{auctionId:el.dataset.auction,amount},()=>{});state.profile=d.profile||state.profile;state.market=null;await loadMarket(true);toast('Você está na liderança do leilão!')}catch(_){}
    return
  }
  if(act==='trade-search'){const q=$('#pkTradeSearch')?.value?.trim();if(!q){toast('Digite o nome ou código do perfil.','err');return}await loadTradeTarget(q);return}
  if(act==='trade-create'){
    const offerPokemon=$('#pkTradeOwn')?.value,requestPokemonUid=$('#pkTradeWant')?.value,targetSlug=el.dataset.slug;
    if(!offerPokemon||!requestPokemonUid){toast('Escolha os dois Pokémon da troca.','err');return}
    try{const d=await action('/api/pokemon-adventure/market/trade/create',{targetSlug,offerPokemon,requestPokemonUid},()=>{});state.profile=d.profile||state.profile;state.market=null;state.tradeTarget=null;await loadMarket(true);toast('Proposta de troca enviada!')}catch(_){}
    return
  }
  if(act==='trade-resolve'){
    const accept=el.dataset.accept==='1',path=`/api/pokemon-adventure/market/trade/${encodeURIComponent(el.dataset.id)}/${accept?'accept':'reject'}`;
    try{const d=await action(path,{},()=>{});state.profile=d.profile||state.profile;state.market=null;await loadMarket(true);toast(accept?'Troca concluída!':'Troca recusada.')}catch(_){}
    return
  }

  if(act==='reload'){location.reload();return}
  if(act==='health'){try{const d=await api('/api/pokemon-adventure/health');toast(`API online · ${d.catalog} espécies · V${d.version}`)}catch(err){toast(err.message,'err')}return}
  if(act==='catalog'){try{const d=await loadLocalCatalog();const total=Array.isArray(d)?d.length:Object.keys(d||{}).length;toast(`Catálogo local online · ${fmt(total)} espécies`)}catch(err){toast(`Catálogo local falhou: ${err.message}`,'err')}return}
  if(act==='notif'){requestNotifications();return}
  if(act==='close'){closeModal();return}
  if(act==='closecine'){closeCine();return}
  if(act==='starter'){await action('/api/pokemon-adventure/starter',{speciesId:Number(el.dataset.id)},async d=>{toast(`${d.pokemon.name} agora é seu primeiro parceiro.`);state.tab='world';render()});return}
  if(act==='hunt'){try{const d=await action('/api/pokemon-adventure/hunt',{biome:state.biome},()=>{});await huntCinematic(d)}catch(_){}return}
  if(act==='capture'){try{const d=await action('/api/pokemon-adventure/capture',{ball:el.dataset.ball},()=>{});await captureCinematic(el.dataset.ball,d)}catch(_){}return}
  if(act==='box'){try{const d=await action('/api/pokemon-adventure/box',{type:el.dataset.box},()=>{});await chestCinematic(el.dataset.box,d)}catch(_){}return}
  if(act==='claim'){await action('/api/pokemon-adventure/missions/'+encodeURIComponent(el.dataset.id)+'/claim',{},d=>{toast(d.rewardText||'Recompensa coletada!');render()});return}
  if(act==='battle-start'){try{const d=await action('/api/pokemon-adventure/battle/start',{pokemon:state.profile.championUid},()=>{});state.profile=d.profile;state.tab='arena';render()}catch(_){}return}
  if(act==='wild-battle'){try{const d=await action('/api/pokemon-adventure/battle/wild/start',{pokemon:state.profile.championUid},()=>{});state.profile=d.profile;state.tab='arena';render();toast('Batalha selvagem iniciada!')}catch(_){}return}
  if(act==='battle-move'){try{const d=await action('/api/pokemon-adventure/battle/action',{moveIndex:Number(el.dataset.move||0)},()=>{});state.profile=d.profile||state.profile;if(d.battle?.status==='finished'){openModal(battleResultHTML(d));bindFallbacks()}else render()}catch(_){}return}
  if(act==='battle-done'){const mode=el.dataset.mode||'arena';closeModal();state.tab=mode==='wild'?'world':'arena';render();return}
  if(act==='recover'){try{const d=await action('/api/pokemon-adventure/recover',{pokemon:el.dataset.uid||state.profile.championUid},()=>{});state.profile=d.profile||state.profile;toast(d.alreadyReady?'Pokémon já estava recuperado.':`Recuperação concluída por ${fmt(d.cost)}✨.`);closeModal();render()}catch(_){}return}
  if(act==='season-claim'){try{const d=await action('/api/pokemon-adventure/season/claim',{tier:Number(el.dataset.tier),track:el.dataset.track||'free'},()=>{});state.profile=d.profile||state.profile;toast(`Passe: ${d.label}`);render()}catch(_){}return}
  if(act==='openmon'){const x=state.profile.collection.find(m=>m.uid===el.dataset.uid);if(x)openModal(detailHTML(x,state.profile));return}
  if(act==='champion'){await action('/api/pokemon-adventure/champion',{pokemon:el.dataset.uid},d=>{toast(`${d.champion.name} agora é seu parceiro principal.`);closeModal();render()});return}
  if(act==='evolve'){await action('/api/pokemon-adventure/evolve',{pokemon:el.dataset.uid},d=>{toast(`Evoluiu para ${d.pokemon.name}!`);closeModal();render()});return}
  if(act==='train'){await action('/api/pokemon-adventure/train',{pokemon:el.dataset.uid,focus:el.dataset.focus||'balanced',mode:el.dataset.mode||'standard'},d=>{toast(`${d.pokemon.name} ganhou ${d.xp} XP${d.stardustCost?` · -${d.stardustCost}✨`:''}.`);closeModal();render()});return}
  if(act==='feed'){await action('/api/pokemon-adventure/feed',{pokemon:el.dataset.uid,berry:el.dataset.berry},d=>{toast(`${d.pokemon.name} adorou ${d.berry.label}!`);closeModal();render()});return}
  if(act==='plant'){await action('/api/pokemon-adventure/farm/plant',{plot:Number(el.dataset.plot),crop:el.dataset.crop},d=>{toast('Plantação iniciada!');render()});return}
  if(act==='harvest'){await action('/api/pokemon-adventure/farm/harvest',{plot:Number(el.dataset.plot)},d=>{toast(`${d.harvested.quantity}x ${d.harvested.label} colhidas!`);render()});return}
  if(act==='dust-buy'){await action('/api/pokemon-adventure/shop/stardust',{item:el.dataset.item},d=>{toast(`Comprado: ${d.item.label}`);render()});return}
  if(act==='research-buy'){await action('/api/pokemon-adventure/shop/research',{offer:el.dataset.offer},d=>{toast(`${d.pokemon.name} entrou na coleção!`);render()});return}
  if(act==='pix-buy'){await openPix(el.dataset.product);return}
  if(act==='copy-pix'){const t=$('#pkPixCode');if(t){try{await navigator.clipboard.writeText(t.value);toast('PIX copiado!')}catch(_){t.select();document.execCommand('copy');toast('PIX copiado!')}}return}
  if(act==='pix-status'){try{const d=await api('/api/pokemon-adventure/shop/pix/'+encodeURIComponent(el.dataset.tx));const box=$('#pkPixState');if(box)box.textContent=d.transaction.status==='approved'?'✅ Pagamento aprovado e item liberado.':`Status: ${d.transaction.status}`;if(d.transaction.status==='approved'){state.profile=d.profile||state.profile;render()}}catch(e){toast(e.message,'err')}return}
}
function input(e){const el=e.target;if(el.dataset.field==='query'){state.query=el.value;render()}if(el.dataset.field==='rarity'){state.rarity=el.value;render()}}
function startClock(){clearInterval(state.timer);state.timer=setInterval(()=>{$$('[data-ready-at]').forEach(el=>{const ready=Date.parse(el.dataset.readyAt)<=Date.now();el.textContent=ready?'PRONTO':timeLeft(el.dataset.readyAt);if(ready){const card=el.closest('.pk-chest');card?.classList.add('ready');const b=card?.querySelector('[data-action="box"]');if(b){b.disabled=false;b.className='pk-primary';b.textContent='Abrir agora'}}});},15000)}

document.addEventListener('click',click);document.addEventListener('input',input);document.addEventListener('change',input);$('#pkNotifBtn')?.addEventListener('click',requestNotifications);boot();
})();
