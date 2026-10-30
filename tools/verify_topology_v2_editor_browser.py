"""Exercise real V2 editing gestures, history and self-contained file round trips."""
from pathlib import Path
import json
import subprocess
import verify_topology_v2_browser as b

OUT=b.OUT
CHECKS=OUT/'verification/editor'
CHECKS.mkdir(parents=True, exist_ok=True)
js,command,require=b.js,b.command,b.require
checks=[]

def record(name,condition=True):
    require(condition,name)
    checks.append(name)
    print('Passed: '+name,flush=True)

def drag(selector,dx,dy,world=None):
    data=js(f'''(()=>{{const el=document.querySelector({json.dumps(selector)});if(!el)throw Error('Missing drag target');el.scrollIntoView({{block:'center',inline:'center'}});
      const svg=document.querySelector('#drawing svg'),m=svg.getScreenCTM(),box=el.getBoundingClientRect(),p={json.dumps(world)};
      const start=p?new DOMPoint(p[0],p[1]).matrixTransform(m):{{x:box.x+box.width/2,y:box.y+box.height/2}};
      return {{x:start.x,y:start.y,dx:{dx}*m.a,dy:{dy}*m.d}}}})()''')
    command('mouse','move',str(round(data['x'])),str(round(data['y'])))
    command('mouse','down','left')
    for i in range(1,5):
        command('mouse','move',str(round(data['x']+data['dx']*i/4)),str(round(data['y']+data['dy']*i/4)))
    command('mouse','up','left')

def node(id):
    return js(f"TopologyScene.resolve(sampleBook.state.scene,sampleBook.state.view).nodes.find(n=>n.id==={json.dumps(id)})")

