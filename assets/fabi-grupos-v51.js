/* Fabi Grupos V49 | Pódio real da Fabi, fotos imersivas, contato WhatsApp validado. */
'use strict';
(()=>{
const API='/api/fabi-grupos';
const $=id=>document.getElementById(id);
const el=(tag,cl,content)=>{const e=document.createElement(tag);if(cl)e.className=cl;if(content!==undefined)e.textContent=String(content);return e};
let groups=[],boostId=null,detailId=null,page=1,adminKey='',requests=[],sessions=[],inventory=[],lastFocus=null,onlyFavorites=false,typeFilter='';
const favoriteKey='fabi-grupos-favorites-v1';
let favorites=new Set();try{favorites=new Set(JSON.parse(localStorage.getItem(favoriteKey)||'[]').filter(x=>typeof x==='string').slice(0,500))}catch{}
function saveFavorites(){try{localStorage.setItem(favoriteKey,JSON.stringify([...favorites]))}catch{};$('favoritesCount').textContent=String(favorites.size)}
function isFavorite(id){return favorites.has(String(id))}
function toggleFavorite(id){const key=String(id);if(isFavorite(key))favorites.delete(key);else favorites.add(key);saveFavorites();if(detailId===id)updateDetailFavorite();render()}
function updateDetailFavorite(){if($('detailsFavorite'))$('detailsFavorite').textContent=isFavorite(detailId)?'♥ Salvo nos favoritos':'♡ Salvar nos favoritos'}
// SEO V49: canonical URL for a publicly listed group; old ?grupo=id links continue working.
function slugify(name){return String(name||'grupo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,65).replace(/-+$/,'')||'grupo'}
function detailUrl(id){const g=groups.find(x=>String(x.id)===String(id));if(g&&/^[a-f0-9]{24}$/.test(String(g.id)))return new URL('/grupos/g/'+slugify(g.name)+'--'+g.id,location.origin).href;const u=new URL('/grupos',location.origin);u.searchParams.set('grupo',String(id));return u.href}

function showSiteToast(message){const t=$('siteToast');t.textContent=message;t.classList.add('visible');clearTimeout(showSiteToast.timer);showSiteToast.timer=setTimeout(()=>t.classList.remove('visible'),3500)}
async function copyGroupLink(id){const link=detailUrl(id);try{await navigator.clipboard.writeText(link);showSiteToast('Link copiado!')}catch{const input=$('detailsLink');input.focus();input.select();showSiteToast('Selecione e copie o link exibido')}}
async function shareGroup(id){const g=groups.find(x=>String(x.id)===String(id));const data={title:g?.name||'Fabi Grupos',text:'Confira este grupo no Fabi Grupos',url:detailUrl(id)};try{if(navigator.share){await navigator.share(data);return}}catch(e){if(e.name==='AbortError')return}await copyGroupLink(id)}
const cats=['Tecnologia','Jogos','Estudos','Notícias','Amizade','Futebol','Música','Negócios','Comunidades','Outros'];
const themeKey='fabi-grupos-theme';
const safeUrl=url=>{if(typeof url!=='string'||!/^https:\/\//i.test(url.trim()))return null;try{const u=new URL(url.trim());return u.protocol==='https:'?u.href:null}catch{return null}};
const niceInt=n=>Number(n||0).toLocaleString('pt-BR');
const dateFmt=(s)=>{const d=new Date(s||Date.now());return isNaN(d)?'—':d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})};

function applyTheme(theme){
  const next=theme==='dark'?'dark':'light';
  document.documentElement.dataset.theme=next;
  $('themeToggle')?.setAttribute('aria-label',next==='light'?'Ativar modo escuro':'Ativar modo claro');
  $('themeToggle')?.setAttribute('title',next==='light'?'Ativar modo escuro':'Ativar modo claro');
  if($('themeToggleIcon'))$('themeToggleIcon').textContent=next==='light'?'☾':'☀';
  const meta=$('themeMeta');if(meta)meta.content=next==='light'?'#f8f8fe':'#101326';
  try{localStorage.setItem(themeKey,next)}catch{}
}
let startingTheme='light';try{startingTheme=localStorage.getItem(themeKey)||((window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light')}catch{}
applyTheme(startingTheme);
$('themeToggle')?.addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='light'?'dark':'light'));
$('adminThemeToggle')?.addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='light'?'dark':'light'));
$('year').textContent=String(new Date().getFullYear());

function toast(target,msg,error=false){const n=$(target);if(!n)return;n.textContent=msg;n.className='toast show'+(error?' error':'')}
function drawEmpty(root,title,details){root.replaceChildren();const e=el('div','empty-state');e.append(el('strong','',title),el('p','',details));root.append(e)}
function createButton(label,fn,cls='mini-btn'){const b=el('button',cls,label);b.type='button';b.onclick=fn;return b}
function createBadge(text,cl='mini-tag'){return el('span',cl,text)}

async function api(path,opts={}){
  const abort=new AbortController();
  const timeout=setTimeout(()=>abort.abort(),20000);
  try{
    const res=await fetch(API+path,{...opts,signal:abort.signal,headers:{...(opts.headers||{}),'Accept':'application/json'},credentials:'same-origin'});
    const value=await res.json().catch(()=>({}));
    if(!res.ok)throw Error(value.error||value.message||('Serviço indisponível ('+res.status+')'));
    return value;
  }finally{clearTimeout(timeout)}
}

function openBackdrop(id){lastFocus=document.activeElement;const modal=$(id);modal.classList.add('show');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
function closeBackdrop(id){const modal=$(id);modal.classList.remove('show');modal.setAttribute('aria-hidden','true');document.body.style.overflow='';lastFocus?.focus?.()}
function openModal(kind,gid){
 boostId=gid||null;openBackdrop('modal');$('modalToast').className='toast';
 $('submitForm').classList.toggle('hidden',kind==='boost');$('boostForm').classList.toggle('hidden',kind!=='boost');
 $('modalTitle').textContent=kind==='boost'?'Impulsione e brilhe no catálogo':'Divulgue seu grupo ou canal';
 $('modalKicker').textContent=kind==='boost'?'destaque do dia + anúncio':'cadastro gratuito';
 $('modalSub').textContent=kind==='boost'?'Seu grupo entra nos Destaques do Dia, aparece como anúncio no catálogo e ganha prioridade de visibilidade. Qualquer pessoa pode impulsionar — não concede administração.':'Cole o convite do WhatsApp. Se já estiver publicado, você poderá conhecê-lo e patrocinar imediatamente. A Fabi Free é exclusiva de grupos elegíveis.';
 const group=groups.find(g=>String(g.id)===String(gid))||(typeof duplicateRecord!=='undefined'&&duplicateRecord?.group?.id===gid?duplicateRecord.group:null);$('boostName').textContent=group?'✦ '+group.name:'';
 if(kind==='submit'&&$('inviteWhatsApp').value.trim())checkInviteNow();
 $('closeModal').focus();
}
function closeModal(){closeBackdrop('modal')}
for(const btn of document.querySelectorAll('[data-modal]'))btn.addEventListener('click',()=>openModal(btn.dataset.modal));
$('closeModal').onclick=closeModal;$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal()});

function groupKind(group){return group.type==='channel'?'channel':'group'}
function communityLabel(group){return groupKind(group)==='channel'?'Canal':'Grupo'}
function themeFor(cat){const n=String(cat||'').toLowerCase();if(/jog|game|pok|arena/.test(n))return {icon:'🎮',label:'games'};if(/estud|escola|curso|concurs/.test(n))return {icon:'📚',label:'studies'};if(/fut|esport/.test(n))return {icon:'⚽',label:'sports'};if(/mús|art|filme|série/.test(n))return {icon:'🎵',label:'culture'};if(/amiz|namoro|conhecer|social|comunid/.test(n))return {icon:'💬',label:'social'};return {icon:'✳',label:'tech'}}
function imageOrIcon(group){const tone=themeFor(group.category);const fallback=el('div','group-avatar',tone.icon);const url=safeUrl(group.photo);if(!url)return fallback;const img=document.createElement('img');img.className='group-avatar';img.alt='Foto do grupo';img.loading='lazy';img.referrerPolicy='no-referrer';img.src=url;img.onerror=()=>img.replaceWith(fallback);return img}
function joinUrl(group){return API+'/r/'+encodeURIComponent(group.id)}

function makePhotoBackdrop(group){
 const url=safeUrl(group.photo);
 if(!url)return null;
 const img=document.createElement('img');
 img.className='cover-backdrop'; img.alt=''; img.loading='lazy'; img.decoding='async';img.referrerPolicy='no-referrer';img.src=url;
 img.onerror=()=>img.remove(); return img;
}
function card(group){
 const theme=themeFor(group.category),boosted=Boolean(group.boostUntil&&Date.parse(group.boostUntil)>Date.now());
 const article=el('article','group-card premium-group-card');
 article.dataset.theme=theme.label; article.classList.toggle('is-boosted',boosted);
 const banner=el('div','card-banner premium-card-cover');
 const backdrop=makePhotoBackdrop(group);if(backdrop)banner.append(backdrop);
 const coverShade=el('div','cover-shade');banner.append(coverShade);
 const upper=el('div','card-cover-top');
 upper.append(el('span','badge',boosted?'✦ EM DESTAQUE':groupKind(group)==='channel'?'📢 CANAL':'👥 GRUPO'));
 const favorite=createButton(isFavorite(group.id)?'♥':'♡',()=>toggleFavorite(group.id),'favorite-btn');
 favorite.setAttribute('aria-label',isFavorite(group.id)?'Remover dos favoritos':'Salvar nos favoritos');favorite.title=favorite.getAttribute('aria-label');
 upper.append(favorite);banner.append(upper);
 const avatar=el('div','card-photo-frame');avatar.append(imageOrIcon(group));banner.append(avatar);
 const coverBottom=el('div','cover-bottom');
 coverBottom.append(el('span','cover-category',theme.icon+' '+(group.category||'Comunidade')));
 if(group.managed)coverBottom.append(el('span','cover-managed',group.plan==='free'?'🛡 Fabi Free':group.plan==='pro'?'💎 Fabi Pro':'✓ Fabi conectada'));
 banner.append(coverBottom);
 const main=el('div','card-main');
 const heading=el('div','group-title premium-title');heading.append(el('h3','',group.name||'Grupo sem nome'));
 main.append(heading,el('p','group-description',(group.description||'Conheça esta comunidade.').slice(0,230)));
 const foot=el('div','card-tags');
 if(group.members>0)foot.append(createBadge('👥 '+niceInt(group.members)+' membros'));
 foot.append(createBadge(group.managed?(group.plan==='free'?'🛡 Plano Free':group.plan==='pro'?'💎 Plano Pro':'✳ Proteção Fabi'):'✓ Divulgado no catálogo'));
 main.append(foot);
 const actions=el('div','card-actions premium-card-actions');
 const join=document.createElement('a');join.href=joinUrl(group);join.target='_blank';join.rel='noopener noreferrer';join.textContent=groupKind(group)==='channel'?'Seguir canal ↗':'Entrar no grupo ↗';
 const details=createButton('Ver detalhes',()=>openDetails(group.id));
 const permalink=document.createElement('a');permalink.href=detailUrl(group.id);permalink.className='group-seo-link';permalink.textContent='Página do grupo ↗';permalink.setAttribute('aria-label','Abrir página completa de '+String(group.name||'grupo'));
 const boostAction=createButton(boosted?'✦ Renovar destaque':'✦ Patrocinar',()=>openModal('boost',group.id),'boost-card-btn');boostAction.setAttribute('aria-label','Patrocinar '+communityLabel(group).toLowerCase()+' '+String(group.name||''));
 actions.append(join,details,boostAction);main.append(actions,permalink);
 article.append(banner,main);
 banner.addEventListener('click',e=>{if(!e.target.closest('a,button'))openDetails(group.id)});
 article.addEventListener('click',e=>{if(!e.target.closest('a,button')&&!e.target.closest('.card-banner'))openDetails(group.id)});
 return article;
}
function configureCategories(){
  const available=[...new Set(groups.map(g=>g.category||'Outros'))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const sel=$('category');
  const selected=sel.value;
  sel.replaceChildren(new Option('Todas',''));
  for(const c of available)sel.add(new Option(c,c));
  sel.value=selected;

  const submit=$('submitCategory');
  submit.replaceChildren();
  for(const c of cats)submit.add(new Option(c,c));
  for(const c of available)if(!cats.includes(c))submit.add(new Option(c,c));

  const chips=$('chips');
  chips.replaceChildren();
  for(const cat of ['',...available.slice(0,8)]){
    const chip=createButton(cat||'Todos',()=>{sel.value=cat;page=1;render();closeMobileFilters()},'chip');
    chip.dataset.cat=cat;
    chip.classList.toggle('active',selected===cat);
    chips.append(chip);
  }
}

function filteredGroups(){
  const q=$('search').value.toLocaleLowerCase('pt-BR').trim();
  const cat=$('category').value;
  const sort=$('sort').value;
  const list=groups.filter(g=>(!onlyFavorites||isFavorite(g.id))&&(!typeFilter||groupKind(g)===typeFilter)&&(!cat||g.category===cat)&&(!q||(`${g.name||''} ${g.description||''} ${g.category||''}`).toLocaleLowerCase('pt-BR').includes(q)));
  list.sort((a,b)=>{
    if(sort==='name')return (a.name||'').localeCompare(b.name||'','pt-BR');
    if(sort==='members')return (b.members||0)-(a.members||0);
    if(sort==='recent')return Date.parse(b.updatedAt||0)-Date.parse(a.updatedAt||0);
    const boost=x=>Date.parse(x.boostUntil||0)>Date.now()?1:0;
    return boost(b)-boost(a)||Date.parse(b.updatedAt||0)-Date.parse(a.updatedAt||0);
  });
  return {list,q,cat};
}


function render(){
  const {list,cat,q}=filteredGroups();
  for(const chip of $('chips').children)chip.classList.toggle('active',chip.dataset.cat===cat);
  $('favoritesFilter').setAttribute('aria-pressed',String(onlyFavorites));$('favoritesFilter').classList.toggle('selected',onlyFavorites);
  $('resultsCount').textContent=niceInt(list.length)+' '+(typeFilter==='channel'?'canal'+(list.length===1?'':'is'):typeFilter==='group'?'grupo'+(list.length===1?'':'s'):'comunidade'+(list.length===1?'':'s'))+' encontrado'+(list.length===1?'':'s');
  const root=$('groups');root.replaceChildren();
  if(!list.length){drawEmpty(root,onlyFavorites?'Nenhum favorito encontrado':q?'Nenhuma comunidade encontrada':'Nenhuma comunidade publicada ainda',onlyFavorites?'Salve grupos ou canais tocando no coração de cada card.':q?'Tente outras palavras ou categorias.':'Cadastre gratuitamente seu grupo ou canal para aparecer aqui.');$('pagination').replaceChildren();return}
  const per=12,pages=Math.max(1,Math.ceil(list.length/per));page=Math.min(page,pages);
  for(const g of list.slice((page-1)*per,page*per))root.append(card(g));
  const pager=$('pagination');pager.replaceChildren();
  if(pages>1){
    const prev=createButton('← Anterior',()=>{page--;render();document.querySelector('#explorar').scrollIntoView({block:'start'})});
    prev.disabled=page<=1;
    const next=createButton('Próxima →',()=>{page++;render();document.querySelector('#explorar').scrollIntoView({block:'start'})});
    next.disabled=page>=pages;
    pager.append(prev,el('span','',page+' de '+pages),next);
  }
}


/* ========== Anúncio rotativo de grupos impulsionados (V50.1) ========== */
function isBoosted(g){
  return Boolean(g && g.boostUntil && Date.parse(g.boostUntil) > Date.now());
}
let _fabiAdTimer = null;
let _fabiAdHideTimer = null;
let _fabiAdProgressTimer = null;
let _fabiAdIndex = 0;
let _fabiAdClosedUntil = 0;

function getBoostedList(){
  return (groups || []).filter(isBoosted).sort((a,b) => Date.parse(b.boostUntil||0) - Date.parse(a.boostUntil||0));
}

function showSponsoredAd(group){
  const root = $('fabiSponsoredAd');
  if (!root || !group) return;
  if (Date.now() < _fabiAdClosedUntil) return;

  const avatarEl = $('fabiAdAvatar');
  avatarEl.replaceChildren();
  const photo = imageOrIcon(group);
  if (photo && photo.tagName === 'IMG') {
    photo.style.width = '100%'; photo.style.height = '100%'; photo.style.objectFit = 'cover';
    avatarEl.append(photo);
  } else if (photo) {
    avatarEl.append(photo);
  } else {
    avatarEl.textContent = (group.name || '?')[0].toUpperCase();
  }

  $('fabiAdName').textContent = group.name || 'Comunidade';
  $('fabiAdDesc').textContent = (group.description || 'Comunidade impulsionada no catálogo Fabi Grupos.').slice(0, 110);
  const meta = $('fabiAdMeta');
  meta.replaceChildren();
  if (group.members > 0) meta.append(el('span', '', '👥 ' + niceInt(group.members)));
  if (group.category) meta.append(el('span', '', group.category));
  meta.append(el('span', '', '✦ Impulsionado'));

  const join = $('fabiAdJoin');
  join.href = joinUrl(group);
  join.textContent = (groupKind(group) === 'channel' ? 'Seguir canal ↗' : 'Entrar no grupo ↗');

  $('fabiAdBoost').onclick = () => { hideSponsoredAd(true); openModal('boost', group.id); };

  root.hidden = false;
  requestAnimationFrame(() => root.classList.add('is-visible'));

  // Progress bar (show for ~14s)
  const bar = $('fabiAdProgress');
  if (bar) {
    bar.style.transition = 'none';
    bar.style.transform = 'scaleX(1)';
    requestAnimationFrame(() => {
      bar.style.transition = 'transform 14s linear';
      bar.style.transform = 'scaleX(0)';
    });
  }

  clearTimeout(_fabiAdHideTimer);
  _fabiAdHideTimer = setTimeout(() => hideSponsoredAd(false), 14500);
}

function hideSponsoredAd(userClosed){
  const root = $('fabiSponsoredAd');
  if (!root) return;
  root.classList.remove('is-visible');
  setTimeout(() => { root.hidden = true; }, 420);
  clearTimeout(_fabiAdHideTimer);
  if (userClosed) {
    // user closed → wait longer before next
    _fabiAdClosedUntil = Date.now() + 90000; // 90s
  }
}

function scheduleNextSponsoredAd(){
  clearTimeout(_fabiAdTimer);
  const boosted = getBoostedList();
  if (!boosted.length) return;

  // First appearance after 8–14s, then every 28–42s
  const delay = (_fabiAdIndex === 0) ? (8000 + Math.random()*6000) : (28000 + Math.random()*14000);
  _fabiAdTimer = setTimeout(() => {
    if (Date.now() < _fabiAdClosedUntil) {
      scheduleNextSponsoredAd();
      return;
    }
    const list = getBoostedList();
    if (!list.length) return;
    const group = list[_fabiAdIndex % list.length];
    _fabiAdIndex++;
    showSponsoredAd(group);
    scheduleNextSponsoredAd();
  }, delay);
}

function initSponsoredAds(){
  const closeBtn = $('fabiAdClose');
  if (closeBtn) closeBtn.onclick = () => hideSponsoredAd(true);
  // Start after groups loaded
  scheduleNextSponsoredAd();
}

async function loadGroups(){
  try{
    const data=await api('/public');
    groups=Array.isArray(data.groups)?data.groups:[];
    const total=data.total||groups.length;
    const catCount=new Set(groups.map(g=>g.category||'Outros')).size;
    $('totalGroups').textContent=niceInt(total);
    $('totalCategories').textContent=niceInt(catCount);
    configureCategories();
    render();
    initSponsoredAds();
    const requested=new URLSearchParams(location.search).get('grupo');
    const sponsor=new URLSearchParams(location.search).get('patrocinar');if(sponsor){const found=groups.find(g=>String(g.id)===sponsor);if(found)openModal('boost',found.id);else showSiteToast('Comunidade indisponível ou não publicada.')}
    else if(requested){const found=groups.find(g=>String(g.id)===requested);if(found)openDetails(found.id,true);else showSiteToast('Comunidade indisponível ou não publicada.')}
  }catch(err){
    drawEmpty($('groups'),'Não foi possível carregar o catálogo',err.message+' · Verifique se a API e o proxy da Vercel estão ativos.');
    $('totalGroups').textContent='—';
  }
}

function openDetails(id,fromUrl=false){
 detailId=id;const group=groups.find(g=>String(g.id)===String(id));if(!group)return;
 if(!fromUrl){const u=new URL(location.href);u.searchParams.set('grupo',String(id));history.pushState({group:id},'',u)}
 const boosted=Boolean(group.boostUntil&&Date.parse(group.boostUntil)>Date.now());
 $('detailsTitle').textContent=group.name||'Grupo';
 $('detailsDescription').textContent=group.description||'Sem descrição disponível.';
 $('detailsBadge').textContent=boosted?'✦ Em destaque':groupKind(group)==='channel'?'📢 Canal':group.managed?(group.plan==='free'?'🛡 Fabi Free':group.plan==='pro'?'💎 Fabi Pro':'✓ Fabi conectada'):(group.category||'Comunidade');
 $('detailsUpdated').textContent='Atualizado em '+dateFmt(group.updatedAt);
 $('detailsHero').replaceChildren();
 const cover=makePhotoBackdrop(group);if(cover)$('detailsHero').append(cover);
 $('detailsHero').append(el('div','detail-cover-shade'));
 const hero=el('div','detail-cover-profile');
 const avatar=el('div','detail-photo-frame');avatar.append(imageOrIcon(group));
 const titleWrap=el('div','detail-cover-name');titleWrap.append(el('span','detail-cover-eyebrow','CONHEÇA A COMUNIDADE'),el('h3','',group.name||'Grupo'),el('small','',group.category||'Comunidade'));
 hero.append(avatar,titleWrap);$('detailsHero').append(hero);
 const facts=$('detailsFacts');facts.replaceChildren();
 const items=[['Tipo',communityLabel(group)],['Categoria',group.category||'Comunidade'],...(groupKind(group)==='channel'?[]:[['Membros',group.members>0?niceInt(group.members):'Não informado'],['Fabi Bot',group.managed?(group.plan==='free'?'Free · proteção gratuita':group.plan==='pro'?'Pro · versão completa':'Conectada'):'Não confirmada']]),['Atualização',dateFmt(group.updatedAt)]];
 for(const [label,value] of items){const item=el('div','detail-item');item.append(el('small','',label),el('strong','',value));facts.append(item)}
 $('detailsBotText').textContent=groupKind(group)==='channel'?'Este canal pode receber destaque no catálogo, mas a Fabi Free só pode ser instalada em grupos do WhatsApp.':group.managed?'A Fabi aparece como conectada nesta comunidade. A participação nos rankings depende da contagem de atividade habilitada.':'Este grupo está no catálogo. A instalação da Fabi Free e a participação nos rankings dependem de aprovação, conexão da robô e contagem de atividade.';
 $('detailsJoin').href=joinUrl(group);$('detailsJoin').textContent=groupKind(group)==='channel'?'Seguir canal ↗':'Entrar no grupo ↗';
 $('detailsLink').value=detailUrl(id);updateDetailFavorite();
 const pageButton=$('detailsFullPage');if(pageButton)pageButton.href=detailUrl(id);
 $('detailsBoost').onclick=()=>{closeDetails();openModal('boost',group.id)};
 openBackdrop('detailsModal');$('closeDetailsModal').focus();
}
function closeDetails(){if(!$('detailsModal').classList.contains('show'))return;closeBackdrop('detailsModal');const u=new URL(location.href);if(u.searchParams.has('grupo')){u.searchParams.delete('grupo');history.replaceState({},'',u)}}
$('closeDetailsModal').onclick=closeDetails;
$('detailsFavorite').onclick=()=>toggleFavorite(detailId);
$('detailsShare').onclick=()=>shareGroup(detailId);
$('detailsCopy').onclick=()=>copyGroupLink(detailId);
$('favoritesFilter').onclick=()=>{onlyFavorites=!onlyFavorites;page=1;render()};
saveFavorites();
window.addEventListener('popstate',()=>{const id=new URLSearchParams(location.search).get('grupo');if(!id){if($('detailsModal').classList.contains('show'))closeBackdrop('detailsModal')}else if(groups.some(g=>String(g.id)===id))openDetails(id,true)});
$('detailsModal').addEventListener('click',e=>{if(e.target===$('detailsModal'))closeDetails()});

document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();closeDetails();closeMobileFilters()}});

