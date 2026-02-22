import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
const MASK = "https://fabibot-taupe.vercel.app";

app.use(cookieParser());

// Cookie jar para manter sessão entre requisições
let cookieJar = {};

// Headers completos do Chrome (incluindo Sec-Fetch-*)
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

// Função para fazer fetch com cookies e guardar novos cookies
async function fetchWithCookies(url, options = {}) {
  const headers = { ...CHROME_HEADERS, ...options.headers };
  const domain = new URL(url).hostname;
  
  if (cookieJar[domain]) {
    headers["Cookie"] = cookieJar[domain];
  }
  
  const response = await fetch(url, { ...options, headers, redirect: "manual" });
  
  // Salvar cookies recebidos
  const setCookie = response.headers.raw()["set-cookie"];
  if (setCookie) {
    cookieJar[domain] = setCookie.map(c => c.split(';')[0]).join('; ');
  }
  
  return response;
}

// ===== PROXY PRINCIPAL =====
app.get("/*", async (req, res) => {
  console.log("\n" + "=".repeat(60));
  console.log(`🔍 ${req.path}`);

  // Health check
  if (req.path === '/health') {
    return res.json({ status: "ok", mask: MASK });
  }

  // OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range");
    return res.status(204).end();
  }

  try {
    const urlOriginal = `http://cavalo.cc:80${req.path}`;
    console.log(`1️⃣ Acessando original: ${urlOriginal}`);
    
    // Primeira requisição (pode redirecionar ou dar 404 se token expirado)
    let response = await fetchWithCookies(urlOriginal, {
      headers: {
        "Host": "cavalo.cc",
        "Referer": "http://cavalo.cc/",
        "Origin": "http://cavalo.cc"
      }
    });

    // Se for 404, pode ser token expirado; tenta novamente após 1s (o servidor pode gerar novo token)
    if (response.status === 404) {
      console.log("⚠️ 404, tentando novamente em 1s...");
      await new Promise(resolve => setTimeout(resolve, 1000));
      response = await fetchWithCookies(urlOriginal, {
        headers: {
          "Host": "cavalo.cc",
          "Referer": "http://cavalo.cc/",
          "Origin": "http://cavalo.cc"
        }
      });
    }

    // Se redirecionou (302), pegar a nova URL
    if (response.status === 302 || response.status === 301) {
      const location = response.headers.get("location");
      console.log(`2️⃣ Redirecionou para: ${location}`);
      
      // Segunda requisição com headers completos e cookies
      const response2 = await fetchWithCookies(location, {
        headers: {
          "Host": new URL(location).hostname,
          "Referer": urlOriginal,
          "Origin": "http://cavalo.cc",
          "Range": req.headers["range"] || ""
        }
      });

      console.log(`3️⃣ Status final: ${response2.status}`);

      if (response2.ok || response2.status === 206) {
        const headersToCopy = ["content-type", "content-length", "content-range", "accept-ranges"];
        headersToCopy.forEach(header => {
          const value = response2.headers.get(header);
          if (value) res.setHeader(header, value);
        });

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(response2.status);
        response2.body.pipe(res);
        console.log(`✅ Vídeo enviado!`);
        return;
      }
    }

    // Se chegou aqui, algo deu errado
    res.status(response.status).send(`Erro ${response.status}`);
    
  } catch (error) {
    console.error("❌ Erro:", error);
    res.status(500).send("Erro interno");
  }
});

// ===== EXPORTAR =====
export default app;