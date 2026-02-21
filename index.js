import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
const PORT = process.env.PORT || 3000;

const BASE = "http://cavalo.cc:80";
const MASK = "https://fabibot-taupe.vercel.app";

app.use(cookieParser());

// ===== FUNÇÃO PROXY SIMPLES =====
async function proxySimples(req, res, tipo) {
  console.log(`\n🎬 ${tipo}: ${req.path}`);
  
  try {
    const targetUrl = BASE + req.path + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
    console.log(`🎯 TARGET: ${targetUrl}`);
    
    // Headers IGUAIS ao Chrome
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
    
    const response = await fetch(targetUrl, { 
      headers, 
      redirect: "follow" 
    });

    console.log(`📥 STATUS: ${response.status}`);

    if (!response.ok) {
      return res.status(response.status).send(`${tipo} não encontrado`);
    }

    // Copiar headers
    const headersToCopy = ["content-type", "content-length", "content-range", "accept-ranges"];
    headersToCopy.forEach(header => {
      const value = response.headers.get(header);
      if (value) res.setHeader(header, value);
    });

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(response.status);
    response.body.pipe(res);
    
  } catch (error) {
    console.error(`❌ ERRO:`, error);
    res.status(500).send("Erro interno");
  }
}

// ===== ROTAS =====
app.get("/series/*", (req, res) => proxySimples(req, res, "SÉRIE"));
app.get("/movie/*", (req, res) => proxySimples(req, res, "FILME"));

// ===== OPTIONS =====
app.options("/series/*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.status(204).end();
});

app.options("/movie/*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.status(204).end();
});

// ===== HEALTH CHECK =====
app.get("/health", (req, res) => {
  res.json({ status: "ok", base: BASE, mask: MASK });
});

app.listen(PORT, () => {
  console.log(`
  🚀 PROXY SIMPLES RODANDO
  🎯 BASE: ${BASE}
  🎭 MASK: ${MASK}
  ✅ SÉRIES: ${MASK}/series/...
  ✅ FILMES: ${MASK}/movie/...
  `);
});