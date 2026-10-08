(()=>{
'use strict';
const PROXY_HOST='https://orange-hill-2e61.gbscabral15.workers.dev';
const BACKEND='http://br2.bronxyshost.com:4009';
const API_URL=PROXY_HOST+'/br2.bronxyshost.com:4009/proxy?url=';
const CATALOG_URL='/assets/pokemons.json';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])),fmt=n=>Number(n||0).toLocaleString('pt-BR');
let catalog=null;
function proxyUrl(target){return API_URL+encodeURIComponent(String(target||''))}
async function loadCatalog(){if(catalog)return catalog;const r=await fetch(CATALOG_URL,{cache:'no-store'});catalog=await r.json();return catalog}
function speciesLocal(id){if(!catalog)return null;return Array.isArray(catalog)?catalog.find(x=>Number(x.id)===Number(id)):catalog[String(id)]}
function imageUrl(sp){const id=Number(sp?.id||sp?.speciesId||0);return id?proxyUrl(`${BACKEND}/pokemon/images/artwork_${id}.png`):'/flogo.jpg'}
function fallback(sp){const l=speciesLocal(sp?.id||sp?.speciesId);return sp?.artworkFallback||sp?.artwork||l?.artwork||l?.sprites?.official||'/flogo.jpg'}
function bind(){document.querySelectorAll('img[data-fallback]').forEach(img=>img.addEventListener('error',()=>{const f=img.dataset.fallback;if(f&&img.src!==f)img.src=f},{once:true}))}
function rarity(r){return({common:'Comum',uncommon:'Incomum',rare:'Raro',epic:'Épico',legendary:'Lendário',mythical:'Mítico'})[r]||r}
function render(p){
 const c=p.champion,h=p.highlights||[],s=p.stats||{},social=p.social||{},season=p.season||{};
 $('#pkPublicApp').innerHTML=`<section class="pk-public-hero"><div><div class="pk-eyebrow">◉ PERFIL PÚBLICO</div><h1>${esc(p.userName)}</h1><p>${p.league?.icon||'🏆'} ${esc(p.league?.label||'Liga')} · Nível ${fmt(p.trainer?.level)} · Arena ${fmt(p.trainer?.arenaRating)}</p>
 <div class="pk-public-stats"><div><small>Score</small><strong>${fmt(s.score)}</strong></div><div><small>Ranking global</small><strong>${s.globalPosition?'#'+fmt(s.globalPosition):'—'}</strong></div><div><small>Pokédex</small><strong>${fmt(s.uniquePokemon)}</strong></div><div><small>Temporada</small><strong>${season.pass?.id||season.id||'—'}</strong></div></div>
 <div class="pk-arena-record"><div><small>Arena · Ataque</small><strong>${fmt(p.arenaRecord?.attackWins||0)}V · ${fmt(p.arenaRecord?.attackLosses||0)}D</strong></div><div><small>Arena · Defesa</small><strong>${fmt(p.arenaRecord?.defenseWins||0)}V · ${fmt(p.arenaRecord?.defenseLosses||0)}D</strong></div><div><small>Total</small><strong>${fmt(p.arenaRecord?.totalWins||0)}V · ${fmt(p.arenaRecord?.totalLosses||0)}D</strong></div></div>
 <div class="pk-profile-line" style="margin-top:12px"><span class="pk-pill">🎴 ${fmt(social.dropClaims)} Drops</span><span class="pk-pill">🔄 ${fmt(social.tradesCompleted)} trocas</span><span class="pk-pill">🔨 ${fmt(social.auctionsWon)} leilões ganhos</span><span class="pk-pill">📦 ${fmt(s.totalPokemon)} Pokémon</span><span class="pk-pill">👹 ${fmt(p.bossStats?.damageTotal||0)} dano em Boss</span><span class="pk-pill">🌟 ${fmt(p.bossStats?.finalHits||0)} golpes finais</span></div>
 <div class="pk-actions" style="margin-top:15px"><a class="pk-primary pk-link-btn" href="/pokemon.html?trade=${encodeURIComponent(p.slug)}">Propor troca</a><button class="pk-ghost" id="pkCopy">Copiar perfil</button></div></div>
 <div class="pk-public-champion">${c?`<img src="${imageUrl(c.species)}" data-fallback="${esc(fallback(c.species))}" alt="${esc(c.name)}"><b>⭐ ${esc(c.name)}</b><small>Lv.${fmt(c.level)} · CP ${fmt(c.cp)}</small>`:'<div>⭐<br>Sem parceiro público</div>'}</div></section>
 <section class="pk-card" style="margin-top:12px"><div class="pk-card-head"><div><h3>✨ Destaques da coleção</h3><p>Os Pokémon mais raros e fortes que este treinador decidiu levar na jornada.</p></div></div><div class="pk-highlight-grid">${h.map(x=>`<div class="pk-highlight"><img src="${imageUrl(x.species)}" data-fallback="${esc(fallback(x.species))}"><b>${x.shiny?'✨ ':''}${esc(x.name)}</b><small>${esc(rarity(x.rarity))} · Lv.${fmt(x.level)} · CP ${fmt(x.cp)}</small></div>`).join('')||'<div class="pk-empty">Sem destaques ainda.</div>'}</div></section>
 <section class="pk-card" style="margin-top:12px"><div class="pk-card-head"><div><h3>🏅 Jornada</h3><p>Temporada e conquistas públicas.</p></div></div><div class="pk-public-stats"><div><small>Pontos da temporada</small><strong>${fmt(season.points)}</strong></div><div><small>Ranking da temporada</small><strong>${s.seasonPosition?'#'+fmt(s.seasonPosition):'—'}</strong></div><div><small>Conquistas</small><strong>${fmt((p.achievements||[]).length)}</strong></div><div><small>Sequência</small><strong>${fmt(p.trainer?.streak)}d</strong></div></div></section>`;
 bind();
 $('#pkCopy')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);$('#pkCopy').textContent='Copiado ✓'}catch(_){}});
}
async function boot(){
 try{await loadCatalog();const slug=new URLSearchParams(location.search).get('p');if(!slug)throw new Error('Perfil não informado.');const r=await fetch(proxyUrl(`${BACKEND}/api/pokemon-adventure/public-profile/${encodeURIComponent(slug)}`),{mode:'cors'});const raw=await r.json();if(!r.ok||raw.success===false)throw new Error(raw.error||'Perfil não encontrado.');render(raw.profile)}catch(e){$('#pkPublicApp').innerHTML=`<section class="pk-card"><h2>Perfil indisponível</h2><p style="color:var(--muted)">${esc(e.message)}</p><a class="pk-primary pk-link-btn" href="/pokemon.html">Voltar ao Pokémon Adventure</a></section>`}}
boot();
})();