(()=>{
'use strict';
const PROXY='https://orange-hill-2e61.gbscabral15.workers.dev', BACKEND='http://br2.bronxyshost.com:4009', BASE='/api/pokemon-adventure/';
const $=sel=>document.querySelector(sel);
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const money=v=>'R$ '+Number(v||0).toFixed(2).replace('.',',');
const dates=v=>v?new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'';
const storage=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'null')||{}}catch(_){return {}}};
let data={products:[],groups:[],vouchers:[],boxes:[]},busy=false,poll=null;
function current(){const a=storage('fabi_session'),b=storage('neconecta_user_session'),p=storage('pk_player_session');const u={...a,...b};const numero=String(u.numero||u.telefone||u.phone||'').replace(/\D/g,'');return {numero,nome:String(u.nome||u.username||u.name||'Treinador').slice(0,80),token:String(p.token||''),guest:p.guest===true};}
function proxy(path){return PROXY+'/br2.bronxyshost.com:4009/proxy?url='+encodeURIComponent(BACKEND+path)}
function media(speciesId){return proxy('/pokemon/images/artwork_'+Number(speciesId)+'.png')}
function toast(message,bad=false){const el=$('#toast');el.hidden=false;el.style.borderColor=bad?'#ff8a86':'var(--green)';el.textContent=message;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,5500)}
async function api(path,body){const user=current();const url=new URL(BACKEND+BASE+path);
  if(body===undefined){url.searchParams.set('playerToken',user.token);url.searchParams.set('numero',user.numero);url.searchParams.set('nome',user.nome)}
  const dest=PROXY+'/br2.bronxyshost.com:4009/proxy?url='+encodeURIComponent(url.toString());
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),18000);
  try{const res=await fetch(dest,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify({playerToken:user.token,contaNumero:user.numero,nomeUsuario:user.nome,nomeConta:user.nome,...body}),signal:ctl.signal});let parsed;try{parsed=await res.json()}catch(_){throw Error('O servidor respondeu em formato inesperado.')};if(!res.ok||parsed.success===false)throw Error(parsed.error||parsed.message||'Falha ao acessar a Fabi.');return parsed;}finally{clearTimeout(timer)}
}
function isLogged(){const u=current();return !!u.token&&!u.guest&&!!u.numero}
function modal(html){$('#modalContent').innerHTML=html;$('#modal').classList.add('open');$('#modal').setAttribute('aria-hidden','false');$('#modal .modal-close').focus()}
function closeModal(){$('#modal').classList.remove('open');$('#modal').setAttribute('aria-hidden','true');clearInterval(poll);poll=null}
function renderProducts(){const root=$('#catalog');if(!data.products.length){root.innerHTML='<div class="empty">As caixas comunitárias ainda não estão disponíveis. As caixas gratuitas continuam ativas.</div>';return}
 root.innerHTML=data.products.map(p=>`<article class="product"><small>${esc(p.icon||'🎁')} · ${esc(p.tier||'EVENTO')} · CONTEÚDO GARANTIDO</small><div class="product-art" aria-hidden="true">${p.speciesId?`<img loading="lazy" src="${esc(media(p.speciesId))}" onerror="this.style.display='none';this.parentElement.textContent='${esc(p.icon||'🎁')}'" alt="">`:esc(p.icon||'📦')}</div><h3>${esc(p.label)}</h3><p>${esc(p.description)}</p><div class="product-footer"><strong>${money(p.price)}</strong><button class="btn primary" data-buy="${esc(p.id)}">Comprar caixa PIX</button></div></article>`).join('');
}
const nextDate=ms=>new Date(ms).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
function renderFreeBoxes(){const root=$('#freeBoxes');if(!root)return;
 if(!data.boxes.length){root.innerHTML='<div class="empty">Entre na sua conta de treinador para consultar as caixas gratuitas.</div>';return;}
 root.innerHTML=data.boxes.map(box=>{const lvl=Number(box.playerLevel)||1,locked=lvl<box.minLevel,waiting=box.nextAt>Date.now();
  const status=locked?`🔒 Nível ${box.minLevel} necessário`:waiting?`⏳ Disponível ${nextDate(box.nextAt)}`:'✅ Disponível agora';
  const pool=(box.possibleSpecies||[]).map(x=>String(x.name||'Pokémon')+' (#'+String(x.id||x).padStart(3,'0')+', '+String(x.rarity||box.tier)+')').join(' · ');
  return `<article class="free-box"><div class="free-box-top"><span class="free-box-icon">${esc(box.icon)}</span><div><b>${esc(box.label)}</b><small>${esc(box.tier)} · Nível ${box.minLevel}+</small></div></div><div class="free-box-meta"><span>${box.cooldownHours}h de intervalo</span><span>${(box.possibleSpecies||[]).length} espécies possíveis</span></div><details><summary>Ver espécies e probabilidades</summary><p>Espécies disponíveis: ${esc(pool)}.</p><p>Chance por espécie: aproximadamente ${Number(box.chancePerSpecies).toLocaleString('pt-BR')}% (distribuição uniforme). Não há Pokémon garantido antes do resgate.</p></details><div class="free-box-footer"><small>${status}</small><button class="btn primary mini" data-free="${esc(box.id)}" ${locked||waiting||!isLogged()?'disabled':''}>🎁 Resgatar grátis</button></div></article>`;}).join('');
}

