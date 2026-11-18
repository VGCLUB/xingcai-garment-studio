"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");
const validator = require(process.env.GLTF_VALIDATOR || "gltf-validator");
const root = __dirname;
const out = path.resolve(
  process.argv[2] ||
    fs.mkdtempSync(path.join(require("os").tmpdir(), "xingcai-optics-")),
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
      offline: true,
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(pathToFileURL(path.join(root, "index.html")).href);
    await page.waitForFunction(
      () => !document.body.inert && typeof model !== "undefined" && model,
    );
    const scatter = await page.evaluate(() => {
      const T = THREE,
        renderer = new T.WebGLRenderer(),
        scene = new T.Scene();
      const target = new T.WebGLRenderTarget(32, 32, { type: T.FloatType });
      const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
      camera.position.z = 5;
      camera.lookAt(0, 0, 0);
      const back = new T.DirectionalLight(0xffffff, 1);
      back.position.set(0, 0, -5);
      scene.add(back);
      const plane = new T.Mesh(new T.PlaneGeometry(2, 2));
      scene.add(plane);
      const result = [];
      for (const [subsurface, thickness] of [
        [0, 0.025],
        [0.8, 0.025],
        [0.8, 0.3],
      ]) {
        const p = {
          id: "test",
          fabric: "cotton",
          print: "solid",
          color: "#c98967",
        };
        const graph = MaterialGraph.upgrade(
          MaterialSystem.create(p, "flannel"),
        );
        MaterialSystem.connect(graph, "surface.Base Color", "");
        MaterialSystem.connect(graph, "surface.Normal", "");
        Object.assign(MaterialSystem.get(graph, "surface"), {
          subsurface,
          thickness,
          sheenWeight: 0,
        });
        const mat = Textiles.material({ ...p, material: graph }, false, 1);
        plane.material = mat;
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
        const pixel = new Float32Array(4);
        renderer.readRenderTargetPixels(target, 16, 16, 1, 1, pixel);
        result.push(Array.from(pixel.slice(0, 3)));
        mat.dispose();
      }
      target.dispose();
      plane.geometry.dispose();
      renderer.dispose();
      return result;
    });
    assert(
      scatter[1][0] > scatter[0][0] + 0.025 &&
        scatter[1][0] > scatter[2][0] + 0.025,
    );
    assert(scatter[1][0] > scatter[1][1] && scatter[1][1] > scatter[1][2]);
    console.log(
      "PASS isolated GPU backlighting and thickness response",
      scatter,
    );
    const garment = await page.evaluate(() => {
      const pieces = [],
        seams = [];
      for (const side of ["front", "back"]) {
        const lining = Pattern.piece(
          side + "_lining",
          side === "front" ? "前片 · 绒布内衬" : "后片 · 绒布内衬",
          [
            [-22, 0, 0],
            [-32, 36, 1.5],
            [32, 36, 0],
            [22, 0, 0],
          ],
          side,
          0,
        );
        Object.assign(lining, {
          fabric: "cotton",
          color: "#287365",
          takeup: 97,
          pleat: 0.55,
          pitch: 15,
        });
        lining.material = MaterialGraph.upgrade(
          MaterialSystem.create(lining, "flannel"),
        );
        const organza = Pattern.piece(
          side + "_shell",
          side === "front" ? "前片 · 欧根纱" : "后片 · 欧根纱",
          [
            [-27, 0, 0],
            [-45, 58, 2.2],
            [45, 58, 0],
            [27, 0, 0],
          ],
          side,
          0,
        );
        Object.assign(organza, {
          fabric: "silk",
          color: "#b1d3c8",
          takeup: 96,
          pleat: 1.45,
          pitch: 16,
          layer: 1,
        });
        const g = MaterialGraph.upgrade(
          MaterialSystem.create(organza, "organza"),
        );
        g.nodes.push(
          {
            id: "weft",
            type: "ShaderNodeTexWave",
            params: { scale: 65, angle: 90 },
          },
          {
            id: "warp",
            type: "ShaderNodeTexWave",
            params: { scale: 91, angle: 0 },
          },
          {
            id: "yarns",
            type: "ShaderNodeMath",
            params: { operation: "multiply", a: 0.5, b: 0.5 },
          },
          {
            id: "sheer",
            type: "ShaderNodeValToRGB",
            params: {
              low: 0.1,
              high: 0.9,
              black: 0.68,
              white: 0.82,
              dark: "#000000",
              light: "#ffffff",
            },
          },
        );
        for (const [from, to] of [
          ["mapping.Vector", "weft.Vector"],
          ["mapping.Vector", "warp.Vector"],
          ["weft.Fac", "yarns.A"],
          ["warp.Fac", "yarns.B"],
          ["yarns.Value", "sheer.Fac"],
          ["sheer.Fac", "surface.Transmission Weight"],
          ["yarns.Value", "bump.Height"],
        ])
          MaterialSystem.connect(g, to, from);
        organza.material = g;
        pieces.push(organza, lining);
      }
      for (const layer of ["lining", "shell"])
        for (const edge of [0, 2])
          seams.push(
            Pattern.seam("front_" + layer, edge, "back_" + layer, edge),
          );
      const p = Pattern.validate({
        format: "xingcai",
        version: 2,
        name: "潮汐 · 欧根纱叠裙",
        pieces,
        seams,
        light: "studio",
        allowance: 1,
      });
      const built = Garment.create(p);
      for (let i = 0; i < 120; i++) built.step();
      if (!built.pos.every(Number.isFinite)) throw Error("垂坠结果含无效坐标");
      return { ...p, frameState: built.snapshot() };
    });
    const projectPath = path.join(out, "潮汐-欧根纱叠裙.xingcai.json");
    fs.writeFileSync(projectPath, JSON.stringify(garment, null, 2));
    await page.locator("#file").setInputFiles(projectPath);
    await page.waitForFunction(
      () => document.querySelector("#status").textContent === "工程已打开",
    );
    assert.deepEqual(
      await page.evaluate(() => model.snapshot()),
      garment.frameState,
    );
    const layerContact = await page.evaluate(() => {
      const baseline = structuredClone(project);
      baseline.pieces.forEach((p) => delete p.layer);
      const unlayered = Garment.create(baseline);
      for (let i = 0; i < model.steps; i++) unlayered.step();
      function measure(drape) {
        const lining = [],
          samples = [];
        for (const [i, faces] of drape.faces.entries()) {
          const vertex = (j) =>
            new THREE.Vector3().fromArray(
              drape.pos,
              3 * (drape.offsets[i] + j),
            );
          for (let j = 0; j < faces.length; j += 3) {
            const a = vertex(faces[j]),
              b = vertex(faces[j + 1]),
              c = vertex(faces[j + 2]);
            if (project.pieces[i].layer)
              samples.push(
                a
                  .add(b)
                  .add(c)
                  .multiplyScalar(1 / 3),
              );
            else
              lining.push({
                a,
                b,
                c,
                low: Math.min(a.y, b.y, c.y),
                high: Math.max(a.y, b.y, c.y),
              });
          }
        }
        const hit = new THREE.Vector3(),
          ray = new THREE.Ray();
        let penetrations = 0,
          maxDepth = 0;
        for (const point of samples) {
          ray.origin.set(0, point.y, 0);
          ray.direction.set(point.x, 0, point.z).normalize();
          const radius = Math.hypot(point.x, point.z);
          let depth = 0;
          for (const { a, b, c, low, high } of lining) {
            if (
              point.y < low ||
              point.y > high ||
              !ray.intersectTriangle(a, b, c, false, hit)
            )
              continue;
            depth = Math.max(depth, Math.hypot(hit.x, hit.z) - radius);
          }
          if (depth > 0.05) penetrations++;
          maxDepth = Math.max(maxDepth, depth);
        }
        return { samples: samples.length, penetrations, maxDepthCm: maxDepth };
      }
      return {
        thresholdCm: 0.05,
        without: measure(unlayered),
        with: measure(model),
      };
    });
    assert(layerContact.without.penetrations > 0);
    assert.equal(layerContact.with.penetrations, 0);
    console.log("PASS garment layer contact", layerContact);
    assert.deepEqual(
      errors.map((x) => x.split("\n").slice(0, 14).join("\n")),
      [],
    );
    const download = async (button, name) => {
      const promise = page.waitForEvent("download", { timeout: 180000 });
      await page.locator(button).click();
      const file = path.join(out, name);
      await (await promise).saveAs(file);
      return file;
    };
    await page.locator("#editMaterial").click();
    await page.screenshot({ path: path.join(out, "节点图.png") });
    await page.locator("#mat-add").selectOption("ShaderNodeMath");
    await page.waitForFunction(
      () => document.querySelector("#mat-status").textContent === "节点已添加",
    );
    const added = await page.evaluate(
      () => project.pieces[0].material.nodes.at(-1).id,
    );
    await page
      .locator('[data-socket="' + added + '.A"]')
      .selectOption("yarns.Value");
    await page.waitForFunction(
      () =>
        document.querySelector("#mat-status").textContent === "节点连线已更新",
    );
    await page.locator("#mat-delete").click();
    await page.waitForFunction(
      () => document.querySelector("#mat-status").textContent === "节点已删除",
    );
    const materialFile = await download("#mat-save", "欧根纱.xcmat.json");
    const graphFile = JSON.parse(fs.readFileSync(materialFile, "utf8"));
    assert.equal(graphFile.version, 2);
    assert.deepEqual(graphFile, garment.pieces[0].material);
    const cycleRejected = await page.evaluate(() => {
      const g = structuredClone(project.pieces[0].material);
      MaterialSystem.connect(g, "yarns.A", "sheer.Fac");
      try {
        MaterialSystem.validate(g);
        return false;
      } catch (error) {
        return error.message.includes("循环");
      }
    });
    assert(cycleRejected);
    await page.locator('button[aria-label="关闭材质编辑器"]').click();
    assert.deepEqual(
      await page.evaluate(() => model.snapshot()),
      garment.frameState,
    );
    const glb = await download("#glb", "潮汐-欧根纱叠裙.glb");
    const buffer = fs.readFileSync(glb);
    const gltf = JSON.parse(
      buffer.toString("utf8", 20, 20 + buffer.readUInt32LE(12)),
    );
    assert(gltf.extensionsUsed.includes("KHR_materials_transmission"));
    assert(!gltf.extensionsUsed.includes("KHR_materials_volume"));
    const report = await validator.validateBytes(new Uint8Array(buffer));
    assert.equal(
      report.issues.numErrors + report.issues.numWarnings,
      0,
      JSON.stringify(report.issues.messages.slice(0, 8)),
    );
    console.log(
      "PASS 120 cloth steps, editable graph, cycle validation, GLB thin transmission",
    );
    await page.locator("#photoTools").click();
    await page.locator("#samples").selectOption("8");
    await download("#photo", "潮汐-中性柔光.png");
    await page.locator("#light").selectOption("backlit");
    await download("#photo", "潮汐-透光背光.png");
    await page.locator("#pose").selectOption("detail");
    await download("#photo", "潮汐-面料近景.png");
    await page.locator("#pose").selectOption("angle");
    await page.evaluate(() => {
      change(
        (n) => {
          for (const p of n.pieces) {
            const s = MaterialSystem.get(p.material, "surface");
            s.transmission = 0;
            s.subsurface = 0;
            MaterialSystem.connect(
              p.material,
              "surface.Transmission Weight",
              "",
            );
          }
        },
        "材质基准",
        { appearance: true },
      );
    });
    await download("#photo", "潮汐-关闭透射与散射.png");
    assert.deepEqual(
      errors.map((x) => x.split("\n").slice(0, 14).join("\n")),
      [],
    );
    fs.writeFileSync(
      path.join(out, "验证结果.json"),
      JSON.stringify(
        {
          solverSteps: garment.frameState.steps,
          nodes: garment.pieces[0].material.nodes.length,
          layerContact,
          linearBacklightRGB: {
            disabled: scatter[0],
            thin: scatter[1],
            thicker: scatter[2],
          },
          glbErrors: report.issues.numErrors,
          glbWarnings: report.issues.numWarnings,
          webglErrors: errors,
        },
        null,
        2,
      ),
    );
    console.log("PASS shelf renders and comparison", out);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
