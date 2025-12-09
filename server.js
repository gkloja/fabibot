import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();

app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.json({ limit: '20mb' }));
app.use(cookieParser());

const BASE = "http://br2.bronxyshost.com:4009";
const MASK = "https://fabibot.onrender.com";

// ===== MIDDLEWARE PARA LOGS =====
app.use((req, res, next) => {
    console.log(`🔗 ${req.method} ${req.url}`);
    next();
});

// ===== ROTAS PRÓPRIAS DA MÁSCARA (SEO ETC) =====

// Middleware para meta tags
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

// Rotas estáticas (SEO)
app.get("/google-verification.html", (req, res) => {
    res.send(`<!DOCTYPE html><html><head><meta name="google-site-verification" content="EQt18dIllZg0WnhSV58os4awAy0jsyxrLL3Yek09dYo" /></head><body>Google Verification</body></html>`);
});

app.get("/robots.txt", (req, res) => {
    res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${MASK}/sitemap.xml`);
});

app.get("/sitemap.xml", (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${MASK}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${MASK}/reprodutor</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>${MASK}/removermarca</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
</urlset>`);
});

// ===== ROTAS ESPECIAIS (upload, músicas) =====

// Upload de foto
app.post("/alterar-foto", async (req, res) => {
  console.log("📤 Encaminhando upload para backend original...");
  try {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    
    if (req.body && req.body.fotoUrl) {
      const base64Data = req.body.fotoUrl;
      const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      
      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        form.append('fotoFile', buffer, {
          filename: `foto-${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`,
          contentType: mimeType
        });
      } else {
        form.append('fotoUrl', base64Data);
      }
    }
    
    const formHeaders = {
      "Cookie": req.headers.cookie || "",
      "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
      ...form.getHeaders()
    };
    
    const backendResponse = await fetch(BASE + "/alterar-foto", {
      method: "POST",
      headers: formHeaders,
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

// API de músicas
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

// ===== PROXY PARA STREAMS DE VÍDEO =====
// Esta é a parte MAIS IMPORTANTE para o reprodutor funcionar

app.get("/api/streampro/proxy", async (req, res) => {
    const { url, agente } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: "URL requerida" });
    }
    
    console.log(`🎬 Proxy de stream para: ${url.substring(0, 100)}...`);
    
    try {
        const targetUrl = decodeURIComponent(url);
        
        if (!targetUrl.startsWith('http')) {
            return res.status(400).json({ error: "URL inválida" });
        }
        
        // Configurar agente
        const agentConfig = getAgentConfig(agente || 'vlc');
        
        // Fazer requisição com streaming
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': agentConfig.agent,
                'Accept': agentConfig.accept,
                'Referer': agentConfig.referer || targetUrl,
                'Origin': new URL(targetUrl).origin,
                'Range': req.headers.range || 'bytes=0-'
            },
            timeout: 30000
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Copiar headers importantes
        const headersToCopy = ['content-type', 'content-length', 'accept-ranges', 'content-range', 'cache-control'];
        headersToCopy.forEach(header => {
            const value = response.headers.get(header);
            if (value) res.setHeader(header, value);
        });
        
        // Configurar CORS para permitir streaming
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Expose-Headers', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Range, Content-Type');
        
        // Stream dos dados
        response.body.pipe(res);
        
    } catch (error) {
        console.error('Erro no proxy de stream:', error);
        res.status(500).json({ 
            error: "Erro ao acessar stream",
            detalhes: error.message
        });
    }
});

