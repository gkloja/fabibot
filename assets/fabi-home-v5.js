(function(){
'use strict';

const FABI_API = 'https://orange-hill-2e61.gbscabral15.workers.dev/br2.bronxyshost.com:4009/proxy?url=http://br2.bronxyshost.com:4009';
const AI_HISTORY_KEY = 'fabi_ai_history_v2';
const AI_MODE_KEY = 'fabi_ai_reply_mode';
const MAX_HISTORY = 8;

function esc(value){
  return String(value ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function safeUrl(value){
  const v = String(value || '').trim();
  if(/^https?:\/\//i.test(v)) return v;
  if(/^\/cliente06\/depoimentos-media\//.test(v)) return FABI_API + v;
  return '';
}

function formatAI(text){
  let s = esc(text || '');
  s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g, '<a href="mailto:$1">$1</a>');
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
function getAiMode(){
  try{return localStorage.getItem(AI_MODE_KEY)==='audio'?'audio':'text';}catch(_){return 'text';}
}
function setAiMode(mode){
  const normalized = mode==='audio'?'audio':'text';
  try{localStorage.setItem(AI_MODE_KEY,normalized);}catch(_){}
  document.querySelectorAll('[data-ai-mode]').forEach(b=>b.classList.toggle('active',b.dataset.aiMode===normalized));
}

function normalizeSectionUI(){
  document.querySelectorAll('[data-section="feed"]').forEach(el=>{
    const span = el.querySelector('span:not(.badge-count)');
    if(span && /feed/i.test(span.textContent || '')) span.textContent = 'Home';
  });

  document.querySelectorAll('[data-section="chat"]').forEach(el=>el.remove());

  document.querySelectorAll('[data-section="vendas"]').forEach(el=>{
    el.dataset.section='depoimentos';
    const span=el.querySelector('span:last-child');
    if(span) span.textContent='Depoimentos';
    const icon=el.querySelector('i');
    if(icon) icon.className='fas fa-quote-left';
    el.querySelector('#bottomVendasBadge')?.remove();
  });

  const active = document.body.dataset.fabiSection || 'feed';
  document.body.dataset.fabiSection = active;

  document.getElementById('feedCentral')?.style.setProperty('display','none','important');
  document.getElementById('chatLayout')?.style.setProperty('display','none','important');
  document.getElementById('vendasContainer')?.style.setProperty('display','none','important');
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
          <small><span class="fabi-ai-online"></span> conversa privada</small>
        </div>
        <div class="fabi-ai-head-actions">
          <button class="fabi-ai-icon-btn" id="fabiAiClear" type="button" title="Nova conversa" aria-label="Nova conversa"><i class="fas fa-rotate-right"></i></button>
          <button class="fabi-ai-icon-btn" id="fabiAiClose" type="button" title="Fechar" aria-label="Fechar"><i class="fas fa-xmark"></i></button>
        </div>
      </header>

      <div class="fabi-ai-modebar">
        <span>Responder em</span>
        <div class="fabi-ai-mode-switch" role="group" aria-label="Formato da resposta">
          <button type="button" data-ai-mode="text"><i class="fas fa-message"></i> Texto</button>
          <button type="button" data-ai-mode="audio"><i class="fas fa-volume-high"></i> Áudio</button>
        </div>
      </div>

      <div class="fabi-ai-messages" id="fabiAiMessages">
        <div class="fabi-ai-welcome">
          <strong>Oi! Eu sou a Fabi.</strong><br>
          Posso ajudar com conexão, comandos, grupos, proteções, AutoDL, aluguel e navegação pelo site.
        </div>
      </div>

      <div class="fabi-ai-quick" aria-label="Perguntas rápidas">
        <button class="fabi-ai-chip" type="button" data-q="Como conecto a Fabi ao meu WhatsApp?">Como conectar?</button>
        <button class="fabi-ai-chip" type="button" data-q="Como ativar o anti-link no meu grupo?">Anti-link</button>
        <button class="fabi-ai-chip" type="button" data-q="Onde encontro os comandos da Fabi?">Comandos</button>
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
  document.querySelectorAll('[data-ai-mode]').forEach(btn=>{
    btn.addEventListener('click',()=>setAiMode(btn.dataset.aiMode));
  });
  setAiMode(getAiMode());

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

function appendMessage(role, content, scroll=true, note=''){
  const box = document.getElementById('fabiAiMessages');
  if(!box) return null;
  const wrap = document.createElement('div');
  wrap.className = `fabi-ai-message ${role === 'user' ? 'user':'assistant'}`;
  wrap.innerHTML = `<div class="fabi-ai-bubble">${formatAI(content)}${note?`<small class="fabi-ai-note">${esc(note)}</small>`:''}</div>`;
  box.appendChild(wrap);
  if(scroll) box.scrollTop = box.scrollHeight;
  return wrap;
}

function appendTyping(label='Pensando...'){
  const box = document.getElementById('fabiAiMessages');
  if(!box) return;
  document.getElementById('fabiAiTyping')?.remove();
  const wrap = document.createElement('div');
  wrap.className='fabi-ai-message assistant';
  wrap.id='fabiAiTyping';
  wrap.innerHTML=`<div class="fabi-ai-bubble"><span class="fabi-ai-typing"><i></i><i></i><i></i></span> <span class="fabi-ai-typing-label">${esc(label)}</span></div>`;
  box.appendChild(wrap); box.scrollTop=box.scrollHeight;
}

function appendAudioAnswer(audioUrl, transcript){
  const box=document.getElementById('fabiAiMessages');
  if(!box) return;
  const wrap=document.createElement('div');
  wrap.className='fabi-ai-message assistant';
  wrap.innerHTML=`<div class="fabi-ai-bubble fabi-ai-audio-bubble">
    <div class="fabi-ai-audio-title"><i class="fas fa-wave-square"></i><span>Fabi · Francisca</span></div>
    <audio controls preload="metadata" src="${esc(audioUrl)}"></audio>
    <details class="fabi-ai-transcript"><summary>Ver transcrição</summary><div>${formatAI(transcript)}</div></details>
  </div>`;
  box.appendChild(wrap);
  box.scrollTop=box.scrollHeight;
}

async function gerarAudioFabi(texto){
  const res=await fetch(FABI_API+'/cliente06/tts/gerar',{
    method:'POST',
    mode:'cors',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({texto,voz:'Francisca'})
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok || !data.success || !data.audioUrl) throw new Error(data.error||'TTS indisponível');
  return data.audioUrl;
}

async function sendAI(raw){
  const input = document.getElementById('fabiAiInput');
  const send = document.getElementById('fabiAiSend');
  const message = String(raw || '').trim();
  if(message.length < 2) return;

  const mode=getAiMode();
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
    const h2=getHistory();
    h2.push({role:'assistant',content:answer});
    saveHistory(h2);

    if(mode==='audio' && data.pode_audio !== false && res.ok){
      appendTyping('Preparando a voz da Fabi...');
      try{
        const audioUrl=await gerarAudioFabi(answer);
        document.getElementById('fabiAiTyping')?.remove();
        appendAudioAnswer(audioUrl,answer);
      }catch(_){
        document.getElementById('fabiAiTyping')?.remove();
        appendMessage('assistant',answer,true,'A voz não ficou disponível agora; enviei em texto.');
      }
    }else{
      const note = mode==='audio' && data.pode_audio===false
        ? (data.motivo_texto || 'Enviei em texto para manter o conteúdo clicável.')
        : '';
      appendMessage('assistant',answer,true,note);
    }
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

    if(!res.ok){
      res = await fetch(FABI_API + '/cliente06/posts',{mode:'cors'});
      if(res.ok){
        const posts = await res.json();
        data = (Array.isArray(posts)?posts:[]).filter(p=>p && (p.tipo==='depoimento' || p.testimonial===true || p.categoria==='depoimento'));
      }
    }

    const items = Array.isArray(data) ? data.slice(0,12) : [];
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
    if(type === 'audio' || /\.(mp3|m4a|aac|wav|ogg|opus)(\?|$)/i.test(media)){
      mediaHtml = `<div class="fabi-testimonial-media fabi-testimonial-audio">
        <span class="fabi-testimonial-audio-icon"><i class="fas fa-microphone-lines"></i></span>
        <strong>Depoimento em áudio</strong>
        <audio controls preload="metadata" src="${esc(media)}"></audio>
      </div>`;
    }else if(type === 'video' || /\.(mp4|webm|mov)(\?|$)/i.test(media)){
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

let depRecorder=null;
let depStream=null;
let depChunks=[];
let depRecordedFile=null;
let depTimer=null;
let depSeconds=0;

function injectTestimonialModal(){
  if(document.getElementById('fabiTestimonialModal')) return;

  document.body.insertAdjacentHTML('beforeend',`
  <div class="fabi-dep-modal" id="fabiTestimonialModal" aria-hidden="true">
    <div class="fabi-dep-backdrop" data-dep-close></div>
    <section class="fabi-dep-dialog" role="dialog" aria-modal="true" aria-labelledby="fabiDepTitle">
      <header class="fabi-dep-head">
        <div>
          <span class="fabi-dep-kicker">Comunidade Fabi</span>
          <h2 id="fabiDepTitle">Conte sua experiência</h2>
          <p>Texto, foto, vídeo ou áudio. Seu relato só aparece depois da aprovação.</p>
        </div>
        <button type="button" class="fabi-dep-close" data-dep-close aria-label="Fechar"><i class="fas fa-xmark"></i></button>
      </header>

      <form id="fabiDepForm" class="fabi-dep-form">
        <label>Como seu nome deve aparecer
          <input id="fabiDepNome" maxlength="60" required placeholder="Seu nome ou apelido">
        </label>
        <label>Descrição curta <span>(opcional)</span>
          <input id="fabiDepCargo" maxlength="80" placeholder="Ex.: Administrador de comunidade">
        </label>
        <label>Seu relato <span>(opcional se enviar mídia)</span>
          <textarea id="fabiDepTexto" maxlength="1500" rows="4" placeholder="Conte como você usa a Fabi e o que achou..."></textarea>
        </label>

        <div class="fabi-dep-media-box">
          <div class="fabi-dep-media-title"><strong>Adicionar mídia</strong><small>1 arquivo por depoimento · até 40 MB</small></div>
          <div class="fabi-dep-media-actions">
            <label class="fabi-dep-file-btn">
              <i class="fas fa-paperclip"></i> Foto, vídeo ou áudio
              <input id="fabiDepFile" type="file" accept="image/*,video/*,audio/*" hidden>
            </label>
            <button class="fabi-dep-record-btn" id="fabiDepRecord" type="button"><i class="fas fa-microphone"></i> Gravar áudio</button>
          </div>
          <div class="fabi-dep-recording" id="fabiDepRecording" hidden>
            <span class="fabi-dep-rec-dot"></span><strong>Gravando</strong><span id="fabiDepRecTime">0:00</span>
          </div>
          <div class="fabi-dep-preview" id="fabiDepPreview" hidden></div>
        </div>

        <input id="fabiDepWebsite" tabindex="-1" autocomplete="off" class="fabi-dep-honeypot" aria-hidden="true">

        <label class="fabi-dep-consent">
          <input type="checkbox" id="fabiDepConsent" required>
          <span>Autorizo a Fabi Bot a publicar este depoimento e a mídia enviada no site após revisão.</span>
        </label>

        <div class="fabi-dep-status" id="fabiDepStatus" aria-live="polite"></div>

        <button class="fabi-dep-submit" id="fabiDepSubmit" type="submit">
          <i class="fas fa-paper-plane"></i><span>Enviar para aprovação</span>
        </button>
      </form>
    </section>
  </div>`);

  document.querySelectorAll('[data-dep-close]').forEach(x=>x.addEventListener('click',closeTestimonialModal));
  document.getElementById('fabiDepForm')?.addEventListener('submit',submitTestimonial);
  document.getElementById('fabiDepFile')?.addEventListener('change',e=>{
    depRecordedFile=null;
    const f=e.target.files?.[0]||null;
    previewDepFile(f);
  });
  document.getElementById('fabiDepRecord')?.addEventListener('click',toggleDepRecording);
}

function openTestimonialModal(){
  injectTestimonialModal();
  const m=document.getElementById('fabiTestimonialModal');
  m.classList.add('open');m.setAttribute('aria-hidden','false');
  document.body.classList.add('fabi-modal-open');
  setTimeout(()=>document.getElementById('fabiDepNome')?.focus(),80);
}
function closeTestimonialModal(){
  stopDepRecording(true);
  const m=document.getElementById('fabiTestimonialModal');
  m?.classList.remove('open');m?.setAttribute('aria-hidden','true');
  document.body.classList.remove('fabi-modal-open');
}
window.FabiDepoimentos={open:openTestimonialModal,close:closeTestimonialModal};

function formatRec(sec){
  const m=Math.floor(sec/60),s=sec%60;
  return `${m}:${String(s).padStart(2,'0')}`;
}
async function toggleDepRecording(){
  if(depRecorder && depRecorder.state==='recording'){stopDepRecording(false);return;}
  if(!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder==='undefined'){
    setDepStatus('Seu navegador não oferece gravação aqui. Você ainda pode anexar um arquivo de áudio.','error');
    return;
  }
  try{
    depStream=await navigator.mediaDevices.getUserMedia({audio:true});
    let mime='';
    for(const m of ['audio/webm;codecs=opus','audio/webm','audio/mp4']){
      if(MediaRecorder.isTypeSupported?.(m)){mime=m;break;}
    }
    depRecorder=new MediaRecorder(depStream,mime?{mimeType:mime}:undefined);
    depChunks=[];
    depRecorder.ondataavailable=e=>{if(e.data?.size) depChunks.push(e.data);};
    depRecorder.onstop=()=>{
      if(!depChunks.length)return;
      const type=depRecorder.mimeType||'audio/webm';
      const ext=type.includes('mp4')?'m4a':'webm';
      const blob=new Blob(depChunks,{type});
      depRecordedFile=new File([blob],`depoimento_${Date.now()}.${ext}`,{type});
      const fileInput=document.getElementById('fabiDepFile');if(fileInput)fileInput.value='';
      previewDepFile(depRecordedFile);
    };
    depRecorder.start(500);
    depSeconds=0;
    document.getElementById('fabiDepRecording').hidden=false;
    const btn=document.getElementById('fabiDepRecord');
    btn.classList.add('recording');btn.innerHTML='<i class="fas fa-stop"></i> Parar gravação';
    depTimer=setInterval(()=>{
      depSeconds++;
      const el=document.getElementById('fabiDepRecTime');if(el)el.textContent=formatRec(depSeconds);
      if(depSeconds>=180) stopDepRecording(false);
    },1000);
  }catch(_){setDepStatus('Não consegui acessar o microfone. Verifique a permissão do navegador.','error');}
}
function stopDepRecording(cancel){
  if(depTimer){clearInterval(depTimer);depTimer=null;}
  try{
    if(depRecorder?.state==='recording'){
      if(cancel){depRecorder.ondataavailable=null;depRecorder.onstop=null;}
      depRecorder.stop();
    }
  }catch(_){}
  depStream?.getTracks?.().forEach(t=>t.stop());
  depStream=null;
  const rec=document.getElementById('fabiDepRecording');if(rec)rec.hidden=true;
  const btn=document.getElementById('fabiDepRecord');
  if(btn){btn.classList.remove('recording');btn.innerHTML='<i class="fas fa-microphone"></i> Gravar áudio';}
}

function previewDepFile(file){
  const box=document.getElementById('fabiDepPreview');
  if(!box)return;
  if(!file){box.hidden=true;box.innerHTML='';return;}
  const url=URL.createObjectURL(file);
  let inner='';
  if(file.type.startsWith('image/'))inner=`<img src="${url}" alt="Prévia">`;
  else if(file.type.startsWith('video/'))inner=`<video src="${url}" controls playsinline></video>`;
  else inner=`<audio src="${url}" controls></audio>`;
  box.hidden=false;
  box.innerHTML=`<div class="fabi-dep-preview-top"><span><i class="fas fa-file"></i> ${esc(file.name)}</span><button type="button" id="fabiDepRemoveMedia"><i class="fas fa-trash"></i></button></div>${inner}`;
  document.getElementById('fabiDepRemoveMedia')?.addEventListener('click',()=>{
    depRecordedFile=null;
    const inp=document.getElementById('fabiDepFile');if(inp)inp.value='';
    box.hidden=true;box.innerHTML='';
    URL.revokeObjectURL(url);
  });
}

function setDepStatus(text,type=''){
  const el=document.getElementById('fabiDepStatus');
  if(!el)return;
  el.className='fabi-dep-status '+type;
  el.textContent=text||'';
}
async function submitTestimonial(e){
  e.preventDefault();
  const nome=document.getElementById('fabiDepNome').value.trim();
  const cargo=document.getElementById('fabiDepCargo').value.trim();
  const texto=document.getElementById('fabiDepTexto').value.trim();
  const consent=document.getElementById('fabiDepConsent').checked;
  const website=document.getElementById('fabiDepWebsite').value;
  const inputFile=document.getElementById('fabiDepFile').files?.[0]||null;
  const file=depRecordedFile||inputFile;
  const btn=document.getElementById('fabiDepSubmit');

  if(nome.length<2){setDepStatus('Informe como seu nome deve aparecer.','error');return;}
  if(!texto && !file){setDepStatus('Escreva um relato ou envie uma foto, vídeo ou áudio.','error');return;}
  if(!consent){setDepStatus('Marque a autorização de publicação.','error');return;}
  if(file && file.size>40*1024*1024){setDepStatus('O arquivo precisa ter no máximo 40 MB.','error');return;}

  btn.disabled=true;btn.querySelector('span').textContent='Enviando...';
  setDepStatus(file?'Enviando sua mídia...':'Preparando seu depoimento...');

  try{
    let midia='',mediaType='';
    if(file){
      const fd=new FormData();
      fd.append('midia',file,file.name||`depoimento_${Date.now()}`);
      const up=await fetch(FABI_API+'/cliente06/depoimentos/midia-publica',{method:'POST',mode:'cors',body:fd});
      const ud=await up.json().catch(()=>({}));
      if(!up.ok||!ud.success)throw new Error(ud.error||'Falha ao enviar a mídia.');
      midia=ud.url||'';mediaType=ud.mediaType||'';
    }

    setDepStatus('Enviando para aprovação...');
    const res=await fetch(FABI_API+'/cliente06/depoimentos/enviar-publico',{
      method:'POST',mode:'cors',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({nome,cargo,texto,midia,mediaType,autorizoPublicacao:true,website})
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.success)throw new Error(data.error||'Não foi possível enviar.');

    setDepStatus('Recebemos! Seu depoimento vai aparecer depois da aprovação.','success');
    document.getElementById('fabiDepForm').reset();
    depRecordedFile=null;
    previewDepFile(null);
    setTimeout(closeTestimonialModal,1800);
  }catch(err){
    setDepStatus(err.message||'Não foi possível enviar agora.','error');
  }finally{
    btn.disabled=false;btn.querySelector('span').textContent='Enviar para aprovação';
  }
}

function showTestimonialsView(options={}){
  if(typeof window.__fabiOriginalMudarSecao==='function'){
    window.__fabiOriginalMudarSecao('feed',{skipUrl:true});
  }
  document.body.dataset.fabiSection='depoimentos';
  document.getElementById('introSection')?.style.setProperty('display','none','important');
  document.getElementById('feedCentral')?.style.setProperty('display','none','important');
  document.getElementById('vendasContainer')?.style.setProperty('display','none','important');

  document.querySelectorAll('.bottom-nav-item').forEach(i=>i.classList.toggle('active',i.dataset.section==='depoimentos'));
  document.querySelectorAll('.menu a').forEach(i=>i.classList.remove('active'));

  if(!options.skipUrl){
    try{history.pushState({section:'depoimentos'},'',location.pathname+'?depoimentos'+location.hash);}catch(_){}
  }
  normalizeSectionUI();
  setTimeout(()=>document.getElementById('fabiDepoimentosHome')?.scrollIntoView({behavior:options.instant?'auto':'smooth',block:'start'}),50);
}

function hookSections(){
  if(typeof window.mudarSecao !== 'function') return;
  const original = window.mudarSecao;
  if(original.__fabiV5) return;
  window.__fabiOriginalMudarSecao=original;

  function wrapped(section, options){
    if(section === 'chat'){
      window.FabiAjuda?.open();
      section='feed';
    }
    if(section === 'depoimentos' || section === 'vendas'){
      return showTestimonialsView(options||{});
    }

    const result = original(section, options || {});
    try{ document.body.dataset.fabiSection = window.currentSection || section || 'feed'; }catch(_){
      document.body.dataset.fabiSection = section || 'feed';
    }
    normalizeSectionUI();
    return result;
  }
  wrapped.__fabiV5=true;
  window.mudarSecao=wrapped;
}

function hookTestimonialButtons(){
  document.getElementById('fabiOpenTestimonial')?.addEventListener('click',openTestimonialModal);
}

function boot(){
  normalizeSectionUI();
  injectAI();
  injectTestimonialModal();
  hookSections();
  hookTestimonialButtons();
  loadTestimonials();

  document.querySelectorAll('.fabi-adsense-editorial a').forEach(a=>{
    if(/central de comandos/i.test(a.textContent||'')){
      a.setAttribute('href','?comandos');
      a.addEventListener('click',e=>{e.preventDefault();window.mudarSecao?.('comandos');});
    }
  });

  const params = new URLSearchParams(location.search);
  if(params.has('chat')) window.FabiAjuda?.open();
  if(params.has('depoimentos') || params.has('vendas')) showTestimonialsView({skipUrl:true,instant:true});

  window.addEventListener('popstate',()=>{
    const p=new URLSearchParams(location.search);
    if(p.has('depoimentos')||p.has('vendas')) showTestimonialsView({skipUrl:true,instant:true});
  });
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();

})();
