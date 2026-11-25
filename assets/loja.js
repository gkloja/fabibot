(function () {
  'use strict';
  const api = window.FabiStickerApi;
  const config = window.FABI_FIGURINHAS_CONFIG;
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const icon = name => '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  const fold = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const favoritesKey = 'fabi_sticker_favorites_v1';
  const state = { items: [], index: {}, filter: 'all', query: '', category: 'all', sort: 'recent', limit: config.pageSize, favorites: new Set(), current: null, source: 'loading', loading: false, activeTab: 'preview', toastTimer: null, lastFocused: null, downloadBusy: false, previewGeneration: 0, mediaGeneration: 0, audioSource: '', downloadToken: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(favoritesKey) || '[]');
    if (Array.isArray(saved)) state.favorites = new Set(saved.filter(id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id)).slice(0, 2000));
  } catch (_) { /* Local storage may be disabled. The gallery still works. */ }

  function toast(message) {
    clearTimeout(state.toastTimer);
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = message;
    $('#toastStack').replaceChildren(node);
    state.toastTimer = setTimeout(() => $('#toastStack').replaceChildren(), 4200);
  }

  function updateSavedCount() {
    $('#savedCount').textContent = String(state.favorites.size);
    $('#savedButton').setAttribute('aria-pressed', String(state.filter === 'favorites'));
    if (state.current) {
      const isSaved = state.favorites.has(state.current.id);
      $('#previewSave').setAttribute('aria-pressed', String(isSaved));
      $('#previewSave').innerHTML = icon('heart') + (isSaved ? 'Salva nas favoritas' : 'Salvar nas favoritas');
    }
  }

  function toggleFavorite(id) {
    if (state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
    let persisted = true;
    try { localStorage.setItem(favoritesKey, JSON.stringify([...state.favorites])); }
    catch (_) { persisted = false; }
    updateSavedCount();
    if (state.filter === 'favorites') render();
    else document.querySelectorAll('.card-save').forEach(button => {
      const isSaved = state.favorites.has(button.dataset.id);
      button.setAttribute('aria-pressed', String(isSaved));
      button.setAttribute('aria-label', (isSaved ? 'Remover ' : 'Salvar ') + button.dataset.name + (isSaved ? ' das favoritas' : ' nas favoritas'));
    });
    toast(persisted ? (state.favorites.has(id) ? 'Figurinha salva nas favoritas.' : 'Figurinha removida das favoritas.') : 'Favorita salva só nesta visita. O navegador bloqueou o armazenamento.');
  }

  function filteredItems() {
    const query = fold(state.query.trim());
    return state.items.filter(item => {
      if (state.filter === 'audio' && !item.temAudio) return false;
      if (state.filter === 'animated' && !item.isAnimated) return false;
      if (state.filter === 'favorites' && !state.favorites.has(item.id)) return false;
      if (state.category !== 'all' && item.categoria !== state.category) return false;
      return !query || fold([item.nome, item.id, ...item.tags].join(' ')).includes(query);
    }).sort((a, b) => {
      if (state.sort === 'name') return a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true });
      const dateA = Date.parse(a.criadoEm) || 0;
      const dateB = Date.parse(b.criadoEm) || 0;
      const dateDiff = state.sort === 'oldest' ? dateA - dateB : dateB - dateA;
      return dateDiff || a.id.localeCompare(b.id, 'pt-BR', { numeric: true });
    });
  }

  function fallbackHTML(message) {
    return '<span class="media-fallback">' + icon('play') + '<span>' + escape(message) + '</span></span>';
  }

  function bindImageFallbacks(scope) {
    scope.querySelectorAll('img[data-sticker-id]').forEach(image => {
      image.addEventListener('error', () => {
        const item = state.items.find(entry => entry.id === image.dataset.stickerId);
        if (item && !image.dataset.retried && state.source === 'live') {
          image.dataset.retried = '1';
          image.src = api.mediaUrl(item);
        } else {
          image.replaceWith(Object.assign(document.createElement('span'), { className: 'media-fallback', textContent: 'Prévia indisponível. Abra para ver as opções.' }));
        }
      });
    });
  }

  function cardHTML(item) {
    const media = api.staticMedia(item, state.index);
    const image = media.poster || (state.source === 'live' ? api.mediaUrl(item) : '');
    const isSaved = state.favorites.has(item.id);
    const price = item.priceCents === 0 ? 'GRÁTIS' : item.priceCents === null ? 'PRÉVIA' : 'PAGO';
    return '<article class="sticker-card" data-id="' + escape(item.id) + '">' +
      '<button class="card-preview" type="button" data-action="preview" data-id="' + escape(item.id) + '" aria-label="Ver prévia de ' + escape(item.nome) + '"' + (media.preview ? ' data-preview="' + escape(media.preview) + '"' : '') + '>' +
      (image ? '<img src="' + escape(image) + '" alt="' + escape(item.nome) + '" width="360" height="360" loading="lazy" decoding="async" data-sticker-id="' + escape(item.id) + '">' : fallbackHTML('Prévia disponível apenas pelo backend.')) +
      '<span class="card-play">' + icon('play') + 'Ver prévia</span></button>' +
      '<button class="card-save" type="button" data-action="favorite" data-id="' + escape(item.id) + '" data-name="' + escape(item.nome) + '" aria-pressed="' + isSaved + '" aria-label="' + (isSaved ? 'Remover ' : 'Salvar ') + escape(item.nome) + (isSaved ? ' das favoritas' : ' nas favoritas') + '">' + icon('heart') + '</button>' +
      '<div class="card-info"><div class="card-kicker"><span>' + escape(item.id.replace('_', ' #')) + '</span><span>' + escape(price) + '</span></div>' +
      '<h3 class="card-title" title="' + escape(item.nome) + '">' + escape(item.nome) + '</h3><div class="card-bottom">' +
      '<span class="audio-badge">' + icon(item.temAudio ? 'sound' : 'play') + (item.temAudio ? 'Com áudio' : item.isAnimated ? 'Animada' : 'Estática') + '</span>' +
      '<button class="card-view-button" type="button" data-action="preview" data-id="' + escape(item.id) + '">Ver detalhes' + icon('arrow') + '</button></div></div></article>';
  }

  function stopHoverVideos() {
    document.querySelectorAll('.card-hover-video').forEach(video => { video.pause(); video.removeAttribute('src'); video.load(); video.remove(); });
  }

  function bindHoverPreviews() {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches || (navigator.connection && navigator.connection.saveData)) return;
    $('#catalogGrid').querySelectorAll('button[data-preview]').forEach(button => {
      let timer;
      let video;
      const stop = () => {
        clearTimeout(timer);
        if (video) { video.pause(); video.removeAttribute('src'); video.load(); video.remove(); video = null; }
      };
      button.addEventListener('mouseenter', () => {
        timer = setTimeout(() => {
          if (!button.isConnected) return;
          video = document.createElement('video');
          video.className = 'card-hover-video';
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.setAttribute('aria-hidden', 'true');
          video.src = button.dataset.preview;
          const currentVideo = video;
          currentVideo.addEventListener('playing', () => currentVideo.classList.add('ready'), { once: true });
          currentVideo.addEventListener('error', stop, { once: true });
          button.appendChild(currentVideo);
          currentVideo.play().catch(stop);
        }, 180);
      });
      button.addEventListener('mouseleave', stop);
    });
  }

  function render() {
    stopHoverVideos();
    const items = filteredItems();
    const visible = items.slice(0, state.limit);
    const grid = $('#catalogGrid');
    grid.innerHTML = visible.map(cardHTML).join('');
    grid.setAttribute('aria-busy', String(state.loading));
    $('#catalogEmpty').hidden = items.length !== 0;
    $('#loadMoreButton').hidden = items.length <= state.limit;
    $('#searchClear').hidden = !state.query;
    $('#resultCount').textContent = items.length === 1 ? '1 figurinha encontrada' : items.length + ' figurinhas encontradas';
    if (items.length > state.limit) $('#resultCount').textContent += ' · mostrando ' + visible.length;
    document.querySelectorAll('[data-filter]').forEach(button => {
      const active = button.dataset.filter === state.filter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (state.source === 'error' && !state.items.length) {
      $('#emptyTitle').textContent = 'O catálogo não respondeu.';
      $('#emptyDescription').textContent = 'Confira a conexão do backend e tente atualizar a galeria. Nenhum envio ou pagamento foi executado.';
      $('#resetButton').hidden = true;
    } else if (!state.items.length) {
      $('#emptyTitle').textContent = 'O catálogo ainda está vazio.';
      $('#emptyDescription').textContent = 'Salve uma figurinha com o comando do bot e atualize a página para vê-la aqui.';
      $('#resetButton').hidden = true;
    } else {
      $('#emptyTitle').textContent = state.filter === 'favorites' ? 'Sua coleção começa com um coração.' : 'Nenhuma reação com esse filtro.';
      $('#emptyDescription').textContent = state.filter === 'favorites' ? 'Salve uma figurinha no coração do cartão. Se você já salvou, confira a busca e a categoria.' : 'Tente outro nome, ID, tag ou categoria.';
      $('#resetButton').hidden = false;
    }
    updateSavedCount();
    bindImageFallbacks(grid);
    bindHoverPreviews();
  }

  function renderHero() {
    const preferred = state.items.filter(item => api.staticMedia(item, state.index).poster);
    const items = preferred.length ? preferred : state.items;
    const selected = [items[0], items[Math.min(3, items.length - 1)]].filter(Boolean);
    const collage = $('#heroCollage');
    if (!selected.length) {
      collage.innerHTML = '<div class="hero-card hero-card-main">' + fallbackHTML('O próximo play vem do catálogo.') + '</div>';
    } else {
      collage.innerHTML = selected.map((item, position) => {
        const media = api.staticMedia(item, state.index);
        const image = media.poster || (state.source === 'live' ? api.mediaUrl(item) : '');
        return '<button class="hero-card ' + (position ? 'hero-card-back' : 'hero-card-main') + '" type="button" data-action="preview" data-id="' + escape(item.id) + '" aria-label="Ver ' + escape(item.nome) + '">' +
          (image ? '<img src="' + escape(image) + '" alt="' + escape(item.nome) + '" width="360" height="360" data-sticker-id="' + escape(item.id) + '">' : fallbackHTML(item.nome)) +
          '<span class="hero-card-label">' + (item.temAudio ? 'DÊ PLAY NA PRÉVIA' : 'VEJA ESSA REAÇÃO') + '</span></button>';
      }).join('');
      bindImageFallbacks(collage);
    }
    $('#heroCount').textContent = state.items.length ? state.items.length + ' figurinhas no catálogo' : 'Seu próximo meme está aqui';
    $('#surpriseButton').disabled = !state.items.length;
  }

  async function loadCatalog() {
    if (state.loading) return;
    state.loading = true;
    $('#reloadButton').disabled = true;
    $('#connectionBox').className = 'connection-box loading';
    $('#connectionText').textContent = 'Conectando ao catálogo do bot…';
    $('#catalogGrid').setAttribute('aria-busy', 'true');
    const [result, index] = await Promise.all([api.catalog(), api.mediaIndex()]);
    state.items = result.items;
    state.index = index;
    state.source = result.source;
    state.loading = false;
    $('#reloadButton').disabled = false;
    const time = new Date(result.loadedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    $('#connectionBox').className = 'connection-box ' + (result.source === 'snapshot' ? 'warning' : result.source === 'error' ? 'error' : '');
    $('#connectionText').textContent = result.source === 'live' ? 'Conectado ao bot · ' + result.items.length + ' figurinhas · atualizado às ' + time : result.source === 'snapshot' ? 'Catálogo de prévias do site · não está ao vivo. ' + result.error : 'Falha de conexão. ' + result.error;
    const select = $('#categorySelect');
    select.innerHTML = '<option value="all">Todas as categorias</option>' + [...new Set(state.items.map(item => item.categoria))].sort((a, b) => a.localeCompare(b, 'pt-BR')).map(category => '<option value="' + escape(category) + '">' + escape(category.charAt(0).toUpperCase() + category.slice(1)) + '</option>').join('');
    if (!state.items.some(item => item.categoria === state.category)) state.category = 'all';
    select.value = state.category;
    render();
    renderHero();
  }

  function setFilter(filter) {
    state.filter = filter;
    state.limit = config.pageSize;
    render();
  }

  function stopMedia() {
    $('#stickerAudio').pause();
    $('#previewMedia').querySelectorAll('video').forEach(video => { video.pause(); video.removeAttribute('src'); video.load(); });
  }

  function showPreviewMedia(tab) {
    const item = state.current;
    if (!item) return;
    const mediaGeneration = ++state.mediaGeneration;
    stopMedia();
    state.activeTab = tab;
    const media = api.staticMedia(item, state.index);
    const url = tab === 'example' ? media.example : media.preview;
    const container = $('#previewMedia');
    container.replaceChildren();
    $('#previewTab').classList.toggle('active', tab === 'preview');
    $('#previewTab').setAttribute('aria-pressed', String(tab === 'preview'));
    $('#exampleTab').classList.toggle('active', tab === 'example');
    $('#exampleTab').setAttribute('aria-pressed', String(tab === 'example'));
    if (url) {
      const video = document.createElement('video');
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.src = url;
      if (media.poster && tab === 'preview') video.poster = media.poster;
      video.setAttribute('aria-label', tab === 'example' ? 'Exemplo de uso no WhatsApp' : 'Vídeo de prévia da figurinha');
      video.addEventListener('play', () => $('#stickerAudio').pause());
      video.addEventListener('error', () => {
        if (state.current !== item || state.activeTab !== tab || state.mediaGeneration !== mediaGeneration || !container.contains(video)) return;
        container.innerHTML = fallbackHTML('Não foi possível carregar esse vídeo.');
        $('#previewMediaNote').textContent = 'A cópia de vídeo não respondeu. O download do arquivo original depende do backend.';
      }, { once: true });
      container.appendChild(video);
      $('#previewMediaNote').textContent = tab === 'example' ? 'Exemplo de conversa enviado ao site. Toque em play para assistir.' : 'Prévia em vídeo enviada ao site. Use o play e os controles de áudio.';
    } else if (state.source === 'live' && tab === 'preview') {
      const image = document.createElement('img');
      image.src = api.mediaUrl(item);
      image.alt = item.nome;
      image.addEventListener('error', () => {
        if (state.current === item && state.activeTab === tab && state.mediaGeneration === mediaGeneration && container.contains(image)) container.innerHTML = fallbackHTML('O arquivo de prévia não respondeu.');
      }, { once: true });
      container.appendChild(image);
      $('#previewMediaNote').textContent = item.isAnimated ? 'WebP animado do backend. Ouça o áudio separadamente abaixo.' : 'Arquivo original da figurinha servido pelo backend.';
    } else {
      container.innerHTML = fallbackHTML('Não há vídeo disponível para esta figurinha.');
      $('#previewMediaNote').textContent = 'As prévias locais são associadas ao ID e à versão do registro do catálogo.';
    }
  }

  function openPreview(id) {
    const item = state.items.find(entry => entry.id === id);
    if (!item) return;
    stopHoverVideos();
    ++state.previewGeneration;
    state.lastFocused = document.activeElement;
    state.current = item;
    $('#previewId').textContent = item.id.toUpperCase();
    $('#previewTitle').textContent = item.nome;
    $('#previewBadges').innerHTML = [item.temAudio ? 'Com áudio' : 'Sem áudio', item.isAnimated ? 'Animada' : 'Estática', item.categoria].map(label => '<span>' + escape(label) + '</span>').join('');
    $('#previewMeta').textContent = [item.packname, item.tamanho ? Math.round(item.tamanho / 1024) + ' KB' : '', item.audioSeconds ? item.audioSeconds.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' s de áudio' : ''].filter(Boolean).join(' · ');
    $('#previewStatus').textContent = state.source !== 'live' ? 'Você está consultando uma prévia do site. Downloads e áudio original exigem que o backend esteja disponível.' : item.priceCents !== 0 ? 'Este item não tem download liberado: o backend não possui uma integração de compra.' : '';
    $('#audioSection').hidden = !item.temAudio;
    $('#downloadAudio').hidden = !item.temAudio;
    $('#audioError').hidden = true;
    const audio = $('#stickerAudio');
    audio.pause();
    state.audioSource = item.temAudio ? api.mediaUrl(item, 'audio') : '';
    if (item.temAudio) audio.src = state.audioSource; else audio.removeAttribute('src');
    audio.load();
    state.downloadBusy = false;
    $('#downloadSticker').disabled = item.priceCents !== 0;
    $('#downloadAudio').disabled = item.priceCents !== 0;
    $('#downloadSticker').innerHTML = icon('download') + (item.priceCents === 0 ? 'Baixar figurinha WebP' : 'Download não liberado');
    $('#downloadAudio').innerHTML = icon('sound') + 'Baixar áudio ' + (item.arquivoAudio.split('.').pop() || 'OGG').toUpperCase();
    $('#botCommand').value = config.commandPrefix + config.sendCommand + ' ' + item.id;
    $('#exampleTab').disabled = !api.staticMedia(item, state.index).example;
    updateSavedCount();
    showPreviewMedia('preview');
    if (!$('#previewDialog').open) $('#previewDialog').showModal();
    document.body.classList.add('modal-open');
    $('#closePreview').focus();
  }

  function closePreview() {
    ++state.previewGeneration;
    ++state.mediaGeneration;
    stopMedia();
    state.audioSource = '';
    $('#stickerAudio').removeAttribute('src');
    $('#stickerAudio').load();
    document.body.classList.remove('modal-open');
    state.current = null;
    state.downloadBusy = false;
    const focused = state.lastFocused;
    if (focused && focused.isConnected) focused.focus();
  }

  async function download(kind, button) {
    if (!state.current || state.downloadBusy) return;
    const item = state.current;
    const oldHTML = button.innerHTML;
    const token = ++state.downloadToken;
    const generation = state.previewGeneration;
    const isCurrent = () => state.current === item && state.previewGeneration === generation && state.downloadToken === token;
    state.downloadBusy = true;
    $('#downloadSticker').disabled = true;
    $('#downloadAudio').disabled = true;
    button.textContent = 'Preparando arquivo…';
    $('#previewStatus').textContent = 'Buscando o arquivo original no backend…';
    try {
      const result = await api.download(item, kind);
      if (isCurrent()) $('#previewStatus').textContent = 'Arquivo recebido: ' + result.name + '. O navegador iniciou o download; a importação no WhatsApp é um passo separado.';
      toast('Arquivo recebido. Confira os downloads do navegador.');
    } catch (error) {
      if (isCurrent()) $('#previewStatus').textContent = error.message;
      toast(error.message);
    } finally {
      if (isCurrent()) {
        state.downloadBusy = false;
        $('#downloadSticker').disabled = item.priceCents !== 0;
        $('#downloadAudio').disabled = item.priceCents !== 0;
        button.innerHTML = oldHTML;
      }
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'favorite') toggleFavorite(button.dataset.id);
    if (button.dataset.action === 'preview') openPreview(button.dataset.id);
  });
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => setFilter(button.dataset.filter)));
  $('#savedButton').addEventListener('click', () => { setFilter(state.filter === 'favorites' ? 'all' : 'favorites'); $('#catalogo').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
  $('#searchInput').addEventListener('input', event => { state.query = event.target.value; state.limit = config.pageSize; render(); });
  $('#searchClear').addEventListener('click', () => { state.query = ''; $('#searchInput').value = ''; render(); $('#searchInput').focus(); });
  $('#categorySelect').addEventListener('change', event => { state.category = event.target.value; state.limit = config.pageSize; render(); });
  $('#sortSelect').addEventListener('change', event => { state.sort = event.target.value; render(); });
  $('#resetButton').addEventListener('click', () => { state.filter = 'all'; state.category = 'all'; state.query = ''; state.limit = config.pageSize; $('#searchInput').value = ''; $('#categorySelect').value = 'all'; render(); });
  $('#loadMoreButton').addEventListener('click', () => { state.limit += config.pageSize; render(); });
  $('#reloadButton').addEventListener('click', loadCatalog);
  $('#surpriseButton').addEventListener('click', () => {
    if (!state.items.length) return;
    const pool = state.items.filter(item => item.temAudio);
    const items = pool.length ? pool : state.items;
    openPreview(items[Math.floor(Math.random() * items.length)].id);
  });
  $('#menuButton').addEventListener('click', () => { const open = $('#mobileMenu').hidden; $('#mobileMenu').hidden = !open; $('#menuButton').setAttribute('aria-expanded', String(open)); $('#menuButton').setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu'); });
  $('#mobileMenu').addEventListener('click', event => { if (event.target.closest('a')) { $('#mobileMenu').hidden = true; $('#menuButton').setAttribute('aria-expanded', 'false'); $('#menuButton').setAttribute('aria-label', 'Abrir menu'); } });
  $('#closePreview').addEventListener('click', () => $('#previewDialog').close());
  $('#previewDialog').addEventListener('close', closePreview);
  $('#previewDialog').addEventListener('click', event => {
    if (event.target !== $('#previewDialog')) return;
    const rect = $('#previewDialog').getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('#previewDialog').close();
  });
  $('#previewTab').addEventListener('click', () => showPreviewMedia('preview'));
  $('#exampleTab').addEventListener('click', () => showPreviewMedia('example'));
  $('#previewSave').addEventListener('click', () => { if (state.current) toggleFavorite(state.current.id); });
  $('#downloadSticker').addEventListener('click', event => download('sticker', event.currentTarget));
  $('#downloadAudio').addEventListener('click', event => download('audio', event.currentTarget));
  $('#stickerAudio').addEventListener('play', () => $('#previewMedia').querySelectorAll('video').forEach(video => video.pause()));
  $('#stickerAudio').addEventListener('error', event => {
    if (state.current && state.current.temAudio && state.audioSource && event.currentTarget.currentSrc === state.audioSource) $('#audioError').hidden = false;
  });
  $('#copyCommand').addEventListener('click', async () => {
    const input = $('#botCommand');
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('clipboard-unavailable');
      await navigator.clipboard.writeText(input.value);
      $('#previewStatus').textContent = 'Comando copiado. Somente o dono pode executá-lo no bot.';
    } catch (_) {
      input.focus(); input.select();
      $('#previewStatus').textContent = 'O navegador bloqueou a cópia automática. O comando está selecionado: copie-o manualmente.';
    }
  });
  window.addEventListener('storage', event => {
    if (event.key !== favoritesKey) return;
    try {
      const data = JSON.parse(event.newValue || '[]');
      if (Array.isArray(data)) { state.favorites = new Set(data.filter(id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id)).slice(0, 2000)); render(); }
    } catch (_) { /* Ignore invalid data from another tab. */ }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopMedia(); stopHoverVideos(); } });
  $('#currentYear').textContent = String(new Date().getFullYear());
  updateSavedCount();
  loadCatalog().catch(error => {
    state.loading = false;
    state.source = 'error';
    $('#reloadButton').disabled = false;
    $('#connectionBox').className = 'connection-box error';
    $('#connectionText').textContent = 'Falha inesperada ao carregar a galeria: ' + error.message;
    render();
  });
})();
