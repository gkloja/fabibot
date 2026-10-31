'use strict';
// Mapa publico de fotos: consulta somente imagens de comunidades publicadas.
module.exports=async function(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Metodo nao permitido'});
 let origin;try{
  origin=new URL(String(process.env.FABI_GRUPOS_BACKEND_ORIGIN||'http://br2.bronxyshost.com:4009'));
  if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||
     (origin.protocol==='http:'&&origin.host!=='br2.bronxyshost.com:4009'))throw Error('origem invalida');
 }catch{return res.status(503).json({error:'Backend nao configurado'})}
 try{
  const response=await fetch(new URL('/api/fabi-grupos/photo-map',origin),{headers:{accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(!response.ok)return res.status(502).json({error:'Backend nao disponibilizou fotos'});
  const data=await response.json();
  res.setHeader('Cache-Control','no-store, max-age=0');
  return res.status(200).json({photos:data&&typeof data.photos==='object'&&!Array.isArray(data.photos)?data.photos:{}});
 }catch{return res.status(502).json({error:'Nao foi possivel carregar fotos'})}
};
