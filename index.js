import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ IP NOVO que você descobriu!
const BASE = "http://130.250.189.249";
const MASK = "https://fabibot-taupe.vercel.app";

app.use(cookieParser());

// ===== FUNÇÃO PROXY SIMPLES =====
async function proxyVideo(req, res) {
  console.log(`\n🎬 Requisição: ${req.path}`);
  
  try {
    // Extrai o nome do arquivo (ex: 361267.mp4)
    const arquivo = req.path.split('/').pop();
    
    // Pega os parâmetros da query string (token, uc, pc)
    const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
    
    // Constrói URL no formato correto
    const targetUrl = `${BASE}/deliver/${arquivo}${queryString ? '?' + queryString : ''}`;
    
    console.log(`🎯 Target: ${targetUrl}`);
    
    const response = await fetch(targetUrl, {
      headers: {
        "Host": "130.250.189.249",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "video/mp4,*/*",
        "Range": req.headers["range"] || "",
        "Referer": "http://130.250.189.249/",
        "Origin": "http://130.250.189.249"
      },
      redirect: "follow"
    });

    if (!response.ok) {
      return res.status(response.status).send(`Erro ${response.status}`);
    }

    // Copiar headers
    const headersToCopy = ["content-type", "content-length", "content-range", "accept-ranges"];
    headersToCopy.forEach(header => {
      const value = response.headers.get(header);
      if (value) res.setHeader(header, value);
    });

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(response.status);
    response.body.pipe(res);
    
  } catch (error) {
    console.error("❌ Erro:", error);
    res.status(500).send("Erro interno");
  }
}

// ===== ROTA ÚNICA - tudo vai para /deliver/ =====
app.get("/*.mp4", proxyVideo);

// ===== HEALTH CHECK =====
app.get("/health", (req, res) => {
  res.json({ status: "ok", base: BASE, mask: MASK });
});

app.listen(PORT, () => {
  console.log(`
  🚀 PROXY ATUALIZADO
  🎯 NOVO IP: ${BASE}
  🎭 MASK: ${MASK}
  ✅ Formato: ${MASK}/361267.mp4?token=SEU_TOKEN...
  `);
});