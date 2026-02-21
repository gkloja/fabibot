import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
const PORT = process.env.PORT || 3000;

// === CONFIGURAÇÃO ===
const BASE = "http://cavalo.cc:80";
const MASK = "https://fabibot-taupe.vercel.app";

app.use(cookieParser());

// ===== FUNÇÃO REUTILIZÁVEL DE PROXY =====
async function proxyVideo(req, res, tipo) {
  console.log("\n" + "=".repeat(60));
  console.log(`🎬 PROXY ${tipo.toUpperCase()}:`);
  console.log(`📌 PATH: ${req.path}`);
  
  try {
    const targetUrl = BASE + req.path + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
    console.log(`🎯 TARGET: ${targetUrl}`);
    
    const headers = {
      "Host": "cavalo.cc",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "video/mp4, video/webm, video/ogg, */*",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      "Range": req.headers["range"] || "",
      "Referer": "http://cavalo.cc/",
      "Origin": "http://cavalo.cc",
      "Connection": "keep-alive"
    };
    
    const response = await fetch(targetUrl, { headers, redirect: "follow" });

    console.log(`📥 STATUS: ${response.status}`);

    if (response.status === 404) {
      return res.status(404).send(`404 - ${tipo} não encontrado: ${targetUrl}`);
    }

    // Copiar headers
    const headersToCopy = ["content-type", "content-length", "content-range", "accept-ranges"];
    headersToCopy.forEach(header => {
      const value = response.headers.get(header);
      if (value) res.setHeader(header, value);
    });

    // CORS
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

// ===== ROTA ESPECÍFICA PARA SÉRIES =====
app.get("/series/*", (req, res) => proxyVideo(req, res, "série"));

// ===== ROTA ESPECÍFICA PARA FILMES =====
app.get("/movie/*", (req, res) => proxyVideo(req, res, "filme"));

// ===== ROTA ESPECÍFICA PARA OUTROS PADRÕES (caso precise) =====
app.get("/deliver/*", (req, res) => proxyVideo(req, res, "deliver"));
app.get("/*.mp4", (req, res) => proxyVideo(req, res, "mp4"));

// ===== OPTIONS PARA CORS =====
app.options("/series/*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range");
  res.status(204).end();
});

app.options("/movie/*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range");
  res.status(204).end();
});

// ===== HEALTH CHECK =====
app.get("/health", (req, res) => {
  res.json({ status: "ok", base: BASE, mask: MASK });
});

// ===== 404 PARA QUALQUER OUTRA ROTA =====
app.use((req, res) => {
  res.status(404).send(`
    <html>
      <body>
        <h1>404 - Rota não encontrada</h1>
        <p>Path: ${req.path}</p>
        <p>Use /series/ ou /movie/</p>
        <p>Exemplos:</p>
        <ul>
          <li><a href="/series/Altairplay2024/4995NFTSybwa/361267.mp4">Testar Série</a></li>
          <li><a href="/movie/Altairplay2024/4995NFTSybwa/100008.mp4">Testar Filme</a></li>
          <li><a href="/health">Health Check</a></li>
        </ul>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log("\n" + "🚀".repeat(30));
  console.log(`🚀 PROXY DE VÍDEOS RODANDO NA PORTA ${PORT}`);
  console.log(`🎯 BASE: ${BASE}`);
  console.log(`🎭 MASK: ${MASK}`);
  console.log(`📝 SÉRIE: ${MASK}/series/Altairplay2024/4995NFTSybwa/361267.mp4`);
  console.log(`📝 FILME: ${MASK}/movie/Altairplay2024/4995NFTSybwa/100008.mp4`);
  console.log("🚀".repeat(30) + "\n");
});