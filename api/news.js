// Somente rotas públicas. Painéis editor/mestre nunca passam por este proxy.
module.exports=async function handler(req,res){
 const p=typeof req.query.path==='string'?req.query.path:'';
 const allowed=/^noticias(?:\/(?:assets\/(?:news\.css|news\.js|community\.js)|audio\/[a-z0-9-]+\/\d+|community\/identity|community\/[a-z0-9-]+\/(?:view|comments)|[a-z0-9-]+|feed\.xml|sitemap\.xml))?$/;
 if(p.length>240||!allowed.test(p))return res.status(404).end();
 const posting=req.method==='POST',writePath=/^noticias\/community\/[a-z0-9-]+\/(?:view|comments)$/.test(p);
 if(!['GET','HEAD','POST'].includes(req.method)||posting&&!writePath){res.setHeader('Allow','GET, HEAD');return res.status(405).end();}
 const search=new URLSearchParams();for(const k of ['q','categoria','pagina'])if(typeof req.query[k]==='string')search.set(k,req.query[k].slice(0,100));
 const backend=process.env.FABI_NEWS_BACKEND_URL||'http://br2.bronxyshost.com:4009';const target=backend.replace(/\/$/,'')+'/'+p+(search.size?'?'+search:'');
 const worker=process.env.FABI_NEWS_PROXY_URL||'https://orange-hill-2e61.gbscabral15.workers.dev/br2.bronxyshost.com:4009/proxy';const url=process.env.FABI_NEWS_DIRECT==='1'?target:worker+'?url='+encodeURIComponent(target);
 let body;if(posting){let b=req.body;try{if(typeof b==='string')b=JSON.parse(b);}catch{return res.status(400).json({error:'Dados inválidos.'});}if(!b||typeof b!=='object')return res.status(400).json({error:'Dados inválidos.'});body=JSON.stringify(Object.fromEntries(['token','name','text','website'].filter(k=>typeof b[k]==='string').map(k=>[k,b[k]])));if(Buffer.byteLength(body)>12000)return res.status(413).json({error:'Comentário muito longo.'});}
 try{const upstream=await fetch(url,{method:posting?'POST':'GET',...(posting?{headers:{'Content-Type':'application/json'},body}:{}),signal:AbortSignal.timeout(p.includes('/audio/')?55000:15000),redirect:'error'});res.statusCode=upstream.status;for(const k of ['content-type','cache-control','x-robots-tag','retry-after']){const v=upstream.headers.get(k);if(v)res.setHeader(k,v);}if(p.includes('/community/'))res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');if(req.method==='HEAD')return res.end();res.end(Buffer.from(await upstream.arrayBuffer()));}catch(e){res.setHeader('Cache-Control','no-store');if(p.includes('/community/'))return res.status(503).json({error:'Não foi possível conectar. Tente novamente em instantes.'});res.status(503).send('Fabi Notícias está temporariamente indisponível. Tente novamente em instantes.');}
};
