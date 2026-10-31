// Proxy de imagens publicas do catalogo Fabi Grupos.
module.exports=async function(req,res){
 if(req.method!=='GET')return res.status(405).end();
 const name=String(req.query.name||'');
 if(!/^[a-f0-9]{24}\.(webp|png|jpg)$/.test(name))return res.status(404).end();
 const origin=String(process.env.FABI_GRUPOS_BACKEND_ORIGIN||'http://br2.bronxyshost.com:4009').replace(/\/$/,'');
 try{const url=new URL(origin);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return res.status(503).end();
 const response=await fetch(url.origin+'/api/fabi-grupos/foto/'+name,{signal:AbortSignal.timeout(9000)});
 if(!response.ok)return res.status(response.status===404?404:502).end();
 const body=Buffer.from(await response.arrayBuffer());if(body.length>1100000)return res.status(502).end();
 res.setHeader('Content-Type',name.endsWith('.webp')?'image/webp':name.endsWith('.png')?'image/png':'image/jpeg');
 res.setHeader('Cache-Control','public, max-age=3600');res.setHeader('X-Content-Type-Options','nosniff');return res.end(body);
 }catch{return res.status(502).end()}
};
