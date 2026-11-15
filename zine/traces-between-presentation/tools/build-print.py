"""Generate matching A4 PDF and browser-print SVG sheets from one measured layout.
Requires reportlab and Pillow; all reading/writing is local. Existing editions stay intact.
"""
from pathlib import Path
import base64,html,json,hashlib,math,re
from PIL import Image,ImageOps
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader

R=Path(__file__).resolve().parents[1]
DATA=json.loads((R/'content/edition.json').read_text())
MM=72/25.4; W,H=297,210
FONTS={'serif':('Georgia','Georgia.ttf'),'italic':('GeorgiaItalic','Georgia Italic.ttf'),'sans':('Arial','Arial.ttf'),'bold':('ArialBold','Arial Bold.ttf')}
fontroot=Path('/System/Library/Fonts/Supplemental')
for name,(registered,file) in FONTS.items():pdfmetrics.registerFont(TTFont(registered,str(fontroot/file)))
PAPER='#eeece5';INK='#232620';MUTED='#6f7268';LINE='#c9c9bd';WHITE='#eeece5'

def text_width(value,font,size):return pdfmetrics.stringWidth(value,FONTS[font][0],size)/MM

def wrap(value,width,font,size):
 result=[]
 for paragraph in value.split('\n'):
  words=paragraph.split();line=''
  for word in words:
   candidate=(line+' '+word).strip()
   if line and text_width(candidate,font,size)>width:result.append(line);line=word
   else:line=candidate
  result.append(line)
 return result

class Sheet:
 def __init__(self,p,index,bg=PAPER):self.page=p;self.index=index;self.bg=bg;self.ink=WHITE if bg!=PAPER else INK;self.muted='#a7a99e' if bg!=PAPER else MUTED;self.objects=[];self.bounds=[]
 def line(self,x,y,width,color=None):self.objects.append({'type':'rule','x':x,'y':y,'width':width,'color':color or self.muted})
 def block(self,value,x,y,width,font='serif',size=9.3,leading=None,color=None,align='left',role='body'):
  leading=leading or size*1.25;lines=wrap(value,width,font,size);registered=FONTS[font][0];ascent,descent=pdfmetrics.getAscentDescent(registered,size)
  for i,value in enumerate(lines):
   baseline=y+ascent/MM+i*leading/MM;tw=text_width(value,font,size);xx=x+(width-tw if align=='right' else (width-tw)/2 if align=='center' else 0)
   self.objects.append({'type':'text','text':value,'x':xx,'baseline':baseline,'width':tw,'font':font,'size':size,'color':color or self.ink,'role':role})
   self.bounds.append({'role':role,'text':value,'x':xx,'y':baseline-ascent/MM,'width':tw,'height':(ascent-descent)/MM})
  return y+((len(lines)-1)*leading+ascent-descent)/MM
 def image(self,path,x,y,width,height):
  path=Path(path);path=path if path.is_absolute() else R/path
  with Image.open(path) as im:iw,ih=im.size
  scale=min(width/iw,height/ih);dw,dh=iw*scale,ih*scale;xx=x+(width-dw)/2;yy=y+(height-dh)/2
  self.objects.append({'type':'image','file':str(path.relative_to(R)),'x':xx,'y':yy,'width':dw,'height':dh,'pixelSize':[iw,ih]})
  self.bounds.append({'role':'image','x':xx,'y':yy,'width':dw,'height':dh})
 def footer(self):
  self.block('ARI RAPO · TRACES BETWEEN · 2026',14,201.5,220,'sans',6.3,color=self.muted,role='footer')
  self.block(f'{self.index:02d} / 09',260,201.5,23,'sans',6.3,color=self.muted,align='right',role='footer')
 def header(self,size=36):
  p=self.page;self.block(f"{self.index-1:02d} / {p['title'].upper()}",14,8,269,'sans',7.1,color=self.muted,role='marker')
  self.block(p['title'],14,13.2,269,'serif',size,leading=size,role='title')
  self.block(p['subtitle'],14,27.8,269,'sans',8.3,leading=10,role='subtitle')
 def columns(self,paragraphs,y,n,size=9.3,leading=11.3):
  gap=7;cw=(269-gap*(n-1))/n;bottom=y
  assert len(paragraphs)==n
  for i,value in enumerate(paragraphs):bottom=max(bottom,self.block(value,14+i*(cw+gap),y,cw,size=size,leading=leading))
  return bottom

