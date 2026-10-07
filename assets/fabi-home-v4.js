
(function(){
'use strict';

const FABI_API = 'https://orange-hill-2e61.gbscabral15.workers.dev/br2.bronxyshost.com:4009/proxy?url=http://br2.bronxyshost.com:4009';
const AI_HISTORY_KEY = 'fabi_ai_history_v1';
const MAX_HISTORY = 8;

function esc(value){
  return String(value ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function safeUrl(value){
  const v = String(value || '').trim();
  return /^https?:\/\//i.test(v) ? v : '';
}

function formatAI(text){
  let s = esc(text || '');
  s = s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  s = s.replace(/`([^`]+)`/g,'<code>$1</code>');
  s = s.replace(/\n/g,'<br>');
  return s;
}

function getHistory(){
  try{
    const h = JSON.parse(sessionStorage.getItem(AI_HISTORY_KEY) || '[]');
    return Array.isArray(h) ? h.slice(-MAX_HISTORY) : [];
  }catch(_){ return []; }
}
function saveHistory(h){
  try{ sessionStorage.setItem(AI_HISTORY_KEY, JSON.stringify(h.slice(-MAX_HISTORY))); }catch(_){}
}

function normalizeSectionUI(){
  // Feed virou Home.
  document.querySelectorAll('[data-section="feed"]').forEach(el=>{
    const span = el.querySelector('span:not(.badge-count)');
    if(span && /feed/i.test(span.textContent || '')) span.textContent = 'Home';
    if(el.tagName === 'A' && /feed/i.test(el.textContent || '')) {
      const badge = el.querySelector('.badge-count');
      if(!badge) el.textContent = 'Home';
    }
  });

  // Chat público removido da interface.
  document.querySelectorAll('[data-section="chat"]').forEach(el=>el.remove());

  // Home-only content follows current section.
  const active = (document.body.dataset.fabiSection || 'feed');
  document.body.dataset.fabiSection = active;

  // The legacy feed stays hidden.
  const feed = document.getElementById('feedCentral');
  if(feed) feed.style.setProperty('display','none','important');
  const oldChat = document.getElementById('chatLayout');
  if(oldChat) oldChat.style.setProperty('display','none','important');
}

function injectAI(){
  if(document.getElementById('fabiAiLauncher')) return;

  document.body.insertAdjacentHTML('beforeend', `
    <button class="fabi-ai-launcher" id="fabiAiLauncher" type="button" aria-controls="fabiAiPanel" aria-expanded="false">
      <img src="/flogo.jpg" alt="">
      <span class="fabi-ai-launcher-text">
        <strong>Precisa de ajuda?</strong>
        <small><span class="fabi-ai-online"></span> Fabi IA</small>
      </span>
    </button>

    <aside class="fabi-ai-panel" id="fabiAiPanel" aria-label="Fabi Assistente">
      <header class="fabi-ai-head">
        <img src="/flogo.jpg" alt="">
        <div class="fabi-ai-head-copy">
          <strong>Fabi Assistente</strong>
          <small><span class="fabi-ai-online"></span> ajuda privada com a plataforma</small>
        </div>
        <div class="fabi-ai-head-actions">
          <button class="fabi-ai-icon-btn" id="fabiAiClear" type="button" title="Nova conversa" aria-label="Nova conversa"><i class="fas fa-rotate-right"></i></button>
          <button class="fabi-ai-icon-btn" id="fabiAiClose" type="button" title="Fechar" aria-label="Fechar"><i class="fas fa-xmark"></i></button>
        </div>
      </header>
      <div class="fabi-ai-messages" id="fabiAiMessages">
        <div class="fabi-ai-welcome">
          <strong>Oi! Eu sou a Fabi.</strong><br>
          Posso ajudar com conexão, comandos, configuração de grupos, proteções, AutoDL, aluguel e navegação pelo site.
        </div>
      </div>
      <div class="fabi-ai-quick" aria-label="Perguntas rápidas">
        <button class="fabi-ai-chip" type="button" data-q="Como conecto a Fabi ao meu WhatsApp?">Como conectar?</button>
        <button class="fabi-ai-chip" type="button" data-q="Como ativar o anti-link no meu grupo?">Ativar anti-link</button>
        <button class="fabi-ai-chip" type="button" data-q="Onde encontro os comandos da Fabi?">Ver comandos</button>
        <button class="fabi-ai-chip" type="button" data-q="Como funciona o aluguel da Fabi no grupo?">Aluguel</button>
      </div>
      <form class="fabi-ai-input-wrap" id="fabiAiForm">
        <textarea class="fabi-ai-input" id="fabiAiInput" rows="1" maxlength="700" placeholder="Pergunte sobre a Fabi..." aria-label="Mensagem para Fabi IA"></textarea>
        <button class="fabi-ai-send" id="fabiAiSend" type="submit" aria-label="Enviar"><i class="fas fa-paper-plane"></i></button>
      </form>
    </aside>
  `);

  const launcher = document.getElementById('fabiAiLauncher');
  const panel = document.getElementById('fabiAiPanel');
  const close = document.getElementById('fabiAiClose');
  const clear = document.getElementById('fabiAiClear');
  const form = document.getElementById('fabiAiForm');
  const input = document.getElementById('fabiAiInput');

  function open(){
    panel.classList.add('open');
    launcher.setAttribute('aria-expanded','true');
    setTimeout(()=>input?.focus(),80);
  }
  function shut(){
    panel.classList.remove('open');
    launcher.setAttribute('aria-expanded','false');
  }
  function clearChat(){
    saveHistory([]);
    const msgs = document.getElementById('fabiAiMessages');
    msgs.innerHTML = `<div class="fabi-ai-welcome"><strong>Nova conversa.</strong><br>O que você quer saber sobre a Fabi?</div>`;
  }

  window.FabiAjuda = { open, close:shut, clear:clearChat };

  launcher.addEventListener('click',()=>panel.classList.contains('open')?shut():open());
  close.addEventListener('click',shut);
  clear.addEventListener('click',clearChat);
  form.addEventListener('submit',e=>{ e.preventDefault(); sendAI(input.value); });
  input.addEventListener('keydown',e=>{
    if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); form.requestSubmit(); }
  });
  document.querySelectorAll('.fabi-ai-chip').forEach(btn=>{
    btn.addEventListener('click',()=>{ input.value=btn.dataset.q||''; form.requestSubmit(); });
  });

  // Render session history
  const h = getHistory();
  if(h.length){
    const msgs = document.getElementById('fabiAiMessages');
    msgs.innerHTML = '';
    h.forEach(m=>appendMessage(m.role,m.content,false));
  }

  try{
    if(sessionStorage.getItem('fabi_open_ai_once') === '1'){
      sessionStorage.removeItem('fabi_open_ai_once');
      open();
    }
  }catch(_){}
}

function appendMessage(role, content, scroll=true){
  const box = document.getElementById('fabiAiMessages');
  if(!box) return;
  const wrap = document.createElement('div');
  wrap.className = `fabi-ai-message ${role === 'user' ? 'user':'assistant'}`;
  wrap.innerHTML = `<div class="fabi-ai-bubble">${formatAI(content)}</div>`;
  box.appendChild(wrap);
  if(scroll) box.scrollTop = box.scrollHeight;
}

function appendTyping(){
  const box = document.getElementById('fabiAiMessages');
  const wrap = document.createElement('div');
  wrap.className='fabi-ai-message assistant';
  wrap.id='fabiAiTyping';
  wrap.innerHTML='<div class="fabi-ai-bubble"><span class="fabi-ai-typing"><i></i><i></i><i></i></span></div>';
  box.appendChild(wrap); box.scrollTop=box.scrollHeight;
}

async function sendAI(raw){
  const input = document.getElementById('fabiAiInput');
  const send = document.getElementById('fabiAiSend');
  const message = String(raw || '').trim();
  if(message.length < 2) return;

  const history = getHistory();
  appendMessage('user',message);
  history.push({role:'user',content:message});
  saveHistory(history);
  input.value='';
  send.disabled=true;
  appendTyping();

  let userName='Visitante';
  try{
    const a = JSON.parse(localStorage.getItem('fabi_session') || localStorage.getItem('neconecta_user_session') || '{}');
    userName = a.nome || a.username || 'Visitante';
  }catch(_){}

  try{
    const res = await fetch(FABI_API + '/api/fabi-assistente',{
      method:'POST',
      mode:'cors',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        mensagem:message,
        nome:userName,
        secao:document.body.dataset.fabiSection || 'feed',
        historico:history.slice(-6)
      })
    });
    const data = await res.json().catch(()=>({}));
    document.getElementById('fabiAiTyping')?.remove();
    const answer = data.resposta || data.mensagem || (res.ok ? 'Não consegui responder agora.' : 'A Fabi IA está indisponível neste momento. Tente novamente em instantes.');
    appendMessage('assistant',answer);
    const h2=getHistory();
    h2.push({role:'assistant',content:answer});
    saveHistory(h2);
  }catch(err){
    document.getElementById('fabiAiTyping')?.remove();
    appendMessage('assistant','Não consegui falar com o servidor agora. Tente novamente em alguns instantes.');
  }finally{
    send.disabled=false;
  }
}

async function loadTestimonials(){
  const grid = document.getElementById('fabiDepoimentosGrid');
  if(!grid) return;
  try{
    let res = await fetch(FABI_API + '/cliente06/depoimentos',{mode:'cors'});
    let data = [];
    if(res.ok) data = await res.json();

    // Compatibility if backend V4 has not been deployed yet.
    if(!res.ok){
      res = await fetch(FABI_API + '/cliente06/posts',{mode:'cors'});
      if(res.ok){
        const posts = await res.json();
        data = (Array.isArray(posts)?posts:[]).filter(p=>p && (p.tipo==='depoimento' || p.testimonial===true || p.categoria==='depoimento'));
      }
    }

    const items = Array.isArray(data) ? data.slice(0,9) : [];
    if(!items.length){
      grid.innerHTML = `<div class="fabi-testimonials-empty"><i class="fas fa-heart" style="font-size:22px;color:#4f6857"></i><strong style="color:#c7d2ca">Experiências chegando</strong><span>Os primeiros relatos aprovados aparecerão aqui.</span></div>`;
      return;
    }

    grid.innerHTML = items.map(renderTestimonial).join('');
  }catch(err){
    grid.innerHTML = `<div class="fabi-testimonials-empty"><span>Não foi possível carregar os relatos agora.</span></div>`;
  }
}

function renderTestimonial(p){
  const text = esc(p.text || p.conteudo || p.legenda || '');
  const author = esc(p.authorName || p.nome || p.author?.nome || 'Comunidade Fabi');
  const role = esc(p.authorRole || p.cargo || 'Usuário da Fabi');
  const media = safeUrl(p.media || p.image || p.imagem || p.foto || '');
  const type = String(p.mediaType || p.tipoMidia || '').toLowerCase();
  const initial = esc((author.trim()[0] || 'F').toUpperCase());

  let mediaHtml='';
  if(media){
    if(type === 'video' || /\.(mp4|webm|mov)(\?|$)/i.test(media)){
      mediaHtml = `<div class="fabi-testimonial-media"><video controls preload="metadata" playsinline src="${esc(media)}"></video><span class="fabi-testimonial-media-badge"><i class="fas fa-play"></i> Vídeo</span></div>`;
    }else{
      mediaHtml = `<div class="fabi-testimonial-media"><img loading="lazy" decoding="async" src="${esc(media)}" alt="Relato de ${author} sobre a Fabi Bot"><span class="fabi-testimonial-media-badge"><i class="fas fa-image"></i> Foto</span></div>`;
    }
  }

  return `<article class="fabi-testimonial-card">
    ${mediaHtml}
    <div class="fabi-testimonial-body">
      ${text ? `<p class="fabi-testimonial-quote">“${text}”</p>` : ''}
      <div class="fabi-testimonial-author">
        <span class="fabi-testimonial-avatar">${initial}</span>
        <div><strong>${author}</strong><small>${role}</small></div>
      </div>
    </div>
  </article>`;
}

function hookSections(){
  if(typeof window.mudarSecao !== 'function') return;
  const original = window.mudarSecao;
  if(original.__fabiV4) return;

  function wrapped(section, options){
    if(section === 'chat'){
      window.FabiAjuda?.open();
      section='feed';
    }
    const result = original(section, options || {});
    try{ document.body.dataset.fabiSection = window.currentSection || section || 'feed'; }catch(_){
      document.body.dataset.fabiSection = section || 'feed';
    }
    normalizeSectionUI();
    return result;
  }
  wrapped.__fabiV4=true;
  window.mudarSecao=wrapped;
}

function boot(){
  normalizeSectionUI();
  injectAI();
  hookSections();
  loadTestimonials();

  // Make "Central de Comandos" internal even if an old cached HTML remains.
  document.querySelectorAll('.fabi-adsense-editorial a').forEach(a=>{
    if(/central de comandos/i.test(a.textContent||'')){
      a.setAttribute('href','?comandos');
      a.addEventListener('click',e=>{e.preventDefault();window.mudarSecao?.('comandos');});
    }
  });

  // Ensure initial route state is respected after V4 loads.
  const params = new URLSearchParams(location.search);
  if(params.has('chat')){
    window.FabiAjuda?.open();
  }
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();

})();
