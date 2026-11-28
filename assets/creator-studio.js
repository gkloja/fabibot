(function () {
  'use strict';

  const API = '/api/creator';
  const $ = selector => document.querySelector(selector);
  window.addEventListener('pageshow', () => {
    try {
      if (sessionStorage.getItem('fabiCreatorPublished') !== '1') return;
      sessionStorage.removeItem('fabiCreatorPublished');
      window.dispatchEvent(new Event('fabi-creator-published'));
    } catch (_) { /* The page's initial catalog fetch remains the fallback. */ }
  });
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const validCreationId = value => {
    const id = String(value || '').trim();
    return /^[a-zA-Z0-9_-]{1,100}$/.test(id) ? id : '';
  };
  const normalizeHandle = value => String(value || '')
    .trim().replace(/^@/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const motionAllowed = () => !matchMedia('(prefers-reduced-motion: reduce)').matches && !(navigator.connection && navigator.connection.saveData);

  const hub = $('#fabiCreator');
  const account = $('#creatorAccountCard');
  const uploadCard = $('#creatorUploadCard');
  const accountMessage = $('#creatorMessage');
  const uploadMessage = $('#creatorUploadMessage');
  const mineCard = $('#creatorMineCard');
  const mineList = $('#creatorMineList');
  const rank = $('#creatorRank');
  if (!hub || !account || !uploadCard || !accountMessage || !uploadMessage || !mineCard || !mineList || !rank) return;

  const state = { token: '', user: null, videoObjectUrl: '', mineRequest: 0, returnFocus: null };
  try { state.token = localStorage.getItem('fabi_creator_token') || ''; } catch (_) { /* Storage is optional. */ }

  function setExpanded(open) {
    ['#creatorProfileButton'].forEach(selector => {
      const trigger = $(selector);
      if (trigger) trigger.setAttribute('aria-expanded', String(open));
    });
  }

  function toggleHub(open) {
    if (open) {
      if (!hub.open) {
        state.returnFocus = document.activeElement;
        hub.showModal();
      }
      document.body.classList.add('modal-open');
      setExpanded(true);
      $('#creatorClose')?.focus();
      if (state.user) loadMineCreations();
      return;
    }
    if (hub.open) hub.close();
  }

  function syncModalLock() {
    const anyDialogOpen = document.querySelector('dialog[open]');
    document.body.classList.toggle('modal-open', Boolean(anyDialogOpen));
  }

  hub.addEventListener('close', () => {
    setExpanded(false);
    syncModalLock();
    if (state.returnFocus && state.returnFocus.isConnected) state.returnFocus.focus();
  });
  hub.addEventListener('click', event => {
    if (event.target !== hub) return;
    const rect = hub.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) toggleHub(false);
  });
  $('#creatorProfileButton')?.addEventListener('click', () => toggleHub(true));
  $('#creatorClose')?.addEventListener('click', () => toggleHub(false));

  function showMessage(text, kind = '') {
    const target = state.user ? uploadMessage : accountMessage;
    [accountMessage, uploadMessage].forEach(node => {
      node.classList.add('creator-hidden');
      node.textContent = '';
      node.classList.remove('error', 'ok');
    });
    target.textContent = String(text || '');
    target.classList.remove('creator-hidden');
    if (kind) target.classList.add(kind);
  }

  function setUser(user) {
    state.user = user && typeof user === 'object' ? user : null;
    window.dispatchEvent(new CustomEvent('fabi-creator-auth-changed', { detail: state.user }));
    const headerAvatar = $('#headerCreatorAvatar');
    const headerLabel = $('#headerCreatorLabel');

    if (!state.user) {
      uploadCard.classList.add('creator-hidden');
      account.classList.remove('creator-hidden');
      mineCard.classList.add('creator-hidden');
      if (headerAvatar) headerAvatar.src = './assets/fabi-logo.webp';
      if (headerLabel) headerLabel.textContent = 'Meu perfil';
      return;
    }

    const username = state.user.username || state.user.handle || 'criador';
    account.classList.add('creator-hidden');
    uploadCard.classList.remove('creator-hidden');
    mineCard.classList.remove('creator-hidden');
    $('#creatorProfileName').textContent = '@' + username;
    $('#creatorProfilePoints').textContent = (Number(state.user.points) || 0) + ' pontos · suas criações ficam neste estúdio';
    $('#creatorAvatar').src = state.user.avatarUrl || './assets/fabi-logo.webp';
    if (headerAvatar) headerAvatar.src = state.user.avatarUrl || './assets/fabi-logo.webp';
    if (headerLabel) headerLabel.textContent = '@' + username;
    loadMineCreations();
  }

  async function api(path, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    if (state.token) headers.Authorization = 'Bearer ' + state.token;
    const response = await fetch(API + path, Object.assign({}, options, { headers, cache: 'no-store' }));
    const data = await response.json().catch(() => ({ error: 'Resposta inválida do servidor.' }));
    if (!response.ok || data.ok === false) throw new Error(data.error || 'Não foi possível concluir.');
    return data;
  }

  document.querySelectorAll('[data-creator-tab]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-creator-tab]').forEach(tab => {
        const selected = tab === button;
        tab.classList.toggle('active', selected);
        tab.setAttribute('aria-pressed', String(selected));
        tab.setAttribute('aria-selected', String(selected));
      });
      $('#creatorRegister').classList.toggle('creator-hidden', button.dataset.creatorTab !== 'register');
      $('#creatorLogin').classList.toggle('creator-hidden', button.dataset.creatorTab !== 'login');
      accountMessage.classList.add('creator-hidden');
    });
  });

  async function authenticate(form, mode) {
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const payload = Object.fromEntries(new FormData(form));
      const data = await api('/auth/' + mode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!data.token || !data.user) throw new Error('A sessão do criador não foi retornada. Tente novamente.');
      state.token = String(data.token);
      try { localStorage.setItem('fabi_creator_token', state.token); } catch (_) { /* Session still works for this tab. */ }
      setUser(data.user);
      showMessage('Tudo certo. Seu estúdio está pronto.', 'ok');
    } catch (error) {
      showMessage(error.message || 'Não foi possível entrar.', 'error');
    } finally {
      submit.disabled = false;
    }
  }

  $('#creatorRegister')?.addEventListener('submit', event => {
    event.preventDefault();
    authenticate(event.currentTarget, 'register');
  });
  $('#creatorLogin')?.addEventListener('submit', event => {
    event.preventDefault();
    authenticate(event.currentTarget, 'login');
  });
  $('#creatorLogout')?.addEventListener('click', () => {
    state.token = '';
    try { localStorage.removeItem('fabi_creator_token'); } catch (_) { /* Storage is optional. */ }
    setUser(null);
    showMessage('Você saiu da conta.', '');
  });

  $('#creatorAvatarInput')?.addEventListener('change', async event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showMessage('A foto precisa ter até 5 MB.', 'error');
      event.target.value = '';
      return;
    }
    const form = new FormData();
    form.append('avatar', file);
    try {
      const data = await api('/auth/avatar', { method: 'POST', body: form });
      setUser(data.user);
      showMessage('Foto de perfil atualizada.', 'ok');
    } catch (error) {
      showMessage(error.message || 'Não foi possível atualizar a foto.', 'error');
    } finally {
      event.target.value = '';
    }
  });

  const videoInput = $('#creatorVideo');
  const videoPreview = $('#creatorVideoPreview');
  const videoPreviewWrap = $('#creatorVideoPreviewWrap');
  const videoPreviewMeta = $('#creatorVideoPreviewMeta');

  function clearVideoPreview() {
    if (state.videoObjectUrl) URL.revokeObjectURL(state.videoObjectUrl);
    state.videoObjectUrl = '';
    if (videoPreview) {
      videoPreview.pause();
      videoPreview.removeAttribute('src');
      videoPreview.load();
    }
    if (videoPreviewWrap) videoPreviewWrap.hidden = true;
    if (videoPreviewMeta) videoPreviewMeta.textContent = '';
  }

  videoInput?.addEventListener('change', () => {
    clearVideoPreview();
    const file = videoInput.files && videoInput.files[0];
    if (!file) return;
    if (file.size > 24 * 1024 * 1024) {
      videoInput.value = '';
      showMessage('O vídeo precisa ter até 24 MB.', 'error');
      return;
    }

    state.videoObjectUrl = URL.createObjectURL(file);
    videoPreview.src = state.videoObjectUrl;
    videoPreviewWrap.hidden = false;
    videoPreviewMeta.textContent = file.name + ' · ' + (file.size / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB · verificando duração';
    videoPreview.onloadedmetadata = () => {
      if (videoPreview.duration > 10.05) {
        videoInput.value = '';
        clearVideoPreview();
        showMessage('O vídeo precisa ter no máximo 10 segundos.', 'error');
        return;
      }
      const seconds = Math.max(0, videoPreview.duration || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
      videoPreviewMeta.textContent = file.name + ' · ' + seconds + ' s · até 24 MB';
    };
    videoPreview.onerror = () => {
      videoPreviewMeta.textContent = 'Prévia indisponível. Você ainda pode tentar publicar o arquivo.';
    };
  });

  function updateProgress(label, value, indeterminate) {
    const wrapper = $('#creatorProgress');
    wrapper.classList.remove('creator-hidden');
    $('#creatorProgressLabel').textContent = label;
    $('#creatorProgressPercent').textContent = indeterminate ? '…' : Math.round(value) + '%';
    $('#creatorProgressBar').value = indeterminate ? 78 : Math.max(0, value);
    $('#creatorProgressBar').classList.toggle('indeterminate', Boolean(indeterminate));
  }

  function uploadCreation(form) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', API + '/creations');
      if (state.token) request.setRequestHeader('Authorization', 'Bearer ' + state.token);
      request.upload.onprogress = event => {
        if (event.lengthComputable) updateProgress('Enviando seu vídeo', Math.min(72, event.loaded / event.total * 72), false);
      };
      request.upload.onload = () => updateProgress('Finalizando a figurinha', 78, true);
      request.onload = () => {
        let data = {};
        try { data = JSON.parse(request.responseText); } catch (_) { /* Report the status below. */ }
        if (request.status >= 200 && request.status < 300 && data.ok !== false) resolve(data);
        else reject(new Error(data.error || 'Não foi possível publicar agora.'));
      };
      request.onerror = () => reject(new Error('A conexão foi interrompida.'));
      request.send(new FormData(form));
    });
  }

  function renderUploadResult(data) {
    const result = $('#creatorResult');
    result.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = 'Figurinha publicada na comunidade.';
    const note = document.createElement('span');
    note.className = 'creator-result-note';
    const creationId = validCreationId(data && data.creation && data.creation.id);
    note.textContent = creationId
      ? 'Abra o WhatsApp da Fabi pelo botão abaixo. O resgate também fica em “Minhas criações”.'
      : 'A figurinha foi publicada. Consulte “Minhas criações” para verificar as opções de resgate.';
    result.append(title, note);

    if (creationId) {
      const claimButton = document.createElement('button');
      claimButton.className = 'creator-claim';
      claimButton.type = 'button';
      claimButton.textContent = 'Resgatar no WhatsApp';
      claimButton.addEventListener('click', () => claimCreation(claimButton, creationId));
      result.append(claimButton);
    }
    result.classList.remove('creator-hidden');
  }

  $('#creatorUploadForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!state.token || !state.user) {
      showMessage('Entre na sua conta de criador para publicar.', 'error');
      return;
    }
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    $('#creatorResult').classList.add('creator-hidden');
    try {
      updateProgress('Preparando seu estúdio', 4, false);
      const data = await uploadCreation(form);
      updateProgress('Publicada na vitrine', 100, false);
      renderUploadResult(data);
      form.reset();
      clearVideoPreview();
      window.dispatchEvent(new Event('fabi-creator-published'));
      loadMineCreations();
      loadRank();
      showMessage('Sua figurinha entrou na vitrine. Toque em “Resgatar no WhatsApp” para continuar.', 'ok');
    } catch (error) {
      showMessage(error.message || 'Não foi possível publicar agora.', 'error');
    } finally {
      submit.disabled = false;
    }
  });

  function safeCreatorMedia(value) {
    try {
      const url = new URL(String(value || ''), location.origin);
      if (url.origin !== location.origin) return '';
      if (!/^\/figurinhas_creator\/[a-zA-Z0-9_-]+\.(?:webp|mp4)$/i.test(url.pathname)) return '';
      return url.href;
    } catch (_) {
      return '';
    }
  }

  function creatorOwns(row, user) {
    if (!row || !user) return false;
    const creator = row.creator && typeof row.creator === 'object' ? row.creator : {};
    const userIds = [user.id, user.userId, user.creatorId, user._id].filter(Boolean).map(String);
    const creatorIds = [creator.id, creator.userId, creator.creatorId, creator._id, row.creatorId, row.userId, row.ownerId].filter(Boolean).map(String);
    if (userIds.some(id => creatorIds.includes(id))) return true;
    const userHandles = [user.username, user.handle].map(normalizeHandle).filter(Boolean);
    const creatorHandles = [creator.username, creator.handle].map(normalizeHandle).filter(Boolean);
    return userHandles.some(handle => creatorHandles.includes(handle));
  }

  async function loadMineCreations() {
    if (!state.user || !state.token) {
      mineCard.classList.add('creator-hidden');
      return;
    }
    const requestId = ++state.mineRequest;
    const tokenAtStart = state.token;
    const userAtStart = state.user;
    mineCard.classList.remove('creator-hidden');
    mineList.setAttribute('aria-busy', 'true');
    mineList.innerHTML = '<p class="creator-muted">Carregando suas criações…</p>';
    try {
      const data = await api('/my-creations');
      if (requestId !== state.mineRequest || tokenAtStart !== state.token || userAtStart !== state.user) return;
      const rows = (Array.isArray(data.creations) ? data.creations : [])
        .filter(row => validCreationId(row && row.id) && creatorOwns(row, state.user))
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      if (!rows.length) {
        mineList.innerHTML = '<p class="creator-muted creator-mine__empty">Todas as suas criações aparecem aqui. O resgate fica disponível após a publicação e só enquanto a figurinha não tiver sido recebida.</p>';
        return;
      }
      mineList.innerHTML = rows.map(row => {
        const id = validCreationId(row.id);
        const title = escapeHTML(row.title || 'Figurinha da comunidade');
        const poster = safeCreatorMedia(row.posterUrl);
        const image = poster
          ? '<img src="' + escapeHTML(poster) + '" alt="" loading="lazy" width="56" height="56">'
          : '<span class="creator-mine__placeholder" aria-hidden="true">F</span>';
        let action = '<span class="creator-mine__status">Status indisponível</span>';
        if (row.claimed === true) {
          action = '<button class="creator-mine__claim is-claimed" type="button" disabled aria-disabled="true" aria-label="Esta figurinha já foi resgatada">Resgatada</button>';
        } else if (row.claimPending === true) {
          action = '<button class="creator-mine__claim is-pending" type="button" disabled aria-disabled="true" aria-label="O resgate desta figurinha está sendo processado">Processando</button>';
        } else if (row.status === 'publicada' && row.claimed === false) {
          action = '<button class="creator-mine__claim" type="button" data-creator-claim="' + escapeHTML(id) + '" aria-label="Resgatar ' + title + ' no WhatsApp">Resgatar <span aria-hidden="true">↗</span></button>';
        } else {
          const statusLabel = row.status === 'publicada' ? 'Resgate indisponível' : 'Aguardando publicação';
          action = '<span class="creator-mine__status">' + escapeHTML(statusLabel) + '</span>';
        }
        const count = Math.max(0, Number(row.purchases) || 0);
        const purchaseText = count === 1 ? '1 escolha' : count + ' escolhas';
        return '<article class="creator-mine__item">' + image + '<div class="creator-mine__copy"><strong title="' + title + '">' + title + '</strong><small>' + escapeHTML(purchaseText) + '</small></div>' + action + '</article>';
      }).join('');
    } catch (error) {
      if (requestId !== state.mineRequest) return;
      mineList.innerHTML = '<p class="creator-muted">' + escapeHTML(error.message || 'Não foi possível carregar suas criações.') + '</p><button class="creator-mine__refresh" type="button" data-refresh-mine="true">Tentar novamente</button>';
    } finally {
      if (requestId === state.mineRequest) mineList.setAttribute('aria-busy', 'false');
    }
  }

  async function claimCreation(button, creationId) {
    const id = validCreationId(creationId);
    if (!id || !state.user || !state.token) {
      showMessage('Entre na conta que criou a figurinha para resgatá-la.', 'error');
      return;
    }
    const originalLabel = button.innerHTML;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Preparando…';
    try {
      if (!window.FabiStickerApi || typeof window.FabiStickerApi.creatorClaimLink !== 'function') {
        throw new Error('O serviço de resgate não está disponível. Atualize a página e tente novamente.');
      }
      const data = await window.FabiStickerApi.creatorClaimLink(id, state.token);
      const claimUrl = String(data.claimUrl || '').trim();
      if (!claimUrl) throw new Error('O servidor não retornou um link de recebimento. Tente novamente.');
      const target = new URL(claimUrl, location.href);
      const whatsappHttpsHosts = new Set(['wa.me', 'api.whatsapp.com', 'web.whatsapp.com', 'whatsapp.com', 'www.whatsapp.com']);
      const safeHttps = target.protocol === 'https:' && !target.port && whatsappHttpsHosts.has(target.hostname.toLowerCase());
      const safeAppLink = target.protocol === 'whatsapp:' && target.hostname.toLowerCase() === 'send' && !target.port && (!target.pathname || target.pathname === '/');
      if ((!safeHttps && !safeAppLink) || target.username || target.password) {
        throw new Error('O link de recebimento retornado não é seguro.');
      }
      window.dispatchEvent(new Event('fabi-creator-claim-started'));
      // Navegar na mesma aba mantém o gesto do usuário válido em navegadores móveis.
      location.assign(target.href);
    } catch (error) {
      showMessage(error.message || 'Não foi possível gerar o link de recebimento.', 'error');
      await loadMineCreations();
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.innerHTML = originalLabel;
    }
  }

  mineList.addEventListener('click', event => {
    const claimButton = event.target.closest('[data-creator-claim]');
    if (claimButton) {
      claimCreation(claimButton, claimButton.dataset.creatorClaim);
      return;
    }
    if (event.target.closest('[data-refresh-mine]')) loadMineCreations();
  });
  $('#creatorMineRefresh')?.addEventListener('click', loadMineCreations);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && hub.open && state.user) loadMineCreations();
  });
  window.addEventListener('storage', event => {
    if (event.key !== 'fabi_creator_token') return;
    state.token = String(event.newValue || '');
    if (state.token) restoreSession();
    else setUser(null);
  });

  async function loadRank() {
    rank.setAttribute('aria-busy', 'true');
    try {
      const data = await api('/ranking?by=purchases');
      const rows = Array.isArray(data.ranking) ? data.ranking.slice(0, 5) : [];
      rank.innerHTML = rows.map((row, index) => {
        const id = validCreationId(row && row.id);
        if (!id) return '';
        const title = escapeHTML(row.title || 'Criação da comunidade');
        const creator = escapeHTML(row.creator && (row.creator.displayName || row.creator.username) || 'criador');
        const poster = safeCreatorMedia(row.posterUrl);
        const video = safeCreatorMedia(row.videoUrl);
        const thumbnail = video && motionAllowed()
          ? '<video class="creator-rank__video" src="' + escapeHTML(video) + '" poster="' + escapeHTML(poster) + '" autoplay loop muted playsinline preload="metadata" aria-hidden="true" data-rank-video></video>'
          : poster ? '<img src="' + escapeHTML(poster) + '" alt="" loading="lazy" width="44" height="44">' : '<span class="creator-rank__placeholder" aria-hidden="true">F</span>';
        const purchases = Math.max(0, Number(row.purchases) || 0);
        const label = purchases === 1 ? '1 escolha' : purchases + ' escolhas';
        return '<article class="creator-rank__item creator-rank__item--action"><strong class="rank-number">0' + (index + 1) + '</strong>' + thumbnail + '<div class="creator-rank__main"><b>' + title + '</b><small>por ' + creator + ' · ' + escapeHTML(label) + '</small></div><div class="creator-rank__actions"><button type="button" class="rank-view-button" data-action="preview" data-id="creator_' + escapeHTML(id) + '">Ver</button></div></article>';
      }).join('') || '<span class="creator-muted">O ranking começa com a sua criação.</span>';
      rank.querySelectorAll('[data-rank-video]').forEach(video => {
        video.addEventListener('error', () => {
          const poster = video.getAttribute('poster');
          if (poster) {
            const image = document.createElement('img');
            image.src = poster;
            image.alt = '';
            image.loading = 'lazy';
            video.replaceWith(image);
          } else {
            video.replaceWith(document.createTextNode('Prévia indisponível'));
          }
        }, { once: true });
        video.play().catch(() => {});
      });
    } catch (_) {
      rank.innerHTML = '<span class="creator-muted">Ranking indisponível agora.</span>';
    } finally {
      rank.setAttribute('aria-busy', 'false');
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
      try { localStorage.removeItem('fabi_creator_token'); } catch (_) { /* Storage is optional. */ }
      setUser(null);
    }
  }

  restoreSession();
  loadRank();
})();
