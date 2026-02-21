import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();

app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.json({ limit: '20mb' }));
app.use(cookieParser());

const BASE = "http://cavalo.cc:80";
const MASK = "https://fabibot-taupe.vercel.app";

// ===== FUNÇÃO REUTILIZÁVEL PARA PROXY DE VÍDEO =====
async function proxyVideo(req, res, tipo) {
  try {
    const targetUrl = BASE + req.url;
    console.log("=".repeat(50));
    console.log(`🎬 Proxy ${tipo}: ${targetUrl}`);
    
    // FAZER A REQUISIÇÃO COM SUPORTE A REDIRECIONAMENTO
    const response = await fetch(targetUrl, {
      headers: {
        "Host": "cavalo.cc",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "video/mp4, video/webm, video/ogg, */*",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Range": req.headers["range"] || "",
        "Referer": "http://cavalo.cc/",
        "Origin": "http://cavalo.cc",
        "Connection": "keep-alive"
      },
      redirect: "follow", // SEGUIR REDIRECIONAMENTOS
      follow: 5 // MÁXIMO DE 5 REDIRECIONAMENTOS
    });

    // LOG DA URL FINAL (APÓS REDIRECIONAMENTOS)
    console.log(`🔄 URL final: ${response.url}`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    // Log dos headers da resposta
    console.log("📋 Headers da resposta:");
    const headersToLog = ["content-type", "content-length", "content-range", "location"];
    headersToLog.forEach(header => {
      const value = response.headers.get(header);
      if (value) console.log(`   ${header}: ${value}`);
    });

    // Se não encontrou o recurso
    if (response.status === 404) {
      console.log(`❌ 404 - Recurso não encontrado: ${targetUrl}`);
      return res.status(404).send("Vídeo não encontrado");
    }

    // Se precisar de autenticação
    if (response.status === 401 || response.status === 403) {
      console.log(`❌ ${response.status} - Sem autorização`);
      return res.status(response.status).send("Acesso negado ao vídeo");
    }

    // Copiar headers importantes para o cliente
    const headersToCopy = ["content-type", "content-length", "content-range", "accept-ranges", "location"];
    headersToCopy.forEach(header => {
      const value = response.headers.get(header);
      if (value) res.setHeader(header, value);
    });

    // Headers CORS obrigatórios
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range");

    res.status(response.status);
    
    // Stream do vídeo para o cliente
    response.body.pipe(res);
    
    console.log(`✅ Vídeo sendo transmitido para o cliente`);
    console.log("=".repeat(50));
    
  } catch (error) {
    console.error(`❌ Erro no ${tipo}:`, error);
    res.status(500).send("Erro ao carregar vídeo: " + error.message);
  }
}

// ===== ROTA PARA SÉRIES =====
app.get("/series/*", async (req, res) => {
  await proxyVideo(req, res, "série");
});

// ===== ROTA PARA FILMES =====
app.get("/movie/*", async (req, res) => {
  await proxyVideo(req, res, "filme");
});

// ===== ROTA OPTIONS PARA SÉRIES =====
app.options("/series/*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range");
  res.status(204).end();
});

// ===== ROTA OPTIONS PARA FILMES =====
app.options("/movie/*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range");
  res.status(204).end();
});

// ===== HEALTH CHECK =====
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    base: BASE, 
    mask: MASK,
    timestamp: new Date().toISOString()
  });
});

// ===== ROTA PARA TESTE DIRETO =====
app.get("/test", async (req, res) => {
  const testUrl = "http://cavalo.cc:80/series/Altairplay2024/4995NFTSybwa/361267.mp4";
  
  try {
    const response = await fetch(testUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      redirect: "follow"
    });
    
    res.json({
      url: testUrl,
      status: response.status,
      redirected: response.redirected,
      finalUrl: response.url,
      headers: Object.fromEntries(response.headers)
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  🚀 Proxy de vídeos rodando na porta ${PORT}
  🔗 Encaminhando para: ${BASE}
  🎭 URL da máscara: ${MASK}
  ✅ Séries: ${MASK}/series/Altairplay2024/4995NFTSybwa/361267.mp4
  ✅ Filmes: ${MASK}/movie/Altairplay2024/4995NFTSybwa/100008.mp4
  🔍 Teste: ${MASK}/test
  `);
});