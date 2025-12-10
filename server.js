import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();

app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(express.json({ limit: '100mb' }));
app.use(cookieParser());

const BASE = "http://br2.bronxyshost.com:4009";
const MASK = "https://fabibot.onrender.com";

// ===== AGENTES DE CONEXÃO =====
const AGENTS = {
  vlc: {
    name: 'VLC Player',
    headers: {
      'User-Agent': 'VLC/3.0.11 LibVLC/3.0.11',
      'Accept': '*/*',
      'Range': 'bytes=0-',
      'Connection': 'keep-alive',
      'Accept-Encoding': 'identity',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.videolan.org/',
      'Origin': 'https://www.videolan.org'
    }
  },
  lavf: {
    name: 'FFmpeg Lavf',
    headers: {
      'User-Agent': 'Lavf/58.76.100',
      'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
      'Range': 'bytes=0-',
      'Connection': 'keep-alive'
    }
  },
  quicktime: {
    name: 'Apple QuickTime',
    headers: {
      'User-Agent': 'QuickTime/7.7.4 (qtver=7.7.4;os=Windows NT 6.1)',
      'Accept': 'video/quicktime,video/mp4,video/x-m4v',
      'Range': 'bytes=0-'
    }
  },
  android: {
    name: 'Android Media Player',
    headers: {
      'User-Agent': 'stagefright/1.2 (Linux;Android 10)',
      'Accept': '*/*',
      'Range': 'bytes=0-'
    }
  },
  safari: {
    name: 'Safari Browser',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15',
      'Accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      'Accept-Encoding': 'identity',
      'Range': 'bytes=0-'
    }
  }
};

// ===== PROXY AVANÇADO PARA MÍDIA =====
app.get('/stream-proxy', async (req, res) => {
  try {
    let { url, agent = 'vlc' } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL requerida' });
    }
    
    console.log(`🎬 Stream Proxy: ${url.substring(0, 100)}...`);
    console.log(`🤖 Agente: ${agent}`);
    
    // Decodificar URL (pode vir com caracteres especiais)
    url = decodeURIComponent(url);
    
    // Verificar se é uma URL válida
    if (!url.startsWith('http')) {
      return res.status(400).json({ error: 'URL inválida' });
    }
    
    // Obter configuração do agente
    const agentConfig = AGENTS[agent] || AGENTS.vlc;
    const headers = {
      ...agentConfig.headers,
      'Referer': url,
      'Origin': new URL(url).origin,
      'Host': new URL(url).host
    };
    
    // Copiar Range header do cliente
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }
    
    // Configurar timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    // Fazer a requisição
    const response = await fetch(url, {
      method: 'GET',
      headers: headers,
      signal: controller.signal,
      redirect: 'follow'
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Copiar headers importantes
    const responseHeaders = [
      'content-type', 'content-length', 'content-range',
      'accept-ranges', 'cache-control', 'last-modified',
      'etag'
    ];
    
    responseHeaders.forEach(header => {
      const value = response.headers.get(header);
      if (value) res.setHeader(header, value);
    });
    
    // Headers CORS para permitir streaming
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Cache para streaming
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    
    // Stream dos dados
    response.body.pipe(res);
    
    console.log(`✅ Stream enviado: ${response.status}`);
    
  } catch (error) {
    console.error(`❌ Erro no stream proxy:`, error.message);
    
    // Tentar com outro agente
    if (req.query.agent !== 'safari') {
      console.log('🔄 Tentando com agente Safari...');
      const newUrl = `/stream-proxy?url=${encodeURIComponent(req.query.url)}&agent=safari`;
      return res.redirect(newUrl);
    }
    
    res.status(500).json({ 
      error: 'Erro ao carregar stream',
      message: error.message,
      url: req.query.url
    });
  }
});

