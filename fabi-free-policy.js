'use strict';
// FABI FREE V56 - uma fonte de verdade para site, comandos e runtime.
// Não se confia em listas enviadas pelo navegador: a validação acontece no servidor.
const ALLOWED=Object.freeze([
 'sistemGold','antinotas','x9','soinsta','soadm','visuUnica','soinstaface',
 'antistatus','antiimg','antivideo','antiaudio','antisticker','antidoc','antictt',
 'antiloc','antilinkgp','level','antilinkhard','antifake','antispam','nsfw',
 'autosticker'
]);
const allowed=new Set(ALLOWED);
const PRO_ONLY=Object.freeze([
 'pokemonAuto','sogrupo','modovoz','antipolitica','antirepeticoes',
 'antiporno','simi1','simi2','fabidomal','fabimeme','jogos',
 'autoresposta','registrarFIGUS','autodl','Odelete','jovempan','oliberal',
 'futebol','g1','gospel','anticatalogo','bangp','audios','forca_inc',
 'bemvindo1','bemvindo2','autoMedia'
]);
function apply(cfg){
 if(!cfg||typeof cfg!=='object')return cfg;
 for(const field of PRO_ONLY)cfg[field]=false;
 // Configurações padrão apenas da versão Pro nunca devem funcionar no Free.
 if(Array.isArray(cfg.wellcome))for(const item of cfg.wellcome)if(item&&typeof item==='object'){
   item.bemvindo1=false;item.bemvindo2=false;
 }
 // Proteção obrigatória independente de controle no painel.
 cfg.antiinvisivel=true;
 return cfg;
}
function newGroup(cfg){
 if(!cfg||typeof cfg!=='object')return cfg;
 for(const field of ALLOWED)cfg[field]=false;
 return apply(cfg);
}
// Campos de auth/transporte do painel — NÃO são recursos do plano.
const AUTH=new Set([
 'grupoID','grupoId','groupId','groupID',
 'contaNumero','numero','phone','telefone',
 'nome','nomeConta','user','username',
 'fabiGrupoToken','token','sessao','session','sessaoAdmin',
 'plan','plano','password','senha'
]);
function validateBody(body){
 for(const [key,value] of Object.entries(body||{})){
   if(AUTH.has(key))continue;
   // Só valida chaves que parecem toggle de recurso (on/off) ou nomes conhecidos
   const isToggle = value === 'on' || value === 'off';
   if(!isToggle && !allowed.has(key) && !PRO_ONLY.includes(key)) continue;
   if(!allowed.has(key))return `O recurso ${key} é exclusivo da Fabi Pro.`;
   if(value!=='on'&&value!=='off')return `Valor inválido para ${key}.`;
 }
 return null;
}
module.exports={ALLOWED,PRO_ONLY,isAllowed:(k)=>allowed.has(k),apply,newGroup,validateBody};
