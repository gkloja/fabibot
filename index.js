import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();

app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.json({ limit: '20mb' }));
app.use(cookieParser());

const BASE = "http://209.131.121.25";
const MASK = "https://fabibot-taupe.vercel.app";

// ========== CONFIGURAÇÃO SEO COMPLETA ==========

// Middleware para adicionar meta tag de verificação em TODAS as páginas
app.use((req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(body) {
    if (typeof body === 'string' && body.includes('</head>')) {
      const verificationCode = '<meta name="google-site-verification" content="ABCdEfGhIjKlMnOpQrStUvWxYz1234567890" />';
      body = body.replace('</head>', verificationCode + '\n</head>');
    }
    originalSend.call(this, body);
  };
  next();
});

// Google Verification
app.get("/google-verification.html", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Google Verification</title>
    <meta name="google-site-verification" content="EQt18dIllZg0WnhSV58os4awAy0jsyxrLL3Yek09dYo" />
</head>
<body>
    <h1>Google Search Console Verification</h1>
    <p>Site: https://fabibot-taupe.vercel.app</p>
</body>
</html>
  `);
});

// Robots.txt
app.get("/robots.txt", (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /private/

Sitemap: https://fabibot-taupe.vercel.app/sitemap.xml

User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Slurp
Allow: /

# Block AI scrapers
User-agent: ChatGPT-User
Disallow: /
User-agent: GPTBot
Disallow: /
User-agent: CCBot
Disallow: /`);
});