// V53: feedback instantâneo para cadastros existentes, sem expor cadastros ainda não publicados.
const inviteInput=$('inviteWhatsApp'),duplicateLookup=$('duplicateLookup');
let inviteTimer=null,inviteSequence=0,duplicateRecord=null;
function recognizeInvite(value){
 try{const u=new URL(String(value).trim());if(u.protocol!=='https:')return null;
  if(u.hostname==='chat.whatsapp.com'&&/^\/[A-Za-z0-9]{12,64}\/?$/.test(u.pathname))return 'group';
  if(['whatsapp.com','www.whatsapp.com'].includes(u.hostname)&&/^\/channel\/[A-Za-z0-9]{12,80}\/?$/.test(u.pathname))return 'channel';
 }catch{}return null;
}
function updateEntryKind(type){
 const channel=type==='channel';$('submitNameLabel').textContent=channel?'Nome do canal':'Nome do grupo';
 $('submitDescriptionLabel').textContent=channel?'Sobre o canal':'Sobre o grupo';
 $('freeOptin').classList.toggle('hidden',channel);$('freeOptin').querySelector('input').disabled=channel;
 $('channelExplainer').classList.toggle('hidden',!channel);
 $('submitBtn').textContent=channel?'Enviar canal para análise ↗':'Enviar grupo para análise ↗';
}
function hideDuplicate(){duplicateRecord=null;duplicateLookup.replaceChildren();duplicateLookup.classList.add('hidden');$('submitBtn').disabled=false;}
function renderDuplicate(result){
 hideDuplicate();duplicateRecord=result;
 if(!result?.existing)return;
 const published=result.status==='published'&&result.group;
 duplicateLookup.classList.remove('hidden');
 const panel=el('div','duplicate-panel');
 const intro=el('div','duplicate-head');intro.append(el('span','duplicate-icon',published?'✓':'◷'));
 const copy=el('div','duplicate-summary');copy.append(el('strong','',published?'Esta comunidade já está no Fabi Grupos!':'Este link já está cadastrado'));
 copy.append(el('p','',result.message||'Este link já foi registrado.'));intro.append(copy);panel.append(intro);
 if(published){
  const g=result.group;const entity=el('div','duplicate-entity');const avatar=el('div','duplicate-avatar');avatar.append(imageOrIcon(g));
  const info=el('div');info.append(el('span','duplicate-kind',communityLabel(g).toUpperCase()+' • '+(g.category||'Comunidade')));
  info.append(el('strong','duplicate-name',g.name||'Comunidade'));info.append(el('small','',g.description||''));entity.append(avatar,info);panel.append(entity);
  const actions=el('div','duplicate-actions');
  actions.append(createButton('✦ Patrocinar agora',()=>openModal('boost',g.id),'btn btn-primary'),createButton('Ver comunidade',()=>{closeModal();const found=groups.find(x=>String(x.id)===String(g.id));if(found)openDetails(found.id);else location.href='/grupos/g/'+slugify(g.name)+'--'+g.id},'btn btn-secondary'));
  panel.append(actions);
 }else{panel.append(el('p','duplicate-help','Aguardando análise ou indisponível para publicação. Patrocínio somente depois da aprovação.'))}
 duplicateLookup.append(panel);$('submitBtn').disabled=true;
}
async function checkInviteNow(){
 const value=inviteInput.value.trim(),type=recognizeInvite(value),sequence=++inviteSequence;
 clearTimeout(inviteTimer);hideDuplicate();updateEntryKind(type);
 if(!type)return;
 duplicateLookup.classList.remove('hidden');duplicateLookup.replaceChildren(el('p','duplicate-checking','🔎 Verificando se já está cadastrado…'));
 try{
  const data=await api('/lookup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invite:value})});
  if(sequence!==inviteSequence||inviteInput.value.trim()!==value)return;
  if(data.existing)renderDuplicate(data);else{hideDuplicate();duplicateLookup.classList.remove('hidden');duplicateLookup.replaceChildren(el('p','duplicate-available','✓ Este link está disponível para cadastro gratuito.'));}
 }catch(error){if(sequence!==inviteSequence)return;hideDuplicate();duplicateLookup.classList.remove('hidden');duplicateLookup.replaceChildren(el('p','duplicate-checking','Não foi possível verificar agora. Você ainda pode enviar o cadastro.'));}
}
inviteInput.addEventListener('input',()=>{clearTimeout(inviteTimer);inviteSequence++;hideDuplicate();updateEntryKind(recognizeInvite(inviteInput.value));if(recognizeInvite(inviteInput.value))inviteTimer=setTimeout(checkInviteNow,450)});
inviteInput.addEventListener('blur',()=>{if(recognizeInvite(inviteInput.value)&&!duplicateRecord)checkInviteNow()});
inviteInput.addEventListener('paste',()=>{clearTimeout(inviteTimer);inviteTimer=setTimeout(checkInviteNow,120)});
$('submitForm').addEventListener('submit',async e=>{
 e.preventDefault();if(duplicateRecord?.existing)return;
 const btn=$('submitBtn');btn.disabled=true;btn.textContent='Enviando…';
 try{
  const body=Object.fromEntries(new FormData(e.target));body.requestFree=recognizeInvite(body.invite)==='group'&&e.target.querySelector('[name=requestFree]')?.checked===true;
  if(!recognizeInvite(body.invite))throw Error('Cole um convite válido de grupo ou canal do WhatsApp.');
  const digits=String(body.contact||'').replace(/\D/g,'').replace(/^55(?=\d{10,11}$)/,'');
  if(!/^[1-9][1-9](?:9\d{8}|[2-9]\d{7})$/.test(digits))throw Error('Digite um WhatsApp válido com DDD, por exemplo (92) 99999-9999.');
  body.contact='+55'+digits;
  const d=await api('/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(d.existing){renderDuplicate(d);return}
  toast('modalToast',d.message||'Solicitação recebida.');e.target.reset();hideDuplicate();updateEntryKind('group');
 }catch(err){toast('modalToast',err.message,true)}
 finally{btn.disabled=!!duplicateRecord?.existing;btn.textContent=recognizeInvite(inviteInput.value)==='channel'?'Enviar canal para análise ↗':'Enviar grupo para análise ↗'}
});
for(const button of document.querySelectorAll('[data-type]'))button.addEventListener('click',()=>{
 typeFilter=button.dataset.type;page=1;
 document.querySelectorAll('[data-type]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button))});
 render();
});

// V50: Pix do Mercado Pago, com status conferido no backend.
let pixPollTimer=null,pixTransaction=null,pixChecking=false,pixExpiry=0;
const pixCacheKey='fabi-grupos-pix-pendente-v50';
function closePix(){
  if(pixPollTimer)clearInterval(pixPollTimer);pixPollTimer=null;
  pixTransaction=null;
  if($('pixModal').classList.contains('show'))closeBackdrop('pixModal');
}
function pixCountdown(){
  const remaining=Math.max(0,Math.ceil((pixExpiry-Date.now())/1000));
  $('pixCountdown').textContent=remaining?`Código válido por ${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')} min`:'Prazo do código encerrado. Conferindo o status final.';
}
async function pollPix(){
  if(!pixTransaction||pixChecking)return;
  const tx=pixTransaction;pixChecking=true;
  try{
    const data=await api('/boost/status/'+encodeURIComponent(tx));
    if(tx!==pixTransaction)return;
    if(data.status==='approved'){
      clearInterval(pixPollTimer);pixPollTimer=null;
      $('pixStatus').textContent='✓ Pagamento confirmado! Seu grupo já está em destaque.';
      $('pixCountdown').textContent='O destaque foi ativado automaticamente.';
      $('pixCopyBtn').disabled=true;
      try{sessionStorage.removeItem(pixCacheKey)}catch(_){}
      await loadGroups();
    }else if(data.status==='expired'||data.status==='cancelled'||data.status==='rejected'){
      clearInterval(pixPollTimer);pixPollTimer=null;
      $('pixStatus').textContent='Este Pix venceu ou não foi aprovado. Feche esta janela para gerar um novo.';
      $('pixCountdown').textContent='Nenhum destaque foi ativado.';
      $('pixCopyBtn').disabled=true;
      try{sessionStorage.removeItem(pixCacheKey)}catch(_){}
    }else if(Date.now()>pixExpiry){
      $('pixStatus').textContent='Conferindo a confirmação final com o Mercado Pago…';
    }
  }catch(_){if(tx===pixTransaction)$('pixStatus').textContent='Aguardando confirmação… A consulta será repetida automaticamente.'}
  finally{pixChecking=false}
}
function openPix(info){
  pixTransaction=String(info.transactionId||'');
  pixExpiry=Date.parse(info.expiresAt)||Date.now()+30*60000;
  $('pixPrice').textContent=Number(info.amount).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  $('pixGroupName').textContent=info.groupName||'Destaque Fabi Grupos';
  $('pixCopyPaste').value=info.copyPaste||'';
  $('pixCopyBtn').disabled=!info.copyPaste;
  const qr=String(info.qrCode||'');
  const validQr=qr.length<100000&&/^[A-Za-z0-9+/=]+$/.test(qr);
  $('pixQr').classList.toggle('hidden',!validQr);
  $('pixQrFallback').classList.toggle('hidden',validQr);
  if(validQr)$('pixQr').src='data:image/png;base64,'+qr;
  else $('pixQr').removeAttribute('src');
  $('pixStatus').textContent='Aguardando pagamento… A confirmação é automática.';
  if(pixPollTimer)clearInterval(pixPollTimer);
  openBackdrop('pixModal');$('closePix').focus();
  pixCountdown();pixPollTimer=setInterval(()=>{pixCountdown();pollPix()},5000);
  pollPix();
}
$('closePix').onclick=closePix;
$('pixModal').addEventListener('click',e=>{if(e.target===$('pixModal'))closePix()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePix()});
$('pixCopyBtn').onclick=async()=>{
  const value=$('pixCopyPaste').value;if(!value)return;
  try{await navigator.clipboard.writeText(value)}catch(_){$('pixCopyPaste').select();document.execCommand('copy')}
  $('pixCopyBtn').textContent='✓ Código copiado';
  setTimeout(()=>{$('pixCopyBtn').textContent='Copiar código Pix'},2400);
};
$('payBtn').onclick=async()=>{
  const btn=$('payBtn'),groupId=boostId,plan=$('boostPlan').value;
  const payerEmail=$('boostPayerEmail').value.trim();
  try{
    // Permite voltar a um Pix ainda válido após fechar o modal.
    const cached=JSON.parse(sessionStorage.getItem(pixCacheKey)||'null');
    if(cached?.groupId===groupId&&cached?.plan===plan&&Date.parse(cached.data?.expiresAt)>Date.now()){
      closeModal();openPix(cached.data);return;
    }
  }catch(_){}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)){toast('modalToast','Informe um e-mail válido do pagador para gerar o Pix.',true);return}
  btn.disabled=true;btn.textContent='Gerando Pix…';
  try{
    const data=await api('/boost/pix',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({groupId,plan,payerEmail})});
    if(!data.transactionId||!data.copyPaste)throw Error('O Mercado Pago não retornou o código Pix');
    try{sessionStorage.setItem(pixCacheKey,JSON.stringify({groupId,plan,data}))}catch(_){}
    closeModal();openPix(data);
  }catch(err){toast('modalToast',err.message,true)}
  finally{btn.disabled=false;btn.textContent='Gerar Pix para destacar'}
};

