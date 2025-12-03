import express from "express";
import fetch from "node-fetch";

const app = express();

app.use(async (req, res) => {
  try {
    const base = "http://br2.bronxyshost.com:4009";
    const sitePath = "/gruposwpp";

    const targetUrl = base + sitePath + req.url;

    const response = await fetch(targetUrl);

    const contentType = response.headers.get("content-type");
    res.setHeader("Content-Type", contentType);

    // Se for HTML → ajusta caminhos
    if (contentType && contentType.includes("text/html")) {
      let html = await response.text();

      // Converter links absolutos tipo "/arquivo" para "/gruposwpp/arquivo"
      html = html.replace(/href="\//g, `href="${sitePath}/`);
      html = html.replace(/src="\//g, `src="${sitePath}/`);

      res.send(html);
      return;
    }

    // Arquivos binários
    const buffer = await response.buffer();
    res.send(buffer);

  } catch (err) {
    console.error("PROXY ERRO:", err);
    res.status(500).send("Erro ao carregar através do proxy.");
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Proxy rodando na porta " + port));