// Testar URL
app.post("/api/streampro/testar-url", async (req, res) => {
    const { url, agente } = req.body;
    
    if (!url) {
        return res.json({ 
            success: false, 
            valido: false,
            mensagem: "URL vazia"
        });
    }
    
    try {
        const targetUrl = decodeURIComponent(url);
        const valido = targetUrl.startsWith('http://') || targetUrl.startsWith('https://');
        
        if (!valido) {
            return res.json({ 
                success: false,
                valido: false,
                mensagem: "URL deve começar com http:// ou https://"
            });
        }
        
        const agentConfig = getAgentConfig(agente || 'vlc');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(targetUrl, {
            method: 'HEAD',
            headers: {
                'User-Agent': agentConfig.agent,
                'Accept': agentConfig.accept
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        res.json({
            success: true,
            valido: response.ok,
            status: response.status,
            tipo: response.headers.get('content-type'),
            tamanho: response.headers.get('content-length'),
            sugestao: response.ok ? "✅ URL válida e acessível" : "⚠️ URL pode ter problemas"
        });
        
    } catch (error) {
        res.json({ 
            success: false,
            valido: false,
            mensagem: `Erro ao testar URL: ${error.message}`,
            sugestao: "Verifique se a URL está correta"
        });
    }
});

// ===== FUNÇÃO AUXILIAR PARA AGENTES =====
function getAgentConfig(agentName) {
    const agents = {
        vlc: {
            name: 'VLC Player',
            agent: 'VLC/3.0.11 LibVLC/3.0.11',
            accept: '*/*',
            referer: 'https://www.videolan.org/'
        },
        lavf: {
            name: 'FFmpeg Lavf',
            agent: 'Lavf/58.76.100',
            accept: 'video/mp4,video/*;q=0.9,*/*;q=0.8',
            referer: 'https://ffmpeg.org/'
        },
        exoplayer: {
            name: 'Android ExoPlayer',
            agent: 'ExoPlayerLib/2.14.1',
            accept: '*/*',
            referer: 'https://exoplayer.dev/'
        },
        quicktime: {
            name: 'Apple QuickTime',
            agent: 'QuickTime/7.7.4 (qtver=7.7.4;os=Windows NT 6.1)',
            accept: 'video/quicktime,video/mp4,video/x-m4v',
            referer: 'https://www.apple.com/quicktime/'
        },
        android: {
            name: 'Android Media Player',
            agent: 'stagefright/1.2 (Linux;Android 10)',
            accept: '*/*',
            referer: 'https://android.com/'
        }
    };
    
    return agents[agentName] || agents.vlc;
}

// ===== PROXY GERAL PARA TODAS AS OUTRAS ROTAS =====
app.use(async (req, res) => {
    try {
        // Ignorar rotas já tratadas
        if (
            req.path === '/alterar-foto' ||
            req.path === '/play' ||
            req.path === '/api/streampro/proxy' ||
            req.path === '/api/streampro/testar-url' ||
            req.path === '/robots.txt' ||
            req.path === '/sitemap.xml' ||
            req.path === '/google-verification.html' ||
            req.path.startsWith('/sobre') ||
            req.path.startsWith('/politica') ||
            req.path.startsWith('/termos') ||
            req.path.startsWith('/ajuda')
        ) {
            return next(); // Se não houver next, deixa passar para o proxy geral abaixo
        }

        const targetUrl = BASE + req.url;
        console.log(`🔗 Proxy geral: ${req.method} ${req.path} -> ${targetUrl}`);

        // Preparar headers
        const headers = { 
            ...req.headers,
            "host": new URL(BASE).host,
            "origin": BASE,
            "referer": BASE + "/",
            "x-forwarded-for": req.ip,
            "x-real-ip": req.ip
        };
        
        // Remover header de comprimento para evitar problemas
        delete headers["content-length"];

        let body;
        const contentType = req.headers["content-type"] || "";

        // Preparar body
        if (req.method !== "GET" && req.method !== "HEAD") {
            if (contentType.includes("application/json")) {
                body = JSON.stringify(req.body);
                headers["Content-Type"] = "application/json";
            } else if (contentType.includes("multipart/form-data")) {
                // Para multipart, enviar stream direto
                body = req;
                delete headers["content-type"];
            } else {
                body = new URLSearchParams(req.body).toString();
                headers["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8";
            }
        }

        const response = await fetch(targetUrl, {
            method: req.method,
            headers: headers,
            body: body,
            redirect: "manual",
            timeout: 30000
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

        // Copiar outros headers
        const type = response.headers.get("content-type");
        if (type) res.setHeader("Content-Type", type);

        // Configurar CORS para páginas HTML
        if (type && type.includes("text/html")) {
            res.setHeader("Access-Control-Allow-Origin", "*");
        }

        // Enviar resposta
        if (type && type.includes("text/html")) {
            let html = await response.text();
            
            // Substituir URLs do backend pela máscara
            html = html.replace(new RegExp(BASE, 'g'), MASK);
            
            // Corrigir referências a /api/streampro
            html = html.replace(/href="\/api\/streampro\//g, `href="${MASK}/api/streampro/`);
            html = html.replace(/src="\/api\/streampro\//g, `src="${MASK}/api/streampro/`);
            
            res.send(html);
        } else {
            const buffer = await response.buffer();
            res.send(buffer);
        }
        
    } catch (error) {
        console.error("❌ Proxy error:", error);
        
        // Página de erro amigável
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Erro no Proxy</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 50px; text-align: center; }
                    h1 { color: #ff4757; }
                    pre { background: #f5f5f5; padding: 20px; border-radius: 5px; text-align: left; }
                </style>
            </head>
            <body>
                <h1>⚠️ Erro ao conectar com o servidor</h1>
                <p>O serviço pode estar temporariamente indisponível.</p>
                <pre>${error.message}</pre>
                <p><a href="${MASK}/">Voltar para a página inicial</a></p>
            </body>
            </html>
        `);
    }
});

// Middleware de erro
app.use((err, req, res, next) => {
    console.error('❌ Erro na máscara:', err);
    res.status(500).json({ 
        error: "Erro interno na máscara",
        message: err.message 
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    🚀 Máscara rodando na porta ${PORT}
    🔗 Encaminhando para: ${BASE}
    🎭 URL da máscara: ${MASK}
    📡 Rotas Stream Pro: /api/streampro/*
    ✅ Proxy de vídeo configurado!
    `);
});