// ===== PROXY PARA HLS/M3U8 =====
app.get('/hls-proxy', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL requerida' });
    }
    
    console.log(`📡 HLS Proxy: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': AGENTS.vlc.headers['User-Agent'],
        'Accept': '*/*',
        'Referer': new URL(url).origin
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    let m3u8Content = await response.text();
    
    // Processar playlist HLS
    const lines = m3u8Content.split('\n');
    const processedLines = lines.map(line => {
      // Substituir URLs de segmentos .ts
      if (line && !line.startsWith('#') && line.trim() !== '') {
        if (line.startsWith('http')) {
          // URL absoluta
          return `${MASK}/stream-proxy?url=${encodeURIComponent(line)}&agent=vlc`;
        } else {
          // URL relativa - construir URL completa
          const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
          const fullUrl = new URL(line, baseUrl).href;
          return `${MASK}/stream-proxy?url=${encodeURIComponent(fullUrl)}&agent=vlc`;
        }
      }
      return line;
    });
    
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(processedLines.join('\n'));
    
  } catch (error) {
    console.error(`❌ Erro HLS proxy:`, error.message);
    res.status(500).send('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-ENDLIST\n');
  }
});

// ===== ROTA PRINCIPAL STREAMPRO =====
app.get("/streampro", async (req, res) => {
  try {
    console.log(`🎬 Carregando StreamPro...`);
    
    const headers = { 
      ...req.headers,
      "host": new URL(BASE).host,
      "origin": BASE,
      "referer": BASE + "/",
      "x-forwarded-for": req.ip
    };
    
    delete headers["content-length"];
    
    const response = await fetch(BASE + "/streampro", {
      method: "GET",
      headers: headers,
      redirect: "manual"
    });
    
    // Redirecionamentos
    const location = response.headers.get("location");
    if (location) {
      const redirectUrl = location.startsWith(BASE) 
        ? location.replace(BASE, MASK)
        : MASK + location;
      return res.redirect(redirectUrl);
    }
    
    // Cookies
    const cookies = response.headers.raw()["set-cookie"];
    if (cookies) {
      cookies.forEach(cookie => {
        res.append("Set-Cookie", cookie);
      });
    }
    
    // Processar HTML
    let html = await response.text();
    
    // Adicionar meta SEO
    html = html.replace('</head>', 
      '<meta name="google-site-verification" content="EQt18dIllZg0WnhSV58os4awAy0jsyxrLL3Yek09dYo" />\n</head>');
    
    // Substituir BASE por MASK
    html = html.replace(new RegExp(BASE, 'g'), MASK);
    
    // INJEÇÃO CRÍTICA: Substituir o JavaScript do player
    // Encontrar e modificar a função loadStream
    if (html.includes('function loadStream()')) {
      // Substituir a função original
      const newLoadStream = `
      // ===== FUNÇÃO MODIFICADA PELA MÁSCARA =====
      function loadStream() {
        const urlInput = document.getElementById('streamUrl');
        let url = urlInput.value.trim();
        
        if (!url) {
          showNotification('Por favor, insira uma URL válida.', 'error');
          return;
        }
        
        console.log('🎬 URL original:', url);
        
        // Verificar se já é um URL proxy
        if (!url.includes('${MASK}/stream-proxy')) {
          // Codificar URL para proxy
          const proxyUrl = '${MASK}/stream-proxy?url=' + encodeURIComponent(url) + '&agent=' + (currentAgent || 'vlc');
          console.log('🔄 Usando proxy:', proxyUrl);
          url = proxyUrl;
        }
        
        currentStreamUrl = url;
        showLoading('Conectando ao stream...');
        
        // Detectar tipo
        const isHLS = url.includes('.m3u8') || url.includes('.m3u');
        
        // Parar player atual
        if (player) {
          player.pause();
          player.reset();
        }
        
        if (isHLS && window.Hls && Hls.isSupported()) {
          // Usar proxy HLS para playlists
          const playlistUrl = url.includes('${MASK}/stream-proxy') 
            ? url.replace('stream-proxy', 'hls-proxy')
            : '${MASK}/hls-proxy?url=' + encodeURIComponent(url.split('?')[0]);
            
          console.log('📡 HLS via proxy:', playlistUrl);
          
          const hls = new Hls({
            xhrSetup: function(xhr) {
              xhr.setRequestHeader('User-Agent', 'VLC/3.0.11 LibVLC/3.0.11');
            },
            enableWorker: true,
            lowLatencyMode: true
          });
          
          hls.loadSource(playlistUrl);
          hls.attachMedia(player.el().querySelector('video'));
          
          hls.on(Hls.Events.MANIFEST_PARSED, function() {
            hideLoading();
            player.play();
            showNotification('Stream HLS carregado via proxy!', 'success');
            updateStatus('Conectado (HLS Proxy)', 'success');
          });
          
          hls.on(Hls.Events.ERROR, function(event, data) {
            console.error('HLS Error:', data);
            if (data.fatal) {
              switch(data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  showNotification('Erro de rede no stream HLS', 'error');
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default:
                  hls.destroy();
                  showNotification('Erro fatal no HLS', 'error');
                  break;
              }
            }
          });
          
        } else {
          // Para MP4 e outros formatos
          player.src({
            src: url,
            type: getVideoType(url),
            withCredentials: false
          });
          
          player.ready(function() {
            hideLoading();
            player.play();
            showNotification('Stream carregado via proxy!', 'success');
            updateStatus('Conectado (Proxy)', 'success');
          });
        }
        
        player.on('error', function() {
          console.error('Player error:', player.error());
          showNotification('Erro no player. Tentando outro agente...', 'error');
          
          // Tentar com agente diferente
          if (currentAgent === 'vlc') {
            setTimeout(() => {
              const newAgent = currentAgent === 'vlc' ? 'lavf' : 'vlc';
              setAgent(newAgent);
              loadStream();
            }, 2000);
          }
        });
      }
      
      // Sobrescrever função original
      `;
      
      // Substituir a função no HTML
      html = html.replace(/function loadStream\(\)[\s\S]*?}(?=\s*(?:function|\n\s*\n|$))/, newLoadStream);
    }
    
    // Adicionar script de debug
    html = html.replace('</body>', `
    <script>
    // ===== DEBUG DO PLAYER =====
    console.log('🎬 FabiBot Streaming Proxy Ativo');
    console.log('🌐 Máscara: ${MASK}');
    console.log('🔗 Backend: ${BASE}');
    
    // Monitorar erros do player
    document.addEventListener('DOMContentLoaded', function() {
      // Testar proxy
      const testUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
      const proxyTestUrl = '${MASK}/stream-proxy?url=' + encodeURIComponent(testUrl) + '&agent=vlc';
      
      fetch(proxyTestUrl, { method: 'HEAD' })
        .then(r => console.log('✅ Proxy test:', r.ok ? 'OK' : 'FAIL', r.status))
        .catch(e => console.error('❌ Proxy test error:', e));
      
      // Sobrescrever função setAgent para log
      const originalSetAgent = window.setAgent;
      window.setAgent = function(agentName) {
        console.log('🤖 Mudando agente para:', agentName);
        if (originalSetAgent) originalSetAgent(agentName);
      };
    });
    
    // Interceptar cliques no botão play
    document.addEventListener('click', function(e) {
      if (e.target.id === 'playButton' || e.target.closest('#playButton')) {
        console.log('🎯 Play button clicked');
      }
    });
    </script>
    </body>`);
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
    
  } catch (error) {
    console.error('Erro StreamPro:', error);
    res.status(500).send(`
      <html>
        <head>
          <title>Erro StreamPro</title>
          <meta name="google-site-verification" content="EQt18dIllZg0WnhSV58os4awAy0jsyxrLL3Yek09dYo" />
        </head>
        <body>
          <h1>⚠️ Erro no StreamPro</h1>
          <p>${error.message}</p>
          <button onclick="location.reload()">🔄 Recarregar</button>
          <button onclick="location.href='/'">🏠 Página Inicial</button>
        </body>
      </html>
    `);
  }
});

// ===== APIS =====
app.post("/api/streampro/reproducao/registrar", async (req, res) => {
  try {
    const backendResponse = await fetch(BASE + "/api/streampro/reproducao/registrar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": req.headers.cookie || ""
      },
      body: JSON.stringify(req.body)
    });
    
    const data = await backendResponse.json();
    res.json(data);
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post("/api/streampro/testar-url", async (req, res) => {
  try {
    const { url, agente = 'vlc' } = req.body;
    
    // Testar via proxy primeiro
    const testUrl = `${MASK}/stream-proxy?url=${encodeURIComponent(url)}&agent=${agente}`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(testUrl, {
      method: 'HEAD',
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    res.json({
      success: true,
      valido: response.ok,
      status: response.status,
      mensagem: response.ok ? '✅ URL acessível via proxy' : '⚠️ Problema no proxy',
      urlTestada: testUrl
    });
    
  } catch (error) {
    res.json({
      success: false,
      valido: false,
      mensagem: `Erro: ${error.message}`
    });
  }
});

// ===== ROTAS EXISTENTES =====
app.post("/alterar-foto", async (req, res) => {
  try {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    
    if (req.body?.fotoUrl) {
      const matches = req.body.fotoUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (matches) {
        const buffer = Buffer.from(matches[2], 'base64');
        form.append('fotoFile', buffer, {
          filename: `foto-${Date.now()}.${matches[1].split('/')[1] || 'jpg'}`,
          contentType: matches[1]
        });
      }
    }
    
    const backendResponse = await fetch(BASE + "/alterar-foto", {
      method: "POST",
      headers: {
        "Cookie": req.headers.cookie || "",
        ...form.getHeaders()
      },
      body: form
    });
    
    const data = await backendResponse.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
});

// ===== PROXY GERAL =====
app.use(async (req, res) => {
  try {
    if (['/streampro', '/stream-proxy', '/hls-proxy', 
         '/api/streampro/reproducao/registrar', '/api/streampro/testar-url',
         '/alterar-foto', '/play', '/sobre', '/robots.txt', '/sitemap.xml'].includes(req.path)) {
      return res.status(404).send('Not found');
    }
    
    const targetUrl = BASE + req.url;
    
    const headers = { 
      ...req.headers,
      "host": new URL(BASE).host,
      "origin": BASE,
      "referer": BASE + "/"
    };
    
    delete headers["content-length"];
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      redirect: "manual",
    });
    
    const location = response.headers.get("location");
    if (location) {
      const redirectUrl = location.startsWith(BASE) 
        ? location.replace(BASE, MASK)
        : MASK + location;
      return res.redirect(redirectUrl);
    }
    
    const cookies = response.headers.raw()["set-cookie"];
    if (cookies) {
      cookies.forEach(cookie => {
        res.append("Set-Cookie", cookie);
      });
    }
    
    const type = response.headers.get("content-type");
    if (type) res.setHeader("Content-Type", type);
    
    if (type && type.includes("text/html")) {
      let html = await response.text();
      if (html.includes('</head>')) {
        html = html.replace('</head>', 
          '<meta name="google-site-verification" content="EQt18dIllZg0WnhSV58os4awAy0jsyxrLL3Yek09dYo" />\n</head>');
      }
      html = html.replace(new RegExp(BASE, 'g'), MASK);
      res.send(html);
    } else {
      res.send(await response.buffer());
    }
    
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).send("Erro interno");
  }
});

// ===== INICIALIZAÇÃO =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  🚀 FabiBot Proxy Streaming
  🔗 Backend: ${BASE}
  🌐 Máscara: ${MASK}
  🎬 Streaming: ${MASK}/streampro
  📡 Proxy VLC: ${MASK}/stream-proxy
  📡 Proxy HLS: ${MASK}/hls-proxy
  ✅ User-Agent: VLC/3.0.11
  🕐 ${new Date().toLocaleString()}
  `);
});