['search','category','sort'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',()=>{page=1;render()}));

function openMobileFilters(){if(window.innerWidth>760)return;document.body.classList.add('filters-open');$('mobileFilterOverlay').classList.add('show');$('mobileFilterOverlay').setAttribute('aria-hidden','false')}
function closeMobileFilters(){document.body.classList.remove('filters-open');$('mobileFilterOverlay').classList.remove('show');$('mobileFilterOverlay').setAttribute('aria-hidden','true')}
$('mobileFilterBtn')?.addEventListener('click',openMobileFilters);
$('mobileFilterOverlay')?.addEventListener('click',closeMobileFilters);
$('closeMobileFilters')?.addEventListener('click',closeMobileFilters);

const FREE_CHANNEL_NOTICE='🛡️ Vagas Fabi Free liberadas! Conecte gratuitamente enquanto houver disponibilidade: https://www.fabibot.com.br/conectar#escolher-fabi';
let freeAdminSnapshot=null;
function freeAdminMessage(message,error=false){const e=$('freeAdminResponse');if(e){e.textContent=message;e.classList.toggle('is-error',Boolean(error))}}
async function freeAdminLoad(){
  const d=await adminApi('/free-capacity');freeAdminSnapshot=d;
  $('freeAdminUsed').textContent=niceInt(d.used);$('freeAdminLimitStat').textContent=niceInt(d.limit);
  $('freeAdminRemaining').textContent=niceInt(d.remaining);$('freeAdminOpen').textContent=d.paused?'⏸ Pausado':d.available?'● Aberto':'● Esgotado';
  $('freeAdminLimitInput').value=String(d.limit);$('freeAdminPaused').checked=Boolean(d.paused);
  const pct=d.limit>0?Math.min(100,Math.round((d.used/d.limit)*100)):100;
  const bar=$('freeAdminProgressBar');bar.style.width=pct+'%';bar.classList.toggle('is-full',pct>=100);
  $('freeAdminProgress').setAttribute('aria-valuenow',String(pct));
  freeAdminMessage('Dados atualizados: '+d.used+' de '+d.limit+' vagas ocupadas.');return d;
}
$('freeAdminForm').addEventListener('submit',async e=>{
 e.preventDefault();const btn=$('freeAdminSave');btn.disabled=true;
 try{const limit=Number($('freeAdminLimitInput').value),paused=$('freeAdminPaused').checked;
  if(!Number.isInteger(limit)||limit<0||limit>100000)throw Error('Informe um limite inteiro de 0 a 100000.');
  await adminApi('/free-capacity','POST',{limit,paused});await freeAdminLoad();adminToast('Vagas Free atualizadas.');
 }catch(err){freeAdminMessage(err.message,true)}finally{btn.disabled=false}
});
$('freeAdminReload').onclick=async()=>{try{await freeAdminLoad()}catch(e){freeAdminMessage(e.message,true)}};
$('freeAdminAnnounce').onclick=async()=>{
 if(!freeAdminSnapshot?.available){freeAdminMessage('Não há vagas abertas para anunciar.',true);return}
 if(!confirm('Enviar notificação de vagas gratuitas aos assinantes?'))return;
 const btn=$('freeAdminAnnounce');btn.disabled=true;
 try{const d=await adminApi('/free-announce','POST',{});freeAdminMessage(d.message+(d.channelPublished?' Publicado no canal.':' Use o botão Copiar aviso para publicar manualmente.'));}
 catch(err){freeAdminMessage(err.message,true)}finally{btn.disabled=false}
};
$('freeAdminCopy').onclick=async()=>{try{await navigator.clipboard.writeText(FREE_CHANNEL_NOTICE);freeAdminMessage('Texto do anúncio copiado. Agora publique no canal oficial.')}catch{freeAdminMessage(FREE_CHANNEL_NOTICE)}};
function adminToast(msg,err=false){toast('adminToast',msg,err);$('adminToast').scrollIntoView({block:'nearest',behavior:'smooth'})}
async function adminApi(path,method='GET',body){return api('/admin'+path,{method,headers:{'x-fabi-admin-key':adminKey,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})}
async function loadAdmin(){
  // live=1: consulta WhatsApp e lista só grupos em que a sessão ainda está
  const [r,s,m,i]=await Promise.all([adminApi('/requests'),adminApi('/sessions'),adminApi('/metrics'),adminApi('/inventory?live=1')]);
  requests=r.groups||[]; sessions=s.sessions||[];
  const raw=Array.isArray(i.groups)?i.groups:[];
  // Backend já tenta anexar convite; mantém quem tem link OU quem veio do live
  inventory=raw.filter(g=>{
    if(!g)return false;
    if(g.present===false||g.inGroup===false)return false;
    if(g.live===false&&g.source==='disk')return false;
    return true;
  });
  $('statAll').textContent=niceInt(m.total); $('statPending').textContent=niceInt(m.pending); $('statSessions').textContent=niceInt(s.total); $('statOnline').textContent=niceInt(s.online);
  showRequests(); showSessions(); showInventory();
  try{await freeAdminLoad()}catch(e){freeAdminMessage('Vagas Free indisponíveis: '+e.message,true)}
}
$('adminLogin').onclick=async()=>{adminKey=$('adminKey').value.trim(); if(!adminKey)return; const btn=$('adminLogin'); btn.disabled=true; try{await loadAdmin(); $('adminAuth').classList.add('hidden'); $('adminDashboard').classList.remove('hidden')}catch(err){$('adminAuth').querySelector('p').textContent='Falha de autenticação: '+err.message}finally{btn.disabled=false}};
$('adminRefresh').onclick=async()=>{try{await loadAdmin();adminToast('Dados atualizados.')}catch(err){adminToast(err.message,true)}};
for(const btn of document.querySelectorAll('[data-tab]'))btn.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===btn)); for(const [tab,panel] of [['requests','tabRequests'],['sessions','tabSessions'],['inventory','tabInventory'],['free','tabFree']])$(panel).classList.toggle('hidden',btn.dataset.tab!==tab)};
function safeStatus(status){return ({pending:'Aguardando',published:'Publicado',paused:'Pausado',rejected:'Rejeitado'})[status]||status}
async function action(path,data,text){try{await adminApi(path,'POST',data);await loadAdmin();adminToast(text||'Atualizado com sucesso.');return true}catch(err){adminToast(err.message,true);return false}}

