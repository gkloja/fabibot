import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
const PORT = process.env.PORT || 3000;
const MASK = "https://fabibot-taupe.vercel.app";

app.use(cookieParser());

// Cookie jar simples para manter cookies entre requisições
let cookieJar = {};

// Headers base para simular Chrome
const baseHeaders = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8,en-US;q=0.7",
  "Accept-Encoding": "gzip, deflate",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Cache-Control": "max-age=0"
};

// ===== FUNÇÃO PARA FAZER REQUISIÇÕES COM COOKIES =====
async function fetchWithCookies(url, options = {}) {
  const headers = { ...baseHeaders, ...options.headers };
  // Adiciona cookies se existirem para o domínio
  const domain = new URL(url).hostname;
  if (cookieJar[domain]) {
    headers["Cookie"] = cookieJar[domain];
  }
  const response = await fetch(url, { ...options, headers, redirect: "follow" });
  // Salva novos cookies
  const setCookie = response.headers.raw()["set-cookie"];
  if (setCookie) {
    cookieJar[domain] = setCookie.map(c => c.split(';')[0]).join('; ');
  }
  return response;
}

// ===== FUNÇÃO PARA RENOVAR TOKEN =====
async function renovarToken(caminhoOriginal) {
  try {
    // Acessa a página do vídeo (sem .mp4) para gerar novo token
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
    console.log(`📄 HTML recebido (primeiros 500 chars):`, html.substring(0, 500));

    // Procura pelo token no HTML (pode estar em várias formas)
    const tokenMatch = html.match(/token=([a-zA-Z0-9_.-]+)/);
    if (!tokenMatch) {
      console.log("❌ Token não encontrado no HTML");
      return null;
    }
    
    const token = tokenMatch[1];
    console.log(`✅ Token encontrado: ${token.substring(0, 20)}...`);
    
    // Procura pelo IP (pode haver vários)
    const ipMatch = html.match(/(\d+\.\d+\.\d+\.\d+)/g);
    let ip = "209.131.121.28"; // IP padrão (série)
    if (ipMatch && ipMatch.length > 0) {
      ip = ipMatch[ipMatch.length - 1];
      console.log(`🌐 IP detectado: ${ip}`);
    }
    
    // Extrai parâmetros adicionais (uc, pc)
    const ucMatch = html.match(/uc=([^"&\s]+)/);
    const pcMatch = html.match(/pc=([^"&\s]+)/);
    const uc = ucMatch ? ucMatch[1] : "QWx0YWlycGxheTIwMjQ=";
    const pc = pcMatch ? pcMatch[1] : "NDk5NU5GVFN5Yndh";
    
    // Constrói a URL completa
    const arquivo = caminhoOriginal.split('/').pop();
    const videoUrl = `http://${ip}/deliver/${arquivo}?token=${token}&uc=${uc}&pc=${pc}`;
    
    console.log(`🎯 Nova URL: ${videoUrl}`);
    return videoUrl;
    
  } catch (error) {
    console.error("❌ Erro na renovação:", error);
    return null;
  }
}

// ===== PROXY PRINCIPAL =====
app.get("/*", async (req, res) => {
  console.log("\n" + "=".repeat(60));
  console.log(`🔍 REQUISIÇÃO: ${req.method} ${req.path}`);
  console.log(`📌 Headers recebidos:`, req.headers);
  
  // Se for OPTIONS, responda rapidamente
  if (req.method === 'OPTIONS') {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range");
    return res.status(204).end();
  }

  try {
    let videoUrl;
    let tentativas = 0;
    const maxTentativas = 2;
    
    while (tentativas < maxTentativas) {
      tentativas++;
      console.log(`\n📌 Tentativa ${tentativas}:`);
      
      if (tentativas === 1) {
        // Primeira tentativa: usa o cavalo.cc diretamente (pode redirecionar)
        videoUrl = `http://cavalo.cc:80${req.path}`;
        console.log(`🎯 Tentando URL original: ${videoUrl}`);
      } else {
        // Segunda tentativa: renova o token (apenas para MP4)
        if (req.path.includes('.mp4')) {
          console.log(`🔄 Tentando renovar token...`);
          videoUrl = await renovarToken(req.path);
          if (!videoUrl) {
            console.log("❌ Falha na renovação");
            break;
          }
        } else {
          console.log("⏭️ Não é MP4, não há renovação");
          break;
        }
      }
      
      // Faz a requisição para obter o vídeo
      const response = await fetchWithCookies(videoUrl, {
        headers: {
          "Host": new URL(videoUrl).host,
          "Accept": videoUrl.includes('.mp4') ? "video/mp4,*/*" : "*/*",
          "Range": req.headers["range"] || "",
          "Referer": "http://cavalo.cc/",
          "Origin": "http://cavalo.cc"
        }
      });
      
      console.log(`📥 Status: ${response.status} ${response.statusText}`);
      console.log(`📥 Headers resposta:`, Object.fromEntries(response.headers.entries()));

      // Se funcionou, envia o vídeo
      if (response.ok || response.status === 206) { // 206 Partial Content para streaming
        // Copiar headers importantes
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
        console.log(`✅ Vídeo sendo enviado...`);
        return;
      }
      
      console.log(`⚠️ Tentativa ${tentativas} falhou (${response.status})`);
    }
    
    // Se todas as tentativas falharam
    res.status(404).send(`
      <html>
        <head><title>Vídeo não encontrado</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>🎬 Vídeo indisponível no momento</h1>
          <p>Não foi possível obter o vídeo após ${maxTentativas} tentativas.</p>
          <p><a href="${req.path}">Clique aqui para tentar novamente</a></p>
          <p><small>Path: ${req.path}</small></p>
        </body>
      </html>
    `);
    
  } catch (error) {
    console.error("❌ Erro grave:", error);
    res.status(500).send("Erro interno no servidor");
  }
});

// ===== HEALTH CHECK =====
app.get("/health", (req, res) => {
  res.json({ status: "ok", mask: MASK, time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log("\n" + "🚀".repeat(30));
  console.log(`🚀 PROXY INTELIGENTE RODANDO NA PORTA ${PORT}`);
  console.log(`🎭 MASK: ${MASK}`);
  console.log(`✅ Exemplo: ${MASK}/series/Altairplay2024/4995NFTSybwa/361267.mp4`);
  console.log("🚀".repeat(30) + "\n");
});
