'use strict';
// Curated review scenes use the approved standard; coordinates are not an auto-layout result.
const Scene=require('../scripts/v2/scene.js');
const N=(id,label,type,x,y,group,extra={})=>({id,label,type,x,y,group,status:'normal',...extra});
const G=(id,label,x,y,w,h,extra={})=>({id,label,x,y,w,h,semantics:'network',...extra});
const E=(id,source,target,extra={})=>({id,source,target,semantics:'physical',certainty:'actual',status:'normal',geometry:'orthogonal',direction:false,color:'line',...extra});
const A=(x,y,title,lines,extra={})=>({x,y,title,lines,...extra});
const physical={label:'物理连接',color:'line',semantics:'physical'};
const management={label:'管理 / 控制',color:'line',semantics:'management',dash:true};
const logical={label:'逻辑隧道',color:'line',semantics:'logical',dash:true};
const channels=[{id:'interactive',name:'实时交互',color:'blue'},{id:'video',name:'视频协作',color:'pink'},{id:'business',name:'关键业务',color:'green'},{id:'background',name:'后台传输',color:'amber'}];
const scenes=[];
const point=(n,angle)=>({x:n.x+42*Math.cos(angle*Math.PI/180),y:n.y+42*Math.sin(angle*Math.PI/180)});
function fan(source,targets,prefix,lane=600,extra={}) {
  const offsets=source.deployment&&targets.length===2?[-8.5,8.5]:{1:[0],2:[-30,30],3:[-45,0,45],4:[-60,-20,20,60]}[targets.length];
  if(!offsets)throw Error('Curated fan requires 1-4 targets');
  return targets.map((target,i)=>{const angle=90-offsets[i],p=point(source,angle),y=lane+(Math.min(i,targets.length-1-i))*12;
    return E(prefix+i,source.id,target.id,{source_anchor:{angle},target_anchor:'top',via:[[p.x,y],[target.x,y]],port_group:prefix,port_axis:'down',...extra});});
}

// 01 — Pure hierarchy: titles and whitespace, no decorative layer enclosures.
{
  const groups=[G('core-zone','核心层',64,150,1472,210,{kind:'layer',tag:'CORE'}),G('dist-zone','汇聚层',64,410,1472,180,{kind:'layer'}),G('access-zone','接入层',64,650,1472,210,{kind:'layer',labelAt:[88,580]})];
  const core=[N('core-a','核心 A','core-switch',480,250,'core-zone',{focus:true,deployment:'mlag',deployment_members:['core-a','core-b'],labelOffset:[86,0]}),N('core-b','核心 B','core-switch',1120,250,'core-zone',{deployment:'mlag',deployment_members:['core-a','core-b'],labelOffset:[86,0]})];
  const dist=[280,680,920,1320].map((x,i)=>N('dist-'+i,'汇聚 '+(i+1),'router',x,500,'dist-zone',{labelOffset:[86,0]}));
  const access=[160,400,680,920,1200,1440].map((x,i)=>N('access-'+i,'接入组 '+(i+1),'virtual-switch',x,760,'access-zone',{count:2,members:['leaf-'+i+'-a','leaf-'+i+'-b']}));
  const edges=[...fan(core[0],dist.slice(0,2),'core-dist-',380,{role:'primary'}),...fan(core[1],dist.slice(2),'core-dist-b-',380,{role:'primary'})];
  [0,1,2,3].forEach(j=>{const targets=access.filter((_,i)=>[0,0,1,2,3,3][i]===j);edges.push(...fan(dist[j],targets,'dist-access-'+j+'-',620));});
  edges.push(E('core-sync','core-a','core-b',{source_anchor:'top',target_anchor:'top',via:[[480,190],[1120,190]],semantics:'management',role:'heartbeat',label:'控制同步',labelAt:[800,160]}));
  const leaves=access.flatMap((n,i)=>['a','b'].map((s,k)=>N(`leaf-${i}-${s}`,`接入 ${i+1}${s.toUpperCase()}`,'virtual-switch',n.x+(k?52:-52),760,'access-zone')));
  const detailEdges=edges.filter(e=>!e.id.startsWith('dist-access'));
  [0,1,2,3].forEach(j=>{const targets=leaves.filter(n=>[0,0,1,2,3,3][Number(n.id.split('-')[1])]===j);
    fan(dist[j],targets,'dist-leaf-'+j+'-',600).forEach(e=>detailEdges.push({...e,label:'物理',labelAt:[leaves.find(n=>n.id===e.target).x+32,690]}));});
  for(const edge of edges.filter(e=>e.id.startsWith('dist-access'))){const agg=access.find(n=>n.id===edge.target);edge.members=detailEdges.filter(e=>agg.members?.includes(e.target)).map(e=>e.id);edge.semantics='aggregate';edge.label='2 × 物理';edge.labelAt=[agg.x+42,685];}
  scenes.push({id:'layered',number:'01',family:'分层',name:'纵向分层 · 模块化园区',title:'层级靠轴线和留白建立',subtitle:'核心、汇聚、接入向下展开；层级标题代替装饰框，扇出接点按轴线镜像分配。',description:'双核心与四个汇聚节点连接六组接入模块，总览中的每组对应两个实际设备。',groups,nodes:[...core,...dist,...access],edges,legend:[physical,management,{label:'汇总连接（保留成员）',color:'line',semantics:'aggregate',type:'pipe'}],read:'由核心向下读到汇聚，再到接入；MLAG 标签属于已建模的双核心。',meaning:'普通层级不表示区域边界；×2 汇总保留成员与线路映射。',focus:'对称扇出、两次以内转弯，6 点出线处名称侧下避让。',views:{overview:{},engineering:{title:'总览模块与真实成员逐一对应',subtitle:'展开 12 台接入设备，各独立连接保持各自 ID；图上仅放关键连接类型。',nodes:[...core,...dist,...leaves],edges:detailEdges}}});
}

