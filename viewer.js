"use strict";
function createViewer(host) {
  const T=THREE,renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
  renderer.setClearColor(0xe6e2d9);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFSoftShadowMap;
  host.prepend(renderer.domElement);
  const scene=new T.Scene(),camera=new T.OrthographicCamera();
  scene.fog=new T.FogExp2(0xe6e2d9,.0018);
  const fill=new T.HemisphereLight(0xfff9ec,0xbcb3a7,2.0);scene.add(fill);
  const key=new T.DirectionalLight(0xfff4df,2.4);
  key.position.set(-64,105,80);key.castShadow=true;
  Object.assign(key.shadow.camera,{left:-60,right:60,top:90,bottom:-100,near:1,far:350});
  key.shadow.mapSize.set(1024,1024);key.shadow.normalBias=.12;
  scene.add(key); scene.add(key.target);key.target.position.y=-14;
  const rim=new T.DirectionalLight(0xf0f6ff,1.4);rim.position.set(60,45,-70);scene.add(rim);
  const standard=(color,metalness=0)=>new T.MeshStandardMaterial({color,roughness:metalness ? .48 : .9,metalness});
  function mesh(geometry,material,x=0,y=0,z=0){
    const obj=new T.Mesh(geometry,material);obj.position.set(x,y,z);obj.castShadow=true;obj.receiveShadow=true;scene.add(obj);return obj;
  }
  function cylinder(rt,rb,h,y,material){return mesh(new T.CylinderGeometry(rt,rb,h,64),material,0,y);}
  const stand=standard(0x7e705c,.65), trim=standard(0x9c845f,.6);
  const fittingsStart=scene.children.length;
  cylinder(15,16,1.6,-80.5,stand);cylinder(3.2,6,2,-79,stand);cylinder(1.2,1.5,49,-54,stand);
  const fittings=scene.children.slice(fittingsStart);
  function ovalPoint(row,phi,offset=0){return new T.Vector3((row[1]+offset)*Math.cos(phi),row[0],(row[2]+offset)*Math.sin(phi));}
  const rings=Cloth.body, verts=[], idx=[], count=72;
  for(const row of rings) for(let i=0;i<count;i++)verts.push(...ovalPoint(row,i/count*Math.PI*2).toArray());
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<count;i++){
    const a=j*count+i,b=j*count+(i+1)%count;idx.push(a,a+count,b,b,a+count,b+count);
  }
  const formGeometry=new T.BufferGeometry();formGeometry.setAttribute("position",new T.Float32BufferAttribute(verts,3));formGeometry.setIndex(idx);formGeometry.computeVertexNormals();
  formGeometry.setAttribute("uv",new T.Float32BufferAttribute(rings.flatMap(row=>Array.from({length:count},(_,i)=>[i/count*8,row[0]/10]).flat()),2));
  const mannequin=mesh(formGeometry,standard(0xc4b9a2));
  const rib=new T.LineBasicMaterial({color:0x9d917b,transparent:true,opacity:.48});
  const ribLines=[];
  function updateForm(profile){
    const attr=formGeometry.attributes.position;
    profile.forEach((row,j)=>{for(let i=0;i<count;i++){const pt=ovalPoint(row,i/count*Math.PI*2);attr.setXYZ(j*count+i,pt.x,pt.y,pt.z);}});
    attr.needsUpdate=true;formGeometry.computeVertexNormals();formGeometry.computeBoundingSphere();
    for(const line of ribLines){scene.remove(line);line.geometry.dispose();}
    ribLines.length=0;
    for(const phi of [Math.PI/2,Math.PI*.28,Math.PI*.72,Math.PI*1.5,0,Math.PI]){
      ribLines.push(new T.Line(new T.BufferGeometry().setFromPoints(profile.map(row=>ovalPoint(row,phi,.05))),rib));
    }
    for(const j of [5,12])ribLines.push(new T.LineLoop(new T.BufferGeometry().setFromPoints(Array.from({length:count},(_,i)=>ovalPoint(profile[j],2*Math.PI*i/count,.07))),rib));
    scene.add(...ribLines);
  }
  updateForm(rings);
  const capStart=scene.children.length;
  cylinder(5.2,5.4,1,47.3,trim);cylinder(1.6,2.6,2,48.7,trim);
  mesh(new T.SphereGeometry(2.1,24,16),trim,0,50.4);
  fittings.push(...scene.children.slice(capStart));
  const limbs=[],bodyMaterial=standard(0xc8a792);let fullBody=false,formMaterial;
  const floor=mesh(new T.PlaneGeometry(2000,2000),standard(0xe3dfd6),0,-81.35);floor.rotation.x=-Math.PI/2;floor.castShadow=false;
  const clothMeshes=[],hemMeshes=[],bindings=[];
  if(typeof Textiles!=="undefined"){
    renderer.toneMapping=T.ACESFilmicToneMapping;
    const lights=new T.Scene();lights.background=new T.Color(0x545550);
    function card(x,y,z,w,h,power){
      const material=new T.MeshBasicMaterial({color:new T.Color(1,.98,.94).multiplyScalar(power),side:T.DoubleSide});
      const m=new T.Mesh(new T.PlaneGeometry(w,h),material);m.position.set(x,y,z);m.lookAt(0,0,0);lights.add(m);
    }
    card(-4,3,2,4,7,3.5);card(2,3,-4,2,6,4);card(3,1,4,4,4,1.4);
    const pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(lights,.035,.1,30).texture;pmrem.dispose();
    lights.children.forEach(m=>{m.geometry.dispose();m.material.dispose();});
  }
  let backdropName="";
  function light(name){
    const palettes={
      studio:[0xb5afa6,0xb5afa6,0xfff1dc,0xd3e4ff,.98,2.25,1.3,.57],
      warm:[0xb49b87,0xbb9b83,0xffdab8,0xffe3c2,.97,2.45,1.5,.57],
      night:[0x282d34,0x36383e,0xffe9ce,0xb0d5ff,.92,2.7,2.4,.40],
      backlit:[0x313941,0x3c464c,0xf1f5ff,0xffdcc3,1.06,1.15,4.1,.46]
    };
    const [bg,ground,k,r,exp,ki,ri,fi]=palettes[name]||palettes.studio;
    renderer.setClearColor(bg,1);scene.fog.color.setHex(bg);floor.material.color.setHex(ground);
    key.color.setHex(k);key.intensity=ki;rim.color.setHex(r);rim.intensity=ri;fill.intensity=fi;renderer.toneMappingExposure=exp;
    key.position.set(name==="warm"?-100:-85,name==="night"?63:86,name==="warm"?42:62);
    rim.position.set(name==="backlit"?34:60,name==="backlit"?14:45,-70);
    if(backdropName!==name){
      const b=document.createElement("canvas");b.width=768;b.height=768;const ctx=b.getContext("2d");
      const gradient=ctx.createRadialGradient(315,294,0,345,330,620);
      const tones=name==="backlit"?["#78878b","#39464e","#202630"]:name==="night"?["#54575b","#303439","#171b22"]:name==="warm"?["#d8c8b4","#baaa99","#8c8177"]:["#d9d7cf","#bbb9b2","#92928f"];
      gradient.addColorStop(0,tones[0]);gradient.addColorStop(.65,tones[1]);gradient.addColorStop(1,tones[2]);
      ctx.fillStyle=gradient;ctx.fillRect(0,0,768,768);scene.background?.dispose?.();
      const texture=new T.CanvasTexture(b);texture.colorSpace=T.SRGBColorSpace;scene.background=texture;backdropName=name;
    }
    render();
  }
  function hems(panel){
    const adjacent=new Map(),coords=panel.coords;
    for(let i=0;i<panel.faces.length;i+=3){
      for(let j=0;j<3;j++){
        const a=panel.faces[i+j],b=panel.faces[i+(j+1)%3],c=panel.faces[i+(j+2)%3];
        adjacent.set(Math.min(a,b)*coords.length+Math.max(a,b),c);
      }
    }
    const samples=[];
    for(const chain of panel.chains)for(let i=1;i<chain.length;i++){
      const a=chain[i-1],b=chain[i],c=adjacent.get(Math.min(a,b)*coords.length+Math.max(a,b));
      if(c===undefined)continue;
      const length=Math.hypot(coords[a][0]-coords[b][0],coords[a][1]-coords[b][1]),n=Math.max(1,Math.round(length/.56));
      for(let j=0;j<n;j++)for(const d of [.12,.78])samples.push([a,b,c,(j+d)/n]);
    }
    const g=new T.BufferGeometry();g.setAttribute("position",new T.BufferAttribute(new Float32Array(3*samples.length),3).setUsage(T.DynamicDrawUsage));
    const line=new T.LineSegments(g,new T.LineBasicMaterial({color:0x675744,transparent:true,opacity:.62,depthWrite:false}));
    line.userData.samples=samples;line.frustumCulled=false;scene.add(line);return line;
  }
  let wireframe=false,focus=-14,focusX=0,spanY=150;
  let model=null,yaw=.34,pitch=.06,zoom=1,playing=false,accumulator=0,prior=0;
  let showStrain=false,photographing=false,strainPeak=0;
  const strainMaterial=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,toneMapped:false});
  const strainStops=[0x24478e,0x369cbb,0xa1c876,0xf2b851,0xc93f36].map(c=>new T.Color(c));
  function updateStrain(){
    strainPeak=0;
    clothMeshes.forEach((mesh,i)=>{
      const g=mesh.geometry,result=Strain.field(model.panels[i],g.attributes.position.array);
      let attr=g.getAttribute("color");
      if(!attr){attr=new T.BufferAttribute(new Float32Array(result.mean.length*3),3);g.setAttribute("color",attr);}
      const color=new T.Color();
      result.mean.forEach((s,j)=>{
        const t=Math.max(0,Math.min(4,(s-1)*20)),lo=Math.min(3,Math.floor(t));
        color.copy(strainStops[lo]).lerp(strainStops[lo+1],t-lo);attr.setXYZ(j,color.r,color.g,color.b);
      });
      attr.needsUpdate=true;strainPeak=Math.max(strainPeak,result.peak);
    });
    const legend=document.getElementById("strainLegend");
    if(legend)legend.textContent="最大主伸长率　蓝 ≤100%　绿 110%　红 ≥120%　｜　面片峰值 "+(100*strainPeak).toFixed(1)+"%";
  }
  function setStrain(on){
    showStrain=on;
    document.getElementById("strainLegend").hidden=!on;
    if(on&&model?.panels)updateStrain();
    render();
  }
  function render(){
    if(!showStrain||photographing||!model?.panels){renderer.render(scene,camera);return;}
    const originals=clothMeshes.map(m=>m.material);
    try{clothMeshes.forEach(m=>m.material=strainMaterial);renderer.render(scene,camera);}
    finally{clothMeshes.forEach((m,i)=>m.material=originals[i]);}
  }
  function view(){
    const width=host.clientWidth,height=host.clientHeight;
    if(!width||!height)return;
    const halfH=spanY/(2*zoom);
    camera.left=-halfH*width/height;camera.right=-camera.left;camera.top=halfH;camera.bottom=-halfH;
    camera.near=.1;camera.far=1500;
    camera.position.set(focusX+210*Math.sin(yaw)*Math.cos(pitch),focus+210*Math.sin(pitch),210*Math.cos(yaw)*Math.cos(pitch));
    camera.lookAt(focusX,focus,0);camera.updateProjectionMatrix();renderer.setSize(width,height,false);render();
  }
  function sync(){
    for(let p=0;p<model.faces.length;p++){
      const g=clothMeshes[p].geometry,attr=g.attributes.position;
      attr.array.set(model.pos.subarray(3*(model.offsets?.[p]??p*model.panelSize),3*(model.offsets?.[p+1]??(p+1)*model.panelSize)));
      attr.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
      bindings[p]?.update(g);
      const line=hemMeshes[p];
      if(line){
        const positions=line.geometry.attributes.position,normals=g.attributes.normal.array,pts=attr.array;
        line.userData.samples.forEach(([a,b,c,t],j)=>{
          for(let d=0;d<3;d++)positions.array[3*j+d]=.85*((1-t)*pts[3*a+d]+t*pts[3*b+d])+.15*pts[3*c+d]+.065*normals[3*a+d];
        });
        positions.needsUpdate=true;
      }
    }
    if(showStrain)updateStrain();
    render();
  }
  function setModel(next,project){
    model=next;
    if(next.rings)updateForm(next.rings);
    if(next.panels&&!mannequin.userData.finished){
      mannequin.material.dispose();mannequin.material=Textiles.material({fabric:"linen",print:"solid",color:"#c3b69e"},false,4);
      mannequin.material.normalScale.setScalar(.27);mannequin.material.sheen=.15;mannequin.userData.finished=true;
    }
    if(next.panels){
      formMaterial??=mannequin.material;fullBody=Boolean(Avatar.presets[project.avatar]);
      for(const obj of limbs){scene.remove(obj);obj.geometry.dispose();}limbs.length=0;
      for(const rows of Avatar.parts(project.avatar,next.rings))limbs.push(mesh(Avatar.geometry(T,rows),bodyMaterial));
      mannequin.material=fullBody?bodyMaterial:formMaterial;for(const obj of [...fittings,...ribLines])obj.visible=!fullBody;
      if(fullBody&&spanY===150){spanY=168;focus=-7;}
    }
    for(const obj of clothMeshes){scene.remove(obj);obj.geometry.dispose();obj.material.dispose();obj.customDepthMaterial?.dispose();}
    clothMeshes.length=0;
    for(const line of hemMeshes){scene.remove(line);line.geometry.dispose();line.material.dispose();}hemMeshes.length=0;
    for(const item of bindings){scene.remove(item.obj);item.obj.geometry.dispose();item.obj.material.dispose();item.obj.customDepthMaterial?.dispose();}bindings.length=0;
    for(let p=0;p<model.faces.length;p++){
      const g=new T.BufferGeometry();
      g.setAttribute("position",new T.BufferAttribute(new Float32Array((model.panels?.[p].coords.length??model.panelSize)*3),3).setUsage(T.DynamicDrawUsage));
      g.setIndex(model.faces[p]);
      const panel=model.panels?.[p];
      if(panel){const tile=10*(project.pieces[p].textureScale??1);g.setAttribute("uv",new T.Float32BufferAttribute(panel.coords.flatMap(([x,y])=>[x/tile,-y/tile]),2));}
      const mat=panel&&typeof Textiles!=="undefined"?Textiles.material(project.pieces[p],wireframe,renderer.capabilities.getMaxAnisotropy()):new T.MeshStandardMaterial({color:project.pieces[p].color,side:T.DoubleSide,wireframe,roughness:.94});
      if(panel){const line=hems(panel);line.visible=!wireframe;line.material.color.set(project.pieces[p].color).lerp(new T.Color(0xe9d8c1),.26);hemMeshes.push(line);}
      if(panel){
        const piece=project.pieces[p],finish=Textiles.material({...piece,print:"solid"},wireframe,renderer.capabilities.getMaxAnisotropy());
        finish.color.multiplyScalar(.82);const item=Finishes.create(panel,piece,project,finish);
        configureShadow(item.obj);
        bindings.push(item);scene.add(item.obj);item.obj.visible=!wireframe;
      }
      const obj=mesh(g,mat);configureShadow(obj);clothMeshes.push(obj);
    }
    sync();
  }
  function configureShadow(obj){
    const mat=obj.material;
    if(!mat.userData.thinSurface)return;
    const coverage=(mat.userData.exportSurface?.alpha??mat.opacity)*
      (1-(mat.userData.exportSurface?.transmission??mat.transmission));
    if(!mat.alphaShadow&&coverage<=.001){obj.castShadow=false;return;}
    const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide});
    if(mat.alphaShadow)mat.alphaShadow(depth);
    else depth.onBeforeCompile=shader=>{
      shader.uniforms.xcCoverage={value:coverage};
      shader.fragmentShader=shader.fragmentShader.replace("void main() {","uniform float xcCoverage;\nvoid main() {\n"+
        "if(fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715))))>xcCoverage) discard;");
    };
    obj.customDepthMaterial=depth;
  }
  let pending=0;
  // One animation chain at a time, including quick pause/resume clicks.
  function loop(now){
    if(!playing || !model){pending=0;return;}
    accumulator+=Math.min((now-prior)/1000,.05);prior=now;
    let steps=0;
    while(accumulator>=1/60&&steps<3){model.step();accumulator-=1/60;steps++;}
    if(steps)sync();pending=requestAnimationFrame(loop);
  }
  function play(on){
    playing=on;
    if(pending)cancelAnimationFrame(pending);
    pending=0;accumulator=0;prior=performance.now();
    if(on)pending=requestAnimationFrame(loop);
  }
  let drag=null;
  const canvas=renderer.domElement;
  canvas.addEventListener("pointerdown",e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener("pointermove",e=>{if(!drag)return;yaw-=(e.clientX-drag[0])*.012;pitch=Math.max(-.48,Math.min(.6,pitch+(e.clientY-drag[1])*.008));drag=[e.clientX,e.clientY];view();});
  canvas.addEventListener("lostpointercapture",()=>{drag=null;});
  canvas.addEventListener("wheel",e=>{e.preventDefault();zoom=Math.max(.65,Math.min(2.6,zoom*Math.exp(-e.deltaY*.001)));view();},{passive:false});
  new ResizeObserver(view).observe(host);view();
  if(typeof Textiles!=="undefined")light("studio");
  function photoPose(pose){
    if(pose==="current")return;
    let low=Infinity,high=-Infinity;
    for(let i=1;i<model.pos.length;i+=3){low=Math.min(low,model.pos[i]);high=Math.max(high,model.pos[i]);}
    if(!Number.isFinite(low))return;
    const garmentHigh=high;high=high<15?high+19:Math.max(high,50.5);
    focusX=0;focus=(high+low)/2;spanY=(high-low+8)*1.12;zoom=1;pitch=.025;
    yaw=pose==="back"?Math.PI+.12:pose==="front"?0:.46;
    if(pose==="detail"){yaw=.32;focusX=6;focus=low+(garmentHigh-low)*.78;spanY=23;}
    view();
  }
  async function photo(width,pose,samples=8,progress){
    if(!model?.pos.length)throw Error("请先创建裁片");
    const h=Math.round(width*1.25),max=renderer.getContext().getParameter(renderer.getContext().MAX_RENDERBUFFER_SIZE);
    if(h>max)throw Error("显卡不支持此尺寸，请使用较小尺寸");
    const before=[yaw,pitch,focus,spanY,zoom,focusX],ratio=renderer.getPixelRatio();
    const offWire=clothMeshes.map(m=>m.material.wireframe);
    const photoMeshes=[...clothMeshes,...bindings.map(b=>b.obj)].filter(m=>m.geometry.index.count);
    const raw=photoMeshes.map(m=>m.geometry);
    photographing=true;
    try{
      photoMeshes.forEach(m=>{m.geometry=Finishes.smooth(m.geometry,2);});
      bindings.forEach(b=>{b.obj.visible=true;});
      for(const m of clothMeshes)m.material.wireframe=false;
      hemMeshes.forEach(m=>m.visible=true);
      photoPose(pose);renderer.setPixelRatio(1);renderer.setSize(width,h,false);
      camera.left=-camera.top*width/h;camera.right=-camera.left;camera.updateProjectionMatrix();render();
      if(samples>1){
        if(!renderer.extensions.has("EXT_color_buffer_float"))throw Error("显卡未提供浮点帧缓冲，请将采样改成快速");
        return await Film.render(renderer,scene,camera,key,width,h,samples,progress);
      }
      const result=await new Promise((resolve,reject)=>renderer.domElement.toBlob(b=>b?resolve(b):reject(new Error("PNG 编码失败")),"image/png"));
      return result;
    }finally{
      photographing=false;
      photoMeshes.forEach((m,i)=>{if(m.geometry!==raw[i])m.geometry.dispose();m.geometry=raw[i];});
      bindings.forEach(b=>{b.obj.visible=!wireframe;});
      clothMeshes.forEach((m,i)=>m.material.wireframe=offWire[i]);hemMeshes.forEach(m=>m.visible=!wireframe);
      [yaw,pitch,focus,spanY,zoom,focusX]=before;renderer.setPixelRatio(ratio);view();
    }
  }
  async function glb(project){
    const group=new T.Group(),baked=new Map();
    group.name="Xingcai";group.userData={project:project.name,measures:project.measures,lighting:project.light};
    try{
      const meshes=clothMeshes.map((obj,i)=>({obj,i,trim:false})).concat(bindings.map((b,i)=>({obj:b.obj,i,trim:true})));
      meshes.filter(m=>m.obj.geometry.index.count).forEach(({obj,i,trim})=>{
        const g=Finishes.smooth(obj.geometry,2),mat=obj.material.clone();mat.wireframe=false;
        if(mat.userData.materialGraph){
          const bsdf=MaterialSystem.get(mat.userData.materialGraph,"surface");
          mat.sheen=bsdf.sheenWeight;mat.sheenColor.set(bsdf.sheenTint);mat.sheenRoughness=bsdf.sheenRoughness;
          if(obj.material.exportTextures){
            Object.assign(mat,obj.material.exportTextures);
            mat.color.multiply(new T.Color(bsdf.baseColor));
            mat.ior=bsdf.ior;mat.roughness=bsdf.roughness;
            mat.specularIntensity=2*bsdf.specularIORLevel;mat.specularColor.set(bsdf.specularTint);
            mat.anisotropy=bsdf.anisotropy;mat.anisotropyRotation=bsdf.anisotropyRotation*Math.PI/180;
            mat.clearcoat=bsdf.coatWeight;mat.clearcoatRoughness=bsdf.coatRoughness;
            mat.transmission=bsdf.transmission;mat.opacity=bsdf.alpha;mat.transparent=bsdf.alpha<1;
          }
          mat.thickness*=.01;mat.attenuationDistance*=.01;
          mat.userData.exportApproximation="Standard glTF appearance uses the main Principled values and portable image links. Full graph is stored in extras. Subsurface, procedural nodes and shader mixes are rendered in Xingcai.";
        }
        // glTF uses tangent-space normals. Bake the repeating yarn-height tile,
        // with derivatives in the same 10 cm UV tile as the viewport material.
        const height=mat.bumpMap;
        if(height){
          if(!baked.has(height)){
            const {data,width:w,height:h}=height.image,out=new Uint8Array(w*h*4);
            const value=(x,y)=>data[4*(((y+h)%h)*w+(x+w)%w)]/255;
            for(let y=0;y<h;y++)for(let x=0;x<w;x++){
              const dx=(value(x-1,y)-value(x+1,y))*mat.bumpScale*w/20,dy=(value(x,y-1)-value(x,y+1))*mat.bumpScale*h/20;
              const len=Math.hypot(dx,dy,1),k=(y*w+x)*4;
              [dx,dy,1].forEach((n,d)=>out[k+d]=Math.round(127.5*(1+n/len)));out[k+3]=255;
            }
            const normal=new T.DataTexture(out,w,h,T.RGBAFormat);normal.wrapS=normal.wrapT=T.RepeatWrapping;normal.needsUpdate=true;baked.set(height,normal);
          }
          mat.normalMap=baked.get(height);mat.bumpMap=null;mat.bumpScale=1;
        }
        if(!mat.bumpMap)mat.bumpScale=1;
        if(mat.normalMap)g.computeTangents();
        if(mat.roughnessMap&&mat.metalness===0)mat.metalnessMap=mat.roughnessMap;
        const piece=project.pieces[i],mesh=new T.Mesh(g,mat);mesh.name=piece.name+(trim?" 包边":"");mat.name=Pattern.names[piece.fabric];
        mesh.userData={fabric:piece.fabric,finish:trim,color:piece.color,print:trim?"solid":piece.print};
        g.scale(.01,.01,.01);group.add(mesh);
      });
      const exporter=new XingcaiGLTF.GLTFExporter();
      exporter.register(writer=>({writeMaterial(material,definition){
        // Fabric panels are open sheets. Preserve their thin transmission
        // in glTF and keep the optical thickness in the Xingcai graph.
        if(material.side===T.DoubleSide)delete definition.extensions?.KHR_materials_volume;
        const map=definition.pbrMetallicRoughness.metallicRoughnessTexture;
        if(map&&"channel" in map){map.texCoord=map.channel;delete map.channel;}
      },afterParse(){
        if(!writer.json.materials?.some(m=>m.extensions?.KHR_materials_volume))delete writer.extensionsUsed.KHR_materials_volume;
      }}));
      return await exporter.parseAsync(group,{binary:true});
    }finally{
      group.children.forEach(m=>{m.geometry.dispose();m.material.dispose();});
      for(const texture of baked.values())texture.dispose();
    }
  }
  return {setStrain,setModel,play,sync,light,photoPose,photo,glb,setWire(on){wireframe=on;for(const m of clothMeshes)m.material.wireframe=on;hemMeshes.forEach(m=>m.visible=!on);bindings.forEach(b=>b.obj.visible=!on);render();},frameGarment(){if(!model?.pos.length)return;let low=Infinity,high=-Infinity;for(let i=1;i<model.pos.length;i+=3){low=Math.min(low,model.pos[i]);high=Math.max(high,model.pos[i]);}focusX=0;focus=(high+low)/2;spanY=Math.max(85,(high-low)*1.48);zoom=1;view();},resetView(){yaw=.34;pitch=.06;zoom=1;focusX=0;focus=fullBody?-7:-14;spanY=fullBody?168:150;view();}};
}





