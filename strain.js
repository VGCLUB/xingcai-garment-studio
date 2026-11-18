"use strict";
const Strain=(()=>{
  // Largest singular value of the 2D pattern -> 3D drape deformation gradient.
  function field(panel,xyz){
    const mean=new Float64Array(panel.coords.length),area=new Float64Array(mean.length);
    let peak=0;
    for(let f=0;f<panel.faces.length;f+=3){
      const [i,j,k]=panel.faces.slice(f,f+3),[a,b,c]=[panel.coords[i],panel.coords[j],panel.coords[k]];
      const x=b[0]-a[0],y=b[1]-a[1],u=c[0]-a[0],v=c[1]-a[1],det=x*v-u*y;
      if(Math.abs(det)<1e-10)continue;
      let xx=0,yy=0,xy=0;
      for(let d=0;d<3;d++){
        const e=xyz[3*j+d]-xyz[3*i+d],h=xyz[3*k+d]-xyz[3*i+d];
        const gx=(e*v-h*y)/det,gy=(h*x-e*u)/det;
        xx+=gx*gx;yy+=gy*gy;xy+=gx*gy;
      }
      const stretch=Math.sqrt((xx+yy+Math.hypot(xx-yy,2*xy))*.5);
      peak=Math.max(peak,stretch);
      for(const id of [i,j,k]){mean[id]+=Math.abs(det)*stretch;area[id]+=Math.abs(det);}
    }
    for(let i=0;i<mean.length;i++)mean[i]=area[i]?mean[i]/area[i]:1;
    return {mean,peak};
  }
  return {field};
})();
