import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
const MASK = "https://fabibot-taupe.vercel.app";

app.use(cookieParser());

// Cookie jar
let cookieJar = {};

// Headers do Chrome (completos)
const CHROME_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Cache-Control": "max-age=0"
};

async function fetchWithCookies(url, options = {}) {
  const headers = { ...CHROME_HEADERS, ...options.headers };
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

// Cache de URLs redirecionadas (expira em 10 minutos)
const redirectCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

app.get("/*", async (req, res) => {
  console.log("\n" + "=".repeat(60));
  console.log(`🔍 ${req.path}`);

  if (req.path === '/health') {
    return res.json({ status: "ok", mask: MASK });
  }

  if (req.method === 'OPTIONS') {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range");
    return res.status(204).end();
  }

  const cacheKey = req.path;
  const cached = redirectCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`💾 Usando cache: ${cached.url}`);
    try {
      const response = await fetchWithCookies(cached.url, {
        headers: {
          "Host": new URL(cached.url).hostname,
          "Range": req.headers["range"] || "",
          "Referer": "http://cavalo.cc/"
        }
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
        return;
      } else {
        redirectCache.delete(cacheKey);
      }
    } catch (e) {
      redirectCache.delete(cacheKey);
    }
  }

  try {
    const urlOriginal = `http://cavalo.cc:80${req.path}`;
    console.log(`🎯 Acessando: ${urlOriginal}`);
    
    // Primeira tentativa
    let response = await fetchWithCookies(urlOriginal, {
      headers: {
        "Host": "cavalo.cc",
        "Referer": "http://cavalo.cc/",
        "Origin": "http://cavalo.cc",
        "Range": req.headers["range"] || ""
      }
    });

    // Se falhar (404), pode ser token expirado, esperar e tentar de novo
    if (response.status === 404) {
      console.log("⚠️ 404, tentando novamente em 1s...");
      await new Promise(resolve => setTimeout(resolve, 1000));
      response = await fetchWithCookies(urlOriginal, {
        headers: {
          "Host": "cavalo.cc",
          "Referer": "http://cavalo.cc/",
          "Origin": "http://cavalo.cc",
          "Range": req.headers["range"] || ""
        }
      });
    }

    if (response.ok || response.status === 206) {
      const finalUrl = response.url;
      redirectCache.set(cacheKey, { url: finalUrl, timestamp: Date.now() });

      const headersToCopy = ["content-type", "content-length", "content-range", "accept-ranges"];
      headersToCopy.forEach(header => {
        const value = response.headers.get(header);
        if (value) res.setHeader(header, value);
      });

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.status(response.status);
      response.body.pipe(res);
      console.log(`✅ Vídeo enviado!`);
      return;
    }

    res.status(response.status).send(`Erro ${response.status}`);
  } catch (error) {
    console.error("❌ Erro:", error);
    res.status(500).send("Erro interno");
  }
});

export default app;