function showRequests(){
  const root=$('requestsList'); root.replaceChildren();
  const filtered=requests.filter(g=>!$('statusFilter').value||g.status===$('statusFilter').value);
  if(!filtered.length){drawEmpty(root,'Sem solicitações','Nada para mostrar nesse filtro.');return}
  for(const g of filtered.slice(0,300)){
    const row=el('article','admin-entry'),info=el('div'),details=el('div','detail');
    info.append(el('h4','',g.name),el('small','',(g.contact||'Sem contato')+' · '+(g.category||'Outros')));
    details.append(createBadge(g.type==='channel'?'📢 Canal':'👥 Grupo'),createBadge(safeStatus(g.status)),createBadge(g.ownerApproved?'✓ Autorizado':'! Aguardando autorização'),createBadge(g.source||'novo'));
    if(g.requestFree)details.append(createBadge('✳ Solicitou Fabi Free'));
    if(g.groupJid)details.append(createBadge('Grupo '+g.groupJid));
    info.append(details);
    const acts=el('div','admin-actions');
    const waDigits=String(g.contact||'').replace(/\D/g,'');
    if(/^55[1-9][1-9]\d{8,9}$/.test(waDigits)){
      const notice='Olá! Aqui é da equipe Fabi Grupos. Recebemos o cadastro do '+(g.type==='channel'?'canal':'grupo')+' "'+String(g.name||'')+'" para analisar a divulgação.';
      const chat=el('a','mini-btn admin-wa-link','Avisar no WhatsApp ↗');
      chat.href='https://wa.me/'+waDigits+'?text='+encodeURIComponent(notice);
      chat.target='_blank';chat.rel='noopener noreferrer';acts.append(chat);
    }
    if(!g.ownerApproved)acts.append(createButton('Confirmar autorização',async()=>{const note=prompt('Como o administrador confirmou a divulgação?'); if(!note?.trim())return; await action('/'+g.id+'/owner-confirm',{approved:true,note},'Autorização registrada.')}));
    if(g.status!=='published')acts.append(createButton('Publicar',()=>action('/'+g.id+'/decision',{action:'approve'},'Comunidade publicada.')));
    if(g.status==='published')acts.append(createButton('Pausar',()=>action('/'+g.id+'/decision',{action:'pause'},'Comunidade pausada.'),'mini-btn'));
    if(g.status==='pending')acts.append(createButton('Rejeitar',()=>action('/'+g.id+'/decision',{action:'reject'},'Cadastro rejeitado.'),'mini-btn'));
    if(g.ownerApproved&&g.type!=='channel'){
      acts.append(createButton('Vincular Free',async()=>{
        const groupJid=prompt('JID do grupo (ex.: 120363...@g.us):',g.groupJid||''); if(!groupJid)return;
        const free=sessions.filter(s=>s.mode==='free'); if(!free.length){adminToast('Ative um número Free primeiro.',true);return}
        const session=prompt('Número da sessão Free: '+free.map(s=>s.number).join(', '),free[0].number); if(!session)return;
        await action('/'+g.id+'/link-free',{groupJid,session},'Grupo vinculado à sessão Free.');
      }));
      if(g.freeEnabled)acts.append(createButton('Desvincular',()=>{if(confirm('Desvincular a Free deste grupo?'))action('/'+g.id+'/unlink-free',{},'Vínculo desativado.')}));
    }
    row.append(info,acts); root.append(row);
  }
}
$('statusFilter').onchange=showRequests;

