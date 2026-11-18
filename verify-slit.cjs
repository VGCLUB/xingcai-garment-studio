"use strict";
const assert=require("node:assert/strict"),path=require("node:path"),fs=require("node:fs");
const {pathToFileURL}=require("node:url"),{chromium}=require(process.env.PLAYWRIGHT_CORE||"playwright-core");
const out=process.argv[2]||fs.mkdtempSync(path.join(require("node:os").tmpdir(),"xingcai-slit-"));
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe",args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
  try {
    const page=await browser.newPage({offline:true,viewport:{width:1520,height:960},acceptDownloads:true}),errors=[];
    page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
    await page.goto(pathToFileURL(path.join(__dirname,"index.html")).href);
    await page.waitForFunction(()=>!document.body.inert&&typeof model!=="undefined"&&model);
    await page.locator("#new").selectOption("skirt");
    await page.locator("[data-unsew]").first().click();
    await page.locator('[data-mode="free"]').click();
    async function pick(id,u){
      const point=await page.locator('.edge[data-id="'+id+'"][data-edge="0"]').evaluate((e,u)=>{
        const p=e.getPointAtLength(e.getTotalLength()*u).matrixTransform(e.getScreenCTM());
        return [p.x,p.y];
      },u);
      await page.mouse.click(...point);
    }
    for(const id of ["front","back"]){await pick(id,.02);await pick(id,.67);}
    const seam=await page.evaluate(()=>project.seams.at(-1));
    assert(seam.aRange && seam.bRange && seam.aRange[1]>.64 && seam.aRange[1]<.70);
    await page.locator("#undo").click();await page.locator("#redo").click();
    assert.deepEqual(await page.evaluate(()=>project.seams.at(-1)),seam);
    await page.locator("#title").fill("单侧开衩 A 字裙");await page.locator("#title").press("Tab");
    const mechanics=await page.evaluate(()=>{
      const s=project.seams.at(-1),panel=model.panels[0];
      for(const t of s.aRange)if(!panel.parameters[0].includes(t))throw Error("缝止点未进入网格");
      const bad=structuredClone(project);bad.seams.push(structuredClone(s));
      let overlap=false;try{Pattern.validate(bad);}catch{overlap=true;}
      const rest={coords:[[0,0],[1,0],[0,1]],faces:[0,1,2]};
      const rigid=Strain.field(rest,[3,4,5,3,5,5,3,4,6]).peak;
      const stretch=Strain.field(rest,[0,0,0,1.2,0,0,0,1,0]).peak;
      const p=project.pieces[0];
      return {overlap,rigid,stretch,sewnCm:Pattern.spanLength(p,0,s.aRange),edgeCm:Pattern.length(p,0)};
    });
    assert(mechanics.overlap&&Math.abs(mechanics.rigid-1)<1e-9&&Math.abs(mechanics.stretch-1.2)<1e-9);
    await page.locator("#simulate").click();await page.waitForFunction(()=>model.steps>=60);await page.locator("#simulate").click();
    assert(await page.evaluate(()=>model.pos.every(Number.isFinite)));
    await page.locator("#focus").click();await page.locator("#strain").click();assert(await page.locator("#strainLegend").isVisible());
    await page.locator("#stage").screenshot({path:path.join(out,"开衩裙-伸长率.png")});
    for(const [id,ext] of [["save","xingcai.json"],["svgout","svg"]]){
      const wait=page.waitForEvent("download");await page.locator("#"+id).click();await(await wait).saveAs(path.join(out,"单侧开衩裙."+ext));
    }
    assert.equal((fs.readFileSync(path.join(out,"单侧开衩裙.svg"),"utf8").match(/data-seam-span=/g)||[]).length,2);
    await page.locator("#new").selectOption("blank");await page.locator("#file").setInputFiles(path.join(out,"单侧开衩裙.xingcai.json"));
    await page.waitForFunction(()=>document.querySelector("#status").textContent==="工程已打开");
    assert.deepEqual(await page.evaluate(()=>project.seams.at(-1)),seam);
    assert.deepEqual(errors,[]);console.log("PASS",mechanics);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
