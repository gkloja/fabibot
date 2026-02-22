import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
const PORT = process.env.PORT || 3000;
const MASK = "https://fabibot-taupe.vercel.app";

app.use(cookieParser());

// Token padrão para fallback (série 361267)
const TOKEN_PADRAO = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjAwMDEiLCJleHAiOjE3NzE3NTI1MjF9.eyJ1YyI6IlFXeDBZV2x5Y0d4aGVUSXdNalE9IiwicGMiOiJORGs1TlU1R1ZGTjVZbmRoIiwic3QiOiIzNjEyNjcubXA0IiwiaXAiOiIxODcuMjcuMTQ0LjE0OSJ9.j9dsiMIQkCEEsOAoRcmmzNFnWq8wPLMFmHncd3Z4n10";
const UC_PADRAO = "QWx0YWlycGxheTIwMjQ=";
const PC_PADRAO = "NDk5NU5GVFN5Yndh";
const IP_PADRAO = "209.131.121.28";

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

// ===== FUNÇÃO PARA RENOVAR TOKEN =====
async function renovarToken(caminhoOriginal) {
  try {
    const pageUrl = `http://cavalo.cc:80${caminhoOriginal.replace('.mp4', '')}`;
    console.log(`🔄 Acessando página: ${pageUrl}`);
    
    const pageResponse = await fetchWithCookies(pageUrl, {
      headers: {
        "Host": "cavalo.cc",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Referer": "http://cavalo.cc/",
        "Origin": "http://cavalo.cc"
      }
    });

    const html = await pageResponse.text();
    
    // Procura pelo token
    const tokenMatch = html.match(/token=([a-zA-Z0-9_.-]+)/);
    if (!tokenMatch) {
      console.log("❌ Token não encontrado");
      return null;
    }
    
    const token = tokenMatch[1];
    
    // Procura pelo IP
    const ipMatch = html.match(/(\d+\.\d+\.\d+\.\d+)/g);
    const ip = ipMatch ? ipMatch[ipMatch.length - 1] : IP_PADRAO;
    
    // Parâmetros adicionais
    const ucMatch = html.match(/uc=([^"&\s]+)/);
    const pcMatch = html.match(/pc=([^"&\s]+)/);
    const uc = ucMatch ? ucMatch[1] : UC_PADRAO;
    const pc = pcMatch ? pcMatch[1] : PC_PADRAO;
    
    const arquivo = caminhoOriginal.split('/').pop();
    return `http://${ip}/deliver/${arquivo}?token=${token}&uc=${uc}&pc=${pc}`;
    
  } catch (error) {
    console.error("❌ Erro na renovação:", error);
    return null;
  }
}

// ===== FUNÇÃO PARA GERAR URL FALLBACK =====
function gerarUrlFallback(caminhoOriginal) {
  const arquivo = caminhoOriginal.split('/').pop();
  return `http://${IP_PADRAO}/deliver/${arquivo}?token=${TOKEN_PADRAO}&uc=${UC_PADRAO}&pc=${PC_PADRAO}`;
}

// ===== PROXY PRINCIPAL =====
app.get("/*", async (req, res) => {
  console.log("\n" + "=".repeat(60));
  console.log(`🔍 REQUISIÇÃO: ${req.path}`);
  
  // Ignorar rotas especiais
  if (req.path === '/health' || req.path === '/favicon.ico') {
    return res.status(404).send('Rota não encontrada');
  }
  
  // Se for OPTIONS, responde CORS
  if (req.method === 'OPTIONS') {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range");
    return res.status(204).end();
  }

  try {
    let response;
    let tentativas = [
      { tipo: "original", url: `http://cavalo.cc:80${req.path}` },
      { tipo: "renovado", url: null }, // Será preenchido se necessário
      { tipo: "fallback", url: gerarUrlFallback(req.path) }
    ];

    for (let i = 0; i < tentativas.length; i++) {
      const tentativa = tentativas[i];
      
      if (tentativa.tipo === "renovado" && req.path.includes('.mp4')) {
        console.log(`🔄 Tentando renovar token...`);
        tentativa.url = await renovarToken(req.path);
        if (!tentativa.url) continue;
      }
      
      if (!tentativa.url) continue;
      
      console.log(`🎯 Tentativa ${i+1} (${tentativa.tipo}): ${tentativa.url}`);
      
      response = await fetchWithCookies(tentativa.url, {
        headers: {
          "Host": new URL(tentativa.url).host,
          "Accept": tentativa.url.includes('.mp4') ? "video/mp4,*/*" : "*/*",
          "Range": req.headers["range"] || "",
          "Referer": "http://cavalo.cc/",
          "Origin": "http://cavalo.cc"
        }
      });

      console.log(`📥 Status: ${response.status}`);

      if (response.ok || response.status === 206) {
        break; // Funcionou!
      }
    }

    // Se funcionou, envia o vídeo
    if (response && (response.ok || response.status === 206)) {
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
    
    // Se todas falharam
    res.status(404).send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>🎬 Vídeo indisponível</h1>
          <p>Todas as tentativas falharam.</p>
          <p><a href="${req.path}">Tentar novamente</a></p>
          <p><small>Path: ${req.path}</small></p>
        </body>
      </html>
    `);
    
  } catch (error) {
    console.error("❌ Erro:", error);
    res.status(500).send("Erro interno");
  }
});

// ===== HEALTH CHECK =====
app.get("/health", (req, res) => {
  res.json({ status: "ok", mask: MASK, time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log("\n" + "🚀".repeat(30));
  console.log(`🚀 PROXY RODANDO NA PORTA ${PORT}`);
  console.log(`🎭 MASK: ${MASK}`);
  console.log(`✅ Exemplo: ${MASK}/series/Altairplay2024/4995NFTSybwa/361267.mp4`);
  console.log(`🔄 Fallback ativado com token padrão`);
  console.log("🚀".repeat(30) + "\n");
});
