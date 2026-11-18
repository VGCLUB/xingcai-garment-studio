"use strict";
const MaterialGraph = (() => {
  const scalar = "数值",
    color = "颜色",
    uv = "UV",
    normal = "法线",
    shader = "着色器";
  const fields = {
    ior: "IOR",
    roughness: "Roughness",
    diffuseRoughness: "Diffuse Roughness",
    specularIORLevel: "Specular IOR Level",
    sheenWeight: "Sheen Weight",
    sheenRoughness: "Sheen Roughness",
    anisotropy: "Anisotropy",
    anisotropyRotation: "Anisotropic Rotation",
    coatWeight: "Coat Weight",
    coatRoughness: "Coat Roughness",
    coatIOR: "Coat IOR",
    metalness: "Metallic",
    transmission: "Transmission Weight",
    alpha: "Alpha",
    thickness: "Thickness",
    subsurface: "Subsurface Weight",
    subsurfaceScale: "Subsurface Scale",
    radiusR: "Radius R",
    radiusG: "Radius G",
    radiusB: "Radius B",
    emissionStrength: "Emission Strength",
    attenuationDistance: "Attenuation Distance",
  };
  const colorSockets = {
    "Sheen Tint": "sheenTint",
    "Attenuation Color": "attenuationColor",
    "Emission Color": "emissionColor",
    "Specular Tint": "specularTint",
    "Coat Tint": "coatTint",
  };
  const spec = (label, outputs, inputs = {}, defaults = {}, ranges = {}) => ({
    label,
    outputs,
    inputs,
    defaults,
    ranges,
  });
  const registry = {
    ShaderNodeTexCoord: spec("纹理坐标", { UV: uv }),
    ShaderNodeMapping: spec(
      "映射",
      { Vector: uv },
      { Vector: uv },
      { scale: 1, rotation: 0, x: 0, y: 0 },
      { scale: [0.15, 6], rotation: [-180, 180], x: [-50, 50], y: [-50, 50] },
    ),
    ShaderNodeTexImage: spec(
      "图像纹理",
      { Color: color, Fac: scalar, Alpha: scalar },
      { Vector: uv },
      { image: null, role: "color" },
    ),
    ShaderNodeTexNoise: spec(
      "噪声纹理",
      { Fac: scalar },
      { Vector: uv },
      { scale: 110, detail: 3, roughness: 0.7 },
      { scale: [1, 500], detail: [1, 5], roughness: [0, 1] },
    ),
    ShaderNodeTexWave: spec(
      "波纹",
      { Fac: scalar },
      { Vector: uv },
      { scale: 35, angle: 0 },
      { scale: [1, 600], angle: [-180, 180] },
    ),
    ShaderNodeTexChecker: spec(
      "棋盘纹理",
      { Fac: scalar },
      { Vector: uv },
      { scale: 3 },
      { scale: [0.1, 100] },
    ),
    ShaderNodeTexGradient: spec(
      "渐变纹理",
      { Fac: scalar },
      { Vector: uv },
      { scale: 1 },
      { scale: [0.01, 100] },
    ),
    ShaderNodeTexVoronoi: spec(
      "沃罗诺伊纹理",
      { Distance: scalar },
      { Vector: uv },
      { scale: 25 },
      { scale: [0.1, 500] },
    ),
    ShaderNodeValue: spec(
      "数值",
      { Value: scalar },
      {},
      { value: 0.5 },
      { value: [-100, 100] },
    ),
    ShaderNodeRGB: spec("RGB 颜色", { Color: color }, {}, { value: "#ffffff" }),
    ShaderNodeMath: spec(
      "数学",
      { Value: scalar },
      { A: scalar, B: scalar },
      { operation: "multiply", a: 0.5, b: 0.5 },
      { a: [-100, 100], b: [-100, 100] },
    ),
    ShaderNodeValToRGB: spec(
      "颜色渐变",
      { Color: color, Fac: scalar },
      { Fac: scalar },
      {
        low: 0.18,
        high: 0.82,
        black: 0.55,
        white: 0.96,
        dark: "#000000",
        light: "#ffffff",
      },
      { low: [0, 0.99], high: [0.01, 1], black: [0, 1], white: [0, 1] },
    ),
    ShaderNodeMixRGB: spec(
      "混合颜色",
      { Color: color },
      { Fac: scalar, A: color, B: color },
      { factor: 0.5, a: "#ffffff", b: "#404040" },
      { factor: [0, 1] },
    ),
    ShaderNodeRGBToBW: spec("RGB 转灰度", { Value: scalar }, { Color: color }),
    ShaderNodeSeparateColor: spec(
      "分离 RGB",
      { R: scalar, G: scalar, B: scalar },
      { Color: color },
    ),
    ShaderNodeCombineColor: spec(
      "合并 RGB",
      { Color: color },
      { R: scalar, G: scalar, B: scalar },
      { r: 0, g: 0, b: 0 },
      { r: [0, 1], g: [0, 1], b: [0, 1] },
    ),
    ShaderNodeMapRange: spec(
      "范围映射",
      { Value: scalar },
      { Value: scalar },
      { fromMin: 0, fromMax: 1, toMin: 0, toMax: 1 },
      {
        fromMin: [-100, 100],
        fromMax: [-100, 100],
        toMin: [-100, 100],
        toMax: [-100, 100],
      },
    ),
    ShaderNodeInvert: spec(
      "反相",
      { Color: color },
      { Color: color, Fac: scalar },
      { factor: 1 },
      { factor: [0, 1] },
    ),
    ShaderNodeNormalMap: spec(
      "法线贴图",
      { Normal: normal },
      { Color: color, Vector: uv, Strength: scalar },
      { strength: 1 },
      { strength: [0, 2] },
    ),
    ShaderNodeBump: spec(
      "凹凸",
      { Normal: normal },
      { Height: scalar, Normal: normal, Strength: scalar, Distance: scalar },
      { strength: 0.24, distance: 0.012 },
      { strength: [0, 1], distance: [0, 0.15] },
    ),
    ShaderNodeBsdfPrincipled: spec(
      "Principled BSDF",
      { BSDF: shader },
      {
        "Base Color": color,
        Normal: normal,
        "Coat Normal": normal,
        ...Object.fromEntries(Object.values(fields).map((s) => [s, scalar])),
        ...Object.fromEntries(Object.keys(colorSockets).map((s) => [s, color])),
      },
    ),
    ShaderNodeBsdfTransparent: spec(
      "透明 BSDF",
      { BSDF: shader },
      { Color: color },
      { tint: "#ffffff" },
    ),
    ShaderNodeEmission: spec(
      "自发光",
      { Shader: shader },
      { Color: color, Strength: scalar },
      { tint: "#ffffff", strength: 1 },
      { strength: [0, 10] },
    ),
    ShaderNodeMixShader: spec(
      "混合着色器",
      { Shader: shader },
      { Fac: scalar, A: shader, B: shader },
      { factor: 0.5 },
      { factor: [0, 1] },
    ),
    ShaderNodeOutputMaterial: spec("材质输出", {}, { Surface: shader }),
  };
  const operations = {
    add: "相加",
    subtract: "相减",
    multiply: "相乘",
    divide: "相除",
    minimum: "最小值",
    maximum: "最大值",
    power: "幂",
    clamp: "钳制 0–1",
  };
  const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v);
  const imageOK = (v) =>
    v === null ||
    (typeof v === "string" &&
      v.length <= 12000000 &&
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v));
  const surfaceDefaults = () => ({
    ...MaterialSystem.get(
      MaterialSystem.create({ fabric: "cotton" }),
      "surface",
    ),
    baseColor: "#ffffff",
    specularTint: "#ffffff",
    coatTint: "#ffffff",
  });
  function propertyRanges(type) {
    return type === "ShaderNodeBsdfPrincipled"
      ? MaterialSystem.ranges.surface
      : registry[type].ranges;
  }
  function defaults(type) {
    return type === "ShaderNodeBsdfPrincipled"
      ? surfaceDefaults()
      : registry[type].defaults;
  }
  function upgrade(legacy) {
    if (legacy.version === 2) return legacy;
    const g = structuredClone(legacy);
    g.version = 2;
    for (const node of g.nodes) {
      node.params = { ...defaults(node.type), ...node.params };
      if (node.type === "ShaderNodeTexImage") node.params.role = node.id;
    }
    const oldNormal =
      MaterialSystem.source(g, "surface.Normal") === "normal.Color" ||
      MaterialSystem.source(g, "bump.Normal") === "normal.Color";
    if (oldNormal) {
      g.nodes.push({
        id: "normalMap",
        type: "ShaderNodeNormalMap",
        params: { strength: MaterialSystem.get(g, "surface").normalStrength },
      });
      g.links.push(
        { from: "normal.Color", to: "normalMap.Color" },
        { from: "mapping.Vector", to: "normalMap.Vector" },
      );
    }
    for (const link of g.links) {
      if (link.from === "normal.Color" && link.to !== "normalMap.Color")
        link.from = "normalMap.Normal";
      if (link.from === "ramp.Color" && link.to !== "surface.Base Color")
        link.from = "ramp.Fac";
      if (link.from === "rough.Color" && link.to === "surface.Roughness")
        link.from = "rough.Fac";
    }
    return validate(g);
  }
  function socket(g, ref, direction) {
    if (typeof ref !== "string") return null;
    const dot = ref.indexOf(".");
    const node = g.nodes.find((n) => n.id === ref.slice(0, dot));
    const name = ref.slice(dot + 1);
    if (!node || dot < 1) return null;
    const sockets = registry[node.type][direction];
    return Object.hasOwn(sockets, name)
      ? { node, name, type: sockets[name] }
      : null;
  }
  const compatible = (a, b) =>
    a === b || (a === scalar && b === color) || (a === color && b === scalar);
  function validate(g) {
    if (
      g?.format !== "xingcai-material" ||
      g.version !== 2 ||
      typeof g.name !== "string" ||
      g.name.length > 60 ||
      !Array.isArray(g.nodes) ||
      g.nodes.length > 48 ||
      !Array.isArray(g.links) ||
      g.links.length > 140
    )
      throw Error("材质图格式或大小无效");
    const ids = new Set();
    let imageCount = 0;
    for (const node of g.nodes) {
      if (
        !node ||
        typeof node.id !== "string" ||
        !/^[A-Za-z0-9_-]{1,32}$/.test(node.id) ||
        ids.has(node.id) ||
        !Object.hasOwn(registry, node.type) ||
        !node.params ||
        typeof node.params !== "object" ||
        Array.isArray(node.params)
      )
        throw Error("材质节点无效");
      ids.add(node.id);
      const p = node.params;
      for (const [key, [min, max]] of Object.entries(
        propertyRanges(node.type),
      )) {
        if (!Number.isFinite(p[key]) || p[key] < min || p[key] > max)
          throw Error(node.id + "." + key + " 超出范围");
      }
      for (const [key, value] of Object.entries(defaults(node.type))) {
        if (isHex(value) && !isHex(p[key])) throw Error("节点颜色无效");
      }
      if (node.type === "ShaderNodeTexImage") {
        imageCount++;
        if (!imageOK(p.image) || !["color", "rough", "normal"].includes(p.role))
          throw Error("图像或图像类型无效");
      }
      if (node.type === "ShaderNodeValToRGB" && p.low >= p.high)
        throw Error("渐变起点必须小于终点");
      if (node.type === "ShaderNodeMapRange" && p.fromMin >= p.fromMax)
        throw Error("映射输入上限必须大于下限");
      if (
        node.type === "ShaderNodeMath" &&
        !Object.hasOwn(operations, p.operation)
      )
        throw Error("数学运算无效");
      if (node.type === "ShaderNodeOutputMaterial" && node.id !== "output")
        throw Error("材质图只有一个输出节点");
    }
    if (imageCount > 8) throw Error("每个材质最多 8 个图像节点");
    if (
      g.nodes.find((n) => n.id === "surface")?.type !==
        "ShaderNodeBsdfPrincipled" ||
      g.nodes.find((n) => n.id === "output")?.type !==
        "ShaderNodeOutputMaterial"
    )
      throw Error("缺少主 BSDF 或材质输出");
    const inputs = new Set();
    const dependencies = new Map(g.nodes.map((n) => [n.id, []]));
    for (const link of g.links) {
      const a = socket(g, link?.from, "outputs"),
        b = socket(g, link?.to, "inputs");
      if (!a || !b || !compatible(a.type, b.type) || inputs.has(link.to))
        throw Error("节点端口或连线无效");
      dependencies.get(b.node.id).push(a.node.id);
      inputs.add(link.to);
    }
    if (!inputs.has("output.Surface")) throw Error("请给材质输出连接着色器");
    const checking = new Set(),
      done = new Set();
    function visit(id) {
      if (checking.has(id)) throw Error("材质节点不能形成循环");
      if (done.has(id)) return;
      checking.add(id);
      dependencies.get(id).forEach(visit);
      checking.delete(id);
      done.add(id);
    }
    ids.forEach(visit);
    return g;
  }
  const noise = `
float xgHash(vec2 p){
  vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);
}
float xgNoise(vec2 p,float detail,float rough){
  float sum=0.,w=1.,total=0.;
  for(int i=0;i<5;i++){
    float coverage=clamp(detail-float(i),0.,1.);
    vec2 j=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    float n=mix(mix(xgHash(j),xgHash(j+vec2(1.,0.)),f.x),
                mix(xgHash(j+vec2(0.,1.)),xgHash(j+vec2(1.,1.)),f.x),f.y);
    // Attenuate octaves above the pixel Nyquist limit.
    float footprint=max(length(dFdx(p)),length(dFdy(p)));
    sum+=mix(n,.5,smoothstep(.35,1.,footprint))*w*coverage;
    total+=w*coverage;w*=rough;p=p*2.031+vec2(17.13,9.2);
  }
  return sum/max(total,.001);
}
float xgVoronoi(vec2 p){
  vec2 cell=floor(p),f=fract(p);
  float closest=2.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 j=vec2(float(x),float(y)), id=cell+j;
    vec2 d=j+vec2(xgHash(id),xgHash(id+vec2(19.1,7.3)))-f;
    closest=min(closest,dot(d,d));
  }
  return mix(sqrt(closest),.45,smoothstep(.3,1.,max(length(dFdx(p)),length(dFdy(p)))));
}
vec3 xgNormal(vec3 n,vec3 rgb,vec2 uv,float strength,vec3 pos){
  vec3 a=dFdx(pos),b=dFdy(pos);
  vec2 dx=dFdx(uv),dy=dFdy(uv);
  vec3 t=cross(b,n)*dx.x+cross(n,a)*dy.x;
  vec3 v=cross(b,n)*dx.y+cross(n,a)*dy.y;
  float scale=inversesqrt(max(max(dot(t,t),dot(v,v)),1e-12));
  vec3 local=rgb*2.-1.;
  return normalize(n*max(local.z,.001)+(t*local.x+v*local.y)*strength*scale);
}
vec3 xgBump(vec3 n,vec3 pos,float h){
  vec3 dx=dFdx(pos),dy=dFdy(pos),a=cross(dy,n),b=cross(n,dx);
  float det=dot(dx,a);
  return normalize(max(abs(det),1e-12)*n-sign(det)*(dFdx(h)*a+dFdy(h)*b));
}
`;
  const float = (n) => Number(n).toFixed(8);
  const rgb = (hex) =>
    `vec3(${new THREE.Color(hex).toArray().map(float).join(",")})`;
  const lum = (value) => `dot(${value},vec3(.2126,.7152,.0722))`;
  const clamp = (value, min = 0, max = 1) =>
    `clamp(${value},${float(min)},${float(max)})`;
  const mix = (a, b, f) => (a === b ? a : `mix(${a},${b},${f})`);
  function compiler(g, builtins, images) {
    const links = new Map(g.links.map((l) => [l.to, l.from]));
    const values = new Map(),
      textures = {},
      early = [],
      late = [];
    const inputSource = (node, key) => links.get(node.id + "." + key);
    function input(node, key, fallback) {
      const ref = inputSource(node, key);
      if (!ref) return fallback;
      const from = socket(g, ref, "outputs");
      const value = output(ref);
      const type = registry[node.type].inputs[key];
      if (from.type === color && type === scalar) return lum(value);
      if (from.type === scalar && type === color) return `vec3(${value})`;
      return value;
    }
    function store(ref, type, expr, stage = early) {
      const name = "xg" + values.size;
      stage.push(`${type} ${name}=${expr};`);
      values.set(ref, name);
      return name;
    }
    function output(ref) {
      if (values.has(ref)) return values.get(ref);
      const { node, name, type } = socket(g, ref, "outputs"),
        p = node.params;
      const coord = () => input(node, "Vector", "vUv");
      const val = (key, fallback) => input(node, key, float(fallback));
      const col = (key, fallback) => input(node, key, rgb(fallback));
      let expr;
      switch (node.type) {
        case "ShaderNodeTexCoord":
          return "vUv";
        case "ShaderNodeMapping": {
          const a = (p.rotation * Math.PI) / 180,
            c = float(Math.cos(a)),
            s = float(Math.sin(a));
          expr = `(mat2(${c},-${s},${s},${c})*${coord()}*${float(p.scale)}+vec2(${float(p.x)},${float(p.y)}))`;
          break;
        }
        case "ShaderNodeTexImage": {
          const sampleKey = node.id + "#sample";
          let sample = values.get(sampleKey);
          if (!sample) {
            const tex = p.image ? images.get(p.image) : builtins[p.role];
            const name = "xgTex" + Object.keys(textures).length,
              coordValue = coord();
            if (tex) {
              if (p.image) {
                const texture = tex.clone();
                texture.colorSpace =
                  p.role === "color"
                    ? THREE.SRGBColorSpace
                    : THREE.NoColorSpace;
                texture.needsUpdate = true;
                textures[name] = texture;
              } else textures[name] = tex;
              const scale = tex.repeat.toArray().map(float).join(",");
              sample = store(
                sampleKey,
                "vec4",
                `texture2D(${name},${coordValue}*vec2(${scale}))`,
              );
            } else {
              sample = p.role === "normal" ? "vec4(.5,.5,1.,1.)" : "vec4(1.)";
            }
          }
          if (name === "Alpha") return sample + ".a";
          if (name === "Fac")
            return p.role === "rough" ? sample + ".g" : lum(sample + ".rgb");
          return sample + ".rgb";
        }
        case "ShaderNodeTexNoise":
          expr = `xgNoise(${coord()}*${float(p.scale)},${float(p.detail)},${float(p.roughness)})`;
          break;
        case "ShaderNodeTexWave": {
          const a = (p.angle * Math.PI) / 180;
          const u = store(
            ref + "#phase",
            "float",
            `dot(${coord()},vec2(${float(Math.cos(a))},${float(Math.sin(a))}))*${float(p.scale)}`,
          );
          expr = `(.5+.5*sin(6.2831853*${u})*(1.-smoothstep(.22,.5,fwidth(${u}))))`;
          break;
        }
        case "ShaderNodeTexChecker": {
          const j = store(
            ref + "#grid",
            "vec2",
            `floor(${coord()}*${float(p.scale)})`,
          );
          expr = `mod(${j}.x+${j}.y,2.)`;
          break;
        }
        case "ShaderNodeTexGradient":
          expr = clamp(`${coord()}.x*${float(p.scale)}`);
          break;
        case "ShaderNodeTexVoronoi":
          expr = `xgVoronoi(${coord()}*${float(p.scale)})`;
          break;
        case "ShaderNodeValue":
          return float(p.value);
        case "ShaderNodeRGB":
          return rgb(p.value);
        case "ShaderNodeMath": {
          const a = val("A", p.a),
            b = val("B", p.b);
          expr = {
            add: `(${a}+${b})`,
            subtract: `(${a} - ${b})`,
            multiply: `(${a}*${b})`,
            divide: `(${a}/(abs(${b})<.00001?.00001:${b}))`,
            minimum: `min(${a},${b})`,
            maximum: `max(${a},${b})`,
            power: `pow(clamp(${a},.00001,100.),clamp(${b},-10.,10.))`,
            clamp: clamp(a),
          }[p.operation];
          break;
        }
        case "ShaderNodeValToRGB": {
          const t = clamp(
            `((${val("Fac", 0.5)}-${float(p.low)})/${float(p.high - p.low)})`,
          );
          expr =
            name === "Fac"
              ? mix(float(p.black), float(p.white), t)
              : mix(
                  `(${rgb(p.dark)}*${float(p.black)})`,
                  `(${rgb(p.light)}*${float(p.white)})`,
                  t,
                );
          break;
        }
        case "ShaderNodeMixRGB":
          expr = mix(col("A", p.a), col("B", p.b), clamp(val("Fac", p.factor)));
          break;
        case "ShaderNodeRGBToBW":
          expr = lum(col("Color", "#ffffff"));
          break;
        case "ShaderNodeSeparateColor":
          expr = `${col("Color", "#ffffff")}.${name.toLowerCase()}`;
          break;
        case "ShaderNodeCombineColor":
          expr = `vec3(${val("R", p.r)},${val("G", p.g)},${val("B", p.b)})`;
          break;
        case "ShaderNodeMapRange":
          expr = mix(
            float(p.toMin),
            float(p.toMax),
            clamp(
              `((${val("Value", 0.5)} - ${float(p.fromMin)})/${float(p.fromMax - p.fromMin)})`,
            ),
          );
          break;
        case "ShaderNodeInvert": {
          const c = col("Color", "#ffffff");
          expr = mix(c, `(vec3(1.)-${c})`, clamp(val("Fac", p.factor)));
          break;
        }
        case "ShaderNodeNormalMap":
          return store(
            ref,
            "vec3",
            `xgNormal(normal,${input(node, "Color", "vec3(.5,.5,1.)")},${coord()},${clamp(val("Strength", p.strength), 0, 2)},-vViewPosition)`,
            late,
          );
        case "ShaderNodeBump":
          return store(
            ref,
            "vec3",
            `xgBump(${input(node, "Normal", "normal")},-vViewPosition,${val("Height", 0)}*${clamp(val("Strength", p.strength))}*${clamp(val("Distance", p.distance), 0, 0.15)})`,
            late,
          );
        default:
          throw Error("无法求值的端口 " + ref);
      }
      return store(
        ref,
        type === uv ? "vec2" : type === scalar ? "float" : "vec3",
        expr,
      );
    }
    const shaderCache = new Map();
    let mayTransmit = false,
      mayBlend = false,
      mayScatter = false,
      mayCoat = false,
      mayAnisotropy = false;
    function surface(ref) {
      if (shaderCache.has(ref)) return shaderCache.get(ref);
      const { node } = socket(g, ref, "outputs"),
        p = node.params,
        d = surfaceDefaults(),
        result = {};
      if (node.type === "ShaderNodeMixShader") {
        const factor = clamp(input(node, "Fac", float(p.factor)));
        const a = surface(inputSource(node, "A") || "surface.BSDF");
        const b = surface(inputSource(node, "B") || "surface.BSDF");
        for (const k of Object.keys(a)) {
          let expr = mix(a[k], b[k], factor);
          if (["normal", "coatNormal"].includes(k)) {
            // Both inputs are normalized and evaluated in view space.
            result[k] =
              expr === a[k]
                ? expr
                : store(ref + "#" + k, "vec3", `normalize(${expr})`, late);
          } else {
            const isColor = [
              "baseColor",
              "emissionColor",
              "sheenTint",
              "coatTint",
              "specularTint",
              "attenuationColor",
            ].includes(k);
            result[k] =
              a[k] === b[k]
                ? expr
                : store(ref + "#" + k, isColor ? "vec3" : "float", expr);
          }
        }
      } else {
        const principled = node.type === "ShaderNodeBsdfPrincipled";
        const transparent = node.type === "ShaderNodeBsdfTransparent";
        const emission = node.type === "ShaderNodeEmission";
        for (const [key, socketName] of Object.entries(fields)) {
          const interval = MaterialSystem.ranges.surface[key];
          result[key] = principled
            ? clamp(input(node, socketName, float(p[key])), ...interval)
            : float(d[key]);
        }
        if (!principled) {
          for (const key of [
            "specularIORLevel",
            "diffuseRoughness",
            "sheenWeight",
            "anisotropy",
            "coatWeight",
            "subsurface",
          ])
            result[key] = "0.";
          result.alpha = transparent ? "0." : "1.";
        }
        for (const [socketName, key] of Object.entries(colorSockets))
          result[key] = principled
            ? input(node, socketName, rgb(p[key]))
            : rgb(d[key]);
        result.baseColor = principled
          ? input(node, "Base Color", rgb(p.baseColor))
          : transparent
            ? input(node, "Color", rgb(p.tint))
            : "vec3(0.)";
        result.normal = principled ? input(node, "Normal", "normal") : "normal";
        result.coatNormal = principled
          ? input(node, "Coat Normal", "normal")
          : "normal";
        if (emission) {
          result.emissionColor = input(node, "Color", rgb(p.tint));
          result.emissionStrength = clamp(
            input(node, "Strength", float(p.strength)),
            0,
            10,
          );
        }
        const enabled = (key) =>
          principled && (p[key] > 0 || inputSource(node, fields[key]));
        mayTransmit ||= !!enabled("transmission");
        mayScatter ||= !!enabled("subsurface");
        mayCoat ||= !!enabled("coatWeight");
        mayAnisotropy ||= !!enabled("anisotropy");
        mayBlend ||=
          transparent ||
          (principled && (p.alpha < 1 || !!inputSource(node, "Alpha")));
      }
      shaderCache.set(ref, result);
      return result;
    }
    const resolved = surface(links.get("output.Surface"));
    return {
      resolved,
      textures,
      early,
      late,
      mayTransmit,
      mayBlend,
      mayScatter,
      mayCoat,
      mayAnisotropy,
    };
  }

  function apply(mat, g, p, images) {
    const builtins = {
      color: mat.map,
      rough: mat.roughnessMap,
      normal: mat.normalMap,
    };
    const compiled = compiler(g, builtins, images);
    const { resolved: s, textures, early, late } = compiled;
    // Native texture slots are populated separately only for portable GLB links.
    const portable = portableTextures(g, builtins, images);
    mat.map = mat.roughnessMap = mat.normalMap = mat.bumpMap = null;
    mat.transmission = compiled.mayTransmit ? p.transmission || 1 : 0;
    mat.clearcoat = compiled.mayCoat ? p.coatWeight || 1 : 0;
    mat.anisotropy = compiled.mayAnisotropy ? p.anisotropy || 0.01 : 0;
    mat.transparent = compiled.mayBlend;
    mat.depthWrite = !mat.transparent;
    mat.forceSinglePass = true;
    mat.userData.thinSurface = compiled.mayTransmit || compiled.mayBlend;
    CyclesMaterial.attach(mat, {
      ...p,
      subsurface: compiled.mayScatter ? 1 : 0,
    });
    const original = mat.onBeforeCompile;
    mat.defines = { ...mat.defines, USE_UV: "" };
    const textureUniforms = (shader) =>
      Object.entries(textures)
        .map(([key, value]) => {
          shader.uniforms[key] = { value };
          return "uniform sampler2D " + key + ";";
        })
        .join("\n");
    mat.onBeforeCompile = (shader) => {
      original(shader);
      let fragment = shader.fragmentShader;
      // The graph assigns per-pixel closure parameters in main().
      for (const [type, name] of [
        ["float", "xcSheenRoughness"],
        ["vec3", "xcSheenColor"],
        ["float", "xcDiffuseRoughness"],
        ["float", "xcCoatIOR"],
      ]) {
        fragment = fragment.replace(
          `uniform ${type} ${name};`,
          `${type} ${name};`,
        );
        delete shader.uniforms[name];
      }
      fragment = fragment
        .replace(
          "#include <common>",
          "#include <common>\n" + textureUniforms(shader) + noise,
        )
        .replace(
          "#include <map_fragment>",
          `
          ${early.join("\n")}
          diffuseColor.rgb *= ${s.baseColor};
          diffuseColor.a = ${s.alpha};
          totalEmissiveRadiance = ${s.emissionColor} * ${s.emissionStrength};
          xcSheenColor = ${s.sheenTint} * ${s.sheenWeight};
          xcSheenRoughness = ${s.sheenRoughness};
          xcDiffuseRoughness = ${s.diffuseRoughness};
          xcCoatIOR = ${s.coatIOR};`,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `float roughnessFactor = ${s.roughness};`,
        )
        .replace(
          "#include <metalnessmap_fragment>",
          `float metalnessFactor = ${s.metalness};`,
        )
        .replace(
          "#include <normal_fragment_maps>",
          `${late.join("\n")}\nvec3 xgCoatNormal=${s.coatNormal};\nnormal=${s.normal};`,
        )
        .replace(
          "#include <clearcoat_normal_fragment_maps>",
          `#ifdef USE_CLEARCOAT\nclearcoatNormal=xgCoatNormal;\n#endif`,
        )
        .replace("material.ior = ior;", `material.ior = ${s.ior};`)
        .replace(
          "float specularIntensityFactor = specularIntensity;",
          `float specularIntensityFactor = 2.*${s.specularIORLevel};`,
        )
        .replace(
          "vec3 specularColorFactor = specularColor;",
          `vec3 specularColorFactor = ${s.specularTint};`,
        )
        .replace(
          "material.clearcoat = clearcoat;",
          `material.clearcoat = ${s.coatWeight};`,
        )
        .replace(
          "material.clearcoatRoughness = clearcoatRoughness;",
          `material.clearcoatRoughness = ${s.coatRoughness};`,
        )
        .replace(
          "vec2 anisotropyV = anisotropyVector;",
          `float xgAnisoAngle=radians(${s.anisotropyRotation}); vec2 anisotropyV=vec2(cos(xgAnisoAngle),sin(xgAnisoAngle))*${s.anisotropy};`,
        )
        .replace("xcSubsurface=xcSSSInputs.x;", `xcSubsurface=${s.subsurface};`)
        .replace(
          "xcSubsurfaceScale=xcSSSInputs.y;",
          `xcSubsurfaceScale=${s.subsurfaceScale};`,
        )
        .replace("xcThickness=xcSSSInputs.z;", `xcThickness=${s.thickness};`)
        .replace(
          "xcSubsurfaceRadius=xcSSSRadii;",
          `xcSubsurfaceRadius=vec3(${s.radiusR},${s.radiusG},${s.radiusB});`,
        )
        .replace(
          "material.transmission = transmission;",
          `material.transmission = ${s.transmission}*(1.-metalnessFactor);`,
        )
        .replace(
          "material.thickness = thickness;",
          `material.thickness = ${s.thickness};`,
        )
        .replace(
          "material.attenuationDistance = attenuationDistance;",
          `material.attenuationDistance = ${s.attenuationDistance};`,
        )
        .replace(
          "material.attenuationColor = attenuationColor;",
          `material.attenuationColor = max(${s.attenuationColor},vec3(.00001));`,
        );
      if (compiled.mayCoat)
        fragment = fragment.replace(
          "outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc )",
          `outgoingLight = outgoingLight * mix(vec3(1.),${s.coatTint},material.clearcoat) * ( 1.0 - material.clearcoat * Fcc )`,
        );
      shader.fragmentShader = fragment;
    };
    // Constants and topology both affect shader identity. User textures stay uniforms.
    const signature =
      JSON.stringify(
        g.nodes.map((n) => [
          n.id,
          n.type,
          { ...n.params, image: !!n.params.image },
        ]),
      ) +
      JSON.stringify(g.links) +
      JSON.stringify(
        Object.values(textures).map((texture) => texture.repeat.toArray()),
      );
    mat.customProgramCacheKey = () =>
      "xingcai-graph-v2:" + signature + Object.keys(textures).join(",");
    if (mat.userData.thinSurface) {
      mat.alphaShadow = (depth) => {
        depth.defines = { ...depth.defines, USE_UV: "" };
        depth.customProgramCacheKey = () =>
          "shadow:" + mat.customProgramCacheKey();
        depth.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader
            .replace(
              "#include <common>",
              "#include <common>\n" + textureUniforms(shader) + noise,
            )
            .replace(
              "#include <alphatest_fragment>",
              `
              ${early.join("\n")}
              float coverage=${s.alpha}*(1.-${s.transmission}*(1.-${s.metalness}));
              float noiseAtPixel=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715))));
              if(noiseAtPixel>=coverage)discard;
            `,
            );
        };
      };
    }
    mat.userData.materialGraph = structuredClone(g);
    mat.userData.exportSurface = p;
    mat.userData.portableTextures = Object.keys(portable);
    mat.exportTextures = portable;
    mat.addEventListener("dispose", () =>
      [
        ...Object.values(textures).filter(
          (t) => !Object.values(builtins).includes(t),
        ),
        ...Object.values(portable),
      ].forEach((t) => t.dispose()),
    );
    return mat;
  }
  function portableTextures(g, builtins, images) {
    const out = {};
    if (MaterialSystem.source(g, "output.Surface") !== "surface.BSDF")
      return out;
    const find = (ref) => socket(g, ref, "outputs")?.node;
    const normalNode = find(MaterialSystem.source(g, "surface.Normal"));
    for (const [slot, ref, channel] of [
      ["map", MaterialSystem.source(g, "surface.Base Color"), "Color"],
      ["roughnessMap", MaterialSystem.source(g, "surface.Roughness"), "Fac"],
      [
        "normalMap",
        normalNode?.type === "ShaderNodeNormalMap"
          ? MaterialSystem.source(g, normalNode.id + ".Color")
          : null,
        "Color",
      ],
    ]) {
      if (!ref?.endsWith("." + channel)) continue;
      const node = find(ref);
      if (
        node?.type !== "ShaderNodeTexImage" ||
        (slot === "roughnessMap" && node.params.role !== "rough")
      )
        continue;
      const coord = find(MaterialSystem.source(g, node.id + ".Vector"));
      if (
        coord &&
        !["ShaderNodeTexCoord", "ShaderNodeMapping"].includes(coord.type)
      )
        continue;
      if (
        coord?.type === "ShaderNodeMapping" &&
        find(MaterialSystem.source(g, coord.id + ".Vector"))?.type ===
          "ShaderNodeMapping"
      )
        continue;
      const tex = node.params.image
        ? images.get(node.params.image)
        : builtins[node.params.role];
      if (!tex) continue;
      const copy = tex.clone(),
        p =
          coord?.type === "ShaderNodeMapping"
            ? coord.params
            : registry.ShaderNodeMapping.defaults;
      copy.repeat.multiplyScalar(p.scale);
      copy.rotation = (p.rotation * Math.PI) / 180;
      copy.offset.set(p.x * tex.repeat.x, p.y * tex.repeat.y);
      copy.colorSpace =
        slot === "map" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      copy.needsUpdate = true;
      out[slot] = copy;
    }
    return out;
  }
  return {
    registry,
    operations,
    propertyRanges,
    defaults,
    upgrade,
    validate,
    compatible,
    apply,
    fields,
  };
})();
