import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
const PORT = process.env.PORT || 80;

// === CONFIGURAÇÃO ===
const BASE = "http://cavalo.cc:80";
const MASK = "https://fabibot-taupe.vercel.app";

app.use(cookieParser());

// ===== PROXY UNIVERSAL - CAPTURA TUDO =====
app.get("*", async (req, res) => {
  console.log("\n" + "=".repeat(60));
  console.log("🔍 REQUISIÇÃO RECEBIDA:");
  console.log(`📌 PATH: ${req.path}`);
  console.log(`📌 QUERY: ${JSON.stringify(req.query)}`);
  console.log(`📌 HEADERS:`, req.headers);
  
  try {
    // Constrói URL alvo
    const targetUrl = BASE + req.path + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
    console.log(`🎯 TARGET URL: ${targetUrl}`);
    
    // Headers IGUAIS ao Chrome (cópia exata)
    const headers = {
      "Host": "cavalo.cc",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "video/mp4, video/webm, video/ogg, application/json, */*",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8,en-US;q=0.7",
      "Accept-Encoding": "gzip, deflate",
      "Range": req.headers["range"] || "",
      "Referer": "http://cavalo.cc/",
      "Origin": "http://cavalo.cc",
      "Connection": "keep-alive",
      "Sec-Fetch-Dest": "video",
      "Sec-Fetch-Mode": "no-cors",
      "Sec-Fetch-Site": "same-origin",
      "Pragma": "no-cache",
      "Cache-Control": "no-cache"
    };
    
    console.log(`📤 ENVIANDO HEADERS:`, headers);
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      redirect: "follow",
      follow: 5
    });

    console.log(`📥 RESPOSTA STATUS: ${response.status} ${response.statusText}`);
    console.log(`📥 RESPOSTA HEADERS:`, Object.fromEntries(response.headers.entries()));

    // Se não encontrou
    if (response.status === 404) {
      console.log(`❌ 404 - VÍDEO NÃO ENCONTRADO`);
      return res.status(404).send(`
        <html>
          <body>
            <h1>404 - Vídeo não encontrado</h1>
            <p>URL: ${targetUrl}</p>
            <p>Path: ${req.path}</p>
          </body>
        </html>
      `);
    }

    // Copiar headers de resposta
    const headersToCopy = [
      "content-type", "content-length", "content-range", 
      "accept-ranges", "cache-control", "last-modified", "etag"
    ];
    
    headersToCopy.forEach(header => {
      const value = response.headers.get(header);
      if (value) {
        res.setHeader(header, value);
        console.log(`📋 HEADER COPIADO: ${header}: ${value}`);
      }
    });

    // Headers CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range");

    res.status(response.status);
    
    console.log(`✅ ENVIANDO VÍDEO PARA O CLIENTE...`);
    response.body.pipe(res);
    
    response.body.on('end', () => {
      console.log(`✅ VÍDEO ENVIADO COMPLETO!`);
    });
    
  } catch (error) {
    console.error("❌ ERRO GRAVE:", error);
    res.status(500).send(`
      <html>
        <body>
          <h1>500 - Erro interno</h1>
          <p>${error.message}</p>
        </body>
      </html>
    `);
  }
});

// ===== ROTA OPTIONS (CORS PREFLIGHT) =====
app.options("*", (req, res) => {
  console.log(`🔄 OPTIONS recebido para ${req.path}`);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
  res.status(204).end();
});

// ===== HEALTH CHECK =====
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    base: BASE, 
    mask: MASK,
    time: new Date().toISOString()
  });
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log("\n" + "🚀".repeat(20));
  console.log(`🚀 PROXY DE VÍDEOS RODANDO NA PORTA ${PORT}`);
  console.log(`🎯 BASE: ${BASE}`);
  console.log(`🎭 MASK: ${MASK}`);
  console.log(`📝 TESTE SÉRIE: ${MASK}/series/Altairplay2024/4995NFTSybwa/361267.mp4`);
  console.log(`📝 TESTE FILME: ${MASK}/movie/Altairplay2024/4995NFTSybwa/100008.mp4`);
  console.log("🚀".repeat(20) + "\n");
});