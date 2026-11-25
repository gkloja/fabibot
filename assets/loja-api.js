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
    const allowedMedia = /^\/figurinhas_loja(?:\.json|\/[a-zA-Z0-9_-]+\.(?:webp|ogg))$/i.test(target.pathname);
    const allowedStoreApi = /^\/api\/figurinhas\/(?:gerar-pix|verificar-pagamento\/[a-f0-9-]{36})$/i.test(target.pathname);
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
      return {
        id, nome: cleanText(row.nome || 'Figurinha ' + id), arquivo, arquivoAudio: audio,
        categoria: cleanText(row.categoria || 'geral', 60),
        tags: Array.isArray(row.tags) ? row.tags.slice(0, 30).map(tag => cleanText(tag, 60)) : [],
        author: cleanText(row.author || row.packname || 'Fabi Bot', 80),
        packname: cleanText(row.packname || 'Fabi Loja', 80),
        temAudio: bool(row.temAudio) && !!audio, isAnimated: bool(row.isAnimated),
        audioSeconds: Math.max(0, Number(row.audioSeconds) || 0), tamanho: Math.max(0, Number(row.tamanho) || 0),
        criadoEm: cleanText(row.criadoEm, 40), priceCents: 20,
        fingerprint: cleanText(row.criadoEm, 40) + ':' + (Number(row.tamanho) || 0)
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

  async function mediaIndex() {
    try { const data = await jsonRequest(localUrl(config.mediaIndexPath)); return data && typeof data === 'object' && !Array.isArray(data) ? data : {}; }
    catch (_) { return {}; }
  }

  function mediaUrl(item, kind = 'sticker') {
    const name = fileName(kind === 'audio' ? item.arquivoAudio : item.arquivo, kind);
    if (!name) throw new Error('Arquivo não disponível no catálogo.');
    return proxyUrl('/figurinhas_loja/' + name);
  }

  function staticMedia(item, index) {
    const entry = index[item.id];
    if (!entry || entry.fingerprint !== item.fingerprint) return {};
    const result = {};
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
    if (!Array.isArray(items) || items.length < 1 || items.length > 40) throw new Error('Selecione de 1 a 40 figurinhas.');
    const ids = [...new Set(items.map(id => String(id)))];
    if (ids.length !== items.length || ids.some(id => !/^[a-zA-Z0-9_-]{1,80}$/.test(id))) throw new Error('O carrinho contém IDs inválidos ou repetidos.');
    const email = String(payerEmail || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Informe um e-mail válido para o pagamento.');
    const idempotencyRequest = String(requestId || '');
    if (!/^[a-f0-9-]{36}$/i.test(idempotencyRequest)) throw new Error('A solicitação do PIX expirou. Tente novamente.');
    return jsonApi('/api/figurinhas/gerar-pix', 'POST', { items: ids, payerEmail: email, requestId: idempotencyRequest });
  }

  async function checkStickerPayment(orderId) {
    const id = String(orderId || '');
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error('Identificador de pagamento inválido.');
    return jsonApi('/api/figurinhas/verificar-pagamento/' + encodeURIComponent(id), 'GET');
  }

  window.FabiStickerApi = { catalog, mediaIndex, normalizeCatalog, proxyUrl, localUrl, mediaUrl, staticMedia, createStickerOrder, checkStickerPayment };
})();
