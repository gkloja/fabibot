'use strict';
// Proxy específico, sem redirecionamentos e sem registrar token.
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');
 res.setHeader('X-Robots-Tag','noindex, nofollow');
 if(req.method!=='POST')return res.status(405).json({success:false,message:'Método não permitido.'});
 const token=String(req.body?.token||'');
 if(!/^[A-Za-z0-9_-]{40,60}$/.test(token))return res.status(400).json({success:false,message:'Link inválido.'});
 let upstream;
 try{
  upstream=new URL(String(process.env.FABI_GRUPOS_BACKEND_ORIGIN||'http://br2.bronxyshost.com:4009'));
  if(!['http:','https:'].includes(upstream.protocol)||upstream.username||upstream.password||!['','/'].includes(upstream.pathname))throw Error('origem inválida');
  if(upstream.protocol==='http:'&&upstream.host!=='br2.bronxyshost.com:4009')throw Error('origem HTTP não autorizada');
  if(upstream.host===req.headers.host)throw Error('loop');
 }catch{return res.status(503).json({success:false,message:'Servidor de login temporariamente indisponível.'})}
 const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),12000);
 try{
  const url=new URL('/api/fabi-acesso',upstream);
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({token}),signal:abort.signal,redirect:'manual'});
  const data=await response.json().catch(()=>null);
  if(!data||typeof data!=='object')return res.status(502).json({success:false,message:'Resposta inesperada do servidor.'});
  return res.status(response.status).json(data);
 }catch{return res.status(502).json({success:false,message:'Falha temporária de conexão. Tente novamente.'})}
 finally{clearTimeout(timer)}
};
