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
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1"
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

// ===== HEALTH CHECK (PRIMEIRO, ANTES DE TUDO) =====
app.get("/health", (req, res) => {
  console.log("✅ Health check acessado");
  res.json({ 
    status: "ok", 
    mask: MASK, 
    time: new Date().toISOString(),
    cookies: cookieJar,
    message: "Proxy funcionando!"
  });
});

// ===== DEBUG (OPCIONAL) =====
app.get("/debug/*", (req, res) => {
  res.json({
    path: req.path,
    url: req.url,
    method: req.method,
    headers: req.headers,
    query: req.query,
    time: new Date().toISOString(),
    cookieJar: cookieJar
  });
});

// ===== PROXY PRINCIPAL =====
app.get("/*", async (req, res) => {
  console.log("\n" + "=".repeat(60));
  console.log(`🔍 REQUISIÇÃO: ${req.path}`);
  
  // OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range");
    return res.status(204).end();
  }

  try {
    const urlOriginal = `http://cavalo.cc:80${req.path}`;
    console.log(`🎯 Acessando: ${urlOriginal}`);
    
    const response = await fetchWithCookies(urlOriginal, {
      method: req.method,
      headers: {
        "Host": "cavalo.cc",
        "Accept": req.path.includes('.mp4') ? "video/mp4,*/*" : "*/*",
        "Range": req.headers["range"] || "",
        "Referer": "http://cavalo.cc/",
        "Origin": "http://cavalo.cc"
      },
      redirect: "follow"
    });

    console.log(`📥 Status final: ${response.status}`);
    console.log(`📍 URL final: ${response.url}`);

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
      console.log(`✅ Vídeo sendo enviado!`);
      return;
    }
    
    console.log(`❌ Falhou: ${response.status}`);
    res.status(response.status).send(`Erro ${response.status}`);
    
  } catch (error) {
    console.error("❌ Erro:", error);
    res.status(500).json({ 
      error: "Erro interno", 
      message: error.message,
      path: req.path 
    });
  }
});

// ===== 404 PARA ROTAS NÃO ENCONTRADAS =====
app.use((req, res) => {
  console.log(`❌ 404 - Rota não encontrada: ${req.path}`);
  res.status(404).json({ 
    error: "Rota não encontrada", 
    path: req.path,
    available: ["/health", "/debug/*", "/* (proxy)"]
  });
});

// ===== EXPORTAR PARA O VERCEL (NÃO USAR app.listen) =====
export default app;