// Sitemap.xml
app.get("/sitemap.xml", (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  res.type('application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
  
  <url>
    <loc>https://fabibot-taupe.vercel.app/</loc>
    <lastmod>2024-12-07</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  
  <url>
    <loc>https://fabibot-taupe.vercel.app/login</loc>
    <lastmod>2024-12-07</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>https://fabibot-taupe.vercel.app/register</loc>
    <lastmod>2024-12-07</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>https://fabibot-taupe.vercel.app/chat</loc>
    <lastmod>2024-12-07</lastmod>
    <changefreq>always</changefreq>
    <priority>0.9</priority>
  </url>
  
  <url>
    <loc>https://fabibot-taupe.vercel.app/corrida</loc>
    <lastmod>2024-12-07</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  
  <url>
    <loc>https://fabibot-taupe.vercel.app/removermarca</loc>
    <lastmod>2024-12-07</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  
  <url>
    <loc>https://fabibot-taupe.vercel.app/about</loc>
    <lastmod>2024-12-07</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  
  <url>
    <loc>https://fabibot-taupe.vercel.app/sobre</loc>
    <lastmod>2024-12-07</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  
  <url>
    <loc>https://fabibot-taupe.vercel.app/privacy</loc>
    <lastmod>2024-12-07</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  
  <url>
    <loc>https://fabibot-taupe.vercel.app/terms</loc>
    <lastmod>2024-12-07</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>

</urlset>`);
});

// Página SOBRE
app.get("/sobre", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sobre o fabibot-taupe - Plataforma Completa de Entretenimento Online</title>
    <meta name="description" content="Conheça o fabibot-taupe: chat online grátis, player de músicas, jogos e ranking. A maior comunidade brasileira de entretenimento digital.">
    <meta name="keywords" content="fabibot-taupe, sobre, chat online, músicas, jogos, entretenimento">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            padding: 20px;
        }
        .container { 
            max-width: 1000px; 
            margin: 0 auto; 
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        h1 { 
            color: #fff; 
            font-size: 2.5em; 
            margin-bottom: 30px;
            text-align: center;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        h2 { 
            color: #ffd700; 
            margin: 25px 0 15px;
            border-left: 4px solid #ffd700;
            padding-left: 15px;
        }
        p { 
            line-height: 1.8; 
            margin-bottom: 15px;
            font-size: 1.1em;
        }
        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 25px;
            margin: 30px 0;
        }
        .feature-card {
            background: rgba(255,255,255,0.15);
            padding: 25px;
            border-radius: 15px;
            text-align: center;
            transition: transform 0.3s;
        }
        .feature-card:hover {
            transform: translateY(-5px);
            background: rgba(255,255,255,0.2);
        }
        .feature-icon {
            font-size: 2.5em;
            margin-bottom: 15px;
            display: block;
        }
        .btn {
            display: inline-block;
            background: #ffd700;
            color: #333;
            padding: 12px 30px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: bold;
            margin-top: 20px;
            transition: all 0.3s;
        }
        .btn:hover {
            background: #ffed4e;
            transform: scale(1.05);
        }
        .back-link {
            display: block;
            text-align: center;
            margin-top: 40px;
            color: #ffd700;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎮 Sobre o fabibot-taupe</h1>
        
        <p>Bem-vindo ao <strong>fabibot-taupe</strong>, a plataforma de entretenimento online mais completa do Brasil! Criada para conectar pessoas através da diversão digital.</p>
        
        <h2>✨ O Que Oferecemos</h2>
        
        <div class="features-grid">
            <div class="feature-card">
                <span class="feature-icon">💬</span>
                <h3>Chat Online</h3>
                <p>Converse em tempo real com amigos em salas temáticas. Totalmente gratuito e sem limites!</p>
            </div>
            
            <div class="feature-card">
                <span class="feature-icon">🎵</span>
                <h3>Player de Músicas</h3>
                <p>Ouça milhares de músicas com nosso player avançado. Crie playlists e descubra novas faixas.</p>
            </div>
            
            <div class="feature-card">
                <span class="feature-icon">🏆</span>
                <h3>Sistema de Ranking</h3>
                <p>Participe, acumule pontos e suba no ranking. Mostre quem é o melhor da comunidade!</p>
            </div>
            
            <div class="feature-card">
                <span class="feature-icon">🎲</span>
                <h3>Jogos Online</h3>
                <p>Diversos jogos para se divertir sozinho ou com amigos. Novos jogos adicionados toda semana!</p>
            </div>
        </div>
        
        <h2>🚀 Nossa Missão</h2>
        <p>Proporcionar entretenimento de qualidade, gratuito e acessível para todos os brasileiros. Acreditamos que a diversão deve ser democrática!</p>
        
        <h2>📈 Estatísticas Impressionantes</h2>
        <p>• <strong>+10,000 usuários ativos</strong><br>
           • <strong>+50,000 mensagens diárias</strong><br>
           • <strong>+100,000 músicas tocadas</strong><br>
           • <strong>99.9% uptime</strong></p>
        
        <h2>🔒 Segurança e Privacidade</h2>
        <p>Seus dados estão seguros conosco. Utilizamos criptografia de ponta a ponta e não vendemos suas informações.</p>
        
        <div style="text-align: center;">
            <a href="/" class="btn">🎯 Experimente Grátis</a>
        </div>
        
        <a href="/" class="back-link">← Voltar para o fabibot-taupe</a>
    </div>
</body>
</html>`);
});

// Política de Privacidade
app.get("/politica-de-privacidade", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Política de Privacidade - fabibot-taupe</title>
    <meta name="description" content="Política de Privacidade do fabibot-taupe. Saiba como protegemos seus dados e informações pessoais.">
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.8; }
        h1, h2 { color: #667eea; }
        .date { color: #666; font-style: italic; }
    </style>
</head>
<body>
    <h1>🔒 Política de Privacidade do fabibot-taupe</h1>
    <p class="date">Última atualização: 06 de dezembro de 2024</p>
    
    <h2>1. Coleta de Informações</h2>
    <p>Coletamos informações para fornecer e melhorar nossos serviços...</p>
    
    <h2>2. Uso de Dados</h2>
    <p>Utilizamos seus dados para personalizar sua experiência...</p>
    
    <h2>3. Cookies</h2>
    <p>Utilizamos cookies para melhorar a navegação...</p>
    
    <h2>4. Google AdSense</h2>
    <p>Terceiros, incluindo o Google, usam cookies para veicular anúncios...</p>
    
    <p><a href="/">← Voltar ao fabibot-taupe</a></p>
</body>
</html>`);
});

// Termos de Uso
app.get("/termos-de-uso", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Termos de Uso - fabibot-taupe</title>
    <meta name="description" content="Termos e Condições de Uso do fabibot-taupe. Leia atentamente antes de utilizar nossa plataforma.">
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.8; }
        h1, h2 { color: #667eea; }
    </style>
</head>
<body>
    <h1>📄 Termos de Uso do fabibot-taupe</h1>
    
    <h2>1. Aceitação dos Termos</h2>
    <p>Ao acessar o fabibot-taupe, você concorda com estes termos...</p>
    
    <h2>2. Uso Adequado</h2>
    <p>Você concorda em não usar o serviço para atividades ilegais...</p>
    
    <h2>3. Contas de Usuário</h2>
    <p>Você é responsável por manter sua conta segura...</p>
    
    <p><a href="/">← Voltar ao fabibot-taupe</a></p>
</body>
</html>`);
});

