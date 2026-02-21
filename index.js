import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
const PORT = process.env.PORT || 3000;

const MASK = "https://fabibot-taupe.vercel.app";

app.use(cookieParser());

// ===== FUNÇÃO PARA RENOVAR TOKEN =====
async function renovarToken(caminhoOriginal) {
  try {
    // Acessa a página do vídeo (sem .mp4) para gerar novo token
    const pageUrl = `http://cavalo.cc:80${caminhoOriginal.replace('.mp4', '')}`;
    console.log(`🔄 Renovando token via: ${pageUrl}`);
    
    const pageResponse = await fetch(pageUrl, {
      headers: {
        "Host": "cavalo.cc",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Referer": "http://cavalo.cc/",
        "Origin": "http://cavalo.cc",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1"
      }
    });

    const html = await pageResponse.text();
    
    // Procura pelo token no HTML
    const tokenMatch = html.match(/token=([a-zA-Z0-9_.-]+)/);
    if (!tokenMatch) {
      console.log("❌ Token não encontrado no HTML");
      return null;
    }
    
    const token = tokenMatch[1];
    console.log(`✅ Token encontrado: ${token.substring(0, 20)}...`);
    
    // Procura pelo IP (agora DINÂMICO!)
    const ipMatch = html.match(/(\d+\.\d+\.\d+\.\d+)/g);
    let ip = "209.131.121.24"; // IP padrão para filme
    
    if (ipMatch && ipMatch.length > 0) {
      // Pega o último IP (geralmente é o do servidor de vídeo)
      ip = ipMatch[ipMatch.length - 1];
      console.log(`🌐 IP detectado: ${ip}`);
    }
    
    // Extrai parâmetros adicionais
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
  console.log(`🔍 REQUISIÇÃO: ${req.path}`);
  console.log(`📌 Tipo: ${req.path.includes('/movie/') ? 'FILME' : 'SÉRIE'}`);
  
  try {
    let videoUrl;
    let tentativas = 0;
    const maxTentativas = 2;
    
    while (tentativas < maxTentativas) {
      tentativas++;
      console.log(`\n📌 Tentativa ${tentativas}:`);
      
      if (tentativas === 1) {
        // Primeira tentativa: usa o cavalo.cc diretamente
        videoUrl = `http://cavalo.cc:80${req.path}`;
        console.log(`🎯 Tentando URL original: ${videoUrl}`);
      } else {
        // Segunda tentativa: renova o token
        console.log(`🔄 Tentando renovar token...`);
        videoUrl = await renovarToken(req.path);
        if (!videoUrl) {
          break;
        }
      }
      
      const response = await fetch(videoUrl, {
        headers: {
          "Host": new URL(videoUrl).host,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "video/mp4, video/webm, video/ogg, */*",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
          "Range": req.headers["range"] || "",
          "Referer": "http://cavalo.cc/",
          "Origin": "http://cavalo.cc",
          "Connection": "keep-alive"
        },
        redirect: "follow"
      });
      
      console.log(`📥 Status: ${response.status}`);

      // Se funcionou, envia o vídeo
      if (response.ok) {
        // Copiar headers importantes
        const headersToCopy = ["content-type", "content-length", "content-range", "accept-ranges"];
        headersToCopy.forEach(header => {
          const value = response.headers.get(header);
          if (value) res.setHeader(header, value);
        });

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Range");

        res.status(response.status);
        response.body.pipe(res);
        console.log(`✅ Vídeo enviado com sucesso!`);
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
          <p>O token pode ter expirado. Tente novamente em alguns segundos.</p>
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

// ===== OPTIONS =====
app.options("/*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range");
  res.status(204).end();
});

// ===== HEALTH CHECK =====
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    mask: MASK,
    time: new Date().toISOString()
  });
});

// ===== INICIAR SERVIDOR =====
app.listen(PORT, () => {
  console.log("\n" + "🚀".repeat(30));
  console.log(`🚀 PROXY INTELIGENTE RODANDO`);
  console.log(`🎭 MASK: ${MASK}`);
  console.log(`✅ SÉRIE: ${MASK}/series/Altairplay2024/4995NFTSybwa/361267.mp4`);
  console.log(`✅ FILME: ${MASK}/movie/Altairplay2024/4995NFTSybwa/100008.mp4`);
  console.log(`🔄 Renovação automática de tokens ATIVADA`);
  console.log("🚀".repeat(30) + "\n");
});