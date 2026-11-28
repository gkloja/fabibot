(function () {
  'use strict';
  const config = window.FABI_FIGURINHAS_CONFIG;
  const backend = new URL(config.backend.replace(/\/$/, '') + '/');
  const siteRoot = new URL(config.siteRoot);
  const cleanText = (value, max = 160) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
  const bool = value => value === true || value === 'true' || value === 1;
  const fileName = (value, kind = 'sticker') => {
    const pattern = kind === 'audio' ? /^[a-zA-Z0-9_-]+\.ogg$/i : /^[a-zA-Z0-9_-]+\.webp$/i;
    return pattern.test(String(value || '')) ? String(value) : '';
  };

  function proxyUrl(path) {
    const target = new URL(path, backend);
    const allowedMedia = target.pathname === '/figurinhas_packs.json' || /^\/figurinhas_loja(?:\.json|\/[a-zA-Z0-9_-]+\.(?:webp|ogg))$|^\/figurinhas_media\/[a-zA-Z0-9_-]+\.(?:mp4|webp)$|^\/figurinhas_creator\/[a-zA-Z0-9_-]+\.(?:mp4|webp)$/i.test(target.pathname);
    const allowedStoreApi = /^\/api\/figurinhas\/(?:gerar-pix|favoritar|visualizar|verificar-pagamento\/[a-f0-9-]{36})$/i.test(target.pathname);
    if (target.origin !== backend.origin || (!allowedMedia && !allowedStoreApi) || target.search || target.hash) throw new Error('Caminho de mídia ou checkout não permitido.');
    return config.proxy.replace(/\/$/, '') + '/' + backend.host + '/proxy?url=' + encodeURIComponent(target.href);
  }

  function localUrl(path) {
    const target = new URL(path, siteRoot);
    if (target.origin !== siteRoot.origin || !target.pathname.startsWith(siteRoot.pathname)) throw new Error('Caminho local não permitido.');
    return target.href;
  }

  async function limitedBytes(response, maxBytes, signal) {
    const length = Number(response.headers.get('content-length'));
    if (Number.isFinite(length) && length > maxBytes) {
      if (response.body) await response.body.cancel();
      throw new Error('A resposta excede o limite permitido.');
    }
    if (!response.body || typeof response.body.getReader !== 'function') {
      const buffer = new Uint8Array(await response.arrayBuffer());
      if (buffer.byteLength > maxBytes) throw new Error('A resposta excede o limite permitido.');
      return buffer;
    }
    const reader = response.body.getReader();
    const cancel = () => { reader.cancel().catch(() => {}); };
    signal.addEventListener('abort', cancel, { once: true });
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        if (signal.aborted) throw new Error('A leitura foi interrompida.');
        const { value, done } = await reader.read();
        if (signal.aborted) throw new Error('A leitura foi interrompida.');
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) { await reader.cancel(); throw new Error('A resposta excede o limite permitido.'); }
        chunks.push(value);
      }
      const result = new Uint8Array(total);
      let offset = 0;
      chunks.forEach(chunk => { result.set(chunk, offset); offset += chunk.byteLength; });
      return result;
    } finally {
      signal.removeEventListener('abort', cancel);
      reader.releaseLock();
    }
  }

  async function request(url, options = {}, timeoutMs = config.timeoutMs) {
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('O servidor demorou demais para responder. Tente novamente.')); }, timeoutMs);
    });
    const work = async () => {
      const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store', credentials: 'omit' });
      const bytes = await limitedBytes(response, 2 * 1024 * 1024, controller.signal);
      let payload;
      try { payload = JSON.parse(new TextDecoder().decode(bytes)); }
      catch (_) { throw new Error('A resposta do servidor não é um JSON válido.'); }
      if (!response.ok) {
        const error = new Error(cleanText(payload.error || payload.message || ('O servidor respondeu HTTP ' + response.status + '.'), 240));
        error.status = response.status;
        throw error;
      }
      return payload;
    };
    try { return await Promise.race([work(), timeout]); }
    catch (error) {
      if (controller.signal.aborted || error.name === 'AbortError') throw new Error('O servidor demorou demais para responder. Tente novamente.');
      if (error instanceof TypeError) throw new Error('Não foi possível acessar o backend. Confira a conexão e o proxy.');
      throw error;
    } finally { clearTimeout(timer); }
  }

  async function jsonRequest(url) { return request(url); }

  function normalizeCatalog(raw) {
    const rows = Array.isArray(raw) ? raw : (raw && (raw.figurinhas || raw.data));
    if (!Array.isArray(rows)) throw new Error('O catálogo precisa ser uma lista de figurinhas.');
    const seen = new Set();
    const result = rows.filter(row => row && typeof row === 'object').map(row => {
      const id = cleanText(row.id, 80);
      const arquivo = fileName(row.arquivo);
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || !arquivo || seen.has(id)) return null;
      seen.add(id);
      const audio = fileName(row.arquivoAudio, 'audio');
      const serverMedia = row.media && typeof row.media === 'object' ? row.media : {};
      return {
        id, nome: cleanText(row.nome || 'Figurinha ' + id), arquivo, arquivoAudio: audio,
        categoria: cleanText(row.categoria || 'geral', 60), destaque: row.destaque === true,
        tags: Array.isArray(row.tags) ? row.tags.slice(0, 30).map(tag => cleanText(tag, 60)) : [],
        author: cleanText(row.author || row.packname || 'Fabi Bot', 80),
        packname: cleanText(row.packname || 'Fabi Loja', 80),
        temAudio: bool(row.temAudio) && !!audio, isAnimated: bool(row.isAnimated),
        audioSeconds: Math.max(0, Number(row.audioSeconds) || 0), tamanho: Math.max(0, Number(row.tamanho) || 0),
        criadoEm: cleanText(row.criadoEm, 40), priceCents: Math.max(1, Number(row.priceCents || row.precoCentavos || (bool(row.temAudio) && !!audio ? 20 : 10)) || 10),
        compras: Math.max(0, Number(row.compras ?? row.salesCount) || 0), favoritos: Math.max(0, Number(row.favoritos ?? row.favoriteCount) || 0), visualizacoes: Math.max(0, Number(row.visualizacoes ?? row.views) || 0),
        fingerprint: cleanText(row.criadoEm, 40) + ':' + (Number(row.tamanho) || 0),
        media: {
          preview: cleanText(row.previewUrl || serverMedia.preview, 240),
          poster: cleanText(row.posterUrl || serverMedia.poster, 240),
          example: cleanText(row.exampleUrl || serverMedia.example, 240)
        }
      };
    }).filter(Boolean);
    if (rows.length > 0 && result.length === 0) throw new Error('O catálogo não contém registros válidos com ID e arquivo WebP.');
    return result;
  }

  async function catalog() {
    try { return { items: normalizeCatalog(await jsonRequest(proxyUrl('/figurinhas_loja.json'))), source: 'live', loadedAt: Date.now(), error: '' }; }
    catch (error) {
      try { return { items: normalizeCatalog(await jsonRequest(localUrl(config.snapshotPath))), source: 'snapshot', loadedAt: Date.now(), error: error.message }; }
      catch (_) { return { items: [], source: 'error', loadedAt: Date.now(), error: error.message }; }
    }
  }

  function normalizePacks(raw) {
    const rows = Array.isArray(raw) ? raw : [];
    const seen = new Set();
    return rows.filter(row => row && typeof row === 'object').map(row => {
      const id = cleanText(row.id, 80);
      const rawStickerIds = Array.isArray(row.stickerIds) ? row.stickerIds.map(value => cleanText(value, 80)) : [];
      const stickerIds = [...new Set(rawStickerIds.filter(value => /^[a-zA-Z0-9_-]{1,80}$/.test(value)))];
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || seen.has(id) || rawStickerIds.length < 2 || rawStickerIds.length > 30 || stickerIds.length !== rawStickerIds.length || row.published !== true) return null;
      seen.add(id);
      return {
        id, name: cleanText(row.name || 'Pack de figurinhas', 120), baseName: cleanText(row.baseName || row.name || 'Pack', 100),
        number: Math.max(0, Number(row.number) || 0), category: cleanText(row.category || 'geral', 60),
        description: cleanText(row.description || '', 240), coverId: stickerIds.includes(cleanText(row.coverId || '', 80)) ? cleanText(row.coverId, 80) : stickerIds[0], stickerIds,
        discountPercent: 15, createdAt: cleanText(row.createdAt, 40), publishedAt: cleanText(row.publishedAt, 40),
        published: true, salesCount: Math.max(0, Number(row.salesCount) || 0)
      };
    }).filter(Boolean);
  }

  async function packs() {
    try { return normalizePacks(await jsonRequest(proxyUrl('/figurinhas_packs.json'))); }
    catch (_) {
      try { return normalizePacks(await jsonRequest(localUrl('figurinhas_packs.json'))); }
      catch (_) { return []; }
    }
  }

  async function mediaIndex() {
    try { const data = await jsonRequest(localUrl(config.mediaIndexPath)); return data && typeof data === 'object' && !Array.isArray(data) ? data : {}; }
    catch (_) { return {}; }
  }

  async function creatorCatalog() {
    try {
      const payload = await request('/api/creator/creations?limit=60', {}, 8000);
      return (payload.creations || []).filter(row => row && row.status === 'publicada').map(row => {
        const communityId = String(row.id || '');
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(communityId)) return null;
        const id = 'creator_' + communityId;
        const poster = String(row.posterUrl || '');
        const preview = String(row.videoUrl || '');
        return {
          id, communityId, claimed: typeof row.claimed === 'boolean' ? row.claimed : null,
          nome: cleanText(row.title || 'Criação da comunidade', 80), arquivo: '', arquivoAudio: '',
          categoria: cleanText(row.category || 'comunidade', 60), destaque: false,
          tags: [ ...(Array.isArray(row.tags) ? row.tags : []), row.description || '', row.creator && (row.creator.displayName || row.creator.username) || '' ].map(tag => cleanText(tag, 60)).filter(Boolean),
          author: cleanText(row.creator && (row.creator.displayName || row.creator.username) || 'Criador Fabi', 80),
          packname: 'FabiBot Creator', temAudio: true, isAnimated: true, audioSeconds: 0, tamanho: 0,
          criadoEm: cleanText(row.createdAt, 40), priceCents: 20,
          compras: Math.max(0, Number(row.purchases) || 0), favoritos: 0,
          visualizacoes: Math.max(0, Number(row.views) || 0), source: 'community',
          creator: row.creator && typeof row.creator === 'object' ? row.creator : {},
          creatorSlug: cleanText(row.slug || '', 100),
          media: { poster: poster ? proxyUrl(poster) : '', preview: preview ? proxyUrl(preview) : '', example: preview ? proxyUrl(preview) : '' }
        };
      }).filter(Boolean);
    } catch (_) { return []; }
  }

  function mediaUrl(item, kind = 'sticker') {
    if (item.source === 'community') return item.media && (kind === 'audio' ? item.media.preview : item.media.poster) || '';
    const name = fileName(kind === 'audio' ? item.arquivoAudio : item.arquivo, kind);
    if (!name) throw new Error('Arquivo não disponível no catálogo.');
    return proxyUrl('/figurinhas_loja/' + name);
  }

  function staticMedia(item, index) {
    if (item.source === 'community' && item.media) return { poster: item.media.poster || '', preview: item.media.preview || '', example: item.media.example || '' };
    const result = {};
    if (item.media && typeof item.media === 'object') {
      for (const key of ['poster', 'preview', 'example']) {
        const mediaPath = item.media[key];
        const allowed = typeof mediaPath === 'string' && /^\/figurinhas_media\/[a-zA-Z0-9_-]+\.(?:mp4|webp)$/i.test(new URL(mediaPath, backend).pathname);
        if (allowed) result[key] = proxyUrl(mediaPath);
      }
      if (Object.keys(result).length) return result;
    }
    const entry = index[item.id];
    if (!entry || entry.fingerprint !== item.fingerprint) return {};
    for (const key of ['poster', 'preview', 'example']) {
      const mediaPath = entry[key];
      const allowed = typeof mediaPath === 'string' && (key === 'example'
        ? /^exemplo\/fig_\d{4}\.mp4$/i.test(mediaPath)
        : /^assets\/figurinhas-preview\/fig_\d{4}\.(?:webp|mp4)$/i.test(mediaPath));
      if (allowed) result[key] = localUrl(mediaPath);
    }
    return result;
  }

  function jsonApi(path, method, body) {
    return request(proxyUrl(path), {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    }, 30000);
  }

  async function createStickerOrder(items, payerEmail, requestId) {
    if (!Array.isArray(items) || items.length < 1 || items.length > 40) throw new Error('Selecione até 40 itens para o pedido.');
    const lineItems = items.map(item => {
      if (typeof item === 'string') return { type: 'sticker', id: item };
      return item && typeof item === 'object' ? { type: item.type, id: String(item.id || '') } : { type: '', id: '' };
    });
    const signatures = lineItems.map(item => item.type + ':' + item.id);
    if (lineItems.some(item => !['sticker', 'pack'].includes(item.type) || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id)) || new Set(signatures).size !== lineItems.length) throw new Error('O carrinho contém IDs inválidos ou repetidos.');
    const email = String(payerEmail || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Informe um e-mail válido para o pagamento.');
    const idempotencyRequest = String(requestId || '');
    if (!/^[a-f0-9-]{36}$/i.test(idempotencyRequest)) throw new Error('A solicitação do PIX expirou. Tente novamente.');
    return jsonApi('/api/figurinhas/gerar-pix', 'POST', { items: lineItems, payerEmail: email, requestId: idempotencyRequest });
  }

  async function recordFavorite(id, action, clientToken) { return jsonApi('/api/figurinhas/favoritar', 'POST', { id: String(id), action: action === 'remove' ? 'remove' : 'add', clientToken: String(clientToken) }); }
  async function recordView(id, clientToken) { return jsonApi('/api/figurinhas/visualizar', 'POST', { id: String(id), clientToken: String(clientToken) }); }
  function tutorialUrl() { return proxyUrl(config.tutorialVideoPath || '/figurinhas_media/tutorial-como-receber.mp4'); }

  async function creatorIdentity(token) {
    const value = String(token || '').trim();
    if (!value) return null;
    const response = await fetch('/api/creator/auth/me', {
      headers: { Authorization: 'Bearer ' + value },
      cache: 'no-store'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Sessão de criador indisponível.');
    return payload.user && typeof payload.user === 'object' ? payload.user : null;
  }

  async function creatorClaimLink(creationId, token) {
    const id = String(creationId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!id || !token) throw new Error('Entre no seu perfil de criador para receber esta figurinha.');
    const response = await fetch('/api/creator/creations/' + encodeURIComponent(id) + '/claim-link', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Não foi possível gerar o link de recebimento.');
    return payload;
  }

  async function checkStickerPayment(orderId) {
    const id = String(orderId || '');
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error('Identificador de pagamento inválido.');
    return jsonApi('/api/figurinhas/verificar-pagamento/' + encodeURIComponent(id), 'GET');
  }

  window.FabiStickerApi = { catalog, packs, creatorCatalog, mediaIndex, normalizeCatalog, normalizePacks, proxyUrl, localUrl, mediaUrl, staticMedia, tutorialUrl, createStickerOrder, recordFavorite, recordView, checkStickerPayment, creatorIdentity, creatorClaimLink };
})();
