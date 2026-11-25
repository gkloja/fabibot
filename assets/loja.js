(function () {
  'use strict';
  const api = window.FabiStickerApi;
  const config = window.FABI_FIGURINHAS_CONFIG;
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const icon = name => '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  const fold = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const favoritesKey = 'fabi_sticker_favorites_v1';
  const cartKey = 'fabi_sticker_cart_v1';
  const orderKey = 'fabi_sticker_pending_order_v1';
  const fixedPriceCents = 20;
  const storeWhatsapp = String(config.storeWhatsapp || '5592985715119').replace(/\D/g, '');
  const state = { items: [], index: {}, filter: 'all', query: '', category: 'all', sort: 'recent', limit: config.pageSize, favorites: new Set(), cart: new Set(), current: null, source: 'loading', loading: false, activeTab: 'preview', toastTimer: null, lastFocused: null, previewGeneration: 0, mediaGeneration: 0, audioSource: '', activeOrderId: '', pollTimer: null, pollAttempts: 0, pendingQr: '', pendingCopy: '', redeemCode: '' };
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

  function updateAudioDemoButton(playing) {
    const button = $('#audioDemoButton');
    if (!button) return;
    button.setAttribute('aria-pressed', String(playing));
    button.innerHTML = icon(playing ? 'sound' : 'play') + (playing ? 'Pausar figurinha com áudio' : 'Ouvir figurinha com áudio');
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
      '<div class="card-info"><div class="card-kicker"><span>' + escape(item.id.replace('_', ' #')) + '</span><span>R$ 0,20</span></div>' +
      '<h3 class="card-title" title="' + escape(item.nome) + '">' + escape(item.nome) + '</h3><div class="card-bottom">' +
      '<span class="audio-badge">' + icon(item.temAudio ? 'sound' : 'play') + (item.temAudio ? 'Com áudio' : item.isAnimated ? 'Animada' : 'Estática') + '</span>' +
      '<button class="card-cart-button" type="button" data-action="cart-add" data-id="' + escape(item.id) + '" aria-pressed="' + inCart + '">' + (inCart ? 'No carrinho ✓' : '+ Carrinho') + '</button></div>' +
      '<button class="card-view-button" type="button" data-action="preview" data-id="' + escape(item.id) + '">Ver detalhes' + icon('arrow') + '</button></div></article>';
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
          '<span class="hero-card-label">R$ 0,20 · ADICIONE</span></button>';
      }).join('');
      bindImageFallbacks(collage);
    }
    $('#heroCount').textContent = state.items.length ? state.items.length + ' figurinhas · R$ 0,20 cada' : 'Seu próximo meme está aqui';
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
  }

  function setFilter(filter) {
    state.filter = filter;
    state.limit = config.pageSize;
    render();
  }

  function stopMedia() {
    $('#stickerAudio').pause();
    updateAudioDemoButton(false);
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
      video.playsInline = true;
      video.preload = 'metadata';
      video.src = media.example;
      video.setAttribute('aria-label', 'Exemplo de uso no WhatsApp');
      video.addEventListener('play', () => $('#stickerAudio').pause());
      video.addEventListener('error', () => {
        if (state.current !== item || state.activeTab !== tab || state.mediaGeneration !== mediaGeneration || !container.contains(video)) return;
        showPreviewMedia('preview');
        $('#previewMediaNote').textContent = 'O vídeo de conversa não está disponível agora. Veja a animação original e ouça o áudio junto.';
      }, { once: true });
      container.appendChild(video);
      $('#previewMediaNote').textContent = 'Exemplo de conversa no WhatsApp. Toque em play para assistir.';
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
    $('#previewId').textContent = item.id.toUpperCase();
    $('#previewTitle').textContent = item.nome;
    $('#previewBadges').innerHTML = [item.temAudio ? 'Com áudio' : 'Sem áudio', item.isAnimated ? 'Animada' : 'Estática', item.categoria].map(label => '<span>' + escape(label) + '</span>').join('');
    $('#previewMeta').textContent = [item.packname, item.tamanho ? Math.round(item.tamanho / 1024) + ' KB' : '', item.audioSeconds ? item.audioSeconds.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' s de áudio' : ''].filter(Boolean).join(' · ');
    $('#previewStatus').textContent = state.source !== 'live' ? 'Prévia do pacote local. O checkout exige conexão ativa com o catálogo do bot.' : '';
    $('#audioSection').hidden = !item.temAudio;
    $('#audioError').hidden = true;
    $('#audioDemoButton').disabled = !item.temAudio;
    updateAudioDemoButton(false);
    const audio = $('#stickerAudio');
    audio.pause();
    state.audioSource = item.temAudio ? api.mediaUrl(item, 'audio') : '';
    if (item.temAudio) audio.src = state.audioSource; else audio.removeAttribute('src');
    audio.load();
    $('#exampleTab').disabled = !api.staticMedia(item, state.index).example;
    $('#previewAddToCart').setAttribute('aria-pressed', String(state.cart.has(item.id)));
    $('#previewAddToCart').textContent = state.cart.has(item.id) ? 'No carrinho · R$ 0,20' : 'Adicionar ao carrinho · R$ 0,20';
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
    state.audioSource = '';
    $('#stickerAudio').removeAttribute('src');
    $('#stickerAudio').load();
    document.body.classList.remove('modal-open');
    state.current = null;
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
      $('#previewAddToCart').textContent = inCart ? 'No carrinho · R$ 0,20' : 'Adicionar ao carrinho · R$ 0,20';
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
    $('#cartTotal').textContent = formatMoney(items.length * fixedPriceCents);
    $('#cartItems').innerHTML = items.map(item => {
      const media = api.staticMedia(item, state.index);
      const image = media.poster || (state.source === 'live' ? api.mediaUrl(item) : '');
      return '<div class="cart-line"><div class="cart-thumb">' + (image ? '<img src="' + escape(image) + '" alt="" loading="lazy"><span class="watermark" aria-hidden="true">FABI BOT</span>' : '') + '</div><div class="cart-line-info"><strong>' + escape(item.nome) + '</strong><small>' + escape(item.id) + ' · R$ 0,20</small></div><button class="cart-remove" type="button" data-action="cart-remove" data-id="' + escape(item.id) + '" aria-label="Remover ' + escape(item.nome) + '">Remover</button></div>';
    }).join('');
    if (state.source !== 'live') $('#checkoutStatus').textContent = 'Checkout indisponível: conecte-se ao catálogo ao vivo do bot.';
    updateCartButtons();
  }

  function addToCart(id) {
    const item = state.items.find(entry => entry.id === id);
    if (!item) return;
    if (state.cart.has(id)) { toast('Essa figurinha já está no carrinho.'); return; }
    if (state.cart.size >= 40) { toast('O carrinho aceita até 40 figurinhas por pedido.'); return; }
    state.cart.add(id);
    renderCart();
    render();
    toast('Adicionada ao carrinho · R$ 0,20.');
  }

  function removeFromCart(id) {
    state.cart.delete(id);
    renderCart();
    render();
  }

  function restorePendingOrder() {
    try {
      const saved = JSON.parse(localStorage.getItem(orderKey) || 'null');
      if (!saved || !/^[a-f0-9-]{36}$/i.test(saved.orderId || '')) return;
      state.activeOrderId = saved.orderId;
      state.pendingQr = saved.qrCode || '';
      state.pendingCopy = saved.copyPaste || '';
      state.redeemCode = typeof saved.redeemCode === 'string' ? saved.redeemCode : '';
    } catch (_) { /* Ignore corrupt local order data. */ }
  }

  function openCart() {
    if (!$('#cartDialog').open) $('#cartDialog').showModal();
    document.body.classList.add('modal-open');
    $('#closeCart').focus();
    if (state.redeemCode) {
      $('#cartSummary').hidden = true; $('#cartEmpty').hidden = true; $('#checkoutPanel').hidden = false;
      $('#checkoutTitle').textContent = 'Pagamento confirmado';
      $('#checkoutStatus').textContent = 'Código de resgate pronto para enviar no WhatsApp.';
      $('#redeemCode').textContent = state.redeemCode; $('#redeemCodeBox').hidden = false;
      $('#sendRedeemToWhatsApp').href = 'https://wa.me/' + storeWhatsapp + '?text=' + encodeURIComponent(state.redeemCode);
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
    $('#checkoutStatus').textContent = 'Seu código de resgate está pronto. Envie-o no privado da Fabi Bot.';
    $('#sendRedeemToWhatsApp').href = 'https://wa.me/' + storeWhatsapp + '?text=' + encodeURIComponent(code);
    state.cart.clear();
    persistCart();
    renderCart();
    try { localStorage.setItem(orderKey, JSON.stringify({ orderId: state.activeOrderId, qrCode: state.pendingQr, copyPaste: state.pendingCopy, redeemCode: code })); } catch (_) { /* Optional. */ }
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
      try { localStorage.setItem(orderKey, JSON.stringify({ orderId, qrCode, copyPaste })); } catch (_) { /* Optional. */ }
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
  $('#stickerAudio').addEventListener('play', () => $('#previewMedia').querySelectorAll('video').forEach(video => video.pause()));
  $('#audioDemoButton').addEventListener('click', async () => {
    if (!state.current || !state.current.temAudio) return;
    const audio = $('#stickerAudio');
    if (!audio.paused) { audio.pause(); return; }
    if (state.activeTab !== 'preview') showPreviewMedia('preview');
    $('#audioError').hidden = true;
    try { await audio.play(); }
    catch (_) { $('#audioError').hidden = false; updateAudioDemoButton(false); }
  });
  $('#stickerAudio').addEventListener('play', () => updateAudioDemoButton(true));
  $('#stickerAudio').addEventListener('pause', () => updateAudioDemoButton(false));
  $('#stickerAudio').addEventListener('ended', () => updateAudioDemoButton(false));
  $('#stickerAudio').addEventListener('error', event => {
    if (state.current && state.current.temAudio && state.audioSource && event.currentTarget.currentSrc === state.audioSource) $('#audioError').hidden = false;
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
  restorePendingOrder();
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
