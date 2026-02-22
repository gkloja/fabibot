import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
const MASK = "https://fabibot-taupe.vercel.app";

app.use(cookieParser());

// Cookie jar para manter sessão
let cookieJar = {};

// Headers base simulando Chrome
const CHROME_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1"
};

// Função para fetch com cookies e redirect follow
async function fetchWithCookies(url, options = {}) {
  const headers = { ...CHROME_HEADERS, ...options.headers };
  const domain = new URL(url).hostname;
  if (cookieJar[domain]) {
    headers["Cookie"] = cookieJar[domain];
  }

  const response = await fetch(url, { ...options, headers, redirect: "follow" });

  // Salvar cookies recebidos
  const setCookie = response.headers.raw()["set-cookie"];
  if (setCookie) {
    cookieJar[domain] = setCookie.map(c => c.split(';')[0]).join('; ');
  }

  return response;
}

// Função de retry com backoff exponencial
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetchWithCookies(url, options);
      // Se for 404, tenta novamente (pode ser token expirado)
      if (response.status === 404) {
        console.log(`⚠️ Tentativa ${i+1} retornou 404, tentando novamente...`);
        if (i === maxRetries - 1) return response; // última tentativa falhou
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // backoff
        continue;
      }
      // Se for OK ou 206 (partial content), retorna
      if (response.ok || response.status === 206) return response;
      // Outros erros (500, etc) também podem ser tentados novamente?
      return response; // por enquanto, retorna qualquer outro status
    } catch (err) {
      console.log(`⚠️ Erro na tentativa ${i+1}: ${err.message}`);
      if (i === maxRetries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error("Max retries reached");
}

// ===== PROXY PRINCIPAL =====
app.get("/*", async (req, res) => {
  console.log("\n" + "=".repeat(60));
  console.log(`🔍 ${req.path}`);

  // Health check
  if (req.path === '/health') {
    return res.json({ status: "ok", mask: MASK });
  }

  // OPTIONS
  if (req.method === 'OPTIONS') {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range");
    return res.status(204).end();
  }

  try {
    const urlOriginal = `http://cavalo.cc:80${req.path}`;
    console.log(`🎯 Acessando: ${urlOriginal}`);

    // Faz a requisição com retry
    const response = await fetchWithRetry(urlOriginal, {
      headers: {
        "Host": "cavalo.cc",
        "Range": req.headers["range"] || ""
      }
    });

    // Se ainda assim for 404, retorna mensagem amigável
    if (response.status === 404) {
      console.log(`❌ 404 após todas tentativas`);
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

    // Copiar headers importantes
    const headersToCopy = ["content-type", "content-length", "content-range", "accept-ranges"];
    headersToCopy.forEach(header => {
      const value = response.headers.get(header);
      if (value) res.setHeader(header, value);
    });

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range");

    res.status(response.status);
    response.body.pipe(res);
    console.log(`✅ Vídeo sendo enviado!`);

  } catch (error) {
    console.error("❌ Erro fatal:", error);
    res.status(500).send("Erro interno no proxy");
  }
});

// ===== EXPORTAR =====
export default app;