// 02 — Region-level logical relationships preserve explicit abstraction.
{
  const groups=[G('hub','共享接入中心',610,340,380,280,{semantics:'site',tag:'HUB'})],nodes=[N('hub-router','共享路由','router',714,470,'hub'),N('hub-fw','安全出口','firewall',886,470,'hub')],edges=[];
  ['分支办公','生产园区','边缘站点','公有云域','合作伙伴','移动接入'].forEach((name,i)=>{const side=i<3?-1:1,row=i%3,x=side<0?76:1184,y=160+row*240,id='spoke-'+i;
    groups.push(G(id,name,x,y,340,180,{semantics:i===3?'network':'site',tag:'0'+(i+1)}));
    nodes.push(N(id+'-edge',i===3?'云接入':'边缘接入',i===3?'cloud':'router',x+100,y+90,id),N(id+'-work','业务终端',i===3?'kubernetes':'laptop',x+240,y+90,id));
    const sy=420+row*50,ty=y+90,lane=side<0?510:1090;
    edges.push(E('hub-'+i,'hub',id,{source_anchor:side<0?'left':'right',target_anchor:side<0?'right':'left',source_offset:[0,sy-480],via:[[lane,sy],[lane,ty]],semantics:'logical',abstraction:'region',endpoints_confirmed:false}));});
  scenes.push({id:'hub-spoke',number:'02',family:'中心辐射',name:'中心辐射 · 分支与共享服务',title:'共享中心与自治站点各有边界',subtitle:'区域级逻辑关系接边界，虚线说明隧道语义；域内图标以归属表达。',description:'六个站点或网络域通过区域级逻辑关系关联共享中心，不冒充具体设备接口。',groups,nodes,edges,legend:[logical,{label:'真实站点 / 网络域',type:'area',color:'line'}],annotations:[A(690,566,'区域级关系',['具体端点在工程图中展开'],{w:220})],read:'先看共享中心，再看外围站点；每个区域内部可以独立采用其他构图。',meaning:'本例只说明域级关系，未指定的设备端口保持未展开。',focus:'圆角折线、明确边界接点；基础关系保持中性。'});
}

