"use strict";
const Pattern = (() => {
  const names={cotton:"棉针织",linen:"亚麻",silk:"薄绸",jacquard:"四叶纹提花"};
  const round=n=>Math.round(n*10)/10;
  const key=(p,e)=>p+":"+e;
  const piece=(id,name,points,placement="front",height=0)=>({id,name,points,placement,height,offset:0,depth:0,rotation:0,pin:"top",fabric:"cotton",color:"#915c46"});
  const seam=(a,e,b,f,reverse=false)=>({a:[a,e],b:[b,f],reverse});
  function skirt(){
    const make=(id,label,side)=>piece(id,label,[[-19.5,0,0],[-34,51,0],[34,51,0],[19.5,0,0]],side);
    return {format:"xingcai",version:2,name:"双片 A 字裙",pieces:[make("front","前片","front"),make("back","后片","back")],seams:[seam("front",0,"back",0),seam("front",2,"back",2)]};
  }
  function vest(){
    const make=(id,name,side,neck)=>{
      const p=piece(id,name,[[-8,0,0],[-16.5,2,-3.5],[-23,21,0],[-24,53,1.5],[24,53,0],[23,21,-3.5],[16.5,2,0],[8,0,-neck]],side,42);
      p.color="#4c6974";return p;
    };
    return {format:"xingcai",version:2,name:"弧领背心",pieces:[make("front","前身","front",11),make("back","后身","back",3)],seams:[0,2,4,6].map(e=>seam("front",e,"back",e))};
  }
  function pointAt(points,i,t){
    const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
    const shift=4*(a[2]||0)*t*(1-t)/len;
    return [a[0]+dx*t-dy*shift,a[1]+dy*t+dx*shift];
  }
  function curve(p,i,spacing=2.7){
    const a=p.points[i],b=p.points[(i+1)%p.points.length];
    const count=Math.max(1,Math.ceil((Math.hypot(a[0]-b[0],a[1]-b[1])+2*Math.abs(a[2]))/spacing));
    return Array.from({length:count+1},(_,j)=>pointAt(p.points,i,j/count));
  }
  function length(p,i){const pts=curve(p,i,.5);return pts.slice(1).reduce((n,b,j)=>n+Math.hypot(b[0]-pts[j][0],b[1]-pts[j][1]),0);}
  function spanPoints(p,e,[lo,hi]){
    const steps=Math.max(1,Math.ceil((curve(p,e,.5).length-1)*(hi-lo)));
    return Array.from({length:steps+1},(_,i)=>pointAt(p.points,e,lo+(hi-lo)*i/steps));
  }
  function spanLength(p,e,range){
    if(!range)return length(p,e);
    const pts=spanPoints(p,e,range);
    return pts.slice(1).reduce((sum,q,i)=>sum+Math.hypot(q[0]-pts[i][0],q[1]-pts[i][1]),0);
  }
  function spans(seams,id,e){
    return seams.flatMap(s=>["a","b"].filter(k=>s[k][0]===id&&s[k][1]===e).map(k=>s[k+"Range"]??[0,1]));
  }
  function outline(p){return p.points.flatMap((_,i)=>curve(p,i).slice(0,-1));}
  function bounds(list){const xs=list.map(a=>a[0]),ys=list.map(a=>a[1]);return {l:Math.min(...xs),r:Math.max(...xs),t:Math.min(...ys),b:Math.max(...ys)};}
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  function intersects(a,b,c,d){
    if(Math.max(a[0],b[0])+1e-7<Math.min(c[0],d[0])||Math.max(c[0],d[0])+1e-7<Math.min(a[0],b[0])||Math.max(a[1],b[1])+1e-7<Math.min(c[1],d[1])||Math.max(c[1],d[1])+1e-7<Math.min(a[1],b[1]))return false;
    return cross(a,b,c)*cross(a,b,d)<=1e-10&&cross(c,d,a)*cross(c,d,b)<=1e-10;
  }
  function check(condition,message){if(!condition)throw Error(message);}
  function numeric(n,min,max){return Number.isFinite(n)&&n>=min&&n<=max;}
  function validate(raw){
    let v=structuredClone(raw);
    if(v?.format==="xingcai-skirt"&&v.version===1){
      const old=v;v=skirt();check(old.pieces?.length===2&&Array.isArray(old.seams)&&old.seams.every(s=>["left","right"].includes(s)),"旧版工程损坏");
      old.pieces.forEach(({waist,hem,length,color},i)=>{check(numeric(waist,35,56)&&numeric(hem,44,90)&&numeric(length,28,75),"旧版尺寸无效");v.pieces[i].points=[[-waist/2,0,0],[-hem/2,length,0],[hem/2,length,0],[waist/2,0,0]];v.pieces[i].color=color;});
      v.seams=v.seams.filter(s=>old.seams.includes(s.a[1]===0?"left":"right"));
    }
    check(v?.format==="xingcai"&&v.version===2,"工程格式不受支持");
    v.allowance??=1;
    v.light??="studio";check(["studio","warm","night","backlit"].includes(v.light),"灯光设置无效");
    check(v.avatar===undefined||["form","regular","broad"].includes(v.avatar),"模特类型无效");
    v.measures??=Dressform.defaults();
    check(numeric(v.measures.bust,65,135)&&numeric(v.measures.waist,48,125)&&numeric(v.measures.hip,65,145),"人台围度超出范围");
    check(numeric(v.allowance,0,4),"缝份应在 0–4 cm 内");
    check(typeof v.name==="string"&&v.name.trim()&&v.name.length<=64,"请填写工程名称（最多 64 字）");
    check(Array.isArray(v.pieces)&&v.pieces.length<=12&&Array.isArray(v.seams),"每个工程最多 12 片");
    const ids=new Set();
    for(const p of v.pieces){
      if(p.material!==undefined)MaterialSystem.validate(p.material);
      p.print??="solid";check(["solid","stripe","check"].includes(p.print),"织纹设置无效");
      p.takeup??=100;check(numeric(p.takeup,58,110),"收拢比例应在 58–110% 之间");
      if(p.textureScale!==undefined)check(numeric(p.textureScale,.4,3),"纹理倍率超出范围");
      if(p.roughness!==undefined)check(numeric(p.roughness,6,100),"粗糙度超出范围");
      if(p.sheenLevel!==undefined)check(numeric(p.sheenLevel,0,100),"绒光超出范围");
      if(p.pleat!==undefined)check(numeric(p.pleat,0,3.5),"压褶深度超出范围");
      if(p.pitch!==undefined)check(numeric(p.pitch,8,22),"褶距超出范围");
      if(p.layer!==undefined)check(Number.isInteger(p.layer)&&numeric(p.layer,0,4),"布料层级应为 0–4 的整数");
      if(p.meshSpacing!==undefined)check(numeric(p.meshSpacing,1.4,4),"网格间距应在 1.4–4 cm 内");
      check(typeof p.id==="string"&&/^[a-zA-Z0-9_-]{1,48}$/.test(p.id)&&!ids.has(p.id),"裁片编号无效");ids.add(p.id);
      check(typeof p.name==="string"&&p.name.trim()&&p.name.length<=40,"裁片名称无效");
      check(["front","back","flat"].includes(p.placement)&&["top","none"].includes(p.pin)&&Object.hasOwn(names,p.fabric)&&/^#[0-9a-f]{6}$/i.test(p.color),"布置或面料无效");
      check([p.height,p.offset,p.depth].every(n=>numeric(n,-100,100))&&numeric(p.rotation,-180,180),"布置参数超出范围");
      check(Array.isArray(p.points)&&p.points.length>=3&&p.points.length<=32,"轮廓需要 3–32 个角点");
      if(p.frame!==undefined)check(Array.isArray(p.frame)&&p.frame.length>=3&&p.frame.length<=32&&p.frame.every(a=>Array.isArray(a)&&a.length===3&&a.slice(0,2).every(n=>numeric(n,-160,160))&&numeric(a[2],-40,40)),"布置参考轮廓无效");
      for(const [i,a] of p.points.entries()){
        const b=p.points[(i+1)%p.points.length];
        check(Array.isArray(a)&&a.length===3&&a.slice(0,2).every(n=>numeric(n,-160,160))&&numeric(a[2],-40,40),"轮廓数值无效");
        check(Math.hypot(b[0]-a[0],b[1]-a[1])>=1,"相邻角点距离至少 1 cm");
      }
      const q=outline(p),box=bounds(q);
      check(box.r-box.l<=150&&box.b-box.t<=150,"单片尺寸上限为 150 cm");
      let area=0;
      for(let i=0;i<q.length;i++){
        const end=(i+1)%q.length;area+=cross([0,0],q[i],q[end]);
        for(let j=i+2;j<q.length;j++){if((j+1)%q.length!==i)check(!intersects(q[i],q[end],q[j],q[(j+1)%q.length]),"轮廓交叉，请调整角点或弧度");}
      }
      check(Math.abs(area)>6,"裁片面积太小");
    }
    const used=new Map();
    for(const s of v.seams){
      if(s.gather!==undefined)check(typeof s.gather==="boolean","抽褶标记无效");
      check(typeof s.reverse==="boolean","缝线方向无效");
      for(const side of ["a","b"]){
        const end=s[side],range=s[side+"Range"]===undefined?[0,1]:s[side+"Range"];
        check(Array.isArray(end)&&end.length===2,"缝线端点无效");
        const p=v.pieces.find(p=>p.id===end[0]);check(p&&Number.isInteger(end[1])&&end[1]>=0&&end[1]<p.points.length,"缝线引用了不存在的边");
        check(Array.isArray(range)&&range.length===2&&range.every(t=>numeric(t,0,1))&&range[1]>range[0],"缝线区间无效");
        if(s[side+"Range"])check(spanLength(p,end[1],range)>=.5,"局部缝线至少需要 0.5 cm");
        const k=key(...end),prior=used.get(k)??[];
        check(!prior.some(([a,b])=>range[0]<b&&range[1]>a),"同一段边已缝合");
        prior.push(range);used.set(k,prior);
      }
    }
    return v;
  }
  return {skirt,vest,piece,seam,names,curve,pointAt,length,spanPoints,spanLength,spans,outline,bounds,validate,round,key};
})();

