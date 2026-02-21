import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();

app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.json({ limit: '20mb' }));
app.use(cookieParser());

const BASE = "http://cavalo.cc:80";
const MASK = "https://fabibot-taupe.vercel.app";

// ===== ROTA PRINCIPAL PARA VÍDEOS (SÉRIES/FILMES) =====
app.get("/series/*", async (req, res) => {
  try {
    const targetUrl = BASE + req.url;
    console.log("🎬 Proxy vídeo:", targetUrl);
    
    // Headers idênticos aos do Chrome
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
      redirect: "follow"
    });

    // Copiar headers importantes
    const headersToCopy = ["content-type", "content-length", "content-range", "accept-ranges"];
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
    response.body.pipe(res);
    
  } catch (error) {
    console.error("❌ Erro no vídeo:", error);
    res.status(500).send("Erro ao carregar vídeo");
  }
});

// ===== ROTA OPTIONS PARA CORS =====
app.options("/series/*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range");
  res.status(204).end();
});

// ===== HEALTH CHECK =====
app.get("/health", (req, res) => {
  res.json({ status: "ok", base: BASE, mask: MASK });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  🚀 Proxy de vídeos rodando na porta ${PORT}
  🔗 Encaminhando para: ${BASE}
  🎭 URL da máscara: ${MASK}
  ✅ Exemplo: ${MASK}/series/Altairplay2024/4995NFTSybwa/361267.mp4
  `);
});