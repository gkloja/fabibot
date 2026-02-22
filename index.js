import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
const MASK = "https://fabibot-taupe.vercel.app";

app.use(cookieParser());

// Cookie jar para manter sessão entre requisições
let cookieJar = {};

// Headers completos do Chrome
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

// Função para resolver URL relativa
function resolveURL(base, relative) {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

// Função para seguir redirecionamentos recursivamente
async function followRedirects(url, options, maxRedirects = 5) {
  let currentUrl = url;
  let response;
  for (let i = 0; i < maxRedirects; i++) {
    response = await fetchWithCookies(currentUrl, options);
    if (response.status === 301 || response.status === 302 || response.status === 303 || response.status === 307 || response.status === 308) {
      const location = response.headers.get("location");
      if (!location) break;
      currentUrl = resolveURL(currentUrl, location);
      console.log(`↪️ Redirecionando para: ${currentUrl}`);
      // Atualizar headers para a nova URL (mudar Host, Referer, etc.)
      options.headers = {
        ...options.headers,
        "Host": new URL(currentUrl).hostname,
        "Referer": url // ou currentUrl anterior?
      };
      continue;
    }
    break;
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
    
    // Primeira tentativa com retry em caso de 404
    let response = await followRedirects(urlOriginal, {
      headers: {
        "Host": "cavalo.cc",
        "Referer": "http://cavalo.cc/",
        "Origin": "http://cavalo.cc",
        "Range": req.headers["range"] || ""
      }
    });

    // Se for 404, pode ser token expirado; tentar novamente após 1s
    if (response.status === 404) {
      console.log("⚠️ 404, tentando novamente em 1s...");
      await new Promise(resolve => setTimeout(resolve, 1000));
      response = await followRedirects(urlOriginal, {
        headers: {
          "Host": "cavalo.cc",
          "Referer": "http://cavalo.cc/",
          "Origin": "http://cavalo.cc",
          "Range": req.headers["range"] || ""
        }
      });
    }

    // Se ainda assim for 404, retornar erro amigável
    if (response.status === 404) {
      console.log("❌ 404 após retentativa");
      return res.status(404).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>🎬 Vídeo temporariamente indisponível</h1>
            <p>O servidor de origem retornou 404. Tente novamente em alguns segundos.</p>
            <p><a href="${req.path}">Clique aqui para tentar novamente</a></p>
          </body>
        </html>
      `);
    }

    // Se a resposta for bem-sucedida (200 ou 206), enviar o conteúdo
    if (response.ok || response.status === 206) {
      const headersToCopy = ["content-type", "content-length", "content-range", "accept-ranges"];
      headersToCopy.forEach(header => {
        const value = response.headers.get(header);
        if (value) res.setHeader(header, value);
      });

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.status(response.status);
      response.body.pipe(res);
      console.log(`✅ Vídeo sendo enviado!`);
      return;
    }

    // Qualquer outro status, retornar como está
    res.status(response.status).send(`Erro ${response.status}`);
    
  } catch (error) {
    console.error("❌ Erro:", error);
    res.status(500).send("Erro interno");
  }
});

// ===== EXPORTAR =====
export default app;