/* Fabi Pokémon Adventure V24 — caixa lendária premium, quantidade via modal PIX e catálogo visual refinado. */
(()=>{
'use strict';
const PROXY='https://orange-hill-2e61.gbscabral15.workers.dev';
const BACKEND='http://br2.bronxyshost.com:4009';
const BASE='/api/pokemon-adventure/';
let portalModal=null;
let portalOldOverflow=null;
let portalOldHtmlOverflow=null;
const $=(sel,root=document)=>root.querySelector(sel)||(root===document&&portalModal?.ownerDocument?.querySelector(sel))||null;
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const money=v=>'R$ '+Number(v||0).toFixed(2).replace('.',',');
const dates=v=>v?new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'';
const shortDate=v=>v?new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
const storage=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')||{}}catch(_){return {}}};
let data={products:[],groups:[],vouchers:[],boxes:[],ownedSpecies:[]};
let busy=false,poll=null,activeTx=null;
function current(){
 const a=storage('fabi_session'),b=storage('neconecta_user_session'),p=storage('pk_player_session');
 const u={...a,...b};
 return {numero:String(u.numero||u.telefone||u.phone||'').replace(/\D/g,''),nome:String(u.nome||u.username||u.name||'Treinador').slice(0,80),token:String(p.token||''),guest:p.guest===true};
}
const isLogged=()=>{const u=current();return !!u.token&&!u.guest&&!!u.numero};
const proxy=path=>PROXY+'/br2.bronxyshost.com:4009/proxy?url='+encodeURIComponent(BACKEND+path);
const media=id=>proxy('/pokemon/images/artwork_'+Number(id)+'.png');
const BOX_ART={freeMystery:'/assets/drop-box-basic.svg',freeExplorer:'/assets/drop-box-explorer.svg',freeElite:'/assets/drop-box-special.svg',dropBoxBasic:'/assets/drop-box-basic.svg',dropBoxExplorer:'/assets/drop-box-explorer.svg',dropBoxSpecial:'/assets/drop-box-special.svg',dropBoxLegendary:'/assets/drop-box-legendary.svg',basic:'/assets/drop-box-basic.svg',explorer:'/assets/drop-box-explorer.svg',special:'/assets/drop-box-special.svg',legendary:'/assets/drop-box-legendary.svg'};
const boxArt=id=>BOX_ART[String(id||'')]||'/assets/drop-box-basic.svg';
const boxImage=(id,label='Caixa')=>`<img class="box-art" loading="lazy" src="${esc(boxArt(id))}" alt="${esc(label)}">`;
const speciesImage=id=>`<img loading="lazy" src="${esc(media(id))}" alt="" onerror="this.style.display='none'">`;
const nextDate=ms=>new Date(ms).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
const STATUS={available:'Disponível',queued:'Na fila',processing:'Enviando',sent:'Entregue',review:'Em revisão'};

function embeddedView(){
 try{return window.parent!==window && window.frameElement && window.parent.location.origin===location.origin?window.frameElement:null}catch(_){return null}
}
const PORTAL_CSS=`
#modal.fabi-drops-portal{--bg:#071014;--card:#111c23;--card2:#14232b;--text:#f5f9fb;--muted:#a2b9c1;--stroke:#2b4149;--green:#b0f66d;--shadow:0 24px 90px #000c;position:fixed!important;inset:0!important;z-index:2147483000!important;padding:12px!important;display:none;place-items:center;color:var(--text);font:normal 14px/1.55 Inter,system-ui,-apple-system,sans-serif}
#modal.fabi-drops-portal.open{display:grid!important}
#modal.fabi-drops-portal *{box-sizing:border-box}
#modal.fabi-drops-portal .modal-backdrop{position:absolute;inset:0;background:rgba(1,8,12,.88);backdrop-filter:blur(8px)}
#modal.fabi-drops-portal .modal-panel{position:relative;z-index:1;background:var(--card);border:1px solid #38535e;border-radius:20px;width:min(620px,100%);max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:17px 20px 21px;box-shadow:var(--shadow);color:var(--text);scrollbar-width:thin}
#modal.fabi-drops-portal .modal-close{position:sticky;top:0;float:right;margin:-4px -4px 0 10px;z-index:10;width:38px;height:38px;background:#263b43;color:white;font-size:27px;line-height:1;border:1px solid #4a6670;border-radius:12px;display:grid;place-items:center;cursor:pointer}
#modal.fabi-drops-portal .modal-close:hover{background:#3c5962}
#modal.fabi-drops-portal h3{font-size:21px;font-weight:800;line-height:1.2;margin:2px 0 7px;color:white}
#modal.fabi-drops-portal p{font-size:12px;line-height:1.65;color:var(--muted);margin:8px 0}
#modal.fabi-drops-portal .section-label{color:var(--green);font-size:10px;font-weight:800;letter-spacing:.1em}
#modal.fabi-drops-portal .box-detail-top,#modal.fabi-drops-portal .species-modal-top{display:flex;align-items:center;gap:13px;min-height:65px;padding-right:45px}
#modal.fabi-drops-portal .box-detail-top img,#modal.fabi-drops-portal .species-modal-top img{width:62px;height:62px;object-fit:contain;flex:0 0 62px}
#modal.fabi-drops-portal .rotation-info{background:#244432;border:1px solid #4e855f;border-radius:11px;padding:9px;color:#d5f5dc;font-size:11px;margin:12px 0}
#modal.fabi-drops-portal .odds-list{display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:42vh;overflow-y:auto;margin:12px 0;padding:3px;scrollbar-width:thin}
#modal.fabi-drops-portal .species-chip{display:flex;gap:8px;align-items:center;min-width:0;padding:8px;background:#16302b;border:1px solid #35544b;border-radius:11px;color:var(--text);text-align:left}
#modal.fabi-drops-portal .species-chip img{width:36px!important;height:36px!important;object-fit:contain!important;flex:0 0 36px!important}
#modal.fabi-drops-portal .species-chip-info{display:grid;min-width:0;flex:1}
#modal.fabi-drops-portal .species-chip-info b,#modal.fabi-drops-portal .species-chip-info small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#modal.fabi-drops-portal .species-chip-info b{font-size:11px}
#modal.fabi-drops-portal .species-chip-info small{font-size:9px;color:var(--muted)}
#modal.fabi-drops-portal .species-chip strong{font-size:12px;color:var(--green)}
#modal.fabi-drops-portal .owned-badge{font-size:9px;font-weight:800;padding:4px 6px;border-radius:999px;border:1px solid #4e855f;background:#203d31;color:#d8f7e1}
#modal.fabi-drops-portal .owned-badge.no{background:#3b3021;border-color:#876c41;color:#ffe3ae}
#modal.fabi-drops-portal .odds-total{font-size:11px;padding-top:10px;border-top:1px solid #35544b}
#modal.fabi-drops-portal .btn{border-radius:12px;border:1px solid #3e6659;padding:11px 15px;display:inline-flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:800;cursor:pointer;background:#163e30;min-height:42px}
#modal.fabi-drops-portal .btn.primary{background:var(--green);color:#122617;border-color:var(--green)}
#modal.fabi-drops-portal .btn:disabled{opacity:.55;cursor:not-allowed}
#modal.fabi-drops-portal .modal-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}
#modal.fabi-drops-portal textarea{width:100%;min-height:95px;padding:12px;border:1px solid #365158;border-radius:12px;background:#0b151c;color:#d4f6e8;font-size:11px;resize:none;word-break:break-all}
#modal.fabi-drops-portal .checkout-state{display:grid;justify-items:center;text-align:center;gap:10px;padding:22px 0}
#modal.fabi-drops-portal .checkout-loader{width:48px;height:48px;border:4px solid #607c71;border-top-color:var(--green);border-radius:50%;animation:fabiSpin .7s linear infinite}
#modal.fabi-drops-portal .modal-status,#modal.fabi-drops-portal .checkout-tip{margin-top:12px;padding:9px;border-radius:10px;background:#214334;color:#dff6e7;font-size:11px}
#modal.fabi-drops-portal img.qr{display:block;width:min(180px,65%);height:auto;background:white;padding:7px;border-radius:12px;margin:15px auto}
#modal.fabi-drops-portal .muted,#modal.fabi-drops-portal .payment-expires{font-size:11px;color:var(--muted)}
#modal.fabi-drops-portal .qty-wrap{display:grid;gap:6px;margin-top:8px}
#modal.fabi-drops-portal .qty-wrap span{font-size:10px;font-weight:800;color:var(--muted)}
#modal.fabi-drops-portal .qty-controls{display:grid;grid-template-columns:42px 1fr 42px;gap:8px}
#modal.fabi-drops-portal .qty-btn,#modal.fabi-drops-portal .qty-input{height:42px;border-radius:12px;border:1px solid #365158;background:#0f1f25;color:white;text-align:center}
#modal.fabi-drops-portal .qty-btn{font-size:22px;font-weight:800}
#modal.fabi-drops-portal .qty-input{padding:0 10px;font-size:16px;font-weight:800}
#modal.fabi-drops-portal .modal-buy-total{margin-top:10px;font-size:13px;font-weight:700;color:#e2f8e8}
#modal.fabi-drops-portal .purchase-hero{display:grid;grid-template-columns:88px 1fr;gap:12px;align-items:center;margin-bottom:10px}
#modal.fabi-drops-portal .purchase-hero .box-art{width:88px;height:88px;object-fit:contain;filter:drop-shadow(0 10px 24px rgba(255,214,82,.16))}
#modal.fabi-drops-portal .purchase-summary{background:#102129;border:1px solid #30505a;border-radius:14px;padding:12px;margin-top:12px}
#modal.fabi-drops-portal .purchase-summary b{display:block;font-size:15px;color:#fff;margin-bottom:4px}
#modal.fabi-drops-portal .purchase-summary small{display:block;color:#a8c3cb;line-height:1.55}
#modal.fabi-drops-portal .purchase-total-strong{display:block;margin-top:8px;font-size:14px;color:#dfffd0}
@keyframes fabiSpin{to{transform:rotate(360deg)}}
@media(max-width:650px){#modal.fabi-drops-portal{padding:8px!important}#modal.fabi-drops-portal .modal-panel{padding:13px 13px 20px;max-height:calc(100vh - 16px);max-height:calc(100dvh - 16px)}#modal.fabi-drops-portal .odds-list{grid-template-columns:1fr;max-height:43vh}#modal.fabi-drops-portal .modal-actions .btn{flex:1 1 100%}}
`;
function ensureModalRoot(){
 const local=document.getElementById('modal');
 if(portalModal?.isConnected)return portalModal;
 if(!embeddedView()||!local)return local;
 try{
  const pd=window.parent.document;
  let style=pd.getElementById('fabi-drops-portal-style');
  if(!style){style=pd.createElement('style');style.id='fabi-drops-portal-style';style.textContent=PORTAL_CSS;pd.head.appendChild(style)}
  pd.body.appendChild(local);
  local.classList.add('fabi-drops-portal');
  portalModal=local;
  local.addEventListener('click',handleActionClick);
  local.addEventListener('input',handleQuantityInput);
  pd.addEventListener('keydown',handleEscape);
  return local;
 }catch(e){console.warn('[Fabi Drops V24] Modal sem portal:',e.message);return local}
}
function toast(message,bad=false){
 const el=$('#toast');if(!el)return;
 el.hidden=false;el.style.borderColor=bad?'#ff8a86':'var(--green)';el.textContent=message;
 clearTimeout(toast.timer);toast.timer=setTimeout(()=>{el.hidden=true},6500);
}
function modal(html){
 const m=ensureModalRoot();if(!m)return;
 const wasOpen=m.classList.contains('open');
 $('#modalContent').innerHTML=html;
 m.classList.add('open');m.setAttribute('aria-hidden','false');
 if(portalModal){const pd=m.ownerDocument;if(!wasOpen){portalOldOverflow=pd.body.style.overflow;portalOldHtmlOverflow=pd.documentElement.style.overflow;}pd.body.style.overflow='hidden';pd.documentElement.style.overflow='hidden';m.querySelector('.modal-panel').scrollTop=0;}
 (m.querySelector('.modal-close'))?.focus({preventScroll:true});
}
function closeModal(){
 const m=$('#modal');if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true')}
 if(portalModal){const d=portalModal.ownerDocument;d.body.style.overflow=portalOldOverflow??'';d.documentElement.style.overflow=portalOldHtmlOverflow??'';}
 clearInterval(poll);poll=null;activeTx=null;
}
function handleEscape(e){if(e.key==='Escape'&&$('#modal')?.classList.contains('open'))closeModal()}
function errorModal(title,message){modal(`<div class="checkout-state fail"><span class="checkout-symbol">⚠️</span><h3 id="modalTitle">${esc(title)}</h3><p>${esc(message||'Não foi possível concluir a operação.')}</p><div class="modal-actions"><button class="btn primary" type="button" data-close="1">Entendi</button></div></div>`)}
function loginModal(){errorModal('Faça login na sua conta Fabi','Para abrir caixas e organizar drops você precisa entrar na sua conta vinculada ao Pokémon Adventure.')}
async function api(path,body){
 const u=current(),url=new URL(BACKEND+BASE+path);
 if(body===undefined){url.searchParams.set('playerToken',u.token);url.searchParams.set('numero',u.numero);url.searchParams.set('nome',u.nome)}
 const dest=PROXY+'/br2.bronxyshost.com:4009/proxy?url='+encodeURIComponent(url.toString());
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),20000);
 try{
  const r=await fetch(dest,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify({playerToken:u.token,contaNumero:u.numero,nomeUsuario:u.nome,nomeConta:u.nome,...body}),signal:ctl.signal});
  let j;try{j=await r.json()}catch(_){throw Error('O servidor respondeu em formato inesperado. Tente novamente ou confira os logs.')}
  if(!r.ok||j.success===false)throw Error(j.error||j.message||('Servidor retornou HTTP '+r.status));
  return j;
 }catch(e){if(e.name==='AbortError')throw Error('O servidor demorou mais de 20 segundos. Confira a conexão e o backend.');throw e}finally{clearTimeout(timer)}
}
const ownedSet=()=>new Set((data.ownedSpecies||[]).map(x=>Number(x)).filter(Boolean));
const speciesOwned=id=>ownedSet().has(Number(id));
const chanceLabel=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:3})+'%';
function speciesMeta(id){
 const source=[...(data.boxes||[]),...(data.products||[])];
 for(const box of source){
  const found=(box.possibleSpecies||[]).find(x=>Number(x.id)===Number(id));
  if(found)return found;
 }
 return {id:Number(id),name:'Pokémon '+id,rarity:'unknown',owned:speciesOwned(id),number:String(id).padStart(3,'0')};
}
function ownedBadge(id,owned){const has=owned===undefined?speciesOwned(id):!!owned;return `<span class="owned-badge ${has?'yes':'no'}">${has?'Já tenho':'Ainda não tenho'}</span>`;}
function productQtyMarkup(id){return `<label class="qty-wrap" for="qty-${esc(id)}"><span>Quantidade</span><div class="qty-controls"><button type="button" class="qty-btn" data-qty-change="-1" data-qty-for="${esc(id)}">−</button><input id="qty-${esc(id)}" class="qty-input" type="number" min="1" max="10" step="1" value="1" data-qty="${esc(id)}"><button type="button" class="qty-btn" data-qty-change="1" data-qty-for="${esc(id)}">+</button></div></label>`;}
function findInBoth(selector,root=document){
 const result=[...root.querySelectorAll(selector)];
 // Modal move para o documento pai no mobile. Evita alterar cópias duplicadas.
 if(portalModal?.isConnected&&!root.contains(portalModal))result.push(...portalModal.querySelectorAll(selector));
 return [...new Set(result)];
}
function getQtyInputs(id,scope=document){return findInBoth(`[data-qty="${String(id)}"]`,scope);}
function normalizeQty(v){const n=Number(v);return Number.isFinite(n)?Math.max(1,Math.min(10,Math.trunc(n))):1;}
function currentQty(id,scope=document){const input=getQtyInputs(id,scope)[0]||getQtyInputs(id)[0];return normalizeQty(input?.value||1);}
function syncQty(id,qty){getQtyInputs(id).forEach(el=>{el.value=String(qty)});updateTotalLabels(id,qty)}
function updateTotalLabels(id,qty){const p=data.products.find(x=>x.id===id);if(!p)return;findInBoth(`[data-total-for="${String(id)}"]`).forEach(el=>{el.textContent=qty>1?`${money(p.price)} × ${qty} = ${money(Number(p.price||0)*qty)}`:money(p.price);});}
function handleQuantityInput(e){const input=e.target.closest('[data-qty]');if(!input)return;syncQty(input.dataset.qty,normalizeQty(input.value));}
function speciesTile(spec,boxId){
 const sp=spec||{};
 return `<button type="button" class="species-chip" data-species="${Number(sp.id||0)}" data-source-box="${esc(boxId||'')}">${speciesImage(sp.id)}<span class="species-chip-info"><b>${esc(sp.name||'Pokémon')}</b><small>#${esc(sp.number||String(sp.id||'').padStart(3,'0'))} · ${esc(sp.rarity||'Caixa')}</small></span>${ownedBadge(sp.id,sp.owned)}${sp.chance!=null?`<strong>${chanceLabel(sp.chance)}</strong>`:''}</button>`;
}
function speciesModal(id,boxId=''){
 const box=[...(data.products||[]),...(data.boxes||[])].find(x=>String(x.id)===String(boxId));
 const spec=(box?.possibleSpecies||[]).find(x=>Number(x.id)===Number(id))||speciesMeta(id);
 modal(`<div class="species-modal-top">${speciesImage(spec.id)}<div><span class="section-label">POKÉMON DA CAIXA</span><h3 id="modalTitle">${esc(spec.name||'Pokémon')}</h3><p>#${esc(spec.number||String(spec.id).padStart(3,'0'))} · ${esc(spec.rarity||'Sem raridade')}${Array.isArray(spec.types)&&spec.types.length?` · ${esc(spec.types.join(' / '))}`:''}</p>${ownedBadge(spec.id,spec.owned)}</div></div><div class="rotation-info">Origem: ${esc(box?box.label:'Catálogo')}${spec.chance!=null?` · Chance nesta caixa: ${chanceLabel(spec.chance)}`:''}</div><p>Esse selo mostra se a espécie já está na sua coleção. Você pode tocar em outros Pokémon do catálogo para comparar as caixas antes de comprar ou resgatar.</p><div class="modal-actions"><button class="btn secondary" type="button" data-close="1">Fechar</button></div>`);
}
function renderFreeBoxes(){
 const root=$('#freeBoxes');if(!root)return;
 if(!data.boxes.length){root.innerHTML='<div class="empty">Entre na sua conta de treinador para consultar o catálogo gratuito de hoje.</div>';return}
 root.innerHTML=data.boxes.map(box=>{
  const lvl=Number(box.playerLevel)||1,locked=lvl<box.minLevel,waiting=Number(box.nextAt)>Date.now();
  const pool=Array.isArray(box.possibleSpecies)?box.possibleSpecies:[];
  const status=locked?`🔒 Desbloqueia no nível ${box.minLevel}`:waiting?`⏳ Próximo resgate: ${nextDate(box.nextAt)}`:'✅ Pronta para resgatar';
  return `<article class="free-box daily-tier ${esc(box.id)}"><div class="free-box-top box-head">${boxImage(box.id,box.label)}<div><b>${esc(box.label)}</b><small>${esc(box.tier)} · Nível ${Number(box.minLevel)}</small></div></div><div class="free-box-meta"><span>${pool.length} espécies hoje</span><span>Até ${shortDate(box.rotationEndsAt)}</span><span>${box.cooldownHours}h entre resgates</span></div><div class="daily-mini-pool compact species-grid">${pool.slice(0,6).map(x=>`<button type="button" class="species-thumb" data-species="${Number(x.id)}" data-source-box="${esc(box.id)}" title="${esc(x.name)}">${speciesImage(x.id)}<span class="tiny-owned ${x.owned?'yes':'no'}"></span></button>`).join('')}${pool.length>6?`<span>+${Math.max(0,pool.length-6)}</span>`:''}</div><button class="btn secondary mini box-info" data-odds="${esc(box.id)}" type="button">Ver espécies e probabilidades</button><div class="free-box-footer"><small>${status}</small><button class="btn primary mini" data-free="${esc(box.id)}" type="button" ${locked||waiting||!isLogged()?'disabled':''}>Resgatar gratuitamente</button></div></article>`;
 }).join('');
}
function oddsModal(boxId){
 const box=data.boxes.find(x=>x.id===boxId);if(!box)return toast('Atualize o catálogo antes de consultar a caixa.',true);
 const pool=box.possibleSpecies||[];
 modal(`<div class="box-detail-top">${boxImage(box.id,box.label)}<div><span class="section-label">CATÁLOGO GRATUITO DO DIA</span><h3 id="modalTitle">${esc(box.label)}</h3><p>${esc(box.tier)} · Nível ${box.minLevel}+ · Resgate a cada ${box.cooldownHours}h</p></div></div><div class="rotation-info">Próxima rotação: ${esc(shortDate(box.rotationEndsAt))} (Brasília)</div><p>Toque em qualquer Pokémon para abrir a ficha. Nas caixas gratuitas, espécies de raridade maior possuem peso menor no sorteio.</p><div class="odds-list">${pool.map(x=>speciesTile(x,box.id)).join('')}</div><p class="odds-total">Probabilidade total: 100% · as chances variam conforme a raridade.</p><button data-free="${esc(box.id)}" class="btn primary" type="button" ${!box.available||!isLogged()?'disabled':''}>Resgatar gratuitamente</button>`);
}
function renderProducts(){
 const root=$('#catalog');if(!root)return;
 if(!data.products.length){root.innerHTML='<div class="empty">Entre na sua conta Pokémon para consultar o catálogo de caixas.</div>';return}
 root.innerHTML=data.products.map(p=>{
  const pool=Array.isArray(p.possibleSpecies)?p.possibleSpecies:[];
  const miniature=pool.length?`<div class="paid-pool-compact">${pool.map(x=>`<button type="button" class="paid-pool-row" data-species="${Number(x.id)}" data-source-box="${esc(p.id)}" title="${esc(x.name)} · ${chanceLabel(x.chance)}"><span class="paid-mon">${speciesImage(x.id)}</span><span class="paid-mon-text"><span class="paid-mon-name">${esc(x.name||'Pokémon')}</span><small>${x.owned?'Já tenho':'Ainda não tenho'}</small></span><b>${Number(x.chance||0).toLocaleString('pt-BR',{maximumFractionDigits:2})}%</b></button>`).join('')}</div>`:'<div class="pool-unavailable">Catálogo de espécies indisponível. Atualize também o servidor Bronxy para a mesma versão.</div>';
  return `<article class="product paid-box ${esc(p.id)}"><span class="paid-eyebrow">CAIXA COMUNITÁRIA · ${esc(p.tier||'CATÁLOGO')}</span><div class="product-art box-product-art">${boxImage(p.id,p.label)}</div><h3>${esc(p.label)}</h3><div class="product-chips"><span>${pool.length||'—'} espécies no catálogo</span><span>Espécie definida</span></div><div class="paid-pool-label">Pokémon incluído neste evento</div>${miniature}<div class="paid-detail"><button class="btn secondary mini" type="button" data-paid-details="${esc(p.id)}" ${pool.length?'':'disabled'}>Ver todos os detalhes</button></div><div class="product-footer"><div><strong data-total-for="${esc(p.id)}">${money(p.price)}</strong><small class="price-caption">escolha a quantidade ao gerar o PIX</small></div><button class="btn primary" type="button" data-buy="${esc(p.id)}" ${pool.length?'':'disabled'}>Gerar PIX</button></div></article>`;
 }).join('');
 data.products.forEach(p=>syncQty(p.id,1));
}
function paidModal(id){
 const p=data.products.find(x=>x.id===id);if(!p)return toast('Caixa indisponível.',true);
 const pool=Array.isArray(p.possibleSpecies)?p.possibleSpecies:[];
 modal(`<div class="box-detail-top">${boxImage(p.id,p.label)}<div><span class="section-label">CAIXA PIX DO DIA</span><h3 id="modalTitle">${esc(p.label)}</h3><p>${esc(p.tier||'Caixa')} · ${money(p.price)} por caixa · catálogo válido até ${esc(shortDate(p.rotationEndsAt))}</p></div></div><p>O conteúdo deste evento é <strong>fixo e revelado antes do pagamento</strong>. Toque no Pokémon para ver os detalhes e saber se você já possui a espécie.</p><div class="odds-list">${pool.map(x=>speciesTile(x,p.id)).join('')}</div><p class="odds-total">Conteúdo fixo · ${pool.length} espécie(s) informada(s) antes da compra.</p><div class="modal-actions"><button class="btn primary" data-buy="${esc(p.id)}" type="button">Escolher quantidade e gerar PIX</button><button class="btn secondary" type="button" data-close="1">Agora não</button></div>`);
}
function purchaseModal(id,qty){
 const p=data.products.find(x=>x.id===id);if(!p)return toast('Caixa indisponível.',true);
 const total=Number(p.price||0)*normalizeQty(qty||1);
 modal(`<div class="purchase-hero">${boxImage(p.id,p.label)}<div><span class="section-label">COMPRA PIX</span><h3 id="modalTitle">${esc(p.label)}</h3><p>${esc(p.description||'Escolha quantas caixas deseja comprar nesta cobrança PIX.')}</p></div></div><div class="purchase-summary"><b>${esc(p.tier||'Caixa comunitária')} · ${money(p.price)} por caixa</b><small>Escolha quantos eventos de conteúdo conhecido deseja. Após a confirmação, cada evento aparece na sua carteira e pode ser enviado separadamente a um grupo Pokémon.</small>${productQtyMarkup(p.id)}<span class="purchase-total-strong">Total desta cobrança: <b data-total-for="${esc(p.id)}">${money(total)}</b></span></div><div class="modal-actions"><button class="btn primary" data-buy-confirm="${esc(p.id)}" type="button">Gerar cobrança PIX</button><button class="btn secondary" data-paid-details="${esc(p.id)}" type="button">Voltar aos detalhes</button></div>`);
 syncQty(p.id, normalizeQty(qty||1));
}
function groupOptions(v){
 if(!data.groups.length)return '<option value="">Nenhum grupo com Pokémon automático ativo</option>';
 return '<option value="">Escolha um grupo com Pokémon ativo…</option>'+data.groups.map(g=>`<option value="${esc(g.id)}" ${v?.groupId===g.id?'selected':''}>${esc(g.label)} · …${esc(g.id.split('@')[0].slice(-6))}</option>`).join('');
}
function renderWallet(){
 const root=$('#wallet');$('#loginNote').hidden=isLogged();if(!isLogged()){root.innerHTML='';return}
 if(!data.vouchers.length){root.innerHTML='<div class="empty"><b>Sua carteira está vazia.</b><p>Resgate uma caixa gratuita ou compre uma caixa PIX acima e depois escolha um grupo com Pokémon automático ativo para enviar.</p></div>';return}
 root.innerHTML=data.vouchers.map(v=>`<article class="wallet-item"><img loading="lazy" src="${esc(v.speciesId?media(v.speciesId):boxArt(v.productId))}" alt=""><div><b>${esc(v.label)}${v.purchaseQuantity>1?` <span class="wallet-batch">${v.purchaseIndex}/${v.purchaseQuantity}</span>`:''}</b><small>${v.speciesId?'Pokémon revelado':'Espécie oculta'} · ${esc(dates(v.createdAt))}</small>${v.groupId?`<p>Grupo: …${esc(v.groupId.split('@')[0].slice(-8))}</p>`:''}${v.lastError?`<p>${esc(v.lastError)}</p>`:''}</div><div class="action"><span class="status ${esc(v.status)}">${esc(STATUS[v.status]||v.status)}</span>${v.status==='available'?`<select aria-label="Grupo para ${esc(v.label)}" class="group-select" data-group="${esc(v.id)}">${groupOptions(v)}</select><button type="button" class="btn primary mini" data-dispatch="${esc(v.id)}" ${data.groups.length?'':'disabled'}>Enviar ao grupo ↗</button>`:''}${v.status==='queued'?`<button type="button" class="btn secondary mini" data-cancel="${esc(v.id)}">Cancelar envio</button>`:''}</div></article>`).join('');
}
async function load(silent=false){
 const u=current();
 if(!u.token||u.guest||!u.numero){data={products:[],groups:[],vouchers:[],boxes:[],ownedSpecies:[]};renderProducts();renderFreeBoxes();renderWallet();if(!silent)toast('Faça login na sua conta Fabi para acessar o catálogo e os drops.');return}
 try{
  const got=await api('community-drops');
  data={products:got.products||[],groups:got.groups||[],vouchers:got.vouchers||[],boxes:got.boxes||[],ownedSpecies:got.ownedSpecies||[]};
  renderProducts();renderFreeBoxes();renderWallet();
  const note=$('#freeNote');if(note)note.textContent=`🔄 Espécies das caixas gratuitas atualizadas diariamente (horário de Brasília). ${data.groups.length} grupo(s) com Pokémon automático ativo.`;
 }catch(e){if(!silent)toast(e.message,true);$('#freeNote').textContent='Não foi possível carregar as caixas: '+e.message;renderProducts();renderFreeBoxes();renderWallet()}
}
async function buy(id,qty){
 if(!isLogged())return loginModal();
 if(busy)return toast('Já existe uma solicitação em andamento.');
 const product=data.products.find(p=>p.id===id);if(!product)return toast('Evento não encontrado. Atualize o catálogo.',true);
 const quantity=normalizeQty(qty||currentQty(id));
 busy=true;
 modal(`<div class="checkout-state"><div class="checkout-loader" aria-label="Carregando"></div><h3 id="modalTitle">Gerando seu PIX</h3><p>Conectando ao Mercado Pago para <b>${esc(product.label)}</b>.</p><small>${quantity} caixa(s) · total ${money(Number(product.price||0)*quantity)}.</small></div>`);
 try{
  const r=await api('shop/pix/create',{productId:id,quantity});
  if(!r.transactionId||!r.copyPaste)throw Error('O pagamento foi iniciado, mas o servidor não enviou o código PIX. Verifique antes de criar outra cobrança.');
  const tx=r.transactionId,qr=String(r.qrCode||'');activeTx=tx;
  const safeQR=/^(?:data:image\/(?:png|jpeg);base64,[a-zA-Z0-9+/=]+|https:\/\/[^\s]+)$/i.test(qr)?qr:'';
  modal(`<span class="section-label">PIX · PAGAMENTO MERCADO PAGO</span><h3 id="modalTitle">${esc(r.product?.label||product.label)}</h3><p>Quantidade: <b>${Number(r.product?.quantity||quantity)}</b> caixa(s) · valor unitário <b>${money(r.product?.price||product.price)}</b> · total <b>${money(r.product?.totalPrice||(Number(product.price||0)*quantity))}</b>.</p>${safeQR?`<img class="qr" src="${esc(safeQR)}" alt="QR Code PIX">`:''}<label class="muted" for="pixInput">PIX copia e cola</label><textarea class="pix-code" id="pixInput" readonly></textarea><div class="modal-actions"><button type="button" class="btn primary" id="copyPix">Copiar código PIX</button><button type="button" class="btn secondary" id="checkPix">Verificar pagamento</button></div><div class="modal-status" id="paymentStatus">Aguardando confirmação do Mercado Pago.</div><small class="payment-expires">Válido até ${shortDate(r.expiresAt)}.</small>`);
  $('#pixInput').value=String(r.copyPaste);
  $('#copyPix').onclick=async()=>{try{await navigator.clipboard.writeText($('#pixInput').value);toast('Código PIX copiado!')}catch(_){$('#pixInput').select();try{document.execCommand('copy');toast('Código PIX selecionado.')}catch(_){toast('Selecione e copie o código PIX manualmente.')}}};
  $('#checkPix').onclick=()=>checkPayment(tx);
  clearInterval(poll);poll=setInterval(()=>{if(activeTx===tx)checkPayment(tx,true)},6500);
 }catch(e){errorModal('Não foi possível gerar o PIX',e.message);toast('Erro ao criar PIX: '+e.message,true)}finally{busy=false}
}
async function checkPayment(tx,silent=false){
 if(!tx)return;
 try{
  const d=await api('shop/pix/'+encodeURIComponent(tx)),status=d.transaction?.status||'pending';
  const q=Number(d.transaction?.quantity||1);
  const el=$('#paymentStatus');if(el)el.textContent=status==='approved'?`✅ Pagamento aprovado! ${q} caixa(s) liberada(s) na sua carteira.`:status==='pending'?'Aguardando aprovação do Mercado Pago…':'Pagamento: '+status;
  if(status==='approved'){closeModal();toast('Pagamento aprovado! Escolha o grupo na carteira.');await load(true)}
  else if(['expired','rejected','cancelled'].includes(status)){clearInterval(poll);poll=null}
 }catch(e){if(!silent)toast('Não foi possível consultar: '+e.message,true)}
}
async function claimFree(tier){
 if(!isLogged())return loginModal();if(busy)return;
 busy=true;try{const d=await api('community-drops/free',{tier:String(tier||'freeMystery')});closeModal();toast(d.message||'Caixa gratuita disponível na carteira!');await load(true);$('#minhacarteira')?.scrollIntoView({behavior:'smooth',block:'start'})}catch(e){toast(e.message,true)}finally{busy=false}
}
async function dispatch(id){
 const sel=[...document.querySelectorAll('[data-group]')].find(x=>x.dataset.group===id),groupId=sel?.value;
 if(!groupId)return toast('Escolha um grupo com Pokémon automático ativo.',true);
 const group=data.groups.find(g=>g.id===groupId);if(!group)return toast('Este grupo não está disponível.',true);
 if(!confirm(`Enviar evento para ${group.label}? O Pokémon da caixa será revelado no grupo.`))return;
 if(busy)return;busy=true;
 try{await api('community-drops/dispatch',{voucherId:id,groupId});toast('Evento colocado na fila!');await load(true)}catch(e){toast(e.message,true)}finally{busy=false}
}
async function cancel(id){
 if(!confirm('Cancelar o envio? O crédito volta à sua carteira.'))return;if(busy)return;busy=true;
 try{await api('community-drops/cancel',{voucherId:id});toast('Evento devolvido à carteira.');await load(true)}catch(e){toast(e.message,true)}finally{busy=false}
}
function handleActionClick(e){
 const qtyBtn=e.target.closest('[data-qty-change]');
 if(qtyBtn){e.preventDefault();const id=qtyBtn.dataset.qtyFor;const qty=normalizeQty(currentQty(id,qtyBtn.closest('.modal-panel')||document)+Number(qtyBtn.dataset.qtyChange||0));syncQty(id,qty);return;}
 const speciesBtn=e.target.closest('[data-species]');
 if(speciesBtn){e.preventDefault();speciesModal(speciesBtn.dataset.species,speciesBtn.dataset.sourceBox||'');return;}
 const b=e.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-buy')){e.preventDefault();purchaseModal(b.dataset.buy,currentQty(b.dataset.buy,b.closest('.modal-panel')||document))}
 else if(b.hasAttribute('data-buy-confirm')){e.preventDefault();buy(b.dataset.buyConfirm,currentQty(b.dataset.buyConfirm,b.closest('.modal-panel')||document))}
 else if(b.hasAttribute('data-paid-details'))paidModal(b.dataset.paidDetails);
 else if(b.hasAttribute('data-odds'))oddsModal(b.dataset.odds);
 else if(b.hasAttribute('data-free'))claimFree(b.dataset.free);
 else if(b.hasAttribute('data-dispatch'))dispatch(b.dataset.dispatch);
 else if(b.hasAttribute('data-cancel'))cancel(b.dataset.cancel);
 else if(b.hasAttribute('data-close'))closeModal();
}
document.addEventListener('click',handleActionClick);
document.addEventListener('input',handleQuantityInput);
$('#refresh')?.addEventListener('click',()=>load(false));
$('#claimFree')?.addEventListener('click',()=>claimFree('freeMystery'));
$('#modal')?.addEventListener('click',e=>{if(e.target.hasAttribute('data-close'))closeModal()});
document.addEventListener('keydown',handleEscape);
$('#themeToggle')?.addEventListener('click',()=>{document.body.classList.toggle('light');try{localStorage.setItem('theme',document.body.classList.contains('light')?'light':'dark')}catch(_){}});
try{if(localStorage.getItem('theme')==='light'||localStorage.getItem('darkMode')==='false')document.body.classList.add('light')}catch(_){ }
window.addEventListener('pagehide',()=>{if(portalModal){closeModal();portalModal.remove();portalModal=null;}});
const qs=new URLSearchParams(location.search);
load().then(()=>{const viewBox=qs.get('viewBox'),buyId=qs.get('buy');if(viewBox)paidModal(viewBox);else if(buyId)purchaseModal(buyId);});
setInterval(()=>{if(!document.hidden&&!$('#modal')?.classList.contains('open')&&isLogged())load(true)},30000);
})();