# Print derivatives use the verified higher-resolution originals when available.
# A packaged rebuild can reuse the generated copies without the original-image mirror.
printassets=R/'assets/print';printassets.mkdir(exist_ok=True)
original_panos=R.parent/'presentation-zine-04/reference/panorama-originals'
original_200=R.parent/'presentation-zine-03/assets/project-200/images'
def prepare(source,name=None):
 source=Path(source);target=printassets/(name or source.name)
 if not target.exists():
  with Image.open(source) as im:
   image=ImageOps.exif_transpose(im).convert('RGB');image.thumbnail((3000,3000),Image.Resampling.LANCZOS);image.save(target,quality=94,optimize=True)
 return target.relative_to(R).as_posix()

photos={}
for p in DATA['pages']:
 if not p.get('image'):continue
 source=R/p['image'];name=source.name
 if p['id']=='aika':original=original_panos/'R0010140.jpeg';name='R0010140.jpeg'
 else:original=original_panos/name
 if original.exists():photos[p['id']]=prepare(original,name)
 else:photos[p['id']]=p['image']
sequence=next(p for p in DATA['pages'] if p['id']=='toisto')['sequenceImages']
sequence_photos=[]
for item in sequence:
 source=R/item['src'];original=original_200/source.name
 sequence_photos.append(prepare(original if original.exists() else source))

sheets=[]
for index,p in enumerate(DATA['pages'],1):
 id=p['id'];bg='#080908' if id in ['toisto','valissa'] else '#10120f' if id=='aika' else '#151811' if id=='teosperhe' else PAPER
 s=Sheet(p,index,bg);sheets.append(s)
 if id=='kansi':
  s.block('Traces',18,25,265,'serif',112,leading=112,role='title')
  s.block('Between',18,80,265,'italic',112,leading=112,align='right',role='title')
  s.line(20,146,257,LINE)
  s.block('JÄLKI · TOISTO · AIKA · MUISTI · VÄLISSÄ',20,151,257,'sans',8.2,role='subtitle')
  s.block(DATA['author'],20,172,200,'serif',20,role='author');s.block('2026',20,186,200,'sans',11,role='year');s.footer();continue
 if id=='toisto':
  s.block('02 / TOISTO',14,8,269,'sans',7.1,color=s.muted,role='marker')
  s.block('toisto',14,17,85,'italic',50,role='title')
  s.block(p['subtitle'],110,14,173,'sans',8.3,color=s.muted,role='subtitle')
  for ci,paras in enumerate([p['paragraphs'][:2],p['paragraphs'][2:]]):
   y=28
   for para in paras:y=s.block(para,110+ci*90,y,83,size=9.2,leading=11.2)+3
   assert y<68,(id,y)
  for path,x,diameter in zip(sequence_photos,[14,86,178],[62,82,100]):s.image(path,x,121-diameter/2,diameter,diameter)
  s.block(p['sequenceCaption'],92,181,191,'italic',17,leading=21,role='closing');s.footer();continue
 if id in ['teosperhe','valissa']:
  s.block(f"{index-1:02d} / {p['title'].upper()}",14,8,269,'sans',7.1,color=s.muted,role='marker')
  s.block(p['title'],14,16,106,'italic' if id=='teosperhe' else 'serif',39,role='title')
  bottom=s.block(p['subtitle'],14,40,96,'serif',17,leading=20,role='subtitle')+7
  for para in p['paragraphs'][:-1]:bottom=s.block(para,14,bottom,96,size=10,leading=12.5)+3
  assert bottom<143,(id,bottom)
  s.image(photos[id],123,34,160,155)
  s.block(p['paragraphs'][-1],14,151,96,'italic',17,leading=21,role='closing');s.footer();continue
 s.header(size=34 if id in ['tekijyys','tutkimus'] else 36)
 s.image(photos[id],23.5,34,250,125)
 if id=='tekijyys':
  bottom=s.columns(p['paragraphs'][1:],165,4,size=8.8,leading=10.6);assert bottom<188,(id,bottom)
  s.line(14,190,269,LINE)
  years=[year.strip() for year in p['paragraphs'][0].split('→')]
  for i,year in enumerate(years):s.block(year,14+i*269/6,193,269/6,'serif',15.5,align='center',role='chronology')
 else:
  bottom=s.columns(p['paragraphs'][:-1],165,3,size=9.1,leading=11);assert bottom<182,(id,bottom)
  s.block(p['paragraphs'][-1],14,183,269,'italic',13,leading=15,role='closing')
  if id=='tutkimus':
   s.block(p['researchPathLabel'].upper(),14,190,269,'sans',6.8,color=s.muted,role='research-label')
   for i,stage in enumerate(p['researchStages']):
    x=14+i*269/3;s.block(stage['year']+' · '+stage['institution'],x,194,86,'sans',7.2,color=s.muted,role='research-year')
    s.block(stage['topics'],x,197.8,86,'serif',8.1,role='research-topic')
 s.footer()