// Ajuda/FAQ
app.get("/ajuda", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ajuda do fabibot-taupe - Perguntas Frequentes</title>
    <meta name="description" content="Central de Ajuda do fabibot-taupe. Tire todas suas dúvidas sobre chat, músicas, jogos e mais.">
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
        .faq-item { margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
        .question { color: #667eea; font-weight: bold; cursor: pointer; }
        .answer { display: none; margin-top: 10px; }
    </style>
</head>
<body>
    <h1>❓ Central de Ajuda - fabibot-taupe</h1>
    
    <div class="faq-item">
        <div class="question" onclick="toggleAnswer(this)">Como usar o chat online?</div>
        <div class="answer">Basta acessar a aba "Chat" e escolher uma sala...</div>
    </div>
    
    <div class="faq-item">
        <div class="question" onclick="toggleAnswer(this)">O player de músicas é gratuito?</div>
        <div class="answer">Sim, totalmente gratuito e sem anúncios...</div>
    </div>
    
    <script>
        function toggleAnswer(element) {
            const answer = element.nextElementSibling;
            answer.style.display = answer.style.display === 'block' ? 'none' : 'block';
        }
    </script>
    
    <p><a href="/">← Voltar ao fabibot-taupe</a></p>
</body>
</html>`);
});

// ===== ROTA ESPECIAL PARA VÍDEOS COM SUPORTE A TOKENS =====
app.get("/deliver/*", async (req, res) => {
  try {
    const videoPath = req.path; // /deliver/361267.mp4
    const queryString = req.url.split('?')[1] || '';
    
    // URL completa para o servidor original
    const targetUrl = `http://209.131.121.25${videoPath}?${queryString}`;
    
    console.log("=".repeat(50));
    console.log(`🎬 Proxy de vídeo: ${targetUrl}`);
    console.log(`📝 Headers recebidos do cliente:`);
    console.log(`   User-Agent: ${req.headers["user-agent"]}`);
    console.log(`   Range: ${req.headers["range"] || "não especificado"}`);
    
    // FAZER A REQUISIÇÃO MANTENDO TODOS OS HEADERS IMPORTANTES
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        // CRÍTICO: Manter o Host original do servidor de vídeo
        "Host": "209.131.121.25",
        "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
        "Accept": "video/mp4, video/webm, video/ogg, application/json, */*",
        "Accept-Language": req.headers["accept-language"] || "pt-BR,pt;q=0.9,en;q=0.8",
        "Range": req.headers["range"] || "",
        "Referer": "http://209.131.121.25/",
        "Origin": "http://209.131.121.25",
        "Connection": "keep-alive",
        "Sec-Fetch-Dest": "video",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "same-origin",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
      }
    });
    
    console.log(`📊 Status da resposta: ${response.status} ${response.statusText}`);
    
    // IMPORTANTE: Copiar headers de resposta para o cliente
    const headersToCopy = [
      "content-type", "content-length", "content-range", 
      "accept-ranges", "cache-control", "expires",
      "last-modified", "etag"
    ];
    
    headersToCopy.forEach(header => {
      const value = response.headers.get(header);
      if (value) {
        res.setHeader(header, value);
        console.log(`   ${header}: ${value}`);
      }
    });
    
    // Configurar headers CORS para permitir reprodução
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range");
    
    // Copiar status code
    res.status(response.status);
    
    // Stream do vídeo diretamente para o cliente
    response.body.pipe(res);
    
    console.log(`✅ Vídeo sendo transmitido para o cliente`);
    console.log("=".repeat(50));
    
  } catch (error) {
    console.error("❌ Erro no proxy de vídeo:", error);
    res.status(500).send("Erro ao carregar vídeo");
  }
});

