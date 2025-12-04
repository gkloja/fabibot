import express from "express";
import fetch from "node-fetch";
import path from "path";

const app = express();

// Servir arquivos do seu site normalmente
app.use(express.static(path.join(process.cwd(), "public")));
app.use(express.urlencoded({ extended: true }));

// -------------------------
// PROXY APENAS PARA /externo
// -------------------------
const BASE_URL = "http://br2.bronxyshost.com:4009";

app.use("/externo", async (req, res) => {
  try {
    const targetUrl = BASE_URL + req.url.replace("/externo", "");

    const response = await fetch(targetUrl);
    const contentType = response.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);

    if (contentType.includes("text/html")) {
      const html = await response.text();
      res.send(html);
      return;
    }

    const buffer = await response.buffer();
    res.send(buffer);

  } catch (err) {
    console.error("PROXY ERRO:", err);
    res.status(500).send("Erro ao carregar através do proxy.");
  }
});

// -------------------------
// SUAS ROTAS AQUI FUNCIONAM NORMAL
// -------------------------
app.post("/users/login", (req, res) => {
  const { username, password } = req.body;

  if (username === "admin" && password === "123") {
    return res.send("Logado com sucesso!");
  }

  res.send("Login incorreto.");
});

// -------------------------
const port = 3000;
app.listen(port, () => console.log("Rodando na porta " + port));
