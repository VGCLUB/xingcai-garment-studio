"use strict";
// Tile dimensions correspond to 10 cm in the flat pattern UVs. Deterministic,
// seamless yarn relief and colour maps stay attached to the mesh while it drapes.
const Textiles=(()=>{
  const cache=new Map();
  const specs={
    cotton:{threads:70,relief:.027,roughness:.84,sheen:.32},
    linen:{threads:48,relief:.05,roughness:.91,sheen:.23},
    silk:{threads:110,relief:.012,roughness:.46,sheen:.62},
    jacquard:{roughness:.83,sheen:.51}
  };
  const scans=new Map(),dyes=new Map();
  async function bitmap(src){const im=new Image();im.src=src;await im.decode();return im;}
  const ready=Promise.all(Object.entries(FabricScans).map(async([fabric,asset])=>{
    const [image,normal,rough]=await Promise.all([asset.albedo,asset.normal,asset.rough].map(bitmap));
    const canvas=document.createElement("canvas");canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(image,0,0);
    const raw=ctx.getImageData(0,0,image.width,image.height).data,gray=new Uint8Array(raw.length/4);
    let sum=0;for(let i=0;i<gray.length;i++){gray[i]=.25*raw[4*i]+.60*raw[4*i+1]+.15*raw[4*i+2];sum+=gray[i];}
    function tex(im){const t=new THREE.Texture(im);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.setScalar(10/asset.cm);t.anisotropy=8;t.needsUpdate=true;return t;}
    scans.set(fabric,{gray,mean:sum/gray.length,n:image.width,cm:asset.cm,tex,normal:tex(normal),rough:tex(rough)});
  }));
  function scanned(p,wireframe){
    const s=scans.get(p.fabric),key=p.fabric+"-"+p.print;
    if(!dyes.has(key)){
      const c=document.createElement("canvas");c.width=c.height=s.n;const ctx=c.getContext("2d"),pixels=ctx.createImageData(s.n,s.n);
      for(let i=0;i<s.gray.length;i++){
        const x=i%s.n/s.n*s.cm,y=Math.floor(i/s.n)/s.n*s.cm;
        let v=Math.max(.32,Math.min(1.18,1+(s.gray[i]-s.mean)/Math.max(30,s.mean)*.85))*.85;
        // Integer repeats per tile keep the dyed pattern continuous at its border.
        const band=(cm,n)=>Math.abs(((cm/s.cm*n)%1)-.5);
        if(p.print==="stripe"){const d=band(y,12);v*=d<.095?.80:d<.14?.91:1;}
        if(p.print==="check"){const a=band(x,5),b=band(y,5);v*=(a<.13?.79:1)*(b<.13?.79:1);if(a<.022||b<.022)v*=.80;}
        const k=i*4;pixels.data[k]=pixels.data[k+1]=pixels.data[k+2]=Math.round(252*v);pixels.data[k+3]=255;
      }
      ctx.putImageData(pixels,0,0);const t=s.tex(c);t.colorSpace=THREE.SRGBColorSpace;dyes.set(key,t);
    }
    const cloth=new THREE.MeshPhysicalMaterial({color:p.color,map:dyes.get(key),normalMap:s.normal,roughnessMap:s.rough,roughness:.93,
      metalness:0,side:THREE.DoubleSide,wireframe,sheen:specs[p.fabric].sheen,sheenRoughness:.74,
      sheenColor:new THREE.Color(p.color).lerp(new THREE.Color(0xd4bdaa),.15),specularIntensity:p.fabric==="jacquard"?.63:.32});
    cloth.normalScale.setScalar(p.fabric==="linen" ? .85 : .66);
    if(p.fabric==="jacquard"){cloth.anisotropy=.36;cloth.anisotropyRotation=Math.PI/2;}
    return cloth;
  }
  function maps(fabric,print,anisotropy){
    const key=fabric+"-"+print;
    if(cache.has(key))return cache.get(key);
    const n=512,s=specs[fabric],albedo=new Uint8Array(n*n*4),relief=new Uint8Array(n*n*4);
    const tau=Math.PI*2;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const u=x/n,v=y/n,warp=u*s.threads,weft=v*s.threads;
      const linen=fabric==="linen"?1:0;
      const a=.5+.5*Math.cos(tau*(warp+.06*linen*Math.sin(tau*(v*3+u*2))));
      const b=.5+.5*Math.cos(tau*(weft+.06*linen*Math.sin(tau*(u*3-v))));
      const over=(Math.floor(warp+.5)+Math.floor(weft+.5))%2===0;
      const yarn=(over ? .72 : .28)*a+(over ? .28 : .72)*b;
      const slub=linen*(.5+.5*Math.cos(tau*(u*9+Math.sin(tau*v)*.12)))**12;
      let dye=.91+.085*yarn-.025*slub;
      if(print==="stripe"){const stripe=Math.abs((v*5)%1-.5);dye*=stripe<.105 ? .73 : stripe<.17 ? .87 : 1;}
      if(print==="check"){const sx=Math.abs((u*2)%1-.5),sy=Math.abs((v*2)%1-.5);dye*=(sx<.15 ? .78 : 1)*(sy<.15 ? .78 : 1);if(sx<.026||sy<.026)dye*=.68;}
      const k=(y*n+x)*4,value=Math.round(255*dye),height=Math.round(45+175*yarn+30*slub);
      albedo[k]=albedo[k+1]=albedo[k+2]=value;relief[k]=relief[k+1]=relief[k+2]=height;
      albedo[k+3]=relief[k+3]=255;
    }
    function texture(data,srgb){
      const tex=new THREE.DataTexture(data,n,n,THREE.RGBAFormat);
      tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps=true;tex.anisotropy=Math.min(8,anisotropy);if(srgb)tex.colorSpace=THREE.SRGBColorSpace;tex.needsUpdate=true;return tex;
    }
    const out={map:texture(albedo,true),bumpMap:texture(relief,false)};cache.set(key,out);return out;
  }
  function baseMaterial(p,wireframe,anisotropy){
    if(scans.has(p.fabric)){
      const mat=scanned(p,wireframe);if(p.roughness!==undefined)mat.roughness=p.roughness/100;if(p.sheenLevel!==undefined)mat.sheen=p.sheenLevel/100;return mat;
    }
    const s=specs[p.fabric]||specs.cotton;
    return new THREE.MeshPhysicalMaterial({...maps(p.fabric||"cotton",p.print||"solid",anisotropy),
      color:p.color,side:THREE.DoubleSide,wireframe,bumpScale:s.relief,roughness:p.roughness===undefined?s.roughness:p.roughness/100,metalness:0,anisotropy:p.fabric==="silk"?.48:0,specularIntensity:.56,
      sheen:p.sheenLevel===undefined?s.sheen:p.sheenLevel/100,sheenRoughness:p.fabric==="silk" ? .38 : .82,sheenColor:new THREE.Color(p.color).lerp(new THREE.Color(0xffffff),.25)});
  }
  function material(p,wireframe,anisotropy){const m=baseMaterial(p,wireframe,anisotropy);return p.id?MaterialSystem.apply(m,p):m;}
  return {material,ready};
})();

