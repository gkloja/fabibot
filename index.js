import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
const MASK = "https://fabibot-taupe.vercel.app";

app.use(cookieParser());

// Headers fixos do Chrome
const CHROME_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1"
};

// Cache para tokens que funcionaram
let tokenCache = new Map();

// ===== FUNÇÃO PARA SEGUIR REDIRECIONAMENTOS =====
async function seguirRedirecionamentos(url, headers, tentativa = 1) {
  console.log(`🔄 Tentativa ${tentativa}: ${url}`);
  
  const response = await fetch(url, {
    headers: headers,
    redirect: "manual"
  });

  // Se redirecionou (302), seguir
  if (response.status === 302 || response.status === 301) {
    const location = response.headers.get("location");
    console.log(`➡️ Redirecionando para: ${location}`);
    
    // Guardar no cache
    tokenCache.set(url, {
      redirectUrl: location,
      timestamp: Date.now()
    });
    
    // Fazer requisição para a nova URL
    return await fetch(location, {
      headers: {
        ...CHROME_HEADERS,
        "Host": new URL(location).hostname
      }
    });
  }
  
  // Se deu 404, mas temos cache, tentar o cache
  if (response.status === 404 && tentativa < 3) {
    console.log(`⚠️ 404 na tentativa ${tentativa}, tentando novamente...`);
    
    // Esperar 1 segundo e tentar de novo
    await new Promise(resolve => setTimeout(resolve, 1000));
    return await seguirRedirecionamentos(url, headers, tentativa + 1);
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

  try {
    const urlOriginal = `http://cavalo.cc:80${req.path}`;
    
    // Verificar se temos cache para esta URL
    const cached = tokenCache.get(urlOriginal);
    if (cached && (Date.now() - cached.timestamp) < 3600000) { // Cache válido por 1 hora
      console.log(`💾 Usando cache: ${cached.redirectUrl}`);
      
      const response = await fetch(cached.redirectUrl, {
        headers: {
          ...CHROME_HEADERS,
          "Host": new URL(cached.redirectUrl).hostname,
          "Range": req.headers["range"] || ""
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
        console.log(`✅ Vídeo enviado (cache)!`);
        return;
      }
    }

    // Seguir redirecionamentos
    const response = await seguirRedirecionamentos(urlOriginal, {
      ...CHROME_HEADERS,
      "Host": "cavalo.cc"
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
      console.log(`✅ Vídeo enviado!`);
      return;
    }

    // Se falhou, tenta mais uma vez após 2 segundos
    if (response.status === 404) {
      console.log(`⏳ 404, tentando novamente em 2 segundos...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const retryResponse = await seguirRedirecionamentos(urlOriginal, {
        ...CHROME_HEADERS,
        "Host": "cavalo.cc"
      });

      if (retryResponse.ok || retryResponse.status === 206) {
        const headersToCopy = ["content-type", "content-length", "content-range", "accept-ranges"];
        headersToCopy.forEach(header => {
          const value = retryResponse.headers.get(header);
          if (value) res.setHeader(header, value);
        });

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(retryResponse.status);
        retryResponse.body.pipe(res);
        console.log(`✅ Vídeo enviado (após retentativa)!`);
        return;
      }
    }
    
    res.status(response.status).send(`Erro ${response.status}`);
    
  } catch (error) {
    console.error("❌ Erro:", error);
    res.status(500).send("Erro interno");
  }
});

// ===== EXPORTAR =====
export default app;