function showSessions(){
  const root=$('sessionsList'); root.replaceChildren();
  const q=$('sessionSearch').value.trim();
  const plan=$('sessionModeFilter').value;
  const filtered=sessions.filter(s=>(!q||s.number.includes(q))&&(!plan||s.mode===plan));
  const free=sessions.filter(s=>s.mode==='free').length, pro=sessions.filter(s=>s.mode==='pro').length;
  $('sessionModeStats').textContent=filtered.length+' exibidas · '+free+' Free · '+pro+' Pro';
  if(!filtered.length){drawEmpty(root,'Nenhuma sessão encontrada','Confira se o servidor possui pastas de sessão.');return}
  for(const s of filtered){
    const c=el('article','session-card'),top=el('div','session-top'),status=el('span','pill-label'+(!s.online?' offline':''),s.online?'● Conectado':'○ Offline'),mode=el('span','pill-label',s.mode==='free'?'FREE':'PRO');
    top.append(status,mode);
    c.append(top,el('h4','','+'+s.number),el('small','',s.status||'Sem informação'));
    const acts=el('div','session-actions'); const other=s.mode==='free'?'pro':'free';
    acts.append(createButton(s.mode==='free'?'Ativar Pro':'Ativar Free',async()=>{
      const explanation=other==='free'?'Todos os grupos desta sessão perderão os comandos Pro e ficarão só com a proteção Free.':'Os comandos Pro voltarão a ficar disponíveis; verifique a assinatura do cliente.';
      if(!confirm('Alterar número '+s.number+' para '+other.toUpperCase()+'?\n\n'+explanation))return;
      await action('/sessions/'+encodeURIComponent(s.number)+'/mode',{mode:other},'Modo '+other.toUpperCase()+' aplicado para '+s.number+'.');
    }));
    c.append(acts); root.append(c);
  }
}
$('sessionSearch').oninput=showSessions;
$('sessionModeFilter').onchange=showSessions;


function inventoryInviteUrl(g){
  if(!g||typeof g!=='object')return '';
  const candidates=[g.invite,g.inviteLink,g.inviteUrl,g.link,g.groupLink,g.inviteCode,g.code,g.convite];
  for(const raw of candidates){
    const s=String(raw||'').trim();
    if(!s)continue;
    if(/^https?:\/\/chat\.whatsapp\.com\//i.test(s)){
      try{const u=new URL(s);if(/^\/[A-Za-z0-9_-]{8,}/.test(u.pathname))return u.origin+u.pathname;}catch(_){return s.split('?')[0];}
    }
    // código puro de convite
    if(/^[A-Za-z0-9_-]{8,64}$/.test(s))return 'https://chat.whatsapp.com/'+s;
  }
  // tenta achar no catálogo público já carregado
  try{
    const jid=String(g.groupJid||g.id||g.jid||'');
    const hit=(groups||[]).find(x=>String(x.id)===jid||String(x.groupJid)===jid||String(x.jid)===jid);
    if(hit){
      const l=hit.invite||hit.link||hit.inviteLink||'';
      if(l)return inventoryInviteUrl({invite:l});
    }
  }catch(_){}
  return '';
}

