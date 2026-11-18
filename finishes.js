"use strict";
const Finishes=(()=>{
  const T=THREE;
  // Interpolate a point on the paper triangle; the same weights follow the draped cloth.
  function sample(panel,x,y,fallback,anchor){
    const pts=panel.coords;
    for(let j=0;j<panel.faces.length;j+=3){
      const ia=panel.faces[j],ib=panel.faces[j+1],ic=panel.faces[j+2],a=pts[ia],b=pts[ib],c=pts[ic];
      const det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(det)<1e-8)continue;
      const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/det,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/det;
      if(u>=-.0001&&v>=-.0001&&u+v<1.0001)return [[ia,u],[ib,v],[ic,1-u-v]];
    }
    return [[anchor,.75],[fallback,.25]];
  }
  function create(panel,piece,project,material){
    const samples=[],uv=[],indices=[],order=panel.polygon;
    const winding=Math.sign(order.reduce((s,a,i)=>{const b=order[(i+1)%order.length];return s+a[0]*b[1]-a[1]*b[0];},0));
    panel.chains.forEach((chain,e)=>{
      const used=Pattern.spans(project.seams,piece.id,e);
      if(used.some(([lo,hi])=>lo===0&&hi===1))return;
      const start=samples.length;let along=0;
      const width=piece.height>20 ? .88 : .66;
      chain.forEach((id,i)=>{
        const v=panel.coords[id],prev=panel.coords[chain[Math.max(0,i-1)]],next=panel.coords[chain[Math.min(chain.length-1,i+1)]];
        const dx=next[0]-prev[0],dy=next[1]-prev[1],len=Math.hypot(dx,dy)||1;
        const nx=-dy*winding/len,ny=dx*winding/len;
        if(i)along+=Math.hypot(v[0]-prev[0],v[1]-prev[1]);
        let fallback=id;
        for(let f=0;f<panel.faces.length;f+=3){const tri=panel.faces.slice(f,f+3);if(tri.includes(id)){fallback=tri.find(a=>a!==id);break;}}
        for(const [d,lift] of [[0,-.07],[.10,.08],[.30,.145],[.78,.125],[1,.045]]){
          const st=d===0?[[id,1]]:sample(panel,v[0]+nx*width*d,v[1]+ny*width*d,fallback,id);
          samples.push({st,lift});uv.push(along/10,d*width/10);
        }
        const t=i?(panel.parameters[e][i-1]+panel.parameters[e][i])*.5:0;
        if(i&&!used.some(([lo,hi])=>t>lo&&t<hi)){for(let q=0;q<4;q++){const a=start+(i-1)*5+q;indices.push(a,a+5,a+1,a+1,a+5,a+6);}}
      });
    });
    const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(new Float32Array(3*samples.length),3));g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));g.setIndex(indices);
    const obj=new T.Mesh(g,material);obj.frustumCulled=false;obj.castShadow=true;obj.receiveShadow=true;
    obj.userData.binding=true;
    function update(base){
      const pts=base.attributes.position.array,normals=base.attributes.normal.array,out=g.attributes.position;
      samples.forEach(({st,lift},i)=>{for(let d=0;d<3;d++){let n=0;for(const [id,w] of st)n+=w*(pts[3*id+d]+lift*normals[3*id+d]);out.array[3*i+d]=n;}});
      out.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
    }
    return {obj,update};
  }
  // One Loop subdivision pass on the final drape. UVs follow the same stencil.
  function smooth(g,passes=1){
    let pts=Array.from(g.attributes.position.array),uv=Array.from(g.attributes.uv.array),tris=Array.from(g.index.array);
    for(let pass=0;pass<passes;pass++){
      const n=pts.length/3,neighbors=Array.from({length:n},()=>new Set()),borders=Array.from({length:n},()=>[]),edges=new Map();
      const key=(a,b)=>Math.min(a,b)*n+Math.max(a,b);
      for(let i=0;i<tris.length;i+=3){for(let k=0;k<3;k++){
        const a=tris[i+k],b=tris[i+(k+1)%3],c=tris[i+(k+2)%3],id=key(a,b);
        neighbors[a].add(b);neighbors[b].add(a);
        if(edges.has(id))edges.get(id).op.push(c);else edges.set(id,{a,b,op:[c],index:n+edges.size});
      }}
      const nextP=[],nextUV=[],nextT=[];
      function put(id,weights){
        for(let d=0;d<3;d++)nextP[3*id+d]=weights.reduce((s,[j,w])=>s+pts[3*j+d]*w,0);
        for(let d=0;d<2;d++)nextUV[2*id+d]=weights.reduce((s,[j,w])=>s+uv[2*j+d]*w,0);
      }
      for(const e of edges.values()){
        if(e.op.length===1){borders[e.a].push(e.b);borders[e.b].push(e.a);put(e.index,[[e.a,.5],[e.b,.5]]);}
        else put(e.index,[[e.a,.375],[e.b,.375],[e.op[0],.125],[e.op[1],.125]]);
      }
      for(let i=0;i<n;i++){
        const b=borders[i],adj=[...neighbors[i]];
        if(b.length===2)put(i,[[i,.75],[b[0],.125],[b[1],.125]]);
        else if(!adj.length||b.length)put(i,[[i,1]]);
        else{const beta=adj.length===3?3/16:3/(8*adj.length);put(i,[[i,1-adj.length*beta],...adj.map(j=>[j,beta])]);}
      }
      for(let i=0;i<tris.length;i+=3){
        const [a,b,c]=tris.slice(i,i+3),ab=edges.get(key(a,b)).index,bc=edges.get(key(b,c)).index,ca=edges.get(key(c,a)).index;
        nextT.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);
      }
      pts=nextP;uv=nextUV;tris=nextT;
    }
    const out=new T.BufferGeometry();out.setAttribute("position",new T.Float32BufferAttribute(pts,3));out.setAttribute("uv",new T.Float32BufferAttribute(uv,2));out.setIndex(tris);out.computeVertexNormals();return out;
  }
  return {create,smooth};
})();
