"use strict";
// Sections are [height, centre X, centre Z, horizontal radius, depth radius] in cm.
const Avatar = (() => {
  const presets={form:null,regular:{bust:89,waist:69,hip:94},broad:{bust:102,waist:84,hip:102}};
  function parts(type,rings){
    if(!presets[type])return [];
    const shoulder=rings[11][1],hip=rings[3][1];
    const head=[[44,0,0,4,4],[48,0,1,4.5,5],[50,0,2,4.4,6],[54,0,1,6.5,8],[59,0,0,7.4,8.7],[64,0,-.5,6.4,7.7],[67,0,-.6,3.6,4.5],[68,0,-.6,.15,.15]];
    const leg=[[-80.8,10,3,3.8,8],[-78,10,3,4,9],[-75,10,0,3,4],[-70,10,-1,3,3.5],[-60,10,-.8,4.7,5.2],[-52,10,0,5.3,5.4],[-46,10,.8,4.9,5],[-39,9.8,0,6,6.5],[-30,9,0,7.4,8.3],[-22,8,0,8.3,9.4],[-17,7,0,7,8]];
    const arm=[[-23,shoulder+15,2,.6,1],[-20,shoulder+15,2,1.6,3],[-15,shoulder+14,1,2.4,3.5],[-10,shoulder+13,0,2.1,2.8],[0,shoulder+11,0,3.6,4],[9,shoulder+9,-1,3.5,3.8],[20,shoulder+6,0,4.2,4.7],[31,shoulder+2,0,5,5.4],[36,shoulder,0,4,4.2],[38,shoulder-1,0,1,1]];
    const all=[head];
    for(const sign of [-1,1]){
      all.push(leg.map(([y,x,z,a,b])=>[y,x*sign*hip/16.8,z,a*hip/16.8,b]),arm.map(([y,x,z,a,b])=>[y,x*sign,z,a,b]));
    }
    return all;
  }
  function collide(parts,pos,k){
    const y=pos[k+1];
    for(const rows of parts){
      if(y<rows[0][0]||y>rows.at(-1)[0])continue;
      let i=1;while(rows[i][0]<y)i++;
      const a=rows[i-1],b=rows[i],t=(y-a[0])/(b[0]-a[0]),v=j=>a[j]+(b[j]-a[j])*t;
      const x=v(1),z=v(2),rx=v(3)+.5,rz=v(4)+.5,dx=pos[k]-x,dz=pos[k+2]-z,h=Math.hypot(dx/rx,dz/rz);
      if(h<1){pos[k]=x+(h?dx/h:0);pos[k+2]=z+(h?dz/h:rz);}
    }
  }
  function geometry(T,rows){
    const verts=[],faces=[],n=40;
    rows.forEach(([y,x,z,a,b],j)=>{for(let i=0;i<n;i++){
      const angle=2*Math.PI*i/n;verts.push(x+a*Math.cos(angle),y,z+b*Math.sin(angle));
      if(j){const u=(j-1)*n+i,v=(j-1)*n+(i+1)%n;faces.push(u,u+n,v,v,u+n,v+n);}
    }});
    for(let i=1;i<n-1;i++){const end=(rows.length-1)*n;faces.push(0,i,i+1,end,end+i+1,end+i);}
    const g=new T.BufferGeometry();g.setIndex(faces);g.setAttribute("position",new T.Float32BufferAttribute(verts,3));g.computeVertexNormals();return g;
  }
  return {presets,parts,collide,geometry};
})();
