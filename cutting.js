"use strict";
const Cutting=(()=>{
  function split(project,id,a,b,newId){
    const p=project.pieces.find(q=>q.id===id),N=p.points.length;
    if(a===b||(a+1)%N===b||(b+1)%N===a)throw Error("请选择同片上两个不相邻的角点");
    const frame=structuredClone(p.frame||p.points),edges=new Map();
    function half(start,end,outId){
      const out={...structuredClone(p),id:outId,points:[],frame};
      for(let i=start;i!==end;i=(i+1)%N){
        edges.set(i,[outId,out.points.length]);out.points.push(p.points[i].slice());
      }
      out.points.push([...p.points[end].slice(0,2),0]);return out;
    }
    const left=half(a,b,id),right=half(b,a,newId);
    const area=p=>Math.abs(Pattern.outline(p).reduce((sum,a,i,pts)=>{const b=pts[(i+1)%pts.length];return sum+a[0]*b[1]-a[1]*b[0];},0))/2;
    if(Math.abs(area(left)+area(right)-area(p))>.4)throw Error("分割线须位于裁片内部");
    left.name=p.name.slice(0,36)+" A";right.name=p.name.slice(0,36)+" B";
    project.pieces.splice(project.pieces.indexOf(p),1,left,right);
    for(const s of project.seams)for(const k of ["a","b"])if(s[k][0]===id)s[k]=edges.get(s[k][1]);
    project.seams.push(Pattern.seam(id,left.points.length-1,newId,right.points.length-1,true));
  }
  function allowance(p,amount){
    if(!amount)return [];
    const pts=p.points.flatMap((_,i)=>Pattern.curve(p,i,.45).slice(0,-1));
    const path=pts.map(([x,y])=>({X:Math.round(x*1000),Y:Math.round(y*1000)}));
    if(!ClipperLib.Clipper.Orientation(path))path.reverse();
    const co=new ClipperLib.ClipperOffset(2,20),result=[];
    co.AddPath(path,ClipperLib.JoinType.jtMiter,ClipperLib.EndType.etClosedPolygon);co.Execute(result,amount*1000);
    if(!result.length)throw Error("无法生成此片的缝份");
    return result.map(loop=>loop.map(pt=>[pt.X/1000,pt.Y/1000]));
  }
  return {split,allowance};
})();
