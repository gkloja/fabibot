(()=>{
'use strict';
const PROXY_HOST='https://orange-hill-2e61.gbscabral15.workers.dev';
const BACKEND='http://br2.bronxyshost.com:4009';
const API_URL=PROXY_HOST+'/br2.bronxyshost.com:4009/proxy?url=';
const CATALOG_URL='/assets/pokemons.json';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])),fmt=n=>Number(n||0).toLocaleString('pt-BR');
let catalog=null,current=null,timer=null;
function proxyUrl(target){return API_URL+encodeURIComponent(String(target||''))}
async function loadCatalog(){if(catalog)return catalog;const r=await fetch(CATALOG_URL,{cache:'no-store'});catalog=await r.json();return catalog}
function localSpecies(id){if(!catalog)return null;return Array.isArray(catalog)?catalog.find(x=>Number(x.id)===Number(id)):catalog[String(id)]}
function imageUrl(sp){const id=Number(sp?.id||sp?.speciesId||0);return id?proxyUrl(`${BACKEND}/pokemon/images/artwork_${id}.png`):'/flogo.jpg'}
function fallback(sp){const l=localSpecies(sp?.id||sp?.speciesId);return sp?.artworkFallback||sp?.artwork||l?.artwork||l?.sprites?.official||'/flogo.jpg'}
function rarity(r){return({common:'Comum',uncommon:'Incomum',rare:'Raro',epic:'Épico',legendary:'Lendário',mythical:'Mítico'})[r]||r}
function remain(iso){const ms=Date.parse(iso||0)-Date.now();if(ms<=0)return'ENCERRADO';const h=Math.floor(ms/3600000),m=Math.ceil((ms%3600000)/60000);return h?`${h}h ${m}min`:`${Math.max(1,m)}min`}
function bind(){document.querySelectorAll('img[data-fallback]').forEach(img=>img.addEventListener('error',()=>{const f=img.dataset.fallback;if(f&&img.src!==f)img.src=f},{once:true}))}
function render(a){
  current=a;const p=a.pokemon||{name:a.species?.name,rarity:a.species?.rarity,species:a.species},sp=p.species||a.species,currentBid=Number(a.currentBid||0),min=currentBid?currentBid+Math.max(10,Math.ceil(currentBid*.05)):Number(a.startBid||0),active=a.status==='active'&&Date.parse(a.endAt)>Date.now();
  $('#pkAuctionPublic').innerHTML=`<section class="pk-auction-public-card">
    <div class="pk-auction-public-art"><img src="${imageUrl(sp)}" data-fallback="${esc(fallback(sp))}" alt="${esc(p.name||'Pokémon')}"></div>
    <div class="pk-auction-public-copy"><div class="pk-eyebrow">${a.kind==='daily'?'🏛️ LEILÃO DA LIGA':'👤 LEILÃO DE JOGADOR'}</div><h1>${p.shiny?'✨ ':''}${esc(p.name||sp?.name||'Pokémon')}</h1>
      <p>${esc(rarity(p.rarity||sp?.rarity))}${p.cp?` · CP ${fmt(p.cp)} · Lv.${fmt(p.level)}`:''}<br>Vendedor: <b>${esc(a.sellerName||'Liga Fabi')}</b>${a.currentBidderName?`<br>Líder atual: <b>${esc(a.currentBidderName)}</b>`:''}</p>
      <div class="pk-auction-public-price"><span>Lance atual<b>${fmt(currentBid||a.startBid)} ✨</b></span><span>Próximo mínimo<b>${fmt(min)} ✨</b></span><span>Termina em<b id="pkAuctionTime">${esc(remain(a.endAt))}</b></span><span>Lances<b>${fmt(a.bidCount||0)}</b></span></div>
      <div class="pk-auction-public-actions">${active?`<a class="pk-primary pk-link-btn" href="${esc(a.gameUrl||`/pokemon.html?auction=${encodeURIComponent(a.id)}`)}">Abrir jogo e dar lance</a>`:'<a class="pk-secondary pk-link-btn" href="/pokemon.html?tab=market">Ver outros leilões</a>'}<button class="pk-ghost" id="pkShare">Compartilhar</button></div>
      <div class="pk-safe-note" style="margin-top:12px">Os lances usam somente Pó Estelar do Pokémon Adventure. O Pokémon exibido é conhecido antes de qualquer lance.</div>
    </div>
  </section>`;
  bind();
  $('#pkShare')?.addEventListener('click',async()=>{const url=location.href,text=`🔨 ${p.name||'Pokémon'} está em leilão no Fabi Pokémon Adventure!`;try{if(navigator.share)await navigator.share({title:`Leilão Pokémon · ${p.name}`,text,url});else{await navigator.clipboard.writeText(url);$('#pkShare').textContent='Link copiado ✓'}}catch(_){}})
  clearInterval(timer);timer=setInterval(()=>{const e=$('#pkAuctionTime');if(e)e.textContent=remain(a.endAt)},15000);
}
async function boot(){
 try{
   await loadCatalog();
   const id=new URLSearchParams(location.search).get('a');if(!id)throw new Error('Leilão não informado.');
   const r=await fetch(proxyUrl(`${BACKEND}/api/pokemon-adventure/public-auction/${encodeURIComponent(id)}`),{mode:'cors'});
   const raw=await r.json();if(!r.ok||raw.success===false)throw new Error(raw.error||'Leilão não encontrado.');
   render(raw.auction);
 }catch(e){
   $('#pkAuctionPublic').innerHTML=`<section class="pk-card"><h2>Leilão indisponível</h2><p style="color:var(--muted)">${esc(e.message)}</p><a class="pk-primary pk-link-btn" href="/pokemon.html?tab=market">Abrir Mercado Pokémon</a></section>`;
 }
}
boot();
})();