function groupOptions(v){if(!data.groups.length)return '<option value="">Nenhum grupo com Pokémon automático ativo</option>';return '<option value="">Escolha um grupo com Pokémon ativo…</option>'+data.groups.map(g=>`<option value="${esc(g.id)}" ${v?.groupId===g.id?'selected':''}>${esc(g.label)} · …${esc(g.id.split('@')[0].slice(-6))}</option>`).join('')}
const STATUS={available:'Disponível',queued:'Na fila',processing:'Enviando',sent:'Entregue',review:'Em revisão'};
function renderWallet(){const root=$('#wallet');$('#loginNote').hidden=isLogged();if(!isLogged()){root.innerHTML='';return}
  if(!data.vouchers.length){root.innerHTML='<div class="empty"><b>Sua carteira está vazia.</b><p>Comece com uma caixa surpresa GRATUITA acima. Depois, escolha um grupo com Pokémon automático ativo e envie a figurinha.</p></div>';return}
  root.innerHTML=data.vouchers.map(v=>`<article class="wallet-item"><img loading="lazy" src="${esc(v.speciesId?media(v.speciesId):'/flogo.jpg')}" alt=""><div><b>${esc(v.label)}</b><small>Pedido ${esc(v.id.slice(-9))} · ${esc(dates(v.createdAt))}</small>${v.groupId?`<p>Grupo: …${esc(v.groupId.split('@')[0].slice(-8))}</p>`:''}${v.lastError?`<p>${esc(v.lastError)}</p>`:''}</div><div class="action"><span class="status ${esc(v.status)}">${esc(STATUS[v.status]||v.status)}</span>${v.status==='available'?`<select aria-label="Grupo para ${esc(v.label)}" class="group-select" data-group="${esc(v.id)}">${groupOptions(v)}</select><button class="btn primary mini" data-dispatch="${esc(v.id)}" ${data.groups.length?'':'disabled'}>Enviar ao grupo ↗</button>`:''}${v.status==='queued'?`<button class="btn secondary mini" data-cancel="${esc(v.id)}">Cancelar envio</button>`:''}${v.status==='review'?'<small>Suporte verificará o envio.</small>':''}</div></article>`).join('');
}
async function load(silent=false){try{
 const u=current();if(!u.token||u.guest||!u.numero){$('#loginNote').hidden=false;data.products=[];data.boxes=[];renderProducts();renderFreeBoxes();renderWallet();return}
 data=await api('community-drops');renderProducts();renderFreeBoxes();renderWallet();const el=$('#freeNote');if(el)el.textContent=`${data.groups.length} grupo(s) com Pokémon automático ativo disponíveis para drops. Caixas surpresa grátis; caixas PIX com conteúdo garantido.`;

 }catch(e){if(!silent)toast(e.message,true);if(!data.products.length){data.products=[];renderProducts()}renderFreeBoxes();renderWallet()}}
