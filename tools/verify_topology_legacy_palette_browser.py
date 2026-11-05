"""Legacy global palette controls, history and standalone export verification."""
import json,subprocess,sys,xml.etree.ElementTree as ET
from pathlib import Path
import verify_topology_v2_browser as b
b.SESSION='topo-generic-legacy-palette';root=Path(__file__).resolve().parent.parent
skill=root if (root/'SKILL.md').is_file() else root/'render-network-topology'
FILES=b.OUT/'verification/legacy-palettes';FILES.mkdir(exist_ok=True)
js,command,require=b.js,b.command,b.require
checks=[]
def record(name,ok=True):require(ok,name);checks.append(name);print('Passed: '+name,flush=True)
def main():
    subprocess.run([sys.executable,str(skill/'scripts/render_topology.py'),str(skill/'examples/network-topology.json'),'--output',str(FILES/'legacy.html')],check=True)
    subprocess.run([str(b.BROWSER),'--session',b.SESSION,'open',(FILES/'legacy.html').as_uri()],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=45,check=True)
    command('open',(FILES/'legacy.html').as_uri());js('(async()=>{await document.fonts.ready})()');b.instrument()
    palettes=json.loads((skill/'assets/icon-palettes.json').read_text(encoding='utf-8'))['palettes']
    for theme in ['light','dark']:
        if js("document.querySelector('.app').dataset.theme")!=theme:command('click','[data-action=theme]')
        for palette in palettes:
            command('select','#icon-palette',palette)
            fill=js("getComputedStyle(document.querySelector('.node.glyph .node-disc')).fill")
            h=palettes[palette][theme]['disc'].lstrip('#');want='rgb('+', '.join(str(int(h[i:i+2],16)) for i in [0,2,4])+')'
            require(fill==want,f'{theme}/{palette} actual disc {fill} != {want}')
    record('All six legacy palettes render matching light/dark discs')
    command('click','[data-action=edit]');command('select','#icon-palette','violet');command('click','[data-action=undo]')
    record('Legacy palette undo restores inherited colors',js("document.querySelector('.app').dataset.iconPalette==='categories'&&document.querySelector('#icon-palette').value==='categories'"))
    command('click','[data-action=redo]')
    record('Legacy palette redo restores selection',js("document.querySelector('.app').dataset.iconPalette==='violet'"))
    b.export_blob('[data-action=save-json]',FILES/'legacy-model.json');b.export_blob('[data-action=save-html]',FILES/'legacy-saved.html')
    m=json.loads((FILES/'legacy-model.json').read_text(encoding='utf-8'))
    record('Legacy JSON preserves palette and theme',m['canvas']['icon_palette']=='violet' and m['canvas']['theme']=='dark')
    command('open',(FILES/'legacy-saved.html').as_uri());js('(async()=>{await document.fonts.ready})()');b.instrument()
    record('Saved legacy HTML restores matching palette and picker',js("document.querySelector('.app').dataset.iconPalette==='violet'&&document.querySelector('#icon-palette').value==='violet'"))
    svg=b.export_blob('[data-action=svg]',FILES/'legacy.svg');png=b.export_blob('[data-action=png]',FILES/'legacy.png')
    ET.parse(FILES/'legacy.svg')
    pixel=js("""(async()=>{const image=await createImageBitmap(window.__v2Capture.at(-1).blob),c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const m=JSON.parse(document.querySelector('#topology-model').textContent),n=m.nodes.find(n=>document.querySelector('.node.glyph[data-node-id="'+n.id+'"]'));return {rgba:[...ctx.getImageData(Math.round((n.x+30)*2),Math.round(n.y*2),1,1).data],width:image.width,want:m.canvas.width*2}})()""")
    want=[int(palettes['violet']['dark']['disc'][i:i+2],16) for i in [1,3,5]]+[255]
    record('Legacy PNG contains resolved palette pixels',pixel['rgba']==want and pixel['width']==pixel['want'])
    command('open',(FILES/'legacy.svg').as_uri());record('Legacy standalone SVG reopens',js('!!document.querySelector("svg")'))
    command('open',(FILES/'legacy.png').as_uri());record('Legacy standalone PNG decodes',js('document.images[0].naturalWidth>0'))
    (FILES/'legacy-palette-browser-checks.json').write_text(json.dumps({'passed':True,'checks':checks,'svg':svg,'png':png},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'passed':True,'checks':len(checks)}))
if __name__=='__main__':
    try:main()
    finally:
        try:command('close')
        except Exception:pass
