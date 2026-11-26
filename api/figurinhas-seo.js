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
function mediaUrl(item, kind) {
  const media = item.media && typeof item.media === 'object' ? item.media : {};
  const raw = item[kind + 'Url'] || media[kind] || '';
  const path = String(raw || '');
  if (!/^\/figurinhas_media\/[a-zA-Z0-9_-]+\.(?:mp4|webp)$/i.test(path)) return '';
  return `${PROXY}/${new URL(BACKEND).host}/proxy?url=${encodeURIComponent(`${BACKEND.replace(/\/$/, '')}${path}`)}`;
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
  const poster = mediaUrl(item, 'poster') || `${BACKEND}/figurinhas_media/${id}-poster.webp`;
  const media = poster;
  const offer = { '@type': 'Offer', price: price(item), priceCurrency: 'BRL', availability: 'https://schema.org/InStock', url: canonical };
  const schema = { '@context': 'https://schema.org', '@type': 'Product', name: titleBase, description, category, keywords: tags.join(', '), sku: id, brand: { '@type': 'Brand', name: 'Fabi Bot' }, offers: offer };
  const video = example || preview;
  const mediaBlock = video
    ? `<div class="media-frame"><video class="example-video" controls playsinline preload="metadata" poster="${esc(poster)}" controlslist="nodownload noplaybackrate" disablepictureinpicture><source src="${esc(video)}" type="video/mp4"><img src="${esc(poster)}" alt="${esc(description)}"></video><span class="video-watermark" aria-hidden="true">FABI BOT</span><small>${example ? 'Exemplo no WhatsApp' : 'Prévia animada'}</small></div>`
    : `<div class="media-frame"><img src="${esc(poster)}" alt="${esc(description)}" loading="eager"><span class="video-watermark" aria-hidden="true">FABI BOT</span><small>Prévia da figurinha</small></div>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(metaDescription)}"><meta name="keywords" content="${esc(tags.join(', '))}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="product"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(metaDescription)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:site_name" content="Fabi Bot"><meta property="og:image" content="${esc(media)}"><meta name="twitter:card" content="summary_large_image"><script type="application/ld+json">${jsonLd(schema)}</script><style>body{margin:0;background:#10110f;color:#f5f5ed;font:16px/1.6 system-ui,sans-serif}main{width:min(760px,calc(100% - 36px));margin:48px auto}a{color:#b6ff5b}h1{font-size:clamp(30px,6vw,56px);line-height:1.02}.intro{color:#b8c0b1}.badge{display:inline-block;padding:8px 12px;border-radius:999px;background:#b6ff5b;color:#10110f;font-weight:800}.price{font-size:26px;font-weight:800;color:#b6ff5b}.tags{display:flex;flex-wrap:wrap;gap:8px}.tag{background:#242b21;border-radius:999px;padding:4px 10px;color:#d4f6ba}.media-frame{position:relative;max-width:560px;margin:24px 0;background:#fff;border-radius:18px;overflow:hidden}.media-frame video,.media-frame img{display:block;width:100%;aspect-ratio:1;object-fit:contain}.media-frame small{position:absolute;left:14px;bottom:12px;padding:5px 9px;border-radius:99px;background:#10110fe8;color:#fff;font-size:12px}.video-watermark{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;color:#10110f88;-webkit-text-stroke:1px #fff9;text-shadow:0 2px 5px #fff8;font:900 clamp(32px,8vw,76px)/1 system-ui,sans-serif;letter-spacing:.12em;transform:rotate(-24deg)}</style></head><body><main><p><a href="/figurinhas">← Voltar para a loja de figurinhas</a></p><p class="badge">${item.temAudio ? 'COM SOM' : 'SEM ÁUDIO'}</p><h1>${esc(titleBase)}</h1><p class="intro">${esc(description)}</p><p>Figurinha ${esc(id)} · Categoria: ${esc(category)}${character ? ` · Tema/personagem: ${esc(character)}` : ''}</p>${tags.length ? `<p class="tags">${tags.map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}</p>` : ''}${mediaBlock}<p class="price">R$ ${esc(price(item).replace('.', ','))}</p><p>${item.temAudio ? 'Esta figurinha é uma sound sticker e preserva o áudio no envio pelo WhatsApp.' : 'Esta figurinha é enviada sem áudio.'}</p><p><a href="/figurinhas?sticker=${encodeURIComponent(id)}">Abrir a vitrine e adicionar ao carrinho</a></p></main></body></html>`;
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
    if (!item) return res.status(404).setHeader('X-Robots-Tag', 'noindex').send('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Figurinha não encontrada | Fabi Bot</title><meta name="robots" content="noindex"></head><body><main><h1>Figurinha não encontrada</h1><p>Essa página não existe mais.</p><a href="/figurinhas">Voltar para a loja</a></main></body></html>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=900');
    return res.status(200).send(page(item));
  } catch (_) {
    return res.status(503).send('Catálogo temporariamente indisponível.');
  }
};
