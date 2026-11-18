const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core"),
  path = require("path"),
  fs = require("fs"),
  { pathToFileURL } = require("url");
const root = __dirname,
  out =
    process.argv[2] ||
    fs.mkdtempSync(path.join(require("os").tmpdir(), "xingcai-gather-"));
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1420, height: 900 },
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
    await page.locator("#new").selectOption("sample4");
    async function photo(name, pose = "angle") {
      const bytes = await page.evaluate(
        async ({ pose }) => {
          const blob = await viewer.photo(960, pose, 8);
          return Array.from(new Uint8Array(await blob.arrayBuffer()));
        },
        { pose },
      );
      fs.writeFileSync(path.join(out, name + ".png"), Buffer.from(bytes));
    }
    await page.evaluate(() => viewer.light("backlit"));
    await photo("原版");
    const garment = await page.evaluate(() => {
      const p = structuredClone(OpticsExample);
      delete p.frameState;
      p.name = "潮汐 · 收褶纱裙";
      p.light = "backlit";
      for (const side of ["front", "back"]) {
        const lining = p.pieces.find((x) => x.id === side + "_lining");
        Object.assign(lining, {
          points: [
            [-19, 0, 0],
            [-23, 31, 2],
            [23, 31, 0],
            [19, 0, 0],
          ],
          height: -1,
          takeup: 98,
          pleat: 0.2,
        });
        const shell = p.pieces.find((x) => x.id === side + "_shell");
        Object.assign(shell, {
          points: [
            [-30, 0, 0],
            [-51, 58, 3],
            [51, 58, 0],
            [30, 0, 0],
          ],
          meshSpacing: 1.9,
          takeup: 73,
          pleat: 1.9,
          pitch: 14,
          pin: "top",
        });
        const graph = shell.material,
          bsdf = MaterialSystem.get(graph, "surface");
        Object.assign(bsdf, {
          roughness: 0.46,
          specularIORLevel: 0.21,
          sheenTint: "#b0cbc0",
          sheenWeight: 0.22,
          sheenRoughness: 0.72,
          anisotropy: 0.38,
        });
        graph.nodes.push({
          id: "yarnGloss",
          type: "ShaderNodeMapRange",
          params: { fromMin: 0, fromMax: 1, toMin: 0.41, toMax: 0.59 },
        });
        MaterialSystem.connect(graph, "yarnGloss.Value", "yarns.Value");
        MaterialSystem.connect(graph, "surface.Roughness", "yarnGloss.Value");
        const band = Pattern.piece(
          side + "_band",
          side === "front" ? "前腰头" : "后腰头",
          [
            [-19, 0, 0],
            [-20, 3.7, 0],
            [20, 3.7, 0],
            [19, 0, 0],
          ],
          side,
          3.7,
        );
        Object.assign(band, {
          color: "#366c61",
          fabric: "jacquard",
          meshSpacing: 1.5,
          layer: 1,
        });
        band.material = MaterialSystem.create(band, "cotton");
        MaterialSystem.get(band.material, "surface").roughness = 0.76;
        p.pieces.push(band);
        p.seams.push({
          ...Pattern.seam(band.id, 1, shell.id, 3, true),
          gather: true,
        });
      }
      for (const i of [0, 2])
        p.seams.push(Pattern.seam("front_band", i, "back_band", i));
      const next = Pattern.validate(p),
        d = Garment.create(next);
      for (let i = 0; i < 100; i++) d.step();
      if (!d.pos.every(Number.isFinite)) throw Error("invalid geometry");
      return { ...next, frameState: d.snapshot() };
    });
    const projectPath = path.join(out, "潮汐-收褶纱裙.xingcai.json");
    fs.writeFileSync(projectPath, JSON.stringify(garment));
    await page.locator("#file").setInputFiles(projectPath);
    await page.waitForFunction(
      () => document.querySelector("#status").textContent === "工程已打开",
    );
    await photo("收褶纱裙");
    await photo("腰头近景", "detail");
    for (const [id, ext] of [
      ["glb", "glb"],
      ["svgout", "svg"],
    ]) {
      const wait = page.waitForEvent("download");
      await page.locator("#" + id).click();
      await (await wait).saveAs(path.join(out, "潮汐-收褶纱裙." + ext));
    }
    if (errors.length) throw Error(errors.join("\n"));
    console.log("PASS six panels and exports");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
