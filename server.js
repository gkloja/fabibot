import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

const BASE = "http://br2.bronxyshost.com:4009";
const MASK = "https://fabibot.onrender.com";

// ===== MIDDLEWARE PARA LOGS =====
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// ===== PROXY PARA ARQUIVOS DE MÍDIA =====
// Isso é CRÍTICO para vídeos funcionarem
app.get(/\.(mp4|m3u8|m3u|ts|avi|mkv|mov|wmv|flv|webm)$/, async (req, res) => {
  try {
    const originalUrl = req.url;
    console.log(`🎥 Proxy de mídia: ${originalUrl}`);
    
    // Construir URL completa para o backend
    let targetUrl;
    if (originalUrl.startsWith('http')) {
      // Se já é uma URL completa (pode vir do player)
      targetUrl = originalUrl;
    } else {
      // URL relativa
      targetUrl = BASE + originalUrl;
    }
    
    console.log(`🎬 Carregando mídia de: ${targetUrl}`);
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'Referer': BASE + '/',
      'Origin': BASE,
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache'
    };
    
    // Copiar range headers para suporte a streaming
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }
    
    const response = await fetch(targetUrl, {
      headers: headers,
      redirect: 'follow'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Copiar headers importantes
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    const acceptRanges = response.headers.get('accept-ranges');
    const contentRange = response.headers.get('content-range');
    
    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
    if (contentRange) res.setHeader('Content-Range', contentRange);
    
    // Headers para streaming
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Stream a resposta
    response.body.pipe(res);
    
  } catch (error) {
    console.error(`❌ Erro no proxy de mídia: ${error.message}`);
    res.status(500).send(`Erro ao carregar mídia: ${error.message}`);
  }
});

// ===== PROXY PARA STREAM HLS/M3U8 =====
app.get(/\.(m3u8|m3u)$/i, async (req, res) => {
  try {
    const originalUrl = req.url;
    console.log(`📡 Proxy HLS: ${originalUrl}`);
    
    // Construir URL para o backend
    let targetUrl;
    if (originalUrl.includes('://')) {
      targetUrl = originalUrl;
    } else {
      targetUrl = BASE + originalUrl;
    }
    
    console.log(`📺 Carregando playlist HLS: ${targetUrl}`);
    
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Referer': BASE + '/'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    let playlistContent = await response.text();
    
    // Substituir URLs relativas na playlist HLS
    const basePath = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
    playlistContent = playlistContent.replace(/(\n|^)(?!http)(.*\.ts)/g, (match, prefix, tsFile) => {
      return prefix + MASK + '/proxy-media?url=' + encodeURIComponent(basePath + tsFile);
    });
    
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(playlistContent);
    
  } catch (error) {
    console.error(`❌ Erro no proxy HLS: ${error.message}`);
    res.status(500).send(`#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-ENDLIST\n`);
  }
});

// ===== PROXY GENÉRICO PARA MÍDIA =====
app.get('/proxy-media', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).send('URL requerida');
    }
    
    console.log(`🔄 Proxy media: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Referer': BASE + '/'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Copiar headers
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    
    // Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    
    // Stream a resposta
    response.body.pipe(res);
    
  } catch (error) {
    console.error(`❌ Erro proxy-media: ${error.message}`);
    res.status(500).send('Erro ao carregar mídia');
  }
});

// ===== ROTA PRINCIPAL PARA STREAMPRO =====
app.get("/streampro", async (req, res) => {
  try {
    console.log(`🎬 StreamPro: Proxying para ${BASE}/streampro`);
    
    const headers = { 
      ...req.headers,
      "host": new URL(BASE).host,
      "origin": BASE,
      "referer": BASE + "/",
      "x-forwarded-for": req.ip,
      "x-real-ip": req.ip
    };
    
    delete headers["content-length"];
    
    const response = await fetch(BASE + "/streampro", {
      method: "GET",
      headers: headers,
      redirect: "manual"
    });
    
    // Tratar redirecionamentos
    const location = response.headers.get("location");
    if (location) {
      let redirectUrl = location;
      if (redirectUrl.startsWith("/")) {
        redirectUrl = MASK + redirectUrl;
      } else if (redirectUrl.startsWith(BASE)) {
        redirectUrl = redirectUrl.replace(BASE, MASK);
      }
      res.setHeader("Location", redirectUrl);
      return res.status(response.status).end();
    }
    
    // Copiar cookies
    const cookies = response.headers.raw()["set-cookie"];
    if (cookies) {
      cookies.forEach(cookie => {
        res.append("Set-Cookie", cookie);
      });
    }
    
    // Processar HTML
    const type = response.headers.get("content-type");
    if (type && type.includes("text/html")) {
      let html = await response.text();
      
      // Adicionar meta tag SEO
      if (html.includes('</head>')) {
        const verificationCode = '<meta name="google-site-verification" content="EQt18dIllZg0WnhSV58os4awAy0jsyxrLL3Yek09dYo" />';
        html = html.replace('</head>', verificationCode + '\n</head>');
      }
      
      // Substituir URLs absolutas
      html = html.replace(new RegExp(BASE, 'g'), MASK);
      
      // Substituir URLs de vídeo para passar pelo proxy
      html = html.replace(/src="(http[^"]*\.(mp4|m3u8|m3u|avi|mkv|mov|wmv|flv|webm)[^"]*)"/g, 
        (match, url) => `src="${MASK}/proxy-media?url=${encodeURIComponent(url)}"`);
      
      // Substituir em JavaScript também
      html = html.replace(/url:\s*["'](http[^"']*\.(mp4|m3u8|m3u|avi|mkv|mov|wmv|flv|webm)[^"']*)["']/g,
        (match, url) => `url: "${MASK}/proxy-media?url=${encodeURIComponent(url)}"`);
      
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } else {
      res.setHeader("Content-Type", type || "text/html");
      res.send(await response.buffer());
    }
    
  } catch (error) {
    console.error("Erro ao carregar streampro:", error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Erro no StreamPro</title>
        <meta name="google-site-verification" content="EQt18dIllZg0WnhSV58os4awAy0jsyxrLL3Yek09dYo" />
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #e74c3c; }
          .btn { display: inline-block; margin: 10px; padding: 10px 20px; 
                 background: #3498db; color: white; text-decoration: none; 
                 border-radius: 5px; }
        </style>
      </head>
      <body>
        <h1>⚠️ Erro no Player de Streaming</h1>
        <p>${error.message}</p>
        <div>
          <a href="/" class="btn">🏠 Página Inicial</a>
          <button onclick="location.reload()" class="btn" style="background: #00ffb3; color: #000;">🔄 Tentar Novamente</button>
        </div>
      </body>
      </html>
    `);
  }
});

