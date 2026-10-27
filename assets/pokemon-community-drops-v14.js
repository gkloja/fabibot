/* Fabi Pokémon Adventure V18 — rotação diária gratuita, PIX visível no jogo, detalhes com chances. */
(()=>{
'use strict';
const PROXY='https://orange-hill-2e61.gbscabral15.workers.dev';
const BACKEND='http://br2.bronxyshost.com:4009';
const BASE='/api/pokemon-adventure/';
const $=(sel,root=document)=>root.querySelector(sel);
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const money=v=>'R$ '+Number(v||0).toFixed(2).replace('.',',');
const dates=v=>v?new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'';
const shortDate=v=>v?new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
const storage=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')||{}}catch(_){return {}}};
let data={products:[],groups:[],vouchers:[],boxes:[]};
let busy=false,poll=null,activeTx=null;
function current(){
 const a=storage('fabi_session'),b=storage('neconecta_user_session'),p=storage('pk_player_session');
 const u={...a,...b};
 return {numero:String(u.numero||u.telefone||u.phone||'').replace(/\D/g,''),nome:String(u.nome||u.username||u.name||'Treinador').slice(0,80),token:String(p.token||''),guest:p.guest===true};
}
const isLogged=()=>{const u=current();return !!u.token&&!u.guest&&!!u.numero};
const proxy=path=>PROXY+'/br2.bronxyshost.com:4009/proxy?url='+encodeURIComponent(BACKEND+path);
const media=id=>proxy('/pokemon/images/artwork_'+Number(id)+'.png');
const BOX_ART={freeMystery:'/assets/drop-box-basic.svg',freeExplorer:'/assets/drop-box-explorer.svg',freeElite:'/assets/drop-box-special.svg',dropBoxBasic:'/assets/drop-box-basic.svg',dropBoxExplorer:'/assets/drop-box-explorer.svg',dropBoxSpecial:'/assets/drop-box-special.svg',basic:'/assets/drop-box-basic.svg',explorer:'/assets/drop-box-explorer.svg',special:'/assets/drop-box-special.svg'};
const boxArt=id=>BOX_ART[String(id||'')]||'/assets/drop-box-basic.svg';
const boxImage=(id,label='Caixa')=>`<img class="box-art" loading="lazy" src="${esc(boxArt(id))}" alt="${esc(label)}">`;
function embeddedView(){
 try{return window.parent!==window && window.frameElement && window.parent.location.origin===location.origin?window.frameElement:null}catch(_){return null}
}
function visibleTop(){
 const frame=embeddedView();if(!frame)return null;
 try{return Math.max(10,Math.round(-frame.getBoundingClientRect().top+10))}catch(_){return null}
}
function fitOverlay(){
 const top=visibleTop();if(top===null)return;
 const m=$('#modal'),t=$('#toast');
 const frame=embeddedView();const height=Math.max(300,Math.min(window.parent.innerHeight-20,frame.getBoundingClientRect().height-top));
 m.style.position='absolute';m.style.inset='auto 0 auto 0';m.style.top=top+'px';m.style.height=height+'px';
 t.style.position='absolute';t.style.bottom='auto';t.style.top=(top+14)+'px';
}
function toast(message,bad=false){
 const el=$('#toast');fitOverlay();el.hidden=false;el.style.borderColor=bad?'#ff8a86':'var(--green)';el.textContent=message;
 clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,6500);
}
function modal(html){
 $('#modalContent').innerHTML=html;
 const m=$('#modal');fitOverlay();m.classList.add('open');m.setAttribute('aria-hidden','false');
 const close=$('#modal .modal-close');close?.focus({preventScroll:true});
}
function closeModal(){
 const m=$('#modal');m.classList.remove('open');m.setAttribute('aria-hidden','true');
 clearInterval(poll);poll=null;activeTx=null;
}
function errorModal(title,message){modal(`<div class="checkout-state fail"><span class="checkout-symbol">⚠️</span><h3 id="modalTitle">${esc(title)}</h3><p>${esc(message)}</p><p class="checkout-tip">Confira se a conta está vinculada e se o servidor está funcionando. Nenhum pagamento será criado se a operação falhar.</p><button class="btn secondary" data-close="1" type="button">Fechar</button></div>`)}
function loginModal(){modal('<div class="checkout-state"><span class="checkout-symbol">🔐</span><h3 id="modalTitle">Entre na sua conta Fabi</h3><p>Para resgatar caixas ou abrir o PIX, conecte sua conta no Pokémon Adventure. O modo visitante não habilita compras.</p><a class="btn primary" href="/pokemon?tab=world" target="_top">Abrir Pokémon Adventure</a></div>')}
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
const speciesImage=id=>`<img loading="lazy" src="${esc(media(id))}" alt="" onerror="this.style.display='none'">`;
const nextDate=ms=>new Date(ms).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
function renderFreeBoxes(){
 const root=$('#freeBoxes');if(!root)return;
 if(!data.boxes.length){root.innerHTML='<div class="empty">Entre na sua conta de treinador para consultar o catálogo gratuito de hoje.</div>';return}
 root.innerHTML=data.boxes.map(box=>{
  const lvl=Number(box.playerLevel)||1,locked=lvl<box.minLevel,waiting=Number(box.nextAt)>Date.now();
  const pool=Array.isArray(box.possibleSpecies)?box.possibleSpecies:[];
  const status=locked?`🔒 Desbloqueia no nível ${box.minLevel}`:waiting?`⏳ Próximo resgate: ${nextDate(box.nextAt)}`:'✅ Pronta para resgatar';
  return `<article class="free-box daily-tier ${esc(box.id)}"><div class="free-box-top box-head">${boxImage(box.id,box.label)}<div><b>${esc(box.label)}</b><small>${esc(box.tier)} · Nível ${Number(box.minLevel)}</small></div></div>
  <div class="free-box-meta"><span>${pool.length} espécies hoje</span><span>Até ${shortDate(box.rotationEndsAt)}</span><span>${box.cooldownHours}h entre resgates</span></div>
  <div class="daily-mini-pool compact">${pool.slice(0,6).map(x=>`<div title="${esc(x.name)}">${speciesImage(x.id)}</div>`).join('')}${pool.length>6?`<span>+${Math.max(0,pool.length-6)}</span>`:''}</div>
  <button class="btn secondary mini box-info" data-odds="${esc(box.id)}" type="button">🔎 Ver espécies e probabilidades</button>
  <div class="free-box-footer"><small>${status}</small><button class="btn primary mini" data-free="${esc(box.id)}" type="button" ${locked||waiting||!isLogged()?'disabled':''}>🎁 Resgatar gratuitamente</button></div></article>`;
 }).join('');
}
function oddsModal(boxId){
 const box=data.boxes.find(x=>x.id===boxId);if(!box)return toast('Atualize o catálogo antes de consultar a caixa.',true);
 const pool=box.possibleSpecies||[];
 const list=pool.map(x=>`<div class="odds-item">${speciesImage(x.id)}<div><b>${esc(x.name||'Pokémon')}</b><small>#${String(x.id).padStart(3,'0')} · ${esc(x.rarity||box.tier)}</small></div><strong>${Number(x.chance??box.chancePerSpecies).toLocaleString('pt-BR',{maximumFractionDigits:3})}%</strong></div>`).join('');
 modal(`<div class="box-detail-top">${boxImage(box.id,box.label)}<div><span class="section-label">CATÁLOGO GRATUITO DO DIA</span><h3 id="modalTitle">${esc(box.label)}</h3><p>${esc(box.tier)} · Nível ${box.minLevel}+ · Resgate a cada ${box.cooldownHours}h</p></div></div>
 <div class="rotation-info">🔄 Próxima rotação: ${esc(shortDate(box.rotationEndsAt))} (Brasília)</div>
 <p>Esses são os Pokémon que podem aparecer <strong>hoje</strong>. Cada espécie tem a probabilidade informada abaixo. A seleção muda diariamente, mas a chance só é aplicada quando você resgata a caixa gratuita.</p>
 <div class="odds-list">${list}</div><p class="odds-total">Probabilidade total: 100% · ${pool.length} espécies equiprováveis. Não há pagamento para abrir esta caixa.</p>
 <button data-free="${esc(box.id)}" class="btn primary" type="button" ${!box.available||!isLogged()?'disabled':''}>🎁 Resgatar gratuitamente</button>`);
}
function renderProducts(){
 const root=$('#catalog');if(!root)return;
 if(!data.products.length){root.innerHTML='<div class="empty">Entre na conta do Pokémon Adventure para consultar caixas PIX da comunidade.</div>';return}
 root.innerHTML=data.products.map(p=>{
  const pool=Array.isArray(p.possibleSpecies)?p.possibleSpecies:[];
  return `<article class="product paid-box"><small>📦 CAIXA PIX · CATÁLOGO DO DIA</small><div class="product-art box-product-art">${boxImage(p.id,p.label)}</div><h3>${esc(p.label)}</h3><p>${esc(p.description||'Caixa comunitária com Pokémon aleatório.')}</p><div class="product-chips"><span>${pool.length} espécies hoje</span><span>${esc(p.tier||'Caixa')}</span></div><div class="paid-detail"><button class="btn secondary mini" type="button" data-paid-details="${esc(p.id)}">Ver espécies e chances</button></div><div class="product-footer"><strong>${money(p.price)}</strong><button class="btn primary" type="button" data-buy="${esc(p.id)}">Gerar PIX</button></div></article>`;
 }).join('');
}
function paidModal(id){
 const p=data.products.find(x=>x.id===id);if(!p)return toast('Caixa indisponível.',true);
 const pool=Array.isArray(p.possibleSpecies)?p.possibleSpecies:[];
 const list=pool.map(x=>`<div class="odds-item">${speciesImage(x.id)}<div><b>${esc(x.name||'Pokémon')}</b><small>#${String(x.id).padStart(3,'0')} · ${esc(x.rarity||p.tier||'Caixa')}</small></div><strong>${Number(x.chance||0).toLocaleString('pt-BR',{maximumFractionDigits:3})}%</strong></div>`).join('');
 modal(`<div class="box-detail-top">${boxImage(p.id,p.label)}<div><span class="section-label">CAIXA PIX DO DIA</span><h3 id="modalTitle">${esc(p.label)}</h3><p>${esc(p.tier||'Caixa')} · ${money(p.price)} · catálogo válido até ${esc(shortDate(p.rotationEndsAt))}</p></div></div><p>Você está comprando a <strong>caixa</strong>, não um Pokémon garantido. Quando o pagamento for aprovado, a Fabi reserva aleatoriamente uma espécie dentro deste catálogo do dia e depois você escolhe em qual grupo com Pokémon automático ativo deseja dropar.</p><div class="odds-list">${list}</div><p class="odds-total">Probabilidade total: 100% · ${pool.length} espécies possíveis hoje.</p><div class="modal-actions"><button class="btn primary" data-buy="${esc(p.id)}" type="button">Gerar PIX de ${money(p.price)}</button><button class="btn secondary" type="button" data-close="1">Agora não</button></div>`);
}
function groupOptions(v){
 if(!data.groups.length)return '<option value="">Nenhum grupo com Pokémon automático ativo</option>';
 return '<option value="">Escolha um grupo com Pokémon ativo…</option>'+data.groups.map(g=>`<option value="${esc(g.id)}" ${v?.groupId===g.id?'selected':''}>${esc(g.label)} · …${esc(g.id.split('@')[0].slice(-6))}</option>`).join('');
}
const STATUS={available:'Disponível',queued:'Na fila',processing:'Enviando',sent:'Entregue',review:'Em revisão'};
function renderWallet(){
 const root=$('#wallet');$('#loginNote').hidden=isLogged();if(!isLogged()){root.innerHTML='';return}
 if(!data.vouchers.length){root.innerHTML='<div class="empty"><b>Sua carteira está vazia.</b><p>Resgate uma caixa gratuita ou compre uma caixa PIX acima e depois escolha um grupo com Pokémon automático ativo para enviar.</p></div>';return}
 root.innerHTML=data.vouchers.map(v=>`<article class="wallet-item"><img loading="lazy" src="${esc(v.speciesId?media(v.speciesId):boxArt(v.productId))}" alt=""><div><b>${esc(v.label)}</b><small>${v.speciesId?'Pokémon revelado':'Espécie oculta'} · ${esc(dates(v.createdAt))}</small>${v.groupId?`<p>Grupo: …${esc(v.groupId.split('@')[0].slice(-8))}</p>`:''}${v.lastError?`<p>${esc(v.lastError)}</p>`:''}</div><div class="action"><span class="status ${esc(v.status)}">${esc(STATUS[v.status]||v.status)}</span>${v.status==='available'?`<select aria-label="Grupo para ${esc(v.label)}" class="group-select" data-group="${esc(v.id)}">${groupOptions(v)}</select><button type="button" class="btn primary mini" data-dispatch="${esc(v.id)}" ${data.groups.length?'':'disabled'}>Enviar ao grupo ↗</button>`:''}${v.status==='queued'?`<button type="button" class="btn secondary mini" data-cancel="${esc(v.id)}">Cancelar envio</button>`:''}</div></article>`).join('');
}
async function load(silent=false){
 const u=current();
 if(!u.token||u.guest||!u.numero){data={products:[],groups:[],vouchers:[],boxes:[]};renderProducts();renderFreeBoxes();renderWallet();if(!silent)toast('Faça login na sua conta Fabi para acessar o catálogo e os drops.');return}
 try{
  const got=await api('community-drops');data={products:got.products||[],groups:got.groups||[],vouchers:got.vouchers||[],boxes:got.boxes||[]};
  renderProducts();renderFreeBoxes();renderWallet();
  const note=$('#freeNote');if(note)note.textContent=`🔄 Espécies do catálogo gratuito atualizadas diariamente (horário de Brasília). ${data.groups.length} grupo(s) com Pokémon automático ativo.`;
 }catch(e){if(!silent)toast(e.message,true);$('#freeNote').textContent='Não foi possível carregar as caixas: '+e.message;renderProducts();renderFreeBoxes();renderWallet()}
}
async function buy(id){
 if(embeddedView() && ((window.parent&&window.parent.innerWidth<960)||window.innerWidth<760)){
  try{window.top.location='/pokemon-drops?buy='+encodeURIComponent(id);return;}catch(_){}
 }
 if(!isLogged())return loginModal();
 if(busy)return toast('Já existe uma solicitação em andamento.');
 const product=data.products.find(p=>p.id===id);if(!product)return toast('Evento não encontrado. Atualize o catálogo.',true);
 busy=true;
 // Exibir feedback ANTES da chamada à rede, inclusive quando embutido num iframe alto.
 modal(`<div class="checkout-state"><div class="checkout-loader" aria-label="Carregando"></div><h3 id="modalTitle">Gerando seu PIX</h3><p>Conectando ao Mercado Pago para <b>${esc(product.label)}</b> (${money(product.price)}).</p><small>O pagamento ainda não foi realizado.</small></div>`);
 try{
  const r=await api('shop/pix/create',{productId:id});
  if(!r.transactionId||!r.copyPaste)throw Error('O pagamento foi iniciado, mas o servidor não enviou o código PIX. Verifique antes de criar outra cobrança.');
  const tx=r.transactionId,qr=String(r.qrCode||'');activeTx=tx;
  const safeQR=/^(?:data:image\/(?:png|jpeg);base64,[a-zA-Z0-9+/=]+|https:\/\/[^\s]+)$/i.test(qr)?qr:'';
  modal(`<span class="section-label">PIX · PAGAMENTO MERCADO PAGO</span><h3 id="modalTitle">${esc(r.product?.label||product.label)}</h3><p>Valor: <b>${money(r.product?.price||product.price)}</b>. Após a confirmação, sua caixa aparecerá na carteira de drops. A espécie sorteada permanece oculta até o envio ao grupo com Pokémon automático ativo.</p>${safeQR?`<img class="qr" src="${esc(safeQR)}" alt="QR Code PIX">`:''}<label class="muted" for="pixInput">PIX copia e cola</label><textarea class="pix-code" id="pixInput" readonly></textarea><div class="modal-actions"><button type="button" class="btn primary" id="copyPix">Copiar código PIX</button><button type="button" class="btn secondary" id="checkPix">Verificar pagamento</button></div><div class="modal-status" id="paymentStatus">Aguardando confirmação do Mercado Pago.</div><small class="payment-expires">Válido até ${shortDate(r.expiresAt)}.</small>`);
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
  const el=$('#paymentStatus');if(el)el.textContent=status==='approved'?'✅ Pagamento aprovado! Evento liberado na sua carteira.':status==='pending'?'Aguardando aprovação do Mercado Pago…':'Pagamento: '+status;
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
 if(!confirm(`Enviar evento para ${group.label}? O Pokémon da caixa gratuita será revelado no grupo.`))return;
 if(busy)return;busy=true;
 try{await api('community-drops/dispatch',{voucherId:id,groupId});toast('Evento colocado na fila!');await load(true)}catch(e){toast(e.message,true)}finally{busy=false}
}
async function cancel(id){
 if(!confirm('Cancelar o envio? O crédito volta à sua carteira.'))return;if(busy)return;busy=true;
 try{await api('community-drops/cancel',{voucherId:id});toast('Evento devolvido à carteira.');await load(true)}catch(e){toast(e.message,true)}finally{busy=false}
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-buy')){e.preventDefault();buy(b.dataset.buy)}
 else if(b.hasAttribute('data-paid-details'))paidModal(b.dataset.paidDetails);
 else if(b.hasAttribute('data-odds'))oddsModal(b.dataset.odds);
 else if(b.hasAttribute('data-free'))claimFree(b.dataset.free);
 else if(b.hasAttribute('data-dispatch'))dispatch(b.dataset.dispatch);
 else if(b.hasAttribute('data-cancel'))cancel(b.dataset.cancel);
 else if(b.hasAttribute('data-close'))closeModal();
});
$('#refresh')?.addEventListener('click',()=>load(false));
$('#claimFree')?.addEventListener('click',()=>claimFree('freeMystery'));
$('#modal')?.addEventListener('click',e=>{if(e.target.hasAttribute('data-close'))closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
$('#themeToggle')?.addEventListener('click',()=>{document.body.classList.toggle('light');try{localStorage.setItem('theme',document.body.classList.contains('light')?'light':'dark')}catch(_){}});
try{if(localStorage.getItem('theme')==='light'||localStorage.getItem('darkMode')==='false')document.body.classList.add('light')}catch(_){}
window.addEventListener('resize',()=>{if($('#modal')?.classList.contains('open'))fitOverlay()});
window.parent!==window&&window.parent.addEventListener('scroll',()=>{if($('#modal')?.classList.contains('open'))fitOverlay()},{passive:true});
const qs=new URLSearchParams(location.search);
load().then(()=>{const viewBox=qs.get('viewBox'),buyId=qs.get('buy');if(viewBox)paidModal(viewBox);else if(buyId)buy(buyId);});
setInterval(()=>{if(!document.hidden&&!$('#modal')?.classList.contains('open')&&isLogged())load(true)},30000);
})();
