"use strict";
const Garment = (() => {
  function crossingX(outline,y){
    const xs=[];
    for(let i=0;i<outline.length;i++){
      const a=outline[i],b=outline[(i+1)%outline.length];
      if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]));
    }
    return xs.sort((a,b)=>a-b);
  }
  function topology(piece,seams,quality){
    const spacing=piece.meshSpacing??2.8;
    const chains=[],parameters=[],ring=[],coords=[];
    function add(x,y){const q=new poly2tri.Point(x,y);q.id=coords.length;coords.push([x,y]);return q;}
    for(let e=0;e<piece.points.length;e++){
      const count=Pattern.curve(piece,e,spacing).length-1;
      const ends=[...new Set([0,1,...Pattern.spans(seams,piece.id,e).flat()])];
      const interior=Array.from({length:count-1},(_,i)=>(i+1)/count).filter(t=>ends.every(v=>Math.abs(t-v)>.08/count));
      const ts=ends.concat(interior).sort((a,b)=>a-b);
      parameters.push(ts);
      const chain=ts.slice(0,-1).map(t=>add(...Pattern.pointAt(piece.points,e,t)));
      chains.push(chain.map(p=>p.id));ring.push(...chain);
    }
    chains.forEach((c,i)=>c.push(chains[(i+1)%chains.length][0]));
    const polygon=coords.slice(),box=Pattern.bounds(polygon),sweep=new poly2tri.SweepContext(ring.slice());
    function nearOutline(x,y){
      if(!quality)return polygon.some(q=>Math.hypot(q[0]-x,q[1]-y)<.6);
      const gap=spacing*.32;
      return polygon.some((a,i)=>{
        const b=polygon[(i+1)%polygon.length];
        if(x<Math.min(a[0],b[0])-gap||x>Math.max(a[0],b[0])+gap||y<Math.min(a[1],b[1])-gap||y>Math.max(a[1],b[1])+gap)return false;
        const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
        return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)<gap;
      });
    }
    for(let y=box.t+spacing*.61,row=0;y<box.b;y+=spacing*.88,row++){
      const xs=crossingX(polygon,y);
      for(let i=0;i+1<xs.length;i+=2){
        for(let x=box.l+spacing*(row%2 ? .74 : .24);x<xs[i+1]-.45;x+=spacing){
          if(x>xs[i]+.45 && !nearOutline(x,y))sweep.addPoint(add(x,y));
        }
      }
    }
    sweep.triangulate();
    const faces=sweep.getTriangles().flatMap(tri=>{
      const [a,b,c]=tri.getPoints().map(p=>p.id),A=coords[a],B=coords[b],C=coords[c];
      const orient=(B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]);
      return (orient>0)===(piece.placement==="back")?[a,b,c]:[a,c,b];
    });
    return {coords,chains,parameters,faces,polygon,box};
  }
  function outside(pos,k,surface){
    const y=pos[k+1],r=surface(y>34 ? y-.7 : y);
    if(!r)return;
    const padding=.52+Math.min(1,Math.max(0,(y-30)/5))*1.05;
    const x=pos[k],z=pos[k+2],h=Math.hypot(x/(r[0]+padding),z/(r[1]+padding));
    if(h>=1)return;
    if(y>34){
      for(let dy=.4;dy<=8;dy+=.4){
        const up=surface(y+dy-.7);
        if(!up||Math.hypot(x/(up[0]+padding),z/(up[1]+padding))>=1){
          if(dy<Math.hypot(x,z)*(1/Math.max(h,.001)-1)){pos[k+1]+=dy;return;}break;
        }
      }
    }
    if(h<1e-7){pos[k+2]=r[1]+padding;return;}
    pos[k]=x/h;pos[k+2]=z/h;
  }
  function create(project){
    const rings=Dressform.rings(project.measures),surface=Dressform.surface(rings);
    const avatarParts=typeof Avatar==="undefined"?[]:Avatar.parts(project.avatar,rings);
    function collide(pos,k){outside(pos,k,surface);if(avatarParts.length)Avatar.collide(avatarParts,pos,k);}
    const panels=project.pieces.map(p=>topology(p,project.seams,project.meshQuality===2)),offsets=[0];
    for(const t of panels)offsets.push(offsets.at(-1)+t.coords.length);
    const count=offsets.at(-1),pos=new Float64Array(count*3),movable=new Uint8Array(count),links=[],stitches=[],creases=[];
    const settings={cotton:[.90,.13],linen:[.98,.35],silk:[.76,.035],jacquard:[.91,.17]};
    panels.forEach((t,p)=>{
      const piece=project.pieces[p],start=offsets[p],sign=piece.placement==="back"?-1:1;
      const profile=piece.frame?Pattern.outline({points:piece.frame}):t.polygon;
      const frameBox=Pattern.bounds(profile),mid=(frameBox.l+frameBox.r)/2;
      const gatheredWaist=project.seams.some(s=>{
        if(!s.gather||s.aRange||s.bRange)return false;
        const end=[s.a,s.b].find(([id])=>id===piece.id);
        if(!end)return false;
        const other=end===s.a?s.b:s.a,otherPiece=project.pieces.find(p=>p.id===other[0]);
        return Pattern.length(piece,end[1])>Pattern.length(otherPiece,other[1])&&
          t.chains[end[1]].every(i=>t.coords[i][1]<frameBox.t+1);
      });
      const fullness=y=>gatheredWaist?Math.min(1,Math.max(0,(y-frameBox.t)/8)):1;
      const sewnEdges=new Map(),angle=piece.rotation*Math.PI/180;
      const fold=x=>(piece.pleat??0)*(2/Math.PI)*Math.asin(Math.sin(2*Math.PI*x/(piece.pitch??13)));
      const adjacent=t.coords.map(()=>new Set());
      t.coords.forEach(([x,y],i)=>{
        const k=3*(start+i),worldY=piece.height-y;
        let xx=x-mid,zz=0;
        if(piece.placement!=="flat"){
          const xs=crossingX(profile,Math.min(frameBox.b-.001,Math.max(frameBox.t+.001,y)));
          const half=Math.max(3,Math.abs((xs.at(-1)??t.box.r)-mid),Math.abs((xs[0]??t.box.l)-mid),piece.height>20?22:0);
          const phi=Math.max(-1,Math.min(1,xx/half))*Math.PI/2;
          const hem=(y-frameBox.t)/(frameBox.b-frameBox.t),gather=1-(piece.takeup??100)/100;
          const rx=half/1.40*(1-gather*(1-.32*hem));
          const ripple=fullness(y)*(Math.sin(7*phi+.6*p)*Math.cos(phi)*hem+
            gather*(6+5*hem)*Math.cos(13*phi+hem*.85+.32*Math.sin(3*phi))*Math.cos(phi)+fold(x));
          xx=(rx+ripple)*Math.sin(phi);
          const shoulder=piece.height>20?Math.min(1,Math.max(.015,(y-frameBox.t)/11)):1;
          zz=sign*((rx*.8+ripple)*Math.cos(phi)*shoulder+(.3+2*hem));
        }
        if(piece.placement==="flat")zz+=fold(x);
        pos[k]=xx*Math.cos(angle)+zz*Math.sin(angle)+piece.offset;
        pos[k+1]=worldY;pos[k+2]=zz*Math.cos(angle)-xx*Math.sin(angle)+piece.depth;
        movable[start+i]=piece.pin==="top"&&y<=frameBox.t+(piece.height>20?1.7:.5)?0:1;
        collide(pos,k);
      });
      const [stretch,bend]=settings[piece.fabric];
      const connect=(a,b,stiff)=>links.push([start+a,start+b,Math.hypot(t.coords[a][0]-t.coords[b][0],t.coords[a][1]-t.coords[b][1]),stiff]);
      for(let f=0;f<t.faces.length;f+=3){
        const tri=t.faces.slice(f,f+3);
        for(let j=0;j<3;j++){
          const a=tri[j],b=tri[(j+1)%3],c=tri[(j+2)%3],key=Math.min(a,b)*t.coords.length+Math.max(a,b);
          if(sewnEdges.has(key))connect(c,sewnEdges.get(key),bend);
          else{connect(a,b,stretch);sewnEdges.set(key,c);adjacent[a].add(b);adjacent[b].add(a);}
        }
      }
      if(piece.pleat>0)t.coords.forEach(([x,y],i)=>{
        const near=[...adjacent[i]],score=j=>Math.abs(t.coords[j][1]-y)/(Math.abs(t.coords[j][0]-x)+.01);
        const nearest=sign=>near.filter(j=>sign*(t.coords[j][0]-x)>.4).sort((j,k)=>score(j)-score(k))[0];
        const a=nearest(-1),b=nearest(1);if(a===undefined||b===undefined)return;
        const mix=(x-t.coords[a][0])/(t.coords[b][0]-t.coords[a][0]);
        const target=fullness(y)*(fold(x)-(1-mix)*fold(t.coords[a][0])-mix*fold(t.coords[b][0]));
        const k=3*(start+i),dx=pos[k]-piece.offset,dz=pos[k+2]-piece.depth,len=Math.hypot(dx,dz)||1;
        const nx=piece.placement==="flat"?Math.sin(angle):dx/len,nz=piece.placement==="flat"?Math.cos(angle):dz/len;
        creases.push([start+i,start+a,start+b,mix,target,nx,nz]);
      });
    });
    const edge=([id,e],[lo,hi]=[0,1])=>{
      const i=project.pieces.findIndex(p=>p.id===id),panel=panels[i];
      return panel.chains[e].filter((_,j)=>panel.parameters[e][j]>=lo&&panel.parameters[e][j]<=hi).map(v=>v+offsets[i]);
    };
    // Pair vertices by relative arc length, interpolating along the opposite mesh edge.
    const arc=ids=>{
      const dist=[0];
      for(let j=1;j<ids.length;j++){
        const q=id=>{const p=offsets.findIndex(n=>n>id)-1;return panels[p].coords[id-offsets[p]];};
        const a=q(ids[j-1]),b=q(ids[j]);dist.push(dist.at(-1)+Math.hypot(b[0]-a[0],b[1]-a[1]));
      }
      return dist.map(n=>n/dist.at(-1));
    };
    for(const s of project.seams){
      const a=edge(s.a,s.aRange),b=edge(s.b,s.bRange);if(s.reverse)b.reverse();
      // A sewn shoulder has one support location. Two independently fixed
      // boundaries would otherwise preserve their initial air gap forever.
      const ua=arc(a),ub=arc(b);
      for(let j=0;j<b.length;j++){
        if(movable[b[j]])continue;
        let i=0;while(i<ua.length-1&&Math.abs(ua[i+1]-ub[j])<Math.abs(ua[i]-ub[j]))i++;
        if(movable[a[i]]||a[i]===b[j])continue;
        const left=a[i]*3,right=b[j]*3;
        if(Math.abs(ua[i]-ub[j])<.001){
          for(let d=0;d<3;d++)pos[left+d]=(pos[left+d]+pos[right+d])*.5;
          collide(pos,left);for(let d=0;d<3;d++)pos[right+d]=pos[left+d];
        }else movable[b[j]]=1;
      }
      function pair(source,target){
        const u=arc(source),v=arc(target);let j=0;
        source.forEach((id,i)=>{while(j<v.length-2&&v[j+1]<u[i])j++;stitches.push([id,target[j],target[j+1],(u[i]-v[j])/(v[j+1]-v[j])]);});
      }
      pair(a,b);pair(b,a);
    }
    const old=pos.slice();
    const separateLayers=layerConstraint(project,panels,offsets,pos,movable,old);
    function substep(){
      for(let i=0;i<count;i++)if(movable[i]){
        for(let d=0;d<3;d++){const k=i*3+d,n=pos[k];pos[k]+=.983*(n-old[k])-(d===1 ? .068125 : 0);old[k]=n;}
      }
      for(let iter=0;iter<5;iter++){
        for(const [a,b,rest,stiff] of links){
          const ka=3*a,kb=3*b,w=movable[a]+movable[b];if(!w)continue;
          const dx=pos[kb]-pos[ka],dy=pos[kb+1]-pos[ka+1],dz=pos[kb+2]-pos[ka+2];
          const f=(1-rest/Math.max(.00001,Math.sqrt(dx*dx+dy*dy+dz*dz)))*stiff/w;
          if(movable[a]){pos[ka]+=dx*f;pos[ka+1]+=dy*f;pos[ka+2]+=dz*f;}
          if(movable[b]){pos[kb]-=dx*f;pos[kb+1]-=dy*f;pos[kb+2]-=dz*f;}
        }
        // A pressed pleat retains a signed bend across the grain. The constraint
        // distributes its correction over all three nodes and leaves gravity free.
        for(const [i,a,b,t,target,nx,nz] of creases){
          const u=1-t,w=movable[i]+u*u*movable[a]+t*t*movable[b];if(!w)continue;
          const h=nx*(pos[3*i]-u*pos[3*a]-t*pos[3*b])+nz*(pos[3*i+2]-u*pos[3*a+2]-t*pos[3*b+2]);
          const d=(target-h)*.72/w;
          pos[3*i]+=movable[i]*d*nx;pos[3*i+2]+=movable[i]*d*nz;
          pos[3*a]-=movable[a]*u*d*nx;pos[3*a+2]-=movable[a]*u*d*nz;
          pos[3*b]-=movable[b]*t*d*nx;pos[3*b+2]-=movable[b]*t*d*nz;
        }
        for(const [a,b,c,t] of stitches){
          const u=1-t,w=movable[a]+movable[b]*u*u+movable[c]*t*t;if(!w)continue;
          for(let d=0;d<3;d++){
            const ka=3*a+d,kb=3*b+d,kc=3*c+d,delta=(pos[kb]*u+pos[kc]*t-pos[ka])*.82/w;
            pos[ka]+=movable[a]*delta;pos[kb]-=movable[b]*u*delta;pos[kc]-=movable[c]*t*delta;
          }
        }
        for(let i=0;i<count;i++)if(movable[i]){collide(pos,3*i);pos[3*i+1]=Math.max(-80.8,pos[3*i+1]);}
      }
      separateLayers?.();
    }
    let steps=0;
    function step(){substep();substep();steps++;}
    function encode(data){
      const bytes=new Uint8Array(new Float32Array(data).buffer);
      let text="";for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));
      return btoa(text);
    }
    function decode(text){
      if(typeof text!=="string"||text.length!==Math.ceil(pos.length*4/3)*4)throw Error("试衣帧长度与网格不匹配");
      const bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));
      const data=new Float32Array(bytes.buffer);
      if(data.length!==pos.length||!data.every(n=>Number.isFinite(n)&&Math.abs(n)<10000))throw Error("试衣帧坐标无效");
      return data;
    }
    function fingerprint(){
      const key=(avatarParts.length?project.avatar+":":"")+(project.meshQuality===2?"mesh2:":"")+JSON.stringify([project.measures,project.pieces.map(p=>{const values=[p.id,p.points,p.frame,p.height,p.offset,p.depth,p.rotation,p.pin,p.placement,p.fabric];if((p.takeup??100)!==100)values.push(p.takeup);if(p.pleat)values.push("pleat",p.pleat,p.pitch??13);if(p.meshSpacing!==undefined&&p.meshSpacing!==2.8)values.push("spacing",p.meshSpacing);if(p.layer)values.push("layer",p.layer);return values;}),project.seams]);
      let hash=2166136261;for(const c of key)hash=Math.imul(hash^c.charCodeAt(0),16777619);return hash>>>0;
    }
    function snapshot(){return {version:1,key:fingerprint(),steps,pos:encode(pos),previous:encode(old)};}
    function restore(s){
      if(s?.version!==1||s.key!==fingerprint()||!Number.isSafeInteger(s.steps)||s.steps<0)throw Error("试衣帧与当前纸样不一致");
      const next=decode(s.pos),previous=decode(s.previous);pos.set(next);old.set(previous);steps=s.steps;
    }
    return {panels,offsets,pos,rings,faces:panels.map(t=>t.faces),movable,step,snapshot,restore,get steps(){return steps;}};
  }
  // Around-body garments have an ordered radial envelope. Rasterize lower
  // layers in (angle,height) and keep each higher layer outside that envelope.
  function layerConstraint(project,panels,offsets,pos,movable,oldPosition){
    const groups=new Map();
    project.pieces.forEach((p,i)=>{
      if(p.placement==="flat")return;
      const level=p.layer??0;
      if(!groups.has(level))groups.set(level,[]);
      groups.get(level).push(i);
    });
    if(groups.size<2)return null;
    const sorted=[...groups.keys()].sort((a,b)=>a-b);
    const cells=144,heightStep=1.25,origin=-84,rows=260,turn=cells/(2*Math.PI);
    const envelope=new Float32Array(cells*rows);
    const wrap=a=>(a%cells+cells)%cells;
    function rasterize(index){
      const start=offsets[index],end=offsets[index+1];
      const vertices=[];
      for(let i=start;i<end;i++){
        const [x,y,z]=pos.subarray(3*i,3*i+3);
        vertices.push([Math.atan2(z,x)*turn,(y-origin)/heightStep,Math.hypot(x,z)]);
      }
      const f=panels[index].faces;
      for(let i=0;i<f.length;i+=3){
        const [a,b,c]=[vertices[f[i]],vertices[f[i+1]],vertices[f[i+2]]];
        const ax=a[0],bx=ax+wrap(b[0]-ax+cells/2)-cells/2,cx=ax+wrap(c[0]-ax+cells/2)-cells/2;
        const [ay,by,cy]=[a[1],b[1],c[1]];
        const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
        if(Math.abs(det)<.00001)continue;
        for(let y=Math.max(0,Math.ceil(Math.min(ay,by,cy)));y<=Math.min(rows-1,Math.floor(Math.max(ay,by,cy)));y++){
          for(let x=Math.ceil(Math.min(ax,bx,cx));x<=Math.floor(Math.max(ax,bx,cx));x++){
            const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/det;
            const v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/det,w=1-u-v;
            if(Math.min(u,v,w)<-1e-6)continue;
            const cell=y*cells+wrap(x);
            envelope[cell]=Math.max(envelope[cell],u*a[2]+v*b[2]+w*c[2]);
          }
        }
      }
    }
    function separate(index){
      for(let i=offsets[index];i<offsets[index+1];i++){
        const k=i*3,x=pos[k],z=pos[k+2],radius=Math.hypot(x,z);
        const col=Math.floor(Math.atan2(z,x)*turn),row=Math.floor((pos[k+1]-origin)/heightStep);
        if(radius<1e-6||row<0||row>=rows-1)continue;
        let lower=0;
        for(let y=row;y<=row+1;y++){
          lower=Math.max(lower,envelope[y*cells+wrap(col)],envelope[y*cells+wrap(col+1)]);
        }
        const clearance=.9;
        if(lower<=0||radius>=lower+clearance)continue;
        const ratio=(lower+clearance)/radius;
        pos[k]*=ratio;pos[k+2]*=ratio;
        if(!movable[i])continue;
        // Update history by the same contact correction to avoid a radial kick.
        const delta=ratio-1;
        oldPosition[k]+=x*delta;
        oldPosition[k+2]+=z*delta;
      }
    }
    return ()=>{
      envelope.fill(0);
      for(const level of sorted){
        const pieces=groups.get(level);
        if(level!==sorted[0])pieces.forEach(separate);
        if(level!==sorted.at(-1))pieces.forEach(rasterize);
      }
    };
  }
  return {create};
})();


