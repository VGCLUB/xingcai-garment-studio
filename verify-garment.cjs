"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=__dirname;
const scope=vm.createContext({structuredClone,console,btoa,atob,poly2tri:require("./vendor/poly2tri.min.js"),assert});
for(const n of ["cloth","dressform","pattern","cutting","garment","examples"])vm.runInContext(fs.readFileSync(path.join(root,n+".js"),"utf8"),scope);
vm.runInContext(`
const names=[];
for(const example of Examples){
  const {frameState,...data}=example,p=Pattern.validate(data),m=Garment.create(p);m.restore(frameState);
  const initial=m.pos.slice();for(let i=0;i<10;i++)m.step();
  assert(m.pos.every(Number.isFinite));
  assert(initial.some((n,i)=>m.movable[Math.floor(i/3)]&&Math.abs(n-m.pos[i])>1e-6));
  for(let i=0;i<m.movable.length;i++)if(!m.movable[i])assert.deepEqual(m.pos.slice(i*3,i*3+3),initial.slice(i*3,i*3+3));
  assert(Math.abs(Dressform.circumference(m.rings[9])-p.measures.bust)<.001);
  assert(Math.abs(Dressform.circumference(m.rings[5])-p.measures.waist)<.001);
  names.push(p.name);
}
const vest=Pattern.validate(Pattern.vest()),m=Garment.create(vest),surface=Dressform.surface(m.rings);
for(let time=1;time<=120;time++){
  m.step();if(![24,60,120].includes(time))continue;
  let deepest=0;
  m.panels.forEach((panel,i)=>{for(let k=0;k<panel.faces.length;k+=3){
    const tri=panel.faces.slice(k,k+3).map(id=>id+m.offsets[i]);
    const [x,y,z]=[0,1,2].map(d=>tri.reduce((s,id)=>s+m.pos[id*3+d],0)/3);
    const r=surface(y);if(r)deepest=Math.max(deepest,(1-Math.hypot(x/r[0],z/r[1]))*Math.min(...r));
  }});
  assert(deepest<.1,"Face centre penetrates dress form: "+deepest);
}
let max=0;
for(const e of [0,6]){const a=m.panels[0].chains[e],b=m.panels[1].chains[e];a.forEach((id,i)=>{const back=b[i]+m.offsets[1];max=Math.max(max,Math.hypot(...[0,1,2].map(d=>m.pos[3*id+d]-m.pos[3*back+d])));});}
assert(max<.1);console.log("PASS",names.join(" / "),"shoulder gap",max.toFixed(3),"cm");
`,scope);
