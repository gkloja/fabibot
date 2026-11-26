(function () {
  'use strict';
  const api = window.FabiStickerApi;
  const config = window.FABI_FIGURINHAS_CONFIG;
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const icon = name => '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  const fold = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const favoritesKey = 'fabi_sticker_favorites_v1';
  const favoriteTokenKey = 'fabi_sticker_favorite_token_v1';
  const cartKey = 'fabi_sticker_cart_v1';
  const orderKey = 'fabi_sticker_pending_order_v1';
  const historyKey = 'fabi_sticker_order_history_v1';
  const themeKey = 'fabi_sticker_theme_v1';
  const defaultPriceCents = 10;
  const priceOf = item => Math.max(1, Number(item && item.priceCents) || (item && item.temAudio ? 20 : defaultPriceCents));
  const priceLabel = item => formatMoney(priceOf(item));
  const storeWhatsapp = String(config.storeWhatsapp || '5592985715119').replace(/\D/g, '');
  let favoriteToken = '';
  try { favoriteToken = localStorage.getItem(favoriteTokenKey) || ''; if (!/^[a-zA-Z0-9_-]{16,120}$/.test(favoriteToken)) { favoriteToken = (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : String(Date.now()) + Math.random().toString(36).slice(2)); localStorage.setItem(favoriteTokenKey, favoriteToken); } } catch (_) { favoriteToken = 'anon' + Date.now().toString(36); }
  const state = { items: [], index: {}, filter: 'all', query: '', category: 'all', sort: 'recent', limit: config.pageSize, favorites: new Set(), cart: new Set(), current: null, source: 'loading', loading: false, activeTab: 'preview', toastTimer: null, lastFocused: null, previewGeneration: 0, mediaGeneration: 0, activeOrderId: '', pollTimer: null, redeemedStatusTimer: null, pollAttempts: 0, pendingQr: '', pendingCopy: '', redeemCode: '' };
  try {
    const saved = JSON.parse(localStorage.getItem(favoritesKey) || '[]');
    if (Array.isArray(saved)) state.favorites = new Set(saved.filter(id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id)).slice(0, 2000));
  } catch (_) { /* Local storage may be disabled. The gallery still works. */ }

  try {
    const savedCart = JSON.parse(localStorage.getItem(cartKey) || '[]');
    if (Array.isArray(savedCart)) state.cart = new Set(savedCart.filter(id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id)).slice(0, 40));
  } catch (_) { /* Cart still works for this visit when storage is blocked. */ }

  const formatMoney = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const prefersStill = () => matchMedia('(prefers-reduced-motion: reduce)').matches || Boolean(navigator.connection && navigator.connection.saveData);

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
      $('#previewSave').innerHTML = icon('heart') + (isSaved ? 'Remover das favoritas' : 'Salvar nas favoritas');
    }
  }

  function persistCart() {
    try { localStorage.setItem(cartKey, JSON.stringify([...state.cart])); } catch (_) { /* Optional persistence. */ }
  }

  function cartSignature() { return [...state.cart].sort().join('|'); }

  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    const effective = theme === 'light' || (theme !== 'dark' && matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
    const button = $('#themeToggle');
    if (button) {
      button.setAttribute('aria-label', effective === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro');
      button.setAttribute('title', effective === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro');
      button.innerHTML = icon(effective === 'dark' ? 'sun' : 'moon');
    }
  }

  function restoreTheme() {
    let saved = '';
    try { saved = localStorage.getItem(themeKey) || ''; } catch (_) { /* Optional preference. */ }
    applyTheme(saved === 'light' || saved === 'dark' ? saved : 'system');
  }

  function toggleFavorite(id) {
    if (state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
    let persisted = true;
    try { localStorage.setItem(favoritesKey, JSON.stringify([...state.favorites])); }
    catch (_) { persisted = false; }
    updateSavedCount();
    api.recordFavorite(id, state.favorites.has(id) ? 'add' : 'remove', favoriteToken).catch(() => {});
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
      if (state.filter === 'no-audio' && item.temAudio) return false;
      if (state.filter === 'animated' && !item.isAnimated) return false;
      if (state.filter === 'favorites' && !state.favorites.has(item.id)) return false;
      if (state.category !== 'all' && item.categoria !== state.category) return false;
      return !query || fold([item.nome, item.id, ...item.tags].join(' ')).includes(query);
    }).sort((a, b) => {
      if (state.sort === 'most-purchased') return (priceOf(b), b.compras - a.compras) || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true });
      if (state.sort === 'most-favorited') return (b.favoritos - a.favoritos) || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true });
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
        if (image.dataset.fallback && !image.dataset.fallbackUsed) {
          image.dataset.fallbackUsed = '1';
          image.src = image.dataset.fallback;
        } else if (item && !image.dataset.retried && state.source === 'live') {
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
    const animated = state.source === 'live' && item.isAnimated && !prefersStill();
    const image = animated ? api.mediaUrl(item) : (media.poster || (state.source === 'live' ? api.mediaUrl(item) : ''));
    const isSaved = state.favorites.has(item.id);
    const inCart = state.cart.has(item.id);
    const fallback = media.poster || '';
    return '<article class="sticker-card" data-id="' + escape(item.id) + '">' +
      '<button class="card-preview" type="button" data-action="preview" data-id="' + escape(item.id) + '" aria-label="Ver prévia de ' + escape(item.nome) + '">' +
      (image ? '<img src="' + escape(image) + '" alt="' + escape(item.nome) + '" width="360" height="360" loading="lazy" decoding="async" data-sticker-id="' + escape(item.id) + '" data-fallback="' + escape(fallback) + '"><span class="watermark" aria-hidden="true">FABI BOT</span>' : fallbackHTML('Prévia disponível apenas pelo backend.')) +
      '<span class="card-play">' + icon('play') + 'Ver exemplo</span></button>' +
      '<button class="card-save" type="button" data-action="favorite" data-id="' + escape(item.id) + '" data-name="' + escape(item.nome) + '" aria-pressed="' + isSaved + '" aria-label="' + (isSaved ? 'Remover ' : 'Salvar ') + escape(item.nome) + (isSaved ? ' das favoritas' : ' nas favoritas') + '">' + icon('heart') + '</button>' +
      '<div class="card-info"><div class="card-kicker"><span>' + escape(item.id.replace('_', ' #')) + '</span><span>' + priceLabel(item) + '</span></div>' +
      '<h3 class="card-title" title="' + escape(item.nome) + '">' + escape(item.nome) + '</h3><div class="card-bottom">' +
      '<span class="audio-badge ' + (item.temAudio ? 'has-audio' : 'no-audio') + '">' + icon(item.temAudio ? 'sound' : 'play') + (item.temAudio ? 'COM SOM' : 'SEM ÁUDIO') + '</span>' +
      '<button class="card-cart-button" type="button" data-action="cart-add" data-id="' + escape(item.id) + '" aria-pressed="' + inCart + '">' + (inCart ? 'No carrinho ✓' : '+ Carrinho') + '</button></div>' +
      '<div class="card-links"><button class="card-view-button" type="button" data-action="preview" data-id="' + escape(item.id) + '">Ver detalhes' + icon('arrow') + '</button><a class="card-seo-link" href="/figurinhas/' + encodeURIComponent(item.id) + '">Página pública</a></div></div></article>';
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

  function protectMedia(scope = document) {
    scope.querySelectorAll('video').forEach(video => { video.setAttribute('controlsList', 'nodownload noplaybackrate'); video.setAttribute('disablepictureinpicture', ''); });
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
      $('#emptyDescription').textContent = 'Confira a conexão do backend e tente atualizar a galeria. Nenhum pedido foi enviado.';
      $('#resetButton').hidden = true;
    } else if (!state.items.length) {
      $('#emptyTitle').textContent = 'O catálogo ainda está vazio.';
      $('#emptyDescription').textContent = 'O catálogo do bot ainda não tem figurinhas para exibir.';
      $('#resetButton').hidden = true;
    } else {
      $('#emptyTitle').textContent = state.filter === 'favorites' ? 'Sua coleção começa com um coração.' : 'Nenhuma reação com esse filtro.';
      $('#emptyDescription').textContent = state.filter === 'favorites' ? 'Salve uma figurinha no coração do cartão. Se você já salvou, confira a busca e a categoria.' : 'Tente outro nome, ID, tag ou categoria.';
      $('#resetButton').hidden = false;
    }
    updateSavedCount();
    bindImageFallbacks(grid);
    protectMedia(grid);
  }

  function renderHero() {
    const animatedItems = state.source === 'live' ? state.items.filter(item => item.isAnimated) : [];
    const preferred = animatedItems.length ? animatedItems : state.items.filter(item => api.staticMedia(item, state.index).poster);
    const items = preferred.length ? preferred : state.items;
    const selected = [items[0], items[Math.min(3, items.length - 1)]].filter(Boolean);
    const collage = $('#heroCollage');
    if (!selected.length) {
      collage.innerHTML = '<div class="hero-card hero-card-main">' + fallbackHTML('O próximo play vem do catálogo.') + '</div>';
    } else {
      collage.innerHTML = selected.map((item, position) => {
        const media = api.staticMedia(item, state.index);
        const animated = state.source === 'live' && item.isAnimated && !prefersStill();
        const image = animated ? api.mediaUrl(item) : (media.poster || (state.source === 'live' ? api.mediaUrl(item) : ''));
        return '<button class="hero-card ' + (position ? 'hero-card-back' : 'hero-card-main') + '" type="button" data-action="preview" data-id="' + escape(item.id) + '" aria-label="Ver ' + escape(item.nome) + '">' +
          (image ? '<img src="' + escape(image) + '" alt="' + escape(item.nome) + '" width="360" height="360" loading="eager" data-sticker-id="' + escape(item.id) + '" data-fallback="' + escape(media.poster || '') + '"><span class="watermark" aria-hidden="true">FABI BOT</span>' : fallbackHTML(item.nome)) +
          '<span class="hero-card-label">' + priceLabel(item) + ' · ' + (item.temAudio ? 'COM SOM' : 'SEM ÁUDIO') + '</span></button>';
      }).join('');
      bindImageFallbacks(collage);
    }
    $('#heroCount').textContent = state.items.length ? state.items.length + ' figurinhas · de R$ 0,10 a R$ 0,20' : 'Seu próximo meme está aqui';
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
    renderCart();
    const requestedSticker = new URLSearchParams(location.search).get('sticker');
    if (requestedSticker && state.items.some(item => item.id === requestedSticker)) openPreview(requestedSticker);
  }

  function setFilter(filter) {
    state.filter = filter;
    state.limit = config.pageSize;
    render();
  }

  function stopMedia() {
    $('#previewMedia').querySelectorAll('video').forEach(video => { video.pause(); video.removeAttribute('src'); video.load(); });
  }

  function showPreviewMedia(tab) {
    const item = state.current;
    if (!item) return;
    const mediaGeneration = ++state.mediaGeneration;
    stopMedia();
    state.activeTab = tab;
    const media = api.staticMedia(item, state.index);
    const container = $('#previewMedia');
    container.replaceChildren();
    $('#previewTab').classList.toggle('active', tab === 'preview');
    $('#previewTab').setAttribute('aria-pressed', String(tab === 'preview'));
    $('#exampleTab').classList.toggle('active', tab === 'example');
    $('#exampleTab').setAttribute('aria-pressed', String(tab === 'example'));
    if (tab === 'example' && media.example) {
      const video = document.createElement('video');
      video.controls = true;
      video.controlsList = 'nodownload noplaybackrate';
      video.disablePictureInPicture = true;
      video.playsInline = true;
      video.autoplay = true;
      video.muted = false;
      video.preload = 'auto';
      video.src = media.example;
      video.setAttribute('aria-label', 'Vídeo da conversa no WhatsApp com som');
      video.addEventListener('error', () => {
        if (state.current !== item || state.activeTab !== tab || state.mediaGeneration !== mediaGeneration || !container.contains(video)) return;
        showPreviewMedia('preview');
        $('#previewMediaNote').textContent = 'Não foi possível carregar o vídeo da conversa. Confira se a pasta exemplo está junto ao site; a figurinha animada continua disponível.';
      }, { once: true });
      container.appendChild(video);
      const watermark = document.createElement('span');
      watermark.className = 'watermark video-watermark';
      watermark.setAttribute('aria-hidden', 'true');
      watermark.textContent = 'FABI BOT';
      container.appendChild(watermark);
      $('#previewMediaNote').textContent = 'Exemplo no WhatsApp com o áudio original. Se a reprodução automática for bloqueada, toque em play no vídeo.';
      try {
        const playback = video.play();
        if (playback && typeof playback.catch === 'function') playback.catch(() => {
          if (state.current === item && state.activeTab === tab && state.mediaGeneration === mediaGeneration && container.contains(video)) {
            $('#previewMediaNote').textContent = 'Toque em play no vídeo para assistir e ouvir o exemplo no WhatsApp.';
          }
        });
      } catch (_) {
        $('#previewMediaNote').textContent = 'Toque em play no vídeo para assistir e ouvir o exemplo no WhatsApp.';
      }
      return;
    }
    const source = state.source === 'live' ? api.mediaUrl(item) : media.poster;
    if (source) {
      const image = document.createElement('img');
      image.src = source;
      image.alt = item.nome;
      image.addEventListener('error', () => {
        if (state.current === item && state.activeTab === tab && state.mediaGeneration === mediaGeneration && container.contains(image)) container.innerHTML = fallbackHTML('A prévia da figurinha não respondeu.');
      }, { once: true });
      container.appendChild(image);
      const watermark = document.createElement('span');
      watermark.className = 'watermark';
      watermark.setAttribute('aria-hidden', 'true');
      watermark.textContent = 'FABI BOT';
      container.appendChild(watermark);
      $('#previewMediaNote').textContent = item.isAnimated ? 'WebP animado original. A marca-d’água aparece apenas nesta prévia.' : 'Prévia estática da figurinha original.';
    } else {
      container.innerHTML = fallbackHTML('Não há prévia disponível para esta figurinha.');
      $('#previewMediaNote').textContent = 'As prévias locais estão associadas ao ID e à versão do registro do catálogo.';
    }
  }

  function openPreview(id) {
    const item = state.items.find(entry => entry.id === id);
    if (!item) return;
    stopHoverVideos();
    ++state.previewGeneration;
    state.lastFocused = document.activeElement;
    state.current = item;
    history.replaceState(null, '', '/figurinhas?sticker=' + encodeURIComponent(item.id));
    $('#previewId').textContent = item.id.toUpperCase();
    $('#previewTitle').textContent = item.nome;
    $('#previewBadges').innerHTML = [item.temAudio ? 'Com áudio' : 'Sem áudio', item.isAnimated ? 'Animada' : 'Estática', item.categoria].map(label => '<span>' + escape(label) + '</span>').join('');
    $('#previewMeta').textContent = [item.packname, item.tamanho ? Math.round(item.tamanho / 1024) + ' KB' : '', item.audioSeconds ? item.audioSeconds.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' s de áudio' : ''].filter(Boolean).join(' · ');
    $('#previewStatus').textContent = state.source !== 'live' ? 'Prévia do pacote local. O checkout exige conexão ativa com o catálogo do bot.' : '';
    $('#exampleTab').disabled = !api.staticMedia(item, state.index).example;
    $('#previewAddToCart').setAttribute('aria-pressed', String(state.cart.has(item.id)));
    $('#previewAddToCart').textContent = state.cart.has(item.id) ? 'No carrinho · ' + priceLabel(item) : 'Adicionar ao carrinho · ' + priceLabel(item);
    updateSavedCount();
    const initialTab = api.staticMedia(item, state.index).example ? 'example' : 'preview';
    showPreviewMedia(initialTab);
    if (!$('#previewDialog').open) $('#previewDialog').showModal();
    document.body.classList.add('modal-open');
    $('#closePreview').focus();
  }

  function closePreview() {
    ++state.previewGeneration;
    ++state.mediaGeneration;
    stopMedia();
    document.body.classList.remove('modal-open');
    state.current = null;
    const url = new URL(location.href);
    if (url.searchParams.has('sticker')) { url.searchParams.delete('sticker'); history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash); }
    const focused = state.lastFocused;
    if (focused && focused.isConnected) focused.focus();
  }


  function updateCartButtons() {
    document.querySelectorAll('[data-action="cart-add"]').forEach(button => {
      const inCart = state.cart.has(button.dataset.id);
      button.setAttribute('aria-pressed', String(inCart));
      button.textContent = inCart ? 'No carrinho ✓' : '+ Carrinho';
    });
    if (state.current) {
      const inCart = state.cart.has(state.current.id);
      $('#previewAddToCart').setAttribute('aria-pressed', String(inCart));
      $('#previewAddToCart').textContent = inCart ? 'No carrinho · ' + priceLabel(state.current) : 'Adicionar ao carrinho · ' + priceLabel(state.current);
    }
  }

  function renderCart() {
    const validIds = new Set(state.items.map(item => item.id));
    state.cart = new Set([...state.cart].filter(id => validIds.has(id)));
    persistCart();
    const items = [...state.cart].map(id => state.items.find(item => item.id === id)).filter(Boolean);
    $('#cartCount').textContent = String(items.length);
    $('#cartEmpty').hidden = items.length > 0;
    $('#cartSummary').hidden = items.length === 0;
    $('#checkoutButton').disabled = items.length === 0 || state.source !== 'live';
    $('#cartQuantityText').textContent = items.length + (items.length === 1 ? ' figurinha' : ' figurinhas');
    $('#cartTotal').textContent = formatMoney(items.reduce((total, item) => total + priceOf(item), 0));
    $('#cartItems').innerHTML = items.map(item => {
      const media = api.staticMedia(item, state.index);
      const image = media.poster || (state.source === 'live' ? api.mediaUrl(item) : '');
      return '<div class="cart-line"><div class="cart-thumb">' + (image ? '<img src="' + escape(image) + '" alt="" loading="lazy"><span class="watermark" aria-hidden="true">FABI BOT</span>' : '') + '</div><div class="cart-line-info"><strong>' + escape(item.nome) + '</strong><small>' + escape(item.id) + ' · ' + priceLabel(item) + (item.temAudio ? ' · COM SOM' : ' · SEM ÁUDIO') + '</small></div><button class="cart-remove" type="button" data-action="cart-remove" data-id="' + escape(item.id) + '" aria-label="Remover ' + escape(item.nome) + '">Remover</button></div>';
    }).join('');
    if (state.source !== 'live') $('#checkoutStatus').textContent = 'Checkout indisponível: conecte-se ao catálogo ao vivo do bot.';
    updateCartButtons();
  }

  document.addEventListener('contextmenu', event => { if (event.target.closest('video')) event.preventDefault(); });

  function addToCart(id) {
    const item = state.items.find(entry => entry.id === id);
    if (!item) return;
    if (state.cart.has(id)) { toast('Essa figurinha já está no carrinho.'); return; }
    if (state.cart.size >= 40) { toast('O carrinho aceita até 40 figurinhas por pedido.'); return; }
    invalidatePendingOrder('Sua seleção mudou. Gere um novo PIX para o carrinho atualizado.');
    state.cart.add(id);
    renderCart();
    render();
    toast('Adicionada ao carrinho · ' + priceLabel(item) + (item.temAudio ? ' · com som.' : ' · sem áudio.'));
  }

  function removeFromCart(id) {
    invalidatePendingOrder('Sua seleção mudou. Gere um novo PIX para o carrinho atualizado.');
    state.cart.delete(id);
    renderCart();
    render();
  }

  function restorePendingOrder() {
    try {
      const saved = JSON.parse(localStorage.getItem(orderKey) || 'null');
      if (!saved || !/^[a-f0-9-]{36}$/i.test(saved.orderId || '') || (!saved.redeemCode && saved.cartSignature !== cartSignature())) {
        localStorage.removeItem(orderKey);
        return;
      }
      state.activeOrderId = saved.orderId;
      state.pendingQr = saved.qrCode || '';
      state.pendingCopy = saved.copyPaste || '';
      state.redeemCode = typeof saved.redeemCode === 'string' ? saved.redeemCode : '';
      if (state.redeemCode) {
        void refreshRedeemStatus();
        state.redeemedStatusTimer = setInterval(refreshRedeemStatus, 15000);
      }
    } catch (_) { /* Ignore corrupt local order data. */ }
  }

  function rememberRedeemedOrder() {
    try {
      const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
      const next = Array.isArray(history) ? history.filter(item => item && item.orderId !== state.activeOrderId) : [];
      next.unshift({ orderId: state.activeOrderId, redeemedAt: new Date().toISOString(), codeHint: state.redeemCode ? '…' + state.redeemCode.slice(-6) : '' });
      localStorage.setItem(historyKey, JSON.stringify(next.slice(0, 20)));
    } catch (_) { /* History is optional and never blocks new purchases. */ }
  }

  async function refreshRedeemStatus() {
    if (!state.activeOrderId || !state.redeemCode) return false;
    try {
      const result = await api.checkStickerPayment(state.activeOrderId);
      if (result && (result.redeemed === true || result.status === 'redeemed')) {
        rememberRedeemedOrder();
        clearInterval(state.redeemedStatusTimer);
        state.redeemedStatusTimer = null;
        clearInterval(state.pollTimer);
        state.pollTimer = null;
        state.activeOrderId = ''; state.pendingQr = ''; state.pendingCopy = ''; state.redeemCode = '';
        try { localStorage.removeItem(orderKey); } catch (_) {}
        $('#redeemCodeBox').hidden = true;
        $('#checkoutPanel').hidden = true;
        renderCart();
        toast('Resgate concluído. O código foi arquivado no histórico.');
        return true;
      }
    } catch (_) { /* A temporary network error must not remove the active code. */ }
    return false;
  }

  function invalidatePendingOrder(message) {
    if (!state.activeOrderId || state.redeemCode) return;
    clearInterval(state.pollTimer);
    state.pollTimer = null;
    state.activeOrderId = ''; state.pendingQr = ''; state.pendingCopy = '';
    try { localStorage.removeItem(orderKey); } catch (_) { /* Optional. */ }
    $('#checkoutPanel').hidden = true;
    $('#cartSummary').hidden = state.cart.size === 0;
    $('#cartEmpty').hidden = state.cart.size > 0;
    if (message) $('#checkoutStatus').textContent = message;
  }

  function openCart() {
    if (!$('#cartDialog').open) $('#cartDialog').showModal();
    document.body.classList.add('modal-open');
    $('#closeCart').focus();
    if (state.redeemCode) {
      $('#cartSummary').hidden = true; $('#cartEmpty').hidden = true; $('#checkoutPanel').hidden = false;
      $('#checkoutTitle').textContent = 'Pagamento confirmado';
      $('#checkoutStatus').textContent = 'Código de uso único recuperado deste navegador. Envie no privado da Fabi Bot.';
      $('#redeemCode').textContent = state.redeemCode; $('#redeemCodeBox').hidden = false;
      $('#sendRedeemToWhatsApp').href = 'https://wa.me/' + storeWhatsapp + '?text=' + encodeURIComponent('Olá! Quero receber minhas figurinhas. Código: ' + state.redeemCode);
    } else if (state.activeOrderId && state.pendingCopy) {
      $('#cartSummary').hidden = true; $('#cartEmpty').hidden = true; $('#checkoutPanel').hidden = false;
      $('#checkoutTitle').textContent = 'Aguardando pagamento';
      $('#checkoutStatus').textContent = 'PIX pendente. O código de resgate só aparece após a confirmação.';
      $('#pixCopyPaste').value = state.pendingCopy;
      let qrSrc = state.pendingQr;
      if (!/^(?:data:image\/|https?:\/\/)/i.test(qrSrc) && /^[A-Za-z0-9+/=]+$/.test(qrSrc)) qrSrc = 'data:image/png;base64,' + qrSrc;
      $('#pixQrImage').src = qrSrc; $('#pixQrImage').hidden = !qrSrc;
      if (!state.pollTimer) { state.pollAttempts = 0; state.pollTimer = setInterval(checkPaymentStatus, 5000); checkPaymentStatus(); }
    }
  }

  function closeCart() { document.body.classList.remove('modal-open'); }

  function makeRequestId() {
    if (!window.crypto || !window.crypto.getRandomValues) return '';
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
  }

  async function copyText(text, statusNode, success) {
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('clipboard-unavailable');
      await navigator.clipboard.writeText(text);
      statusNode.textContent = success;
    } catch (_) {
      const textarea = document.createElement('textarea');
      textarea.value = text; textarea.setAttribute('readonly', ''); textarea.className = 'copy-fallback';
      document.body.appendChild(textarea); textarea.select();
      const copied = document.execCommand('copy'); textarea.remove();
      statusNode.textContent = copied ? success : 'A cópia automática foi bloqueada. Selecione e copie o texto manualmente.';
    }
  }

  function showRedeemCode(code) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
    state.redeemCode = code;
    $('#redeemCode').textContent = code;
    $('#redeemCodeBox').hidden = false;
    $('#checkoutTitle').textContent = 'Pagamento confirmado';
    $('#checkoutStatus').textContent = 'Seu código de uso único está pronto. Envie-o no privado da Fabi Bot.';
    $('#sendRedeemToWhatsApp').href = 'https://wa.me/' + storeWhatsapp + '?text=' + encodeURIComponent('Olá! Quero receber minhas figurinhas. Código: ' + code);
    state.cart.clear();
    persistCart();
    renderCart();
    let savedLocally = false;
    try {
      localStorage.setItem(orderKey, JSON.stringify({ orderId: state.activeOrderId, qrCode: state.pendingQr, copyPaste: state.pendingCopy, redeemCode: code }));
      const saved = JSON.parse(localStorage.getItem(orderKey) || 'null');
      savedLocally = Boolean(saved && saved.redeemCode === code);
    } catch (_) { /* The customer can still copy the code for this visit. */ }
    $('#checkoutStatus').textContent = savedLocally
      ? 'Código de uso único salvo neste navegador. Envie-o no privado da Fabi Bot.'
      : 'Código de uso único pronto. Copie-o e envie no privado da Fabi Bot para não perdê-lo.';
    if (!state.redeemedStatusTimer) state.redeemedStatusTimer = setInterval(refreshRedeemStatus, 15000);
    $('#checkoutPanel').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  async function checkPaymentStatus() {
    if (!state.activeOrderId || state.pollAttempts >= 360) { clearInterval(state.pollTimer); state.pollTimer = null; return; }
    state.pollAttempts += 1;
    try {
      const result = await api.checkStickerPayment(state.activeOrderId);
      const code = result.redeemCode || result.code;
      if (result.approved === true && typeof code === 'string' && /^FABI-[A-F0-9]{20,32}$/.test(code)) { showRedeemCode(code); return; }
      $('#checkoutStatus').textContent = result.status === 'rejected' ? 'O pagamento não foi aprovado. Gere um novo PIX pelo carrinho.' : 'Aguardando confirmação do Mercado Pago…';
    } catch (error) {
      $('#checkoutStatus').textContent = 'Não foi possível atualizar o status agora: ' + error.message + ' A página tentará novamente.';
    }
  }

  async function startCheckout() {
    if (state.source !== 'live' || state.cart.size === 0) { $('#checkoutStatus').textContent = 'Checkout indisponível: confira a conexão do catálogo e tente novamente.'; return; }
    const email = $('#payerEmail').value.trim();
    if (!$('#payerEmail').reportValidity()) return;
    const requestId = makeRequestId();
    if (!requestId) { $('#checkoutStatus').textContent = 'Este navegador não oferece geração segura de identificadores. Atualize-o e tente novamente.'; return; }
    $('#checkoutButton').disabled = true;
    $('#cartSummary').hidden = true;
    $('#cartEmpty').hidden = true;
    $('#checkoutPanel').hidden = false;
    $('#backToCart').hidden = true;
    $('#redeemCodeBox').hidden = true;
    $('#pixQrImage').hidden = true;
    $('#pixCopyPaste').value = '';
    $('#checkoutTitle').textContent = 'Gerando PIX';
    $('#checkoutStatus').textContent = 'Solicitando o PIX ao servidor seguro…';
    try {
      const result = await api.createStickerOrder([...state.cart], email, requestId);
      const orderId = result.orderId || result.transactionId;
      const qrCode = String(result.qrCode || result.qr_code || '');
      const copyPaste = String(result.copyPaste || result.copy_paste || '');
      if (!/^[a-f0-9-]{36}$/i.test(String(orderId || '')) || !qrCode || !copyPaste) throw new Error('O servidor não retornou um pedido PIX completo. Nenhuma entrega foi liberada.');
      state.activeOrderId = orderId;
      state.redeemCode = '';
      state.pendingQr = qrCode;
      state.pendingCopy = copyPaste;
      state.pollAttempts = 0;
      let qrSrc = qrCode;
      if (!/^(?:data:image\/|https?:\/\/)/i.test(qrSrc) && /^[A-Za-z0-9+/=]+$/.test(qrSrc)) qrSrc = 'data:image/png;base64,' + qrSrc;
      $('#pixQrImage').src = qrSrc;
      $('#pixQrImage').hidden = false;
      $('#pixCopyPaste').value = copyPaste;
      $('#checkoutTitle').textContent = 'Pague com PIX';
      $('#checkoutStatus').textContent = 'Escaneie o QR Code ou copie o PIX. O código de resgate só aparece após a confirmação.';
      try { localStorage.setItem(orderKey, JSON.stringify({ orderId, qrCode, copyPaste, cartSignature: cartSignature() })); } catch (_) { /* Optional. */ }
      await checkPaymentStatus();
      if (!state.redeemCode && !state.pollTimer) state.pollTimer = setInterval(checkPaymentStatus, 5000);
    } catch (error) {
      $('#checkoutTitle').textContent = 'Não foi possível gerar o PIX';
      $('#checkoutStatus').textContent = error.message + ' Nenhuma figurinha foi enviada.';
      $('#backToCart').hidden = false;
    } finally {
      $('#checkoutButton').disabled = false;
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'favorite') toggleFavorite(button.dataset.id);
    if (button.dataset.action === 'preview') openPreview(button.dataset.id);
    if (button.dataset.action === 'cart-add') addToCart(button.dataset.id);
    if (button.dataset.action === 'cart-remove') removeFromCart(button.dataset.id);
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
  $('#previewAddToCart').addEventListener('click', () => { if (state.current) { addToCart(state.current.id); $('#previewDialog').close(); openCart(); } });
  $('#cartButton').addEventListener('click', openCart);
  $('#themeToggle').addEventListener('click', () => {
    const light = document.documentElement.dataset.theme === 'light' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: light)').matches);
    const next = light ? 'dark' : 'light';
    try { localStorage.setItem(themeKey, next); } catch (_) { /* Optional preference. */ }
    applyTheme(next);
  });
  $('#closeCart').addEventListener('click', () => $('#cartDialog').close());
  $('#cartDialog').addEventListener('close', closeCart);
  $('#cartDialog').addEventListener('click', event => {
    if (event.target !== $('#cartDialog')) return;
    const rect = $('#cartDialog').getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('#cartDialog').close();
  });
  $('#continueShopping').addEventListener('click', () => $('#cartDialog').close());
  $('#backToCart').addEventListener('click', () => { $('#checkoutPanel').hidden = true; renderCart(); });
  $('#checkoutButton').addEventListener('click', startCheckout);
  $('#copyPixButton').addEventListener('click', () => copyText($('#pixCopyPaste').value, $('#checkoutStatus'), 'PIX copiado.'));
  $('#copyRedeemButton').addEventListener('click', () => copyText($('#redeemCode').textContent, $('#checkoutStatus'), 'Código de resgate copiado.'));

  window.addEventListener('storage', event => {
    if (event.key !== favoritesKey) return;
    try {
      const data = JSON.parse(event.newValue || '[]');
      if (Array.isArray(data)) { state.favorites = new Set(data.filter(id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id)).slice(0, 2000)); render(); }
    } catch (_) { /* Ignore invalid data from another tab. */ }
  });
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => {
    try { if (!localStorage.getItem(themeKey)) applyTheme('system'); } catch (_) { applyTheme('system'); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopMedia(); stopHoverVideos(); } });
  $('#currentYear').textContent = String(new Date().getFullYear());
  restoreTheme();
  restorePendingOrder();
  updateSavedCount();
  if (state.redeemCode) {
    setTimeout(async () => {
      await refreshRedeemStatus();
      if (!state.redeemCode) return;
      openCart();
      $('#checkoutPanel').scrollIntoView({ behavior: 'auto', block: 'start' });
    }, 80);
  }
  loadCatalog().catch(error => {
    state.loading = false;
    state.source = 'error';
    $('#reloadButton').disabled = false;
    $('#connectionBox').className = 'connection-box error';
    $('#connectionText').textContent = 'Falha inesperada ao carregar a galeria: ' + error.message;
    render();
  });
})();
