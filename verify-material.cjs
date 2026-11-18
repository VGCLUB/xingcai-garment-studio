"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");
const root = __dirname,
  output =
    process.argv[2] ||
    path.join(require("os").tmpdir(), "xingcai-material-check");
fs.mkdirSync(output, { recursive: true });
const src = fs.readFileSync(
  path.join(root, "vendor/cycles/shader.tables"),
  "utf8",
);
const match = src.match(/table_sheen_ltc\[3072\] = \{([\s\S]*?)\};/);
const lut = match[1]
  .match(/[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?f?/g)
  .map((t) => Number(t.replace(/f$/, "")));
assert.equal(lut.length, 3072);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
function lookup(nv, rough, offset) {
  const x = Math.max(0, Math.min(1, nv)) * 31,
    y = Math.max(0.001, Math.min(1, rough)) * 31,
    ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy;
  const row = (j) =>
    (1 - fx) * lut[offset + j * 32 + ix] +
    fx * lut[offset + j * 32 + Math.min(ix + 1, 31)];
  return (1 - fy) * row(iy) + fy * row(Math.min(iy + 1, 31));
}
function reference(i) {
  const nv = 0.02 + ((i % 16) / 15) * 0.97,
    r = 0.04 + (Math.floor(i / 16) / 3) * 0.92,
    nl = 0.13 + (((i * 7) % 19) / 18) * 0.84,
    phi = i * 0.71;
  const V = [Math.sqrt(1 - nv * nv), 0, nv],
    L = [
      Math.sqrt(1 - nl * nl) * Math.cos(phi),
      Math.sqrt(1 - nl * nl) * Math.sin(phi),
      nl,
    ];
  const a = lookup(nv, r, 0),
    b = lookup(nv, r, 1024),
    albedo = lookup(nv, r, 2048);
  const len = (a * L[0] + b * L[2]) ** 2 + (a * L[1]) ** 2 + L[2] ** 2;
  const sheen =
    Math.abs(a) < 1e-5 || albedo < 1e-5
      ? 0
      : ((0.6 * albedo) / Math.PI) * nl * (a / len) ** 2;
  const sigma = 0.72,
    A = 1 / (Math.PI + sigma * (Math.PI / 2 - 2 / 3)),
    B = sigma * A,
    color = 0.47;
  let t = dot(L, V) - nl * nv;
  if (t > 0) t /= Math.max(nl, nv);
  const G = (c) => {
    if (c < 1e-6) return Math.PI / 2 - 2 / 3 - c;
    const s = Math.sqrt(1 - c * c);
    return (
      s * (Math.acos(c) - 2 / 3 - s * c) + (2 / 3) * (s / c) * (1 - s ** 3)
    );
  };
  const Eavg = A * Math.PI + ((2 * Math.PI - 5.6) / 3) * B,
    Ev = A * Math.PI + B * G(nv),
    El = A * Math.PI + B * G(nl);
  const Ems =
    ((1 / Math.PI) * color ** 2 * (Eavg / (1 - Eavg))) /
    (1 - color * (1 - Eavg));
  return [
    sheen,
    color * nl * (A + B * t + Ems * (1 - Ev) * (1 - El)),
    albedo,
    Math.max(0, 1 - 0.6 * albedo),
  ];
}
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1600, height: 1000 },
        acceptDownloads: true,
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(pathToFileURL(path.join(root, "index.html")).href);
    await page.waitForFunction(
      () => !document.body.inert && typeof model !== "undefined" && model,
    );
    const actual = await page.evaluate(() => {
      const T = THREE,
        r = new T.WebGLRenderer(),
        scene = new T.Scene(),
        camera = new T.Camera();
      r.setSize(64, 1);
      const target = new T.WebGLRenderTarget(64, 1, {
        type: T.FloatType,
        depthBuffer: false,
      });
      const mat = new T.ShaderMaterial({
        uniforms: {
          xcSheenLTC: { value: CyclesMaterial.texture() },
          xcSheenColor: { value: new T.Vector3(0.6, 0.6, 0.6) },
          xcSheenRoughness: { value: 0.5 },
          xcDiffuseRoughness: { value: 0.72 },
          xcCoatIOR: { value: 1.5 },
        },
        vertexShader: "void main(){gl_Position=vec4(position.xy,0.,1.);}",
        fragmentShader:
          CyclesMaterial.glsl.replace(
            "uniform float xcSheenRoughness;",
            "float xcSheenRoughness;",
          ) +
          `
          void main(){float i=floor(gl_FragCoord.x),nv=.02+mod(i,16.)/15.*.97,r=.04+floor(i/16.)/3.*.92,nl=.13+mod(i*7.,19.)/18.*.84,phi=i*.71;
          vec3 V=vec3(sqrt(1.-nv*nv),0.,nv),L=vec3(sqrt(1.-nl*nl)*cos(phi),sqrt(1.-nl*nl)*sin(phi),nl);
          xcSheenRoughness=r;vec3 N=vec3(0.,0.,1.);
          gl_FragColor=vec4(xcSheenEval(N,V,L).r,xcDiffuse(N,V,L,vec3(.47),.72).r,xcTable(nv,r).z,xcLowerWeight(N,V));
          }`,
      });
      const mesh = new T.Mesh(new T.PlaneGeometry(2, 2), mat);
      scene.add(mesh);
      r.setRenderTarget(target);
      r.render(scene, camera);
      const out = new Float32Array(256);
      r.readRenderTargetPixels(target, 0, 0, 64, 1, out);
      target.dispose();
      mesh.geometry.dispose();
      mat.dispose();
      r.dispose();
      return Array.from(out);
    });
    let maximum = 0;
    for (let i = 0; i < 64; i++)
      reference(i).forEach((v, k) => {
        const delta = Math.abs(v - actual[4 * i + k]);
        maximum = Math.max(maximum, delta);
        assert(
          delta < 0.0001 * Math.max(1, Math.abs(v)),
          "GPU closure mismatch " + i + "/" + k + ": " + delta,
        );
      });
    console.log(
      "Cycles reference / GPU, 64 angle-roughness combinations. Max absolute error",
      maximum,
    );
    await page.locator("#new").selectOption("sample3");
    const before = await page.evaluate(() => Array.from(model.pos));
    await page.locator("#editMaterial").click();
    await page.locator("#mat-preset").selectOption("velvet");
    await page.waitForFunction(
      () =>
        !document.querySelector("#materialEditor").hasAttribute("aria-busy"),
    );
    const roughness = page.locator('[data-param="roughness"]');
    await roughness.fill(".06");
    await roughness.press("Tab");
    await page.waitForFunction(() => project.pieces[0].roughness === 6);
    await roughness.fill(".81");
    await roughness.press("Tab");
    await page.waitForFunction(() => project.pieces[0].roughness === 81);
    const field = page.locator('[data-param="sheenWeight"]');
    await field.fill(".88");
    await field.press("Tab");
    await page.waitForFunction(
      () =>
        MaterialSystem.get(project.pieces[0].material, "surface")
          .sheenWeight === 0.88,
    );
    await page
      .locator('[data-socket="surface.Roughness"]')
      .selectOption("ramp.Color");
    await page.waitForFunction(
      () =>
        !document.querySelector("#materialEditor").hasAttribute("aria-busy"),
    );
    assert.deepEqual(await page.evaluate(() => Array.from(model.pos)), before);
    const exported = page.waitForEvent("download");
    await page.locator("#mat-save").click();
    const downloaded = await exported;
    const materialPath = path.join(output, "roundtrip.xcmat.json");
    await downloaded.saveAs(materialPath);
    const saved = JSON.parse(fs.readFileSync(materialPath, "utf8"));
    assert.equal(
      saved.nodes.find((n) => n.id === "surface").params.sheenWeight,
      0.88,
    );
    await page.locator("#mat-preset").selectOption("satin");
    await page.waitForFunction(
      () =>
        !document.querySelector("#materialEditor").hasAttribute("aria-busy"),
    );
    await page.locator("#mat-file").setInputFiles(materialPath);
    await page.waitForFunction(
      () => document.querySelector("#mat-status").textContent === "材质已导入",
    );
    assert.deepEqual(
      await page.evaluate(() => project.pieces[0].material),
      saved,
    );
    await page.locator("#mat-file").setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
    await page.waitForFunction(() =>
      document.querySelector("#mat-status").textContent.includes("未能应用"),
    );
    assert.deepEqual(
      await page.evaluate(() => project.pieces[0].material),
      saved,
    );
    await page.locator("#mat-all").click();
    await page.waitForFunction(() =>
      document.querySelector("#mat-status").textContent.startsWith("已应用"),
    );
    assert(
      await page.evaluate(() =>
        project.pieces.every((p) => p.sheenLevel === 88 && p.roughness === 81),
      ),
    );
    await page.screenshot({ path: path.join(output, "节点编辑器.png") });
    await page.locator('button[aria-label="关闭材质编辑器"]').click();
    await page.locator("#undo").click();
    assert.deepEqual(await page.evaluate(() => Array.from(model.pos)), before);
    await page.locator("#redo").click();
    assert.deepEqual(await page.evaluate(() => Array.from(model.pos)), before);
    assert.deepEqual(
      await page.evaluate(() => project.pieces[0].material),
      saved,
    );
    const projectWait = page.waitForEvent("download");
    await page.locator("#save").click();
    const projectPath = path.join(output, "roundtrip.xingcai.json");
    await (await projectWait).saveAs(projectPath);
    await page.locator("#new").selectOption("blank");
    await page.locator("#file").setInputFiles(projectPath);
    await page.waitForFunction(
      () => document.querySelector("#status").textContent === "工程已打开",
    );
    assert.deepEqual(
      await page.evaluate(() => project.pieces[0].material),
      saved,
    );
    // Exercise file-backed image texture nodes through their normal upload path.
    await page.locator("#editMaterial").click();
    await page.locator('[data-node="normal"]').click();
    await page
      .locator('[data-image="normal"]')
      .setInputFiles(path.join(root, "materials/cotton_jersey_nor_gl.jpg"));
    await page.waitForFunction(
      () =>
        document.querySelector("#mat-status").textContent === "图像节点已更新",
    );
    const imageGraph = await page.evaluate(() => project.pieces[0].material);
    await page.locator('button[aria-label="关闭材质编辑器"]').click();
    const imageDownload = page.waitForEvent("download");
    await page.locator("#save").click();
    const imageProject = path.join(output, "embedded-image.xingcai.json");
    await (await imageDownload).saveAs(imageProject);
    // A fresh context ensures the imported image is decoded from project data.
    const fresh = await browser.newPage({
      viewport: { width: 1600, height: 1000 },
    });
    fresh.on("pageerror", (e) => errors.push(e.message));
    fresh.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await fresh.goto(pathToFileURL(path.join(root, "index.html")).href);
    await fresh.waitForFunction(
      () => !document.body.inert && typeof model !== "undefined" && model,
    );
    await fresh.locator("#file").setInputFiles(imageProject);
    await fresh.waitForFunction(
      () => document.querySelector("#status").textContent === "工程已打开",
    );
    assert.deepEqual(
      await fresh.evaluate(() => project.pieces[0].material),
      imageGraph,
    );
    await fresh.close();
    await page.locator("#editMaterial").click();
    await page.locator('[data-node="normal"]').click();
    await page.locator('[data-reset="normal"]').click();
    await page.waitForFunction(
      () =>
        document.querySelector("#mat-status").textContent === "已恢复内置贴图",
    );
    await page.locator('button[aria-label="关闭材质编辑器"]').click();
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(output, "checks.json"),
      JSON.stringify(
        {
          shaderCases: 64,
          maxAbsoluteError: maximum,
          materialRoundTrip: true,
          projectRoundTrip: true,
          preservedDrape: true,
          imageUpload: true,
          embeddedImageRoundTrip: true,
          historyPreservedDrape: true,
          invalidImportPreservedState: true,
          webglErrors: errors,
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS material presets, links, imports, saved project, texture upload and unchanged drape",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
