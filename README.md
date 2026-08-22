# Fabi Bot (site estático)

## Deploy no Vercel

Envie **todos** estes arquivos na raiz do projeto:

```
index.html
conectar.html
login.html
flogo.jpg
flogo.webp
og-image.jpg
icon-192.png
icon-512.png
apple-touch-icon.png
favicon-16x16.png
favicon-32x32.png
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
5. Use a ferramenta de inspeção de URL após o deploy

## URLs

| Página | URL |
|--------|-----|
| Início | `/` ou `/index.html` |
| Conectar | `/conectar` ou `/conectar.html` |
| Login | `/login` ou `/login.html` |

Regras em `vercel.json` redirecionam `/conectar` → `conectar.html`.

## Otimizações feitas (Ago/2026)

- Ícones PWA (192, 512, apple-touch) gerados
- Logo comprimida (~1,5 MB → ~110 KB)
- OG image 1200×630 para compartilhamento
- JSON-LD (WebSite, Organization, SoftwareApplication, WebPage)
- Meta tags completas na `conectar.html`
- Tutoriais no topo da página de conexão
- Remoção de código JS solto que vazava na tela
