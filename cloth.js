"use strict";
// World and pattern coordinates use centimetres. Each panel spans half the mannequin.
const Cloth = (() => {
  const columns = 28, rows = 20, stride = columns + 1, panelSize = stride * (rows + 1);
  const body = [
    [-32, 9.5, 7], [-29, 14, 9.8], [-22, 16.4, 11.5], [-16, 16.8, 11.7], [-9, 14.7, 10.6],
    [0, 12.1, 9.25], [5, 12.5, 9.5], [12, 14.8, 10.4], [21, 17.3, 12], [26, 17.6, 11.8],
    [32, 17, 9.6], [36, 18, 7.5], [38.5, 13.5, 6.5], [41.5, 6.1, 5.4], [47, 5.3, 4.8]
  ];
  function radii(y) {
    if (y < body[0][0] || y > body[body.length - 1][0]) return null;
    const k = body.findIndex(section => section[0] >= y);
    if (!k) return body[0].slice(1);
    const a = body[k-1], b = body[k], t = (y-a[0])/(b[0]-a[0]);
    return [a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
  }
  function create(project) {
    const n = panelSize*2, pos = new Float64Array(n*3), old = new Float64Array(n*3);
    const movable = new Uint8Array(n), links = [], faces = [[],[]], stitches = [];
    const index = (p,i,j) => p*panelSize + j*stride+i;
    for(let p=0;p<2;p++){
      const piece=project.pieces[p], flat=[];
      for(let j=0;j<=rows;j++) {
        const v=j/rows, width=piece.waist+(piece.hem-piece.waist)*v;
        const rx=width/2.83, rz=rx*.78;
        for(let i=0;i<=columns;i++){
          const u=i/columns, id=index(p,i,j), k=id*3, sign=p===0?1:-1;
          const angle=Math.PI*(1-u);
          const fold=(.3+2*v)*Math.sin(angle*9 + .25*p + v*.8)*Math.sin(Math.PI*u);
          pos[k]=(rx+fold)*Math.cos(angle);
          pos[k+1]=-piece.length*v;
          pos[k+2]=sign*((rz+fold)*Math.sin(angle)+.65+4*v);
          if(j===0){
            const waistBody=radii(0);
            const radial=Math.hypot(pos[k]/(waistBody[0]+.55),pos[k+2]/(waistBody[1]+.55));
            if(radial<1){pos[k]/=radial;pos[k+2]/=radial;}
          }
          flat.push([(u-.5)*width,-v*piece.length]);
          movable[id]=j===0?0:1;
          if(i<columns && j<rows){
            const local=j*stride+i;
            const tri=[local,local+stride,local+1,local+1,local+stride,local+stride+1];
            faces[p].push(...(p===0?tri:tri.reverse()));
          }
        }
      }
      function connect(i,j,di,dj,k){
        if(i+di>columns || j+dj>rows || i+di<0) return;
        const a=j*stride+i,b=(j+dj)*stride+i+di;
        links.push([a+p*panelSize,b+p*panelSize,Math.hypot(flat[a][0]-flat[b][0],flat[a][1]-flat[b][1]),k]);
      }
      for(let j=0;j<=rows;j++) for(let i=0;i<=columns;i++){
        connect(i,j,1,0,.86);connect(i,j,0,1,.92);
        connect(i,j,1,1,.44);connect(i,j,-1,1,.44);
        connect(i,j,2,0,.19);connect(i,j,0,2,.18);
      }
    }
    for (const side of project.seams){
      const i=side==="left"?0:columns;
      for(let j=0;j<=rows;j++) stitches.push([index(0,i,j),index(1,i,j),.35,.86]);
    }
    old.set(pos);
    function satisfy(link) {
      const [a,b,rest,stiff]=link, w=movable[a]+movable[b];
      if(!w)return;
      const ka=3*a,kb=3*b,dx=pos[kb]-pos[ka],dy=pos[kb+1]-pos[ka+1],dz=pos[kb+2]-pos[ka+2];
      const len=Math.sqrt(dx*dx+dy*dy+dz*dz);
      if(len<1e-8)return;
      const f=(1-rest/len)*stiff/w;
      if(movable[a]){pos[ka]+=f*dx; pos[ka+1]+=f*dy; pos[ka+2]+=f*dz;}
      if(movable[b]){pos[kb]-=f*dx; pos[kb+1]-=f*dy; pos[kb+2]-=f*dz;}
    }
    function collide(){
      for(let id=0;id<n;id++){
        if(!movable[id])continue;
        const k=id*3, r=radii(pos[k+1]);
        if(!r)continue;
        const rx=r[0]+.55,rz=r[1]+.55,h=Math.hypot(pos[k]/rx,pos[k+2]/rz);
        if(h>1e-8 && h<1){pos[k]/=h;pos[k+2]/=h;}
      }
    }
    function step(){
      for(let id=0;id<n;id++){
        if(!movable[id])continue;
        for(let d=0;d<3;d++){
          const k=id*3+d, current=pos[k];
          pos[k]+=(current-old[k])*.975+(d===1?-981/3600:0);
          old[k]=current;
        }
      }
      for(let k=0;k<5;k++){
        for(const link of links)satisfy(link);
        for(const s of stitches)satisfy(s);
        collide();
      }
    }
    return {pos,faces,step,panelSize,index};
  }
  return {create,body,radii,rows,columns};
})();
