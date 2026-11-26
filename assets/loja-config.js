/* Configuração pública. Não coloque senhas, tokens ou chaves de API neste arquivo. */
(function () {
  'use strict';
  const script = document.currentScript;
  const siteRoot = new URL('../', script ? script.src : new URL('assets/loja-config.js', location.href));
  window.FABI_FIGURINHAS_CONFIG = Object.assign({
    backend: window.API_BACKEND || 'http://br2.bronxyshost.com:4009',
    proxy: window.PROXY_HOST || 'https://orange-hill-2e61.gbscabral15.workers.dev',
    siteRoot: siteRoot.href,
    catalogPath: '/figurinhas_loja.json',
    snapshotPath: 'assets/figurinhas-preview/catalogo.json',
    mediaIndexPath: 'assets/figurinhas-preview/media-index.json',
    timeoutMs: 18000,
    pageSize: 24,
    priceCents: 20,
    storeWhatsapp: '5592985715119',
    supportWhatsapp: '5521989047220'
  }, window.FABI_FIGURINHAS_CONFIG || {});
})();
