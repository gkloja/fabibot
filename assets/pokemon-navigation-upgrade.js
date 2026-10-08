/* Progressive enhancement: no backend changes. Uses existing data-action=tab delegation. */
(()=>{'use strict';
const MAIN=[['world','fa-compass','Mundo'],['collection','fa-book-open','Pokédex'],['missions','fa-list-check','Missões'],['ranking','fa-trophy','Ranking']];
const EXTRA=[['Aventura',[['farm','🌱 Fazenda'],['arena','⚔️ Arena'],['boss','👹 Boss'],['season','🎫 Temporada']]],['Comunidade',[['hall','🏛️ Hall'],['market','🔄 Mercado']]],['Treinador',[['shop','🛒 Loja'],['achievements','🏅 Conquistas']]]];
const nav=document.querySelector('.pk-nav-inner');if(!nav)return;
const area=document.createElement('nav');area.className='pk-nav-shortcuts';area.setAttribute('aria-label','Atalhos Pokémon');
area.innerHTML=MAIN.map(([id,icon,label])=>`<button type="button" class="pk-shortcut" data-pk-dest="${id}" aria-label="Abrir ${label}"><i class="fa-solid ${icon}" aria-hidden="true"></i><span>${label}</span></button>`).join('')+`<div class="pk-more-wrap"><button type="button" class="pk-more-toggle" aria-expanded="false" aria-controls="pkMoreMenu"><i class="fa-solid fa-bars" aria-hidden="true"></i><span>Mais</span></button><div id="pkMoreMenu" class="pk-more-menu" hidden>${EXTRA.map(([title,items])=>`<div class="pk-menu-title">${title}</div><div class="pk-menu-grid">${items.map(([id,label])=>`<button type="button" data-pk-dest="${id}">${label}</button>`).join('')}</div>`).join('')}</div></div>`;
nav.insertBefore(area,nav.querySelector('.pk-nav-actions'));
const menu=area.querySelector('#pkMoreMenu'),toggle=area.querySelector('.pk-more-toggle');
function close(){menu.hidden=true;toggle.setAttribute('aria-expanded','false')}
function sync(){const active=document.querySelector('.pk-tab.active')?.dataset.tab||new URLSearchParams(location.search).get('tab')||'world';area.querySelectorAll('.pk-shortcut').forEach(b=>{b.classList.toggle('is-active',b.dataset.pkDest===active);if(b.dataset.pkDest===active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')})}
function go(id){const existing=document.querySelector(`.pk-tab[data-tab="${id}"]`);if(existing){existing.click();try{sessionStorage.setItem('pk_last_tab',id)}catch(_){};sync();close()}else{close()}}
area.addEventListener('click',e=>{const b=e.target.closest('[data-pk-dest]');if(b){go(b.dataset.pkDest);return}if(e.target.closest('.pk-more-toggle')){const opening=menu.hidden;menu.hidden=!opening;toggle.setAttribute('aria-expanded',String(opening))}});
document.addEventListener('click',e=>{if(!area.contains(e.target))close();const tab=e.target.closest('.pk-tab[data-tab]');if(tab){try{sessionStorage.setItem('pk_last_tab',tab.dataset.tab)}catch(_){};setTimeout(sync,0)}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
const observer=new MutationObserver(sync);const app=document.querySelector('#pkApp');if(app)observer.observe(app,{childList:true,subtree:false});
// Preserve explicit ?tab= links; otherwise restore only after original game loads.
const params=new URLSearchParams(location.search);if(!params.has('tab')&&!params.has('trade')&&!params.has('auction')){let last;try{last=sessionStorage.getItem('pk_last_tab')}catch(_){};if(last&&last!=='world'){let attempts=0;const timer=setInterval(()=>{if(document.querySelector('.pk-tab[data-tab]')){clearInterval(timer);go(last)}else if(++attempts>40)clearInterval(timer)},250)}}
sync();
})();
