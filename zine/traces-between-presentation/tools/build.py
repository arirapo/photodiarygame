"""Build the independent zine, local animation, offline inventory and portable editions."""
from pathlib import Path
import base64,hashlib,json,re,zipfile,mimetypes
def data_uri(path):
 path=Path(path);mime=mimetypes.guess_type(str(path))[0]
 assert mime in ['image/jpeg','image/png'],str(path)
 return 'data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'content/edition.json').read_text())
ids=[p['id'] for p in data['pages']]
assert len(ids)==len(set(ids))==9
for profile in data['profiles'].values():assert all(i in ids for i in profile['pages'])
for p in data['pages']:
 for value in [p.get('image'),(p.get('media') or {}).get('src'),(p.get('media') or {}).get('poster')]:
  if value:
   assert not re.match(r'^(?:[a-z]+:|/|\\)',value,re.I) and '..' not in Path(value).parts,value
   assert (root/value).is_file(),value
for page in data['pages']:
 for item in page.get('sequenceImages',[]):
  value=item['src'];assert not re.match(r'^(?:[a-z]+:|/|\\)',value,re.I) and '..' not in Path(value).parts,value
  assert (root/value).is_file(),value
project=root/'assets/project-200'
items=json.loads((project/'data/images2.json').read_text())
assert len(items)==202
for item in items:assert (project/item['image'].replace('images/','frames/',1)).is_file(),item['image']
(root/'content/edition.js').write_text('window.EDITION = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n')
(root/'manifest.webmanifest').write_text(json.dumps({'name':'Traces Between','short_name':'Traces Between','lang':'fi','start_url':'./index.html','scope':'./','display':'standalone','background_color':'#eeece5','theme_color':'#eeece5'},indent=2))
# Original Project 200 UI and full-resolution source images are a local reference mirror.
# Only the new animation and its bounded-resolution frames belong to the portable runtime.
def runtime_asset(p):
 rel=p.relative_to(root).as_posix()
 if rel.startswith('assets/project-200/'):
  return rel.startswith('assets/project-200/frames/') or rel in ['assets/project-200/animation.html','assets/project-200/animation.js','assets/project-200/data/images2.json']
 return p.is_file() and p.suffix.lower() not in ['.md','.txt']
print_layout=json.loads((root/'reference/print-layout.json').read_text())
assert print_layout['sourceContentSha256']==hashlib.sha256((root/'content/edition.json').read_bytes()).hexdigest(),'Tulostussivut on päivitettävä tools/build-print.py -työkalulla ennen pakkaamista.'
files=['index.html','styles.css','app.js','content/edition.js','manifest.webmanifest','print-pages.js','print.html','traces-between-A4-2026.pdf']+[str(p.relative_to(root)) for p in sorted((root/'assets').rglob('*')) if p.is_file() and runtime_asset(p)]
hashes={f:hashlib.sha256((root/f).read_bytes()).hexdigest() for f in files}
version=hashlib.sha256(json.dumps(hashes,sort_keys=True).encode()).hexdigest()[:16]
(root/'offline-files.json').write_text(json.dumps({'version':version,'files':hashes},indent=2))
sw="""'use strict';
const CACHE='traces-editorial-09-VERSION',FILES=FILES_JSON;
self.addEventListener('install',e=>e.waitUntil((async()=>{const cache=await caches.open(CACHE);for(const path of FILES){const response=await fetch(new Request(path,{cache:'reload'}));if(!response.ok)throw Error('Puuttuva tiedosto: '+path);await cache.put(path,response);}await self.skipWaiting();})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('traces-editorial-09-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',e=>{if(e.data?.type==='VERIFY')e.waitUntil((async()=>{try{const cache=await caches.open(CACHE);for(const file of FILES){const response=await cache.match(new URL(file,self.registration.scope).href);if(!response||!response.ok)throw Error('Puuttuva tiedosto: '+file);await response.arrayBuffer();}e.ports[0].postMessage({ok:true,count:FILES.length});}catch(error){e.ports[0].postMessage({ok:false,error:error.message});}})());});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const url=new URL(e.request.url);if(url.origin!==self.location.origin)return;e.respondWith((async()=>{const cache=await caches.open(CACHE);let response=await cache.match(e.request,{ignoreSearch:true});if(!response&&e.request.mode==='navigate'&&url.pathname===new URL('./',self.registration.scope).pathname)response=await cache.match(new URL('index.html',self.registration.scope).href);if(!response)return fetch(e.request);const range=e.request.headers.get('range');if(range){const bytes=await response.arrayBuffer(),m=/^bytes=(\\d+)-(\\d*)$/.exec(range);if(m){const start=Number(m[1]),end=Math.min(m[2]?Number(m[2]):bytes.byteLength-1,bytes.byteLength-1);if(start>end)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+bytes.byteLength}});return new Response(bytes.slice(start,end+1),{status:206,headers:{'Content-Type':response.headers.get('Content-Type')||'application/octet-stream','Content-Range':`bytes ${start}-${end}/${bytes.byteLength}`,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes'}});}}return response;})());});
""".replace('VERSION',version).replace('FILES_JSON',json.dumps(['./'+f for f in files]))
(root/'sw.js').write_text(sw)
# Full single-file animation: same rendering script, embedded images, no network fetches.
embedded_items=[]
for item in items:
 entry=dict(item);entry['image']='data:image/jpeg;base64,'+base64.b64encode((project/item['image'].replace('images/','frames/',1)).read_bytes()).decode();embedded_items.append(entry)
