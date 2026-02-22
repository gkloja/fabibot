import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
const PORT = process.env.PORT || 3000;
const MASK = "https://fabibot-taupe.vercel.app";

app.use(cookieParser());

// Cache simples (opcional, pode ser desabilitado para teste)
const urlCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Limpeza periódica
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of urlCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) urlCache.delete(key);
  }
}, 60000);

// Função principal para obter a URL real do vídeo
async function getRealVideoUrl(originalPath) {
  const cacheKey = originalPath;
  if (urlCache.has(cacheKey)) {
    const cached = urlCache.get(cacheKey);
    console.log(`📦 Cache hit: ${cached.url}`);
    return cached.url;
  }

  const cavaloUrl = `http://cavalo.cc:80${originalPath}`;
  console.log(`🌐 Acessando: ${cavaloUrl}`);

  // 1. Faz uma requisição GET para capturar redirecionamento e obter o HTML
  const response = await fetch(cavaloUrl, {
    redirect: 'manual', // Não seguir redirect automaticamente
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Referer': 'http://cavalo.cc/'
    }
  });

  let finalUrl = null;

  // 2. Se houve redirecionamento (status 3xx)
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (location) {
      finalUrl = location.startsWith('http') ? location : `http://cavalo.cc:80${location}`;
      console.log(`↪️ Redirecionado para: ${finalUrl}`);
    }
  }

  // 3. Se não houve redirecionamento, precisamos extrair os parâmetros do HTML
  if (!finalUrl) {
    console.log(`🔍 Sem redirecionamento, lendo HTML...`);
    const html = await response.text();

    // Extrai token
    const tokenMatch = html.match(/token=([a-zA-Z0-9_.-]+)/);
    // Extrai IP (geralmente o último IP encontrado)
    const ipMatches = html.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g);
    // Extrai uc e pc
    const ucMatch = html.match(/uc=([^"&\s]+)/);
    const pcMatch = html.match(/pc=([^"&\s]+)/);

    if (tokenMatch && ipMatches && ipMatches.length > 0) {
      const token = tokenMatch[1];
      const ip = ipMatches[ipMatches.length - 1]; // último IP = servidor de vídeo
      const uc = ucMatch ? ucMatch[1] : 'QWx0YWlycGxheTIwMjQ=';
      const pc = pcMatch ? pcMatch[1] : 'NDk5NU5GVFN5Yndh';
      const arquivo = originalPath.split('/').pop();

      finalUrl = `http://${ip}/deliver/${arquivo}?token=${token}&uc=${uc}&pc=${pc}`;
      console.log(`🔧 URL construída: ${finalUrl}`);
    } else {
      console.log(`❌ Não foi possível extrair parâmetros do HTML.`);
      // Tenta usar a URL original como fallback
      finalUrl = cavaloUrl;
    }
  }

  if (finalUrl) {
    // Armazena no cache
    urlCache.set(cacheKey, { url: finalUrl, timestamp: Date.now() });
  }

  return finalUrl;
}

// Handler comum para /series/* e /movie/*
async function handleVideo(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const realUrl = await getRealVideoUrl(req.path);
    if (!realUrl) {
      return res.status(404).send('Vídeo não encontrado (falha na obtenção da URL)');
    }

    console.log(`📥 Buscando vídeo de: ${realUrl}`);

    // Faz a requisição do vídeo com suporte a Range
    const videoRes = await fetch(realUrl, {
      headers: {
        'Range': req.headers['range'] || '',
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'http://cavalo.cc/'
      }
    });

    if (!videoRes.ok && videoRes.status !== 206) {
      console.log(`❌ Resposta do vídeo: ${videoRes.status} ${videoRes.statusText}`);
      return res.status(videoRes.status).send('Erro ao carregar vídeo do servidor de origem');
    }

    // Copia headers importantes
    const headersToCopy = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
    headersToCopy.forEach(header => {
      const value = videoRes.headers.get(header);
      if (value) res.setHeader(header, value);
    });

    res.status(videoRes.status);
    videoRes.body.pipe(res);
    console.log(`✅ Vídeo entregue com sucesso`);

  } catch (error) {
    console.error('❌ Erro no proxy:', error);
    res.status(500).send('Erro interno no servidor proxy');
  }
}

// Rotas
app.get('/series/*', handleVideo);
app.get('/movie/*', handleVideo);

// Rota de teste para ver o HTML e depuração
app.get('/debug/*', async (req, res) => {
  const cavaloUrl = `http://cavalo.cc:80${req.path.replace('/debug', '')}`;
  try {
    const response = await fetch(cavaloUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'http://cavalo.cc/'
      }
    });
    const html = await response.text();
    res.type('html').send(`
      <h1>Debug - HTML retornado</h1>
      <pre style="background:#f4f4f4; padding:10px; overflow:auto; max-height:500px;">${html.replace(/</g, '&lt;')}</pre>
    `);
  } catch (e) {
    res.status(500).send('Erro no debug');
  }
});

// Health check e limpeza de cache
app.get('/health', (req, res) => {
  res.json({ status: 'ok', cacheSize: urlCache.size, mask: MASK });
});
app.get('/clear-cache', (req, res) => {
  urlCache.clear();
  res.json({ message: 'Cache limpo' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Proxy rodando na porta ${PORT}`);
  console.log(`🎬 Exemplo: ${MASK}/movie/Altairplay2024/4995NFTSybwa/100008.mp4`);
  console.log(`🔍 Debug: ${MASK}/debug/movie/Altairplay2024/4995NFTSybwa/100008.mp4\n`);
});