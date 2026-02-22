import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
const PORT = process.env.PORT || 3000;
const MASK = "https://fabibot-taupe.vercel.app";

app.use(cookieParser());

// ===== CONFIGURAÇÕES =====
const CONFIG = {
  maxFallbacks: 50,              // Máximo de fallbacks para guardar
  cacheExpiry: 3600000,          // 1 hora em ms
  timeout: 10000,                 // Timeout para requisições
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

// ===== BANCO DE DADOS DE FALLBACKS =====
// Estrutura: { ip, token, uc, pc, qualidade, vezesUsado, ultimoUso, falhas, mediaResposta }
let fallbacks = [];

// Fallbacks iniciais (conhecidos)
const FALLBACKS_INICIAIS = [
  // IP 28 - token antigo
  { ip: "209.131.121.28", token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjAwMDEiLCJleHAiOjE3NzE3NTI1MjF9.eyJ1YyI6IlFXeDBZV2x5Y0d4aGVUSXdNalE9IiwicGMiOiJORGs1TlU1R1ZGTjVZbmRoIiwic3QiOiIzNjEyNjcubXA0IiwiaXAiOiIxODcuMjcuMTQ0LjE0OSJ9.j9dsiMIQkCEEsOAoRcmmzNFnWq8wPLMFmHncd3Z4n10", uc: "QWx0YWlycGxheTIwMjQ=", pc: "NDk5NU5GVFN5Yndh" },
  // IP 26 - token intermediário
  { ip: "209.131.121.26", token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjAwMDEiLCJleHAiOjE3NzE3NTQwNTZ9.eyJ1YyI6IlFXeDBZV2x5Y0d4aGVUSXdNalE9IiwicGMiOiJORGs1TlU1R1ZGTjVZbmRoIiwic3QiOiIzNjEyNjcubXA0IiwiaXAiOiIxODcuMjcuMTQ0LjE0OSJ9.vkgTUCdFSe4jwtR7nm4-JJEYnOGrBSzP3LROTHo5v3Q", uc: "QWx0YWlycGxheTIwMjQ=", pc: "NDk5NU5GVFN5Yndh" },
  // IP 249 - token atual
  { ip: "130.250.189.249", token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjAwMDEiLCJleHAiOjE3NzE3NTUzODB9.eyJ1YyI6IlFXeDBZV2x5Y0d4aGVUSXdNalE9IiwicGMiOiJORGs1TlU1R1ZGTjVZbmRoIiwic3QiOiIzNjEyNjcubXA0IiwiaXAiOiIxODcuMjcuMTU1Ljk2In0.CKdqjiWdMhwgmfVcHmbA5C8TU2QVgVsl_jDv2svEIuw", uc: "QWx0YWlycGxheTIwMjQ=", pc: "NDk5NU5GVFN5Yndh" },
  // IP 26 - token NOVO (mais recente)
  { ip: "209.131.121.26", token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjAwMDEiLCJleHAiOjE3NzE3NTU3ODN9.eyJ1YyI6IlFXeDBZV2x5Y0d4aGVUSXdNalE9IiwicGMiOiJORGs1TlU1R1ZGTjVZbmRoIiwic3QiOiIzNjEyNjcubXA0IiwiaXAiOiIxODcuMjcuMTU1Ljk2In0.-wK9FyekiBvfsJ2AnzJgisa3pTzuC5l8J48_oZZ9e0w", uc: "QWx0YWlycGxheTIwMjQ=", pc: "NDk5NU5GVFN5Yndh" }
];

// Inicializar fallbacks com metadados
FALLBACKS_INICIAIS.forEach(fb => {
  fallbacks.push({
    ...fb,
    vezesUsado: 0,
    falhas: 0,
    ultimoUso: 0,
    mediaResposta: 0,
    ultimoTeste: 0
  });
});

// Cookie jar para manter sessão
let cookieJar = {};

// ===== UTILITÁRIOS =====
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ===== FUNÇÃO PARA FAZER REQUISIÇÕES COM TIMEOUT =====
async function fetchWithTimeout(url, options = {}, timeout = CONFIG.timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ===== FUNÇÃO PARA FAZER REQUISIÇÕES COM COOKIES =====
async function fetchWithCookies(url, options = {}) {
  const headers = {
    "User-Agent": CONFIG.userAgent,
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    ...options.headers
  };
  
  const domain = new URL(url).hostname;
  if (cookieJar[domain]) {
    headers["Cookie"] = cookieJar[domain];
  }
  
  try {
    const response = await fetchWithTimeout(url, { ...options, headers });
    
    const setCookie = response.headers.raw()["set-cookie"];
    if (setCookie) {
      cookieJar[domain] = setCookie.map(c => c.split(';')[0]).join('; ');
    }
    
    return response;
  } catch (error) {
    console.error(`❌ Fetch error for ${url}:`, error.message);
    throw error;
  }
}

// ===== ESTRATÉGIA 1: URL Original do cavalo.cc =====
async function estrategiaOriginal(path) {
  const url = `http://cavalo.cc:80${path}`;
  console.log(`🎯 [E1] Tentando original: ${url}`);
  
  try {
    const response = await fetchWithCookies(url, {
      headers: {
        "Host": "cavalo.cc",
        "Accept": "video/mp4,*/*",
        "Range": "bytes=0-"
      },
      redirect: "follow"
    });
    
    if (response.ok || response.status === 206) {
      console.log(`✅ [E1] Sucesso! Status: ${response.status}`);
      return { response, url };
    }
    console.log(`❌ [E1] Falhou: ${response.status}`);
    return null;
  } catch (error) {
    console.log(`❌ [E1] Erro: ${error.message}`);
    return null;
  }
}

// ===== ESTRATÉGIA 2: Renovar Token via Página HTML =====
async function estrategiaRenovar(path) {
  if (!path.includes('.mp4')) return null;
  
  const pageUrl = `http://cavalo.cc:80${path.replace('.mp4', '')}`;
  console.log(`🔄 [E2] Acessando página: ${pageUrl}`);
  
  try {
    // Primeiro, acessar a página HTML
    const pageResponse = await fetchWithCookies(pageUrl, {
      headers: {
        "Host": "cavalo.cc",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Referer": "http://cavalo.cc/"
      }
    });

    const html = await pageResponse.text();
    
    // Extrair token (várias formas possíveis)
    const tokenMatch = html.match(/token=([a-zA-Z0-9_.-]+)/) || 
                       html.match(/["']token["']\s*:\s*["']([^"']+)["']/);
    
    if (!tokenMatch) {
      console.log("❌ [E2] Token não encontrado");
      return null;
    }
    
    const token = tokenMatch[1];
    
    // Extrair IP (procurar por IPs no HTML)
    const ipMatch = html.match(/(\d+\.\d+\.\d+\.\d+)/g);
    let ip = ipMatch ? ipMatch[ipMatch.length - 1] : null;
    
    // Se não achou IP, tentar encontrar URL completa
    const urlMatch = html.match(/http:\/\/(\d+\.\d+\.\d+\.\d+)\/deliver\/[^"'\s]+/);
    if (urlMatch && urlMatch[1]) {
      ip = urlMatch[1];
    }
    
    // Extrair UC e PC
    const ucMatch = html.match(/uc=([^"&\s]+)/);
    const pcMatch = html.match(/pc=([^"&\s]+)/);
    
    const uc = ucMatch ? ucMatch[1] : "QWx0YWlycGxheTIwMjQ=";
    const pc = pcMatch ? pcMatch[1] : "NDk5NU5GVFN5Yndh";
    
    if (!ip) {
      console.log("❌ [E2] IP não encontrado");
      return null;
    }
    
    const arquivo = path.split('/').pop();
    const videoUrl = `http://${ip}/deliver/${arquivo}?token=${token}&uc=${uc}&pc=${pc}`;
    
    console.log(`✅ [E2] URL gerada: ${videoUrl}`);
    
    // Testar a URL gerada
    const response = await fetchWithCookies(videoUrl, {
      headers: {
        "Host": ip,
        "Accept": "video/mp4,*/*",
        "Range": "bytes=0-"
      }
    });
    
    if (response.ok || response.status === 206) {
      // Salvar no banco de fallbacks
      salvarFallback({ ip, token, uc, pc });
      return { response, url: videoUrl };
    }
    
    return null;
    
  } catch (error) {
    console.log(`❌ [E2] Erro: ${error.message}`);
    return null;
  }
}

// ===== ESTRATÉGIA 3: Fallbacks Conhecidos =====
async function estrategiaFallbacks(path) {
  const arquivo = path.split('/').pop();
  
  // Ordenar fallbacks por pontuação (mais usado e mais recente)
  const fallbacksPontuados = fallbacks.map(fb => {
    const pontuacao = (fb.vezesUsado * 10) - (fb.falhas * 5) + 
                      (Date.now() - fb.ultimoUso < 3600000 ? 20 : 0);
    return { ...fb, pontuacao };
  }).sort((a, b) => b.pontuacao - a.pontuacao);
  
  console.log(`🎯 [E3] Testando ${fallbacksPontuados.length} fallbacks...`);
  
  for (const fb of fallbacksPontuados) {
    const url = `http://${fb.ip}/deliver/${arquivo}?token=${fb.token}&uc=${fb.uc}&pc=${fb.pc}`;
    console.log(`  ↳ Testando ${fb.ip} (score: ${fb.pontuacao})`);
    
    try {
      const response = await fetchWithCookies(url, {
        headers: {
          "Host": fb.ip,
          "Accept": "video/mp4,*/*",
          "Range": "bytes=0-",
          "Referer": "http://cavalo.cc/"
        },
        timeout: 5000 // Timeout menor para fallbacks
      });
      
      if (response.ok || response.status === 206) {
        console.log(`✅ [E3] Funcionou: ${fb.ip}`);
        fb.vezesUsado++;
        fb.ultimoUso = Date.now();
        fb.mediaResposta = (fb.mediaResposta + response.status) / 2;
        return { response, url };
      } else {
        fb.falhas++;
      }
    } catch (e) {
      fb.falhas++;
    }
    
    await sleep(100); // Pequena pausa entre tentativas
  }
  
  return null;
}

// ===== ESTRATÉGIA 4: Tentativa Direta com IPs Conhecidos =====
async function estrategiaIPsDiretos(path) {
  const arquivo = path.split('/').pop();
  
  // Lista de IPs que já vimos
  const ipsConhecidos = [...new Set(fallbacks.map(fb => fb.ip))];
  
  console.log(`🎯 [E4] Testando ${ipsConhecidos.length} IPs diretos...`);
  
  for (const ip of ipsConhecidos) {
    // Tentar sem token (às vezes funciona em .ts)
    const url = `http://${ip}/deliver/${arquivo}`;
    console.log(`  ↳ Testando IP direto: ${ip}`);
    
    try {
      const response = await fetchWithCookies(url, {
        headers: {
          "Host": ip,
          "Accept": "video/mp4,*/*",
          "Range": "bytes=0-"
        },
        timeout: 3000
      });
      
      if (response.ok || response.status === 206) {
        console.log(`✅ [E4] Funcionou IP direto: ${ip}`);
        return { response, url };
      }
    } catch (e) {
      // Ignorar
    }
  }
  
  return null;
}

// ===== SALVAR FALLBACK =====
function salvarFallback({ ip, token, uc, pc }) {
  // Verificar se já existe
  const existe = fallbacks.some(f => 
    f.ip === ip && f.token === token && f.uc === uc && f.pc === pc
  );
  
  if (existe) {
    // Atualizar contador
    const fb = fallbacks.find(f => f.ip === ip && f.token === token);
    if (fb) {
      fb.vezesUsado++;
      fb.ultimoUso = Date.now();
    }
    return;
  }
  
  // Adicionar novo fallback
  fallbacks.push({
    ip, token, uc, pc,
    vezesUsado: 1,
    falhas: 0,
    ultimoUso: Date.now(),
    mediaResposta: 0
  });
  
  // Limitar número de fallbacks
  if (fallbacks.length > CONFIG.maxFallbacks) {
    // Remover o menos usado
    fallbacks.sort((a, b) => a.vezesUsado - b.vezesUsado);
    fallbacks.shift();
  }
  
  console.log(`💾 Novo fallback salvo: ${ip} (total: ${fallbacks.length})`);
}

// ===== PROXY PRINCIPAL =====
app.get("/*", async (req, res) => {
  console.log("\n" + "=".repeat(70));
  console.log(`🔍 REQUISIÇÃO: ${req.method} ${req.path}`);
  console.log(`📌 Headers:`, req.headers);
  
  // Ignorar rotas especiais
  if (req.path === '/health' || req.path === '/favicon.ico' || req.path === '/fallbacks') {
    return res.status(404).send('Rota não encontrada');
  }
  
  // OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
    return res.status(204).end();
  }

  const startTime = Date.now();
  let result = null;
  const estrategias = [
    { nome: "Original", fn: () => estrategiaOriginal(req.path) },
    { nome: "Renovar Token", fn: () => estrategiaRenovar(req.path) },
    { nome: "Fallbacks", fn: () => estrategiaFallbacks(req.path) },
    { nome: "IPs Diretos", fn: () => estrategiaIPsDiretos(req.path) }
  ];

  // Executar estratégias em ordem até uma funcionar
  for (const estrategia of estrategias) {
    console.log(`\n📋 Executando estratégia: ${estrategia.nome}`);
    result = await estrategia.fn();
    if (result) break;
  }

  // Se alguma funcionou
  if (result && result.response) {
    const responseTime = Date.now() - startTime;
    console.log(`\n✅ SUCESSO após ${responseTime}ms`);
    
    // Headers importantes
    const headersToCopy = ["content-type", "content-length", "content-range", "accept-ranges"];
    headersToCopy.forEach(header => {
      const value = result.response.headers.get(header);
      if (value) res.setHeader(header, value);
    });

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range");

    res.status(result.response.status);
    result.response.body.pipe(res);
    
    console.log(`📤 Enviando vídeo...`);
    return;
  }
  
  // Todas falharam
  console.log(`\n❌ TODAS ESTRATÉGIAS FALHARAM após ${Date.now() - startTime}ms`);
  
  res.status(404).send(`
    <html>
      <head><title>Vídeo indisponível</title></head>
      <body style="font-family: Arial; text-align: center; padding: 50px; background: #0a0a1a; color: white;">
        <h1 style="color: #00ffb3;">🎬 Vídeo indisponível</h1>
        <p>Não foi possível carregar o vídeo após várias tentativas.</p>
        <p><small>Path: ${req.path}</small></p>
        <p><small>Fallbacks testados: ${fallbacks.length}</small></p>
        <p><a href="${req.path}" style="color: #00ffb3;">Tentar novamente</a></p>
      </body>
    </html>
  `);
});

// ===== ROTA PARA VER FALLBACKS =====
app.get("/fallbacks", (req, res) => {
  const stats = {
    total: fallbacks.length,
    ipsUnicos: [...new Set(fallbacks.map(f => f.ip))].length,
    tokensUnicos: [...new Set(fallbacks.map(f => f.token))].length,
    fallbacks: fallbacks.map(f => ({
      ip: f.ip,
      token: f.token ? f.token.substring(0, 15) + "..." : null,
      uc: f.uc,
      pc: f.pc,
      vezesUsado: f.vezesUsado,
      falhas: f.falhas,
      ultimoUso: new Date(f.ultimoUso).toISOString()
    })).sort((a, b) => b.vezesUsado - a.vezesUsado)
  };
  
  res.json(stats);
});

// ===== HEALTH CHECK =====
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    mask: MASK,
    fallbacks: fallbacks.length,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    time: new Date().toISOString()
  });
});

// ===== INICIAR SERVIDOR =====
app.listen(PORT, () => {
  console.log("\n" + "🚀".repeat(35));
  console.log(`🚀 PROXY PROFISSIONAL RODANDO NA PORTA ${PORT}`);
  console.log(`🎭 MASK: ${MASK}`);
  console.log(`💾 Fallbacks iniciais: ${fallbacks.length}`);
  console.log(`🔄 Estratégias: Original → Renovar → Fallbacks → IPs Diretos`);
  console.log(`✅ Exemplo: ${MASK}/series/Altairplay2024/4995NFTSybwa/361267.mp4`);
  console.log("🚀".repeat(35) + "\n");
  
  // Mostrar fallbacks iniciais
  console.log("📋 Fallbacks carregados:");
  fallbacks.forEach((fb, i) => {
    console.log(`  ${i+1}. ${fb.ip} - ${fb.token.substring(0,15)}...`);
  });
});