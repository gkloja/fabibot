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
    if (target.origin !== backend.origin || !/^\/figurinhas_loja(?:\.json$|\/)/.test(target.pathname)) throw new Error('Caminho de mídia não permitido.');
    return config.proxy.replace(/\/$/, '') + '/' + backend.host + '/proxy?url=' + encodeURIComponent(target.href);
  }

  function localUrl(path) {
    const target = new URL(path, siteRoot);
    if (target.origin !== siteRoot.origin || !target.pathname.startsWith(siteRoot.pathname)) throw new Error('Caminho local não permitido.');
    return target.href;
  }

  async function request(url, consume, timeoutMs = config.timeoutMs) {
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('O servidor demorou demais para responder. Tente novamente.'));
      }, timeoutMs);
    });
    const work = async () => {
      const response = await fetch(url, { signal: controller.signal, cache: 'no-store', credentials: 'omit' });
      if (!response.ok) {
        const error = new Error(response.status === 403 ? 'O proxy recusou a conexão (HTTP 403).' : 'O servidor respondeu HTTP ' + response.status + '.');
        error.status = response.status;
        throw error;
      }
      return consume(response, controller.signal);
    };
    try { return await Promise.race([work(), timeout]); }
    catch (error) {
      if (controller.signal.aborted || error.name === 'AbortError') throw new Error('O servidor demorou demais para responder. Tente novamente.');
      if (error instanceof TypeError) throw new Error('Não foi possível acessar o backend. Confira a conexão e o proxy.');
      throw error;
    } finally { clearTimeout(timer); }
  }

  async function limitedBytes(response, maxBytes, signal) {
    const length = Number(response.headers.get('content-length'));
    if (Number.isFinite(length) && length > maxBytes) {
      if (response.body) await response.body.cancel();
      throw new Error('O arquivo excede o limite de tamanho permitido.');
    }
    if (!response.body || typeof response.body.getReader !== 'function') {
      const buffer = new Uint8Array(await response.arrayBuffer());
      if (buffer.byteLength > maxBytes) throw new Error('O arquivo excede o limite de tamanho permitido.');
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
        if (total > maxBytes) { await reader.cancel(); throw new Error('O arquivo excede o limite de tamanho permitido.'); }
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

  function jsonRequest(url) {
    return request(url, async (response, signal) => {
      const bytes = await limitedBytes(response, 2 * 1024 * 1024, signal);
      try { return JSON.parse(new TextDecoder().decode(bytes)); }
      catch (_) { throw new Error('A resposta não é um JSON válido. Confira o catálogo e o proxy.'); }
    });
  }

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
      const price = Number(row.preco);
      const priceCents = row.preco !== undefined && row.preco !== null && row.preco !== '' && Number.isFinite(price) && price >= 0 ? Math.round(price * 100) : null;
      return {
        id, nome: cleanText(row.nome || 'Figurinha ' + id), arquivo, arquivoAudio: audio,
        categoria: cleanText(row.categoria || 'geral', 60),
        tags: Array.isArray(row.tags) ? row.tags.slice(0, 30).map(tag => cleanText(tag, 60)) : [],
        author: cleanText(row.author || row.packname || 'Fabi Bot', 80),
        packname: cleanText(row.packname || 'Fabi Loja', 80),
        temAudio: bool(row.temAudio) && !!audio, isAnimated: bool(row.isAnimated),
        audioSeconds: Math.max(0, Number(row.audioSeconds) || 0), tamanho: Math.max(0, Number(row.tamanho) || 0),
        criadoEm: cleanText(row.criadoEm, 40), priceCents,
        fingerprint: cleanText(row.criadoEm, 40) + ':' + (Number(row.tamanho) || 0)
      };
    }).filter(Boolean);
    if (rows.length > 0 && result.length === 0) throw new Error('O catálogo não contém registros válidos com ID e arquivo WebP.');
    return result;
  }

  async function catalog() {
    try { return { items: normalizeCatalog(await jsonRequest(proxyUrl(config.catalogPath))), source: 'live', loadedAt: Date.now(), error: '' }; }
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
      if (typeof entry[key] === 'string' && /^assets\/figurinhas-(?:preview|exemplos)\/[a-zA-Z0-9_-]+\.(?:webp|mp4)$/.test(entry[key])) result[key] = localUrl(entry[key]);
    }
    return result;
  }

  async function download(item, kind = 'sticker') {
    if (item.priceCents !== 0) throw new Error('O backend não possui checkout para esse item. Apenas a prévia está disponível.');
    const name = fileName(kind === 'audio' ? item.arquivoAudio : item.arquivo, kind);
    if (!name) throw new Error('O download aceita apenas figurinha WebP e áudio OGG.');
    const bytes = await request(mediaUrl(item, kind), async (response, signal) => {
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (/text\/|json|xml|html/.test(contentType)) throw new Error('O proxy retornou uma página em vez do arquivo. O download foi cancelado.');
      return limitedBytes(response, 30 * 1024 * 1024, signal);
    }, config.downloadTimeoutMs);
    if (!bytes.length) throw new Error('O arquivo recebido está vazio.');
    const ascii = String.fromCharCode(...bytes.slice(0, 16));
    if (kind === 'sticker' && !(ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP')) throw new Error('A resposta não contém uma figurinha WebP válida.');
    if (kind === 'audio' && !ascii.startsWith('OggS')) throw new Error('A resposta não contém um áudio OGG válido.');
    const blob = new Blob([bytes], { type: kind === 'audio' ? 'audio/ogg' : 'image/webp' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; anchor.rel = 'noopener';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { name, bytes: blob.size };
  }

  window.FabiStickerApi = { catalog, mediaIndex, normalizeCatalog, proxyUrl, localUrl, mediaUrl, staticMedia, download };
})();
