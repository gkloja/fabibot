import express from "express";
import fetch from "node-fetch";
import cookieParser from "cookie-parser";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

const BASE = "http://br2.bronxyshost.com:4009";
const MASK = "https://fabibot.onrender.com";

// Configuração do multer para arquivos temporários
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'temp_uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas (JPEG, PNG, GIF, WebP)'));
    }
  }
});

// ===== ROTA PARA ALTERAR FOTO =====
app.post("/alterar-foto", async (req, res) => {
  try {
    const contentType = req.headers['content-type'] || '';
    
    // Se for JSON (com fotoUrl) - VEM DO FRONTEND
    if (contentType.includes('application/json')) {
      console.log("📨 Recebendo JSON com fotoUrl");
      
      const { fotoUrl, filename, timestamp } = req.body;
      
      if (!fotoUrl) {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: "URL da foto não fornecida" 
        });
      }
      
      console.log(`📤 Enviando foto para backend (tamanho base64: ${fotoUrl.length} chars)`);
      
      // Enviar para o backend real como JSON
      const cookies = req.headers.cookie || '';
      
      const backendResponse = await fetch(BASE + "/alterar-foto", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": cookies,
          "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
          "Accept": "application/json",
          "X-Forwarded-For": req.headers["x-forwarded-for"] || req.ip,
          "X-Real-IP": req.ip
        },
        body: JSON.stringify({ 
          fotoUrl: fotoUrl,
          filename: filename || `foto-${timestamp || Date.now()}.jpg`,
          timestamp: timestamp || Date.now()
        })
      });

      // Processar resposta
      let responseData;
      const responseText = await backendResponse.text();
      
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        console.error("❌ Erro ao parsear resposta do backend:", parseError);
        console.log("📄 Resposta bruta:", responseText.substring(0, 200));
        responseData = { 
          sucesso: false, 
          mensagem: "Resposta inválida do servidor backend" 
        };
      }

      // Copiar cookies
      const setCookie = backendResponse.headers.raw()["set-cookie"];
      if (setCookie) {
        setCookie.forEach((c) => {
          // Corrigir cookies para domínio correto
          const cookie = c
            .replace(/domain=[^;]+;?/i, '')
            .replace(/secure;?/i, '')
            .replace(/httponly;?/i, '');
          res.append("Set-Cookie", cookie);
        });
      }

      console.log(`📥 Resposta do backend: ${responseData.sucesso ? '✅' : '❌'} - ${responseData.mensagem || 'Sem mensagem'}`);
      
      // Retornar resposta
      res.status(backendResponse.status).json(responseData);
      
    } 
    // Se for multipart/form-data (arquivo direto) - CASO ALGUM CLIENTE ENVIE DIRETO
    else if (contentType.includes('multipart/form-data')) {
      console.log("📨 Recebendo multipart/form-data");
      
      // Usar multer para processar o arquivo
      upload.single('fotoFile')(req, res, async (err) => {
        if (err) {
          console.error("❌ Erro no multer:", err.message);
          return res.status(400).json({ 
            sucesso: false, 
            mensagem: err.message 
          });
        }
        
        if (!req.file) {
          return res.status(400).json({ 
            sucesso: false, 
            mensagem: "Nenhuma imagem enviada" 
          });
        }

        console.log(`📄 Processando arquivo: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`);
        
        try {
          // Converter arquivo para base64
          const fileBuffer = fs.readFileSync(req.file.path);
          const base64 = fileBuffer.toString('base64');
          const dataUrl = `data:${req.file.mimetype};base64,${base64}`;
          
          // Enviar como JSON com fotoUrl
          const cookies = req.headers.cookie || '';
          
          console.log(`📤 Enviando arquivo convertido para backend...`);
          
          const backendResponse = await fetch(BASE + "/alterar-foto", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Cookie": cookies,
              "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
              "Accept": "application/json"
            },
            body: JSON.stringify({ 
              fotoUrl: dataUrl,
              filename: req.file.originalname,
              timestamp: Date.now()
            })
          });

          // Limpar arquivo temporário
          fs.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr) console.error("⚠️ Erro ao limpar arquivo temporário:", unlinkErr);
          });

          // Processar resposta
          let responseData;
          const responseText = await backendResponse.text();
          
          try {
            responseData = JSON.parse(responseText);
          } catch {
            responseData = { 
              sucesso: false, 
              mensagem: responseText || "Erro no servidor backend" 
            };
          }

          // Copiar cookies
          const setCookie = backendResponse.headers.raw()["set-cookie"];
          if (setCookie) {
            setCookie.forEach((c) => {
              const cookie = c
                .replace(/domain=[^;]+;?/i, '')
                .replace(/secure;?/i, '')
                .replace(/httponly;?/i, '');
              res.append("Set-Cookie", cookie);
            });
          }

          console.log(`📥 Resposta do backend (arquivo): ${responseData.sucesso ? '✅' : '❌'}`);
          res.status(backendResponse.status).json(responseData);
          
        } catch (error) {
          console.error("❌ Erro no processamento do arquivo:", error);
          
          // Limpar arquivo temporário em caso de erro
          if (req.file && fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, () => {});
          }
          
          res.status(500).json({ 
            sucesso: false, 
            mensagem: "Erro ao processar a imagem: " + error.message 
          });
        }
      });
    } 
    else {
      console.error("❌ Tipo de conteúdo não suportado:", contentType);
      res.status(400).json({ 
        sucesso: false, 
        mensagem: "Tipo de conteúdo não suportado. Use JSON ou multipart/form-data." 
      });
    }
    
  } catch (error) {
    console.error("❌ Erro geral no upload:", error);
    res.status(500).json({ 
      sucesso: false, 
      mensagem: "Erro interno do servidor: " + error.message 
    });
  }
});

