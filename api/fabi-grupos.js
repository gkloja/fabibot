'use strict';
const crypto=require('node:crypto');
/** Vercel flat proxy for Fabi Grupos V44. Env optional: FABI_GRUPOS_BACKEND_ORIGIN. Default points to the configured Bronxy host.
 * No credentials embedded in frontend; no arbitrary upstream URLs accepted.
 */
module.exports=async function handler(req,res){
  const originRaw=String(process.env.FABI_GRUPOS_BACKEND_ORIGIN||'http://br2.bronxyshost.com:4009').trim();
  let origin;try{origin=new URL(originRaw);if(!['http:','https:'].includes(origin.protocol)||origin.pathname!=='/'&&origin.pathname!=='')throw Error('invalid');if(origin.protocol==='http:'&&origin.host!=='br2.bronxyshost.com:4009')throw Error('insecure origin not allowed')}catch{return res.status(503).json({error:'Servidor Fabi Grupos não configurado na Vercel. Verifique FABI_GRUPOS_BACKEND_ORIGIN e a conectividade do backend.'})}
  if(origin.host===req.headers.host)return res.status(503).json({error:'A origem do backend não pode apontar para a própria Vercel (loop de proxy).'});
  const method=String(req.method||'GET').toUpperCase();if(!['GET','POST'].includes(method))return res.status(405).json({error:'Método não permitido'});
  const raw=String(req.url||'');const url=new URL(raw,'https://vercel.local');
  // /api/fabi-grupos/:endpoint* is rewritten to this flat serverless function.
  // This avoids creating any new folder inside the public GitHub repository.
  const rewriteValue=url.searchParams.get('endpoint');
  const tail=rewriteValue!==null?'/'+rewriteValue.replace(/^\/+/, ''):url.pathname.replace(/^\/api\/fabi-grupos/,'');
  url.searchParams.delete('endpoint');
  if(!/^\/(?:public|submit|boost|r\/[A-Za-z0-9_-]+|mp\/webhook|admin(?:\/[A-Za-z0-9_\/-]+)?)$/.test(tail))return res.status(404).json({error:'Rota desconhecida'});
  const upstream=new URL('/api/fabi-grupos'+tail+url.search,origin);
  const headers={'accept':'application/json'};
  let body;
  if(method==='POST'){
    body=typeof req.body==='string'?req.body:JSON.stringify(req.body||{});
    if(Buffer.byteLength(body,'utf8')>30000)return res.status(413).json({error:'Conteúdo muito grande'});
    headers['content-type']='application/json';
  }
  // Nunca encaminhar a senha do painel ao backend HTTP em texto puro.
  // A Vercel recebe a senha por HTTPS e envia uma prova HMAC assinada e temporária.
  // A assinatura inclui o corpo para impedir mudanças de ação no caminho.
  if(tail.startsWith('/admin')){
    const key=String(req.headers['x-fabi-admin-key']||'');
    if(!key||key.length>256)return res.status(401).json({error:'Senha administrativa necessária'});
    const ts=String(Date.now()),nonce=crypto.randomBytes(16).toString('hex');
    const digest=crypto.createHash('sha256').update(body||'').digest('hex');
    const canonical=[ts,nonce,method,upstream.pathname+upstream.search,digest].join('\n');
    headers['x-fabi-proof-timestamp']=ts;
    headers['x-fabi-proof-nonce']=nonce;
    headers['x-fabi-proof-signature']=crypto.createHmac('sha256',key).update(canonical).digest('hex');
  }
  const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),18000);
  try{
    const result=await fetch(upstream,{method,headers,body,redirect:'manual',signal:abort.signal});
    res.status(result.status);
    res.setHeader('Cache-Control','no-store');
    if(result.status>=300&&result.status<400){const location=result.headers.get('location');if(location){let dest;try{dest=new URL(location,origin);if(dest.protocol!=='https:'||dest.hostname!=='chat.whatsapp.com')throw Error('invalid redirect')}catch{return res.status(502).json({error:'Redirecionamento inválido'})}res.setHeader('Location',dest.href)}return res.end()}
    const type=result.headers.get('content-type')||'';
    if(!type.includes('application/json'))return res.status(502).json({error:'Backend retornou formato inesperado'});
    const json=await result.json();return res.json(json);
  }catch(error){return res.status(502).json({error:error.name==='AbortError'?'O backend demorou para responder.':'Não foi possível conectar ao servidor Fabi.'})}
  finally{clearTimeout(timer)}
};
