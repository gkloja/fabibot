
import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
const PORT = process.env.PORT || 3000;

const BASE = "http://cavalo.cc:80";
const MASK = "https://fabibot-taupe.vercel.app";

app.use(cookieParser());

// ===== FUNÇÃO PARA OBTER TOKEN NOVO =====
async function obterTokenNovo(caminho) {
  try {
    // Converte /series/.../361267.mp4 para /series/.../361267
    const paginaUrl = BASE + caminho.replace('.mp4', '');
    console.log(`🔄 Obtendo token novo de: ${paginaUrl}`);
    
    const response = await fetch(paginaUrl, {
      headers: {
        "Host": "cavalo.cc",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Referer": "http://cavalo.cc/",
        "Origin": "http://cavalo.cc"
      }
    });
    
    const html = await response.text();
    console.log(`📄 HTML recebido (primeiros 200 chars):`, html.substring(0, 200));
    
    // Tenta encontrar o token no HTML
    // Geralmente está em algum script ou meta tag
    const tokenMatch = html.match(/token=([a-zA-Z0-9_.-]+)/);
    if (tokenMatch) {
      console.log(`✅ Token encontrado:`, tokenMatch[1].substring(0, 20) + '...');
      return tokenMatch[1];
    }
    
    // Tenta encontrar a URL completa do vídeo
    const videoMatch = html.match(/video[":\s]+[^"']*?(http[^"'\s]+)/);
    if (videoMatch) {
      console.log(`✅ URL de vídeo encontrada:`, videoMatch[1]);
      return videoMatch[1];
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Erro ao obter token:`, error);
    return null;
  }
}

// ===== PROXY INTELIGENTE =====
app.get("/series/*", async (req, res) => {
  console.log("\n" + "=".repeat(60));
  console.log(`🎬 REQUISIÇÃO: ${req.path}`);
  
  try {
    // Tenta com a URL original primeiro
    let targetUrl = BASE + req.path + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
    console.log(`🎯 TENTANDO 1: ${targetUrl}`);
    
    let response = await fetch(targetUrl, {
      headers: {
        "Host": "cavalo.cc",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "video/mp4,*/*",
        "Range": req.headers["range"] || "",
        "Referer": "http://cavalo.cc/",
        "Origin": "http://cavalo.cc"
      },
      redirect: "follow"
    });

    // Se deu 404, pode ser token expirado
    if (response.status === 404) {
      console.log(`⚠️ 404 - Tentando renovar token...`);
      
      // Tenta obter token novo
      const tokenNovo = await obterTokenNovo(req.path);
      
      if (tokenNovo) {
        // Se tokenNovo for URL completa
        if (tokenNovo.startsWith('http')) {
          targetUrl = tokenNovo;
        } else {
          // Se for só o token, constrói URL
          targetUrl = `http://209.131.121.28/deliver/${req.path.split('/').pop()}?token=${tokenNovo}`;
        }
        
        console.log(`🎯 TENTANDO 2: ${targetUrl}`);
        
        response = await fetch(targetUrl, {
          headers: {
            "Host": new URL(targetUrl).host,
            "User-Agent": "Mozilla/5.0",
            "Range": req.headers["range"] || "",
            "Referer": "http://cavalo.cc/"
          }
        });
      }
    }

    // Se ainda assim falhou
    if (!response.ok) {
      return res.status(response.status).send(`
        <html>
          <body>
            <h1>${response.status} - Vídeo indisponível</h1>
            <p>O token pode ter expirado. <a href="${req.path}">Tente novamente</a></p>
          </body>
        </html>
      `);
    }

    // Copiar headers
    const headersToCopy = ["content-type", "content-length", "content-range", "accept-ranges"];
    headersToCopy.forEach(header => {
      const value = response.headers.get(header);
      if (value) res.setHeader(header, value);
    });

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range");

    res.status(response.status);
    response.body.pipe(res);
    
  } catch (error) {
    console.error(`❌ ERRO:`, error);
    res.status(500).send("Erro interno");
  }
});

// ===== OPTIONS =====
app.options("/series/*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range");
  res.status(204).end();
});

// ===== HEALTH CHECK =====
app.get("/health", (req, res) => {
  res.json({ status: "ok", base: BASE, mask: MASK });
});

app.listen(PORT, () => {
  console.log(`
  🚀 PROXY INTELIGENTE RODANDO
  🎯 BASE: ${BASE}
  🎭 MASK: ${MASK}
  🔄 Renovação automática de tokens ativada!
  `);
});