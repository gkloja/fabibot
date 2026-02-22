import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
const PORT = process.env.PORT || 3000;

const MASK = "https://fabibot-taupe.vercel.app";

app.use(cookieParser());

// Cache simples para evitar reprocessamento
const urlCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// ===== FUNÇÃO PARA OBTER URL REAL =====
async function obterUrlReal(caminho) {
  const cacheKey = caminho;
  
  // Verifica cache
  if (urlCache.has(cacheKey)) {
    const cached = urlCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`📦 Usando cache: ${cached.url}`);
      return cached.url;
    }
  }
  
  try {
    // Tenta acessar SEM .mp4 primeiro
    const caminhoSemMp4 = caminho.replace('.mp4', '');
    const urlSemMp4 = `http://cavalo.cc:80${caminhoSemMp4}`;
    
    console.log(`🔍 Verificando: ${urlSemMp4}`);
    
    const response = await fetch(urlSemMp4, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Referer": "http://cavalo.cc/",
      }
    });
    
    if (!response.ok) {
      console.log(`⚠️ Página retornou ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // PROCURA PELO TOKEN - FORMATO ESPECÍFICO DO CAVALO.CC
    const tokenMatch = html.match(/token=([a-zA-Z0-9_.-]+)/);
    const ipMatch = html.match(/https?:\/\/(\d+\.\d+\.\d+\.\d+)/);
    const ucMatch = html.match(/uc=([^"&\s]+)/);
    const pcMatch = html.match(/pc=([^"&\s]+)/);
    
    if (tokenMatch) {
      const token = tokenMatch[1];
      
      // Pega o IP - se não encontrar, usa um padrão
      let ip = "209.131.121.24";
      if (ipMatch) {
        ip = ipMatch[1];
      } else {
        // Tenta encontrar IP no formato antigo
        const ips = html.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g);
        if (ips && ips.length > 0) {
          ip = ips[ips.length - 1];
        }
      }
      
      const uc = ucMatch ? ucMatch[1] : "QWx0YWlycGxheTIwMjQ=";
      const pc = pcMatch ? pcMatch[1] : "NDk5NU5GVFN5Yndh";
      
      const arquivo = caminho.split('/').pop();
      const videoUrl = `http://${ip}/deliver/${arquivo}?token=${token}&uc=${uc}&pc=${pc}`;
      
      console.log(`✅ URL construída: ${videoUrl}`);
      
      // Salva no cache
      urlCache.set(cacheKey, {
        url: videoUrl,
        timestamp: Date.now()
      });
      
      return videoUrl;
    }
    
    // Se não encontrou token, pode ser que a página já seja o vídeo
    if (html.includes('video') || html.includes('mp4')) {
      console.log(`⚠️ Pode ser vídeo direto, tentando original...`);
      return `http://cavalo.cc:80${caminho}`;
    }
    
    console.log(`❌ Token não encontrado no HTML`);
    return null;
    
  } catch (error) {
    console.error(`❌ Erro ao obter URL real:`, error.message);
    return null;
  }
}

// ===== PROXY PRINCIPAL =====
app.get("/series/*", async (req, res) => {
  console.log("\n" + "📺".repeat(30));
  console.log(`📺 SÉRIE: ${req.path}`);
  await handleVideoRequest(req, res);
});

app.get("/movie/*", async (req, res) => {
  console.log("\n" + "🎬".repeat(30));
  console.log(`🎬 FILME: ${req.path}`);
  await handleVideoRequest(req, res);
});