async function buy(id){if(!isLogged()){toast('Primeiro entre em uma conta Fabi no Pokémon Adventure.',true);return}if(busy)return;busy=true;
 try{const result=await api('shop/pix/create',{productId:id}),tx=result.transactionId,product=result.product;
  const qr=String(result.qrCode||''),safeQR=/^(?:data:image\/(?:png|jpeg);base64,[a-zA-Z0-9+/=]+|https:\/\/[^\s]+)$/i.test(qr)?qr:'';
  modal(`<span class="section-label">PIX · CAIXA COMUNITÁRIA DE CONTEÚDO GARANTIDO</span><h3 id="modalTitle">${esc(product.label)}</h3><p>Pagamento de <b>${money(product.price)}</b>. Após a aprovação, a caixa fica na sua carteira. Você escolhe um grupo com Pokémon automático ativo para publicar o evento. A espécie indicada acima é garantida; não é sorteio pago.</p>${safeQR?`<img class="qr" src="${esc(safeQR)}" alt="QR Code PIX">`:''}<label class="muted" for="pixInput">PIX copia e cola</label><textarea class="pix-code" id="pixInput" readonly></textarea><div class="modal-actions"><button type="button" class="btn primary" id="copyPix">Copiar código PIX</button><button type="button" class="btn secondary" id="checkPix">Verificar pagamento</button></div><div class="modal-status" id="paymentStatus">Aguardando confirmação do Mercado Pago.</div>`);
  $('#pixInput').value=String(result.copyPaste||'');
  $('#copyPix').onclick=async()=>{try{await navigator.clipboard.writeText($('#pixInput').value);toast('Código PIX copiado.')}catch(_){$('#pixInput').select();document.execCommand('copy');toast('Código selecionado.')}};
  $('#checkPix').onclick=()=>checkPayment(tx);
  clearInterval(poll);poll=setInterval(()=>checkPayment(tx,true),5000);
 }catch(e){toast(e.message,true)}finally{busy=false}}
async function checkPayment(tx,silent=false){try{const d=await api('shop/pix/'+encodeURIComponent(tx));const status=d.transaction?.status||'pending';const el=$('#paymentStatus');if(el)el.textContent=status==='approved'?'✅ Pagamento aprovado! Caixa liberada na carteira de drops.':status==='pending'?'Aguardando pagamento…':'Status: '+status;if(status==='approved'){closeModal();toast('Caixa liberada! Escolha um grupo na carteira de drops.');await load(true);}else if(['expired','rejected','cancelled'].includes(status)){clearInterval(poll);poll=null}}catch(e){if(!silent)toast(e.message,true)}}
async function dispatch(id){const sel=Array.from(document.querySelectorAll('[data-group]')).find(el=>el.dataset.group===id);const groupId=sel?.value;if(!groupId){toast('Escolha primeiro um grupo com Pokémon automático ativo.',true);return}const group=data.groups.find(g=>g.id===groupId);if(!group)return toast('Grupo inválido.',true);
 if(!confirm(`Confirmar o drop em ${group.label}? ${data.vouchers.find(v=>v.id===id)?.productId==='freeMystery'?'O Pokémon será revelado ao grupo.':'Este crédito anterior é de espécie definida.'}`))return;
 if(busy)return;busy=true;try{await api('community-drops/dispatch',{voucherId:id,groupId});toast('Evento agendado! A Fabi fará a entrega no grupo.');await load(true)}catch(e){toast(e.message,true)}finally{busy=false}}
async function cancel(id){if(!confirm('Cancelar a solicitação? O crédito voltará à carteira para você usar depois.'))return;if(busy)return;busy=true;try{await api('community-drops/cancel',{voucherId:id});toast('Solicitação cancelada. O crédito está disponível novamente.');await load(true)}catch(e){toast(e.message,true)}finally{busy=false}}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-buy'))buy(b.dataset.buy);if(b.hasAttribute('data-free'))claimFree(b.dataset.free);if(b.hasAttribute('data-dispatch'))dispatch(b.dataset.dispatch);if(b.hasAttribute('data-cancel'))cancel(b.dataset.cancel);if(b.hasAttribute('data-close'))closeModal()});
async function claimFree(tier='freeMystery'){if(!isLogged()){toast('Para resgatar caixas grátis, entre primeiro na conta Fabi.',true);return;}if(busy)return;busy=true;
 try{const d=await api('community-drops/free',{tier:String(tier)});toast(d.message||'Caixa gratuita disponível na carteira!');await load(true);document.getElementById('minhacarteira')?.scrollIntoView({behavior:'smooth',block:'start'});}
 catch(e){toast(e.message,true)}finally{busy=false}}
$('#claimFree').onclick=()=>claimFree('freeMystery');
$('#refresh').onclick=()=>load(false);
$('#modal').addEventListener('click',e=>{if(e.target.hasAttribute('data-close'))closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
$('#themeToggle').onclick=()=>{document.body.classList.toggle('light');try{localStorage.setItem('theme',document.body.classList.contains('light')?'light':'dark')}catch(_){}};
try{if(localStorage.getItem('theme')==='light'||localStorage.getItem('darkMode')==='false')document.body.classList.add('light')}catch(_){}
load();setInterval(()=>{if(!document.hidden&&!$('#modal').classList.contains('open')&&isLogged())load(true)},30000);
})();
