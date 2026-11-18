/* SPDX-FileCopyrightText: 2011-2022 Blender Foundation
 * SPDX-License-Identifier: Apache-2.0
 *
 * Modified for Xingcai, 2026-11-18. C++ closures were adapted to WebGL GLSL.
 * Sheen evaluation, LUT interpolation and energy-preserving Oren-Nayar below
 * retain the Blender 4.5.0 equations. See vendor/cycles for unmodified sources.
 * Burley mean free path fitting and radial CDF are adapted from bssrdf.h.
 * Light integration and the Three.js shader adapter are Xingcai code.
 */
"use strict";
const CyclesMaterial = (() => {
  const data = new Float32Array(32 * 32 * 4);
  for (let i = 0; i < 1024; i++) {
    data[4 * i] = CyclesSheenTable[i];
    data[4 * i + 1] = CyclesSheenTable[i + 1024];
    data[4 * i + 2] = CyclesSheenTable[i + 2048];
    data[4 * i + 3] = 1;
  }
  let lookup;
  function texture() {
    if (!lookup) {
      lookup = new THREE.DataTexture(
        data,
        32,
        32,
        THREE.RGBAFormat,
        THREE.FloatType,
      );
      lookup.minFilter = lookup.magFilter = THREE.NearestFilter;
      lookup.needsUpdate = true;
    }
    return lookup;
  }
  const glsl = `
uniform sampler2D xcSheenLTC;
uniform float xcDiffuseRoughness;
uniform vec3 xcSheenColor;
uniform float xcSheenRoughness;
uniform float xcCoatIOR;
vec3 xcTable(float nv,float rough){
  vec2 xy=vec2(clamp(nv,0.,1.),clamp(rough,.001,1.))*31.;
  vec2 lo=floor(xy),hi=min(lo+1.,vec2(31.)),f=xy-lo;
  vec3 a=texture2D(xcSheenLTC,(lo+.5)/32.).rgb;
  vec3 b=texture2D(xcSheenLTC,(vec2(hi.x,lo.y)+.5)/32.).rgb;
  vec3 c=texture2D(xcSheenLTC,(vec2(lo.x,hi.y)+.5)/32.).rgb;
  vec3 d=texture2D(xcSheenLTC,(hi+.5)/32.).rgb;
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
vec3 xcSheenAlbedo(vec3 N,vec3 V){
  vec3 lut=xcTable(max(0.,dot(N,V)),xcSheenRoughness);
  return abs(lut.x)<.00001||lut.z<.00001?vec3(0.):xcSheenColor*lut.z;
}
// Returns f*cos(theta_o), matching bsdf_sheen_eval plus setup's albedo.
vec3 xcSheenEval(vec3 N,vec3 V,vec3 L){
  float nv=max(0.,dot(N,V)),nl=dot(N,L);
  vec3 lut=xcTable(nv,xcSheenRoughness);
  if(nl<=0.||abs(lut.x)<.00001||lut.z<.00001)return vec3(0.);
  vec3 tangent=V-N*dot(N,V);
  if(dot(tangent,tangent)<1e-12)tangent=abs(N.z)<.9?cross(vec3(0.,0.,1.),N):cross(vec3(0.,1.,0.),N);
  vec3 T=normalize(tangent),B=cross(N,T);
  vec3 o=vec3(dot(L,T),dot(L,B),nl);
  float ax=lut.x*o.x+lut.y*o.z,ay=lut.x*o.y;
  float lenSqr=ax*ax+ay*ay+o.z*o.z;
  float val=(1./3.141592653589793)*o.z*pow(lut.x/max(lenSqr,1e-12),2.);
  return xcSheenColor*(lut.z*val);
}
float xcOrenG(float c){
  if(c<.000001)return (1.570796326794897-2./3.)-c;
  float s=sqrt(max(0.,1.-c*c)),angle=acos(clamp(c,0.,1.));
  return s*(angle-2./3.-s*c)+2./3.*(s/c)*(1.-s*s*s);
}
// The closure's outer albedo weight is included in this adapter.
vec3 xcDiffuse(vec3 N,vec3 V,vec3 L,vec3 color,float rough){
  float nl=max(0.,dot(N,L)),nv=max(0.,dot(N,V)),sigma=clamp(rough,0.,1.);
  if(sigma<.00001)return color*nl/3.141592653589793;
  float a=1./(3.141592653589793+sigma*(1.570796326794897-2./3.)),b=sigma*a;
  float t=dot(L,V)-nl*nv;
  if(t>0.)t/=max(max(nl,nv),1e-20);
  float Eavg=a*3.141592653589793+((6.283185307179586-5.6)/3.)*b;
  vec3 albedo=clamp(color,0.,1.);
  vec3 Ems=(1./3.141592653589793)*albedo*albedo*(Eavg/max(1e-9,1.-Eavg))/(vec3(1.)-albedo*(1.-Eavg));
  float Ev=a*3.141592653589793+b*xcOrenG(nv),El=a*3.141592653589793+b*xcOrenG(nl);
  return color*nl*(vec3(a+b*t)+Ems*(1.-Ev)*(1.-El));
}
float xcLowerWeight(vec3 N,vec3 V){
  vec3 albedo=xcSheenAlbedo(N,V);
  return max(0.,1.-max(albedo.r,max(albedo.g,albedo.b)));
}
`;
  const wrappers = `
#ifdef XC_SUBSURFACE
float xcSubsurface,xcSubsurfaceScale,xcThickness;
vec3 xcSubsurfaceRadius;

// Project local geometric curvature onto the light direction. Approximate the
// Burley two-exponential radial integral at each component's mean radius.
vec3 xcBurleyDiffuse(vec3 N,vec3 L,vec3 P,vec3 albedo){
  vec3 color=clamp(albedo,0.,1.), shift=color-.8;
  vec3 d=max(vec3(.00001),xcSubsurfaceRadius*xcSubsurfaceScale*.07957747155/
    (1.9-color+3.5*shift*shift));
  vec3 px=dFdx(P),py=dFdy(P);
  vec3 gx=dFdx(normalize(vNormal)),gy=dFdy(normalize(vNormal));
  gx*=gl_FrontFacing?1.:-1.; gy*=gl_FrontFacing?1.:-1.;
  float dx=dot(gx,L)/max(length(px),.00001);
  float dy=dot(gy,L)/max(length(py),.00001);
  float slope=min(length(vec2(dx,dy)),4.);
  float nl=dot(N,L);
  vec3 r1=clamp(d*slope,0.,.65),r3=clamp(3.*d*slope,0.,.8);
  vec3 diffuse=.25*(max(vec3(0.),nl+r1)+max(vec3(0.),nl-r1))*.5
              +.75*(max(vec3(0.),nl+r3)+max(vec3(0.),nl-r3))*.5;
  // Complement of the radial CDF, evaluated at the thin sheet's light path.
  float path=xcThickness/max(-nl,.12);
  vec3 tail=.25*exp(-path/d)+.75*exp(-path/(3.*d));
  vec3 through=tail*max(-nl,0.)*.72;
  return color*(diffuse+through)*.3183098862;
}
#endif
void RE_Direct_XC(const in IncidentLight light,const in vec3 P,const in vec3 N,const in vec3 V,const in vec3 CN,const in PhysicalMaterial m,inout ReflectedLight r){
  ReflectedLight local=ReflectedLight(vec3(0.),vec3(0.),vec3(0.),vec3(0.));
  RE_Direct_Physical(light,P,N,V,CN,m,local);
  float weight=xcLowerWeight(N,V);
  vec3 diffuse=xcDiffuse(N,V,light.direction,m.diffuseColor,xcDiffuseRoughness);
  #ifdef XC_SUBSURFACE
    diffuse=mix(diffuse,xcBurleyDiffuse(N,light.direction,P,m.diffuseColor),xcSubsurface);
  #endif
  r.directDiffuse+=light.color*diffuse*weight;
  r.directSpecular+=local.directSpecular*weight+light.color*xcSheenEval(N,V,light.direction);
}
void RE_IndirectDiffuse_XC(const in vec3 irradiance,const in vec3 P,const in vec3 N,const in vec3 V,const in vec3 CN,const in PhysicalMaterial m,inout ReflectedLight r){
  // Hemispherical environment approximation; direct-light closure above is exact.
  r.indirectDiffuse+=irradiance*(m.diffuseColor*xcLowerWeight(N,V)+xcSheenAlbedo(N,V))/3.141592653589793;
}
void RE_IndirectSpecular_XC(const in vec3 radiance,const in vec3 irradiance,const in vec3 coatRadiance,const in vec3 P,const in vec3 N,const in vec3 V,const in vec3 CN,const in PhysicalMaterial m,inout ReflectedLight r){
  ReflectedLight local=ReflectedLight(vec3(0.),vec3(0.),vec3(0.),vec3(0.));
  RE_IndirectSpecular_Physical(radiance,irradiance,coatRadiance,P,N,V,CN,m,local);
  r.indirectSpecular+=local.indirectSpecular*xcLowerWeight(N,V);
  r.indirectDiffuse+=local.indirectDiffuse*xcLowerWeight(N,V);
}
#undef RE_Direct
#define RE_Direct RE_Direct_XC
#undef RE_IndirectDiffuse
#define RE_IndirectDiffuse RE_IndirectDiffuse_XC
#undef RE_IndirectSpecular
#define RE_IndirectSpecular RE_IndirectSpecular_XC
`;
  function attach(material, params) {
    material.sheen = 0;
    if (params.subsurface > 0)
      material.defines = { ...material.defines, XC_SUBSURFACE: 1 };
    const shade = () => {
      const T = THREE;
      return {
        xcSheenLTC: { value: texture() },
        xcDiffuseRoughness: { value: params.diffuseRoughness },
        xcSheenColor: {
          value: new T.Color(params.sheenTint).multiplyScalar(
            params.sheenWeight,
          ),
        },
        xcSheenRoughness: { value: params.sheenRoughness },
        xcCoatIOR: { value: params.coatIOR },
        xcSSSInputs: {
          value: new T.Vector3(
            params.subsurface,
            params.subsurfaceScale,
            params.thickness,
          ),
        },
        xcSSSRadii: {
          value: new T.Vector3(params.radiusR, params.radiusG, params.radiusB),
        },
      };
    };
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, shade());
      const physical = THREE.ShaderChunk.lights_physical_pars_fragment;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <lights_physical_pars_fragment>",
        glsl + physical + wrappers,
      );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "void main() {",
          "uniform vec3 xcSSSInputs,xcSSSRadii;\nvoid main() {",
        )
        .replace(
          "#include <lights_fragment_begin>",
          `
          #ifdef XC_SUBSURFACE
            xcSubsurface=xcSSSInputs.x;
            xcSubsurfaceScale=xcSSSInputs.y;
            xcThickness=xcSSSInputs.z;
            xcSubsurfaceRadius=xcSSSRadii;
          #endif
          #include <lights_fragment_begin>`,
        );
      if (material.transmission > 0)
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <transmission_fragment>",
          THREE.ShaderChunk.transmission_fragment
            .replace(
              "normalize( cameraPosition - pos )",
              "normalize( inverseTransformDirection( geometryViewDir, viewMatrix ) )",
            )
            .replace(
              "transmitted.rgb, material.transmission",
              "transmitted.rgb * xcLowerWeight(normal,geometryViewDir), material.transmission",
            ),
        );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <lights_physical_fragment>",
        THREE.ShaderChunk.lights_physical_fragment
          .replace(
            "material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );",
            "material.specularF90 = 1.0;",
          )
          .replace(
            "material.clearcoatF0 = vec3( 0.04 );",
            "material.clearcoatF0 = vec3(pow((xcCoatIOR-1.)/(xcCoatIOR+1.),2.));",
          ),
      );
    };
    material.customProgramCacheKey = () => "xingcai-cycles-closures-v1";
    material.userData.cyclesPort = { version: "Blender 4.5.0", ...params };
    return material;
  }
  return { attach, glsl, texture };
})();