// 03 — Mirrored sites; local hierarchy can use a different direction.
{
  const groups=[G('dc-a','主中心',80,265,600,570,{semantics:'site',tag:'SITE A'}),G('dc-b','灾备中心',920,265,600,570,{semantics:'site',tag:'SITE B'})];
  const nodes=[N('wan','共享外部 WAN','internet',800,185,null),N('a-r','边界路由','router',180,390,'dc-a'),N('a-fw','安全边界','firewall',380,390,'dc-a',{labelOffset:[80,0]}),N('a-core','核心交换','core-switch',380,510,'dc-a',{labelOffset:[80,0]}),N('b-core','核心交换','core-switch',1220,510,'dc-b',{labelOffset:[80,0]}),N('b-fw','安全边界','firewall',1220,390,'dc-b',{labelOffset:[80,0]}),N('b-r','边界路由','router',1420,390,'dc-b')];
  const by=id=>nodes.find(n=>n.id===id),workloads=[];
  [180,380,580].forEach((x,i)=>workloads.push(N('a-app-'+i,['应用服务','容器平台','数据存储'][i],['server','kubernetes','rack'][i],x,710,'dc-a')));
  [1020,1220,1420].forEach((x,i)=>workloads.push(N('b-app-'+i,['数据存储','容器平台','应用服务'][i],['rack','kubernetes','server'][i],x,710,'dc-b')));
  const edges=[E('wan-a','wan','a-r',{source_anchor:'left',target_anchor:'top',via:[[180,185]],role:'primary'}),E('wan-b','wan','b-r',{source_anchor:'right',target_anchor:'top',via:[[1420,185]],role:'primary'}),E('a-edge','a-r','a-fw',{geometry:'line',source_anchor:'right',target_anchor:'left'}),E('a-core-link','a-fw','a-core',{geometry:'line',source_anchor:'bottom',target_anchor:'top'}),E('b-edge','b-core','b-fw',{geometry:'line',source_anchor:'top',target_anchor:'bottom'}),E('b-core-link','b-fw','b-r',{geometry:'line',source_anchor:'right',target_anchor:'left'}),E('dci','a-core','b-core',{geometry:'line',source_anchor:'right',target_anchor:'left',semantics:'aggregate',presentation:'pipe',channels:channels.slice(0,3),label:'3 个逻辑通道 · 合成承载',labelAt:[800,464],members:['dci-interactive','dci-video','dci-business']})];
  const aggregated=[N('a-workload','计算与数据资源','kubernetes',380,710,'dc-a',{count:3,members:workloads.slice(0,3).map(n=>n.id)}),N('b-workload','计算与数据资源','kubernetes',1220,710,'dc-b',{count:3,members:workloads.slice(3).map(n=>n.id)})];
  const detailEdges=edges.concat(fan(by('a-core'),workloads.slice(0,3),'app-a-',620),fan(by('b-core'),workloads.slice(3),'app-b-',620));
  const overviewEdges=edges.concat(fan(by('a-core'),[aggregated[0]],'a-aggregate-',620),fan(by('b-core'),[aggregated[1]],'b-aggregate-',620));
  for(const edge of overviewEdges.filter(e=>e.id.includes('aggregate'))){edge.semantics='aggregate';edge.members=detailEdges.filter(e=>e.source===edge.source&&workloads.some(n=>n.id===e.target)).map(e=>e.id);edge.label='3 × 物理';edge.labelAt=[by(edge.source).x+55,628];}
  const memberEdges=channels.slice(0,3).map(c=>({id:'dci-'+c.id,source:'a-core',target:'b-core',semantics:'logical',name:c.name,carrier:'合成承载',role:'peer'}));
  scenes.push({id:'dual-center',number:'03',family:'双中心对称',name:'双中心 · 跨站点与局部分层',title:'整图横向，站点内部纵向展开',subtitle:'共享 WAN、双站点和中心间通道清楚分层；局部方向服从站点职责。',description:'两个站点保留具体设备端点，中间管道明确保存三项同类逻辑通道；资源池可展开。',groups,nodes:[...nodes,...aggregated],edges:overviewEdges,member_edges:memberEdges,legend:[physical,{label:'3 个逻辑成员',color:'line',semantics:'aggregate',type:'pipe'},...channels.slice(0,3).map(c=>({label:c.name,color:c.color}))],annotations:[A(704,774,'同类逻辑成员可展开',['通道数量不代表带宽比例'],{w:192})],read:'共享入口向两侧分流，站点内部由接入到核心和资源。',meaning:'管道有 3 个具名成员，资源池有稳定成员 ID。',focus:'真实站点边框与内部纵向层级组合，避免全图机械统一方向。',views:{overview:{},engineering:{title:'双中心的设备与逻辑通道明细',subtitle:'六个资源成员逐一展开；承载成员、端点与属性仍保留在模型中。',nodes:[...nodes,...workloads],edges:detailEdges}}});
}