function showInventory(){
  const root=$('inventoryList'); root.replaceChildren();
  const plan=$('inventoryModeFilter').value;
  // Só grupos com a robô E com link de convite utilizável
  const base=inventory.filter(g=>{
    if(!g)return false;
    if(g.present===false||g.botPresent===false||g.botPresente===false||g.inGroup===false)return false;
    const invite=inventoryInviteUrl(g);
    if(!invite)return false;
    g.__inviteUrl=invite;
    return true;
  });
  const filtered=base.filter(g=>!plan||(plan==='unknown'?!['free','pro'].includes(g.mode):g.mode===plan));
  const free=base.filter(g=>g.mode==='free').length,pro=base.filter(g=>g.mode==='pro').length;
  $('inventoryModeStats').textContent=filtered.length+' com link · '+free+' Free · '+pro+' Pro · '+(base.length-free-pro)+' sem plano';
  if(!filtered.length){drawEmpty(root,'Nenhum grupo com link de convite','Só listamos grupos em que a robô está e que possuem convite do WhatsApp.');return}
  for(const g of filtered.slice(0,500)){
    const row=el('article','admin-entry'),info=el('div'),detail=el('div','detail');
    info.append(el('h4','',g.name||g.groupJid),el('small','',g.groupJid));
    detail.append(createBadge('🤖 Robô presente'),createBadge('🔗 Com link'),createBadge(g.published?'No catálogo':'Não divulgado'));
    if(g.session)detail.append(createBadge('Sessão '+g.session));
    if(g.members)detail.append(createBadge(niceInt(g.members)+' membros'));
    if(g.mode)detail.append(createBadge(g.mode.toUpperCase()));
    info.append(detail);
    const acts=el('div','session-actions');
    const invite=g.__inviteUrl||inventoryInviteUrl(g);
    if(invite){
      const open=document.createElement('a');
      open.href=invite; open.target='_blank'; open.rel='noopener noreferrer';
      open.className='boost-card-btn';
      open.textContent='Entrar no grupo ↗';
      open.style.cssText='display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:10px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;font-weight:700;text-decoration:none;font-size:13px';
      acts.append(open);
      const copy=createButton('Copiar link',async()=>{
        try{await navigator.clipboard.writeText(invite);adminToast('Link copiado.');}
        catch{adminToast(invite);}
      });
      acts.append(copy);
    }
    row.append(info,acts); root.append(row);
  }
}
$('inventoryModeFilter').onchange=showInventory;
$('scanGroups').onclick=async()=>{const b=$('scanGroups');b.disabled=true;b.textContent='Consultando…';try{const data=await adminApi('/inventory?live=1');const raw=data.groups||[];inventory=raw.filter(g=>g&&g.present!==false&&g.inGroup!==false&&!(g.live===false&&g.source==='disk'));showInventory();adminToast('Ao vivo: '+inventory.length+' grupos com a robô (API: '+(data.total||raw.length)+').')}catch(err){adminToast(err.message,true)}finally{b.disabled=false;b.textContent='Consultar sessões'}};
$('diagnoseGroups').onclick=async()=>{const btn=$('diagnoseGroups');btn.disabled=true; try{const d=await adminApi('/diagnostics'); $('inventoryDiagnostics').textContent=`Origem: ${d.source} · Arquivo: ${d.fileExists?'encontrado':'ausente'} · Registros: ${d.registered} · Convites utilizáveis: ${d.withInvite} · Sem convite: ${d.withoutInvite} · Excluídos por privacidade: ${d.excluded} · Publicados: ${d.published} · Sessões: ${d.sessions} (${d.online} online).`;}catch(err){adminToast(err.message,true)} finally{btn.disabled=false}};
$('importGroups').onclick=async()=>{const btn=$('importGroups');btn.disabled=true; try{const d=await adminApi('/import-existing','POST',{}); await Promise.all([loadAdmin(),loadGroups()]); adminToast(`Importação concluída: ${d.added||0} novos, ${d.changed||0} atualizados, ${d.skipped||0} ignorados.`);}catch(err){adminToast(err.message,true)} finally{btn.disabled=false}};

if(new URLSearchParams(location.search).has('admin')){$('adminPanel').classList.remove('hidden'); $('publicMain').classList.add('hidden'); document.querySelector('.footer')?.classList.add('hidden'); $('adminPanel').scrollIntoView({block:'start'});if(location.hash==='#tabFree'){document.querySelector('[data-tab=free]')?.click()}}


// Ranking real: o mesmo backend utilizado pelo pódio e pelo ranking ao vivo do index.html.
const medalRanks={1:'🥇',2:'🥈',3:'🥉'};
const podiumState={medals:null,live:null,liveCat:'ativos'};
const safeInvite=url=>{try{const u=new URL(String(url));return u.protocol==='https:'&&u.hostname==='chat.whatsapp.com'&&/^\/[A-Za-z0-9]{12,64}\/?$/.test(u.pathname)?u.href:null}catch{return null}};
function rankAvatar(group){
 const fallback=el('span','rank-avatar-fallback',(String(group.nome||'G').trim().slice(0,1)||'G').toUpperCase());
 const src=safeUrl(group.imagem);
 if(!src)return fallback;
 const im=document.createElement('img');im.src=src;im.alt='Foto do grupo';im.loading='lazy';im.referrerPolicy='no-referrer';im.onerror=()=>im.replaceWith(fallback);return im;
}
function rankJoinButton(group,cls='rank-join'){
 const href=safeInvite(group.link);
 if(!href)return el('span','rank-no-link','Convite indisponível');
 const link=el('a',cls,'Conhecer ↗');link.href=href;link.target='_blank';link.rel='noopener noreferrer';return link;
}
function drawRankEmpty(root,title,subtitle){root.replaceChildren();const n=el('div','rank-empty');n.append(el('strong','',title),el('p','',subtitle));root.append(n)}
function renderPodium(){
 const root=$('podiumGrid');root.replaceChildren();
 const entries=Array.isArray(podiumState.medals)?podiumState.medals:[];
 if(!entries.length){drawRankEmpty(root,'O pódio está se formando','Assim que o servidor registrar campeões, eles aparecerão aqui automaticamente.');return}
 const sorted=entries.filter(g=>g&&[1,2,3].includes(Number(g.posicao))).sort((a,b)=>({2:0,1:1,3:2}[a.posicao]??4)-({2:0,1:1,3:2}[b.posicao]??4));
 for(const g of sorted){
   const pos=Number(g.posicao),card=el('article','champion-card champion-'+pos);
   const rank=el('span','champion-position',`${medalRanks[pos]} ${pos}º LUGAR`);
   const crown=el('div','champion-crown',pos===1?'♛':'✦');
   const avatar=el('div','champion-avatar');avatar.append(rankAvatar(g));
   const name=el('h3','champion-name',g.nome||'Grupo');
   const category=el('span','champion-category',g.categoria||'Comunidade');
   const medalBox=el('div','champion-medals');
   for(const [emoji,k] of [['🥇','ouro'],['🥈','prata'],['🥉','bronze']]){const tag=el('span','',emoji+' '+niceInt(g.medalhas?.[k]||0));medalBox.append(tag)}
   const all=Number(g.medalhas?.ouro||0)+Number(g.medalhas?.prata||0)+Number(g.medalhas?.bronze||0);
   const caption=el('p','champion-caption',niceInt(all)+' medalha'+(all===1?'':'s')+' conquistada'+(all===1?'':'s'));
   card.append(rank,crown,avatar,name,category,medalBox,caption,rankJoinButton(g));
   root.append(card);
 }
 if(!root.children.length)drawRankEmpty(root,'Pódio indisponível','Ainda não existem posições para mostrar.');
}
function renderLiveRank(){
 const root=$('liveRankList');root.replaceChildren();
 const category=podiumState.liveCat;
 const data=podiumState.live&&Array.isArray(podiumState.live[category])?podiumState.live[category].slice(0,10):[];
 if(!data.length){drawRankEmpty(root,'Sem classificação neste momento','A Fabi ainda não disponibilizou dados para este ranking.');return}
 for(const [index,g] of data.entries()){
   const row=el('article','live-rank-row'),position=el('span','live-rank-position',String(g.posicao||index+1).padStart(2,'0'));
   const avatar=el('div','live-rank-avatar');avatar.append(rankAvatar(g));
   const main=el('div','live-rank-main');main.append(el('strong','',g.nome||'Grupo'),el('small','',category==='ativos'?'Classificação de atividade':'Classificação de Golds'));
   const delta=g.tendencia==='subiu'?'↑ Subiu':g.tendencia==='desceu'?'↓ Desceu':'—';
   row.append(position,avatar,main,el('span','live-rank-delta '+(g.tendencia||'estavel'),delta),rankJoinButton(g,'rank-join compact'));
   root.append(row);
 }
}
async function loadPodium(){
 const root=$('podiumGrid');drawRankEmpty(root,'Consultando os campeões…','Buscando o pódio oficial da Fabi.');
 try{
   const response=await api('/podium');
   if(!response||response.success!==true||!Array.isArray(response.podio))throw Error('Resposta inválida do ranking');
   podiumState.medals=response.podio;renderPodium();
 }catch(error){drawRankEmpty(root,'Pódio temporariamente indisponível','Não foi possível consultar o ranking agora. Toque em Atualizar campeões para tentar novamente.');}
}
async function loadLiveRank(){
 const root=$('liveRankList');drawRankEmpty(root,'Consultando classificação…','Buscando a disputa atual dos grupos.');
 try{
   const response=await api('/live-ranking');
   if(!response||response.success!==true)throw Error('Resposta inválida');
   podiumState.live=response;renderLiveRank();
 }catch(error){drawRankEmpty(root,'Ranking temporariamente indisponível','Tente atualizar mais tarde. Os dados são fornecidos pelo servidor da Fabi.');}
}
for(const button of document.querySelectorAll('[data-rank-view]'))button.addEventListener('click',()=>{
 const daily=button.dataset.rankView==='daily';
 for(const b of document.querySelectorAll('[data-rank-view]')){b.classList.toggle('active',b===button);b.setAttribute('aria-selected',String(b===button))}
 $('podiumMedalsPanel').classList.toggle('hidden',daily);$('rankTodayPanel').classList.toggle('hidden',!daily);
 if(daily&&!podiumState.live)loadLiveRank();
});
for(const button of document.querySelectorAll('[data-live-cat]'))button.addEventListener('click',()=>{
 podiumState.liveCat=button.dataset.liveCat;
 for(const b of document.querySelectorAll('[data-live-cat]')){b.classList.toggle('active',b===button);b.setAttribute('aria-selected',String(b===button))}
 renderLiveRank();
});
$('reloadPodium').addEventListener('click',loadPodium);
$('reloadLiveRank').addEventListener('click',loadLiveRank);