animation_js=(project/'animation.js').read_text()
animation_js=re.sub(r'const response\s*=\s*await fetch\(\s*JSON_URL,\s*\{\s*cache: "no-store"\s*\}\s*\);','const response={ok:true,json:async()=>window.PROJECT200_ITEMS};',animation_js)
assert 'await fetch(' not in animation_js
animation_html=(project/'animation.html').read_text()
animation_html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]+>','<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; object-src \'none\'">',animation_html)
animation_html=animation_html.replace('<script src="animation.js" defer></script>','')
animation_html=animation_html.replace('</body>','<script>window.PROJECT200_ITEMS='+json.dumps(embedded_items,ensure_ascii=False).replace('<','\\u003c')+';</script><script>'+animation_js.replace('</','<\\/')+'</script></body>')
base_data=json.loads(json.dumps(data))
for p in base_data['pages']:
 if p.get('image'):p['image']=data_uri(root/p['image'])
 for item in p.get('sequenceImages',[]):item['src']=data_uri(root/item['src'])
 if p.get('media') and p['media'].get('poster'):
  p['media']['poster']='data:image/jpeg;base64,'+base64.b64encode((root/p['media']['poster']).read_bytes()).decode()
base_html=(root/'index.html').read_text().replace('<link rel="manifest" href="manifest.webmanifest">','').replace('<script src="print-pages.js" defer></script>','')
base_html=base_html.replace('<link rel="stylesheet" href="styles.css">','<style>'+(root/'styles.css').read_text()+'</style>')
base_html=base_html.replace('<script src="content/edition.js" defer></script><script src="app.js" defer></script>','')
js=(root/'app.js').read_text().replace("if(!path || /^(?:[a-z]+:|\\/|\\\\)/i.test(path)","if(!path || (!(path.startsWith('data:image/jpeg;base64,') || path.startsWith('data:image/png;base64,') || path.startsWith('data:video/mp4;base64,')) && /^(?:[a-z]+:|\\/|\\\\)/i.test(path))")
js=js.replace("$('offline').onclick=async()=>{","$('offline').onclick=async()=>{if(location.protocol==='file:'){ $('status').textContent='Yhden tiedoston versio sisältää kuvat, panoraamatimelapsen ja 200-animaation paikallisesti. iPadin avaustapa on testattava laitteella.';return;}")
for full,name in [(False,'traces-between-still-offline.html'),(True,'traces-between-offline.html')]:
 edition=json.loads(json.dumps(base_data))
 if not full:
  for p in edition['pages']:
   if p.get('media'):p['media']['src']=None
 if full:
  for page in edition['pages']:
   if page.get('media',{}).get('type')=='video' and page['media'].get('src'):
    page['media']['src']='data:video/mp4;base64,'+base64.b64encode((root/page['media']['src']).read_bytes()).decode()
 boot='window.EDITION='+json.dumps(edition,ensure_ascii=False).replace('<','\\u003c')+';'
 if full:boot+='window.PROJECT200_SRCDOC='+json.dumps(animation_html,ensure_ascii=False).replace('<','\\u003c')+';'
 html=base_html.replace('</body>','<script>'+boot+'</script><script>'+js.replace('</','<\\/')+'</script><script>'+(root/'print-pages.js').read_text().replace('</','<\\/')+'</script></body>')
 (root/name).write_text(html)
# Distribute the runtime and editable source, not the untouched 230MB reference-image mirror.
with zipfile.ZipFile(root.parent/'traces-between-zine-09-offline.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(root.rglob('*')):
  if not p.is_file() or '__pycache__' in p.parts:continue
  rel=p.relative_to(root).as_posix()
  if rel.startswith(('reference/panorama-originals/','reference/panorama-frames/')):continue
  if rel.startswith('assets/project-200/') and not runtime_asset(p):continue
  if rel=='traces-between-offline.html':continue # linked separately; runtime remains fully offline
  z.write(p,Path('presentation-zine-09')/p.relative_to(root))
print(f'Built {len(files)} runtime files; {len(items)} animation images; version {version}.')
