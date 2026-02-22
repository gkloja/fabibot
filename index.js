import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
const PORT = process.env.PORT || 3000;
const MASK = "https://fabibot-taupe.vercel.app";

app.use(cookieParser());

// ===== BANCO DE DADOS DE FALLBACKS =====
// Formato: { ip, token, uc, pc, vezesUsado, ultimoUso }
let fallbacks = [
  // Série 361267 - IP 28 (primeiro)
  {
    ip: "209.131.121.28",
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjAwMDEiLCJleHAiOjE3NzE3NTI1MjF9.eyJ1YyI6IlFXeDBZV2x5Y0d4aGVUSXdNalE9IiwicGMiOiJORGs1TlU1R1ZGTjVZbmRoIiwic3QiOiIzNjEyNjcubXA0IiwiaXAiOiIxODcuMjcuMTQ0LjE0OSJ9.j9dsiMIQkCEEsOAoRcmmzNFnWq8wPLMFmHncd3Z4n10",
    uc: "QWx0YWlycGxheTIwMjQ=",
    pc: "NDk5NU5GVFN5Yndh",
    vezesUsado: 1,
    ultimoUso: Date.now()
  },
  // Série 361267 - IP 26
  {
    ip: "209.131.121.26",
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjAwMDEiLCJleHAiOjE3NzE3NTQwNTZ9.eyJ1YyI6IlFXeDBZV2x5Y0d4aGVUSXdNalE9IiwicGMiOiJORGs1TlU1R1ZGTjVZbmRoIiwic3QiOiIzNjEyNjcubXA0IiwiaXAiOiIxODcuMjcuMTQ0LjE0OSJ9.vkgTUCdFSe4jwtR7nm4-JJEYnOGrBSzP3LROTHo5v3Q",
    uc: "QWx0YWlycGxheTIwMjQ=",
    pc: "NDk5NU5GVFN5Yndh",
    vezesUsado: 1,
    ultimoUso: Date.now()
  },
  // Série 361267 - IP 249 (ATUAL)
  {
    ip: "130.250.189.249",
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjAwMDEiLCJleHAiOjE3NzE3NTUzODB9.eyJ1YyI6IlFXeDBZV2x5Y0d4aGVUSXdNalE9IiwicGMiOiJORGs1TlU1R1ZGTjVZbmRoIiwic3QiOiIzNjEyNjcubXA0IiwiaXAiOiIxODcuMjcuMTU1Ljk2In0.CKdqjiWdMhwgmfVcHmbA5C8TU2QVgVsl_jDv2svEIuw",
    uc: "QWx0YWlycGxheTIwMjQ=",
    pc: "NDk5NU5GVFN5Yndh",
    vezesUsado: 1,
    ultimoUso: Date.now()
  }
];

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
    const ip = ipMatch ? ipMatch[ipMatch.length - 1] : null;
    
    // Parâmetros adicionais
    const ucMatch = html.match(/uc=([^"&\s]+)/);
    const pcMatch = html.match(/pc=([^"&\s]+)/);
    const uc = ucMatch ? ucMatch[1] : null;
    const pc = pcMatch ? pcMatch[1] : null;
    
    // Salvar no banco de fallbacks se encontrou tudo
    if (ip && token && uc && pc) {
      // Verificar se já existe
      const existe = fallbacks.some(f => f.ip === ip && f.token === token);
      if (!existe) {
        fallbacks.push({
          ip, token, uc, pc,
          vezesUsado: 1,
          ultimoUso: Date.now()
        });
        console.log(`💾 Novo fallback salvo: ${ip} - ${token.substring(0,20)}...`);
      }
    }
    
    const arquivo = caminhoOriginal.split('/').pop();
    return `http://${ip}/deliver/${arquivo}?token=${token}&uc=${uc}&pc=${pc}`;
    
  } catch (error) {
    console.error("❌ Erro na renovação:", error);
    return null;
  }
}

// ===== FUNÇÃO PARA TENTAR TODOS OS FALLBACKS =====
async function tentarTodosFallbacks(caminhoOriginal) {
  const arquivo = caminhoOriginal.split('/').pop();
  
  // Ordenar por mais recente primeiro
  const fallbacksOrdenados = [...fallbacks].sort((a, b) => b.ultimoUso - a.ultimoUso);
  
  for (const fb of fallbacksOrdenados) {
    const url = `http://${fb.ip}/deliver/${arquivo}?token=${fb.token}&uc=${fb.uc}&pc=${fb.pc}`;
    console.log(`🔄 Tentando fallback: ${fb.ip} (usado ${fb.vezesUsado}x)`);
    
    try {
      const response = await fetchWithCookies(url, {
        headers: {
          "Host": fb.ip,
          "Accept": "video/mp4,*/*",
          "Range": "bytes=0-", // Teste rápido
          "Referer": "http://cavalo.cc/"
        }
      });
      
      if (response.ok || response.status === 206) {
        console.log(`✅ Fallback funcionou: ${fb.ip}`);
        fb.vezesUsado++;
        fb.ultimoUso = Date.now();
        return { response, url };
      }
    } catch (e) {
      console.log(`❌ Fallback falhou: ${fb.ip}`);
    }
  }
  
  return null;
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
    let result = null;
    
    // Tentativa 1: URL original
    console.log(`🎯 Tentativa 1: Original`);
    const urlOriginal = `http://cavalo.cc:80${req.path}`;
    let response = await fetchWithCookies(urlOriginal, {
      headers: {
        "Host": "cavalo.cc",
        "Accept": "video/mp4,*/*",
        "Range": req.headers["range"] || "",
        "Referer": "http://cavalo.cc/"
      }
    });

    if (response.ok || response.status === 206) {
      result = { response };
    }
    
    // Tentativa 2: Renovar token
    if (!result && req.path.includes('.mp4')) {
      console.log(`🎯 Tentativa 2: Renovar token`);
      const novaUrl = await renovarToken(req.path);
      if (novaUrl) {
        response = await fetchWithCookies(novaUrl, {
          headers: {
            "Host": new URL(novaUrl).host,
            "Accept": "video/mp4,*/*",
            "Range": req.headers["range"] || ""
          }
        });
        if (response.ok || response.status === 206) {
          result = { response };
        }
      }
    }
    
    // Tentativa 3: Todos os fallbacks salvos
    if (!result) {
      console.log(`🎯 Tentativa 3: Buscando nos fallbacks (${fallbacks.length} salvos)`);
      const fallbackResult = await tentarTodosFallbacks(req.path);
      if (fallbackResult) {
        result = fallbackResult;
      }
    }

    // Se funcionou, envia o vídeo
    if (result && result.response) {
      const headersToCopy = ["content-type", "content-length", "content-range", "accept-ranges"];
      headersToCopy.forEach(header => {
        const value = result.response.headers.get(header);
        if (value) res.setHeader(header, value);
      });

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Range");
      res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range");

      res.status(result.response.status);
      result.response.body.pipe(res);
      console.log(`✅ Vídeo sendo enviado!`);
      return;
    }
    
    // Se todas falharam
    res.status(404).send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>🎬 Vídeo indisponível</h1>
          <p>Tentamos ${fallbacks.length} fallbacks diferentes.</p>
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

// ===== ROTA PARA VER FALLBACKS SALVOS =====
app.get("/fallbacks", (req, res) => {
  res.json({
    total: fallbacks.length,
    fallbacks: fallbacks.map(f => ({
      ip: f.ip,
      token: f.token.substring(0, 20) + "...",
      uc: f.uc,
      pc: f.pc,
      vezesUsado: f.vezesUsado,
      ultimoUso: new Date(f.ultimoUso).toISOString()
    }))
  });
});

// ===== HEALTH CHECK =====
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    mask: MASK, 
    fallbacks: fallbacks.length,
    time: new Date().toISOString() 
  });
});

app.listen(PORT, () => {
  console.log("\n" + "🚀".repeat(30));
  console.log(`🚀 PROXY INTELIGENTE RODANDO NA PORTA ${PORT}`);
  console.log(`🎭 MASK: ${MASK}`);
  console.log(`💾 Fallbacks salvos: ${fallbacks.length}`);
  console.log(`✅ Exemplo: ${MASK}/series/Altairplay2024/4995NFTSybwa/361267.mp4`);
  console.log("🚀".repeat(30) + "\n");
});