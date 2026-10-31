/* Fabi Grupos - fotos: cadastro e gerenciamento. */
(()=>{'use strict';
const $=id=>document.getElementById(id);let photoData='';
const css=document.createElement('style');css.textContent=`.fabi-photo-box{border:1px dashed #9383e6;border-radius:16px;padding:15px;margin:12px 0;background:rgba(115,90,230,.07)}.fabi-photo-box strong,.fabi-photo-box small{display:block}.fabi-photo-box small{opacity:.75;margin:5px 0}.fabi-photo-line{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.fabi-photo-line img{height:78px;width:78px;object-fit:cover;border-radius:14px}.fabi-photo-box input{max-width:100%}.fabi-photo-panel{margin:18px 0;padding:18px;border:1px solid #958be066;border-radius:18px}.fabi-photo-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:13px 0;border-bottom:1px solid #8883}.fabi-photo-row img{height:58px;width:58px;border-radius:12px;object-fit:cover}.fabi-photo-row .fabi-photo-info{flex:1;min-width:160px}.fabi-photo-row .fabi-photo-info small{display:block;opacity:.7}.fabi-photo-row button{cursor:pointer}.fabi-photo-controls{display:flex;gap:8px;flex-wrap:wrap}`;document.head.append(css);
async function imageData(file){if(!file)return '';if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('Escolha JPG, PNG ou WebP de até 5 MB.');const bmp=await createImageBitmap(file);try{const canvas=document.createElement('canvas');canvas.width=canvas.height=600;const c=canvas.getContext('2d',{alpha:false});const n=Math.min(bmp.width,bmp.height);c.drawImage(bmp,(bmp.width-n)/2,(bmp.height-n)/2,n,n,0,0,600,600);const result=canvas.toDataURL('image/webp',.78);if(result.length>1300000)throw Error('Foto muito grande.');return result}finally{bmp.close?.()}}
function initForm(){const form=$('submitForm');if(!form||$('fabiPhotoUpload'))return;const box=document.createElement('div');box.className='fabi-photo-box';box.innerHTML='<strong>📸 Foto do grupo ou canal (opcional)</strong><small>Envie uma foto para aparecer no catálogo após aprovação. JPG, PNG ou WebP, até 5 MB.</small><div class="fabi-photo-line"><img id="fabiPhotoPreview" alt="Prévia da foto" hidden><input id="fabiPhotoUpload" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Escolher foto"></div><small id="fabiPhotoStatus" role="status"></small>';const anchor=form.querySelector('[name=description]')?.closest('label');(anchor||form.firstElementChild).insertAdjacentElement('afterend',box);$('fabiPhotoUpload').addEventListener('change',async e=>{photoData='';$('fabiPhotoPreview').hidden=true;try{photoData=await imageData(e.target.files[0]);$('fabiPhotoPreview').src=photoData;$('fabiPhotoPreview').hidden=false;$('fabiPhotoStatus').textContent='✓ Foto pronta para envio'}catch(err){$('fabiPhotoStatus').textContent=err.message}});form.addEventListener('reset',()=>{photoData='';$('fabiPhotoPreview').hidden=true;$('fabiPhotoStatus').textContent=''})}
// Intercepta exclusivamente o POST de cadastro e adiciona a foto ao mesmo registro.
const nativeFetch=window.fetch.bind(window);
const uploadedPhotoRE=/^\/api\/fabi-grupos-photo\?name=[a-f0-9]{24}\.(?:webp|jpg|png)(?:&v=\d{10,17})?$/;
let photoMapCache=null;let photoMapTime=0;
async function loadPhotoMap(){if(photoMapCache&&Date.now()-photoMapTime<15000)return photoMapCache;try{const r=await nativeFetch('/api/fabi-grupos-photo-map?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('Mapa de fotos indisponivel');const j=await r.json();photoMapCache=j.photos||{};photoMapTime=Date.now();return photoMapCache}catch(e){console.warn('Mapa publico de fotos:',e);return {}}}
const resolvePhoto=url=>typeof url==='string'&&uploadedPhotoRE.test(url)?location.origin+url:url;
window.fetch=async function(input,init){
 let url=typeof input==='string'?input:input?.url||'';
 try{
  if(photoData&&/\/api\/fabi-grupos(?:\/submit|\?endpoint=submit)(?:$|[?&])/.test(url)&&String(init?.method||'GET').toUpperCase()==='POST'&&typeof init.body==='string'){
   const body=JSON.parse(init.body);body.photoData=photoData;
   init={...init,body:JSON.stringify(body)};input='/api/fabi-grupos-foto-api?mode=submit';url=input;
  }
 }catch(e){console.warn('Foto do cadastro:',e)}
 const response=await nativeFetch(input,init);
 // Fotos publicas: mescla as imagens salvas diretamente no servidor, antes de renderizar os cards e detalhes.
 if(response.ok&&/\/api\/fabi-grupos(?:\/public|\?endpoint=public)(?:$|[?&])/.test(url)&&String(init?.method||'GET').toUpperCase()==='GET'){
  try{
   const data=await response.clone().json();
   if(Array.isArray(data.groups)){
    const photos=await loadPhotoMap();
    const fixed={...data,groups:data.groups.map(g=>{
     const saved=photos[String(g.id)];
     return {...g,photo:resolvePhoto(saved||g.photo||'')};
    })};
    return new Response(JSON.stringify(fixed),{status:response.status,statusText:response.statusText,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
   }
  }catch(e){console.warn('Nao foi possivel ajustar as URLs das fotos:',e)}
 }

 return response;
};
function adminKey(){return $('adminKey')?.value||''}
async function api(path,method='GET',body){const target=path.endsWith('/foto')?'/api/fabi-grupos-foto-api?mode=admin-photo&id='+encodeURIComponent(path.split('/')[2]):'/api/fabi-grupos'+path;const response=await nativeFetch(target,{method,headers:{'x-fabi-admin-key':adminKey(),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'Não foi possível completar a operação.');return data}
async function refresh(){const root=$('fabiPhotoRows');if(!root)return;root.textContent='Carregando comunidades…';try{const data=await api('/admin/requests');root.replaceChildren();for(const g of data.groups||[]){const row=document.createElement('div');row.className='fabi-photo-row';const img=document.createElement('img');img.alt='Foto de '+g.name;img.src=resolvePhoto(g.photo||'');img.hidden=!g.photo;const info=document.createElement('div');info.className='fabi-photo-info';const title=document.createElement('strong');title.textContent=g.name||'Comunidade';const sub=document.createElement('small');sub.textContent=(g.type==='channel'?'Canal':'Grupo')+' · '+(g.status||'');info.append(title,sub);const controls=document.createElement('div');controls.className='fabi-photo-controls';const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.hidden=true;const add=document.createElement('button');add.className='btn btn-outline';add.type='button';add.textContent=g.photo?'Trocar foto':'Adicionar foto';add.onclick=()=>input.click();input.onchange=async()=>{try{add.disabled=true;const photoData=await imageData(input.files[0]);await api('/admin/'+g.id+'/foto','POST',{action:'save',photoData});await refresh()}catch(e){alert(e.message)}finally{add.disabled=false}};controls.append(add,input);if(g.photo){const del=document.createElement('button');del.type='button';del.className='btn btn-outline';del.textContent='Remover';del.onclick=async()=>{if(!confirm('Remover a foto de '+g.name+'?'))return;try{await api('/admin/'+g.id+'/foto','POST',{action:'remove'});await refresh()}catch(e){alert(e.message)}};controls.append(del)}row.append(img,info,controls);root.append(row)}if(!data.groups?.length)root.textContent='Nenhuma comunidade cadastrada.'}catch(e){root.textContent='Não foi possível carregar fotos: '+e.message}}

function initAdmin(){const dashboard=$('adminDashboard');if(!dashboard||$('fabiPhotoPanel'))return;const panel=document.createElement('section');panel.id='fabiPhotoPanel';panel.className='fabi-photo-panel';panel.innerHTML='<div class="admin-toolbar"><div><h3>📸 Fotos dos grupos e canais</h3><p>Adicione, substitua ou remova imagens do catálogo.</p></div><button type="button" id="fabiPhotoRefresh" class="btn btn-outline">Atualizar fotos</button></div><div id="fabiPhotoRows">Entre no painel para carregar as comunidades.</div>';const tabs=$('adminDashboard').querySelector('.admin-tabs');tabs?.insertAdjacentElement('beforebegin',panel);$('fabiPhotoRefresh').onclick=refresh;$('adminLogin')?.addEventListener('click',()=>setTimeout(()=>{if(!$('adminDashboard').classList.contains('hidden'))refresh()},900));$('adminRefresh')?.addEventListener('click',()=>setTimeout(refresh,500));if(!dashboard.classList.contains('hidden'))refresh()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{initForm();initAdmin()});else{initForm();initAdmin()}
})();
