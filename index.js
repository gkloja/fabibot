import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;
const MASK = "https://fabibot-taupe.vercel.app";

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Cache simples
const redirectCache = new Map();

app.get(['/series/*', '/movie/*'], async (req, res) => {
  const originalPath = req.path;
  
  try {
    // Verifica cache
    if (redirectCache.has(originalPath)) {
      const cachedUrl = redirectCache.get(originalPath);
      console.log(`📦 Cache: ${cachedUrl}`);
      return await proxyVideo(cachedUrl, req, res);
    }

    // 1. Tenta acessar URL original (com .mp4) e capturar redirecionamento
    const cavaloUrl = `http://cavalo.cc:80${originalPath}`;
    console.log(`🌐 Verificando: ${cavaloUrl}`);

    const response = await fetch(cavaloUrl, {
      method: 'HEAD', // só precisamos dos headers
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'http://cavalo.cc/'
      }
    });

    let videoUrl = null;

    // Se houve redirecionamento
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        videoUrl = location.startsWith('http') ? location : `http://cavalo.cc:80${location}`;
        console.log(`↪️ Redirecionado para: ${videoUrl}`);
        
        // Salva no cache (válido por 5 minutos)
        redirectCache.set(originalPath, videoUrl);
        setTimeout(() => redirectCache.delete(originalPath), 5 * 60 * 1000);
      }
    }

    // Se não houve redirecionamento, tenta GET para ver se há HTML com token (fallback)
    if (!videoUrl) {
      console.log(`⚠️ Sem redirecionamento, tentando extrair do HTML...`);
      const htmlResponse = await fetch(cavaloUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'http://cavalo.cc/'
        }
      });
      const html = await htmlResponse.text();
      
      // Procura por padrões de URL com token no HTML
      const urlMatch = html.match(/https?:\/\/[^"'\s]+\.mp4\?token=[^"'\s]+/);
      if (urlMatch) {
        videoUrl = urlMatch[0];
        console.log(`🔍 URL encontrada no HTML: ${videoUrl}`);
        redirectCache.set(originalPath, videoUrl);
        setTimeout(() => redirectCache.delete(originalPath), 5 * 60 * 1000);
      }
    }

    if (!videoUrl) {
      return res.status(404).send('Não foi possível obter a URL do vídeo');
    }

    // 2. Faz o proxy do vídeo
    await proxyVideo(videoUrl, req, res);

  } catch (error) {
    console.error('❌ Erro:', error);
    res.status(500).send('Erro interno');
  }
});

async function proxyVideo(videoUrl, req, res) {
  const videoRes = await fetch(videoUrl, {
    headers: {
      'Range': req.headers['range'] || '',
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'http://cavalo.cc/'
    }
  });

  if (!videoRes.ok && videoRes.status !== 206) {
    return res.status(videoRes.status).send('Erro ao carregar vídeo');
  }

  // Headers importantes
  ['content-type', 'content-length', 'content-range', 'accept-ranges'].forEach(header => {
    const val = videoRes.headers.get(header);
    if (val) res.setHeader(header, val);
  });

  res.status(videoRes.status);
  videoRes.body.pipe(res);
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', cacheSize: redirectCache.size });
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy rodando na porta ${PORT}`);
});