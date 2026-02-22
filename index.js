import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";

const app = express();
const MASK = "https://fabibot-taupe.vercel.app";

app.use(cookieParser());

// Headers fixos do Chrome
const CHROME_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1"
};

// ===== PROXY SIMPLES =====
app.get("/*", async (req, res) => {
  console.log("\n" + "=".repeat(60));
  console.log(`🔍 ${req.path}`);

  // Health check
  if (req.path === '/health') {
    return res.json({ status: "ok", mask: MASK });
  }

  try {
    // 1. FAZ EXATAMENTE O QUE O NAVEGADOR FAZ
    const urlOriginal = `http://cavalo.cc:80${req.path}`;
    console.log(`1️⃣ Acessando: ${urlOriginal}`);
    
    // 2. PRIMEIRA REQUISIÇÃO (pode redirecionar)
    const response1 = await fetch(urlOriginal, {
      headers: {
        ...CHROME_HEADERS,
        "Host": "cavalo.cc"
      },
      redirect: "manual" // Não seguir automaticamente para ver o redirecionamento
    });

    // 3. SE REDIRECIONOU (302), PEGAR A NOVA URL
    if (response1.status === 302 || response1.status === 301) {
      const location = response1.headers.get("location");
      console.log(`2️⃣ Redirecionou para: ${location}`);
      
      // 4. FAZER REQUISIÇÃO PARA A URL DO REDIRECIONAMENTO
      const response2 = await fetch(location, {
        headers: {
          ...CHROME_HEADERS,
          "Host": new URL(location).hostname,
          "Range": req.headers["range"] || ""
        }
      });

      console.log(`3️⃣ Status final: ${response2.status}`);

      // 5. COPIAR HEADERS E ENVIAR VÍDEO
      const headersToCopy = ["content-type", "content-length", "content-range", "accept-ranges"];
      headersToCopy.forEach(header => {
        const value = response2.headers.get(header);
        if (value) res.setHeader(header, value);
      });

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.status(response2.status);
      response2.body.pipe(res);
      console.log(`✅ Vídeo enviado!`);
      return;
    }

    // Se não redirecionou, envia a resposta original
    res.status(response1.status).send(await response1.text());
    
  } catch (error) {
    console.error("❌ Erro:", error);
    res.status(500).send("Erro interno");
  }
});

// ===== EXPORTAR =====
export default app;