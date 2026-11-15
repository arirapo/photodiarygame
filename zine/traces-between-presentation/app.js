'use strict';
const edition=window.EDITION;
const $=id=>document.getElementById(id);
let mode='present', profile=edition.defaultProfile, extra=false, current='kansi';
const text=(tag,value,cls)=>{const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;return el;};
function safePath(path){if(!path || /^(?:[a-z]+:|\/|\\)/i.test(path) || path.split('/').includes('..'))throw Error('Median tulee olla julkaisun paikallinen tiedosto.');return path;}
function activePages(){return mode==='zine'?edition.pages:edition.pages.filter(p=>edition.profiles[profile].pages.includes(p.id)||(extra&&p.supplement)).sort((a,b)=>{const ids=edition.profiles[profile].pages;return (ids.includes(a.id)?ids.indexOf(a.id):100+edition.pages.indexOf(a))-(ids.includes(b.id)?ids.indexOf(b.id):100+edition.pages.indexOf(b));});}
for(const [id,p] of Object.entries(edition.profiles)){const o=text('option',p.label);o.value=id;$('profile').append(o);}$('profile').value=profile;
for(const p of edition.pages){
 const section=document.createElement('section');section.id=p.id;section.className='page'+(p.id==='kansi'?' cover':'');section.setAttribute('aria-label',p.title);if(p.layout)section.className+=' layout-'+p.layout;section.append(text('h1',p.title));if(p.id!=='kansi')section.prepend(text('span',String(edition.pages.indexOf(p)).padStart(2,'0')+' / '+p.title,'chapter-marker'));
 if(p.id==='kansi'){
 const title=section.querySelector('h1');title.replaceChildren(text('span','Traces'),text('span','Between'));
 section.append(text('p','Jälki · Toisto · Aika · Muisti · Välissä','opening-index'),text('p',edition.author,'author'),text('p',edition.edition,'edition'));
 if(edition.context)section.append(text('p',edition.context));
 }
 else {const cols=document.createElement('div');cols.className='columns';const words=document.createElement('div');words.className='text';words.append(text('p',p.subtitle,'subtitle'));const passages=document.createElement('div');passages.className='passages';
 p.paragraphs.forEach((s,i)=>{const para=text('p',s,'passage passage-'+(i+1));if(p.layout && i===p.paragraphs.length-1)para.className+=' closing-line';passages.append(para);});words.append(passages);cols.append(words);const img=document.createElement('img');img.className='zine-image';img.src=safePath(p.image);img.alt=p.alt;img.decoding='async';cols.append(img);section.append(cols);
 if(p.layout==='trace'){

 const last=passages.lastElementChild;last.className='trace-question';section.append(last);
 }
 if(p.layout==='repetition'){

 const sequence=document.createElement('div');sequence.className='image-sequence';sequence.setAttribute('aria-label',p.sequenceLabel||'Kolme valokuvaa');
 for(const item of p.sequenceImages){const frame=document.createElement('figure');const repeat=document.createElement('img');repeat.src=safePath(item.src);repeat.alt=item.alt;repeat.decoding='async';frame.append(repeat);sequence.append(frame);}
 img.remove();section.append(sequence);section.append(text('p',p.sequenceCaption,'sequence-caption'));
 }
 if(['time','memory','between','family','research'].includes(p.layout)){
   const last=passages.lastElementChild;last.className='chapter-closing';section.append(last);
 }
 if(p.layout==='timeline'){
   const chronology=document.createElement('ol');chronology.className='chronology';chronology.setAttribute('aria-label','Tekijyyden vuodet');
   p.paragraphs[0].split('→').forEach(year=>{chronology.append(text('li',year.trim()));});
   passages.children[0].remove();section.append(chronology);
 }
 if(p.researchStages){
  const path=document.createElement('aside');path.className='research-path';path.setAttribute('aria-label',p.researchPathLabel);
  path.append(text('h2',p.researchPathLabel));const list=document.createElement('ol');
  p.researchStages.forEach(stage=>{const item=document.createElement('li');item.append(text('span',stage.year+' · '+stage.institution,'research-stage-year'),text('p',stage.topics));list.append(item);});path.append(list);section.append(path);
 }

 if(p.media){
   if(p.media.inline && p.media.src && p.media.type==='video'){
     img.className+=' print-poster';const stage=document.createElement('figure');stage.className='timelapse-stage';
     const video=document.createElement('video');video.dataset.timelapse='true';video.src=safePath(p.media.src);video.muted=true;video.defaultMuted=true;video.playsInline=true;video.loop=true;video.preload='metadata';video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('aria-label',p.media.label);
     if(p.media.poster)video.poster=safePath(p.media.poster);
     video.addEventListener('error',()=>{$('status').textContent='Panoraamatimelapsea ei voitu avata. Tarkista videon paikallinen tiedosto.';});
     stage.append(video);stage.append(text('figcaption','71 panoraamaa · 2:1','timelapse-caption'));section.append(stage);
   }else if(p.media.inline && p.media.src){
     img.className+=' print-poster';const stage=document.createElement('figure');stage.className='animation-stage';
     const iframe=document.createElement('iframe');iframe.title='200 — animaatio';iframe.dataset.project200='true';iframe.dataset.src=safePath(p.media.src);
     iframe.setAttribute('sandbox','allow-scripts allow-same-origin');stage.append(iframe);section.append(stage);
     const fallback=text('p','200 · kuvasarja · RGB','animation-caption');stage.append(fallback);
   }else{
     const media=document.createElement('details');media.className='media';media.append(text('summary',p.media.label+(p.media.src?'':' · lisätään myöhemmin')));
     if(!p.media.src)media.append(text('p','Liikkuva kuvajakso lisätään tähän myöhemmin.'));
     else{safePath(p.media.src);const launch=text('button','Avaa '+p.media.label);launch.onclick=()=>{const el=document.createElement(p.media.type==='video'?'video':'iframe');el.src=p.media.src;if(p.media.type==='video'){el.controls=true;el.playsInline=true;if(p.media.poster)el.poster=safePath(p.media.poster);}else{el.title=p.media.label;el.setAttribute('sandbox','allow-scripts allow-same-origin');}media.append(el);launch.remove();};media.append(launch);}
     media.addEventListener('toggle',()=>{if(!media.open)media.querySelectorAll('video').forEach(v=>v.pause());});section.append(media);
   }
 }
 }

 $('pages').append(section);
}
function show(id,scroll=false){const pages=activePages();current=pages.some(p=>p.id===id)?id:pages[0].id;document.body.className=mode;edition.pages.forEach(p=>{const el=$(p.id);el.hidden=mode==='present'?p.id!==current:false;el.querySelectorAll('video').forEach(v=>{if(mode==='present'){if(v.dataset.timelapse)syncTimelapse(v,p.id===current);else if(p.id!==current)v.pause();}});el.querySelectorAll('iframe').forEach(f=>{
 if(f.dataset.project200){if(mode==='present')setProjectPlayback(f,p.id===current);}
 else if(el.hidden && f.getAttribute('src')!=='about:blank'){f.dataset.resume=f.getAttribute('src');f.src='about:blank';}else if(!el.hidden&&f.dataset.resume){f.src=f.dataset.resume;delete f.dataset.resume;}
 });});
 // Restore launch buttons for embedded projects when returning to a page.
 document.querySelectorAll('.media').forEach(d=>{if(d.closest('section').hidden&&d.querySelector('summary'))d.open=false;});
 $('mode').textContent=mode==='present'?'Lue zinenä':'Sivu kerrallaan';$('mode').setAttribute('aria-pressed',String(mode==='present'));$('profile').disabled=mode==='zine';$('extras').hidden=mode==='zine';$('extras').textContent=extra?'Piilota lisäosiot':'Lisäosiot';const at=pages.findIndex(p=>p.id===current);$('position').textContent=`${at+1} / ${pages.length} · ${pages[at].title}`;$('prev').disabled=at===0;$('next').disabled=at===pages.length-1;$('contents').replaceChildren();pages.forEach(p=>{const a=text('a',p.title);a.href='#'+p.id;if(p.id===current)a.setAttribute('aria-current','page');$('contents').append(a);});history.replaceState(null,'','#'+current);if(scroll)$(current).scrollIntoView({block:'start'});}
