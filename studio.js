"use strict";
const el=id=>document.getElementById(id);
const vocabulary={left:"左",right:"右"};
const fields=[["waist","腰口宽",35,56],["hem","下摆宽",44,90],["length","裙长",28,75]];
const fabrics=[["#985945","陶土"],["#586957","苔绿"],["#506782","靛蓝"],["#484447","炭灰"]];
const freshPiece=()=>({waist:39,hem:68,length:51,color:fabrics[0][0]});
let project={format:"xingcai-skirt",version:1,pieces:[freshPiece(),freshPiece()],seams:["left","right"]};
let selected=0,mode="select",pendingEdge=null,running=false,model=null,viewer=null;
try{viewer=createViewer(el("stage"));}catch(error){
  console.error(error);el("phase").textContent="3D 初始化失败，请启用浏览器硬件加速";el("simulate").disabled=true;
}
function status(text){el("status").textContent=text;}
function pause(){running=false;viewer?.play(false);el("simulate").textContent="▶　模拟";}
function build(settled=false){
  pause();model=Cloth.create(project);
  if(settled)for(let i=0;i<30;i++)model.step();
  if(viewer){viewer.setModel(model,project);el("phase").textContent=settled?"垂坠预览":"布置状态";}
}
function redraw(){
  el("select").setAttribute("aria-pressed",mode==="select");el("sew").setAttribute("aria-pressed",mode==="sew");
  el("front").setAttribute("aria-pressed",selected===0);el("back").setAttribute("aria-pressed",selected===1);
  el("hint").textContent=mode==="select"?"点击裁片选择 · 拖动角点改版":pendingEdge?"请选择另一裁片的同侧边 · Esc 取消":"依次点击前后片的同侧边，建立侧缝";
  const maxWidth=Math.max(...project.pieces.map(p=>Math.max(p.waist,p.hem)));
  const s=Math.min(197/maxWidth,222/Math.max(...project.pieces.map(p=>p.length)));
  const top=78;
  let html='<defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M-1 1l2-2m-1 6l5-5m-1 6l2-2" stroke="#a97657" opacity=".14" stroke-width=".7"/></pattern></defs>';
  project.pieces.forEach((piece,p)=>{
    const cx=p===0?128:352, hw=piece.waist*s/2, hb=piece.hem*s/2,y=top+piece.length*s;
    const points=[[cx-hw,top],[cx+hw,top],[cx+hb,y],[cx-hb,y]];
    const ps=points.map(pair=>pair.join(",")).join(" ");
    const stroke=selected===p?"#9f4e32":"#817b70",fill=selected===p?"#f1dbca":"#e8e5da";
    html+='<g><polygon class="piece" data-piece="'+p+'" points="'+ps+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="1.8"/><polygon pointer-events="none" points="'+ps+'" fill="url(#hatch)"/>';
    html+='<g class="svg-label" text-anchor="middle" fill="#665548"><text x="'+cx+'" y="'+(top-12)+'" font-size="11">'+piece.waist+' cm</text><text x="'+cx+'" y="'+(y+20)+'" font-size="11">'+piece.hem+' cm</text><text x="'+cx+'" y="'+((top+y)/2)+'" font-size="15">'+(p===0?"前片":"后片")+'</text><path d="M'+cx+' '+((top+y)/2+10)+'v26m-3-4l3 4 3-4" fill="none" stroke="#9e8d79"/></g>';
    for(const [side,a,b] of [["left",points[0],points[3]],["right",points[1],points[2]]]){
      const attrs=' x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'"';
      if(project.seams.includes(side)||pendingEdge?.side===side&&pendingEdge.p===p){
        html+='<line '+attrs+' stroke="'+(pendingEdge?.side===side&&pendingEdge.p===p?"#267487":"#8d553d")+'" stroke-width="3.2" stroke-dasharray="5 4" pointer-events="none"/>';
      }
      if(mode==="sew")html+='<line class="edge" data-panel="'+p+'" data-side="'+side+'" '+attrs+' stroke="transparent" stroke-width="19"/>';
    }
    if(mode==="select"&&selected===p)points.forEach(([x,y],i)=>{html+='<rect data-corner="'+i+'" data-panel="'+p+'" x="'+(x-3.2)+'" y="'+(y-3.2)+'" width="6.4" height="6.4" fill="#fff8ed" stroke="#985338" style="cursor:nwse-resize"/>';});
    html+='</g>';
  });
  el("paper").innerHTML=html; el("paper").dataset.scale=s;
  el("measurements").innerHTML=fields.map(([key,label,min,max])=>'<label class="field">'+label+'<span class="inputwrap"><input aria-label="'+label+'" type="number" step=".1" min="'+min+'" max="'+max+'" value="'+project.pieces[selected][key]+'" data-field="'+key+'"><span>cm</span></span></label>').join("")+
  '<div class="field">面料颜色<div class="swatches">'+fabrics.map(([hex,name])=>'<button data-color="'+hex+'" title="'+name+'" aria-label="'+name+'" aria-pressed="'+(project.pieces[selected].color===hex)+'" style="background:'+hex+'"></button>').join("")+'</div></div>';
  el("seamList").innerHTML=project.seams.map(side=>'<div class="seam-row"><span class="stitch">┄</span><strong>'+vocabulary[side]+'侧缝</strong><span>前片 '+vocabulary[side]+'边　↔　后片 '+vocabulary[side]+'边</span><button data-remove="'+side+'" aria-label="拆除'+vocabulary[side]+'侧缝">拆除</button></div>').join("")||'<div class="empty">两片纸样尚未缝合，选择「线段缝纫」建立侧缝。</div>';
}
function switchMode(value){mode=value;pendingEdge=null;redraw();}
el("select").onclick=()=>switchMode("select");el("sew").onclick=()=>switchMode("sew");
el("front").onclick=()=>{selected=0;redraw();};el("back").onclick=()=>{selected=1;redraw();};
el("paper").addEventListener("click",event=>{
  const target=event.target;
  if(mode==="select"&&target.hasAttribute("data-piece")){selected=Number(target.dataset.piece);redraw();return;}
  if(mode!=="sew"||!target.dataset.side)return;
  const p=Number(target.dataset.panel),side=target.dataset.side;
  if(project.seams.includes(side)){status("这条侧缝已连接，可在缝合关系中拆除");return;}
  if(!pendingEdge){pendingEdge={p,side};redraw();return;}
  if(pendingEdge.p===p||pendingEdge.side!==side){status("请点另一片上相同方向的侧边");return;}
  project.seams.push(side);pendingEdge=null;build();redraw();status("已建立"+vocabulary[side]+"侧缝，点击模拟查看拉合");
});
let cornerDrag=null;
function point(event){return new DOMPoint(event.clientX,event.clientY).matrixTransform(el("paper").getScreenCTM().inverse());}
el("paper").onpointerdown=e=>{
  if(!e.target.hasAttribute("data-corner"))return;
  const corner=Number(e.target.dataset.corner),p=Number(e.target.dataset.panel);
  const original={...project.pieces[p]};
  cornerDrag={corner,p,original,origin:point(e),scale:Number(el("paper").dataset.scale)};
  el("paper").setPointerCapture(e.pointerId);pause();
};
const bounded=(n,min,max)=>Math.round(Math.max(min,Math.min(max,n))*10)/10;
el("paper").onpointermove=e=>{
  if(!cornerDrag)return;
  const {corner,p,original,origin,scale}=cornerDrag,pt=point(e),key=corner<2?"waist":"hem";
  const delta=2*(pt.x-origin.x)/scale*(corner===0||corner===3?-1:1);
  const [, , min,max]=fields.find(f=>f[0]===key);
  project.pieces[p][key]=bounded(original[key]+delta,min,max);
  if(corner>=2)project.pieces[p].length=bounded(original.length+(pt.y-origin.y)/scale,28,75);
  build();redraw();
};
el("paper").onlostpointercapture=()=>{if(cornerDrag){cornerDrag=null;status("裁片尺寸已更新");}};
el("measurements").onchange=e=>{
  const f=fields.find(entry=>entry[0]===e.target.dataset.field);
  if(!f)return;
  const n=e.target.valueAsNumber;
  if(!Number.isFinite(n)||n<f[2]||n>f[3]){status(f[1]+"范围为 "+f[2]+"–"+f[3]+" cm");redraw();return;}
  project.pieces[selected][f[0]]=bounded(n,f[2],f[3]);build();redraw();status("已更新裁片与 3D 布置");
};
el("measurements").onclick=e=>{
  if(!e.target.dataset.color)return;
  project.pieces[selected].color=e.target.dataset.color;viewer?.setModel(model,project);redraw();status("面料颜色已更新");
};
el("seamList").onclick=e=>{
  const side=e.target.dataset.remove;if(!side)return;
  project.seams=project.seams.filter(s=>s!==side);pendingEdge=null;build();redraw();status("已拆除"+vocabulary[side]+"侧缝");
};
document.addEventListener("keydown",e=>{if(e.key==="Escape"){switchMode("select");status("已返回选择工具");}});
el("arrange").onclick=()=>{pendingEdge=null;build();redraw();status("已按当前尺寸重新布置前后片");};
el("camera").onclick=()=>viewer?.resetView();
el("simulate").onclick=()=>{
  running=!running;viewer?.play(running);el("simulate").textContent=running?"Ⅱ　暂停":"▶　继续";
  el("phase").textContent=running?"模拟中":"已暂停";status(running?"模拟中 · 腰口固定，侧缝与人台碰撞已参与计算":"已暂停，可旋转查看样衣");
};
function validate(value){
  if(value?.format!=="xingcai-skirt"||value.version!==1||!Array.isArray(value.pieces)||value.pieces.length!==2||!Array.isArray(value.seams))throw Error("文件格式不受支持");
  const pieces=value.pieces.map(piece=>{
    const clean={};
    for(const [key,label,min,max] of fields){const n=piece?.[key];if(!Number.isFinite(n)||n<min||n>max)throw Error(label+"超出允许范围");clean[key]=bounded(n,min,max);}
    if(!/^#[a-fA-F0-9]{6}$/.test(piece.color))throw Error("布料颜色无效");
    clean.color=piece.color.toLowerCase();return clean;
  });
  if(value.seams.some(s=>s!=="left"&&s!=="right")||new Set(value.seams).size!==value.seams.length)throw Error("缝合关系无效");
  return {format:value.format,version:1,pieces,seams:[...value.seams]};
}
function download(name,content,type){
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement("a");
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
el("save").onclick=()=>{
  download("双片A字裙.xingcai.json",JSON.stringify(project,null,2),"application/json");
  status("工程已导出 · 包含纸样尺寸、颜色和侧缝");
};
el("obj").onclick=()=>{
  const lines=["# Xingcai skirt mesh. Coordinates in metres. Y up."];
  for(let p=0;p<2;p++){
    lines.push("o "+(p===0?"Front":"Back"));
    const offset=p*model.panelSize;
    for(let i=0;i<model.panelSize;i++){
      const k=(offset+i)*3;
      lines.push("v "+[0,1,2].map(d=>(model.pos[k+d]/100).toFixed(6)).join(" "));
    }
    const faces=model.faces[p];
    for(let i=0;i<faces.length;i+=3){
      lines.push("f "+[faces[i],faces[i+1],faces[i+2]].map(n=>n+offset+1).join(" "));
    }
  }
  download("双片A字裙.obj",lines.join("\n")+"\n","text/plain");
  status("已导出当前裙布网格 · OBJ 坐标以米为单位");
};
el("open").onclick=()=>el("file").click();
el("file").onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>100000)throw Error("文件过大");const next=validate(JSON.parse(await file.text()));project=next;selected=0;mode="select";pendingEdge=null;build(true);redraw();status("已打开工程");}
  catch(error){status("打开失败 · "+error.message);}
  e.target.value="";
};
redraw();build(true);
