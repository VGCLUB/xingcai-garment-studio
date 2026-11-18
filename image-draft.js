"use strict";
const ImageDraft=(()=>{
  const labels={vest:"无袖上衣",shirt:"连袖短衫",skirt:"半身裙",dress:"无袖连衣裙"};
  // Training examples are width profiles of synthetic front silhouettes.
  // Nearest neighbours operate on normalised widths measured at eight heights.
  const shapes={
    vest:[.66,.79,.88,.99,.96,.96,.99,1],shirt:[.62,.90,1,.78,.70,.70,.70,.70],
    skirt:[.53,.59,.65,.71,.78,.85,.92,1],dress:[.60,.67,.69,.60,.63,.75,.89,1]
  };
  const levels=[.06,.16,.27,.38,.51,.65,.80,.94];
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const examples=[];
  for(const [kind,base] of Object.entries(shapes)){
    for(const flare of [-.12,-.06,0,.06,.12])for(const shoulder of [-.08,0,.08]){
      const widths=base.map((w,i)=>w+flare*(i/7-.5)+shoulder*Math.max(0,1-i/3));
      const max=Math.max(...widths);examples.push({kind,widths:widths.map(w=>w/max)});
    }
  }
  function analyse(image){
    const canvas=document.createElement("canvas"),width=image.naturalWidth||image.width,heightPx=image.naturalHeight||image.height,s=220/Math.max(width,heightPx);
    canvas.width=Math.max(1,Math.round(width*s));canvas.height=Math.max(1,Math.round(heightPx*s));
    const w=canvas.width,h=canvas.height,ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(image,0,0,w,h);
    const data=ctx.getImageData(0,0,w,h).data,channels=[[],[],[]];
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      if(x>2&&x<w-3&&y>2&&y<h-3)continue;
      const k=(y*w+x)*4;if(data[k+3]>100)channels.forEach((c,i)=>c.push(data[k+i]));
    }
    const median=a=>{a.sort((x,y)=>x-y);return a[Math.floor(a.length/2)]??255;};
    const bg=channels.map(median),opaqueBorder=channels[0].length>(w+h);
    const mask=new Uint8Array(w*h);
    for(let i=0;i<mask.length;i++)mask[i]=data[4*i+3]>100&&(!opaqueBorder||Math.hypot(...bg.map((b,j)=>data[4*i+j]-b))>38)?1:0;
    let best=[];const queue=new Int32Array(w*h);
    for(let i=0;i<mask.length;i++)if(mask[i]){
      let tail=1;queue[0]=i;mask[i]=0;
      for(let j=0;j<tail;j++){const k=queue[j];for(const n of [k%w?k-1:-1,k%w<w-1?k+1:-1,k-w,k+w])if(mask[n]){mask[n]=0;queue[tail++]=n;}}
      if(tail>best.length)best=Array.from(queue.subarray(0,tail));
    }
    if(best.length<w*h*.035||best.length>w*h*.94)throw Error("无法分离服装，请用衣物完整、背景单一的正面平铺图");
    const left=new Int16Array(h).fill(w),right=new Int16Array(h).fill(-1),colors=[[],[],[]];let top=h,bottom=0;
    for(const i of best){const y=Math.floor(i/w),x=i%w;left[y]=Math.min(left[y],x);right[y]=Math.max(right[y],x);top=Math.min(top,y);bottom=Math.max(bottom,y);colors.forEach((c,j)=>c.push(data[4*i+j]));}
    const height=bottom-top+1;
    const widths=levels.map(level=>{
      const row=Math.round(top+(height-1)*level),d=Math.max(1,Math.floor(height*.025)),band=[];
      for(let y=Math.max(top,row-d);y<=Math.min(bottom,row+d);y++)band.push(right[y]-left[y]+1);
      return median(band);
    });
    if(Math.min(...widths)<3)throw Error("有效轮廓过窄，请裁掉图片四周留白");
    const max=Math.max(...widths),profile=widths.map(x=>x/max);
    const nearest=examples.map(e=>({kind:e.kind,d:e.widths.reduce((sum,x,i)=>sum+(x-profile[i])**2,0)})).sort((a,b)=>a.d-b.d);
    const score={};for(const n of nearest.slice(0,5))score[n.kind]=(score[n.kind]||0)+1/(.001+n.d);
    const kind=Object.keys(score).sort((a,b)=>score[b]-score[a])[0];
    return {kind,widths,height,color:"#"+colors.map(c=>median(c).toString(16).padStart(2,"0")).join("")};
  }
  function draft(features,kind,avatar,measures){
    const src=kind==="skirt"?Pattern.skirt():kind==="shirt"?structuredClone(Examples[2]):Pattern.vest();
    delete src.frameState;
    const widths=features.widths,reference=kind==="skirt"?widths[0]:widths[4];
    const half=kind==="skirt"?(measures.waist+4)/4:(measures.bust+8)/4;
    const length=clamp(features.height/reference*half*2,kind==="dress"?65:26,kind==="dress"?112:85);
    for(const piece of src.pieces){
      const original=Math.max(...piece.points.map(p=>p[1]));
      const baseline=kind==="skirt"?19.5:kind==="shirt"?22:23;
      piece.points=piece.points.map(([x,y,bend],i)=>{
        let newX=x*half/baseline;
        if(y===original)newX=Math.sign(x)*half*clamp(widths[7]/reference,.65,2);
        if(kind==="shirt"&&(i===2||i===9))newX=Math.sign(x)*half*clamp(Math.max(...widths)/reference,1.15,1.95);
        return [Pattern.round(newX),Pattern.round(y*length/original),Pattern.round(bend*half/baseline)];
      });
      if(kind==="dress"){
        // Insert waist shaping into both side seams, preserving their correspondence.
        for(const i of [4,2]){const [a,b]=piece.points.slice(i,i+2),y=clamp(39,a[1]<b[1]?a[1]+3:b[1]+3,Math.max(a[1],b[1])-3);
          piece.points.splice(i+1,0,[Math.sign(a[0])*Pattern.round(Math.max((measures.waist+5)/4,half*clamp(widths[3]/reference,.75,1.1))),Pattern.round(y),0]);}
      }
      piece.color=features.color;piece.print="solid";
    }
    if(kind==="dress")src.seams=[0,2,3,5,6,8].map(e=>Pattern.seam("front",e,"back",e));
    Object.assign(src,{name:"图片制版 · "+labels[kind],meshQuality:2,avatar,measures:structuredClone(measures)});
    return Pattern.validate(src);
  }
  return {analyse,draft,labels};
})();
(()=>{
  const dialog=document.createElement("dialog");dialog.className="image-draft";
  dialog.innerHTML='<h2>服装图片制版</h2><p>上传单件服装的正面平铺图，使用纯色或透明背景。款式和衣长由轮廓估算，背片按原型补全。</p><input type="file" accept="image/png,image/jpeg,image/webp" aria-label="正面服装图片"><img hidden alt="服装参考图"><label>识别款式<select disabled></select></label><p role="status"></p><div><button type="button">取消</button> <button class="primary" disabled>生成纸样并试穿</button></div>';
  document.body.append(dialog);
  const input=dialog.querySelector("input"),preview=dialog.querySelector("img"),select=dialog.querySelector("select"),status=dialog.querySelector('[role=status]'),[cancel,apply]=dialog.querySelectorAll("button");
  for(const [key,label] of Object.entries(ImageDraft.labels))select.add(new Option(label,key));
  let features,url="",revision=0;
  $("imageDraft").onclick=()=>dialog.showModal();cancel.onclick=()=>dialog.close();
  dialog.onclose=()=>{revision++;if(url)URL.revokeObjectURL(url);url="";input.value="";features=null;preview.hidden=true;preview.removeAttribute("src");select.disabled=apply.disabled=true;status.textContent="";};
  input.onchange=async()=>{
    const ticket=++revision;features=null;select.disabled=apply.disabled=true;preview.hidden=true;
    if(url)URL.revokeObjectURL(url);url="";const f=input.files[0];if(!f)return;
    try{
      if(f.size>24*1024*1024)throw Error("请选择 24 MB 以内的图片");
      url=URL.createObjectURL(f);preview.src=url;await preview.decode();if(ticket!==revision)return;
      preview.hidden=false;features=ImageDraft.analyse(preview);select.value=features.kind;
      select.disabled=apply.disabled=false;status.textContent="请核对款式。将按当前模特围度生成，可撤销。";
    }catch(e){if(ticket===revision)status.textContent=e.message;}
  };
  apply.onclick=()=>{try{
    const avatar=project.avatar||"form",next=ImageDraft.draft(features,select.value,avatar,project.measures);
    replaceProject(next,"已生成图片纸样并试穿 · 可撤销");if(project.name===next.name)dialog.close();
  }catch(e){status.textContent=e.message;}};
})();
