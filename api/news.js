// Vercel: proxy restrito às rotas públicas do portal. O painel só existe no servidor.
module.exports=async function handler(req,res){
 if(req.method!=='GET'&&req.method!=='HEAD'){res.setHeader('Allow','GET, HEAD');return res.status(405).end();}
 const p=typeof req.query.path==='string'?req.query.path:'';
 if(p.length>220||!/^noticias(?:\/(?:assets\/(?:news\.css|news\.js)|audio\/[a-z0-9-]+\/\d+|[a-z0-9-]+|feed\.xml|sitemap\.xml))?$/.test(p))return res.status(404).end();
 const search=new URLSearchParams();for(const k of ['q','categoria','pagina'])if(typeof req.query[k]==='string')search.set(k,req.query[k].slice(0,100));
 const backend=process.env.FABI_NEWS_BACKEND_URL||'http://br2.bronxyshost.com:4009';const target=backend.replace(/\/$/,'')+'/'+p+(search.size?'?'+search:'');
 const worker=process.env.FABI_NEWS_PROXY_URL||'https://orange-hill-2e61.gbscabral15.workers.dev/br2.bronxyshost.com:4009/proxy';
 const url=process.env.FABI_NEWS_DIRECT==='1'?target:worker+'?url='+encodeURIComponent(target);
 try{const upstream=await fetch(url,{signal:AbortSignal.timeout(p.includes('/audio/')?55000:15000),redirect:'error'});res.statusCode=upstream.status;for(const key of ['content-type','cache-control','x-robots-tag','retry-after']){const value=upstream.headers.get(key);if(value)res.setHeader(key,value);}res.setHeader('X-Content-Type-Options','nosniff');if(req.method==='HEAD')return res.end();res.end(Buffer.from(await upstream.arrayBuffer()));}catch(e){res.setHeader('Cache-Control','no-store');res.status(503).send('Fabi Notícias está temporariamente indisponível. Tente novamente em instantes.');}
};