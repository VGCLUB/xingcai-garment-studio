const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  { pathToFileURL } = require("url"),
  { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core"),
  validator = require(process.env.GLTF_VALIDATOR || "gltf-validator");
const root = __dirname,
  out =
    process.argv[2] ||
    fs.mkdtempSync(
      path.join(require("os").tmpdir(), "xingcai-material-renders-"),
    );
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
    await page.locator("#new").selectOption("sample3");
    await page.evaluate(() =>
      change(
        (n) =>
          n.pieces.forEach((p) => {
            p.color = "#5b777b";
            p.print = "solid";
          }),
        "材质对照",
        { appearance: true },
      ),
    );
    const initial = await page.evaluate(() => Array.from(model.pos));
    async function save(button, file) {
      const wait = page.waitForEvent("download", { timeout: 180000 });
      await page.locator(button).click();
      await (await wait).saveAs(path.join(out, file));
    }
    const stats = [];
    for (const [id, name] of [
      ["cotton", "棉布"],
      ["satin", "缎面"],
      ["velvet", "天鹅绒"],
      ["coated", "涂层织物"],
    ]) {
      await page.locator("#editMaterial").click();
      await page.locator("#mat-preset").selectOption(id);
      await page.waitForFunction(
        () =>
          !document.querySelector("#materialEditor").hasAttribute("aria-busy"),
      );
      await page.locator("#mat-all").click();
      await page.waitForFunction(() =>
        document
          .querySelector("#mat-status")
          .textContent.startsWith("已应用到全部"),
      );
      await save("#mat-save", name + ".xcmat.json");
      if (id === "velvet")
        await page.screenshot({ path: path.join(out, "材质节点.png") });
      await page.locator('button[aria-label="关闭材质编辑器"]').click();
      assert.deepEqual(
        await page.evaluate(() => Array.from(model.pos)),
        initial,
      );
      await save("#save", name + ".xingcai.json");
      await save("#glb", name + ".glb");
      const buf = fs.readFileSync(path.join(out, name + ".glb")),
        v = await validator.validateBytes(new Uint8Array(buf));
      assert.equal(
        v.issues.numErrors + v.issues.numWarnings,
        0,
        JSON.stringify(v.issues.messages),
      );
      const json = JSON.parse(
        buf.toString("utf8", 20, 20 + buf.readUInt32LE(12)),
      );
      assert(json.materials.every((m) => m.extras.materialGraph));
      await page.locator("#photoTools").click();
      await page.locator("#light").selectOption("studio");
      await page.locator("#pose").selectOption("angle");
      await page.locator("#samples").selectOption("8");
      await save("#photo", name + ".png");
      await page.locator("#photoTools").click();
      stats.push({
        preset: id,
        glbErrors: v.issues.numErrors,
        glbWarnings: v.issues.numWarnings,
        poseUnchanged: true,
      });
      console.log(name, "rendered, GLB validated");
    }
    const comparison = await page.evaluate(
      async (sources) => {
        const canvas = document.createElement("canvas");
        canvas.width = 1600;
        canvas.height = 1080;
        const context = canvas.getContext("2d");
        context.fillStyle = "#eeeae3";
        context.fillRect(0, 0, 1600, 1080);
        context.fillStyle = "#28332e";
        context.font = '24px "Microsoft YaHei",sans-serif';
        context.fillText(
          "同一试衣帧 · 相同染色、机位与灯光 · 8 次采样",
          24,
          38,
        );
        for (const [i, { name, url }] of sources.entries()) {
          const image = new Image();
          image.src = url;
          await image.decode();
          context.drawImage(image, i * 400, 58, 400, 500);
          context.fillStyle = "#28332e";
          context.font = '22px "Microsoft YaHei",sans-serif';
          context.fillText(name, i * 400 + 20, 592);
          context.drawImage(image, 580, 1100, 800, 800, i * 400, 618, 400, 400);
        }
        context.font = '18px "Microsoft YaHei",sans-serif';
        context.fillText(
          "下排为同一位置的面料局部。上排与下排均来自形裁实际 PNG 输出。",
          24,
          1054,
        );
        return canvas.toDataURL("image/png").split(",")[1];
      },
      ["棉布", "缎面", "天鹅绒", "涂层织物"].map((name) => ({
        name,
        url:
          "data:image/png;base64," +
          fs.readFileSync(path.join(out, name + ".png")).toString("base64"),
      })),
    );
    fs.writeFileSync(
      path.join(out, "同机位材质对照.png"),
      Buffer.from(comparison, "base64"),
    );
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, "验证结果.json"),
      JSON.stringify(
        {
          sameGeometry: true,
          sameDye: "#5b777b",
          light: "studio",
          pose: "angle",
          samples: 8,
          presets: stats,
          errors,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