// ===== APIS PARA STREAMPRO =====

app.post("/api/streampro/reproducao/registrar", async (req, res) => {
  try {
    console.log("📊 Registrando reprodução...");
    
    const backendResponse = await fetch(BASE + "/api/streampro/reproducao/registrar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": req.headers.cookie || "",
        "x-forwarded-for": req.ip,
        "user-agent": req.headers["user-agent"] || "Mozilla/5.0"
      },
      body: JSON.stringify(req.body)
    });
    
    const data = await backendResponse.json();
    
    const setCookie = backendResponse.headers.raw()["set-cookie"];
    if (setCookie) {
      setCookie.forEach(cookie => {
        res.append("Set-Cookie", cookie);
      });
    }
    
    res.status(backendResponse.status).json(data);
  } catch (error) {
    console.error("Erro na API de registro:", error);
    res.status(500).json({ 
      success: false, 
      error: "Falha ao registrar reprodução"
    });
  }
});

// API para testar URL
app.post("/api/streampro/testar-url", async (req, res) => {
  try {
    const backendResponse = await fetch(BASE + "/api/streampro/testar-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": req.headers.cookie || ""
      },
      body: JSON.stringify(req.body)
    });
    
    const data = await backendResponse.json();
    res.status(backendResponse.status).json(data);
  } catch (error) {
    res.json({ 
      success: false,
      valido: false,
      mensagem: `Erro ao testar URL: ${error.message}`
    });
  }
});

// ===== ROTA PARA /alterar-foto =====
app.post("/alterar-foto", async (req, res) => {
  try {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    
    if (req.body && req.body.fotoUrl) {
      const base64Data = req.body.fotoUrl;
      const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      
      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const extension = mimeType.split('/')[1] || 'jpg';
        const filename = req.body.filename || `foto-${Date.now()}.${extension}`;
        
        form.append('fotoFile', buffer, {
          filename: filename,
          contentType: mimeType
        });
      } else {
        form.append('fotoUrl', base64Data);
      }
    } else {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Nenhuma foto fornecida!"
      });
    }
    
    const backendResponse = await fetch(BASE + "/alterar-foto", {
      method: "POST",
      headers: {
        "Cookie": req.headers.cookie || "",
        ...form.getHeaders()
      },
      body: form
    });
    
    const data = await backendResponse.json();
    
    const setCookie = backendResponse.headers.raw()["set-cookie"];
    if (setCookie) {
      setCookie.forEach(cookie => {
        res.append("Set-Cookie", cookie);
      });
    }
    
    res.status(backendResponse.status).json(data);
    
  } catch (error) {
    console.error("❌ Erro ao processar upload:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao processar foto: " + error.message
    });
  }
});

// ===== ROTA PARA API DE MÚSICAS =====
app.post("/play", async (req, res) => {
  try {
    const backendResponse = await fetch(BASE + "/play", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": req.headers.cookie || ""
      },
      body: JSON.stringify(req.body)
    });

    const data = await backendResponse.json();
    
    const setCookie = backendResponse.headers.raw()["set-cookie"];
    if (setCookie) {
      setCookie.forEach(cookie => {
        res.append("Set-Cookie", cookie);
      });
    }
    
    res.status(backendResponse.status).json(data);
    
  } catch (error) {
    console.error("Music API error:", error);
    res.status(500).json({ error: "Falha na API de músicas" });
  }
});