// 04 — Equally spaced arc lengths, exact circumference clipping, explicit RPL state.
{
  const ring={id:'metro-ring',cx:800,cy:495,rx:500,ry:260,width:2.6,phase:.5};
  const nodes=Scene.ringPositions(ring,8).map((p,i)=>N('ring-'+i,'城域 '+(i+1),'router',p.x,p.y,null,{full_label:'城域节点 '+(i+1)}));ring.members=nodes.map(n=>n.id);
  const edges=nodes.map((n,i)=>E('segment-'+i,n.id,nodes[(i+1)%8].id,{geometry:'ring',ring:ring.id,width:2.6,role:'primary',...(i===3?{status:'blocked',protection:'rpl',state_label:'RPL · 转发阻塞',label:'RPL · 转发阻塞',labelAt:[800,702]}:{})}));
  scenes.push({id:'ring',number:'04',family:'环形',name:'环形 · 完整骨架与独立状态',title:'物理环连续，保护状态另行说明',subtitle:'节点沿椭圆近似等弧长排列；各段精准接外缘，名称统一下置。',description:'八节点环保持真实闭合与视觉连续；RPL 阻塞是转发状态，不把物理链路画成虚线或断口。',nodes,edges,rings:[ring],groups:[],legend:[physical,{label:'RPL / 转发阻塞',color:'amber',type:'state'}],annotations:[A(670,447,'城域承载 · 8 节点',['连续轮廓表示已建物理环','RPL 状态不表示物理链路缺失'],{w:260})],read:'沿共同椭圆追踪一圈，设备圆盘是环的连接单元。',meaning:'各段都是物理连接；RPL 标记与线路类型分开。',focus:'近似等弧长、下置名称、精确外缘端点；保持完整环感。'});
}

// 05 — Independent resources; no invented connectivity between regions.
{
  const groups=[],nodes=[],edges=[];
  ['华东资源池','华北资源池','华南资源池','西部资源池'].forEach((name,i)=>{const x=i%2?834:96,y=i<2?155:520,id='pool-'+i;groups.push(G(id,name,x,y,670,315,{semantics:'site',tag:'REGION 0'+(i+1)}));
    ['router','server','kubernetes'].forEach((type,j)=>nodes.push(N(id+'-'+j,['边缘接入','应用服务','容器资源'][j],type,x+136+j*199,y+158,id)));
    edges.push(E(id+'-local',id+'-0',id+'-1',{geometry:'line',source_anchor:'right',target_anchor:'left'}));});
  scenes.push({id:'grid',number:'05',family:'网格',name:'网格 · 多站点资源矩阵',title:'并列站点，用一致模块比较',subtitle:'同类角色保持基线；只有已明确的局部连接画线，站点之间保留空白。',description:'四个站点各含接入、应用和容器资源，不暗示跨站点互联。',groups,nodes,edges,legend:[physical,{label:'站点范围',type:'area',color:'line'}],read:'逐站点比较相同角色，每一格可继续采用内部局部布局。',meaning:'网格仅说明并列，未知关系不进入正式连接集合。',focus:'真实站点边界、中性基础线和外置名称。'});
}