// ===== FUNÇÃO COMPARTILHADA =====
async function handleVideoRequest(req, res) {
  // Headers CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range");
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  try {
    // TENTATIVA 1: URL direta
    const urlDireta = `http://cavalo.cc:80${req.path}`;
    console.log(`📥 Tentativa 1: ${urlDireta}`);
    
    let response = await fetch(urlDireta, {
      headers: {
        "Range": req.headers["range"] || "",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "http://cavalo.cc/",
      }
    });
    
    if (response.ok || response.status === 206) {
      console.log(`✅ Tentativa 1 funcionou!`);
      return enviarResposta(response, res);
    }
    
    // TENTATIVA 2: Descobrir URL real
    console.log(`⚠️ Tentativa 1 falhou (${response.status})`);
    console.log(`🔄 Tentativa 2: Descobrindo URL real...`);
    
    const urlReal = await obterUrlReal(req.path);
    
    if (!urlReal) {
      console.log(`❌ Não foi possível descobrir URL real`);
      return mostrarErro(res, req.path);
    }
    
    console.log(`📥 Tentativa 2: ${urlReal}`);
    
    response = await fetch(urlReal, {
      headers: {
        "Range": req.headers["range"] || "",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "http://cavalo.cc/",
      }
    });
    
    if (response.ok || response.status === 206) {
      console.log(`✅ Tentativa 2 funcionou!`);
      return enviarResposta(response, res);
    }
    
    // TENTATIVA 3: Sem headers especiais
    console.log(`⚠️ Tentativa 2 falhou (${response.status})`);
    console.log(`🔄 Tentativa 3: Requisição simples...`);
    
    response = await fetch(urlReal, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });
    
    if (response.ok) {
      console.log(`✅ Tentativa 3 funcionou!`);
      return enviarResposta(response, res);
    }
    
    console.log(`❌ Todas as tentativas falharam`);
    mostrarErro(res, req.path);
    
  } catch (error) {
    console.error(`❌ Erro:`, error.message);
    res.status(500).send(`Erro: ${error.message}`);
  }
}

// ===== FUNÇÃO PARA ENVIAR RESPOSTA =====
function enviarResposta(response, res) {
  // Headers importantes
  const headersParaCopiar = [
    "content-type", 
    "content-length", 
    "content-range", 
    "accept-ranges",
    "cache-control"
  ];
  
  headersParaCopiar.forEach(header => {
    const valor = response.headers.get(header);
    if (valor) res.setHeader(header, valor);
  });
  
  res.status(response.status);
  response.body.pipe(res);
}

// ===== FUNÇÃO PARA MOSTRAR ERRO =====
function mostrarErro(res, path) {
  res.status(404).send(`
    <html>
      <head>
        <title>Vídeo não encontrado</title>
        <style>
          body { font-family: Arial; text-align: center; padding: 50px; background: #1a1a1a; color: white; }
          .container { max-width: 600px; margin: 0 auto; }
          .error { background: #ff4444; padding: 20px; border-radius: 10px; margin: 20px 0; }
          button { background: #4CAF50; color: white; border: none; padding: 10px 20px; 
                   border-radius: 5px; cursor: pointer; font-size: 16px; margin: 10px; }
          .path { background: #333; padding: 10px; border-radius: 5px; font-family: monospace; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🎬 Vídeo indisponível</h1>
          <div class="error">
            <p>O vídeo solicitado não pôde ser carregado no momento.</p>
          </div>
          <div class="path">
            <p>Caminho: ${path}</p>
          </div>
          <button onclick="window.location.reload()">🔄 Tentar novamente</button>
          <button onclick="window.location.href='/'">🏠 Voltar</button>
          <p><small>Isso geralmente acontece quando o token expira. 
          Tente novamente em alguns segundos.</small></p>
        </div>
      </body>
    </html>
  `);
}

// ===== HEALTH CHECK =====
app.get("/health", (req, res) => {
  res.json({
    status: "online",
    mask: MASK,
    cache: urlCache.size,
    time: new Date().toISOString()
  });
});

// ===== LIMPAR CACHE =====
app.get("/clear-cache", (req, res) => {
  urlCache.clear();
  res.json({ message: "Cache limpo!", size: urlCache.size });
});

// ===== INICIAR SERVIDOR =====
app.listen(PORT, () => {
  console.log("\n" + "=".repeat(50));
  console.log("🚀 PROXY CAVALO.CC INICIADO");
  console.log("=".repeat(50));
  console.log(`📌 MASK: ${MASK}`);
  console.log(`📌 PORT: ${PORT}`);
  console.log("\n📌 ROTAS ATIVAS:");
  console.log(`🎬 Filme: ${MASK}/movie/Altairplay2024/4995NFTSybwa/100008.mp4`);
  console.log(`📺 Série: ${MASK}/series/Altairplay2024/4995NFTSybwa/361267.mp4`);
  console.log(`💚 Health: ${MASK}/health`);
  console.log(`🧹 Clear cache: ${MASK}/clear-cache`);
  console.log("=".repeat(50) + "\n");
});