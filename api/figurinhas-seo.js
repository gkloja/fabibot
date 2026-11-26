const BACKEND = process.env.FABI_STICKERS_PUBLIC_URL || 'http://br2.bronxyshost.com:4009';
const SITE = 'https://www.fabibot.com.br';

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
function jsonLd(value) { return JSON.stringify(value).replace(/</g, '\\u003c'); }
function price(item) { return (Number(item.priceCents || (item.temAudio ? 20 : 10)) / 100).toFixed(2); }
function slugId(value) { return /^[a-zA-Z0-9_-]{1,80}$/.test(String(value || '')) ? String(value) : ''; }
function catalogRows(raw) { return Array.isArray(raw) ? raw : (raw && (raw.figurinhas || raw.data)) || []; }

async function loadCatalog() {
  const response = await fetch(BACKEND.replace(/\/$/, '') + '/figurinhas_loja.json', { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error('catalog_http_' + response.status);
  return catalogRows(await response.json()).filter(row => row && slugId(row.id) && /^[a-zA-Z0-9_-]+\.webp$/i.test(String(row.arquivo || '')));
}

function page(item) {
  const id = String(item.id);
  const description = String(item.descricao || item.description || `${item.temAudio ? 'Figurinha com áudio' : 'Figurinha sem áudio'} para WhatsApp da Fabi Bot.`).trim().slice(0, 300);
  const category = String(item.categoria || 'geral');
  const title = `${description.slice(0, 62)} | Figurinha ${id} — Fabi Bot`;
  const canonical = `${SITE}/figurinhas/${encodeURIComponent(id)}`;
  const media = item.posterUrl || (item.media && item.media.poster) || `${BACKEND}/figurinhas_media/${id}-poster.webp`;
  const offer = { '@type': 'Offer', price: price(item), priceCurrency: 'BRL', availability: 'https://schema.org/InStock', url: canonical };
  const schema = { '@context': 'https://schema.org', '@type': 'Product', name: description, description, category, sku: id, brand: { '@type': 'Brand', name: 'Fabi Bot' }, offers: offer };
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)} Categoria: ${esc(category)}. ${item.temAudio ? 'Figurinha com áudio por R$ 0,20.' : 'Figurinha sem áudio por R$ 0,10.'}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="product"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:site_name" content="Fabi Bot"><meta property="og:image" content="${esc(media)}"><meta name="twitter:card" content="summary_large_image"><script type="application/ld+json">${jsonLd(schema)}</script><style>body{margin:0;background:#10110f;color:#f5f5ed;font:16px/1.6 system-ui,sans-serif}main{width:min(760px,calc(100% - 36px));margin:48px auto}a{color:#b6ff5b}img{display:block;max-width:100%;width:480px;aspect-ratio:1;object-fit:contain;background:#fff;border-radius:18px;margin:24px 0}h1{font-size:clamp(30px,6vw,56px);line-height:1.02}p{color:#b8c0b1}.badge{display:inline-block;padding:8px 12px;border-radius:999px;background:#b6ff5b;color:#10110f;font-weight:800}.price{font-size:26px;font-weight:800;color:#b6ff5b}</style></head><body><main><p><a href="/figurinhas">← Voltar para a loja de figurinhas</a></p><p class="badge">${item.temAudio ? 'COM SOM' : 'SEM ÁUDIO'}</p><h1>${esc(description)}</h1><p>Figurinha ${esc(id)} · Categoria: ${esc(category)}</p><img src="${esc(media)}" alt="${esc(description)}" loading="eager"><p class="price">R$ ${esc(price(item).replace('.', ','))}</p><p>${item.temAudio ? 'Esta figurinha é uma sound sticker e preserva o áudio no envio pelo WhatsApp.' : 'Esta figurinha é enviada sem áudio.'}</p><p><a href="/figurinhas?sticker=${encodeURIComponent(id)}">Abrir a vitrine e adicionar ao carrinho</a></p></main></body></html>`;
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
