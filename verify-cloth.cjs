"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const solver=vm.runInNewContext(fs.readFileSync(path.join(__dirname,"cloth.js"),"utf8")+"\nCloth;");
const panel={waist:39,hem:68,length:51};
function sideGap(model,i){
  let sum=0;
  for(let j=1;j<=solver.rows;j++){
    const a=3*model.index(0,i,j),b=3*model.index(1,i,j);
    sum+=Math.hypot(...[0,1,2].map(d=>model.pos[a+d]-model.pos[b+d]));
  }
  return sum/solver.rows;
}
function run(seams){
  const m=solver.create({pieces:[panel,panel],seams}),before=sideGap(m,0);
  const start=m.pos.slice();
  for(let t=0;t<120;t++)m.step();
  assert(m.pos.every(Number.isFinite));
  for(let p=0;p<2;p++)for(let i=0;i<=solver.columns;i++){
    const a=m.index(p,i,0)*3;assert.deepEqual(m.pos.slice(a,a+3),start.slice(a,a+3));
  }
  for(let id=0;id<m.pos.length/3;id++){
    const k=3*id,r=solver.radii(m.pos[k+1]);if(!r)continue;
    assert(Math.hypot(m.pos[k]/(r[0]+.55),m.pos[k+2]/(r[1]+.55))>=.99999);
  }
  return {before,left:sideGap(m,0),right:sideGap(m,solver.columns)};
}
const open=run([]),sewn=run(["left","right"]),single=run(["left"]);
assert(sewn.left<1 && sewn.right<1);assert(single.left<1);
assert(open.left>sewn.left*2 && single.right>single.left*2);
console.log(JSON.stringify({unit:"cm",steps:120,open,sewn,single},null,2));
