"""Check proximity magnets through real pointer and keyboard input, including saved files."""
import json
import hashlib
import math
import subprocess
import xml.etree.ElementTree as ET
import verify_topology_v2_browser as b

OUT=b.OUT
CHECKS=OUT/'verification/snapping'
CHECKS.mkdir(parents=True, exist_ok=True)
js,command,require=b.js,b.command,b.require
checks=[]

def record(name,condition=True):
    require(condition,name)
    checks.append(name)
    print('Passed: '+name,flush=True)

def model():
    return js('TopologyScene.resolve(sampleBook.state.scene,sampleBook.state.view)')

def node(id):
    return js(f'TopologyScene.resolve(sampleBook.state.scene,sampleBook.state.view).nodes.find(n=>n.id==={json.dumps(id)})')

def begin(selector):
    data=js(f'''(()=>{{const el=document.querySelector({json.dumps(selector)});el.scrollIntoView({{block:'center',inline:'center'}});const b=el.getBoundingClientRect();return {{x:b.x+b.width/2,y:b.y+b.height/2}}}})()''')
    command('mouse','move',str(round(data['x'])),str(round(data['y'])))
    command('mouse','down','left')

def move(x,y):
    p=js(f'''(()=>{{const s=document.querySelector('#drawing svg'),p=new DOMPoint({x},{y}).matrixTransform(s.getScreenCTM());return {{x:p.x,y:p.y}}}})()''')
    command('mouse','move',str(round(p['x'])),str(round(p['y'])))

def end():
    command('mouse','up','left')

def status():
    return js('''(()=>{const s=document.querySelector('#drawing svg'),m=s.getScreenCTM(),b=s.getBoundingClientRect();return {active:s.querySelector('.editor-overlay')?.dataset.snapActive||'',guides:s.querySelectorAll('.edit-snap-guide,.edit-snap-point').length,xScale:Math.hypot(m.a,m.b),yScale:Math.hypot(m.c,m.d),top:b.y,bodyWidth:document.documentElement.scrollWidth}})()''')

def angle():
    return js("TopologyScene.resolve(sampleBook.state.scene,'overview').edges.find(e=>e.id==='core-dist-0').source_anchor.angle")

def endpoint():
    return '.edit-handle[data-edit-kind="anchor"][data-end="source"]'

def select_edge():
    command('select','#editor-selection','edge|core-dist-0')