// 06 — Semantic nesting remains independent from the actual connections.
{
  const groups=[G('platform','企业平台 / 管理域',92,145,1416,720,{semantics:'administrative',tag:'ADMINISTRATIVE SCOPE'}),G('ingress','入口安全域',128,390,310,445,{semantics:'security',parent:'platform'}),G('compute','业务网络域',478,390,644,445,{parent:'platform'}),G('app-subnet','应用子区域',504,468,592,350,{parent:'compute',tag:'WORKLOAD'}),G('data','数据网络域',1162,390,310,445,{parent:'platform'})];
  const nodes=[N('policy','策略管理','zero-trust-gateway',640,270,'platform'),N('managed','托管服务','cloud',840,270,'platform'),N('ops','平台运维','server',1040,270,'platform'),N('public','公网入口','internet',283,510,'ingress',{labelOffset:[80,0]}),N('boundary','边界安全','firewall',283,700,'ingress'),N('app','应用节点','server',668,560,'app-subnet'),N('private','私有接入点','virtual-switch',932,560,'app-subnet'),N('container','容器服务','kubernetes',668,730,'app-subnet'),N('service','服务实例','server',932,730,'app-subnet'),N('data-store','数据资源','rack',1317,510,'data'),N('data-protect','数据保护','zero-trust-gateway',1317,700,'data')];
  const edges=[E('ingress-app','boundary','app',{source_anchor:'right',target_anchor:'left',via:[[460,700],[460,560]],role:'primary'}),E('public-boundary','public','boundary',{geometry:'line',source_anchor:'bottom',target_anchor:'top'}),E('app-private','app','private',{geometry:'line',source_anchor:'right',target_anchor:'left'}),E('private-managed','private','managed',{source_anchor:'top',target_anchor:'right',via:[[932,270]],semantics:'logical',label:'私有逻辑接入',labelAt:[1000,360]}),E('private-data','private','data-store',{source_anchor:'right',target_anchor:'left',via:[[1136,560],[1136,510]]})];
  scenes.push({id:'nested',number:'06',family:'嵌套区域',name:'嵌套区域 · 混合云与安全域',title:'真实边界与具体连接分别表达',subtitle:'管理、安全、网络与工作负载按归属嵌套；跨域线路保留具体端点。',description:'托管服务与私有接入点通过逻辑关系连接，外部云符号仅代表未展开的托管域。',groups,nodes,edges,legend:[physical,logical,{label:'管理 / 安全 / 网络范围',type:'area',color:'line'}],read:'先识别管理范围，再看入口、业务和数据域。',meaning:'嵌套表示归属，虚线表示具名逻辑接入，二者互不替代。',focus:'线路不穿名称；默认两次以内转弯，6 点线路保留并侧移名称。'});
}

// 07 — One selected business flow overlays the exact physical path.
{
  const groups=[G('users','用户与分支',80,160,320,675,{semantics:'site',tag:'SOURCE'}),G('wan','承载网络',450,160,320,675,{tag:'TRANSPORT'}),G('security','安全服务',820,160,320,675,{semantics:'security',tag:'INSPECTION'}),G('apps','应用与数据',1190,160,320,675,{semantics:'compute',tag:'DESTINATION'})];
  const nodes=[],edges=[],roles=[['laptop','router','firewall','server'],['laptop','virtual-switch','zero-trust-gateway','kubernetes'],['server','router','firewall','rack']],names=[['协作终端','实时接入','安全检查','协作服务'],['视频终端','视频接入','身份访问','视频平台'],['分支应用','业务接入','应用防护','数据服务']],flows=[{id:'voice',label:'实时交互',color:'blue'},{id:'video',label:'视频协作',color:'pink'},{id:'business',label:'关键业务',color:'green'}];
  roles.forEach((row,r)=>{row.forEach((type,c)=>nodes.push(N(`f-${r}-${c}`,names[r][c],type,240+c*370,300+r*205,groups[c].id)));for(let c=0;c<3;c++){
    edges.push(E(`base-${r}-${c}`,`f-${r}-${c}`,`f-${r}-${c+1}`,{geometry:'line',source_anchor:'right',target_anchor:'left'}));
    edges.push(E(`flow-${r}-${c}`,`f-${r}-${c}`,`f-${r}-${c+1}`,{semantics:'business',base_edge:`base-${r}-${c}`,color:flows[r].color,presentation:'overlay',flow:flows[r].id,width:2.6,direction:true,label:c===0?flows[r].label:'',labelAt:[425,267+r*205]}));}});
  const overNodes=nodes.map(n=>({...n,count:n.id==='f-2-0'?8:undefined})),members=Array.from({length:8},(_,i)=>({id:'branch-app-'+i,aggregate:'f-2-0',label:'分支应用实例 '+(i+1)}));
  const detailNodes=nodes.map(n=>({...n})).concat(members.map((member,i)=>N(member.id,'应用 '+String(i+1).padStart(2,'0'),'server',170+i*180,1020,'branch-members',{compact:true,aggregate:member.aggregate})));
  scenes.push({id:'swimlane',number:'07',family:'泳道',name:'泳道 · 业务流与安全服务链',title:'选中业务沿真实基础线路突出',subtitle:'默认只突出实时交互，可切换视频或关键业务；中性基础网络始终可见。',description:'三类业务各有明确方向，彩色路径与基础线路共用几何，不表示额外物理链路。',groups,nodes:overNodes,edges,flows,default_flow:'voice',legend:[physical,...flows.map(f=>({label:f.label+'业务路径',color:f.color,semantics:'business'}))],read:'从来源经承载、安全到目的域，按任务选择一类业务。',meaning:'选择“所有业务”是显式比较模式；不删除其他业务模型。',focus:'中性基础线保留在彩色强调层两侧，方向与静态包清楚可辨。',views:{overview:{viewNote:'分支应用代表 8 个合成实例'},engineering:{title:'业务实例与路径成员可追溯',subtitle:'8 个实例展开在下方；归属关系不伪装成额外物理连线。',height:1240,groups:groups.concat([G('branch-members','分支应用入口的成员明细',80,900,1440,230,{kind:'collection',semantics:'membership',tag:'MEMBERS OF f-2-0'})]),nodes:detailNodes}},members});
}