// Máscara amigável: (DDD) 99999-9999; a API rejeita e-mail ou número sem DDD.
const whatsappInput=$('contactWhatsApp');
function maskWhatsApp(v){
 let digits=String(v||'').replace(/\D/g,'');
 if(digits.length>11&&digits.startsWith('55'))digits=digits.slice(2);
 digits=digits.slice(0,11);
 if(digits.length<=2)return digits.length?'('+digits:'';
 if(digits.length<=6)return '('+digits.slice(0,2)+') '+digits.slice(2);
 const split=digits.length<=10?6:7;
 return '('+digits.slice(0,2)+') '+digits.slice(2,split)+'-'+digits.slice(split);
}
whatsappInput.addEventListener('input',()=>{whatsappInput.value=maskWhatsApp(whatsappInput.value);whatsappInput.setCustomValidity('')});
whatsappInput.addEventListener('blur',()=>{const digits=whatsappInput.value.replace(/\D/g,'');whatsappInput.setCustomValidity(/^[1-9][1-9](?:9\d{8}|[2-9]\d{7})$/.test(digits)?'':'Informe um WhatsApp válido com DDD.');});

/* =====================================================================
   FABI GRUPOS V51 — LOGIN OPCIONAL + MEUS GRUPOS + POLIMENTO
   A conta Fabi é opcional: quem já entrou no index ou no conectar
   enxerga aqui as comunidades cadastradas com o próprio WhatsApp.
   ===================================================================== */
const V51_PROXY=window.FABI_PROXY_BASE||'https://orange-hill-2e61.gbscabral15.workers.dev/br2.bronxyshost.com:4009/proxy';
const V51_ORIGIN=window.FABI_BACKEND_ORIGIN||'http://br2.bronxyshost.com:4009';
function v51Proxy(pathAndQuery){
  let p=String(pathAndQuery||'/');if(!p.startsWith('/'))p='/'+p;
  return V51_PROXY+'?url='+encodeURIComponent(V51_ORIGIN.replace(/\/$/,'')+p);
}
function v51Session(){
  try{
    const raw=localStorage.getItem('fabi_session')||localStorage.getItem('neconecta_user_session');
    if(!raw)return null;
    const s=JSON.parse(raw);
    if(!s||s.logado===false)return null;
    if(!s.nome&&!s.id&&!s.numero)return null;
    return s;
  }catch{return null}
}
function v51ContaNumero(){
  const s=v51Session();
  return s?String(s.numero||'').replace(/\D/g,''):'';
}
function v51Nome(){const s=v51Session();return String((s&&(s.nome||s.id))||'').trim()||'Minha conta'}
function v51TokenDados(token){
  try{if(!token)return null;return JSON.parse(atob(String(token).split('.')[0].replace(/-/g,'+').replace(/_/g,'/')))}catch{return null}
}
let v51RefreshPending=null;
async function v51AssegurarToken(force=false){
  try{
    const conta=v51ContaNumero();
    if(!conta)return false;
    let atual=sessionStorage.getItem('fabi_group_token')||'';
    const dados=v51TokenDados(atual);
    if(atual&&(!dados||String(dados.num||'')!==conta)){sessionStorage.removeItem('fabi_group_token');atual=''}
    if(!force&&dados&&Number(dados.exp)>Date.now()+120000)return true;
    let refresh='';
    try{
      const r=JSON.parse(localStorage.getItem('fabi_group_refresh_v33')||'null');
      if(r&&String(r.numero||'').replace(/\D/g,'')===conta)refresh=String(r.token||'');
    }catch{}
    if(!refresh)return Boolean(dados&&Number(dados.exp)>Date.now()+15000);
    if(v51RefreshPending)return v51RefreshPending;
    v51RefreshPending=(async()=>{
      const response=await fetch(v51Proxy('/api/grupos/renovar-token'),{
        method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
        body:JSON.stringify({fabiGrupoRefreshToken:refresh})
      });
      const data=await response.json().catch(()=>({}));
      if(response.status===401||response.status===403){
        localStorage.removeItem('fabi_group_refresh_v33');
        sessionStorage.removeItem('fabi_group_token');
        return false;
      }
      if(!response.ok||!data.success)return false;
      if(!data.fabiGrupoToken||String(data.numero||'').replace(/\D/g,'')!==conta)return false;
      sessionStorage.setItem('fabi_group_token',data.fabiGrupoToken);
      if(data.fabiGrupoRefreshToken)localStorage.setItem('fabi_group_refresh_v33',JSON.stringify({numero:conta,token:data.fabiGrupoRefreshToken}));
      return true;
    })().finally(()=>{v51RefreshPending=null});
    return await v51RefreshPending;
  }catch(err){console.warn('[Fabi Grupos V51] renovação:',err.message);return false}
}

/* ---------- Cabeçalho: chip do usuário + menu ---------- */
function v51AvatarHTML(s,size){
  const url=String((s&&(s.avatar||s.foto))||'');
  const letra=(v51Nome()[0]||'F').toUpperCase();
  if(/^https?:\/\//i.test(url))return '<img src="'+url.replace(/"/g,'')+'" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createTextNode(\''+letra+'\'))">';
  return letra;
}
function v51RenderAuth(){
  const sessao=v51Session();
  const loginBtn=$('authLoginBtn'),chip=$('userChip'),menu=$('userMenu');
  if(!loginBtn||!chip||!menu)return;
  if(!sessao){
    loginBtn.hidden=false;chip.hidden=true;
    menu.classList.remove('open');menu.hidden=true;chip.setAttribute('aria-expanded','false');
    $('meus-grupos')?.classList.add('hidden');
    return;
  }
  loginBtn.hidden=true;chip.hidden=false;
  const nome=v51Nome(),primeiro=nome.split(' ')[0].slice(0,18);
  $('userChipName').textContent=primeiro;
  $('userChipAvatar').innerHTML=v51AvatarHTML(sessao);
  $('umName').textContent=nome.length>22?nome.slice(0,21)+'…':nome;
  $('umAvatar').innerHTML=v51AvatarHTML(sessao);
  const conta=v51ContaNumero();
  $('umMeta').textContent=conta?('•••• '+String(conta).slice(-4)):'Conta Fabi';
  $('meus-grupos')?.classList.remove('hidden');
  if($('mgUserName'))$('mgUserName').textContent=primeiro;
}
function v51CloseUserMenu(){
  const menu=$('userMenu'),chip=$('userChip');
  if(!menu)return;
  menu.classList.remove('open');menu.hidden=true;
  chip?.setAttribute('aria-expanded','false');
}
function v51ToggleUserMenu(){
  const menu=$('userMenu'),chip=$('userChip');
  if(!menu||!chip)return;
  const abrir=!menu.classList.contains('open');
  if(abrir){menu.hidden=false;requestAnimationFrame(()=>menu.classList.add('open'));chip.setAttribute('aria-expanded','true')}
  else v51CloseUserMenu();
}
function v51InitAuthChrome(){
  $('userChip')?.addEventListener('click',v51ToggleUserMenu);
  $('userChip')?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();v51ToggleUserMenu()}});
  document.addEventListener('click',e=>{
    const area=$('authArea');
    if(area&&!area.contains(e.target))v51CloseUserMenu();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')v51CloseUserMenu()});
  $('umMyGroups')?.addEventListener('click',()=>{v51CloseUserMenu()});
  $('umLogout')?.addEventListener('click',()=>{
    try{
      localStorage.removeItem('fabi_session');
      localStorage.removeItem('neconecta_user_session');
      localStorage.removeItem('fabi_group_refresh_v33');
      sessionStorage.removeItem('fabi_group_token');
    }catch{}
    v51RenderAuth();
    showSiteToast('Você saiu da conta. Pode voltar quando quiser!');
  });
  // Menu mobile
  const toggle=$('menuToggle'),nav=$('topnav');
  toggle?.addEventListener('click',()=>{
    const open=nav?.classList.toggle('open');
    toggle.setAttribute('aria-expanded',String(Boolean(open)));
    toggle.textContent=open?'✕':'☰';
  });
  nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
    nav.classList.remove('open');toggle?.setAttribute('aria-expanded','false');if(toggle)toggle.textContent='☰';
  }));
}