def main():
    subprocess.run([str(b.BROWSER),'--session',b.SESSION,'open',(OUT/'index.html').as_uri()],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True,timeout=45)
    command('set','viewport','1680','1120')
    command('open',(OUT/'index.html').as_uri())
    js('(async()=>{await document.fonts.ready})()')
    b.instrument()
    command('click','#edit')
    select_edge()
    record('Magnets default on and both circle endpoints show eight noninteractive ports',js("document.querySelector('#editor-snap').checked&&document.querySelectorAll('.edit-snap-port').length===16&&getComputedStyle(document.querySelector('.edit-snap-port')).pointerEvents==='none'"))
    n=node('core-a')
    for i in range(8):
        select_edge();begin(endpoint())
        scale=status()['xScale']
        a=i*math.pi/4+2/(42*scale)
        move(n['x']+42*math.cos(a),n['y']+42*math.sin(a))
        require(abs(angle()-i*45)<1e-8,f'Port {i} did not snap: {angle()}')
        require(status()['guides']>0,'Missing endpoint feedback')
        end()
        require(status()['guides']==0,'Guides persisted after release')
        command('click','#editor-undo')
    record('Actual endpoint drags acquire all eight directions and clear their guides on release')

    # Maintain a held point between 5 and 8 CSS pixels, release outside 8.
    scale_checks=[]
    for zoom in ['fit','enlarged']:
        if zoom=='enlarged':command('click','#zoom-in')
        select_edge();begin(endpoint());s=status();scale=s['xScale']
        def at_distance(d):
            a=2*math.asin(d/(84*scale));move(n['x']+42*math.cos(a),n['y']+42*math.sin(a))
        at_distance(3.5);require(abs(angle())<1e-8,'Acquire threshold')
        held_top=status()['top']
        at_distance(6.5);require(abs(angle())<1e-8,'Hysteresis did not hold')
        require(abs(status()['top']-held_top)<.01,'Status caused SVG reflow')
        at_distance(10);require(abs(angle())>1 and status()['guides']==0,'Magnet failed to release')
        scale_checks.append({'zoom':zoom,'screen_scale':scale,'acquire':True,'hold':True,'release':True})
        end();command('click','#editor-undo')
    record('Real fit and enlarged gestures retain the same screen-distance feel without toolbar reflow',scale_checks[1]['screen_scale']>scale_checks[0]['screen_scale'])
    command('click','#zoom-fit')

    select_edge();begin(endpoint());s=status();a=3/(42*s['xScale']);move(n['x']+42*math.cos(a),n['y']+42*math.sin(a));require(abs(angle())<1e-8,'Setup did not snap')
    command('keydown','Alt')
    record('Alt immediately bypasses a held magnet without requiring pointer movement',abs(angle())>.1 and status()['guides']==0)
    command('keyup','Alt')
    record('Releasing Alt reacquires the nearby point',abs(angle())<1e-8 and status()['guides']>0)
    end();command('click','#editor-undo')
    command('uncheck','#editor-snap');select_edge();begin(endpoint());a=23.25*math.pi/180;move(n['x']+42*math.cos(a),n['y']+42*math.sin(a));free_angle=angle()
    record('The global switch disables magnets and leaves continuous free angles',abs(free_angle-23.25)<2 and abs(free_angle/5-round(free_angle/5))>.02 and status()['guides']==0)
    end();command('click','#editor-undo');command('check','#editor-snap')

    for target,label in [(800,'center'),(432,'quarter')]:
        command('select','#editor-selection','node|dist-0');begin('[data-node-id="dist-0"] .node-disc');s=status();move(target+1/s['xScale'],500)
        require(abs(node('dist-0')['x']-target)<1e-8,'Region '+label+' missed: '+str(node('dist-0')['x']))
        require('区域' in status()['active'],'Region feedback missing')
        if label=='quarter':
            desktop=status()
            command('screenshot',str(OUT/'previews/book-snapping-desktop.png'))
        end();require(status()['guides']==0,'Axis guides persisted');command('click','#editor-undo')
    record('Actual icon movement aligns to region center and quarter lines')

    # Arrow keys keep their explicit grid/1px intent, unaffected by magnets.
    command('select','#editor-selection','node|dist-0');before=node('dist-0');js("document.querySelector('#drawing svg').focus()")
    command('press','Shift+ArrowRight')
    record('Shift keyboard fine adjustment remains exactly one model pixel',abs(node('dist-0')['x']-before['x']-1)<1e-8)
    command('click','#editor-undo')

    command('click','[data-scene="ring"]');m=model();r=m['rings'][0];member=r['members'][0];command('select','#editor-selection','node|'+member)
    target=js(f"TopologySnap.create(TopologyScene.resolve(sampleBook.state.scene,'overview'),{{kind:'node',id:{json.dumps(member)}}}).points.find(p=>p.label==='环网轴点')")
    require(target is not None,'Missing valid ring target')
    begin(f'[data-node-id="{member}"] .node-disc');s=status();move(target['x']+1/s['xScale'],target['y']+1/s['yScale']);moved=node(member)
    record('A real ring-member drag snaps to a valid key point on the same ellipse',abs(moved['x']-target['x'])<1e-7 and abs(moved['y']-target['y'])<1e-7 and abs(((moved['x']-r['cx'])/r['rx'])**2+((moved['y']-r['cy'])/r['ry'])**2-1)<1e-9 and bool(status()['active']))
    end()
    ring_state=js("JSON.stringify(TopologyScene.resolve(sampleBook.state.scene,'overview').rings[0].members)")
    record('Ring adjacency and exact arc attachment survive snapping',ring_state==json.dumps(r['members'],separators=(',',':')) and js("(()=>{const m=TopologyScene.resolve(sampleBook.state.scene,'overview');return m.edges.filter(e=>e.geometry==='ring').every(e=>{const g=TopologyEdit.edgeGeometry(e,m);return [[e.source,g.points[0]],[e.target,g.points.at(-1)]].every(([id,p])=>{const n=m.nodes.find(n=>n.id===id);return Math.abs(Math.hypot(n.x-p.x,n.y-p.y)-42)<.002})})})()"))
    command('click','#editor-undo')

    # The ring center itself moves onto canvas center; all member deltas remain identical.
    command('select','#editor-selection','ring|'+r['id']);begin('.ring-move-handle');s=status();move(r['cx']+1/s['xScale'],r['cy']-r['ry']-26+5+1/s['yScale'])
    moved_ring=model()['rings'][0]
    record('Moving the entire ring can align its center without self-snapping to its members',abs(moved_ring['cx']-800)<1e-8 and abs(moved_ring['cy']-500)<1e-8)
    end();command('click','#editor-undo')

    # A mobile dark capture while an actual magnet is active.
    command('click','[data-scene="layered"]');command('click','#theme');command('set','viewport','390','1000')
    command('select','#editor-selection','node|dist-0');begin('[data-node-id="dist-0"] .node-disc');s=status();move(400+1/s['xScale'],500)
    mobile=status();record('Dark narrow editor shows snap feedback without horizontal page overflow',mobile['bodyWidth']==390 and mobile['guides']>0)
    command('screenshot',str(OUT/'previews/book-snapping-mobile.png'))
    end();command('click','#editor-undo');command('set','viewport','1680','1120');command('click','#theme')

    # Save after a snapped endpoint, then independently reopen and continue snapping.
    select_edge();begin(endpoint());move(n['x']+42,n['y']+2);end()
    expected=angle();exports=[]
    exports.append(b.export_blob('#export-json',CHECKS/'snapped-model.json'))
    exports.append(b.export_blob('#save-html',CHECKS/'snapped-book.html'))
    exports.append(b.export_blob('#export-svg',CHECKS/'snapped.svg'))
    ET.parse(CHECKS/'snapped.svg')
    source=(CHECKS/'snapped.svg').read_text(encoding='utf-8');saved=json.loads((CHECKS/'snapped-model.json').read_text(encoding='utf-8'))
    record('Saved model and static SVG contain geometry without temporary snap guides',not any(k in source for k in ['editor-overlay','edit-snap-guide','edit-snap-point']) and 'snapFeedback' not in json.dumps(saved))
    command('open',(CHECKS/'snapped-book.html').as_uri());js('(async()=>{await document.fonts.ready})()')
    record('Saved HTML preserves the snapped angle and reopens in view mode',not js('sampleBook.editor.enabled') and abs(angle()-expected)<1e-8)
    command('click','#edit');select_edge();begin(endpoint());move(n['x'],n['y']-42+1);require(abs(angle()-270)<1e-8,'Reopened editor did not snap');end()
    record('The self-contained saved HTML can continue eight-direction snapping')
    command('set','offline','on');command('reload')
    record('Snapping code and fonts remain fully offline',js("typeof TopologySnap.update==='function'&&document.fonts.check('600 12px \"IBM Plex Sans\"')&&!performance.getEntriesByType('resource').some(r=>/^https?:/.test(r.name))"))
    command('set','offline','off')
    report={'passed':True,'html_sha256':hashlib.sha256((OUT/'index.html').read_bytes()).hexdigest(),'checks':checks,'screen_distance_checks':scale_checks,'desktop':desktop,'mobile':mobile,'exports':exports,'export_validation':'Actual button-produced Blob bytes; native system saving not claimed.'}
    (OUT/'verification/snapping-browser-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'passed':True,'checks':len(checks),'exports':len(exports)}))

if __name__=='__main__':
    try:
        main()
    finally:
        subprocess.run([str(b.BROWSER), '--session', b.SESSION, 'close'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=20, check=False)
