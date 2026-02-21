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
    
    const tokenMatch = html.match(/token=([a-zA-Z0-9_.-]+)/);
    if (tokenMatch) {
      return tokenMatch[1];
    }
    
    const videoMatch = html.match(/video[":\s]+[^"']*?(http[^"'\s]+)/);
    if (videoMatch) {
      return videoMatch[1];
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Erro ao obter token:`, error);
    return null;
  }
}

// ===== FUNÇÃO REUTILIZÁVEL DE PROXY =====
async function proxyHandler(req, res, tipo) {
  console.log("\n" + "=".repeat(60));
  console.log(`🎬 ${tipo.toUpperCase()}: ${req.path}`);
  
  try {
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

    if (response.status === 404) {
      console.log(`⚠️ 404 - Tentando renovar token...`);
      
      const tokenNovo = await obterTokenNovo(req.path);
      
      if (tokenNovo) {
        if (tokenNovo.startsWith('http')) {
          targetUrl = tokenNovo;
        } else {
          const arquivo = req.path.split('/').pop();
          targetUrl = `http://209.131.121.28/deliver/${arquivo}?token=${tokenNovo}`;
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

    if (!response.ok) {
      return res.status(response.status).send(`
        <html>
          <body>
            <h1>${response.status} - ${tipo} indisponível</h1>
            <p>Token pode ter expirado. <a href="${req.path}">Tente novamente</a></p>
          </body>
        </html>
      `);
    }

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
}

// ===== ROTAS =====
app.get("/series/*", (req, res) => proxyHandler(req, res, "série"));
app.get("/movie/*", (req, res) => proxyHandler(req, res, "filme")); // ✅ ADICIONADO!

// ===== OPTIONS =====
app.options("/series/*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range");
  res.status(204).end();
});

app.options("/movie/*", (req, res) => { // ✅ ADICIONADO!
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range");
  res.status(204).end();
});

// ===== HEALTH CHECK =====
app.get("/health", (req, res) => {
  res.json({ status: "ok", base: BASE, mask: MASK });
});

// ===== 404 =====
app.use((req, res) => {
  res.status(404).send(`
    <html>
      <body>
        <h1>404 - Rota não encontrada</h1>
        <p>Use /series/ ou /movie/</p>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`
  🚀 PROXY INTELIGENTE RODANDO
  🎯 BASE: ${BASE}
  🎭 MASK: ${MASK}
  ✅ SÉRIES: ${MASK}/series/...
  ✅ FILMES: ${MASK}/movie/...
  🔄 Renovação automática de tokens ativada!
  `);
});