// 08 — Deployment concepts use the latest icons; no connectivity is implied.
{
  const groups=[],nodes=[],bands=[['接入与连接','CONNECT',['internet','router','wireless-ap','virtual-switch'],['公网与云接入','站点路由','无线接入','虚拟交换']],['身份与安全','PROTECT',['firewall','zero-trust-gateway','cloud','laptop'],['高可用防护','身份访问','云端能力','终端访问']],['平台与运行','OPERATE',['server','kubernetes','rack','core-switch'],['集群运行','容器平台','资源设施','堆叠交换']]];
  bands.forEach((b,i)=>{const y=220+i*210,id='cap-'+i;groups.push(G(id,b[0],96,y,1408,178,{kind:'band',semantics:'capability',tag:b[1]}));b[2].forEach((type,j)=>nodes.push(N(id+'-'+j,b[3][j],type,470+j*270,y+72,id,{deployment:type==='firewall'?'ha':type==='server'?'cluster':type==='core-switch'?'stack':type==='virtual-switch'?'mlag':undefined,concept:true})));});
  scenes.push({id:'capabilities',number:'08',family:'能力全景',name:'无连线 · 能力与组合方式',title:'以区域表达能力，以标记表达组合',subtitle:'HA、Stack、Cluster、MLAG 使用最新圆内下方胶囊；设备名称仍在圆外。',description:'十二项能力分为三个层面；组合标记是能力示意，不生成未知设备或线路。',groups,nodes,edges:[],legend:[{label:'能力归属范围',type:'area',color:'line'}],read:'按连接、安全、运行理解能力，四类组合标记与设备本体分开阅读。',meaning:'图中没有流量或物理关系；标记不自动产生连接。',focus:'无标签图形保持 61.8%；带组合标签时图形缩小上移，使用 IBM Plex Sans。'});
}