// ===== ROTA PARA API DE MÚSICAS =====
app.post("/play", async (req, res) => {
  try {
    console.log("🎵 Requisição para API de músicas");
    
    const backendResponse = await fetch(BASE + "/play", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Samá-Music-Player/1.0",
        "Cookie": req.headers.cookie || "",
        "X-Forwarded-For": req.headers["x-forwarded-for"] || req.ip
      },
      body: JSON.stringify(req.body)
    });

    const data = await backendResponse.json();
    
    // Copiar cookies se houver
    const setCookie = backendResponse.headers.raw()["set-cookie"];
    if (setCookie) {
      setCookie.forEach((c) => {
        const cookie = c
          .replace(/domain=[^;]+;?/i, '')
          .replace(/secure;?/i, '')
          .replace(/httponly;?/i, '');
        res.append("Set-Cookie", cookie);
      });
    }
    
    res.status(backendResponse.status).json(data);
    
  } catch (error) {
    console.error("❌ Music API error:", error);
    res.status(500).json({ 
      error: "Falha na API de músicas",
      detalhes: error.message 
    });
  }
});

// ===== MIDDLEWARE PARA OUTRAS ROTAS (PROXY GERAL) =====
app.use(async (req, res) => {
  try {
    // Ignorar rotas que já foram tratadas
    if (req.path === '/alterar-foto' || req.path === '/play') {
      return res.status(404).send("Rota já tratada");
    }

    const targetUrl = BASE + req.url;
    console.log(`🔗 Proxy: ${req.method} ${req.path} -> ${targetUrl}`);

    // Preparar headers
    const headers = { 
      ...req.headers,
      "host": new URL(BASE).host,
      "origin": BASE,
      "referer": BASE + "/",
      "x-forwarded-for": req.headers["x-forwarded-for"] || req.ip,
      "x-real-ip": req.ip
    };
    
    // Remover headers problemáticos
    delete headers["content-length"];
    delete headers["accept-encoding"];

    let body;
    const contentType = req.headers["content-type"] || "";

    // Preparar body baseado no content-type
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (contentType.includes("application/json")) {
        body = JSON.stringify(req.body);
        headers["Content-Type"] = "application/json";
      } else if (contentType.includes("multipart/form-data")) {
        // Para multipart, deixar o fetch lidar
        body = req;
        delete headers["content-type"];
      } else {
        body = new URLSearchParams(req.body).toString();
        headers["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8";
      }
    }

    const fetchOptions = {
      method: req.method,
      headers: headers,
      redirect: "manual"
    };

    // Adicionar body se existir
    if (body && req.method !== "GET" && req.method !== "HEAD") {
      fetchOptions.body = body;
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Tratar redirecionamentos
    const location = response.headers.get("location");
    if (location) {
      let redirectUrl = location;
      if (redirectUrl.startsWith("/")) {
        redirectUrl = MASK + redirectUrl;
      } else if (redirectUrl.startsWith(BASE)) {
        redirectUrl = redirectUrl.replace(BASE, MASK);
      }
      res.setHeader("Location", redirectUrl);
      return res.status(response.status).end();
    }

    // Copiar cookies (corrigindo domínio)
    const cookies = response.headers.raw()["set-cookie"];
    if (cookies) {
      cookies.forEach(cookie => {
        const correctedCookie = cookie
          .replace(/domain=[^;]+;?/i, '')
          .replace(/secure;?/i, '')
          .replace(/httponly;?/i, '');
        res.append("Set-Cookie", correctedCookie);
      });
    }

    // Copiar outros headers importantes
    const headersToCopy = ["content-type", "cache-control", "expires", "last-modified", "etag"];
    headersToCopy.forEach(header => {
      const value = response.headers.get(header);
      if (value) {
        res.setHeader(header, value);
      }
    });

    // Enviar resposta
    const buffer = await response.buffer();
    res.status(response.status).send(buffer);

  } catch (error) {
    console.error("❌ Proxy error:", error);
    res.status(500).send(`Erro no proxy: ${error.message}`);
  }
});

// ===== LIMPEZA PERIÓDICA DE ARQUIVOS TEMPORÁRIOS =====
setInterval(() => {
  const tempDir = path.join(__dirname, 'temp_uploads');
  if (fs.existsSync(tempDir)) {
    fs.readdir(tempDir, (err, files) => {
      if (err) {
        console.error("⚠️ Erro ao listar arquivos temporários:", err);
        return;
      }
      
      const now = Date.now();
      let deletedCount = 0;
      
      files.forEach(file => {
        const filePath = path.join(tempDir, file);
        fs.stat(filePath, (err, stats) => {
          if (err) return;
          
          // Deletar arquivos com mais de 1 hora
          if (now - stats.mtimeMs > 60 * 60 * 1000) {
            fs.unlink(filePath, (unlinkErr) => {
              if (!unlinkErr) deletedCount++;
            });
          }
        });
      });
      
      if (deletedCount > 0) {
        console.log(`🧹 Limpeza: ${deletedCount} arquivo(s) temporário(s) removido(s)`);
      }
    });
  }
}, 30 * 60 * 1000); // A cada 30 minutos

// ===== ROTA DE STATUS/SAÚDE =====
app.get("/status", (req, res) => {
  res.json({
    status: "online",
    service: "proxy-mask",
    timestamp: new Date().toISOString(),
    mask_url: MASK,
    backend_url: BASE,
    uptime: process.uptime(),
    temp_dir: path.join(__dirname, 'temp_uploads')
  });
});

// ===== CRIAR DIRETÓRIO TEMPORÁRIO SE NÃO EXISTIR =====
const tempDir = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
  console.log("📁 Diretório temp_uploads criado");
}

// ===== INICIAR SERVIDOR =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  🚀 Proxy rodando na porta ${PORT}
  🔗 Backend: ${BASE}
  🎭 Máscara: ${MASK}
  📁 Temp dir: ${tempDir}
  ✅ Pronto para receber requisições!
  `);
});
