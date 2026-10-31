// Upload de fotos Fabi Grupos - proxy com prova HMAC para administradores.
const crypto=require('node:crypto');
module.exports=async(req,res)=>{
 if(req.method!=='POST')return res.status(405).json({error:'Método não permitido'});
 const mode=String(req.query.mode||'');const id=String(req.query.id||'');
 if(mode!=='submit'&&mode!=='admin-photo')return res.status(404).end();
 if(mode==='admin-photo'&&!/^[a-f0-9]{24}$/.test(id))return res.status(400).end();
 const originRaw=String(process.env.FABI_GRUPOS_BACKEND_ORIGIN||'http://br2.bronxyshost.com:4009');let origin;
 try{origin=new URL(originRaw);if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||(origin.protocol==='http:'&&origin.host!=='br2.bronxyshost.com:4009'))throw Error('Origem inválida')}catch{return res.status(503).json({error:'Backend não configurado'})}
 const tail=mode==='submit'?'/submit':'/admin/'+id+'/foto';const upstream=new URL('/api/fabi-grupos'+tail,origin);
 const body=typeof req.body==='string'?req.body:JSON.stringify(req.body||{});
 if(Buffer.byteLength(body,'utf8')>1600000)return res.status(413).json({error:'Foto excede o limite'});
 const headers={'accept':'application/json','content-type':'application/json'};
 if(mode==='admin-photo'){
 const key=String(req.headers['x-fabi-admin-key']||'');if(!key||key.length>256)return res.status(401).json({error:'Senha administrativa necessária'});
 const ts=String(Date.now()),nonce=crypto.randomBytes(16).toString('hex');
 const digest=crypto.createHash('sha256').update(body).digest('hex');
 const canonical=[ts,nonce,'POST',upstream.pathname,digest].join('\n');
 headers['x-fabi-proof-timestamp']=ts;headers['x-fabi-proof-nonce']=nonce;
 headers['x-fabi-proof-signature']=crypto.createHmac('sha256',key).update(canonical).digest('hex');
 }
 try{const result=await fetch(upstream,{method:'POST',headers,body,signal:AbortSignal.timeout(18000)});const data=await result.json();res.setHeader('Cache-Control','no-store');return res.status(result.status).json(data)}catch{return res.status(502).json({error:'Não foi possível conectar ao servidor da Fabi'})}
};
