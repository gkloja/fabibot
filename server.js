import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações
const TARGET_SITE = 'http://br2.bronxyshost.com:4009';

console.log(`
🎭 PROXY MÁSCARA TRANSPARENTE
=============================
🎯 Site Original: ${TARGET_SITE}
📍 Proxy Local:   http://localhost:${PORT}
🔗 Modo:          Máscara completa
`);

// ====================
// 1. MIDDLEWARE DE LOG SIMPLES
// ====================
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ${req.method} ${req.originalUrl}`);
  next();
});

// ====================
// 2. CONFIGURAÇÃO DO PROXY TRANSPARENTE
// ====================
const transparentProxy = createProxyMiddleware({
  target: TARGET_SITE,
  changeOrigin: true, // CRUCIAL: muda o Host header
  ws: true, // Para WebSockets
  xfwd: true, // Adiciona headers X-Forwarded-*
  
  // NÃO modificar caminhos - deixa tudo passar
  pathRewrite: {
    '^/': '/' // Mantém tudo igual
  },
  
  // Modificar headers para ser transparente
  onProxyReq: (proxyReq, req, res) => {
    // Log da requisição
    console.log(`🌐 ${req.method} ${req.originalUrl} -> ${TARGET_SITE}${req.originalUrl}`);
    
    // Headers para parecer que é o site original
    proxyReq.setHeader('Host', new URL(TARGET_SITE).host);
    proxyReq.setHeader('Origin', TARGET_SITE);
    proxyReq.setHeader('Referer', `${TARGET_SITE}/`);
    proxyReq.setHeader('X-Real-IP', req.ip);
    proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
    
    // Se for AJAX/JSON, manter headers
    if (req.headers['content-type']?.includes('application/json')) {
      proxyReq.setHeader('Content-Type', 'application/json');
    }
  },
  
  // Modificar resposta
  onProxyRes: (proxyRes, req, res) => {
    // Log da resposta
    console.log(`✅ ${proxyRes.statusCode} ${req.originalUrl} (${proxyRes.headers['content-type']?.split(';')[0] || 'unknown'})`);
    
    // REMOVER headers de segurança que bloqueiam
    delete proxyRes.headers['x-frame-options'];
    delete proxyRes.headers['content-security-policy'];
    delete proxyRes.headers['x-content-type-options'];
    
    // Permitir iframe (para embed se necessário)
    proxyRes.headers['x-frame-options'] = 'ALLOWALL';
    
    // Corrigir CORS para permitir tudo
    proxyRes.headers['access-control-allow-origin'] = '*';
    proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    proxyRes.headers['access-control-allow-headers'] = '*';
    
    // Para HTML, vamos modificar algumas coisas
    const contentType = proxyRes.headers['content-type'] || '';
    if (contentType.includes('text/html')) {
      // Vamos modificar o HTML depois
      let body = '';
      const originalWrite = res.write;
      const originalEnd = res.end;
      
      // Capturar o corpo da resposta
      res.write = function(chunk) {
        body += chunk.toString();
        return true;
      };
      
      res.end = function(chunk) {
        if (chunk) {
          body += chunk.toString();
        }
        
        // Modificar o HTML
        const modifiedBody = modifyHTML(body, req);
        
        // Restaurar métodos originais
        res.write = originalWrite;
        res.end = originalEnd;
        
        // Enviar HTML modificado
        res.setHeader('Content-Length', Buffer.byteLength(modifiedBody));
        res.end(modifiedBody);
      };
    }
  },
  
  // Tratar erros
  onError: (err, req, res) => {
    console.error(`❌ Erro no proxy: ${err.message}`);
    
    // Tentar fallback direto
    res.redirect(`${TARGET_SITE}${req.originalUrl}`);
  }
});

// ====================
// 3. FUNÇÃO PARA MODIFICAR HTML
// ====================
function modifyHTML(html, req) {
  let modified = html;
  
  // 1. Corrigir URLs absolutas que apontam para o site original
  modified = modified.replace(
    new RegExp(`href=["']${TARGET_SITE}`, 'g'),
    'href="/'
  );
  
  modified = modified.replace(
    new RegExp(`src=["']${TARGET_SITE}`, 'g'),
    'src="/'
  );
  
  // 2. Corrigir action de forms
  modified = modified.replace(
    new RegExp(`action=["']${TARGET_SITE}`, 'g'),
    'action="/'
  );
  
  // 3. Corrigir URLs em JavaScript (fetch, ajax)
  modified = modified.replace(
    new RegExp(`fetch\\(["']${TARGET_SITE}`, 'g'),
    'fetch("/'
  );
  
  modified = modified.replace(
    new RegExp(`["']${TARGET_SITE}`, 'g'),
    '"/'
  );
  
  // 4. Adicionar base tag se não existir
  if (!modified.includes('<base href')) {
    modified = modified.replace(
      /<head>/i,
      `<head>\n<base href="/">`
    );
  }
  
  // 5. Injeta um script para corrigir URLs dinamicamente
  const proxyScript = `
    <script>
      // Script do Proxy Máscara
      (function() {
        console.log('🔗 Proxy Máscara ativo - Site: ${TARGET_SITE}');
        
        // Corrigir todas as URLs dinamicamente
        document.addEventListener('DOMContentLoaded', function() {
          // Corrigir links
          document.querySelectorAll('a[href^="${TARGET_SITE}"]').forEach(link => {
            link.href = link.href.replace('${TARGET_SITE}', '/');
          });
          
          // Corrigir imagens
          document.querySelectorAll('img[src^="${TARGET_SITE}"]').forEach(img => {
            img.src = img.src.replace('${TARGET_SITE}', '/');
          });
          
          // Corrigir scripts
          document.querySelectorAll('script[src^="${TARGET_SITE}"]').forEach(script => {
            script.src = script.src.replace('${TARGET_SITE}', '/');
          });
          
          // Interceptar fetch/AJAX
          const originalFetch = window.fetch;
          window.fetch = function(url, options) {
            if (typeof url === 'string' && url.startsWith('${TARGET_SITE}')) {
              url = url.replace('${TARGET_SITE}', '/');
            }
            return originalFetch.call(this, url, options);
          };
          
          // Interceptar XMLHttpRequest
          const originalOpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function(method, url) {
            if (typeof url === 'string' && url.startsWith('${TARGET_SITE}')) {
              url = url.replace('${TARGET_SITE}', '/');
            }
            return originalOpen.apply(this, arguments);
          };
        });
        
        // Corrigir URLs na mudança de página (SPA)
        const originalPushState = history.pushState;
        history.pushState = function(state, title, url) {
          if (url && url.startsWith('${TARGET_SITE}')) {
            url = url.replace('${TARGET_SITE}', '/');
          }
          return originalPushState.call(this, state, title, url);
        };
        
        // Corrigir URLs na substituição de estado
        const originalReplaceState = history.replaceState;
        history.replaceState = function(state, title, url) {
          if (url && url.startsWith('${TARGET_SITE}')) {
            url = url.replace('${TARGET_SITE}', '/');
          }
          return originalReplaceState.call(this, state, title, url);
        };
      })();
    </script>
  `;
  
  // Injetar script antes do </body>
  if (modified.includes('</body>')) {
    modified = modified.replace('</body>', `${proxyScript}\n</body>`);
  } else {
    modified += proxyScript;
  }
  
  return modified;
}

