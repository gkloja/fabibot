import express from "express";
import fetch from "node-fetch";

const app = express();

app.use(async (req, res) => {
  try {
    const targetUrl = "http://br2.bronxyshost.com:4009/gruposwpp" + req.url;

    const response = await fetch(targetUrl);

    // Copiar cabeçalhos originais
    response.headers.forEach((value, name) => {
      res.setHeader(name, value);
    });

    // Ler como binário (vídeo, imagem, css, js — tudo funciona)
    const buffer = await response.buffer();

    res.status(response.status);
    res.send(buffer);

  } catch (err) {
    console.error("Erro proxy:", err);
    res.status(500).send("Erro ao carregar o site.");
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Proxy rodando na porta " + port));
