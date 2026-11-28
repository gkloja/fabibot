(function () {
  'use strict';

  const API = '/api/creator';
  const $ = (selector, root = document) => root.querySelector(selector);
  const state = { token: '', user: null, objectUrl: '', file: null, duration: null, busy: false, returnFocus: null };

  try { state.token = localStorage.getItem('fabi_creator_token') || ''; } catch (_) { /* A sessão ainda funciona nesta aba. */ }

  const form = $('#creationForm');
  const videoInput = $('#videoInput');
  const preview = $('#videoPreview');
  const authDialog = $('#authDialog');
  const formMessage = $('#formMessage');
  const uploadProgress = $('#uploadProgress');

  function showMessage(text, kind) {
    formMessage.textContent = String(text || '');
    formMessage.className = 'form-message' + (kind ? ' is-' + kind : '');
    formMessage.hidden = !text;
  }

  function showAuthMessage(text, kind) {
    const target = $('#authMessage');
    target.textContent = String(text || '');
    target.className = 'form-message' + (kind ? ' is-' + kind : '');
    target.hidden = !text;
  }

  function setUser(user) {
    state.user = user && typeof user === 'object' ? user : null;
    const guestActions = $('#guestActions');
    const signedInPanel = $('#signedInPanel');
    const headerUser = $('#headerUser');
    const authOpenButton = $('#authOpenButton');
    const accountText = $('#accountText');

    if (!state.user) {
      guestActions.hidden = false;
      signedInPanel.hidden = true;
      headerUser.hidden = true;
      authOpenButton.hidden = false;
      accountText.textContent = 'Entre na hora de publicar. Seu vídeo e os detalhes ficam aqui enquanto isso.';
      return;
    }

    const username = String(state.user.username || state.user.handle || state.user.displayName || 'criador');
    $('#signedInName').textContent = '@' + username;
    $('#signedInPoints').textContent = (Number(state.user.points) || 0) + ' pontos de criador';
    guestActions.hidden = true;
    signedInPanel.hidden = false;
    headerUser.textContent = '@' + username;
    headerUser.hidden = false;
    authOpenButton.hidden = true;
    accountText.textContent = 'Sua conta está pronta. Publique quando sua prévia estiver do jeito que você quer.';
  }

  async function api(path, options) {
    const opts = Object.assign({ cache: 'no-store' }, options || {});
    opts.headers = Object.assign({}, opts.headers || {});
    if (state.token) opts.headers.Authorization = 'Bearer ' + state.token;
    const response = await fetch(API + path, opts);
    const payload = await response.json().catch(() => ({ error: 'Resposta inválida do servidor.' }));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || 'Não foi possível concluir. Tente novamente.');
    return payload;
  }

  function openAuth(tab) {
    state.returnFocus = document.activeElement;
    if (!authDialog.open) authDialog.showModal();
    selectAuthTab(tab || 'register');
    showAuthMessage('', '');
    $('#authClose').focus();
  }

  function selectAuthTab(mode) {
    const registerActive = mode !== 'login';
    $('#registerTab').classList.toggle('is-active', registerActive);
    $('#loginTab').classList.toggle('is-active', !registerActive);
    $('#registerTab').setAttribute('aria-selected', String(registerActive));
    $('#loginTab').setAttribute('aria-selected', String(!registerActive));
    $('#registerTab').tabIndex = registerActive ? 0 : -1;
    $('#loginTab').tabIndex = registerActive ? -1 : 0;
    $('#registerForm').hidden = !registerActive;
    $('#loginForm').hidden = registerActive;
  }

  $('#authOpenButton').addEventListener('click', () => openAuth('login'));
  $('#accountSignIn').addEventListener('click', () => openAuth('login'));
  $('#accountCreate').addEventListener('click', () => openAuth('register'));
  $('#authClose').addEventListener('click', () => authDialog.close());
  authDialog.addEventListener('click', event => {
    if (event.target === authDialog) authDialog.close();
  });
  authDialog.addEventListener('close', () => {
    if (state.returnFocus && state.returnFocus.isConnected && !state.returnFocus.closest('[hidden]') && !state.returnFocus.disabled) state.returnFocus.focus();
    else $('#publishButton').focus();
  });
  document.querySelectorAll('[data-auth-tab]').forEach(button => {
    button.addEventListener('click', () => selectAuthTab(button.dataset.authTab));
    button.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const next = button.dataset.authTab === 'register' ? $('#loginTab') : $('#registerTab');
      selectAuthTab(next.dataset.authTab);
      next.focus();
    });
  });

  async function authenticate(authForm, mode) {
    const submit = authForm.querySelector('[type="submit"]');
    submit.disabled = true;
    showAuthMessage('', '');
    try {
      const payload = Object.fromEntries(new FormData(authForm));
      const data = await api('/auth/' + mode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!data.token || !data.user) throw new Error('Não foi possível iniciar a sessão. Tente novamente.');
      state.token = String(data.token);
      try { localStorage.setItem('fabi_creator_token', state.token); } catch (_) { /* Sessão válida nesta aba. */ }
      setUser(data.user);
      authForm.reset();
      authDialog.close();
      showMessage('Conta conectada. Sua prévia continua aqui; toque em “Publicar na vitrine” quando estiver pronto.', 'success');
    } catch (error) {
      showAuthMessage(error.message || 'Não foi possível entrar. Tente novamente.', 'error');
    } finally {
      submit.disabled = false;
    }
  }

  $('#registerForm').addEventListener('submit', event => {
    event.preventDefault();
    authenticate(event.currentTarget, 'register');
  });
  $('#loginForm').addEventListener('submit', event => {
    event.preventDefault();
    authenticate(event.currentTarget, 'login');
  });

  $('#signOutButton').addEventListener('click', () => {
    state.token = '';
    try { localStorage.removeItem('fabi_creator_token'); } catch (_) { /* A sessão local é opcional. */ }
    setUser(null);
    showMessage('Você saiu da conta. Seu vídeo ainda está preparado nesta página.', '');
  });

  function updateFlow() {
    const titleReady = $('#titleInput').value.trim().length >= 2;
    const descriptionReady = $('#descriptionInput').value.trim().length > 0;
    const step = !state.file ? 1 : (titleReady && descriptionReady ? 3 : 2);
    document.querySelectorAll('[data-flow-step]').forEach(item => {
      const number = Number(item.dataset.flowStep);
      item.classList.toggle('is-current', number === step);
      item.classList.toggle('is-done', number < step);
      if (number === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
  }

  function updateTextPreview() {
    const title = $('#titleInput').value.trim();
    const description = $('#descriptionInput').value.trim();
    $('#titleInput').setCustomValidity($('#titleInput').value && title.length < 2 ? 'Use pelo menos 2 caracteres sem contar os espaços.' : '');
    $('#descriptionInput').setCustomValidity($('#descriptionInput').value && !description ? 'A descrição precisa conter texto, não apenas espaços.' : '');
    const category = $('#categoryInput').value || 'comunidade';
    $('#titleCount').textContent = $('#titleInput').value.length + '/80';
    $('#descriptionCount').textContent = $('#descriptionInput').value.length + '/280';
    $('#previewStickerTitle').textContent = title || 'Nome da sua figurinha';
    $('#previewAuthor').textContent = description ? description : 'Criada por você · com áudio';
    $('#previewCategory').textContent = category.toLocaleUpperCase('pt-BR');
    updateFlow();
  }

  $('#titleInput').addEventListener('input', updateTextPreview);
  $('#descriptionInput').addEventListener('input', updateTextPreview);
  $('#categoryInput').addEventListener('change', updateTextPreview);

  function clearVideo() {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = '';
    state.file = null;
    state.duration = null;
    preview.onloadedmetadata = null;
    preview.onerror = null;
    preview.pause();
    preview.removeAttribute('src');
    preview.load();
    preview.hidden = true;
    $('#previewPlaceholder').hidden = false;
    $('#fileDetails').hidden = true;
    $('#dropZone').classList.remove('has-file');
    $('#dropTitle').textContent = 'Solte o vídeo aqui';
    $('#dropCopy').textContent = 'ou toque para escolher na galeria';
    $('#fileName').textContent = '';
    $('#fileMeta').textContent = '';
    updateFlow();
  }

  function invalidFile(message) {
    videoInput.value = '';
    clearVideo();
    showMessage(message, 'error');
    $('#dropZone').focus();
  }

  function acceptFile(file) {
    if (!file) return;
    const ext = String(file.name || '').split('.').pop().toLowerCase();
    const allowedExtensions = ['mp4', 'mov', 'webm', 'm4v'];
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
    if (!allowedExtensions.includes(ext) && !allowedTypes.includes(file.type)) {
      invalidFile('Esse formato ainda não é aceito. Escolha um vídeo MP4, MOV ou WebM.');
      return;
    }
    if (file.size > 24 * 1024 * 1024) {
      invalidFile('O vídeo passou de 24 MB. Escolha outro ou reduza o tamanho antes de enviar.');
      return;
    }

    clearVideo();
    state.file = file;
    state.objectUrl = URL.createObjectURL(file);
    preview.src = state.objectUrl;
    preview.hidden = false;
    $('#previewPlaceholder').hidden = true;
    $('#fileDetails').hidden = false;
    $('#dropZone').classList.add('has-file');
    $('#dropTitle').textContent = 'Vídeo selecionado';
    $('#dropCopy').textContent = 'Toque aqui para escolher outro';
    $('#fileName').textContent = file.name || 'Vídeo escolhido';
    $('#fileMeta').textContent = (file.size / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB · lendo duração…';
    showMessage('', '');
    updateFlow();

    preview.onloadedmetadata = () => {
      const duration = Number(preview.duration);
      if (!Number.isFinite(duration) || duration <= 0) {
        invalidFile('Não foi possível confirmar a duração deste vídeo. Escolha outro arquivo.');
        return;
      }
      state.duration = duration;
      if (duration > 10) {
        invalidFile('Este vídeo tem ' + duration.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' s. O limite é 10 s; escolha um trecho mais curto antes de publicar.');
        return;
      }
      $('#fileMeta').textContent = duration.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' s · ' + (file.size / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB';
    };
    preview.onerror = () => {
      state.duration = null;
      $('#fileMeta').textContent = 'Não foi possível confirmar a duração.';
      showMessage('Não foi possível abrir a prévia e confirmar a duração. Escolha outro vídeo ou tente outro navegador.', 'error');
    };
  }

  const dropZone = $('#dropZone');
  dropZone.addEventListener('click', () => videoInput.click());
  videoInput.addEventListener('change', () => acceptFile(videoInput.files && videoInput.files[0]));
  $('#removeVideo').addEventListener('click', () => {
    videoInput.value = '';
    clearVideo();
    showMessage('Tudo certo — escolha outro vídeo quando quiser.', '');
  });
  ['dragenter', 'dragover'].forEach(type => dropZone.addEventListener(type, event => {
    event.preventDefault();
    dropZone.classList.add('is-dragging');
  }));
  ['dragleave', 'drop'].forEach(type => dropZone.addEventListener(type, event => {
    event.preventDefault();
    dropZone.classList.remove('is-dragging');
  }));
  dropZone.addEventListener('drop', event => {
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (!file) return;
    try {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      videoInput.files = transfer.files;
    } catch (_) { /* A prévia continua disponível; a seleção pelo botão é o fallback. */ }
    acceptFile(file);
  });

  function setProgress(label, value, indeterminate) {
    $('#progressLabel').textContent = label;
    $('#progressPercent').textContent = indeterminate ? '…' : Math.round(value) + '%';
    $('#progressBar').value = indeterminate ? 78 : Math.max(0, Math.min(100, value));
  }

  function uploadCreation() {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', API + '/creations');
      if (state.token) request.setRequestHeader('Authorization', 'Bearer ' + state.token);
      request.upload.onprogress = event => {
        if (event.lengthComputable) setProgress('Enviando seu vídeo', Math.min(76, event.loaded / event.total * 76), false);
      };
      request.upload.onload = () => setProgress('Finalizando sua figurinha', 80, true);
      request.onload = () => {
        let payload = {};
        try { payload = JSON.parse(request.responseText); } catch (_) { /* O erro abaixo é exibido ao usuário. */ }
        if (request.status >= 200 && request.status < 300 && payload.ok !== false) resolve(payload);
        else reject(new Error(payload.error || 'Não foi possível publicar agora. Tente novamente.'));
      };
      request.onerror = () => reject(new Error('A conexão foi interrompida. Seu vídeo continua preparado nesta página.'));
      request.onabort = () => reject(new Error('O envio foi cancelado. Seu vídeo continua preparado nesta página.'));
      const data = new FormData(form);
      data.set('title', $('#titleInput').value.trim());
      data.set('description', $('#descriptionInput').value.trim());
      data.set('tags', $('#tagsInput').value.split(',').map(tag => tag.trim()).filter(Boolean).join(', '));
      if (state.file && (!videoInput.files || !videoInput.files[0])) data.set('video', state.file, state.file.name || 'figurinha.mp4');
      request.send(data);
    });
  }

  function safeCreationId(value) {
    const id = String(value || '').trim();
    return /^[a-zA-Z0-9_-]{1,100}$/.test(id) ? id : '';
  }

  async function claimCreation(button, id) {
    if (!window.FabiStickerApi || typeof window.FabiStickerApi.creatorClaimLink !== 'function') {
      showMessage('A criação foi publicada. Abra “Meu perfil” na vitrine para concluir o resgate.', 'error');
      return;
    }
    button.disabled = true;
    button.textContent = 'Preparando WhatsApp…';
    const claimStatus = $('#claimStatus');
    if (claimStatus) claimStatus.textContent = '';
    try {
      const data = await window.FabiStickerApi.creatorClaimLink(id, state.token);
      const claimUrl = String(data.claimUrl || '').trim();
      if (!claimUrl) throw new Error('O servidor não retornou o link de resgate. Abra “Minhas criações” no seu perfil.');
      const target = new URL(claimUrl, location.href);
      const whatsappHttpsHosts = new Set(['wa.me', 'api.whatsapp.com', 'web.whatsapp.com', 'whatsapp.com', 'www.whatsapp.com']);
      const safeHttps = target.protocol === 'https:' && !target.port && whatsappHttpsHosts.has(target.hostname.toLowerCase());
      const safeAppLink = target.protocol === 'whatsapp:' && target.hostname.toLowerCase() === 'send' && !target.port && (!target.pathname || target.pathname === '/');
      if ((!safeHttps && !safeAppLink) || target.username || target.password) {
        throw new Error('O link de resgate retornado não é seguro.');
      }
      location.assign(target.href);
    } catch (error) {
      if (claimStatus) claimStatus.textContent = error.message || 'Não foi possível gerar o link de resgate.';
      else showMessage(error.message || 'Não foi possível gerar o link de resgate.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Resgatar no WhatsApp ↗';
    }
  }

  function renderResult(payload) {
    try { sessionStorage.setItem('fabiCreatorPublished', '1'); } catch (_) { /* The catalog refreshes normally on navigation if storage is unavailable. */ }
    const resultId = safeCreationId(payload && payload.creation && payload.creation.id);
    formMessage.replaceChildren();
    formMessage.className = 'form-message is-success';
    formMessage.hidden = false;
    const success = document.createElement('strong');
    success.textContent = 'Publicada na vitrine. ';
    formMessage.append(success, document.createTextNode('Sua criação já entrou para a comunidade.'));
    if (resultId) {
      const claim = document.createElement('button');
      claim.className = 'button button-primary';
      claim.type = 'button';
      claim.style.marginTop = '10px';
      claim.textContent = 'Resgatar no WhatsApp ↗';
      claim.addEventListener('click', () => claimCreation(claim, resultId));
      const claimStatus = document.createElement('small');
      claimStatus.id = 'claimStatus';
      claimStatus.className = 'claim-status';
      claimStatus.setAttribute('role', 'status');
      claimStatus.setAttribute('aria-live', 'polite');
      formMessage.append(document.createElement('br'), claim, claimStatus);
    } else {
      const link = document.createElement('a');
      link.className = 'text-link';
      link.href = '/figurinhas';
      link.textContent = 'Abrir a vitrine da comunidade ↗';
      link.style.display = 'inline-block';
      link.style.marginTop = '10px';
      formMessage.append(document.createElement('br'), link);
    }
    form.reset();
    clearVideo();
    updateTextPreview();
    loadLists();
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (state.busy) return;
    if (!state.file) {
      showMessage('Escolha um vídeo antes de publicar.', 'error');
      dropZone.focus();
      return;
    }
    if (state.file.size > 24 * 1024 * 1024) {
      showMessage('O vídeo precisa ter até 24 MB.', 'error');
      return;
    }
    if (state.duration === null) {
      showMessage('Aguarde a leitura da duração do vídeo antes de publicar. Se ela não carregar, escolha outro arquivo.', 'error');
      return;
    }
    if (state.duration > 10) {
      showMessage('O limite é 10 segundos. Escolha um trecho mais curto.', 'error');
      return;
    }
    if (!form.reportValidity()) return;
    if (!state.token || !state.user) {
      showMessage('Seu vídeo e as informações continuam nesta página. Entre ou crie uma conta para publicar.', '');
      openAuth('register');
      return;
    }

    const button = $('#publishButton');
    state.busy = true;
    button.disabled = true;
    uploadProgress.hidden = false;
    setProgress('Preparando sua figurinha', 4, false);
    showMessage('', '');
    try {
      const payload = await uploadCreation();
      setProgress('Publicada na vitrine', 100, false);
      renderResult(payload);
      uploadProgress.hidden = true;
    } catch (error) {
      uploadProgress.hidden = true;
      showMessage(error.message || 'Não foi possível publicar agora. Tente novamente.', 'error');
    } finally {
      state.busy = false;
      button.disabled = false;
    }
  });

  function safeMedia(value) {
    try {
      const url = new URL(String(value || ''), location.origin);
      if (url.origin !== location.origin || !/^\/figurinhas_creator\/[a-zA-Z0-9_-]+\.(?:webp|mp4)$/i.test(url.pathname)) return '';
      return url.href;
    } catch (_) {
      return '';
    }
  }

  function renderRows(target, rows, emptyText) {
    target.replaceChildren();
    if (!Array.isArray(rows) || rows.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'list-placeholder';
      empty.textContent = emptyText;
      target.appendChild(empty);
      target.setAttribute('aria-busy', 'false');
      return;
    }
    rows.slice(0, 5).forEach(row => {
      const item = document.createElement('article');
      item.className = 'community-item';
      const poster = safeMedia(row && row.posterUrl);
      if (poster) {
        const image = document.createElement('img');
        image.src = poster;
        image.alt = '';
        image.loading = 'lazy';
        image.width = 42;
        image.height = 42;
        item.appendChild(image);
      } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'community-placeholder';
        placeholder.textContent = 'F';
        placeholder.setAttribute('aria-hidden', 'true');
        item.appendChild(placeholder);
      }
      const copy = document.createElement('span');
      copy.className = 'community-item-copy';
      const title = document.createElement('b');
      title.textContent = String(row && row.title || 'Criação da comunidade');
      const creator = row && row.creator && (row.creator.displayName || row.creator.username) || 'criador';
      const count = Math.max(0, Number(row && row.purchases) || 0);
      const small = document.createElement('small');
      small.textContent = 'por ' + creator + ' · ' + (count === 1 ? '1 escolha' : count + ' escolhas');
      copy.append(title, small);
      item.appendChild(copy);
      const link = document.createElement('a');
      link.href = '/figurinhas';
      link.textContent = 'Ver';
      link.setAttribute('aria-label', 'Ver ' + String(row && row.title || 'a figurinha') + ' na vitrine');
      item.appendChild(link);
      target.appendChild(item);
    });
    target.setAttribute('aria-busy', 'false');
  }

  async function loadLists() {
    const rankList = $('#rankList');
    const latestList = $('#latestList');
    try {
      const [ranking, latest] = await Promise.all([
        api('/ranking?by=purchases'),
        api('/creations?limit=8')
      ]);
      renderRows(rankList, ranking.ranking || [], 'O ranking começa com a próxima criação.');
      renderRows(latestList, latest.creations || [], 'Sua criação pode inaugurar este espaço.');
    } catch (_) {
      renderRows(rankList, [], 'As criações aparecem aqui quando a comunidade está disponível.');
      renderRows(latestList, [], 'Você ainda pode preparar sua figurinha.');
    }
  }

  async function restoreSession() {
    if (!state.token) {
      setUser(null);
      return;
    }
    try {
      const data = await api('/auth/me');
      setUser(data.user);
    } catch (_) {
      state.token = '';
      try { localStorage.removeItem('fabi_creator_token'); } catch (_) { /* Ignora armazenamento bloqueado. */ }
      setUser(null);
    }
  }

  window.addEventListener('beforeunload', () => {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  });

  updateTextPreview();
  setUser(null);
  restoreSession();
  loadLists();
})();
