"use strict";
const MaterialEditor = (() => {
  const modal = document.createElement("dialog");
  modal.id = "materialEditor";
  document.body.append(modal);
  modal.innerHTML = `<form method="dialog" class="mat-head"><h2>材质节点</h2><span id="mat-part"></span><button aria-label="关闭材质编辑器">×</button></form>
  <div class="mat-actions"><label>面料预设 <select id="mat-preset"><option value="">选择预设</option></select></label><button id="mat-upgrade">编辑节点图</button><label id="mat-add-label" hidden>添加节点 <select id="mat-add"><option value="">选择类型</option></select></label><button id="mat-delete" hidden>删除节点</button><button id="mat-all">应用到全部裁片</button><button id="mat-save">导出材质</button><button id="mat-load">导入材质</button><input type="file" id="mat-file" accept=".json" hidden></div>
  <div class="mat-network"><svg id="mat-links"></svg><div id="mat-nodes"></div></div>
  <div id="mat-fields"></div><p id="mat-status" role="status"></p>`;
  const positions = {
    coord: [12, 16],
    mapping: [182, 16],
    color: [360, 16],
    rough: [360, 85],
    normal: [360, 154],
    noise: [12, 154],
    ramp: [182, 154],
    bump: [540, 154],
    surface: [540, 16],
    output: [720, 16],
  };
  const labels = {
    coord: "纹理坐标",
    mapping: "映射 Mapping",
    color: "图像 · 基础色",
    rough: "图像 · 粗糙度",
    normal: "图像 · 法线",
    noise: "噪声纹理",
    ramp: "颜色渐变",
    bump: "凹凸 Bump",
    surface: "Principled BSDF",
    output: "材质输出",
  };
  const names = {
    scale: "缩放",
    rotation: "旋转 °",
    detail: "层数",
    roughness: "粗糙度",
    low: "起始位置",
    high: "结束位置",
    black: "低端值",
    white: "高端值",
    strength: "强度",
    distance: "距离 cm",
    ior: "IOR 折射率",
    specularIORLevel: "Specular IOR Level",
    diffuseRoughness: "Diffuse Roughness",
    sheenWeight: "Sheen 权重",
    sheenRoughness: "Sheen 粗糙度",
    sheenTint: "Sheen 颜色",
    anisotropy: "各向异性",
    anisotropyRotation: "各向异性旋转 °",
    coatWeight: "Coat 权重",
    coatRoughness: "Coat 粗糙度",
    coatIOR: "Coat IOR",
    normalStrength: "法线强度",
    transmission: "透射权重",
    thickness: "厚度 cm",
    attenuationDistance: "吸收距离 cm",
    attenuationColor: "透射衰减色",
    subsurface: "次表面权重",
    subsurfaceScale: "散射尺度 cm",
    radiusR: "散射半径 R",
    radiusG: "散射半径 G",
    radiusB: "散射半径 B",
    alpha: "不透明度",
    metalness: "金属度",
    emissionStrength: "自发光强度",
    emissionColor: "自发光颜色",
    baseColor: "基础色",
    specularTint: "高光颜色",
    coatTint: "涂层颜色",
  };
  let pieceId = "",
    active = "surface",
    busy = false;
  const find = (id) => document.getElementById(id),
    piece = () => part(pieceId),
    graph = () => piece().material || MaterialSystem.create(piece());
  const status = (text) => (find("mat-status").textContent = text);
  const option = (value, text) => new Option(text, value);
  for (const [type, entry] of Object.entries(MaterialGraph.registry)) {
    if (type !== "ShaderNodeOutputMaterial")
      find("mat-add").append(option(type, entry.label));
  }
  for (const [key, preset] of Object.entries(MaterialSystem.presets)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = preset.label;
    find("mat-preset").append(opt);
  }
  const sockets = {
    surface: [
      [
        "Base Color",
        "基础色来源",
        { "": "裁片颜色", "color.Color": "图像 × 裁片颜色" },
      ],
      [
        "Roughness",
        "粗糙度来源",
        {
          "": "BSDF 数值",
          "rough.Color": "图像 × BSDF",
          "ramp.Color": "渐变 × BSDF",
          "noise.Fac": "噪声 × BSDF",
        },
      ],
      [
        "Normal",
        "法线来源",
        {
          "": "几何法线",
          "normal.Color": "法线图",
          "bump.Normal": "法线 + 凹凸",
        },
      ],
    ],
    bump: [
      [
        "Height",
        "高度来源",
        { "": "关闭", "noise.Fac": "噪声", "ramp.Color": "颜色渐变" },
      ],
      ["Normal", "输入法线", { "": "几何法线", "normal.Color": "法线图" }],
    ],
  };
  function render() {
    const g = graph();
    const advanced = g.version === 2;
    if (!g.nodes.some((n) => n.id === active)) active = "surface";
    find("mat-upgrade").hidden = advanced;
    find("mat-add-label").hidden = !advanced;
    find("mat-delete").hidden =
      !advanced || ["surface", "output"].includes(active);
    const coordinates = advanced ? layout(g) : positions;
    const nodeWidth = advanced ? 112 : 146;
    const caption = (node) =>
      labels[node.id] || MaterialGraph.registry[node.type].label;
    find("mat-part").textContent = piece().name;
    const nodes = find("mat-nodes");
    nodes.innerHTML = "";
    const svg = find("mat-links");
    svg.innerHTML = "";
    nodes.style.width = svg.style.width =
      Math.max(
        advanced ? 0 : 885,
        ...Object.values(coordinates).map(([x]) => x + nodeWidth + 14),
      ) + "px";
    nodes.style.height = svg.style.height =
      Math.max(220, ...Object.values(coordinates).map(([, y]) => y + 63)) +
      "px";
    for (const node of g.nodes) {
      const { id } = node,
        [x, y] = coordinates[id];
      const button = document.createElement("button");
      button.className = "mat-node";
      button.style.left = x + "px";
      button.style.top = y + "px";
      button.style.width = nodeWidth + "px";
      button.textContent = caption(node);
      button.title = node.id;
      button.dataset.node = id;
      button.setAttribute("aria-pressed", active === id);
      find("mat-nodes").append(button);
    }
    for (const link of g.links) {
      const from = link.from.split(".")[0],
        to = link.to.split(".")[0],
        a = coordinates[from],
        b = coordinates[to];
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      const x = a[0] + nodeWidth,
        y = a[1] + 23,
        X = b[0],
        Y = b[1] + 23;
      path.setAttribute(
        "d",
        `M${x} ${y} C${x + 40} ${y},${X - 40} ${Y},${X} ${Y}`,
      );
      path.setAttribute("class", to === active ? "selected" : "");
      const title = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "title",
      );
      title.textContent = link.from + " → " + link.to;
      path.append(title);
      svg.append(path);
    }
    const node = g.nodes.find((n) => n.id === active),
      fields = find("mat-fields");
    fields.innerHTML = "";
    const heading = document.createElement("h3");
    heading.textContent = caption(node);
    fields.append(heading);
    const body = document.createElement("div");
    body.className = "mat-controls";
    fields.append(body);
    const entries = advanced
      ? advancedInputs(g, node, caption)
      : sockets[active] || [];
    const wireControls =
      advanced && entries.length > 6 ? document.createElement("details") : null;
    if (wireControls) {
      const summary = document.createElement("summary");
      summary.textContent = "输入端口与连线";
      wireControls.append(summary);
      fields.append(wireControls);
    }
    const wireBody = wireControls ? document.createElement("div") : body;
    if (wireControls) {
      wireBody.className = "mat-controls";
      wireControls.append(wireBody);
    }
    for (const [socket, label, choices] of entries) {
      const wrap = document.createElement("label");
      wrap.textContent = label;
      const select = document.createElement("select");
      select.dataset.socket = active + "." + socket;
      for (const [key, text] of Object.entries(choices)) {
        const o = document.createElement("option");
        o.value = key;
        o.textContent = text;
        select.append(o);
      }
      select.value = MaterialSystem.source(g, select.dataset.socket) || "";
      if (active === "output" && advanced)
        select.querySelector('option[value=""]').disabled = true;
      wrap.append(select);
      wireBody.append(wrap);
    }
    const params = {
      ...(advanced ? {} : MaterialSystem.opticalDefaults),
      ...node.params,
    };
    const ranges = advanced
      ? MaterialGraph.propertyRanges(node.type)
      : MaterialSystem.ranges[active] || {};
    for (const [param, [min, max]] of Object.entries(ranges)) {
      if (advanced && param === "normalStrength") continue;
      const wrap = document.createElement("label");
      wrap.textContent =
        active === "noise" && param === "scale"
          ? "噪声尺度"
          : names[param] || param;
      const input = document.createElement("input");
      input.type = "number";
      input.min = min;
      input.max = max;
      input.step = "any";
      input.value = params[param];
      input.dataset.param = param;
      const socket =
        advanced &&
        node.type === "ShaderNodeBsdfPrincipled" &&
        MaterialGraph.fields[param];
      if (socket && MaterialSystem.source(g, active + "." + socket)) {
        input.disabled = true;
        input.title = "由连线驱动。在输入端口中修改来源。";
        wrap.textContent += " · 已连线";
      }
      input.setAttribute("aria-label", wrap.textContent);
      wrap.append(input);
      body.append(wrap);
    }
    for (const [param, value] of Object.entries(params).filter(
      ([key, value]) =>
        /^#[0-9a-f]{6}$/i.test(value) && (advanced || active === "surface"),
    )) {
      const wrap = document.createElement("label");
      wrap.textContent = names[param] || param;
      const input = document.createElement("input");
      input.type = "color";
      input.value = value;
      input.dataset.param = param;
      wrap.append(input);
      body.append(wrap);
    }
    if (advanced && node.type === "ShaderNodeMath") {
      body.append(
        enumField(
          "运算",
          "operation",
          params.operation,
          MaterialGraph.operations,
        ),
      );
    }
    if (node.type === "ShaderNodeTexImage") {
      if (advanced)
        body.append(
          enumField("数据类型", "role", params.role, {
            color: "基础色 · sRGB",
            rough: "粗糙度 · 线性",
            normal: "法线 · 线性",
          }),
        );
      const label = document.createElement("label");
      label.className = "mat-image";
      label.textContent = node.params.image
        ? "已嵌入自定义图像"
        : "使用当前布种的内置贴图";
      const file = document.createElement("input");
      file.type = "file";
      file.accept = "image/png,image/jpeg,image/webp";
      file.dataset.image = active;
      label.append(file);
      body.append(label);
      const clear = document.createElement("button");
      clear.textContent = "恢复内置贴图";
      clear.dataset.reset = active;
      body.append(clear);
    }
    if (active === "coord")
      body.textContent =
        "使用裁片二维坐标生成 UV。1 UV 单位对应 10 cm，随后叠加面料的真实重复尺寸。";
    if (active === "output" && !advanced)
      body.textContent =
        "Surface 接收 Principled BSDF。图像渲染使用 Cycles 移植的绒光与粗糙漫反射，GGX 反射和涂层由形裁的实时后端计算。";
  }
  function enumField(label, key, value, choices) {
    const wrap = document.createElement("label"),
      select = document.createElement("select");
    wrap.textContent = label;
    select.dataset.enum = key;
    for (const [value, text] of Object.entries(choices))
      select.append(option(value, text));
    select.value = value;
    wrap.append(select);
    return wrap;
  }
  function advancedInputs(g, node, caption) {
    return Object.entries(MaterialGraph.registry[node.type].inputs).map(
      ([name, type]) => {
        const candidates = { "": "节点默认值" };
        const label = [...Object.entries(MaterialGraph.fields)].find(
          ([, socket]) => socket === name,
        )?.[0];
        for (const from of g.nodes.filter((n) => n !== node)) {
          for (const [out, outType] of Object.entries(
            MaterialGraph.registry[from.type].outputs,
          )) {
            if (MaterialGraph.compatible(outType, type))
              candidates[from.id + "." + out] =
                caption(from) + " · " + out + " (" + from.id + ")";
          }
        }
        return [name, names[label] || name, candidates];
      },
    );
  }
  function layout(g) {
    const edges = new Map(g.nodes.map((n) => [n.id, []]));
    for (const { from, to } of g.links)
      edges.get(to.split(".")[0]).push(from.split(".")[0]);
    const levels = new Map(),
      rows = new Map(),
      result = {};
    const level = (id) => {
      if (!levels.has(id))
        levels.set(
          id,
          Math.max(0, ...edges.get(id).map((parent) => level(parent) + 1)),
        );
      return levels.get(id);
    };
    for (const n of g.nodes) {
      const x = level(n.id),
        y = rows.get(x) || 0;
      result[n.id] = [12 + x * 127, 12 + y * 54];
      rows.set(x, y + 1);
    }
    return result;
  }
  async function apply(edit, message, all = false, nextActive) {
    if (busy) return;
    const targetId = pieceId,
      originalProject = project;
    busy = true;
    modal.setAttribute("aria-busy", "true");
    find("mat-fields").inert = true;
    modal.querySelector(".mat-actions").inert = true;
    try {
      const g = structuredClone(graph());
      await edit(g);
      MaterialSystem.validate(g);
      await MaterialSystem.prepare(g);
      if (project !== originalProject)
        throw Error("工程已变化，请重新应用材质");
      const ok = change(
        (n) => {
          const targets = all
            ? n.pieces
            : n.pieces.filter((p) => p.id === targetId);
          for (const p of targets) {
            p.material = structuredClone(g);
            p.roughness = MaterialSystem.get(g, "surface").roughness * 100;
            p.sheenLevel = MaterialSystem.get(g, "surface").sheenWeight * 100;
          }
        },
        message,
        { appearance: true },
      );
      if (ok) {
        if (nextActive) active = nextActive;
        render();
        status(message);
      } else status($("status").textContent);
    } catch (e) {
      status("未能应用 · " + e.message);
      if (piece()) render();
    } finally {
      busy = false;
      modal.removeAttribute("aria-busy");
      find("mat-fields").inert = false;
      modal.querySelector(".mat-actions").inert = false;
    }
  }
  find("mat-nodes").onclick = (e) => {
    const id = e.target.dataset.node;
    if (id) {
      active = id;
      render();
    }
  };
  find("mat-fields").onchange = async (e) => {
    const t = e.target;
    if (t.dataset.image) {
      const f = t.files[0];
      if (!f) return;
      if (f.size > 8000000) {
        status("图像上限为 8 MB");
        return;
      }
      apply(async (g) => {
        MaterialSystem.get(g, t.dataset.image).image = await new Promise(
          (resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(Error("图像读取失败"));
            reader.readAsDataURL(f);
          },
        );
      }, "图像节点已更新");
      return;
    }
    if (t.dataset.socket) {
      apply(
        (g) => MaterialSystem.connect(g, t.dataset.socket, t.value),
        "节点连线已更新",
      );
      return;
    }
    if (t.dataset.enum) {
      const id = active;
      apply(
        (g) => (MaterialSystem.get(g, id)[t.dataset.enum] = t.value),
        "节点已更新",
      );
      return;
    }
    if (t.dataset.param) {
      if (!t.reportValidity()) return;
      const value = t.type === "color" ? t.value : t.valueAsNumber;
      apply(
        (g) => (MaterialSystem.get(g, active)[t.dataset.param] = value),
        "材质已更新，当前试衣帧已保留",
      );
    }
  };
  find("mat-fields").onclick = (e) => {
    if (e.target.dataset.reset)
      apply(
        (g) => (MaterialSystem.get(g, e.target.dataset.reset).image = null),
        "已恢复内置贴图",
      );
  };
  find("mat-preset").onchange = (e) => {
    const selected = e.target.value;
    e.target.value = "";
    if (!selected) return;
    apply((g) => {
      const preset = MaterialSystem.create(piece(), selected);
      Object.assign(
        g,
        g.version === 2 ? MaterialGraph.upgrade(preset) : preset,
      );
    }, "已应用" + MaterialSystem.presets[selected].label);
  };
  find("mat-upgrade").onclick = () =>
    apply(
      (g) => Object.assign(g, MaterialGraph.upgrade(g)),
      "已启用可编辑节点图",
    );
  find("mat-add").onchange = (e) => {
    const type = e.target.value;
    e.target.value = "";
    if (!type) return;
    const id = "n" + crypto.randomUUID().slice(0, 8);
    apply(
      (g) =>
        g.nodes.push({
          id,
          type,
          params: structuredClone(MaterialGraph.defaults(type)),
        }),
      "节点已添加",
      false,
      id,
    );
  };
  find("mat-delete").onclick = () => {
    const id = active;
    apply(
      (g) => {
        g.nodes = g.nodes.filter((n) => n.id !== id);
        g.links = g.links.filter(
          (l) => !l.from.startsWith(id + ".") && !l.to.startsWith(id + "."),
        );
        if (!MaterialSystem.source(g, "output.Surface"))
          MaterialSystem.connect(g, "output.Surface", "surface.BSDF");
      },
      "节点已删除",
      false,
      "surface",
    );
  };
  find("mat-all").onclick = () =>
    apply(() => {}, "已应用到全部裁片，各片染色保留", true);
  find("mat-save").onclick = () => {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(graph(), null, 2)], {
          type: "application/json",
        }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "形裁材质.xcmat.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  find("mat-load").onclick = () => find("mat-file").click();
  find("mat-file").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      if (f.size > 36000000) throw Error("材质文件过大");
      await apply(async (n) => {
        const g = JSON.parse(await f.text());
        Object.keys(n).forEach((k) => delete n[k]);
        Object.assign(n, g);
      }, "材质已导入");
    } catch (error) {
      status("导入失败 · " + error.message);
    }
    e.target.value = "";
  };
  function open(id) {
    pieceId = id;
    active = "surface";
    render();
    status("点击节点调整参数。变化立即显示在当前衣片上。");
    modal.showModal();
  }
  return { open };
})();