function move(n){const pages=activePages(),i=pages.findIndex(p=>p.id===current);if(pages[i+n])show(pages[i+n].id,true);}
$('mode').onclick=()=>{mode=mode==='present'?'zine':'present';show(current,true);};$('profile').onchange=e=>{profile=e.target.value;extra=false;show('kansi',true);};$('extras').onclick=()=>{extra=!extra;show(current);};$('prev').onclick=()=>move(-1);$('next').onclick=()=>move(1);$('print').onclick=()=>window.print();$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else $('status').textContent='Tällä laitteella käytä Safarin Kätke työkalupalkki -toimintoa tai Koti-valikkoon lisättyä julkaisua.';}catch(e){$('status').textContent='Koko näyttö ei ole käytettävissä tässä selaimessa.';}};
$('menu').onclick=()=>{$('contents').hidden=!$('contents').hidden;$('menu').setAttribute('aria-expanded',String(!$('contents').hidden));};
function navigateHash(){const id=decodeURIComponent(location.hash.slice(1));if(edition.pages.some(p=>p.id===id)){if(!activePages().some(p=>p.id===id)){if(edition.pages.find(p=>p.id===id).supplement)extra=true;else{profile='presentation';$('profile').value=profile;}}show(id,true);}}window.addEventListener('hashchange',navigateHash);
document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA|BUTTON|VIDEO/.test(e.target.tagName)||e.target.closest('details'))return;if(['ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();move(1);}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();move(-1);}if(e.key==='Escape'&&mode==='present'){mode='zine';show(current,true);}});
let start; $('pages').addEventListener('touchstart',e=>{if(e.target.closest('details,button,a,video,iframe'))return;start={x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY};},{passive:true});$('pages').addEventListener('touchend',e=>{if(!start)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;if(mode==='present'&&Math.abs(dx)>70&&Math.abs(dx)>2*Math.abs(dy))move(dx<0?1:-1);start=null;},{passive:true});
$('offline').onclick=async()=>{if(!window.isSecureContext||!('serviceWorker'in navigator)){ $('status').textContent='Offline-tallennus tarvitsee HTTPS-osoitteen tai localhostin. Paikallisverkossa voit käyttää tätä ilman internetiä Macin palvelimen ollessa käynnissä. Katso README.';return;}
 $('offline').disabled=true;$('status').textContent='Tallennetaan koko julkaisu tälle laitteelle…';try{const reg=await navigator.serviceWorker.register('./sw.js');await reg.update();if(reg.installing){await new Promise((resolve,reject)=>{const pending=reg.installing;const timer=setTimeout(()=>reject(Error('Päivitys aikakatkaistiin.')),120000);const check=()=>{if(pending.state==='activated'){clearTimeout(timer);resolve();}else if(pending.state==='redundant'){clearTimeout(timer);reject(Error('Päivitys epäonnistui.'));}};pending.addEventListener('statechange',check);check();});}await navigator.serviceWorker.ready;const worker=reg.active;const channel=new MessageChannel();const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Tallennus aikakatkaistiin.')),120000);channel.port1.onmessage=e=>{clearTimeout(timer);resolve(e.data);};worker.postMessage({type:'VERIFY'},[channel.port2]);});if(!result.ok)throw Error(result.error||'Tallennus on puutteellinen.');$('status').textContent=`${result.count} tiedostoa tallennettu ja tarkistettu. Sulje julkaisu, kytke lentotila päälle ja avaa se uudelleen. Vasta tämä varmistaa offline-käytön.`;}catch(e){$('status').textContent='Offline-valmistelu epäonnistui: '+e.message;}finally{$('offline').disabled=false;}};
function syncTimelapse(video,playing){if(!playing){video.pause();return;}const result=video.play();if(result&&typeof result.catch==='function')result.catch(()=>{video.controls=true;});}
function setProjectPlayback(frame,playing){
 if(playing && !frame.getAttribute('src') && !frame.hasAttribute('srcdoc')){
   if(window.PROJECT200_SRCDOC)frame.srcdoc=window.PROJECT200_SRCDOC;else frame.src=frame.dataset.src;
   frame.onload=()=>frame.contentWindow?.postMessage({type:'project-200-playback',playing:frame.dataset.playing==='true'},location.origin==='null'?'*':location.origin);
 }
 frame.dataset.playing=String(playing);
 frame.contentWindow?.postMessage({type:'project-200-playback',playing},location.origin==='null'?'*':location.origin);
}
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(mode!=='zine')return;entries.forEach(entry=>{const f=entry.target.querySelector('iframe[data-project200]');if(f)setProjectPlayback(f,entry.isIntersecting);const v=entry.target.querySelector('video[data-timelapse]');if(v)syncTimelapse(v,entry.isIntersecting);});},{threshold:.1});document.querySelectorAll('.animation-stage').forEach(stage=>observer.observe(stage));document.querySelectorAll('.timelapse-stage').forEach(stage=>observer.observe(stage));}
window.addEventListener('message',event=>{const frame=document.querySelector('iframe[data-project200]');if(!frame||event.source!==frame.contentWindow||event.origin!==location.origin)return;if(event.data?.type==='project-200-status' && event.data.error)$('status').textContent='200: '+event.data.message;});
const initialHash=location.hash;show(current);if(initialHash){location.hash=initialHash;navigateHash();}