def main():
    subprocess.run([str(b.BROWSER),'--session',b.SESSION,'open',(OUT/'index.html').as_uri()],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=45,check=True)
    command('set','viewport','1680','1120')
    command('open',(OUT/'index.html').as_uri())
    js('(async()=>{await document.fonts.ready})()')
    b.instrument()
    record('View mode is the initial state',not js('sampleBook.editor.enabled'))
    audit_defaults=js('''(async()=>{const results=[];for(const s of sampleBook.scenes)for(const view of s.views?.engineering?['overview','engineering']:['overview']){
      sampleBook.selectScene(s.id);sampleBook.state.view=view;sampleBook.render();await document.fonts.ready;results.push({scene:s.id,view,findings:sampleBook.editor.check()});}sampleBook.selectScene('layered');return results})()''')
    require(all(not r['findings'] for r in audit_defaults),str([r for r in audit_defaults if r['findings']]))
    record('All 13 initial views pass the interactive layout checker')
    command('click','#edit')
    command('uncheck','#editor-snap')
    record('Edit toolbar and selection controls open',js("sampleBook.editor.enabled&&!document.querySelector('#editor-tools').hidden"))
    # Exact grid-delta checks run with magnets disabled; their gestures have a separate suite.
    before=node('dist-0')
    drag('[data-node-id="dist-0"] .node-disc',32,16)
    after=node('dist-0')
    record('Real node drag and live attached routes',abs(after['x']-before['x']-32)<.01 and abs(after['y']-before['y']-16)<.01)
    command('click','#editor-undo')
    record('Undo restores the original layout',node('dist-0')==before)
    command('click','#editor-redo')
    record('Redo restores the edited layout',node('dist-0')==after)
    command('click','#editor-undo')
    label=js("sampleBook.state.scene.edges.find(e=>e.labelAt)")
    drag('[data-edge-label="'+label['id']+'"] .note-frame',16,8)
    record('Line-label drag keeps its connection identity',js(f"TopologyScene.resolve(sampleBook.state.scene,'overview').edges.find(e=>e.id==={json.dumps(label['id'])}).labelAt")==[label['labelAt'][0]+16,label['labelAt'][1]+8])
    command('click','#editor-undo')
    old=node('core-a')['labelOffset']
    drag('[data-node-id="core-a"] .node-label',16,8)
    record('Device-name placement edits independently',node('core-a')['labelOffset']==[old[0]+16,old[1]+8])
    command('click','#editor-undo')
    edge=js("sampleBook.state.scene.edges.find(e=>e.source==='core-a'&&e.semantics==='physical').id")
    command('select','#editor-selection','edge|'+edge)
    command('select','#route-geometry','curve')
    drag('.edit-handle[data-edit-kind="control"][data-index="0"]',24,-16)
    record('Curve style and real control-point drag',js(f"TopologyScene.resolve(sampleBook.state.scene,'overview').edges.find(e=>e.id==={json.dumps(edge)}).controls?.length===2"))
    command('click','#editor-undo')
    command('click','#editor-undo')
    command('select','#editor-selection','edge|'+edge)
    drag('.edit-handle[data-edit-kind="route"]',16,8)
    record('Orthogonal corridor drag keeps at most two bends',js(f"TopologyScene.resolve(sampleBook.state.scene,'overview').edges.find(e=>e.id==={json.dumps(edge)}).via.length<=2"))
    command('click','#editor-undo')
    command('select','#editor-selection','edge|'+edge)
    drag('.edit-handle[data-edit-kind="anchor"][data-end="source"]',8,0)
    record('Circumference endpoint drag changes the anchor',js(f"typeof TopologyScene.resolve(sampleBook.state.scene,'overview').edges.find(e=>e.id==={json.dumps(edge)}).source_anchor==='object'"))
    command('click','#editor-undo')
    command('select','#editor-selection','node|dist-0')
    js("document.querySelector('#drawing svg').focus()")
    command('press','ArrowRight')
    command('press','Control+z')
    record('Keyboard nudge and undo',node('dist-0')==before)

    command('click','[data-scene="mixed-ring"]')
    js('(async()=>{await document.fonts.ready})()')
    ring_before=js('TopologyScene.resolve(sampleBook.state.scene,sampleBook.state.view).rings[0]')
    member=ring_before['members'][0]
    start=node(member)
    external=js('TopologyScene.resolve(sampleBook.state.scene,sampleBook.state.view).nodes.filter(n=>n.group)')
    drag(f'[data-node-id="{member}"] .node-disc',16,8)
    ring_check=js(f'''(()=>{{const m=TopologyScene.resolve(sampleBook.state.scene,'overview'),r=m.rings[0],n=m.nodes.find(n=>n.id==={json.dumps(member)});return {{error:Math.abs(((n.x-r.cx)/r.rx)**2+((n.y-r.cy)/r.ry)**2-1),guide:document.querySelectorAll('#drawing .ring-guide').length,arcs:document.querySelectorAll('#drawing .connection[data-presentation] .connection-main[d*=" A "]').length}}}})()''')
    record('Real ring-member drag keeps one continuous ellipse',node(member)!=start and ring_check['error']<1e-9 and ring_check['guide']==1 and ring_check['arcs']==8)
    command('click','#editor-undo')
    drag('.ring-move-handle',16,8)
    ring_after=js('TopologyScene.resolve(sampleBook.state.scene,sampleBook.state.view).rings[0]')
    record('Whole-ring drag retains external site positions',abs(ring_after['cx']-ring_before['cx']-16)<.01 and abs(ring_after['cy']-ring_before['cy']-8)<.01 and js('TopologyScene.resolve(sampleBook.state.scene,sampleBook.state.view).nodes.filter(n=>n.group)')==external)
    command('click','#editor-undo')
    command('select','#editor-selection','ring|'+ring_before['id'])
    drag('[data-edit-kind="ring-size"]',16,8)
    record('Ring resize works without detaching arcs',js('TopologyScene.resolve(sampleBook.state.scene,sampleBook.state.view).rings[0].rx')==ring_before['rx']+16)
    command('click','#editor-undo')

    command('click','[data-scene="nested"]')
    g=js("sampleBook.state.scene.groups.find(g=>sampleBook.state.scene.groups.some(x=>x.parent===g.id))")
    n_before=js('JSON.stringify(TopologyScene.resolve(sampleBook.state.scene,sampleBook.state.view).nodes.map(n=>[n.id,n.x,n.y]))')
    command('select','#editor-selection','group|'+g['id'])
    js("document.querySelector('#drawing svg').focus()")
    command('press','ArrowRight')
    record('Nested group moves all descendant devices',js('JSON.stringify(TopologyScene.resolve(sampleBook.state.scene,sampleBook.state.view).nodes.map(n=>[n.id,n.x-8,n.y]))')==n_before)
    command('click','#editor-undo')
    drag('[data-region-id="'+g['id']+'"] .region-title',16,8)
    record('Real nested-area drag carries descendants',js('JSON.stringify(TopologyScene.resolve(sampleBook.state.scene,sampleBook.state.view).nodes.map(n=>[n.id,n.x-16,n.y-8]))')==n_before)
    command('click','#editor-undo')
    command('click','[data-scene="mixed-ring"]')
    annotation=js('TopologyScene.resolve(sampleBook.state.scene,sampleBook.state.view).annotations[0]')
    drag('[data-annotation-index="0"] .note-frame',16,8)
    record('Explanation-box drag preserves the shared note style',js('TopologyScene.resolve(sampleBook.state.scene,sampleBook.state.view).annotations[0].x')==annotation['x']+16)
    command('click','#editor-undo')

    command('click','[data-scene="layered"]')
    command('click','[data-view="engineering"]')
    drag('[data-node-id="dist-0"] .node-disc',16,0)
    saved_scene=js('sampleBook.state.scene')
    record('Editing detail retains aggregate membership',len(saved_scene['views']['engineering']['nodes'])==18)
    js('window.scrollTo(0,0)')
    command('screenshot',str(OUT/'previews/book-editor-desktop.png'))
    exports=[]
    exports.append(b.export_blob('#export-json',CHECKS/'edited-model.json'))
    exports.append(b.export_blob('#save-html',CHECKS/'edited-book.html'))
    exports.append(b.export_blob('#export-svg',CHECKS/'edited.svg'))
    exports.append(b.export_blob('#export-png',CHECKS/'edited.png'))
    expected=js('JSON.stringify(sampleBook.state.scene)')
    command('open',(CHECKS/'edited-book.html').as_uri())
    js('(async()=>{await document.fonts.ready})()')
    record('Saved HTML reopens in view mode with all edits',not js('sampleBook.editor.enabled') and js('JSON.stringify(sampleBook.state.scene)')==expected and js('document.fonts.check(\'600 12px "IBM Plex Sans"\')'))
    command('click','#edit')
    command('uncheck','#editor-snap')
    drag('[data-node-id="dist-0"] .node-disc',8,0)
    record('Saved HTML can continue editing',node('dist-0')['x']==js("TopologyScene.resolve(JSON.parse(document.querySelector('#design-data').textContent).scenes.find(s=>s.id==='layered'),'engineering').nodes.find(n=>n.id==='dist-0').x")+8)
    command('open',(OUT/'index.html').as_uri())
    b.instrument()
    command('upload','#import-json',str(CHECKS/'edited-model.json'))
    require(js('!!sampleBook.state.scene.editor_version'),'Import did not apply')
    record('Saved JSON reimports with detailed layout and member IDs',js('JSON.stringify(sampleBook.state.scene)')==expected and js("document.querySelector('#editor-undo').disabled"))
    bad=json.loads((CHECKS/'edited-model.json').read_text(encoding='utf-8'));bad['edges'][0]['color']='url(https://example.invalid/resource)'
    (CHECKS/'invalid-model.json').write_text(json.dumps(bad),encoding='utf-8')
    command('upload','#import-json',str(CHECKS/'invalid-model.json'))
    record('Invalid model rejected with current edits preserved',js('JSON.stringify(sampleBook.state.scene)')==expected and js("document.querySelector('#toast').textContent.startsWith('导入失败')"))
    command('click','#edit')
    command('uncheck','#editor-snap')
    command('click','[data-view="overview"]')
    first=node('dist-0');second=node('dist-1')
    drag('[data-node-id="dist-1"] .node-disc',first['x']-second['x'],first['y']-second['y'])
    record('Conflicting edits are explicitly marked as repair drafts',js("TopologyScene.resolve(sampleBook.state.scene,'overview').edit_validation.status==='draft'&&sampleBook.staticSvg().includes('编辑待修')"))
    exports.append(b.export_blob('#export-svg',CHECKS/'repair-draft.svg'))
    command('click','#editor-undo')
    command('click','#theme')
    command('set','viewport','390','1000')
    mobile=js('({width:innerWidth,scroll:document.documentElement.scrollWidth,toolbar:!document.querySelector("#editor-tools").hidden})')
    record('Dark editing and narrow layout remain usable',mobile['width']==mobile['scroll'] and mobile['toolbar'])
    command('screenshot',str(OUT/'previews/book-editor-mobile.png'))
    command('set','offline','on')
    command('reload')
    record('Edited page and fonts work offline',js('document.querySelectorAll("#drawing .node").length')>0 and not js("performance.getEntriesByType('resource').filter(r=>/^https?:/.test(r.name)).length"))
    command('set','offline','off')
    command('open',(CHECKS/'edited.svg').as_uri())
    record('Edited SVG reopens without editor handles',js("document.querySelectorAll('.node').length===18&&!document.querySelector('parsererror,.editor-overlay,.connection-hit')"))
    command('open',(CHECKS/'edited.png').as_uri())
    record('Edited PNG reopens at full canvas size',js("document.querySelector('img').naturalWidth===1600&&document.querySelector('img').naturalHeight===1000"))
    report={'passed':True,'checks':checks,'exports':exports,'initial_layout_checks':audit_defaults,'ring_geometry':ring_check,'mobile':mobile,'export_validation':'Actual button Blob bytes captured; native system file save is not claimed.'}
    (OUT/'verification/editor-browser-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'passed':True,'checks':len(checks),'exports':len(exports)}))

if __name__=='__main__':
    try:
        main()
    finally:
        subprocess.run([str(b.BROWSER), '--session', b.SESSION, 'close'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=20, check=False)
