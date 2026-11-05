"""Verify palette controls, persistence and actual image bytes in Chromium."""
import json, subprocess, xml.etree.ElementTree as ET
import verify_topology_v2_browser as b
b.SESSION='topo-generic-palette'
OUT=b.OUT; FILES=OUT/'verification/palettes';FILES.mkdir(exist_ok=True)
js,command,require=b.js,b.command,b.require
checks=[]
def record(name,ok=True):
    require(ok,name);checks.append(name);print('Passed: '+name,flush=True)
def main():
    subprocess.run([str(b.BROWSER),'--session',b.SESSION,'open',(OUT/'index.html').as_uri()],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=45,check=True)
    command('set','viewport','1680','1100');command('open',(OUT/'index.html').as_uri());js('(async()=>{await document.fonts.ready})()');b.instrument()
    original=js('JSON.stringify(sampleBook.state.scene)')
    for theme in ['light','dark']:
        js(f"sampleBook.state.theme={json.dumps(theme)};sampleBook.render()")
        for palette in ['ocean','forest','violet','copper','graphite','categories']:
            command('select','#icon-palette',palette)
            data=js("""(()=>{const n=document.querySelector('#drawing .node'),p=TopologyScene.iconPalette(sampleBook.state.scene.icon_palette,sampleBook.state.theme);return {id:n.dataset.iconPalette,ink:n.style.getPropertyValue('--glyph-ink'),disc:n.querySelector('.node-disc').getAttribute('fill'),want:p,facts:JSON.stringify({...sampleBook.state.scene,icon_palette:undefined})}})()""")
            require(data['id']==palette and data['ink']==data['want']['ink'] and data['disc']==data['want']['disc'],f'{theme}/{palette} control mismatch')
            require(json.loads(data['facts'])=={k:v for k,v in json.loads(original).items() if k!='icon_palette'},'Palette changed topology facts')
    record('All six palettes switch actual icons in light and dark without changing topology')
    command('click','#compare')
    record('Comparison renders matching palette variants in both themes',js("document.querySelectorAll('#drawing svg[data-icon-palette=categories]').length===2&&new Set([...document.querySelectorAll('#drawing .node')].map(n=>n.style.getPropertyValue('--glyph-ink'))).size===2"))
    command('click','#compare');command('click','#edit');command('select','#editor-selection','node|dist-0');command('select','#node-palette','violet')
    record('Selected device overrides the whole-diagram palette',js("document.querySelector('[data-node-id=\"dist-0\"]').dataset.iconPalette==='violet'&&document.querySelector('[data-node-id=\"dist-1\"]').dataset.iconPalette==='categories'"))
    command('click','#editor-undo')
    record('Undo restores inheritance',js("document.querySelector('[data-node-id=\"dist-0\"]').dataset.iconPalette==='categories'"))
    command('click','#editor-redo')
    record('Redo restores override',js("document.querySelector('[data-node-id=\"dist-0\"]').dataset.iconPalette==='violet'"))
    command('select','#editor-selection','node|dist-0');command('select','#node-palette','inherit')
    record('Explicit inheritance removes node override',js("!TopologyScene.resolve(sampleBook.state.scene,'overview').nodes.find(n=>n.id==='dist-0').icon_palette"))
    command('select','#node-palette','forest');command('click','[data-view=engineering]')
    record('Node override is scoped to its view',js("document.querySelector('[data-node-id=\"dist-0\"]').dataset.iconPalette==='categories'"))
    command('select','#icon-palette','copper')
    record('Whole-diagram palette applies across views',js("sampleBook.state.scene.icon_palette==='copper'&&document.querySelector('[data-node-id=\"dist-0\"]').dataset.iconPalette==='copper'"))
    command('click','[data-view=overview]')
    expected=js('JSON.stringify(sampleBook.state.scene)')
    model=b.export_blob('#export-json',FILES/'palette-model.json');page=b.export_blob('#save-html',FILES/'palette-book.html')
    require(json.loads((FILES/'palette-model.json').read_text(encoding='utf-8'))==json.loads(expected),'JSON mismatch')
    record('Saved JSON includes whole-diagram and per-view node palettes')
    command('open',(FILES/'palette-book.html').as_uri());js('(async()=>{await document.fonts.ready})()');b.instrument()
    record('Editable HTML reopens in view mode with the same palette and model',js('JSON.stringify(sampleBook.state.scene)')==expected and not js('sampleBook.editor.enabled') and js("document.querySelector('[data-node-id=\"dist-0\"]').dataset.iconPalette==='forest'"))
    command('click','#edit');command('select','#editor-selection','node|dist-0');command('select','#node-palette','graphite')
    command('upload','#import-json',str(FILES/'palette-model.json'))
    record('JSON import restores palette choices',js('JSON.stringify(sampleBook.state.scene)')==expected)
    svg=b.export_blob('#export-svg',FILES/'palette.svg');png=b.export_blob('#export-png',FILES/'palette.png')
    tree=ET.parse(FILES/'palette.svg');ns={'s':'http://www.w3.org/2000/svg'}
    node=next(n for n in tree.findall('.//s:g',ns) if n.attrib.get('data-node-id')=='dist-0')
    record('Standalone SVG embeds selected palette without editor overlays','--glyph-ink:#FFF0DE' in ET.tostring(tree.getroot(),encoding='unicode') and node.attrib['data-icon-palette']=='forest' and not tree.findall('.//*[@class="editor-overlay"]'))
    command('open',(FILES/'palette.svg').as_uri())
    record('Standalone SVG reopens',bool(js('!!document.querySelector("svg")')))
    command('open',(FILES/'palette.png').as_uri())
    record('PNG is a decoded standalone image',js('document.images[0].complete&&document.images[0].naturalWidth===1600'))
    command('open',(FILES/'palette-book.html').as_uri());command('set','offline','on');command('reload')
    command('select','#icon-palette','graphite')
    record('Palette selection and fonts work fully offline',js("document.querySelector('#drawing svg').dataset.iconPalette==='graphite'&&!performance.getEntriesByType('resource').some(r=>/^https?:/.test(r.name))"))
    command('set','viewport','390','844');command('click','#edit');command('select','#editor-selection','node|dist-0');command('select','#node-palette','violet')
    record('Global and device controls work at 390px width',js("document.documentElement.scrollWidth<=390&&document.querySelector('#node-palette').value==='violet'"))
    command('screenshot',str(FILES/'mobile-palette.png'),'--full')
    command('set','offline','off');command('set','viewport','1680','1100');command('screenshot',str(FILES/'desktop-palette.png'),'--full')
    report={'passed':True,'checks':checks,'exports':{'model':model,'html':page,'svg':svg,'png':png}}
    (FILES/'palette-browser-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'passed':True,'checks':len(checks)}))
if __name__=='__main__':
    try:main()
    finally:
        try:command('close')
        except Exception:pass
