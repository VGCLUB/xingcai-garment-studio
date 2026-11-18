"use strict";
// Set PLAYWRIGHT_CORE and CHROME_PATH when the browser test tools are outside this folder.
// Pass an empty output folder to keep the garments and exports produced through the UI.
const assert=require("node:assert/strict"), fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const {pathToFileURL}=require("node:url");
const {chromium}=require(process.env.PLAYWRIGHT_CORE||"playwright-core");
const output=process.argv[2]||fs.mkdtempSync(path.join(os.tmpdir(),"xingcai-"));
fs.mkdirSync(output,{recursive:true});
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
  try{
    const page=await browser.newPage({viewport:{width:1500,height:940},acceptDownloads:true});
    const errors=[];page.on("pageerror",e=>errors.push(e.message));page.setDefaultTimeout(9000);
    const loc=s=>page.locator(s),read=()=>page.evaluate(()=>structuredClone(project));
    const click=s=>loc(s).click(),set=async(s,value)=>{await loc(s).fill(String(value));await loc(s).press("Tab");};
    const at=(key)=>'[data-action="'+key+'"]';
    async function mousePoint(selector,u=.5){
      const xy=await loc(selector).evaluate((el,t)=>{
        const pt=el.getPointAtLength(el.getTotalLength()*t).matrixTransform(el.getScreenCTM());return [pt.x,pt.y];
      },u);await page.mouse.click(...xy);
    }
    async function garment(name){
      await set("#title",name);await click("#simulate");
      await page.waitForFunction(()=>model.steps>=75,null,{timeout:30000});await click("#simulate");await click("#focus");
      assert(await page.evaluate(()=>model.pos.every(Number.isFinite)));
      for(const [button,ext] of [["save","xingcai.json"],["svgout","svg"],["obj","obj"],["glb","glb"]]){
        const promise=page.waitForEvent("download");await click("#"+button);await (await promise).saveAs(path.join(output,name+"."+ext));
      }
      const svg=fs.readFileSync(path.join(output,name+".svg"),"utf8");
      const valid=await page.evaluate(text=>{const doc=new DOMParser().parseFromString(text,"image/svg+xml");return !doc.querySelector("parsererror")&&doc.querySelectorAll('[data-line="cut"]').length===project.pieces.length&&doc.rootElement.getAttribute("width").endsWith("cm");},svg);
      assert(valid);const obj=fs.readFileSync(path.join(output,name+".obj"),"utf8");
      const vertices=obj.match(/^v /gm).length,faces=obj.match(/^f /gm).length;
    assert.equal((svg.match(/data-seam=/g)||[]).length,(await read()).seams.length*2);
    assert.equal(obj.match(/^vt /gm).length,vertices);assert(obj.split("\n").filter(s=>s.startsWith("f ")).every(s=>/^f (\d+\/\d+ ){2}\d+\/\d+$/.test(s)));
      const expected=await page.evaluate(()=>[model.pos.length/3,model.faces.flat().length/3]);assert.deepEqual([vertices,faces],expected);
      await page.screenshot({path:path.join(output,name+".png"),fullPage:true});
    await click("#photoTools");
    const imageFile=path.join(output,name+"-棚拍.png"),photo=page.waitForEvent("download",{timeout:60000});
    await click("#photo");await(await photo).saveAs(imageFile);
    const header=fs.readFileSync(imageFile).subarray(0,24);assert.equal(header.readUInt32BE(16),2048);assert.equal(header.readUInt32BE(20),2560);
    await click("#photoTools");
    const design=await read(),positions=await page.evaluate(()=>Array.from(new Float32Array(model.pos)));await loc("#new").selectOption("blank");
      await loc("#file").setInputFiles(path.join(output,name+".xingcai.json"));
      await page.waitForFunction(()=>document.querySelector("#status").textContent==="工程已打开");assert.deepEqual(await read(),design);
      assert.deepEqual(await page.evaluate(()=>Array.from(model.pos)),positions);
      console.log(name,design.pieces.length+" panels",design.seams.length+" seams",vertices+" vertices",faces+" triangles");
    }
    await page.goto(pathToFileURL(path.join(__dirname,"index.html")).href);await loc("#stage canvas").waitFor();
    await loc("#new").selectOption("skirt");
    for(const id of ["front","back"]){
      await loc("#parts").selectOption(id);await set(at("length"),60);await set(at("width"),86);
      await loc(at("edge")).selectOption("0");await set(at("px"),-27);
      await loc(at("edge")).selectOption("3");await set(at("px"),27);
    }
    for(const id of ["front","back"]){
      await loc("#parts").selectOption(id);
      await loc(at("edge")).selectOption("1");await click('[data-op="insert"]');
      await loc(at("edge")).selectOption("4");await click('[data-op="insert"]');
      await click('[data-mode="cut"]');
      await click('circle[data-id="'+id+'"][data-node="2"]');await click('circle[data-id="'+id+'"][data-node="5"]');
    }
    assert.equal((await read()).pieces.length,4);
    for(const p of (await read()).pieces){
      await loc("#parts").selectOption(p.id);const details=loc('details[data-section="fabric"]');if(!(await details.getAttribute("open")!==null))await details.locator("summary").click();
      await loc(at("color")).fill(p.name.endsWith("A")?"#856042":"#525f52");await loc(at("fabric")).selectOption("linen");await set(at("takeup"),78);
      if(p.name.endsWith("A"))await loc(at("print")).selectOption("check");
    }
    await set("#allowance",1.2);await garment("双色拼片裙");
    await loc("#new").selectOption("vest");await loc("#parts").selectOption("front");
    await loc(at("edge")).selectOption("7");await set(at("bend"),-8.5);
    await click("#undo");assert.equal((await read()).pieces[0].points[7][2],-11);await click("#redo");
    await set(at("length"),61);assert((await loc(".warn").count())>=2);
    await loc("#parts").selectOption("back");await set(at("length"),61);assert.equal(await loc(".warn").count(),0);
    await click('[data-unsew="0"]');await click('[data-mode="sew"]');await mousePoint('path[data-id="front"][data-edge="0"]');await mousePoint('path[data-id="back"][data-edge="0"]');
    assert.equal((await read()).seams.length,4);await click('[data-flip="3"]');assert((await read()).seams[3].reverse);await click('[data-flip="3"]');
    await click('[data-mode="edit"]');
    for(const id of ["front","back"]){await loc("#parts").selectOption(id);if(await loc('details[data-section="fabric"]').getAttribute("open")===null)await click('details[data-section="fabric"] summary');
      await loc(at("fabric")).selectOption("jacquard");await loc(at("color")).fill("#356c70");}
    await click("#bodyprops summary");await set(at("bust"),95);assert.equal((await read()).measures.bust,95);
    await click("#photoTools");await loc("#light").selectOption("night");await click("#photoTools");
    await garment("浅弧领长背心");
    await loc("#new").selectOption("blank");await click('[data-mode="draw"]');
    const pts=[[-9,0],[-21,2],[-36,11],[-30,22],[-22,20],[-22,48],[22,48],[22,20],[30,22],[36,11],[21,2],[9,0]];
    for(const [x,y] of pts){
      const screen=await loc("#paper").evaluate((el,[x,y])=>{const pt=new DOMPoint(260+4*x,95+4*y).matrixTransform(el.getScreenCTM());return [pt.x,pt.y];},[x,y]);await page.mouse.click(...screen);
    }
    await click("#finish");assert.equal((await read()).pieces.length,1);
    await set("#partname","前身连袖");await loc(at("edge")).selectOption("11");await set(at("bend"),-7);
    if(await loc('details[data-section="fabric"]').getAttribute("open")===null)await click('details[data-section="fabric"] summary');
    await loc(at("placement")).selectOption("front");await set(at("height"),42);await set(at("depth"),0);
    await loc(at("color")).fill("#945c68");await loc(at("print")).selectOption("stripe");await click('[data-op="copy"]');await set("#partname","后身连袖");
    await loc(at("placement")).selectOption("back");await loc(at("edge")).selectOption("11");await set(at("bend"),-2.5);
    const [front,back]=(await read()).pieces.map(p=>p.id);
    await click('[data-mode="sew"]');
    for(const e of [0,1,3,4,6,7,9,10]){
      await mousePoint('path[data-id="'+front+'"][data-edge="'+e+'"]');await mousePoint('path[data-id="'+back+'"][data-edge="'+e+'"]');
    }
    assert.equal((await read()).seams.length,8);await click('[data-mode="edit"]');
    await click("#photoTools");await loc("#light").selectOption("warm");await click("#photoTools");
    await garment("连袖短衫");
    await page.reload();assert.equal((await read()).name,"连袖短衫");
    const design=await read();await loc("#file").setInputFiles({name:"bad.json",mimeType:"application/json",buffer:Buffer.from("{}")});
    await page.waitForFunction(()=>document.querySelector("#status").textContent.includes("失败"));assert.deepEqual(await read(),design);
    const legacy={format:"xingcai-skirt",version:1,pieces:[0,1].map(()=>({waist:39,hem:68,length:58,color:"#665544"})),seams:["right"]};
    await loc("#file").setInputFiles({name:"old.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(legacy))});
    await page.waitForFunction(()=>project.name==="双片 A 字裙");assert.equal((await read()).seams.length,1);
    await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);console.log("PASS · design, drape, seam pairing, exports, undo, recovery, import and mobile layout");
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});


