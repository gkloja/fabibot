import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
const MASK = "https://fabibot-taupe.vercel.app";

app.use(cookieParser());

// Cookie jar para manter sessão
let cookieJar = {};

// Headers base simulando Chrome
const baseHeaders = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate",
  "Connection": "keep-alive"
};

// ===== FUNÇÃO PARA FAZER REQUISIÇÕES COM COOKIES =====
async function fetchWithCookies(url, options = {}) {
  const headers = { ...baseHeaders, ...options.headers };
  const domain = new URL(url).hostname;
  
  if (cookieJar[domain]) {
    headers["Cookie"] = cookieJar[domain];
  }
  
  const response = await fetch(url, { ...options, headers, redirect: "follow" });
  
  const setCookie = response.headers.raw()["set-cookie"];
  if (setCookie) {
    cookieJar[domain] = setCookie.map(c => c.split(';')[0]).join('; ');
  }
  
  return response;
}

// ===== FUNÇÃO GENÉRICA DE PROXY =====
async function proxyHandler(req, res, tipo) {
  console.log("\n" + "=".repeat(60));
  console.log(`🎬 ${tipo}: ${req.path}`);
  
  try {
    const urlOriginal = `http://cavalo.cc:80${req.path}`;
    console.log(`🎯 Acessando: ${urlOriginal}`);
    
    const response = await fetchWithCookies(urlOriginal, {
      headers: {
        "Host": "cavalo.cc",
        "Accept": "video/mp4,*/*",
        "Range": req.headers["range"] || "",
        "Referer": "http://cavalo.cc/"
      },
      redirect: "follow"
    });

    console.log(`📥 Status: ${response.status}`);

    if (response.ok || response.status === 206) {
      const headersToCopy = ["content-type", "content-length", "content-range", "accept-ranges"];
      headersToCopy.forEach(header => {
        const value = response.headers.get(header);
        if (value) res.setHeader(header, value);
      });

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Range");
      res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range");

      res.status(response.status);
      response.body.pipe(res);
      console.log(`✅ ${tipo} enviado!`);
      return;
    }
    
    res.status(response.status).send(`Erro ${response.status}`);
    
  } catch (error) {
    console.error(`❌ Erro no ${tipo}:`, error);
    res.status(500).send("Erro interno");
  }
}

// ===== HEALTH CHECK =====
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    mask: MASK, 
    time: new Date().toISOString(),
    rotas: ["/series/*", "/movie/*", "/*.ts", "/health"]
  });
});

// ===== ROTA PARA SÉRIES =====
app.get("/series/*", (req, res) => proxyHandler(req, res, "SÉRIE"));

// ===== ROTA PARA FILMES =====
app.get("/movie/*", (req, res) => proxyHandler(req, res, "FILME"));

// ===== ROTA PARA ARQUIVOS .ts (LIVES) =====
app.get("/*.ts", (req, res) => proxyHandler(req, res, "LIVE"));

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

app.options("/*.ts", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range");
  res.status(204).end();
});

// ===== 404 =====
app.use((req, res) => {
  console.log(`❌ 404: ${req.path}`);
  res.status(404).json({
    error: "Rota não encontrada",
    path: req.path,
    rotas_disponiveis: [
      "/health",
      "/series/.../arquivo.mp4",
      "/movie/.../arquivo.mp4",
      "/.../arquivo.ts"
    ]
  });
});

// ===== EXPORTAR PARA VERCEL =====
export default app;