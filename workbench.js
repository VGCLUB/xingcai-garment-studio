"use strict";
const $=id=>document.getElementById(id);
const esc=text=>String(text).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const say=msg=>$("status").textContent=msg;
const round=Pattern.round;
const uid=()=>crypto.randomUUID().slice(0,16);
const part=id=>project.pieces.find(p=>p.id===id);
const nameEdge=([id,e])=>part(id).name+" · "+(e+1);
const num=(label,action,value,min,max)=>'<label>'+label+'<input type="number" step="0.1" data-action="'+action+'" aria-label="'+label+'" value="'+round(value)+'" min="'+min+'" max="'+max+'"></label>';
function options(map,selected){return Object.entries(map).map(([k,v])=>'<option value="'+esc(k)+'" '+(k===selected?"selected":"")+'>'+esc(v)+'</option>').join("");}
const choose=(label,action,map,value)=>'<label>'+label+'<select data-action="'+action+'" aria-label="'+label+'">'+options(map,value)+'</select></label>';
let project={...Pattern.vest(),meshQuality:2},selection="front",vertex=0,mode="edit",first=null,strokes=[],model,viewer,playing=false,drag=null,layouts=[];
const undo=[],redo=[],cacheKey="xingcai-workbench-v2";
let freePicks=[];
try{viewer=createViewer($("stage"));}catch(e){say("3D 初始化失败，可继续制作和导出纸样");$("simulate").disabled=true;}
function store(){try{localStorage.setItem(cacheKey,JSON.stringify(project));}catch(e){say("浏览器暂存不可用，请使用保存工程");}}
function stop(){playing=false;viewer?.play(false);$("simulate").textContent="▶　模拟";}
function accept(raw,prebuilt,settle=false){
  const next=Pattern.validate(raw),built=prebuilt||Garment.create(next);
  if(settle)for(let i=0;i<24;i++)built.step();
  stop();project=next;model=built;
  if(!part(selection))selection=project.pieces[0]?.id??"";
  vertex=Math.max(0,Math.min(vertex,(part(selection)?.points.length??1)-1));
  viewer?.setModel(model,project);$("phase").textContent=viewer?(settle?"垂坠预览":"布置状态"):"WebGL 不可用";
  viewer?.light(project.light);$("light").value=project.light;
}
function change(edit,msg,opts={}){
  const next=structuredClone(project),old=JSON.stringify(project),oldFrame=model.snapshot();try{
    edit(next);if(opts.built||!opts.renameOnly&&!opts.appearance){accept(next,opts.built,opts.settle);}else{project=Pattern.validate(next);if(opts.appearance)viewer?.setModel(model,project);}
    if(JSON.stringify(project)!==old){undo.push(JSON.stringify({...JSON.parse(old),frameState:oldFrame}));if(undo.length>45)undo.shift();redo.length=0;store();}
    first=null;freePicks=[];redraw();say(msg);return true;
  }catch(e){redraw();say("未能应用 · "+e.message);return false;}
}
function history(back){
  const src=back?undo:redo,dst=back?redo:undo;if(!src.length)return;
  try{
    const old=JSON.stringify({...project,frameState:model.snapshot()}),{frameState,...design}=JSON.parse(src.at(-1));
    const built=Garment.create(Pattern.validate(design));if(frameState)built.restore(frameState);
    accept(design,built);src.pop();dst.push(old);first=null;strokes=[];mode="edit";store();redraw();
    if(frameState)$("phase").textContent="已恢复试衣帧";
    say(back?"已撤销":"已重做");
  }catch(e){say(e.message);}
}
function layout(){
  const n=project.pieces.length,cols=Math.max(1,Math.ceil(Math.sqrt(n))),rows=Math.ceil(n/cols)||1,w=520/cols,h=460/rows;
  return project.pieces.map((p,i)=>{const b=Pattern.bounds(Pattern.outline(p)),s=Math.min((w-35)/(b.r-b.l),(h-68)/(b.b-b.t),6.8);
    return {s,x:(i%cols+.5)*w-(b.l+b.r)*s/2,y:(Math.floor(i/cols)+.5)*h-(b.t+b.b)*s/2-5,b};});
}
function trace(points,tf){
  return points.map(([x,y],i)=>(i?"L":"M")+(tf.x+x*tf.s).toFixed(2)+" "+(tf.y+y*tf.s).toFixed(2)).join("");
}
function sheet(){
  const paper=$("paper");
  if(mode==="draw"){
    const pts=strokes.map(p=>p.join(",")).join(" ");
    paper.innerHTML='<polyline points="'+pts+'" fill="#efd7c05c" stroke="#97583c" stroke-width="2"/>'+strokes.map(([x,y],i)=>'<circle cx="'+x+'" cy="'+y+'" r="'+(i?3:5)+'" fill="#945a3e"/>').join("")+'<path d="M18 432h40m-40-3v6m40-6v6" stroke="#75695b"/><text x="18" y="450" class="measureLabel">10 cm</text>';
    return;
  }
  if(!drag)layouts=layout();
  let html="";
  project.pieces.forEach((p,i)=>{
    const t=layouts[i],sel=p.id===selection,edges=p.points.map((_,e)=>Pattern.curve(p,e,1.3));
    html+='<path data-piece="'+p.id+'" d="'+trace(edges.flatMap(e=>e.slice(0,-1)),t)+'Z" fill="'+(sel?"#ebd4be":"#e5e2d6")+'" stroke="'+(sel?"#8e543b":"#8e877c")+'"/>';
    edges.forEach((points,e)=>{
      const d=trace(points,t);
      const spans=Pattern.spans(project.seams,p.id,e);
      const used=spans.some(([lo,hi])=>lo===0&&hi===1);
      const highlight=first?.[0]===p.id&&first[1]===e||sel&&vertex===e&&mode==="edit";
      if(used||highlight)html+='<path d="'+d+'" fill="none" stroke="'+(highlight?"#27777e":"#9a614e")+'" stroke-width="'+(highlight?3:2.5)+'" '+(used?'stroke-dasharray="5 3"':'')+'/>';
      html+='<path d="'+d+'" data-id="'+p.id+'" data-edge="'+e+'" class="edge" fill="none" stroke="transparent" stroke-width="12"/>';
      for(const range of spans.filter(([lo,hi])=>lo!==0||hi!==1)){
        html+='<path d="'+trace(Pattern.spanPoints(p,e,range),t)+'" fill="none" stroke="#9a614e" stroke-width="3" stroke-dasharray="5 3" pointer-events="none"/>';
      }
      if(mode==="free")for(const [id,edge,u] of freePicks.filter(q=>q[0]===p.id&&q[1]===e)){
        const [x,y]=Pattern.pointAt(p.points,edge,u);
        html+='<circle cx="'+(t.x+x*t.s)+'" cy="'+(t.y+y*t.s)+'" r="4" fill="#27777e" pointer-events="none"/>';
      }
      if(mode==="sew"||sel&&e===vertex){
        const a=Pattern.pointAt(p.points,e,.5);html+='<text class="measureLabel" x="'+(t.x+a[0]*t.s+4)+'" y="'+(t.y+a[1]*t.s-5)+'">'+(e+1)+'</text>';
      }
    });
    if(sel&&mode==="edit"||mode==="cut")p.points.forEach(([x,y],i)=>{html+='<circle data-node="'+i+'" data-id="'+p.id+'" cx="'+(t.x+x*t.s)+'" cy="'+(t.y+y*t.s)+'" r="'+(vertex===i?5:3.8)+'" fill="'+((mode==="cut"?first?.[0]===p.id&&first[1]===i:vertex===i)?"#27777e":"#fff9ed")+'" stroke="#845740"/>';});
    html+='<text text-anchor="middle" class="patternLabel" x="'+(t.x+(t.b.l+t.b.r)*t.s/2)+'" y="'+(t.y+t.b.b*t.s+19)+'">'+esc(p.name)+'</text>';
  });
  paper.innerHTML=html;
}
function redraw(){
  if(!part(selection))selection=project.pieces[0]?.id??"";
  const p=part(selection);$("title").value=project.name;$("undo").disabled=!undo.length;$("redo").disabled=!redo.length;
  $("parts").innerHTML=options(Object.fromEntries(project.pieces.map(p=>[p.id,p.name])),selection);
  $("finish").hidden=mode!=="draw";$("finish").disabled=strokes.length<3;
  document.querySelectorAll("[data-mode]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.mode===mode));
  $("hint").textContent=mode==="draw"?"依次点轮廓角点，至少三点后点「完成轮廓」。退格删点，Esc 取消。":mode==="sew"?(first?"再点待配的另一条边；已缝边可在下方拆除。":"依次点击两条边建立缝线；数字是边号。"):"拖动角点改版，点边编辑弧度。尺寸使用厘米。";
  sheet();
  if(mode==="free")$("hint").textContent=["点第一段的起点","点同一边上的终点","点另一段的起点","点第二条边上的终点完成配缝"][freePicks.length]+"。点选顺序决定缝合方向，退格回退，Esc 取消。";
  if(mode==="cut")$("hint").textContent=first?"点同片上第二个不相邻角点，沿直线分片并缝合。":"点分割线的第一个角点。边上没有角点时，先在改版工具中加点。";
  $("allowance").value=project.allowance??1;
  if(p){
    const button=document.createElement("button");button.id="editMaterial";button.className="edit-material";
    button.textContent="编辑材质节点";button.onclick=()=>MaterialEditor.open(selection);
    // Added after property rebuilding below.
    queueMicrotask(()=>{if(!$("editMaterial"))$("props").prepend(button);});
  }
  $("avatar").value=project.avatar||"form";
  $("bodyfields").innerHTML=num("胸围","bust",project.measures.bust,65,135)+num("腰围","waist",project.measures.waist,48,125)+num("臀围","hip",project.measures.hip,65,145);
  const opened=new Set(Array.from($("props").querySelectorAll("details[open]"),d=>d.dataset.section));
  if(p){
    const v=p.points[vertex],box=Pattern.bounds(Pattern.outline(p));
    const section=(k,label,content,defaultOpen=false)=>'<details class="propset" data-section="'+k+'" '+(opened.has(k)||defaultOpen?"open":"")+'><summary>'+label+'</summary>'+content+'</details>';
    $("props").innerHTML='<div class="propset"><label class="cap">裁片名称<input id="partname" maxlength="40" value="'+esc(p.name)+'" data-action="name"></label><div class="smallbuttons"><button data-op="copy">复制</button><button data-op="mirror">镜像复制</button><button data-op="delete">删除裁片</button></div></div>'+
    section("shape","轮廓与尺寸",'<div class="inputs">'+num("整片宽","width",box.r-box.l,2,150)+num("整片长","length",box.b-box.t,2,150)+choose("编辑边 / 起点","edge",Object.fromEntries(p.points.map((_,i)=>[i,"边 "+(i+1)])),String(vertex))+num("弧高","bend",v[2],-40,40)+num("起点 X","px",v[0],-160,160)+num("起点 Y","py",v[1],-160,160)+'</div><div class="smallbuttons"><button data-op="insert">边上加点</button><button data-op="removeNode">删除起点</button></div><p class="cap">边长 '+Pattern.length(p,vertex).toFixed(1)+' cm</p>',true)+
    section("fabric","面料与布置",'<div class="inputs">'+choose("面料","fabric",Pattern.names,p.fabric)+choose("织纹","print",{solid:"素色",stripe:"细条纹",check:"窗格纹"},p.print||"solid")+'<label>颜色<input data-action="color" aria-label="颜色" type="color" value="'+esc(p.color)+'"></label>'+choose("初始布置","placement",{front:"人台前侧",back:"人台后侧",flat:"平面"},p.placement)+choose("固定方式","pin",{top:"固定顶边",none:"自由"},p.pin)+num("纹理倍率","textureScale",p.textureScale??1,.4,3)+num("粗糙度 %","roughness",p.roughness??(p.fabric==="silk"?46:93),6,100)+num("绒光 %","sheenLevel",p.sheenLevel??({cotton:32,linen:23,jacquard:51,silk:62}[p.fabric]),0,100)+num("压褶深度","pleat",p.pleat??0,0,3.5)+num("褶距","pitch",p.pitch??13,8,22)+num("收拢 %","takeup",p.takeup,58,110)+num("网格间距 cm","meshSpacing",p.meshSpacing??2.8,1.4,4)+choose("布料层级","layer",{"0":"0 · 内层","1":"1 · 外层","2":"2 · 外层","3":"3 · 外层","4":"4 · 外层"},String(p.layer??0))+num("高度","height",p.height,-100,100)+num("左右","offset",p.offset,-100,100)+num("前后","depth",p.depth,-100,100)+num("旋转 °","rotation",p.rotation,-180,180)+'</div>');
  }else $("props").innerHTML='<p class="cap">选择「画新片」开始制作。</p>';
  $("seamList").innerHTML=project.seams.map((s,i)=>{
    const a=Pattern.spanLength(part(s.a[0]),s.a[1],s.aRange),b=Pattern.spanLength(part(s.b[0]),s.b[1],s.bRange);
    const ratio=Math.max(a,b)/Math.min(a,b),difference=Math.abs(a-b);
    const gather=difference>1||s.gather?'<button data-gather="'+i+'" aria-pressed="'+!!s.gather+'" title="标记长边按弧长均匀抽褶">抽褶 '+ratio.toFixed(2)+'∶1</button>':'';
    return '<div class="seam-row"><span>'+esc(nameEdge(s.a))+' ↔ '+esc(nameEdge(s.b))+'</span><span class="dims '+(difference>1&&!s.gather?"warn":"")+'">'+a.toFixed(1)+' / '+b.toFixed(1)+' cm · 差 '+difference.toFixed(1)+' '+gather+'</span><button data-flip="'+i+'" title="翻转缝纫方向">'+(s.reverse?"反向":"同向")+'</button><button data-unsew="'+i+'">拆除</button></div>';
  }).join("")||'<p class="cap">尚未建立缝线</p>';
}
function setMode(m){mode=m;first=null;freePicks=[];strokes=[];drag=null;redraw();}
document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$("parts").onchange=e=>{selection=e.target.value;vertex=0;redraw();};
function canvasPoint(e){return new DOMPoint(e.clientX,e.clientY).matrixTransform($("paper").getScreenCTM().inverse());}
function pickInterval(event,id,edge){
  const p=part(id),tf=layouts[project.pieces.indexOf(p)],pt=canvasPoint(event);
  const distance=t=>{const [x,y]=Pattern.pointAt(p.points,edge,t);return Math.hypot(tf.x+tf.s*x-pt.x,tf.y+tf.s*y-pt.y);};
  let best=0;
  for(let i=1;i<=64;i++)if(distance(i/64)<distance(best))best=i/64;
  let lo=Math.max(0,best-1/64),hi=Math.min(1,best+1/64);
  for(let i=0;i<16;i++){const a=(2*lo+hi)/3,b=(lo+2*hi)/3;if(distance(a)<distance(b))hi=b;else lo=a;}
  const u=distance(0)<4?0:distance(1)<4?1:Math.round((lo+hi)*5000)/10000;
  const last=freePicks.at(-1);
  if(freePicks.length%2===1){
    if(last[0]!==id||last[1]!==edge){say("这一段的起点和终点须在同一条边上");return;}
    const range=[Math.min(last[2],u),Math.max(last[2],u)];
    if(Pattern.spanLength(p,edge,range)<.5){say("局部缝线至少需要 0.5 cm");return;}
    if(Pattern.spans(project.seams,id,edge).some(([a,b])=>a<range[1]&&b>range[0])){say("所选区间与已有缝线重叠，退格可重选起点");return;}
  }
  freePicks.push([id,edge,u]);
  if(freePicks.length<4){redraw();return;}
  const [a,b,c,d]=freePicks;
  const seam={a:a.slice(0,2),b:c.slice(0,2),aRange:[a[2],b[2]].sort((x,y)=>x-y),bRange:[c[2],d[2]].sort((x,y)=>x-y),reverse:(b[2]-a[2])*(d[2]-c[2])<0};
  freePicks.pop();
  change(n=>{n.meshQuality=2;n.seams.push(seam);},"已建立局部缝线");
}
function addSeam(end){
  const busy=project.seams.some(s=>[s.a,s.b].some(a=>Pattern.key(...a)===Pattern.key(...end)));
  if(busy){say("此边已经建立缝线，请先拆除");return;}
  if(!first){first=end;redraw();return;}
  if(Pattern.key(...end)===Pattern.key(...first)){say("请选择另一条边");return;}
  const v=(ref)=>{const p=part(ref[0]),a=p.points[ref[1]],b=p.points[(ref[1]+1)%p.points.length];return [b[0]-a[0],b[1]-a[1]];};
  const a=v(first),b=v(end),s={a:first,b:end,reverse:a[0]*b[0]+a[1]*b[1]<0};
  change(n=>n.seams.push(s),"缝线已建立，可在缝线检查中翻转方向");
}
$("paper").onclick=e=>{
  if(mode==="draw"){const pt=canvasPoint(e);strokes.push([round(pt.x),round(pt.y)]);redraw();return;}
  const t=e.target.dataset;
  if(mode==="cut"){
    if(t.node===undefined)return;
    const end=[t.id,+t.node];
    if(!first){first=end;redraw();return;}
    if(first[0]!==end[0]){say("请选择同一片上的两个角点");return;}
    if(change(n=>Cutting.split(n,end[0],first[1],end[1],uid()),"已分片，原有缝线已转移，新切边已配缝"))setMode("edit");
    return;
  }
  if(t.edge!==undefined){if(mode==="free")pickInterval(e,t.id,+t.edge);else if(mode==="sew")addSeam([t.id,+t.edge]);else{selection=t.id;vertex=+t.edge;redraw();}return;}
  if(mode==="edit"&&t.piece){selection=t.piece;vertex=0;redraw();}
};
$("finish").onclick=()=>{
  if(strokes.length<3)return;
  const box=Pattern.bounds(strokes),cx=(box.l+box.r)/2;
  const pts=strokes.map(([x,y])=>[round((x-cx)/4),round((y-box.t)/4),0]);
  const id=uid(),p=Pattern.piece(id,"裁片 "+(project.pieces.length+1),pts,"flat",32);p.depth=18;
  if(change(n=>n.pieces.push(p),"已创建裁片")){selection=id;vertex=0;setMode("edit");}
};
$("paper").onpointerdown=e=>{
  if(mode!=="edit"||e.target.dataset.node===undefined)return;
  const i=+e.target.dataset.node;selection=e.target.dataset.id;vertex=i;
  const index=project.pieces.findIndex(p=>p.id===selection);
  drag={origin:canvasPoint(e),saved:structuredClone(project),tf:layouts[index],moved:false};$("paper").setPointerCapture(e.pointerId);stop();
};
$("paper").onpointermove=e=>{
  if(!drag)return;
  const pt=canvasPoint(e),p=part(selection),a=drag.saved.pieces.find(q=>q.id===selection).points[vertex];
  if(!drag.moved&&Math.hypot(pt.x-drag.origin.x,pt.y-drag.origin.y)<1)return;
  drag.moved=true;p.points[vertex]=[round(a[0]+(pt.x-drag.origin.x)/drag.tf.s),round(a[1]+(pt.y-drag.origin.y)/drag.tf.s),a[2]];sheet();
};
$("paper").onlostpointercapture=()=>{
  if(!drag)return;
  const d=drag,next=project;drag=null;project=d.saved;
  if(d.moved)change(n=>Object.assign(n,next),"角点已更新");else redraw();
};
$("paper").onpointercancel=()=>{if(drag){project=drag.saved;drag=null;redraw();}};
$("props").onchange=e=>{
  const input=e.target,action=input.dataset.action;if(!action)return;
  if(action==="edge"){vertex=Number(input.value);redraw();return;}
  if(input.type==="number"&&!input.reportValidity()){redraw();return;}
  change(n=>{
    const p=n.pieces.find(p=>p.id===selection),v=p.points[vertex],number=Number(input.value);
    if(["name","fabric","print","placement","pin","color"].includes(action))p[action]=input.value;
    else if(action==="px"||action==="py"||action==="bend")v[{px:0,py:1,bend:2}[action]]=number;
    else if(action==="width"||action==="length"){
      const box=Pattern.bounds(Pattern.outline(p)),h=action==="width",pivot=h?(box.l+box.r)/2:box.t;
      for(let attempt=0;attempt<5;attempt++){
        const current=Pattern.bounds(Pattern.outline(p)),size=h?current.r-current.l:current.b-current.t;
        if(Math.abs(number-size)<.05)break;
        for(const pt of p.points){const d=h?0:1;pt[d]=Math.round((pivot+(pt[d]-pivot)*number/size)*1000)/1000;}
      }
    }else{
      p[action]=number;
      if(p.material&&action==="roughness")MaterialSystem.get(p.material,"surface").roughness=number/100;
      if(p.material&&action==="sheenLevel")MaterialSystem.get(p.material,"surface").sheenWeight=number/100;
    }
  },"已更新裁片",{appearance:["print","color","textureScale","roughness","sheenLevel"].includes(action),renameOnly:action==="name"});
};
$("props").onclick=e=>{
  const op=e.target.dataset.op;if(!op)return;
  const id=uid(),i=vertex;
  const ok=change(n=>{
    const p=n.pieces.find(p=>p.id===selection),N=p.points.length;
    if(op==="copy"||op==="mirror"){
      const q=structuredClone(p);q.id=id;q.name=(p.name.slice(0,32)+(op==="copy"?" 副本":" 镜像"));
      if(op==="mirror"){const mirror=pts=>pts.map(([x,y,b])=>[-x,y,-b]);q.points=mirror(q.points);if(q.frame)q.frame=mirror(q.frame);q.offset=-q.offset;}
      n.pieces.push(q);return;
    }
    if(op==="delete"){n.seams=n.seams.filter(s=>s.a[0]!==p.id&&s.b[0]!==p.id);n.pieces=n.pieces.filter(q=>q.id!==p.id);return;}
    const ends=n.seams.flatMap(s=>[s.a,s.b]).filter(a=>a[0]===p.id);
    if(ends.some(a=>a[1]===i||op==="removeNode"&&a[1]===(i+N-1)%N))throw Error("此段已有缝线，请先拆除后改点");
    if(op==="insert"){
      const mid=Pattern.pointAt(p.points,i,.5),bend=p.points[i][2]/4;
      p.points[i][2]=bend;p.points.splice(i+1,0,[...mid.map(round),bend]);ends.forEach(a=>{if(a[1]>i)a[1]++;});
    }else if(op==="removeNode"){if(N<=3)throw Error("至少需要三个角点");p.points.splice(i,1);ends.forEach(a=>{if(a[1]>i)a[1]--;});}
  },"裁片已更新");
  if(ok&&(op==="copy"||op==="mirror")){selection=id;vertex=0;redraw();}
};
$("seamList").onclick=e=>{
  const d=e.target.dataset;
  if(d.gather!==undefined)change(n=>{const seam=n.seams[+d.gather];if(seam.gather)delete seam.gather;else seam.gather=true;},"已按抽褶设置重新布置");
  if(d.unsew!==undefined)change(n=>n.seams.splice(+d.unsew,1),"缝线已拆除");
  if(d.flip!==undefined)change(n=>{const s=n.seams[+d.flip];s.reverse=!s.reverse;},"缝线方向已翻转");
};
$("undo").onclick=()=>history(true);$("redo").onclick=()=>history(false);
document.addEventListener("keydown",e=>{
  if(e.target.matches("input,select,textarea"))return;
  if(e.key==="Escape")setMode("edit");
  if(mode==="free"&&e.key==="Backspace"){e.preventDefault();freePicks.pop();redraw();}
  if(mode==="draw"&&e.key==="Backspace"){e.preventDefault();strokes.pop();redraw();}
  if((e.ctrlKey||e.metaKey)&&["z","y"].includes(e.key.toLowerCase())){e.preventDefault();history(e.key.toLowerCase()==="z"&&!e.shiftKey);}
});
$("title").onchange=e=>change(n=>{n.name=e.target.value.trim();},"工程名称已更新",{renameOnly:true});
$("allowance").onchange=e=>change(n=>{n.allowance=e.target.valueAsNumber;},"已更新纸样导出缝份",{renameOnly:true});
$("avatar").onchange=e=>{const type=e.target.value;if(change(n=>{n.avatar=type;n.measures=structuredClone(Avatar.presets[type]||Dressform.defaults());},"已切换模特并重新试穿",{settle:true}))viewer?.resetView();};
$("bodyfields").onchange=e=>{if(e.target.dataset.action)change(n=>{n.measures[e.target.dataset.action]=e.target.valueAsNumber;},"人台网格和碰撞轮廓已按围度更新");};
function replaceProject(next,msg){
  const {frameState,...design}=next;if(!frameState)design.meshQuality=2;const clean=Pattern.validate(design);
  let built;
  if(frameState){built=Garment.create(clean);built.restore(frameState);}
  if(change(n=>{for(const k of Object.keys(n))delete n[k];Object.assign(n,clean);},msg,{settle:!built,built})){selection=project.pieces[0]?.id??"";vertex=0;setMode("edit");viewer?.frameGarment();if(built)$("phase").textContent="已恢复试衣帧";}
}
$("new").onchange=e=>{
  const type=e.target.value;if(!type)return;e.target.value="";
  if(type.startsWith("sample")){replaceProject((type==="sample5"?GatherExample:type==="sample4"?OpticsExample:Examples[Number(type.slice(6))]),"已打开试做样衣");return;}
  replaceProject(type==="vest"?Pattern.vest():type==="skirt"?Pattern.skirt():{format:"xingcai",version:2,name:"未命名样衣",pieces:[],seams:[]},"已新建工程 · 可撤销");
};
$("arrange").onclick=()=>{accept(project);redraw();say("已重新布置裁片");};
$("wire").onclick=()=>{const on=$("wire").getAttribute("aria-pressed")!=="true";$("wire").setAttribute("aria-pressed",on);viewer?.setWire(on);};
$("photoTools").onclick=()=>{const show=$("photos").hidden;$("photos").hidden=!show;$("photoTools").setAttribute("aria-expanded",show);if(show)viewer?.photoPose($("pose").value);};
$("light").onchange=e=>{const name=e.target.value;if(change(n=>{n.light=name;},"棚拍灯光已更新",{renameOnly:true}))viewer?.light(name);};
$("pose").onchange=e=>viewer?.photoPose(e.target.value);
$("photo").onclick=async()=>{
  if(!viewer||!model.pos.length){say("需要可用的 3D 视窗和裁片");return;}
  const resume=playing;viewer.play(false);$("photo").disabled=true;document.body.inert=true;
  try{
    const width=Number($("resolution").value),blob=await viewer.photo(width,$("pose").value,Number($("samples").value),(i,n)=>say("形裁正在渲染 · 采样 "+i+" / "+n));
    download("png",blob,"image/png");say("已导出成衣渲染图 · "+width+" × "+Math.round(width*1.25));
  }catch(e){say("渲染失败 · "+e.message);}
  finally{document.body.inert=false;$("photo").disabled=false;if(resume&&playing)viewer.play(true);}
};
$("focus").onclick=()=>viewer?.frameGarment();$("camera").onclick=()=>viewer?.resetView();
$("simulate").onclick=()=>{if(!project.pieces.length){say("请先创建裁片");return;}playing=!playing;viewer?.play(playing);$("simulate").textContent=playing?"Ⅱ　暂停":"▶　继续";$("phase").textContent=playing?"模拟中":"已暂停";};
function download(ext,data,mime){const url=URL.createObjectURL(new Blob([data],{type:mime}));const a=document.createElement("a");a.href=url;a.download=project.name.replace(/[<>:"/\\|?*]/g,"_")+"."+ext;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
$("save").onclick=()=>download("xingcai.json",JSON.stringify({...project,frameState:model.snapshot()},null,2),"application/json");
$("glb").onclick=async()=>{
  if(!viewer||!model.pos.length){say("需要可用的 3D 视窗和裁片");return;}
  $("glb").disabled=true;
  try{download("glb",await viewer.glb(project),"model/gltf-binary");say("已导出 GLB · 已内嵌面料纹理与法线贴图");}
  catch(e){say("GLB 导出失败 · "+e.message);}
  finally{$("glb").disabled=false;}
};
$("open").onclick=()=>$("file").click();
$("file").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>64000000)throw Error("文件过大");const next=JSON.parse(await f.text());Pattern.validate(next);await Promise.all(next.pieces.filter(p=>p.material).map(p=>MaterialSystem.prepare(p.material)));replaceProject(next,"工程已打开");}catch(err){say("打开失败 · "+err.message);}e.target.value="";};
$("obj").onclick=()=>{
  if(!model.pos.length){say("请先创建裁片");return;}
  const lines=["# metres, Y up"];
  project.pieces.forEach((p,i)=>{
    lines.push("o "+p.id);
    for(let j=model.offsets[i];j<model.offsets[i+1];j++)lines.push("v "+[0,1,2].map(k=>(model.pos[3*j+k]/100).toFixed(6)).join(" "));
    for(const [x,y] of model.panels[i].coords)lines.push("vt "+(x/10).toFixed(6)+" "+(-y/10).toFixed(6));
    const f=model.faces[i];for(let j=0;j<f.length;j+=3)lines.push("f "+f.slice(j,j+3).map(k=>{const id=k+1+model.offsets[i];return id+"/"+id;}).join(" "));
  });download("obj",lines.join("\n"),"text/plain");
};
$("svgout").onclick=()=>{
  if(!project.pieces.length){say("请先创建裁片");return;}
  let x=2,h=0,lines="";
  for(const p of project.pieces){const pts=Pattern.outline(p),cuts=Cutting.allowance(p,project.allowance),b=Pattern.bounds(cuts.length?cuts.flat():pts),tf={s:1,x:x-b.l,y:2-b.t};
    let d="M"+(p.points[0][0]+tf.x)+" "+(p.points[0][1]+tf.y);
    p.points.forEach((a,i)=>{const end=p.points[(i+1)%p.points.length],mid=Pattern.pointAt(p.points,i,.5);const cp=[0,1].map(k=>2*mid[k]-(a[k]+end[k])/2);d+='Q'+(cp[0]+tf.x)+' '+(cp[1]+tf.y)+' '+(end[0]+tf.x)+' '+(end[1]+tf.y);});
    lines+='<g id="'+p.id+'"><title>'+esc(p.name)+'</title>';
    for(const cut of cuts)lines+='<path data-line="cut" d="'+trace(cut,tf)+'Z" fill="none" stroke="black" stroke-width=".05"/>';
    lines+='<path data-line="sew" d="'+d+'Z" fill="none" stroke="black" stroke-width=".05" '+(cuts.length?'stroke-dasharray=".35 .15"':'')+'/>';
    const winding=Math.sign(pts.reduce((sum,a,i)=>{const b=pts[(i+1)%pts.length];return sum+a[0]*b[1]-b[0]*a[1];},0));
    project.seams.forEach((seam,idx)=>[seam.a,seam.b].forEach(([id,e],side)=>{
      if(id!==p.id)return;
      const reverse=side===1&&seam.reverse,range=seam[side===0?"aRange":"bRange"]??[0,1];
      const frac=range[0]+(range[1]-range[0])*(reverse ? .62 : .38);
      if(range[0]!==0||range[1]!==1)lines+='<path data-seam-span="S'+(idx+1)+'" d="'+trace(Pattern.spanPoints(p,e,range),tf)+'" fill="none" stroke="#27777e" stroke-width=".1"/>';
      const q=Pattern.pointAt(p.points,e,frac),a=Pattern.pointAt(p.points,e,frac-.01),b=Pattern.pointAt(p.points,e,frac+.01);
      const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),nx=-dy*winding/len,ny=dx*winding/len;
      const X=tf.x+q[0],Y=tf.y+q[1],dir=reverse?-1:1,tx=dx/len*dir,ty=dy/len*dir;
      lines+='<g data-seam="S'+(idx+1)+'"><path d="M'+X+' '+Y+'l'+nx*.6+' '+ny*.6+'m0 0l'+(tx*.75+nx*.25)+' '+(ty*.75+ny*.25)+'" fill="none" stroke="#555" stroke-width=".075"/><text x="'+(X+nx*1.2)+'" y="'+(Y+ny*1.2)+'" font-size=".55" text-anchor="middle">S'+(idx+1)+'</text></g>';
    }));
    lines+='<text x="'+x+'" y="'+(b.b-b.t+4)+'" font-size="1.2">'+esc(p.name)+'</text></g>';x+=b.r-b.l+3;h=Math.max(h,b.b-b.t+6);
  }
  const w=Math.max(x,24);
  lines+='<path d="M2 '+h+'h10m0 -.25v.5m-10 -.5v.5" fill="none" stroke="black" stroke-width=".06"/><text x="13" y="'+h+'" font-size=".85">10 cm</text>';h+=1;
  download("svg",'<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'cm" height="'+h+'cm" viewBox="0 0 '+w+' '+h+'">'+lines+'</svg>',"image/svg+xml");
};
async function initialize(){document.querySelector("body").inert=true;try{await Textiles.ready;}catch(e){say("实拍布纹载入失败");}
try{const saved=localStorage.getItem(cacheKey);if(saved)project=Pattern.validate(JSON.parse(saved));await Promise.all(project.pieces.filter(p=>p.material).map(p=>MaterialSystem.prepare(p.material)));accept(project,null,true);}
catch(e){accept(Pattern.vest(),null,true);say("已使用内置背心工程");}
redraw();viewer?.frameGarment();document.querySelector("body").inert=false;}
initialize();




$("strain").onclick=()=>{const on=$("strain").getAttribute("aria-pressed")!=="true";$("strain").setAttribute("aria-pressed",on);viewer?.setStrain(on);};
