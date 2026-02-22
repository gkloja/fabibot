import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
const PORT = process.env.PORT || 3000;
const MASK = "https://fabibot-taupe.vercel.app";

app.use(cookieParser());

// Cache para evitar reprocessar redirecionamentos com frequência
const redirectCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Limpeza periódica do cache
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of redirectCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      redirectCache.delete(key);
    }
  }
}, 60000);

// Função para obter a URL final (após redirecionamentos)
async function getFinalUrl(originalPath) {
  const cacheKey = originalPath;
  if (redirectCache.has(cacheKey)) {
    const cached = redirectCache.get(cacheKey);
    console.log(`📦 Cache hit: ${cached.url}`);
    return cached.url;
  }

  const cavaloUrl = `http://cavalo.cc:80${originalPath}`;
  console.log(`🌐 Solicitando: ${cavaloUrl}`);

  // Faz uma requisição HEAD para capturar redirecionamento sem baixar corpo
  const response = await fetch(cavaloUrl, {
    method: 'HEAD',
    redirect: 'manual',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'http://cavalo.cc/'
    }
  });

  let finalUrl = cavaloUrl;

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (location) {
      finalUrl = location.startsWith('http') ? location : `http://cavalo.cc:80${location}`;
      console.log(`↪️ Redirecionado para: ${finalUrl}`);
    }
  } else {
    // Se não houver redirecionamento, tenta extrair token do HTML (fallback)
    console.log(`🔍 Sem redirecionamento, tentando extrair token...`);
    const htmlResponse = await fetch(cavaloUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'http://cavalo.cc/'
      }
    });
    const html = await htmlResponse.text();
    const tokenMatch = html.match(/token=([^"&\s]+)/);
    const ipMatch = html.match(/(\d+\.\d+\.\d+\.\d+)/g);
    if (tokenMatch && ipMatch) {
      const token = tokenMatch[1];
      const ip = ipMatch[ipMatch.length - 1];
      const arquivo = originalPath.split('/').pop();
      finalUrl = `http://${ip}/deliver/${arquivo}?token=${token}`;
      // uc e pc podem ser extraídos também, mas a URL acima já funciona?
      // Na prática, a URL de redirecionamento já contém todos os parâmetros.
      // Mas se precisar, podemos adicionar uc e pc.
      console.log(`🔧 URL construída: ${finalUrl}`);
    } else {
      console.log(`❌ Token não encontrado.`);
      return null;
    }
  }

  // Salva no cache
  redirectCache.set(cacheKey, { url: finalUrl, timestamp: Date.now() });
  return finalUrl;
}

// Handler principal para vídeos
async function handleVideo(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const finalUrl = await getFinalUrl(req.path);
    if (!finalUrl) {
      return res.status(404).send('Vídeo não encontrado');
    }

    // Faz a requisição do vídeo usando a URL final
    const videoResponse = await fetch(finalUrl, {
      headers: {
        'Range': req.headers['range'] || '',
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'http://cavalo.cc/'
      }
    });

    if (!videoResponse.ok && videoResponse.status !== 206) {
      console.log(`❌ Erro ao buscar vídeo: ${videoResponse.status}`);
      return res.status(videoResponse.status).send('Erro ao carregar vídeo');
    }

    // Copia headers relevantes
    const headersToCopy = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
    headersToCopy.forEach(header => {
      const value = videoResponse.headers.get(header);
      if (value) res.setHeader(header, value);
    });

    res.status(videoResponse.status);
    videoResponse.body.pipe(res);
    console.log(`✅ Vídeo enviado com sucesso`);

  } catch (error) {
    console.error('❌ Erro no proxy:', error);
    res.status(500).send('Erro interno');
  }
}

// Rotas
app.get('/series/*', handleVideo);
app.get('/movie/*', handleVideo);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mask: MASK,
    cacheSize: redirectCache.size,
    time: new Date().toISOString()
  });
});

// Limpar cache
app.get('/clear-cache', (req, res) => {
  redirectCache.clear();
  res.json({ message: 'Cache limpo' });
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy rodando na porta ${PORT}`);
  console.log(`🎬 Exemplo: ${MASK}/movie/Altairplay2024/4995NFTSybwa/100008.mp4`);
});