# All three outputs use these same objects, positions, fonts and line breaks.
layout={'pageSizeMM':[W,H],'edition':'2026','sourceContentSha256':hashlib.sha256((R/'content/edition.json').read_bytes()).hexdigest(),'pages':[]}
for s in sheets:
 for box in s.bounds:
  assert box['x']>=6 and box['y']>=6,(s.page['id'],box)
  assert box['x']+box['width']<=291,(s.page['id'],box)
  assert box['y']+box['height']<=205.5,(s.page['id'],box)
 layout['pages'].append({'id':s.page['id'],'background':s.bg,'objects':s.objects,'bounds':s.bounds})
(R/'reference/print-layout.json').write_text(json.dumps(layout,ensure_ascii=False,indent=2)+'\n')

pdf=R/'traces-between-A4-2026.pdf';c=canvas.Canvas(str(pdf),pagesize=(W*MM,H*MM),pageCompression=1)
c.setTitle('TRACES BETWEEN — Ari Rapo — 2026');c.setAuthor(DATA['author']);c.setSubject('Kuvallinen essee · A4-vaaka · 9 sivua')
for s in sheets:
 c.setFillColor(HexColor(s.bg));c.rect(0,0,W*MM,H*MM,fill=1,stroke=0)
 for o in s.objects:
  if o['type']=='image':c.drawImage(ImageReader(str(R/o['file'])),o['x']*MM,(H-o['y']-o['height'])*MM,width=o['width']*MM,height=o['height']*MM,mask='auto')
  elif o['type']=='rule':c.setStrokeColor(HexColor(o['color']));c.setLineWidth(.18*MM);c.line(o['x']*MM,(H-o['y'])*MM,(o['x']+o['width'])*MM,(H-o['y'])*MM)
  else:
   c.setFillColor(HexColor(o['color']));c.setFont(FONTS[o['font']][0],o['size']);c.drawString(o['x']*MM,(H-o['baseline'])*MM,o['text'])
 c.showPage()
c.save()

font_css={'serif':('Georgia','normal','normal'),'italic':('Georgia','italic','normal'),'sans':('Arial','normal','normal'),'bold':('Arial','normal','bold')}
fragments=[]
for s in sheets:
 parts=[f'<section class="print-sheet" aria-label="{html.escape(s.page["title"])}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 297 210" width="297mm" height="210mm" role="img" aria-label="{html.escape(s.page["title"])}"><rect width="297" height="210" fill="{s.bg}"/>']
 for o in s.objects:
  if o['type']=='image':
   path=R/o['file'];mime='image/png' if path.suffix.lower()=='.png' else 'image/jpeg';uri='data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()
   parts.append(f'<image x="{o["x"]:.5f}" y="{o["y"]:.5f}" width="{o["width"]:.5f}" height="{o["height"]:.5f}" href="{uri}" preserveAspectRatio="xMidYMid meet"/>')
  elif o['type']=='rule':parts.append(f'<path d="M {o["x"]} {o["y"]} h {o["width"]}" stroke="{o["color"]}" stroke-width=".18" fill="none"/>')
  else:
   family,style,weight=font_css[o['font']];length=f' textLength="{o["width"]:.5f}" lengthAdjust="spacingAndGlyphs"' if o['text'] else ''
   parts.append(f'<text x="{o["x"]:.5f}" y="{o["baseline"]:.5f}" font-family="{family}" font-size="{o["size"]/MM:.5f}" font-style="{style}" font-weight="{weight}" fill="{o["color"]}"{length}>{html.escape(o["text"])}</text>')
 parts.append('</svg></section>');fragments.append(''.join(parts))
markup=''.join(fragments)
(R/'print-pages.js').write_text("'use strict';\ndocument.getElementById('print-pages').innerHTML="+json.dumps(markup,ensure_ascii=False).replace('<','\\u003c')+';\n')
print_html='''<!doctype html><html lang="fi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TRACES BETWEEN · A4 · 2026</title><link rel="stylesheet" href="styles.css"><style>@media screen{body{background:#bbb}#print-pages{display:block}.print-sheet{width:min(297mm,100%);margin:1rem auto;line-height:0;box-shadow:0 1px 10px #0003}.print-sheet svg{display:block;width:100%;height:auto}.print-controls{padding:1rem;display:flex;gap:1rem;align-items:center}}</style><script src="print-pages.js" defer></script></head><body><nav class="print-controls"><button onclick="window.print()">Tulosta A4</button><a href="traces-between-A4-2026.pdf">Lataa PDF</a><a href="index.html">Takaisin zineen</a></nav><main id="print-pages"></main></body></html>'''
(R/'print.html').write_text(print_html)
print('Created nine A4 landscape sheets, matching SVG browser-print pages and PDF.')
print('Print PDF bytes:',pdf.stat().st_size,'; inline print markup:',len(markup))