// 09 — A real mixed composition: ring + sites + interior device.
{
  const ring={id:'mixed-backbone',cx:800,cy:520,rx:360,ry:190,width:2.6,phase:.5};
  const ringNodes=Scene.ringPositions(ring,8).map((p,i)=>N('m-ring-'+i,'环节点 '+(i+1),'router',p.x,p.y,null));ring.members=ringNodes.map(n=>n.id);
  const left=ringNodes[6],right=ringNodes[1],groups=[G('site-west','西侧接入站点',72,310,300,480,{semantics:'site',tag:'SITE WEST'}),G('site-east','东侧接入站点',1228,310,300,480,{semantics:'site',tag:'SITE EAST'})];
  const nodes=ringNodes.concat([N('west-gw','站点网关','firewall',222,left.y,'site-west',{labelOffset:[76,0]}),N('west-access','接入交换','core-switch',222,650,'site-west'),N('east-gw','站点网关','firewall',1378,right.y,'site-east',{labelOffset:[76,0]}),N('east-access','接入交换','core-switch',1378,650,'site-east'),N('inner-device','环内业务设备','server',800,520,null)]);
  const edges=ringNodes.map((n,i)=>E('mixed-segment-'+i,n.id,ringNodes[(i+1)%8].id,{geometry:'ring',ring:ring.id,width:2.6}));
  for(const [n,side,target] of [[left,-1,'west-gw'],[right,1,'east-gw']]){const angle=Math.atan2(n.y-ring.cy,n.x-ring.cx)*180/Math.PI,p=point(n,angle),x=side<0?410:1190,t=nodes.find(n=>n.id===target);
    edges.push(E('mixed-'+target,n.id,target,{source_anchor:{angle},target_anchor:side<0?'right':'left',via:[[x,p.y],[x,t.y]]}));}
  edges.push(E('mixed-west-local','west-gw','west-access',{geometry:'line',source_anchor:'bottom',target_anchor:'top'}),E('mixed-east-local','east-gw','east-access',{geometry:'line',source_anchor:'bottom',target_anchor:'top'}));
  const innerAngle=Math.atan2(ring.cy-left.y,ring.cx-left.x)*180/Math.PI,innerPoint=point(left,innerAngle);
  edges.push(E('mixed-interior',left.id,'inner-device',{source_anchor:{angle:innerAngle},target_anchor:'top',via:[[800,innerPoint.y]]}));
  scenes.push({id:'mixed-ring',number:'09',family:'组合构图',composition_example:true,name:'组合 · 环网挂接站点与设备',title:'主干成环，站点独立展开',subtitle:'外部站点从朝外扇区接出，环内真实设备从内侧接入；环段接点保持独立。',description:'八节点主环连接两个站点及一台环内业务设备；站点内部采用纵向设备链。',groups,nodes,edges,rings:[ring],legend:[physical,{label:'真实站点边界',type:'area',color:'line'}],annotations:[A(694,610,'环网 + 站点 + 内部设备',[],{w:212})],read:'先识别完整主环，再看两侧站点及环内设备。',meaning:'区域框、环段与支线各有真实含义；外部支线不穿越环内。',focus:'八种构图可在同图组合，名称和支线不挤占环路。'});
}

