import express from "express";
import fetch from "node-fetch";

const app = express();

const base = "http://br2.bronxyshost.com:4009";

app.use(async (req, res) => {
  try {
    const targetUrl = base + req.url;

    const response = await fetch(targetUrl);

    const contentType = response.headers.get("content-type");
    res.setHeader("Content-Type", contentType);

    if (contentType && contentType.includes("text/html")) {
      let html = await response.text();

      // Como você não usa prefixo, NÃO PRECISA REESCREVER PATHS
      res.send(html);
      return;
    }

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));

  } catch (err) {
    console.error("PROXY ERRO:", err);
    res.status(500).send("Erro ao carregar através do proxy.");
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Proxy rodando na porta " + port));
