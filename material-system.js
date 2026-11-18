"use strict";
const MaterialSystem = (() => {
  const types = {
    coord: "ShaderNodeTexCoord",
    mapping: "ShaderNodeMapping",
    color: "ShaderNodeTexImage",
    rough: "ShaderNodeTexImage",
    normal: "ShaderNodeTexImage",
    noise: "ShaderNodeTexNoise",
    ramp: "ShaderNodeValToRGB",
    bump: "ShaderNodeBump",
    surface: "ShaderNodeBsdfPrincipled",
    output: "ShaderNodeOutputMaterial",
  };
  const ranges = {
    mapping: { scale: [0.15, 6], rotation: [-180, 180] },
    noise: { scale: [1, 500], detail: [1, 5], roughness: [0, 1] },
    ramp: { low: [0, 0.99], high: [0.01, 1], black: [0, 1], white: [0, 1] },
    bump: { strength: [0, 1], distance: [0, 0.15] },
    surface: {
      ior: [1, 2.5],
      specularIORLevel: [0, 1],
      roughness: [0.06, 1],
      diffuseRoughness: [0, 1],
      sheenWeight: [0, 1],
      sheenRoughness: [0.05, 1],
      anisotropy: [0, 0.95],
      anisotropyRotation: [-180, 180],
      coatWeight: [0, 1],
      coatRoughness: [0.04, 1],
      coatIOR: [1, 2.5],
      normalStrength: [0, 2],
      transmission: [0, 1],
      thickness: [0, 2],
      attenuationDistance: [0.01, 20],
      subsurface: [0, 1],
      subsurfaceScale: [0.001, 2],
      radiusR: [0.01, 2],
      radiusG: [0.01, 2],
      radiusB: [0.01, 2],
      alpha: [0, 1],
      metalness: [0, 1],
      emissionStrength: [0, 10],
    },
  };
  const opticalDefaults = {
    transmission: 0,
    thickness: 0.035,
    attenuationDistance: 0.8,
    attenuationColor: "#ffffff",
    subsurface: 0,
    subsurfaceScale: 0.35,
    radiusR: 1,
    radiusG: 0.65,
    radiusB: 0.45,
    alpha: 1,
    metalness: 0,
    emissionStrength: 0,
    emissionColor: "#ffffff",
  };
  const presets = {
    cotton: {
      label: "柔软棉布",
      roughness: 0.86,
      diffuseRoughness: 0.8,
      sheenWeight: 0.32,
      sheenRoughness: 0.72,
      anisotropy: 0.06,
      specularIORLevel: 0.22,
    },
    linen: {
      label: "粗纱亚麻",
      roughness: 0.88,
      diffuseRoughness: 0.75,
      sheenWeight: 0.2,
      sheenRoughness: 0.6,
      anisotropy: 0.12,
      specularIORLevel: 0.3,
    },
    satin: {
      label: "斜纹缎面",
      roughness: 0.24,
      diffuseRoughness: 0.25,
      sheenWeight: 0.19,
      sheenRoughness: 0.28,
      anisotropy: 0.78,
      specularIORLevel: 0.5,
      normalStrength: 0.18,
    },
    velvet: {
      label: "短绒天鹅绒",
      roughness: 0.81,
      diffuseRoughness: 0.68,
      sheenWeight: 0.95,
      sheenRoughness: 0.33,
      anisotropy: 0.0,
      specularIORLevel: 0.18,
      normalStrength: 0.1,
    },
    coated: {
      label: "涂层织物",
      roughness: 0.52,
      diffuseRoughness: 0.4,
      sheenWeight: 0.12,
      sheenRoughness: 0.55,
      anisotropy: 0.15,
      specularIORLevel: 0.5,
      coatWeight: 0.62,
      coatRoughness: 0.2,
    },
    organza: {
      label: "透光欧根纱",
      roughness: 0.32,
      diffuseRoughness: 0.45,
      ior: 1.33,
      transmission: 0.76,
      thickness: 0.025,
      attenuationDistance: 0.22,
      attenuationColor: "#a3dcd0",
      subsurface: 0.6,
      subsurfaceScale: 0.6,
      sheenWeight: 0.16,
      sheenRoughness: 0.61,
      sheenTint: "#cee9e5",
      anisotropy: 0.56,
      specularIORLevel: 0.27,
      normalStrength: 0.18,
    },
    flannel: {
      label: "柔光绒布",
      roughness: 0.92,
      diffuseRoughness: 0.82,
      subsurface: 0.62,
      subsurfaceScale: 0.65,
      thickness: 0.065,
      radiusR: 1,
      radiusG: 0.74,
      radiusB: 0.52,
      sheenWeight: 0.24,
      sheenRoughness: 0.81,
      specularIORLevel: 0.18,
      normalStrength: 0.43,
    },
  };
  const incoming = {
    "mapping.Vector": ["coord.UV"],
    "color.Vector": ["mapping.Vector"],
    "rough.Vector": ["mapping.Vector"],
    "normal.Vector": ["mapping.Vector"],
    "noise.Vector": ["mapping.Vector"],
    "ramp.Fac": ["noise.Fac"],
    "bump.Height": ["noise.Fac", "ramp.Color"],
    "bump.Normal": ["normal.Color"],
    "surface.Base Color": ["color.Color"],
    "surface.Roughness": ["rough.Color", "ramp.Color", "noise.Fac"],
    "surface.Normal": ["bump.Normal", "normal.Color"],
    "output.Surface": ["surface.BSDF"],
  };
  const node = (id, params = {}) => ({ id, type: types[id], params });
  const link = (from, to) => ({ from, to });
  function create(p, preset) {
    const choice =
      preset ||
      ({ cotton: "cotton", linen: "linen", silk: "satin", jacquard: "linen" }[
        p.fabric
      ] ??
        "cotton");
    const base = {
      ior: 1.46,
      specularIORLevel: 0.4,
      roughness: 0.7,
      diffuseRoughness: 0.5,
      sheenWeight: 0.3,
      sheenRoughness: 0.6,
      sheenTint: "#f0e6d9",
      anisotropy: 0,
      anisotropyRotation: 0,
      coatWeight: 0,
      coatRoughness: 0.25,
      coatIOR: 1.5,
      normalStrength: 0.8,
      ...opticalDefaults,
      ...presets[choice],
    };
    delete base.label;
    if (!preset) {
      if (p.roughness !== undefined) base.roughness = p.roughness / 100;
      if (p.sheenLevel !== undefined) base.sheenWeight = p.sheenLevel / 100;
    }
    const nodes = [
      node("coord"),
      node("mapping", { scale: 1, rotation: 0 }),
      node("color", { image: null }),
      node("rough", { image: null }),
      node("normal", { image: null }),
      node("noise", {
        scale: choice === "velvet" ? 230 : 110,
        detail: 3,
        roughness: 0.7,
      }),
      node("ramp", { low: 0.18, high: 0.82, black: 0.55, white: 0.96 }),
      node("bump", {
        strength: ["satin", "organza"].includes(choice) ? 0.12 : 0.24,
        distance:
          choice === "velvet" ? 0.025 : choice === "organza" ? 0.004 : 0.012,
      }),
      node("surface", base),
      node("output"),
    ];
    const links = Object.entries(incoming).map(([to, sources]) =>
      link(sources[0], to),
    );
    if (["satin", "velvet", "coated", "organza"].includes(choice))
      links.splice(
        links.findIndex((l) => l.to === "surface.Roughness"),
        1,
      );
    if (choice === "velvet")
      links.splice(
        links.findIndex((l) => l.to === "surface.Base Color"),
        1,
      );
    return {
      format: "xingcai-material",
      version: 1,
      name: presets[choice].label,
      nodes,
      links,
    };
  }
  const get = (graph, id) => graph.nodes.find((n) => n.id === id).params;
  const source = (graph, socket) =>
    graph.links.find((l) => l.to === socket)?.from;
  function validate(g) {
    if (g?.format === "xingcai-material" && g.version === 2)
      return MaterialGraph.validate(g);
    if (
      g?.format !== "xingcai-material" ||
      g.version !== 1 ||
      typeof g.name !== "string" ||
      g.name.length > 60
    )
      throw Error("材质文件格式无效");
    if (
      !Array.isArray(g.nodes) ||
      g.nodes.length !== Object.keys(types).length ||
      !Array.isArray(g.links) ||
      g.links.length > 18
    )
      throw Error("材质节点数量无效");
    for (const [id, type] of Object.entries(types)) {
      const matches = g.nodes.filter((n) => n.id === id);
      if (
        matches.length !== 1 ||
        matches[0].type !== type ||
        !matches[0].params ||
        typeof matches[0].params !== "object"
      )
        throw Error("材质节点 " + id + " 无效");
      const p = matches[0].params;
      for (const [key, [min, max]] of Object.entries(ranges[id] || {}))
        if (
          !(
            id === "surface" &&
            Object.hasOwn(opticalDefaults, key) &&
            p[key] === undefined
          ) &&
          (!Number.isFinite(p[key]) || p[key] < min || p[key] > max)
        )
          throw Error(id + "." + key + " 超出范围");
      if (["color", "rough", "normal"].includes(id) && p.image !== null) {
        if (
          typeof p.image !== "string" ||
          p.image.length > 12000000 ||
          !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p.image)
        )
          throw Error("图像节点仅支持 PNG、JPEG、WebP");
      }
    }
    if (
      !/^#[0-9a-f]{6}$/i.test(get(g, "surface").sheenTint) ||
      get(g, "ramp").low >= get(g, "ramp").high
    )
      throw Error("绒光颜色或色阶位置无效");
    for (const key of ["attenuationColor", "emissionColor"])
      if (
        get(g, "surface")[key] !== undefined &&
        !/^#[0-9a-f]{6}$/i.test(get(g, "surface")[key])
      )
        throw Error("材质颜色无效");
    const used = new Set();
    for (const l of g.links) {
      if (!incoming[l.to]?.includes(l.from) || used.has(l.to))
        throw Error("材质连线无效");
      used.add(l.to);
    }
    for (const required of [
      "mapping.Vector",
      "color.Vector",
      "rough.Vector",
      "normal.Vector",
      "noise.Vector",
      "ramp.Fac",
      "output.Surface",
    ])
      if (!used.has(required)) throw Error("缺少材质连线 " + required);
    return g;
  }
  function connect(g, to, from) {
    g.links = g.links.filter((l) => l.to !== to);
    if (from) g.links.push(link(from, to));
  }
  const images = new Map();
  async function prepare(g) {
    validate(g);
    await Promise.all(
      g.nodes
        .filter((n) => n.type === "ShaderNodeTexImage")
        .map(async ({ params }) => {
          const url = params.image;
          if (!url || images.has(url)) return;
          const image = new Image();
          image.src = url;
          await image.decode();
          if (image.width > 8192 || image.height > 8192)
            throw Error("图像边长最多为 8192 像素");
          const t = new THREE.Texture(image);
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.anisotropy = 8;
          t.needsUpdate = true;
          images.set(url, t);
        }),
    );
  }
  const noiseShader = `
uniform float xmScale,xmDetail,xmNoiseRough,xmLow,xmHigh,xmBlack,xmWhite,xmBumpStrength,xmBumpDistance;
uniform vec2 xmUVScale;uniform float xmUVAngle;
float xmHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float xmValueNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(xmHash(i),xmHash(i+vec2(1.,0.)),f.x),mix(xmHash(i+vec2(0.,1.)),xmHash(i+vec2(1.,1.)),f.x),f.y);}
vec2 xmMapped(vec2 p){float c=cos(xmUVAngle),s=sin(xmUVAngle);return vec2(c*p.x+s*p.y,-s*p.x+c*p.y)*xmUVScale;}
float xmNoise(vec2 uv){
 vec2 p=xmMapped(uv)*xmScale;float sum=0.,weight=1.,total=0.;
 for(int i=0;i<5;i++){if(float(i)>=xmDetail)break;sum+=xmValueNoise(p)*weight;total+=weight;weight*=xmNoiseRough;p=p*2.031+vec2(17.13,9.2);}
 return sum/max(total,.001);
}
float xmRamp(float f){return mix(xmBlack,xmWhite,clamp((f-xmLow)/max(.0001,xmHigh-xmLow),0.,1.));}
`;
  function apply(mat, p) {
    const g = p.material ? validate(p.material) : create(p),
      surface = { ...opticalDefaults, ...get(g, "surface") };
    configureSurface(mat, surface);
    if (g.version === 2)
      return MaterialGraph.apply(mat, g, surface, images, noiseShader);
    const mapping = get(g, "mapping");
    const owned = [];
    for (const [id, slot, colorSpace] of [
      ["color", "map", THREE.SRGBColorSpace],
      ["rough", "roughnessMap", THREE.NoColorSpace],
      ["normal", "normalMap", THREE.NoColorSpace],
    ]) {
      const image = get(g, id).image;
      const input = image ? images.get(image) : mat[slot];
      if (image && !input) throw Error("材质图像尚未解码");
      if (input) {
        const map = input.clone();
        map.colorSpace = colorSpace;
        map.needsUpdate = true;
        map.repeat.multiplyScalar(mapping.scale);
        map.rotation = (mapping.rotation * Math.PI) / 180;
        mat[slot] = map;
        owned.push(map);
      }
    }
    if (!source(g, "surface.Base Color")) mat.map = null;
    const roughSource = source(g, "surface.Roughness");
    if (roughSource !== "rough.Color") mat.roughnessMap = null;
    const normalSource = source(g, "surface.Normal"),
      useNormal =
        normalSource === "normal.Color" ||
        (normalSource === "bump.Normal" &&
          source(g, "bump.Normal") === "normal.Color");
    if (!useNormal) mat.normalMap = null;
    mat.normalScale.setScalar(surface.normalStrength);
    mat.ior = surface.ior;
    mat.specularIntensity = 2 * surface.specularIORLevel;
    mat.specularColor.set(0xffffff);
    mat.roughness = surface.roughness;
    mat.anisotropy = surface.anisotropy;
    mat.anisotropyRotation = (surface.anisotropyRotation * Math.PI) / 180;
    mat.clearcoat = surface.coatWeight;
    mat.clearcoatRoughness = surface.coatRoughness;
    mat.bumpMap = null;
    CyclesMaterial.attach(mat, surface);
    const previous = mat.onBeforeCompile;
    const signature = [
      roughSource,
      normalSource,
      source(g, "bump.Height"),
    ].join("|");
    mat.defines = { ...mat.defines, USE_UV: "" };
    mat.onBeforeCompile = (shader) => {
      previous(shader);
      const noise = get(g, "noise"),
        ramp = get(g, "ramp"),
        bump = get(g, "bump");
      for (const [key, value] of Object.entries({
        xmScale: noise.scale,
        xmDetail: noise.detail,
        xmNoiseRough: noise.roughness,
        xmLow: ramp.low,
        xmHigh: ramp.high,
        xmBlack: ramp.black,
        xmWhite: ramp.white,
        xmBumpStrength: bump.strength,
        xmBumpDistance: bump.distance,
        xmUVAngle: (mapping.rotation * Math.PI) / 180,
      }))
        shader.uniforms[key] = { value };
      shader.uniforms.xmUVScale = {
        value: new THREE.Vector2(mapping.scale, mapping.scale),
      };
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        "#include <common>\n" + noiseShader,
      );
      let edit = "";
      if (roughSource === "noise.Fac")
        edit += "roughnessFactor*=xmNoise(vUv);\n";
      if (roughSource === "ramp.Color")
        edit += "roughnessFactor*=xmRamp(xmNoise(vUv));\n";
      if (normalSource === "bump.Normal" && source(g, "bump.Height")) {
        const height =
          source(g, "bump.Height") === "ramp.Color"
            ? "xmRamp(xmNoise(vUv))"
            : "xmNoise(vUv)";
        edit += `float xmHeight=(${height})*xmBumpStrength*xmBumpDistance;
          vec3 xmDX=dFdx(-vViewPosition),xmDY=dFdy(-vViewPosition);
          vec3 xmR1=cross(xmDY,normal),xmR2=cross(normal,xmDX);
          float xmDet=dot(xmDX,xmR1);
          normal=normalize(abs(xmDet)*normal-sign(xmDet)*(dFdx(xmHeight)*xmR1+dFdy(xmHeight)*xmR2));\n`;
      }
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        "#include <normal_fragment_maps>\n" + edit,
      );
    };
    mat.customProgramCacheKey = () => "xingcai-cycles-nodes-v1:" + signature;
    mat.userData.materialGraph = structuredClone(g);
    mat.addEventListener("dispose", () => owned.forEach((t) => t.dispose()));
    return mat;
  }
  function configureSurface(mat, p) {
    mat.transmission = p.transmission;
    // World geometry is in centimetres; GLB export converts thickness to metres.
    mat.thickness = p.thickness;
    mat.attenuationDistance = p.attenuationDistance;
    mat.attenuationColor.set(p.attenuationColor);
    mat.attenuationColor.r = Math.max(0.00001, mat.attenuationColor.r);
    mat.attenuationColor.g = Math.max(0.00001, mat.attenuationColor.g);
    mat.attenuationColor.b = Math.max(0.00001, mat.attenuationColor.b);
    mat.opacity = p.alpha;
    mat.transparent = p.alpha < 1;
    mat.depthWrite = !mat.transparent;
    mat.metalness = p.metalness;
    mat.emissive.set(p.emissionColor);
    mat.emissiveIntensity = p.emissionStrength;
    mat.userData.thinSurface = mat.transmission > 0 || mat.transparent;
  }
  return {
    create,
    get,
    source,
    connect,
    validate,
    prepare,
    apply,
    presets,
    ranges,
    opticalDefaults,
  };
})();
