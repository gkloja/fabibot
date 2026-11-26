const BACKEND = process.env.FABI_STICKERS_PUBLIC_URL || 'http://br2.bronxyshost.com:4009';
const SITE = 'https://www.fabibot.com.br';
const PROXY = process.env.FABI_STICKERS_PROXY_URL || 'https://orange-hill-2e61.gbscabral15.workers.dev';

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
function jsonLd(value) { return JSON.stringify(value).replace(/</g, '\\u003c'); }
function price(item) { return (Number(item.priceCents || (item.temAudio ? 20 : 10)) / 100).toFixed(2); }
function slugId(value) { return /^[a-zA-Z0-9_-]{1,80}$/.test(String(value || '')) ? String(value) : ''; }
function catalogRows(raw) { return Array.isArray(raw) ? raw : (raw && (raw.figurinhas || raw.data)) || []; }
function proxiedPath(path) {
  if (!/^\/figurinhas_media\/[a-zA-Z0-9_-]+\.(?:mp4|webp)$/i.test(String(path || ''))) return '';
  return `${PROXY.replace(/\/$/, '')}/${new URL(BACKEND).host}/proxy?url=${encodeURIComponent(`${BACKEND.replace(/\/$/, '')}${path}`)}`;
}
function mediaUrl(item, kind) {
  const media = item.media && typeof item.media === 'object' ? item.media : {};
  return proxiedPath(item[kind + 'Url'] || media[kind] || '');
}
function posterUrl(item, id) {
  return mediaUrl(item, 'poster') || proxiedPath(`/figurinhas_media/${id}-poster.webp`);
}

