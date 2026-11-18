"use strict";
const Dressform=(()=>{
  const circumference=([,a,b])=>Math.PI*(3*(a+b)-Math.sqrt((3*a+b)*(a+3*b)));
  const base={bust:circumference(Cloth.body[9]),waist:circumference(Cloth.body[5]),hip:circumference(Cloth.body[3])};
  const defaults=()=>Object.fromEntries(Object.entries(base).map(([key,n])=>[key,Math.round(n*10)/10]));
  function rings(measures=defaults()){
    const ratio=k=>measures[k]/base[k],anchors=[[-32,ratio("hip")],[-16,ratio("hip")],[0,ratio("waist")],[26,ratio("bust")],[38.5,1],[47,1]];
    return Cloth.body.map(([y,x,z])=>{
      const k=anchors.findIndex(a=>a[0]>=y),[y1,s1]=anchors[k], [y0,s0]=anchors[Math.max(0,k-1)];
      const s=y1===y0?s0:s0+(s1-s0)*(y-y0)/(y1-y0);
      return [y,x*s,z*s];
    });
  }
  function surface(rings){
    return y=>{
      if(y<rings[0][0]||y>rings.at(-1)[0])return null;
      const k=rings.findIndex(a=>a[0]>=y),a=rings[Math.max(0,k-1)],b=rings[k],t=k?(y-a[0])/(b[0]-a[0]):0;
      return [a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
    };
  }
  return {defaults,rings,surface,circumference};
})();
