# Fabi Bot (site estático)

## Deploy no Vercel

Envie **todos** estes arquivos na raiz do projeto:

```
index.html
conectar.html
login.html
flogo.jpg
icon-192.png
icon-512.png
apple-touch-icon.png
robots.txt
sitemap.xml
site.webmanifest
vercel.json
fabibot.mp4   (opcional – vídeo da intro)
```

O backend (`connect.js`) continua no **seu servidor**. O site só usa o proxy Cloudflare.

## SEO / Google

1. No [Google Search Console](https://search.google.com/search-console): adicione `https://fabibot.vercel.app`
2. Envie o sitemap: `https://fabibot.vercel.app/sitemap.xml`
3. Confirme a verificação (meta já existe no `index.html`)
4. Aguarde indexação (pode levar dias)

## URLs

| Página | URL |
|--------|-----|
| Início | `/` ou `/index.html` |
| Conectar | `/conectar` ou `/conectar.html` |
| Login | `/login` ou `/login.html` |

Regras em `vercel.json` redirecionam `/conectar` → `conectar.html`.