/* ---------- Meus grupos ---------- */
let v51MeusGrupos=[];
const V51_STATUS={pending:'Aguardando análise',published:'Publicado',paused:'Pausado',rejected:'Rejeitado'};
function v51StatusClass(status){return ['published','pending','paused','rejected'].includes(status)?status:'pending'}
async function v51CarregarMeusGrupos(){
  const grid=$('myGroupsGrid'),sync=$('mgSync');
  if(!grid)return;
  if(!v51Session()){v51MeusGrupos=[];return}
  if(sync)sync.hidden=false;
  try{
    const okToken=await v51AssegurarToken();
    const token=sessionStorage.getItem('fabi_group_token')||'';
    if(!okToken&&!token)throw Error('sessao-expirada');
    const response=await fetch(v51Proxy('/api/grupos/meus-grupos'),{
      method:'POST',
      headers:{'Content-Type':'application/json','x-fabi-grupo-token':token,'Accept':'application/json'},
      cache:'no-store',
      body:JSON.stringify({fabiGrupoToken:token})
    });
    const data=await response.json().catch(()=>({}));
    if(response.status===401){
      // Tenta uma última renovação antes de pedir novo login.
      const retry=await v51AssegurarToken(true);
      if(!retry)throw Error('sessao-expirada');
      const token2=sessionStorage.getItem('fabi_group_token')||'';
      const again=await fetch(v51Proxy('/api/grupos/meus-grupos'),{
        method:'POST',headers:{'Content-Type':'application/json','x-fabi-grupo-token':token2},cache:'no-store',
        body:JSON.stringify({fabiGrupoToken:token2})
      });
      const data2=await again.json().catch(()=>({}));
      if(!again.ok)throw Error(data2.message||'falha');
      v51MeusGrupos=Array.isArray(data2.grupos)?data2.grupos:[];
    }else if(!response.ok||data.success===false){
      if(response.status===404)throw Error('indisponivel');
      throw Error(data.message||'falha');
    }else{
      v51MeusGrupos=Array.isArray(data.grupos)?data.grupos:[];
    }
    if(sync)sync.hidden=true;
    v51RenderMeusGrupos();
    v51RenderBoostPick();
    v51AtualizarBadgeMenu();
  }catch(err){
    console.warn('[Fabi Grupos V51] meus grupos:',err.message);
    if(sync){
      sync.innerHTML='';
      const msg=err.message==='sessao-expirada'
        ? 'Sua sessão expirou. <a href="/login?redirect=/grupos" style="color:var(--purple);font-weight:800">Entre novamente</a> para sincronizar seus grupos.'
        : err.message==='indisponivel'
          ? 'A sincronização de grupos está sendo ativada no servidor. Enquanto isso, você já pode cadastrar e divulgar normalmente.'
          : 'Não foi possível sincronizar agora. <button type="button" id="mgRetry" style="border:0;background:none;color:var(--purple);font-weight:800;cursor:pointer">Tentar novamente</button>';
      sync.innerHTML=msg;
      $('mgRetry')?.addEventListener('click',()=>{sync.hidden=false;sync.innerHTML='<span class="spin" aria-hidden="true"></span> Sincronizando seus grupos com a conta Fabi…';v51CarregarMeusGrupos()});
    }
    v51MeusGrupos=[];
    v51RenderMeusGrupos();
    v51RenderBoostPick();
  }
}
function v51RenderMeusGrupos(){
  const grid=$('myGroupsGrid');
  if(!grid||!v51Session())return;
  grid.replaceChildren();
  if(!v51MeusGrupos.length){
    const empty=el('div','mg-empty');
    empty.append(el('span','mg-empty-icon','🗂️'));
    empty.append(el('strong','','Nenhuma comunidade por aqui ainda'));
    empty.append(el('p','','Cadastre o link do seu grupo ou canal e acompanhe a aprovação direto neste painel. É grátis e leva menos de um minuto.'));
    const cta=el('button','btn btn-primary','＋ Cadastrar meu primeiro grupo');
    cta.type='button';cta.addEventListener('click',()=>openModal('submit'));
    empty.append(cta);
    grid.append(empty);
    return;
  }
  const publicados=v51MeusGrupos.filter(g=>g&&g.status==='published');
  for(const g of v51MeusGrupos.slice(0,24)){
    const status=String(g.status||'pending');
    const cardEl=el('article','mygroup-card');
    cardEl.dataset.status=v51StatusClass(status);
    const top=el('div','mygroup-top');
    top.append(el('h3','',g.name||'Comunidade sem nome'));
    top.append(el('span','mg-status '+v51StatusClass(status),V51_STATUS[status]||status));
    cardEl.append(top);
    const meta=el('div','mygroup-meta');
    meta.append(el('span','mg-tag',(g.type==='channel'?'📢 Canal':'👥 Grupo')+' · '+(g.category||'Outros')));
    if(g.requestFree)meta.append(el('span','mg-tag free','🛡 Solicitou Fabi Free'));
    if(g.boostUntil&&Date.parse(g.boostUntil)>Date.now())meta.append(el('span','mg-tag boost','✦ Em destaque'));
    if(g.managed)meta.append(el('span','mg-tag free','✓ Fabi conectada'));
    cardEl.append(meta);
    if(g.description)cardEl.append(el('p','mygroup-desc',String(g.description).slice(0,170)));
    const acts=el('div','mygroup-actions');
    if(status==='published'){
      const ver=createButton('Ver no catálogo',()=>{
        const found=groups.find(x=>String(x.id)===String(g.id));
        if(found){document.getElementById('explorar')?.scrollIntoView({block:'start'});setTimeout(()=>openDetails(found.id),350)}
        else location.hash='#explorar';
      },'mg-btn');
      const imp=createButton('✦ Impulsionar',()=>openModal('boost',g.id),'mg-btn primary');
      acts.append(ver,imp);
    }else if(status==='pending'){
      acts.append(el('span','mg-btn','⏳ Em análise pela equipe'));
    }else if(status==='rejected'){
      const reenviar=createButton('Revisar cadastro',()=>openModal('submit'),'mg-btn');
      acts.append(reenviar);
    }else{
      const imp=createButton('Ver no catálogo',()=>{location.hash='#explorar'},'mg-btn');
      acts.append(imp);
    }
    if(g.invite){
      const copiar=createButton('Copiar convite',async()=>{
        try{await navigator.clipboard.writeText(String(g.invite));showSiteToast('Convite copiado!')}
        catch{showSiteToast('Não foi possível copiar agora.')}
      },'mg-btn');
      copiar.style.flex='0 0 auto';
      acts.append(copiar);
    }
    cardEl.append(acts);
    grid.append(cardEl);
  }
  if(v51MeusGrupos.length>24)grid.append(el('p','mygroups-sub','Mostrando 24 de '+v51MeusGrupos.length+' comunidades.'));
  void publicados;
}
function v51AtualizarBadgeMenu(){
  const badge=$('umCount');
  if(badge)badge.textContent=String(v51MeusGrupos.length);
}

/* ---------- Planos de destaque ---------- */
let v51PendingPlan='week';
function v51InitBoostPlans(){
  document.querySelectorAll('[data-boost-plan]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      v51PendingPlan=btn.dataset.boostPlan||'week';
      const publicados=(v51MeusGrupos||[]).filter(g=>g&&g.status==='published');
      const alvo=publicados.find(g=>groups.some(x=>String(x.id)===String(g.id)))||publicados[0];
      if(alvo){
        const sel=$('boostPlan');if(sel)sel.value=v51PendingPlan;
        openModal('boost',alvo.id);
        if(sel)sel.value=v51PendingPlan;
        return;
      }
      document.getElementById('explorar')?.scrollIntoView({block:'start'});
      showSiteToast('Escolha o grupo que deseja destacar e toque em ✦ Patrocinar.');
      setTimeout(()=>{
        document.querySelectorAll('.boost-card-btn').forEach(b=>{
          b.classList.add('hint-pulse');
          setTimeout(()=>b.classList.remove('hint-pulse'),3600);
        });
      },600);
    });
  });
}
function v51RenderBoostPick(){
  const chips=$('boostPickChips'),title=$('boostPickTitle'),text=$('boostPickText');
  if(!chips)return;
  const publicados=(v51MeusGrupos||[]).filter(g=>g&&g.status==='published');
  chips.replaceChildren();
  if(!publicados.length){
    if(title)title.textContent='Qual comunidade vai ganhar destaque?';
    if(text)text.textContent='Toque em um dos planos e escolha o grupo no catálogo — qualquer pessoa pode impulsionar, sem virar administradora.';
    return;
  }
  if(title)title.textContent='Impulsione uma das suas comunidades';
  if(text)text.textContent='Escolha qual das suas publicadas vai aparecer no topo, como anúncio e nos Destaques do Dia.';
  for(const g of publicados.slice(0,4)){
    const chip=document.createElement('button');
    chip.type='button';chip.className='bp-chip';
    chip.textContent='✦ '+(g.name||'Comunidade').slice(0,26);
    chip.title=g.name||'Impulsionar comunidade';
    chip.addEventListener('click',()=>{const sel=$('boostPlan');if(sel)sel.value=v51PendingPlan;openModal('boost',g.id)});
    chips.append(chip);
  }
}
function v51AtualizarFomo(){
  const alvo=$('boostFomoText');
  if(!alvo)return;
  const emDestaque=(groups||[]).filter(isBoosted).length;
  alvo.textContent=emDestaque>0
    ? (emDestaque===1?'⏳ 1 comunidade já está em destaque — garanta a sua':'⏳ '+emDestaque+' comunidades em destaque — garanta a sua')
    : '🔥 Seja a primeira comunidade em destaque desta semana';
}

/* ---------- Contadores animados ---------- */
function v51Contar(alvo,final){
  if(!alvo)return;
  const dur=1200,inicio=performance.now(),fmt=n=>Number(n).toLocaleString('pt-BR');
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches){alvo.textContent=fmt(final);return}
  function passo(t){
    const p=Math.min(1,(t-inicio)/dur);
    alvo.textContent=fmt(Math.round(final*(1-Math.pow(1-p,3))));
    if(p<1)requestAnimationFrame(passo);
  }
  requestAnimationFrame(passo);
}
function v51AtualizarContadores(){
  const total=Number($('totalGroups')?.textContent.replace(/\D/g,''))||groups.length;
  const cats=Number($('totalCategories')?.textContent.replace(/\D/g,''))||new Set(groups.map(g=>g.category||'Outros')).size;
  v51Contar($('statTotalGroups'),total);
  v51Contar($('statTotalCats'),cats);
}

/* ---------- Reveal on scroll ---------- */
function v51InitReveal(){
  const alvos=document.querySelectorAll('.reveal, .hero-copy, .hero-art, .how-intro, .how-steps, .catalog-title, .free-content, .free-graphic, .faq-intro, .faq-list, .final-cta, .podium-heading-copy, .podium-grid');
  alvos.forEach(el=>{if(!el.classList.contains('reveal'))el.classList.add('reveal')});
  if(!('IntersectionObserver' in window)){document.querySelectorAll('.reveal').forEach(e=>e.classList.add('is-visible'));return}
  const obs=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.classList.add('is-visible');obs.unobserve(entry.target)}
    });
  },{rootMargin:'0px 0px -8% 0px',threshold:.08});
  document.querySelectorAll('.reveal').forEach(e=>obs.observe(e));
  // Garante visibilidade imediata do que já está na tela.
  setTimeout(()=>document.querySelectorAll('.reveal').forEach(e=>{
    const r=e.getBoundingClientRect();
    if(r.top<window.innerHeight&&r.bottom>0)e.classList.add('is-visible');
  }),60);
}

v51InitAuthChrome();
v51RenderAuth();
v51InitBoostPlans();
v51InitReveal();
window.addEventListener('storage',e=>{
  if(e.key==='fabi_session'||e.key==='neconecta_user_session'){v51RenderAuth();v51CarregarMeusGrupos()}
});

loadPodium();

loadGroups().then(()=>{
  try{
    v51AtualizarContadores();
    v51AtualizarFomo();
  }catch(err){console.warn('[Fabi Grupos V51]',err.message)}
  if(v51Session())v51CarregarMeusGrupos();
}).catch(()=>{});
})();