async function loadCatalog() {
  const response = await fetch(BACKEND.replace(/\/$/, '') + '/figurinhas_loja.json', { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error('catalog_http_' + response.status);
  return catalogRows(await response.json()).filter(row => row && slugId(row.id) && /^[a-zA-Z0-9_-]+\.webp$/i.test(String(row.arquivo || '')));
}

function page(item) {
  const id = String(item.id);
  const description = String(item.descricao || item.description || `${item.temAudio ? 'Figurinha com áudio' : 'Figurinha sem áudio'} para WhatsApp da Fabi Bot.`).trim().slice(0, 300);
  const category = String(item.categoria || 'geral');
  const titleBase = String(item.nome || description).trim().slice(0, 38);
  const title = `${titleBase} | Fabi Bot`;
  const tags = Array.isArray(item.tags) ? item.tags.map(String).filter(Boolean).slice(0, 8) : [];
  const character = String(item.personagem || '').trim();
  const metaDescription = `${description} Categoria ${category}. ${item.temAudio ? 'Com áudio por R$ 0,20.' : 'Sem áudio por R$ 0,10.'}`.slice(0, 155);
  const canonical = `${SITE}/figurinhas/${encodeURIComponent(id)}`;
  const example = mediaUrl(item, 'example');
  const preview = mediaUrl(item, 'preview');
  const poster = posterUrl(item, id);
  const offer = { '@type': 'Offer', price: price(item), priceCurrency: 'BRL', availability: 'https://schema.org/InStock', url: canonical, seller: { '@type': 'Organization', name: 'Fabi Bot', url: SITE } };
  const schema = { '@context': 'https://schema.org', '@type': 'Product', name: titleBase, description, category, keywords: tags.join(', '), sku: id, url: canonical, image: poster ? [poster] : undefined, brand: { '@type': 'Brand', name: 'Fabi Bot', logo: `${SITE}/assets/fabi-logo.webp` }, offers: offer };
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Figurinhas', item: `${SITE}/figurinhas` }, { '@type': 'ListItem', position: 2, name: titleBase, item: canonical }] };
  const video = example || preview;
  const mediaBlock = `<figure class="media-frame"><img src="${esc(poster)}" alt="${esc(description)}" width="480" height="480" loading="eager" fetchpriority="high"><span class="video-watermark" aria-hidden="true">FABI BOT</span><figcaption>Prévia da figurinha${video ? ' · veja também o exemplo no WhatsApp abaixo' : ''}</figcaption></figure>${video ? `<details class="example-details"><summary>Ver exemplo no WhatsApp</summary><video controls playsinline preload="metadata" poster="${esc(poster)}" width="480" height="480"><source src="${esc(video)}" type="video/mp4"></video></details>` : ''}`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(metaDescription)}"><meta name="keywords" content="${esc(tags.join(', '))}"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="theme-color" content="#b6ff5b"><link rel="canonical" href="${esc(canonical)}"><link rel="icon" type="image/png" href="${SITE}/assets/fabi-favicon.png"><link rel="apple-touch-icon" href="${SITE}/apple-touch-icon.png"><meta property="og:type" content="product"><meta property="og:locale" content="pt_BR"><meta property="og:site_name" content="Fabi Bot"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(metaDescription)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(poster)}"><meta property="og:image:secure_url" content="${esc(poster)}"><meta property="og:image:type" content="image/webp"><meta property="og:image:width" content="480"><meta property="og:image:height" content="480"><meta property="og:image:alt" content="${esc(titleBase)} — figurinha da Fabi Bot"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(metaDescription)}"><meta name="twitter:image" content="${esc(poster)}"><meta name="twitter:image:alt" content="${esc(titleBase)} — figurinha da Fabi Bot"><script type="application/ld+json">${jsonLd(schema)}</script><script type="application/ld+json">${jsonLd(breadcrumb)}</script><style>
:root{--ink:#11140f;--paper:#f5f7ee;--green:#b6ff5b;--deep:#103b25;--muted:#687463;--line:#dce4d5}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 85% 8%,#dfffad 0,transparent 24rem),var(--paper);color:var(--ink);font:16px/1.6 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.detail-header{width:min(1180px,calc(100% - 40px));margin:auto;padding:22px 0;display:flex;align-items:center;justify-content:space-between;gap:20px}.detail-brand{display:inline-flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none}.detail-brand img{width:44px;height:44px;border-radius:13px}.detail-brand strong{display:block;font-size:18px;letter-spacing:-.06em;line-height:1}.detail-brand strong span{color:#48a928}.detail-brand small{display:block;color:var(--muted);font-size:9px;font-weight:900;letter-spacing:.18em}.detail-back{color:var(--deep);font-weight:800;text-decoration:none}.detail-main{width:min(1180px,calc(100% - 40px));margin:30px auto 90px}.detail-layout{display:grid;grid-template-columns:minmax(320px,1.05fr) minmax(300px,.95fr);gap:clamp(36px,7vw,100px);align-items:center}.detail-copy{max-width:560px}.eyebrow{margin:0 0 16px;color:#4a8c2b;font-size:12px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}h1{margin:0;font-size:clamp(42px,7vw,88px);line-height:.94;letter-spacing:-.075em}.intro{margin:24px 0;color:var(--muted);font-size:18px}.badge{display:inline-flex;padding:7px 12px;border-radius:999px;background:var(--green);font-weight:900}.tags{display:flex;flex-wrap:wrap;gap:8px}.tag{padding:4px 10px;border-radius:999px;background:#e5efd9;color:var(--deep);font-size:13px;font-weight:700}.media-frame{position:relative;overflow:hidden;max-width:580px;margin:0;border:10px solid #fff;border-radius:34px;background:#e8eee1;box-shadow:18px 22px 0 var(--green),0 28px 70px #18321e24;transform:rotate(-2deg)}.media-frame img{display:block;width:100%;aspect-ratio:1;object-fit:cover}.media-frame figcaption{position:absolute;left:14px;bottom:12px;padding:5px 9px;border-radius:99px;background:#10110fe8;color:#fff;font-size:12px}.video-watermark{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;color:#10110f66;-webkit-text-stroke:1px #fff9;text-shadow:0 2px 5px #fff8;font:900 clamp(32px,8vw,76px)/1 system-ui,sans-serif;letter-spacing:.12em;transform:rotate(-24deg)}.example-details{max-width:580px;margin:26px 0}.example-details summary{cursor:pointer;color:var(--deep);font-weight:900}.example-details video{display:block;width:100%;margin-top:12px;border-radius:20px;background:#10110f}.price-card{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:30px;padding:18px 20px;border-radius:20px;background:var(--deep);color:#fff}.price-card small{display:block;color:#d4ead3}.price-card strong{display:block;color:var(--green);font-size:28px}.detail-button{display:inline-flex;padding:14px 18px;border-radius:999px;background:var(--green);color:var(--ink);font-weight:900;text-decoration:none}.detail-button:hover{filter:brightness(1.06);transform:translateY(-1px)}.detail-footer{width:min(1180px,calc(100% - 40px));margin:auto;padding:24px 0 50px;border-top:1px solid var(--line);color:var(--muted)}.detail-footer a{color:var(--deep);font-weight:800}@media(max-width:760px){.detail-header{width:calc(100% - 28px);align-items:flex-start;flex-direction:column}.detail-main{width:calc(100% - 28px);margin-top:18px}.detail-layout{grid-template-columns:1fr}.media-frame{order:-1;box-shadow:10px 14px 0 var(--green)}h1{font-size:clamp(42px,14vw,70px)}.price-card{align-items:flex-start;flex-direction:column}.detail-footer{width:calc(100% - 28px)}}
</style></head><body><header class="detail-header"><a class="detail-brand" href="/figurinhas" aria-label="Voltar para a loja de figurinhas"><img src="${SITE}/assets/fabi-logo.webp" alt="Fabi Bot" width="44" height="44"><span><strong>FABI<span>BOT</span></strong><small>FIGURINHAS</small></span></a><a class="detail-back" href="/figurinhas">← Voltar para a vitrine</a></header><main class="detail-main"><div class="detail-layout"><section class="detail-copy" aria-labelledby="sticker-title"><p class="eyebrow">${item.temAudio ? 'Figurinha com áudio' : 'Figurinha sem áudio'}</p><span class="badge">${item.temAudio ? 'COM SOM · R$ 0,20' : 'SEM ÁUDIO · R$ 0,10'}</span><h1 id="sticker-title">${esc(titleBase)}</h1><p class="intro">${esc(description)}</p><p>Figurinha <strong>${esc(id)}</strong> · Categoria: <strong>${esc(category)}</strong>${character ? ` · Tema: <strong>${esc(character)}</strong>` : ''}</p>${tags.length ? `<div class="tags" aria-label="Tags da figurinha">${tags.map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}</div>` : ''}<div class="price-card"><div><small>Disponível para resgate no WhatsApp</small><strong>R$ ${esc(price(item).replace('.', ','))}</strong></div><a class="detail-button" href="/figurinhas?sticker=${encodeURIComponent(id)}">Adicionar ao carrinho</a></div></section><section aria-label="Prévia da figurinha">${mediaBlock}</section></div></main><footer class="detail-footer"><a href="/figurinhas">← Explorar todas as figurinhas</a><p>Fabi Bot · figurinhas com personalidade para suas conversas no WhatsApp.</p></footer></body></html>`;
}

function sitemap(rows) {
  const urls = rows.map(item => `<url><loc>${SITE}/figurinhas/${encodeURIComponent(item.id)}</loc><lastmod>${esc(item.atualizadoEm || item.criadoEm || new Date().toISOString())}</lastmod></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE}/figurinhas</loc></url>${urls}</urlset>`;
}

module.exports = async (req, res) => {
  try {
    const rows = await loadCatalog();
    if (String(req.query.mode || '') === 'sitemap') {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=900');
      return res.status(200).send(sitemap(rows));
    }
    const id = slugId(req.query.id || String(req.url || '').split('/').filter(Boolean).pop());
    const item = rows.find(row => String(row.id) === id);
    if (!item) return res.status(404).setHeader('X-Robots-Tag', 'noindex, nofollow').send('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Figurinha não encontrada | Fabi Bot</title><meta name="robots" content="noindex, nofollow"><link rel="icon" href="/assets/fabi-favicon.png"></head><body><main><h1>Figurinha não encontrada</h1><p>Essa página não existe mais ou o código foi digitado incorretamente.</p><a href="/figurinhas">Voltar para a loja</a></main></body></html>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=900');
    return res.status(200).send(page(item));
  } catch (_) {
    return res.status(503).send('Catálogo temporariamente indisponível.');
  }
};