// 10 — Six expressions demonstrate semantics separately from geometry.
{
  const groups=[G('l1','01  物理主备与逻辑隧道',80,155,680,290,{kind:'specimen',note:'主备各有 ID；逻辑隧道另走虚线路径'}),G('l2','02  同类成员聚合管道',840,155,680,290,{kind:'specimen',note:'具名成员可追溯；不暗示带宽比例'}),G('l3','03  真实总线与分支',80,470,680,330,{kind:'specimen',note:'仅真实共享介质使用主干与接点'}),G('l4','04  多色 CoS / 业务带',840,470,680,330,{kind:'specimen',note:'显式比较类别，逐色命名'}),G('l5','05  数据包与管理关系',80,845,680,290,{kind:'specimen',note:'业务按需播放；管理关系单独点线'}),G('l6','06  沿基础线的业务叠加',840,845,680,290,{kind:'specimen',note:'彩色强调不代表新增物理线'})];
  const nodes=[N('l1-a','接入端','router',180,320,'l1'),N('l1-b','核心端','core-switch',660,320,'l1'),N('l2-a','承载入口','router',940,320,'l2'),N('l2-b','承载出口','core-switch',1420,320,'l2'),N('l3-a','主干入口','router',180,640,'l3'),N('l3-b','业务 A','server',660,590,'l3'),N('l3-c','业务 B','kubernetes',660,710,'l3'),N('l4-a','分类入口','virtual-switch',940,640,'l4'),N('l4-b','分类出口','core-switch',1420,640,'l4'),N('l5-a','来源','laptop',180,980,'l5'),N('l5-b','目的','server',660,980,'l5'),N('l6-a','用户','laptop',940,980,'l6'),N('l6-b','检查','firewall',1180,980,'l6'),N('l6-c','服务','cloud',1420,980,'l6')];
  const dx=Math.sqrt(42**2-6**2),junctions=[{id:'bus-tap',x:550,y:640}];
  const edges=[E('atlas-dual','l1-a','l1-b',{geometry:'line',source_point:{x:180+dx,y:314},target_point:{x:660-dx,y:314},role:'primary',label:'主用 · 物理',labelAt:[510,295]}),E('atlas-backup','l1-a','l1-b',{geometry:'line',source_point:{x:180+dx,y:326},target_point:{x:660-dx,y:326},role:'redundant',label:'备用 · 物理',labelAt:[420,366]}),E('atlas-tunnel','l1-a','l1-b',{source_anchor:'top',target_anchor:'top',via:[[180,250],[660,250]],semantics:'logical',label:'逻辑隧道',labelAt:[330,276]}),E('atlas-pipe','l2-a','l2-b',{geometry:'line',source_anchor:'right',target_anchor:'left',presentation:'pipe',semantics:'aggregate',channels:channels.slice(0,3),label:'3 个同类成员',labelAt:[1180,274],members:channels.slice(0,3).map(c=>'pipe-'+c.id)}),E('atlas-trunk','l3-a','bus-tap',{geometry:'line',source_anchor:'right',width:2.6}),E('atlas-branch-a','bus-tap','l3-b',{target_anchor:'left',via:[[550,590]]}),E('atlas-branch-b','bus-tap','l3-c',{target_anchor:'left',via:[[550,710]]}),E('atlas-bands','l4-a','l4-b',{geometry:'line',source_anchor:'right',target_anchor:'left',presentation:'bands',semantics:'aggregate',channels,label:'显式比较 · 四类业务',labelAt:[1180,594],members:channels.map(c=>'band-'+c.id)}),E('packet-base','l5-a','l5-b',{geometry:'line',source_anchor:'right',target_anchor:'left'}),E('atlas-packets','l5-a','l5-b',{semantics:'business',base_edge:'packet-base',presentation:'packets',color:'blue',channels:channels.slice(0,3),direction:true}),E('atlas-management','l5-a','l5-b',{source_anchor:'bottom-left',target_anchor:'bottom-right',via:[[180-42*Math.SQRT1_2,1060],[660+42*Math.SQRT1_2,1060]],semantics:'management',label:'管理 / 监控',labelAt:[420,1088]})];
  for(const [id,source,target] of [['a','l6-a','l6-b'],['b','l6-b','l6-c']]){edges.push(E('overlay-base-'+id,source,target,{geometry:'line',source_anchor:'right',target_anchor:'left'}),E('atlas-overlay-'+id,source,target,{semantics:'business',base_edge:'overlay-base-'+id,presentation:'overlay',color:'pink',width:2.6,direction:true}));}
  const member_edges=[...channels.slice(0,3).map(c=>({id:'pipe-'+c.id,source:'l2-a',target:'l2-b',semantics:'logical',name:c.name})),...channels.map(c=>({id:'band-'+c.id,source:'l4-a',target:'l4-b',semantics:'business',name:c.name}))];
  scenes.push({id:'connections',number:'10',family:'连线体系',name:'连线图谱 · 六种表达',title:'线型说明类型，标记说明状态',subtitle:'物理实线、逻辑虚线、管理点线；主备身份独立，彩色仅用于业务与明确强调。',description:'六组示例区分真实主备、成员集合、总线、业务比较、数据包与业务叠加。',height:1300,groups,nodes,edges,junctions,member_edges,legend:[physical,logical,management,{label:'成员集合',color:'line',semantics:'aggregate',type:'pipe'},{label:'业务路径',color:'pink',semantics:'business'},{label:'显式接点',type:'junction',color:'line'}],read:'先辨认关系类型，再看成员、状态与业务方向。',meaning:'线宽不代表带宽，包数和速度不代表测量值；每个聚合成员都有 ID。',focus:'主备两条实线间距 12px，逻辑关系错开，业务叠加保留中性底线。'});
}

const generatedAt=new Date().toISOString();
module.exports=scenes.map(scene=>({schema_version:2,standards_version:'1.0',icon_revision:'sst-v4',stage:'visual-specimen',coordinates:'curated',generated_at:generatedAt,design_tokens:{...Scene.TOKENS},overrides:[],exceptions:[],width:1600,height:1000,...scene}));
