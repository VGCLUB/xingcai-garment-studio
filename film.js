"use strict";
// Native WebGL still rendering: linear-light film accumulation, view jitter,
// sampling a finite light source and a depth-based contact-occlusion pass.
const Film=(()=>{
  const T=THREE;
  function radical(i,base){let out=0,f=1;while(i){f/=base;out+=f*(i%base);i=Math.floor(i/base);}return out;}
  const vertex="varying vec2 filmUV; void main(){filmUV=uv;gl_Position=vec4(position.xy,0.,1.);}";
  const depthShader=`
    uniform sampler2D zMap;uniform vec2 extent;uniform vec2 texel;
    uniform float zNear,zFar,radius;varying vec2 filmUV;
    vec3 surface(vec2 uv){return vec3(uv*extent,-mix(zNear,zFar,texture2D(zMap,uv).x));}
    void main(){
      vec3 p=surface(filmUV);
      if(p.z < -zFar+1.){gl_FragColor=vec4(1.);return;}
      vec3 east=surface(filmUV+vec2(texel.x,0.))-p,west=p-surface(filmUV-vec2(texel.x,0.));
      vec3 north=surface(filmUV+vec2(0.,texel.y))-p,south=p-surface(filmUV-vec2(0.,texel.y));
      vec3 normal=normalize(cross(abs(east.z)<abs(west.z)?east:west,abs(north.z)<abs(south.z)?north:south));
      float occ=0.,angle=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453)*6.2832;
      for(int j=0;j<24;j++){
        float f=(float(j)+.65)/24., phi=float(j)*2.399963+angle;
        vec2 uv=filmUV+vec2(cos(phi),sin(phi))*(sqrt(f)*radius)/extent;
        vec3 delta=surface(clamp(uv,vec2(.001),vec2(.999)))-p;
        float dist=length(delta);
        occ+=max(0.,dot(normal,delta)/max(.001,dist)-.09)*(1.-smoothstep(radius*.16,radius*1.4,dist));
      }
      float ao=clamp(1.-occ*.12,.54,1.);gl_FragColor=vec4(ao,ao,ao,1.);
    }`;
  async function render(renderer,scene,view,key,width,height,samples,progress){
    const screen=new T.Scene(),cam=new T.Camera(),quad=new T.Mesh(new T.PlaneGeometry(2,2));screen.add(quad);quad.frustumCulled=false;
    const current=new T.WebGLRenderTarget(width,height,{type:T.HalfFloatType,depthBuffer:true});
    current.depthTexture=new T.DepthTexture(width,height,T.UnsignedIntType);
    const film=new T.WebGLRenderTarget(width,height,{type:T.HalfFloatType,depthBuffer:false});
    const ao=new T.WebGLRenderTarget(Math.ceil(width/2),Math.ceil(height/2),{depthBuffer:false});
    const pass=(frag,uniforms)=>new T.ShaderMaterial({vertexShader:vertex,fragmentShader:frag,uniforms,depthTest:false,depthWrite:false,toneMapped:false});
    const occlusion=pass(depthShader,{zMap:{value:current.depthTexture},extent:{value:new T.Vector2(view.right-view.left,view.top-view.bottom)},texel:{value:new T.Vector2(1/width,1/height)},zNear:{value:view.near},zFar:{value:view.far},radius:{value:3.7}});
    const accumulate=pass('varying vec2 filmUV;uniform sampler2D image;uniform float weight;void main(){gl_FragColor=vec4(texture2D(image,filmUV).rgb*weight,1.);}',{image:{value:current.texture},weight:{value:1/samples}});
    accumulate.blending=T.CustomBlending;accumulate.blendSrc=T.OneFactor;accumulate.blendDst=T.OneFactor;accumulate.blendEquation=T.AddEquation;accumulate.transparent=true;
    const finish=pass(`varying vec2 filmUV;uniform sampler2D image,contact;uniform vec2 pixel;
      void main(){
        float a=texture2D(contact,filmUV).r*.4;
        a+=.15*(texture2D(contact,filmUV+vec2(pixel.x,0.)).r+texture2D(contact,filmUV-vec2(pixel.x,0.)).r+texture2D(contact,filmUV+vec2(0.,pixel.y)).r+texture2D(contact,filmUV-vec2(0.,pixel.y)).r);
        vec3 rgb=texture2D(image,filmUV).rgb*mix(1.,a,.78);
        gl_FragColor=vec4(rgb,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,{image:{value:film.texture},contact:{value:ao.texture},pixel:{value:new T.Vector2(2/width,2/height)}});
    finish.toneMapped=true;
    const auto=renderer.autoClear,bg=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha();
    const lamp=key.position.clone(),camera=view.clone(),deltaX=(view.right-view.left)/width,deltaY=(view.top-view.bottom)/height;
    try{
      renderer.autoClear=true;renderer.setRenderTarget(current);renderer.render(scene,camera);
      renderer.setRenderTarget(ao);quad.material=occlusion;renderer.render(screen,cam);
      renderer.setRenderTarget(film);renderer.setClearColor(0,0);renderer.clear();renderer.setClearColor(bg,alpha);
      for(let s=0;s<samples;s++){
        const dx=radical(s+1,2)-.5,dy=radical(s+1,3)-.5,angle=6.2831853*radical(s+1,5),r=20*Math.sqrt((s+.5)/samples);
        camera.left=view.left+dx*deltaX;camera.right=view.right+dx*deltaX;camera.top=view.top+dy*deltaY;camera.bottom=view.bottom+dy*deltaY;camera.updateProjectionMatrix();
        key.position.set(lamp.x+Math.cos(angle)*r,lamp.y+Math.sin(angle)*r,lamp.z);
        renderer.autoClear=true;renderer.setRenderTarget(current);renderer.render(scene,camera);
        renderer.autoClear=false;renderer.setRenderTarget(film);quad.material=accumulate;renderer.render(screen,cam);
        progress?.(s+1,samples);
        if(s%2===0)await new Promise(resolve=>setTimeout(resolve,0));
      }
      renderer.autoClear=true;renderer.setRenderTarget(null);quad.material=finish;renderer.render(screen,cam);
      return await new Promise((resolve,reject)=>renderer.domElement.toBlob(b=>b?resolve(b):reject(Error("PNG 编码失败")),"image/png"));
    }finally{
      key.position.copy(lamp);renderer.autoClear=auto;renderer.setRenderTarget(null);renderer.setClearColor(bg,alpha);
      [occlusion,accumulate,finish,quad.geometry,current,ao,film].forEach(x=>x.dispose());
    }
  }
  return {render};
})();
