# Fabi Bot

**O bot mais completo para WhatsApp no Brasil.**

Figurinhas · Downloads de músicas e vídeos · Jogos · IA · Anti-spam · Gerenciamento de grupos

[![Site](https://img.shields.io/badge/Site-fabibot.vercel.app-16a34a?style=for-the-badge)](https://fabibot.vercel.app)
[![Conectar](https://img.shields.io/badge/Conectar-WhatsApp-25D366?style=for-the-badge&logo=whatsapp)](https://fabibot.vercel.app/conectar)
[![Figurinhas](https://img.shields.io/badge/Figurinhas-Grátis-22c55e?style=for-the-badge)](https://fabibot.vercel.app/figurinhas)

---

## O que é a Fabi Bot?

A **Fabi Bot** é um robô inteligente para WhatsApp que transforma qualquer grupo em uma experiência completa:

| Recurso | Descrição |
|---------|-----------|
| **Figurinhas** | Crie stickers a partir de fotos, vídeos e GIFs em segundos |
| **Downloads** | Baixe músicas e vídeos (YouTube, TikTok e mais) sem marca d'água |
| **Jogos** | Minijogos, ranking, leilões e brincadeiras para engajar o grupo |
| **IA** | Inteligência artificial integrada para respostas e interações |
| **Proteção** | Anti-link, anti-spam, anti-fake, avisos e banimentos automáticos |
| **Admin** | Boas-vindas, promover/rebaixar, abrir/fechar grupo e muito mais |

Mais de **2.000 grupos** e centenas de comandos disponíveis.

---

## Links oficiais

- **Site:** [https://fabibot.vercel.app](https://fabibot.vercel.app)
- **Conectar o bot:** [https://fabibot.vercel.app/conectar](https://fabibot.vercel.app/conectar)
- **Figurinhas:** [https://fabibot.vercel.app/figurinhas](https://fabibot.vercel.app/figurinhas)
- **Downloads:** [https://fabibot.vercel.app/downloads](https://fabibot.vercel.app/downloads)
- **Comandos:** [https://fabibot.vercel.app/comandos](https://fabibot.vercel.app/comandos)

---

## Como conectar (resumo)

1. Acesse [fabibot.vercel.app/conectar](https://fabibot.vercel.app/conectar)
2. Faça login gratuito
3. Pareie com o WhatsApp (código ou QR)
4. Adicione o bot no grupo e use os comandos

Tutorial completo no site e no canal do YouTube.

---

## Comandos populares

```
!s          → Cria figurinha (marque a imagem/vídeo)
!fig        → Várias figurinhas de uma vez
!play       → Baixa e envia música
!yt         → Download de vídeo do YouTube
!tiktok     → Download do TikTok sem marca d'água
!menu       → Lista completa de comandos
!marcar     → Marca todos os membros
!antilink   → Ativa proteção contra links
```

Lista completa: [fabibot.vercel.app/comandos](https://fabibot.vercel.app/comandos)

---

## Deploy do site (Vercel)

Este repositório contém o **frontend estático**. Envie na raiz:

```
index.html
figurinhas.html
downloads.html
comandos.html
conectar.html
login.html
flogo.jpg / flogo.webp
og-image.jpg
icon-192.png / icon-512.png / apple-touch-icon.png
favicon-16x16.png / favicon-32x32.png
robots.txt
sitemap.xml
site.webmanifest
vercel.json
fabibot.mp4   (opcional)
```

O backend (`connect.js` / API) permanece no seu servidor. O site usa proxy Cloudflare quando necessário.

### SEO / Google

1. [Google Search Console](https://search.google.com/search-console) → adicione `https://fabibot.vercel.app`
2. Envie o sitemap: `https://fabibot.vercel.app/sitemap.xml`
3. Solicite indexação de `/figurinhas.html`, `/downloads.html` e `/comandos.html`

---

## Stack

- HTML / CSS / JavaScript (site estático)
- Deploy: [Vercel](https://vercel.com)
- Backend e bot: servidor próprio + integração WhatsApp

---

## Contato e comunidade

- Site e suporte: [fabibot.vercel.app](https://fabibot.vercel.app)
- Issues neste repositório para bugs e sugestões do frontend

---

**Fabi Bot** — Figurinhas, downloads, jogos e proteção. Tudo em um só bot.
