import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
const MASK = "https://fabibot-taupe.vercel.app";

app.use(cookieParser());

let cookieJar = {};

const baseHeaders = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate",
  "Connection": "keep-alive"
};

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

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", mask: MASK, time: new Date().toISOString() });
});

// Proxy para séries
app.get("/series/*", async (req, res) => {
  console.log(`🎬 Série: ${req.path}`);
  await proxyVideo(req, res);
});

// Proxy para filmes
app.get("/movie/*", async (req, res) => {
  console.log(`🎬 Filme: ${req.path}`);
  await proxyVideo(req, res);
});

// Proxy para qualquer .mp4
app.get("/*.mp4", async (req, res) => {
  console.log(`🎬 MP4: ${req.path}`);
  await proxyVideo(req, res);
});

// Função genérica de proxy
async function proxyVideo(req, res) {
  try {
    const urlOriginal = `http://cavalo.cc:80${req.path}`;
    console.log(`🎯 Proxy: ${urlOriginal}`);
    
    const response = await fetchWithCookies(urlOriginal, {
      headers: {
        "Host": "cavalo.cc",
        "Accept": "video/mp4,*/*",
        "Range": req.headers["range"] || "",
        "Referer": "http://cavalo.cc/"
      },
      redirect: "follow"
    });

    if (response.ok || response.status === 206) {
      const headersToCopy = ["content-type", "content-length", "content-range", "accept-ranges"];
      headersToCopy.forEach(header => {
        const value = response.headers.get(header);
        if (value) res.setHeader(header, value);
      });

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.status(response.status);
      response.body.pipe(res);
    } else {
      res.status(response.status).send(`Erro ${response.status}`);
    }
  } catch (error) {
    console.error("❌ Erro:", error);
    res.status(500).send("Erro interno");
  }
}

// 404
app.use((req, res) => {
  res.status(404).json({ 
    error: "Rota não encontrada", 
    path: req.path,
    available: ["/health", "/series/*", "/movie/*", "/*.mp4"]
  });
});

export default app;