// Rota para OPTIONS (preflight CORS)
app.options("/deliver/*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range");
  res.status(204).end();
});

// ===== ROTA PARA OUTROS ARQUIVOS DE MÍDIA =====
app.get("/*.mp4", async (req, res) => {
  try {
    const videoPath = req.path;
    const queryString = req.url.split('?')[1] || '';
    const targetUrl = `http://209.131.121.25${videoPath}?${queryString}`;
    
    console.log(`🎬 Proxy de MP4: ${targetUrl}`);
    
    const response = await fetch(targetUrl, {
      headers: {
        "Host": "209.131.121.25",
        "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
        "Accept": "video/mp4,*/*",
        "Range": req.headers["range"] || "",
        "Referer": "http://209.131.121.25/"
      }
    });
    
    // Copiar headers
    res.setHeader("Content-Type", response.headers.get("content-type") || "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Access-Control-Allow-Origin", "*");
    
    const contentRange = response.headers.get("content-range");
    if (contentRange) res.setHeader("Content-Range", contentRange);
    
    const contentLength = response.headers.get("content-length");
    if (contentLength) res.setHeader("Content-Length", contentLength);
    
    res.status(response.status);
    response.body.pipe(res);
    
  } catch (error) {
    console.error("❌ Erro no proxy de MP4:", error);
    res.status(500).send("Erro ao carregar vídeo");
  }
});

// ===== ROTA PARA ALTERAR FOTO =====
app.post("/alterar-foto", async (req, res) => {
  console.log("📤 Encaminhando upload para backend original...");
  
  try {
    const headers = {
      "Cookie": req.headers.cookie || "",
      "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
      "Accept": "application/json"
    };
    
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    
    if (req.body && req.body.fotoUrl) {
      console.log("📸 Convertendo base64 para arquivo...");
      
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
        
        console.log(`📁 Arquivo criado: ${filename} (${buffer.length} bytes)`);
      } else {
        console.log("📡 Tratando como URL normal...");
        form.append('fotoUrl', base64Data);
      }
    } else {
      console.log("❌ Nenhuma foto fornecida");
      return res.status(400).json({
        sucesso: false,
        mensagem: "Nenhuma foto fornecida!"
      });
    }
    
    console.log("🚀 Enviando para backend original...");
    
    const formHeaders = {
      ...headers,
      ...form.getHeaders()
    };
    
    const backendResponse = await fetch(BASE + "/alterar-foto", {
      method: "POST",
      headers: formHeaders,
      body: form
    });
    
    const data = await backendResponse.json();
    console.log("📥 Resposta do backend:", data.sucesso ? '✅' : '❌');
    
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
        "Accept": "application/json",
        "User-Agent": "Samá-Music-Player/1.0",
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

// ===== MIDDLEWARE PARA OUTRAS ROTAS (PROXY GERAL) =====
app.use(async (req, res) => {
  try {
    // Ignorar rotas que já foram tratadas
    if (req.path === '/alterar-foto' || req.path === '/play' || req.path.includes('/deliver/')) {
      return;
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
        headers["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8";
      }
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: body,
      redirect: "manual",
    });

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

    const cookies = response.headers.raw()["set-cookie"];
    if (cookies) {
      cookies.forEach(cookie => {
        res.append("Set-Cookie", cookie);
      });
    }

    const type = response.headers.get("content-type");
    if (type) res.setHeader("Content-Type", type);

    if (type && type.includes("text/html")) {
      res.send(await response.text());
    } else {
      res.send(await response.buffer());
    }
    
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).send("Erro no proxy");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  🚀 Máscara rodando na porta ${PORT}
  🔗 Encaminhando para: ${BASE}
  🎭 URL da máscara: ${MASK}
  ✅ Uploads vão direto para o backend original!
  ✅ Suporte a vídeos com token!
  `);
});