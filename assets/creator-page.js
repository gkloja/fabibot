(function () {
  'use strict';

  const API = '/api/creator';
  const $ = (selector, root = document) => root.querySelector(selector);
  const state = { token: '', user: null, objectUrl: '', file: null, duration: null, busy: false, returnFocus: null, mineRequest: 0, flowStep: 0, themeMode: 'system' };

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

  uploadProgress.addEventListener('cancel', event => event.preventDefault());

  function openUploadProgress() {
    uploadProgress.setAttribute('aria-busy', 'true');
    if (!uploadProgress.open) {
      if (typeof uploadProgress.showModal === 'function') uploadProgress.showModal();
      else uploadProgress.setAttribute('open', '');
    }
  }

  function closeUploadProgress() {
    uploadProgress.setAttribute('aria-busy', 'false');
    if (uploadProgress.open && typeof uploadProgress.close === 'function') uploadProgress.close();
    else uploadProgress.removeAttribute('open');
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
      $('#myCreationsGuest').hidden = false;
      $('#myCreationsPanel').hidden = true;
      $('#myCreationsList').replaceChildren();
      $('#myCreationsSummary').textContent = 'Entre na sua conta para carregar suas criações.';
      state.mineRequest += 1;
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
    $('#myCreationsGuest').hidden = true;
    $('#myCreationsPanel').hidden = false;
    loadMyCreations();
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
    else {
      const fallback = state.user ? $('#myCreationsRefresh') : $('#authOpenButton');
      if (fallback && !fallback.closest('[hidden]')) fallback.focus();
    }
  });

  const themeKey = 'fabi_sticker_theme_v1';
  const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme(mode) {
    state.themeMode = mode === 'light' || mode === 'dark' ? mode : 'system';
    const isDark = state.themeMode === 'dark' || (state.themeMode === 'system' && themeMedia.matches);
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    document.documentElement.dataset.themeMode = state.themeMode;
    const themeColor = $('#themeColorMeta');
    if (themeColor) themeColor.content = isDark ? '#0c130e' : '#f5f7ee';
    const labels = { system: 'Sistema', light: 'Claro', dark: 'Escuro' };
    const next = { system: 'claro', light: 'escuro', dark: 'sistema' }[state.themeMode];
    const toggle = $('#themeToggle');
    if (toggle) {
      $('#themeLabel').textContent = labels[state.themeMode];
      $('#themeIcon').textContent = { system: '◐', light: '☀', dark: '☾' }[state.themeMode];
      toggle.setAttribute('aria-label', 'Tema atual: ' + labels[state.themeMode].toLowerCase() + '. Clique para usar o tema ' + next + '.');
      toggle.title = 'Tema atual: ' + labels[state.themeMode] + ' · próximo: ' + next;
    }
  }

  function restoreTheme() {
    let saved = '';
    try { saved = localStorage.getItem(themeKey) || ''; } catch (_) { /* A preferência do dispositivo continua disponível. */ }
    applyTheme(saved === 'light' || saved === 'dark' ? saved : 'system');
  }

  $('#themeToggle').addEventListener('click', () => {
    const next = { system: 'light', light: 'dark', dark: 'system' }[state.themeMode];
    applyTheme(next);
    try { if (next === 'system') localStorage.removeItem(themeKey); else localStorage.setItem(themeKey, next); } catch (_) { /* A preferência ainda vale nesta visita. */ }
  });
  const onSystemThemeChange = () => { if (state.themeMode === 'system') applyTheme('system'); };
  if (typeof themeMedia.addEventListener === 'function') themeMedia.addEventListener('change', onSystemThemeChange);
  else if (typeof themeMedia.addListener === 'function') themeMedia.addListener(onSystemThemeChange);
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
      const nextMessage = !state.file || state.duration === null
        ? 'Conta conectada. Escolha um vídeo para começar; sua conta já está pronta para publicar.'
        : ($('#publishButton').disabled ? 'Conta conectada. Personalize o nome e a descrição para liberar a revisão.' : 'Conta conectada. Confira a etapa 3 e publique quando estiver pronto.');
      showMessage(nextMessage, 'success');
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

  function moveToStep(section, focusTarget) {
    if (focusTarget) focusTarget.focus({ preventScroll: true });
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    section.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }

  function updateFlow() {
    const videoReady = Boolean(state.file && state.duration !== null && Number.isFinite(state.duration) && state.duration > 0 && state.duration <= 10);
    if (!videoReady) state.flowStep = 1;
    if (![1, 2, 3].includes(state.flowStep)) state.flowStep = 1;

    const detailsStep = $('#detailsStep');
    const detailsOpen = videoReady && state.flowStep >= 2;
    detailsStep.hidden = !detailsOpen;
    detailsStep.disabled = !detailsOpen;
    const titleInput = $('#titleInput');
    const descriptionInput = $('#descriptionInput');
    const metadataReady = videoReady && detailsOpen && titleInput.validity.valid && descriptionInput.validity.valid && $('#categoryInput').validity.valid;
    if (state.flowStep === 3 && !metadataReady) state.flowStep = 2;
    const step = state.flowStep;
    const reviewReady = step === 3 && metadataReady;

    const previewCard = $('#videoPreviewCard');
    previewCard.hidden = !state.file;
    $('#previewEyebrow').textContent = reviewReady ? 'ETAPA 03 · REVISÃO' : 'PRÉVIA LOCAL';
    $('#previewTitle').textContent = reviewReady ? 'Confira sua figurinha' : 'Assista ao seu vídeo';
    $('#previewFootnote').textContent = reviewReady
      ? 'Esta prévia ainda é local. O vídeo só é enviado quando você publicar.'
      : 'Dê play para assistir e confira o áudio antes de continuar.';

    const continueToDetails = $('#continueToDetails');
    continueToDetails.hidden = !state.file || step !== 1;
    continueToDetails.disabled = !videoReady || state.busy;
    $('#detailsActions').hidden = !videoReady || step !== 2;
    $('#backToVideo').hidden = step !== 2;
    const continueToReview = $('#continueToReview');
    continueToReview.hidden = !videoReady || step !== 2;
    continueToReview.disabled = !metadataReady || state.busy;

    const reviewAside = $('#reviewAside');
    const publishStep = $('#publishStep');
    reviewAside.hidden = !reviewReady;
    publishStep.hidden = !reviewReady;
    $('#reviewAccountCard').hidden = !reviewReady;
    $('#reviewTipCard').hidden = !reviewReady;
    reviewAside.classList.toggle('is-unlocked', reviewReady);
    publishStep.classList.toggle('is-unlocked', reviewReady);
    $('#publishButton').disabled = !reviewReady || state.busy;

    document.querySelectorAll('[data-flow-step]').forEach(item => {
      const number = Number(item.dataset.flowStep);
      item.classList.toggle('is-current', number === step);
      item.classList.toggle('is-done', number < step);
      if (number === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    if (state.flowStep !== state.announcedFlowStep) {
      state.announcedFlowStep = state.flowStep;
      const labels = { 1: 'Etapa 1 de 3: escolha e confira o vídeo.', 2: 'Etapa 2 de 3: personalize sua figurinha.', 3: 'Etapa 3 de 3: revise e publique.' };
      $('#flowAnnouncer').textContent = labels[step];
    }
  }

  $('#continueToDetails').addEventListener('click', () => {
    if (!state.file || state.duration === null || state.duration > 10) return;
    state.flowStep = 2;
    updateFlow();
    moveToStep($('#detailsStep'), $('#detailsStepTitle'));
  });
  $('#backToVideo').addEventListener('click', () => {
    state.flowStep = 1;
    updateFlow();
    moveToStep($('#videoStep'), $('#videoStepTitle'));
  });
  $('#continueToReview').addEventListener('click', () => {
    if (!form.reportValidity()) return;
    state.flowStep = 3;
    updateFlow();
    moveToStep($('#reviewAside'), $('#publishTitle'));
  });
  $('#backToDetails').addEventListener('click', () => {
    state.flowStep = 2;
    updateFlow();
    moveToStep($('#detailsStep'), $('#detailsStepTitle'));
  });

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
      updateFlow();
    };
    preview.onerror = () => {
      state.duration = null;
      $('#fileMeta').textContent = 'Não foi possível confirmar a duração.';
      showMessage('Não foi possível abrir a prévia e confirmar a duração. Escolha outro vídeo ou tente outro navegador.', 'error');
      updateFlow();
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
    const bar = $('#progressBar');
    if (indeterminate) bar.removeAttribute('value');
    else bar.value = Math.max(0, Math.min(100, value));
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
        let invalidJson = false;
        try { payload = JSON.parse(request.responseText); } catch (_) { invalidJson = true; }
        const serverError = payload && typeof payload === 'object' && typeof payload.error === 'string'
          ? payload.error
          : 'Não foi possível publicar agora. Tente novamente.';
        if (request.status >= 200 && request.status < 300) {
          if (invalidJson || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
            reject(new Error('O servidor respondeu com dados inválidos. Seu vídeo continua preparado nesta página.'));
          } else if (payload.ok === false) {
            reject(new Error(serverError));
          } else resolve(payload);
        } else reject(new Error(serverError));
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

  function creatorIdentity(row) {
    const creator = row && row.creator && typeof row.creator === 'object' ? row.creator : {};
    const id = creator.id || creator.userId || creator.creatorId || creator._id || row.creatorId || row.userId || '';
    const handle = creator.handle || creator.username || row.creatorHandle || row.creatorUsername || '';
    const displayName = creator.displayName || creator.username || creator.handle || row.creatorName || '';
    if (id) return { key: 'id:' + String(id), name: String(displayName || handle || 'Criador Fabi'), creator };
    if (handle) return { key: 'handle:' + String(handle).trim().replace(/^@/, '').toLocaleLowerCase('pt-BR'), name: String(displayName || handle), creator };
    if (displayName) return { key: 'name:' + String(displayName).trim().toLocaleLowerCase('pt-BR'), name: String(displayName), creator };
    return null;
  }

  function renderHallOfFame(creationRows, rankingRows) {
    const target = $('#creatorHallList');
    const records = new Map();
    [...(Array.isArray(creationRows) ? creationRows : []), ...(Array.isArray(rankingRows) ? rankingRows : [])].forEach(row => {
      if (!row || typeof row !== 'object') return;
      const owner = creatorIdentity(row);
      if (!owner) return;
      const id = safeCreationId(row.id);
      const fallbackKey = owner.key + ':' + String(row.title || row.name || 'criação').trim().toLocaleLowerCase('pt-BR');
      const key = id ? 'creation:' + id : fallbackKey;
      const previous = records.get(key);
      const purchases = Math.max(0, Number(row.purchases) || 0);
      if (!previous) records.set(key, { row, owner, purchases });
      else {
        previous.purchases = Math.max(previous.purchases, purchases);
        if ((!previous.row.creator || !Object.keys(previous.row.creator).length) && row.creator) previous.row = row;
        const refreshedOwner = creatorIdentity(row);
        if (refreshedOwner && refreshedOwner.creator && Object.keys(refreshedOwner.creator).length) previous.owner = refreshedOwner;
      }
    });

    const creators = new Map();
    records.forEach(record => {
      const { row, owner, purchases } = record;
      let creator = creators.get(owner.key);
      if (!creator) {
        creator = { key: owner.key, name: owner.name, creations: 0, purchases: 0, points: null };
        creators.set(owner.key, creator);
      }
      creator.creations += 1;
      creator.purchases += purchases;
      const pointsValue = owner.creator.points ?? row.creatorPoints;
      const hasPointsValue = typeof pointsValue === 'number' || (typeof pointsValue === 'string' && pointsValue.trim() !== '');
      const points = hasPointsValue ? Number(pointsValue) : NaN;
      if (hasPointsValue && Number.isFinite(points) && points >= 0) {
        creator.points = creator.points === null ? points : Math.max(creator.points, points);
      }
    });

    const ranked = [...creators.values()];
    const everyoneHasPoints = ranked.length > 0 && ranked.every(creator => creator.points !== null);
    ranked.sort((a, b) => {
      if (everyoneHasPoints && b.points !== a.points) return b.points - a.points;
      return b.purchases - a.purchases || b.creations - a.creations || a.name.localeCompare(b.name, 'pt-BR');
    });

    target.replaceChildren();
    if (!ranked.length) {
      const empty = document.createElement('li');
      empty.className = 'hall-placeholder';
      empty.textContent = 'Os criadores aparecem aqui quando houver criações públicas disponíveis.';
      target.appendChild(empty);
      target.setAttribute('aria-busy', 'false');
      return;
    }

    ranked.slice(0, 3).forEach((creator, index) => {
      const item = document.createElement('li');
      item.className = 'hall-item' + (index === 0 ? ' is-first' : '');
      const rank = document.createElement('span');
      rank.className = 'hall-rank';
      rank.textContent = '#' + (index + 1);
      const avatar = document.createElement('span');
      avatar.className = 'hall-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = creator.name.trim().charAt(0).toLocaleUpperCase('pt-BR') || 'F';
      const copy = document.createElement('span');
      copy.className = 'hall-copy';
      const name = document.createElement('strong');
      name.textContent = creator.name;
      const details = document.createElement('small');
      const creationLabel = creator.creations === 1 ? '1 criação no recorte' : creator.creations + ' criações no recorte';
      const choiceLabel = creator.purchases === 1 ? '1 escolha contabilizada' : creator.purchases + ' escolhas contabilizadas';
      details.textContent = creationLabel + ' · ' + choiceLabel;
      copy.append(name, details);
      const points = document.createElement('span');
      points.className = 'hall-points';
      points.textContent = creator.points === null ? choiceLabel : creator.points.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' pontos';
      item.append(rank, avatar, copy, points);
      target.appendChild(item);
    });
    target.setAttribute('aria-busy', 'false');
  }

  function creatorOwns(row, user) {
    if (!row || !user) return false;
    const creator = row.creator && typeof row.creator === 'object' ? row.creator : {};
    const userIds = [user.id, user.userId, user.creatorId, user._id].filter(Boolean).map(String);
    const creatorIds = [creator.id, creator.userId, creator.creatorId, creator._id, row.creatorId, row.userId, row.ownerId].filter(Boolean).map(String);
    if (userIds.some(id => creatorIds.includes(id))) return true;
    const normalize = value => String(value || '').trim().replace(/^@/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
    const userHandles = [user.username, user.handle].map(normalize).filter(Boolean);
    const creatorHandles = [creator.username, creator.handle].map(normalize).filter(Boolean);
    return userHandles.some(handle => creatorHandles.includes(handle));
  }

  async function loadMyCreations() {
    const panel = $('#myCreationsPanel');
    const list = $('#myCreationsList');
    const summary = $('#myCreationsSummary');
    if (!state.user || !state.token) {
      panel.hidden = true;
      return;
    }
    const requestId = ++state.mineRequest;
    const tokenAtStart = state.token;
    const userAtStart = state.user;
    list.setAttribute('aria-busy', 'true');
    summary.textContent = 'Carregando suas criações…';
    list.replaceChildren();
    const loading = document.createElement('p');
    loading.className = 'list-placeholder';
    loading.textContent = 'Buscando sua coleção…';
    list.appendChild(loading);
    try {
      const data = await api('/my-creations');
      if (requestId !== state.mineRequest || tokenAtStart !== state.token || userAtStart !== state.user) return;
      const rows = (Array.isArray(data.creations) ? data.creations : [])
        .filter(row => safeCreationId(row && row.id) && creatorOwns(row, state.user))
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      const publishedRows = rows.filter(row => row.status === 'publicada');
      list.replaceChildren();
      const totalChoices = publishedRows.reduce((total, row) => total + Math.max(0, Number(row.purchases) || 0), 0);
      summary.textContent = publishedRows.length + (publishedRows.length === 1 ? ' figurinha publicada' : ' figurinhas publicadas') + ' · ' + totalChoices + (totalChoices === 1 ? ' escolha da comunidade' : ' escolhas da comunidade');
      if (!rows.length) {
        const empty = document.createElement('p');
        empty.className = 'list-placeholder';
        empty.textContent = 'Ainda não há criações publicadas nesta conta. Quando publicar, elas ficam reunidas aqui.';
        list.appendChild(empty);
        return;
      }

      rows.forEach(row => {
        const item = document.createElement('article');
        item.className = 'my-creation';
        const poster = safeMedia(row.posterUrl);
        if (poster) {
          const image = document.createElement('img');
          image.className = 'my-creation-poster';
          image.src = poster;
          image.alt = '';
          image.loading = 'lazy';
          image.width = 54;
          image.height = 54;
          item.appendChild(image);
        } else {
          const placeholder = document.createElement('span');
          placeholder.className = 'my-creation-placeholder';
          placeholder.textContent = 'F';
          placeholder.setAttribute('aria-hidden', 'true');
          item.appendChild(placeholder);
        }

        const copy = document.createElement('span');
        copy.className = 'my-creation-copy';
        const title = document.createElement('strong');
        title.textContent = String(row.title || 'Figurinha da comunidade');
        const choices = Math.max(0, Number(row.purchases) || 0);
        const metaParts = [choices + (choices === 1 ? ' escolha' : ' escolhas')];
        const createdAt = Date.parse(row.createdAt || '');
        if (Number.isFinite(createdAt)) metaParts.push(new Date(createdAt).toLocaleDateString('pt-BR'));
        const meta = document.createElement('small');
        meta.textContent = metaParts.join(' · ');
        copy.append(title, meta);
        item.appendChild(copy);

        const actions = document.createElement('span');
        actions.className = 'my-creation-actions';
        const status = document.createElement('span');
        status.className = 'my-creation-status';
        status.setAttribute('role', 'status');
        if (row.claimed === true) {
          status.classList.add('is-claimed');
          status.textContent = 'Resgatada';
        } else if (row.claimPending === true) {
          status.textContent = 'Resgate em processamento';
        } else if (row.status === 'publicada' && row.claimed === false) {
          const claim = document.createElement('button');
          claim.className = 'my-creation-action';
          claim.type = 'button';
          claim.textContent = 'Resgatar no WhatsApp ↗';
          claim.addEventListener('click', () => claimMyCreation(claim, row.id));
          actions.appendChild(claim);
          status.textContent = '';
        } else {
          status.textContent = row.status === 'publicada' ? 'Resgate indisponível' : 'Aguardando publicação';
        }
        actions.appendChild(status);
        item.appendChild(actions);
        list.appendChild(item);
      });
    } catch (error) {
      if (requestId !== state.mineRequest || tokenAtStart !== state.token || userAtStart !== state.user) return;
      list.replaceChildren();
      summary.textContent = 'Não foi possível carregar sua coleção.';
      const message = document.createElement('p');
      message.className = 'list-placeholder';
      message.textContent = error.message || 'Tente atualizar a lista em instantes.';
      list.appendChild(message);
    } finally {
      if (requestId === state.mineRequest) list.setAttribute('aria-busy', 'false');
    }
  }

  async function claimMyCreation(button, creationId) {
    const id = safeCreationId(creationId);
    if (!id || !state.user || !state.token) {
      openAuth('login');
      return;
    }
    const status = button.closest('.my-creation')?.querySelector('.my-creation-status');
    button.disabled = true;
    button.textContent = 'Preparando WhatsApp…';
    if (status) status.textContent = '';
    try {
      if (!window.FabiStickerApi || typeof window.FabiStickerApi.creatorClaimLink !== 'function') throw new Error('O serviço de resgate não está disponível. Atualize a página e tente novamente.');
      const data = await window.FabiStickerApi.creatorClaimLink(id, state.token);
      const claimUrl = String(data.claimUrl || '').trim();
      if (!claimUrl) throw new Error('O servidor não retornou um link de resgate. Tente novamente.');
      const target = new URL(claimUrl, location.href);
      const whatsappHttpsHosts = new Set(['wa.me', 'api.whatsapp.com', 'web.whatsapp.com', 'whatsapp.com', 'www.whatsapp.com']);
      const safeHttps = target.protocol === 'https:' && !target.port && whatsappHttpsHosts.has(target.hostname.toLowerCase());
      const safeAppLink = target.protocol === 'whatsapp:' && target.hostname.toLowerCase() === 'send' && !target.port && (!target.pathname || target.pathname === '/');
      if ((!safeHttps && !safeAppLink) || target.username || target.password) throw new Error('O link de resgate retornado não é seguro.');
      location.assign(target.href);
    } catch (error) {
      if (status) status.textContent = error.message || 'Não foi possível gerar o link de resgate.';
      button.disabled = false;
      button.textContent = 'Tentar resgate novamente';
    }
  }

  $('#myCreationsRefresh').addEventListener('click', loadMyCreations);
  $('#myCreationsSignIn').addEventListener('click', () => openAuth('login'));

  window.addEventListener('storage', event => {
    if (event.key === themeKey) applyTheme(event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : 'system');
    if (event.key !== 'fabi_creator_token') return;
    state.token = String(event.newValue || '');
    if (state.token) restoreSession();
    else setUser(null);
  });

  function renderResult(payload) {
    try { sessionStorage.setItem('fabiCreatorPublished', '1'); } catch (_) { /* The catalog refreshes normally on navigation if storage is unavailable. */ }
    const resultId = safeCreationId(payload && payload.creation && payload.creation.id);
    formMessage.replaceChildren();
    formMessage.className = 'form-message is-success';
    formMessage.hidden = false;
    const success = document.createElement('strong');
    success.textContent = 'Publicada na vitrine. ';
    formMessage.append(success, document.createTextNode('Sua criação já entrou para a comunidade. Agora você pode resgatá-la no WhatsApp.'));
    let claimButton = null;
    if (resultId) {
      claimButton = document.createElement('button');
      claimButton.className = 'button button-primary';
      claimButton.type = 'button';
      claimButton.style.marginTop = '10px';
      claimButton.textContent = 'Resgatar no WhatsApp ↗';
      claimButton.addEventListener('click', () => claimCreation(claimButton, resultId));
      const claimStatus = document.createElement('small');
      claimStatus.id = 'claimStatus';
      claimStatus.className = 'claim-status';
      claimStatus.setAttribute('role', 'status');
      claimStatus.setAttribute('aria-live', 'polite');
      formMessage.append(document.createElement('br'), claimButton, claimStatus);
    } else {
      const link = document.createElement('a');
      link.className = 'text-link';
      link.href = '#myCreationsSection';
      link.textContent = 'Ir para minha coleção e ver o resgate ↘';
      link.style.display = 'inline-block';
      link.style.marginTop = '10px';
      formMessage.append(document.createElement('br'), link);
    }
    form.reset();
    clearVideo();
    updateTextPreview();
    loadLists();
    const collectionLoad = loadMyCreations();
    return { claimButton, collectionLoad };
  }

  async function focusPublishedAction(result) {
    if (result.claimButton) {
      moveToStep(formMessage, result.claimButton);
      return;
    }
    await result.collectionLoad;
    const claimButton = $('#myCreationsList .my-creation-action');
    const section = $('#myCreationsSection');
    moveToStep(section, claimButton || $('#myCreationsTitle'));
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (state.busy) return;
    if (state.flowStep !== 3) {
      if (state.flowStep === 2) form.reportValidity();
      return;
    }
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
    openUploadProgress();
    setProgress('Preparando sua figurinha', 4, false);
    showMessage('', '');
    let publishedResult = null;
    try {
      const payload = await uploadCreation();
      setProgress('Publicada na vitrine', 100, false);
      publishedResult = renderResult(payload);
    } catch (error) {
      showMessage(error.message || 'Não foi possível publicar agora. Tente novamente.', 'error');
      moveToStep(formMessage, formMessage);
    } finally {
      closeUploadProgress();
      state.busy = false;
      updateFlow();
    }
    if (publishedResult) await focusPublishedAction(publishedResult);
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
        api('/creations?limit=60')
      ]);
      const creations = Array.isArray(latest.creations) ? latest.creations : [];
      const rankedCreations = Array.isArray(ranking.ranking) ? ranking.ranking : [];
      renderHallOfFame(creations, rankedCreations);
      renderRows(rankList, ranking.ranking || [], 'O ranking começa com a próxima criação.');
      renderRows(latestList, creations.slice(0, 8), 'Sua criação pode inaugurar este espaço.');
    } catch (_) {
      const hall = $('#creatorHallList');
      hall.replaceChildren();
      const unavailable = document.createElement('li');
      unavailable.className = 'hall-placeholder';
      unavailable.textContent = 'O Hall da Fama está temporariamente indisponível. Tente novamente em instantes.';
      hall.appendChild(unavailable);
      hall.setAttribute('aria-busy', 'false');
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

  restoreTheme();
  updateTextPreview();
  setUser(null);
  restoreSession();
  loadLists();
})();