// ========== SEO ==========
app.use((req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(body) {
    if (typeof body === 'string' && body.includes('</head>')) {
      const verificationCode = '<meta name="google-site-verification" content="EQt18dIllZg0WnhSV58os4awAy0jsyxrLL3Yek09dYo" />';
      body = body.replace('</head>', verificationCode + '\n</head>');
    }
    
    originalSend.call(this, body);
  };
  
  next();
});

// Robots.txt
app.get("/robots.txt", (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /private/

Sitemap: ${MASK}/sitemap.xml`);
});

// Sitemap
app.get("/sitemap.xml", (req, res) => {
  res.type('application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${MASK}/</loc>
    <lastmod>2024-12-07</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${MASK}/streampro</loc>
    <lastmod>2024-12-07</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`);
});

// Página sobre
app.get("/sobre", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sobre o FabiBot</title>
    <meta name="google-site-verification" content="EQt18dIllZg0WnhSV58os4awAy0jsyxrLL3Yek09dYo" />
    <style>
        body { font-family: Arial; padding: 20px; text-align: center; }
        h1 { color: #667eea; }
        .btn { display: inline-block; padding: 10px 20px; margin: 10px; 
               background: #00ffb3; color: #000; text-decoration: none; 
               border-radius: 5px; font-weight: bold; }
    </style>
</head>
<body>
    <h1>🎬 FabiBot Streaming</h1>
    <p>Plataforma completa de streaming com qualidade HD</p>
    <a href="/streampro" class="btn">🎯 Acessar Player</a>
    <a href="/" class="btn">🏠 Página Inicial</a>
</body>
</html>`);
});

// ===== PROXY GERAL PARA TODO O RESTO =====
app.use(async (req, res) => {
  try {
    // Ignorar rotas já tratadas
    if (req.path.startsWith('/proxy-media') || 
        req.path.startsWith('/api/streampro') ||
        ['/streampro', '/sobre', '/robots.txt', '/sitemap.xml', 
         '/alterar-foto', '/play', '/google-verification.html'].includes(req.path)) {
      return res.status(404).send("Rota não encontrada");
    }

    const targetUrl = BASE + req.url;
    console.log(`🔗 Proxy geral: ${req.method} ${req.path}`);

    const headers = { 
      ...req.headers,
      "host": new URL(BASE).host,
      "origin": BASE,
      "referer": BASE + "/",
      "x-forwarded-for": req.ip,
      "x-real-ip": req.ip
    };
    
    delete headers["content-length"];

    let body;
    const contentType = req.headers["content-type"] || "";

    if (req.method !== "GET" && req.method !== "HEAD") {
      if (contentType.includes("application/json")) {
        body = JSON.stringify(req.body);
        headers["Content-Type"] = "application/json";
      } else if (contentType.includes("multipart/form-data")) {
        body = req;
        delete headers["content-type"];
      } else {
        body = new URLSearchParams(req.body).toString();
        headers["Content-Type"] = "application/x-www-form-urlencoded";
      }
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: body,
      redirect: "manual",
    });

    // Redirecionamentos
    const location = response.headers.get("location");
    if (location) {
      let redirectUrl = location;
      if (redirectUrl.startsWith("/")) {
        redirectUrl = MASK + redirectUrl;
      } else if (redirectUrl.startsWith(BASE)) {
        redirectUrl = redirectUrl.replace(BASE, MASK);
      }
      res.setHeader("Location", redirectUrl);
      return res.status(response.status).end();
    }

    // Cookies
    const cookies = response.headers.raw()["set-cookie"];
    if (cookies) {
      cookies.forEach(cookie => {
        res.append("Set-Cookie", cookie);
      });
    }

    // Headers
    const type = response.headers.get("content-type");
    if (type) res.setHeader("Content-Type", type);

    // Resposta
    if (type && type.includes("text/html")) {
      let html = await response.text();
      
      if (html.includes('</head>')) {
        const verificationCode = '<meta name="google-site-verification" content="EQt18dIllZg0WnhSV58os4awAy0jsyxrLL3Yek09dYo" />';
        html = html.replace('</head>', verificationCode + '\n</head>');
      }
      
      // Substituir URLs
      html = html.replace(new RegExp(BASE, 'g'), MASK);
      
      res.send(html);
    } else {
      res.send(await response.buffer());
    }
    
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).send("Erro interno do servidor");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  🚀 Proxy iniciado na porta ${PORT}
  🔗 Backend: ${BASE}
  🌐 Máscara: ${MASK}
  🎬 Streaming: ${MASK}/streampro
  📡 Proxy de mídia: ✅ Ativo
  ✅ Pronto para reproduzir vídeos!
  `);
});