// ====================
// 4. ROTAS ESPECIAIS PARA DEBUG
// ====================

// Health check
app.get('/_proxy/health', async (req, res) => {
  try {
    const response = await fetch(TARGET_SITE, { timeout: 3000 });
    res.json({
      proxy: 'active',
      target: TARGET_SITE,
      target_status: response.status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      proxy: 'active_but_target_down'
    });
  }
});

// Info do proxy
app.get('/_proxy/info', (req, res) => {
  res.json({
    name: 'Proxy Máscara Transparente',
    target: TARGET_SITE,
    mode: 'transparent_mirror',
    version: '1.0.0',
    description: 'Proxy que espelha completamente o site original'
  });
});

// Testar endpoint específico (para debug de grupos)
app.get('/_proxy/test/:endpoint', async (req, res) => {
  const endpoint = req.params.endpoint;
  const url = `${TARGET_SITE}/${endpoint}`;
  
  try {
    const response = await fetch(url);
    const data = await response.text();
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Teste: /${endpoint}</title>
        <style>
          body { font-family: monospace; padding: 20px; }
          pre { background: #f5f5f5; padding: 20px; border-radius: 5px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>Testando: ${url}</h1>
        <p><strong>Status:</strong> ${response.status}</p>
        <p><strong>Tipo:</strong> ${response.headers.get('content-type')}</p>
        <p><strong>Tamanho:</strong> ${data.length} bytes</p>
        <hr>
        <h3>Conteúdo (primeiros 2000 chars):</h3>
        <pre>${data.substring(0, 2000)}</pre>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send(`Erro: ${error.message}`);
  }
});

// ====================
// 5. APLICAR PROXY EM TUDO (exceto rotas especiais)
// ====================
app.use('*', (req, res, next) => {
  // Ignorar rotas de debug
  if (req.originalUrl.startsWith('/_proxy/')) {
    return next();
  }
  
  // Aplicar proxy transparente em tudo
  return transparentProxy(req, res, next);
});

// ====================
// 6. INICIAR SERVIDOR
// ====================
app.listen(PORT, () => {
  console.log(`
✅ PROXY MÁSCARA INICIADO!
=========================
🔗 Acesse o site através do proxy:
   http://localhost:${PORT}

🎯 O proxy irá mostrar:
   ${TARGET_SITE}

🔧 Rotas de debug:
   • http://localhost:${PORT}/_proxy/health
   • http://localhost:${PORT}/_proxy/info
   • http://localhost:${PORT}/_proxy/test/grupos.json

⚡ Tudo deve funcionar:
   ✓ Grupos
   ✓ Imagens  
   ✓ Chat
   ✓ Rankings
   ✓ Tigrinho
   ✓ Configurações

⏰ Iniciado em: ${new Date().toLocaleString('pt-BR')}
`);
});

// ====================
// 7. MANIPULAÇÃO DE SINAIS
// ====================
process.on('SIGINT', () => {
  console.log('\n\n🛑 Proxy encerrado pelo usuário');
  process.exit(0);
});
