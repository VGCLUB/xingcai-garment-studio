# Cycles material modules used by Xingcai

Upstream is Blender v4.5.0, commit `8cb6b388974a817afedf1317ce26f0c75aa5f181`. The files below retain their upstream copyright headers and are covered by Apache License 2.0. The complete license is in `LICENSE-2.0.txt`.

| Local file | Upstream source | Usage |
| --- | --- | --- |
| bsdf_sheen.h | [Cycles sheen closure](https://github.com/blender/blender/blob/8cb6b388974a817afedf1317ce26f0c75aa5f181/intern/cycles/kernel/closure/bsdf_sheen.h) | Unmodified reference for setup, evaluation and albedo weighting |
| bsdf_oren_nayar.h | [Cycles diffuse closure](https://github.com/blender/blender/blob/8cb6b388974a817afedf1317ce26f0c75aa5f181/intern/cycles/kernel/closure/bsdf_oren_nayar.h) | Unmodified reference for improved Oren–Nayar and energy compensation |
| bssrdf.h | [Cycles BSSRDF](https://github.com/blender/blender/blob/8cb6b388974a817afedf1317ce26f0c75aa5f181/intern/cycles/kernel/closure/bssrdf.h) | Unmodified reference for Christensen–Burley fitting and radial cumulative distribution |
| lookup_table.h | [Cycles lookup interpolation](https://github.com/blender/blender/blob/8cb6b388974a817afedf1317ce26f0c75aa5f181/intern/cycles/kernel/util/lookup_table.h) | Unmodified reference for bilinear LUT evaluation |
| shader.tables | [Cycles lookup data](https://github.com/blender/blender/blob/8cb6b388974a817afedf1317ce26f0c75aa5f181/intern/cycles/scene/shader.tables) | Unmodified reference containing the original table |
| sheen-table.js | Same table source | Modified format, extracting the 3072 `table_sheen_ltc` values into JavaScript |

## Changes made on 2026-11-18

`../../cycles-material.js` adapts the C++ setup and evaluation equations into GLSL for WebGL and preserves the source copyright and Apache-2.0 notice. It packs the three 32 × 32 tables into an RGBA float texture, implements manual bilinear interpolation, includes the closure weight in evaluation, and adds a Three.js shader adapter. Tangent construction uses the view direction projected onto the surface, with a fallback at normal incidence. Sampling and PDF functions are outside this rasterization integration.

`xcSheenEval`, `xcSheenAlbedo` and `xcTable` implement the sheen evaluation and lookup. `xcOrenG` and `xcDiffuse` implement the diffuse closure. Layer attenuation, lights, the environment approximation and Three.js integration are implemented in the adapter. Indirect illumination uses a hemispherical approximation. The GGX, anisotropy and coat paths use Three.js.

`xcBurleyDiffuse` adapts the Burley length fitting and the complement of the two-exponential radial CDF. The adapter uses local derivatives and thin-sheet backlighting in WebGL. The Cycles path-tracing sampler and random walk are outside this integration.

`../../material-graph.js` and `../../material-editor.js` implement Xingcai's typed surface node graph and editing UI. The noise function is an independent value-noise implementation. The editable graph serializes as `.xcmat.json` and within Xingcai projects.

`../../verify-material.cjs` parses the original table independently, evaluates a JavaScript numerical reference, and compares it to the actual GLSL closures rendered to a float framebuffer. It also tests the supported UI and persistence paths.

The sheen model originates from Tizian Zeltner, Brent Burley and Matt Jen-Yuan Chiang, “Practical Multiple-Scattering Sheen Using Linearly Transformed Cosines” (2022), as credited in the upstream source. [Authors' project page](https://tizianzeltner.com/projects/Zeltner2022Practical/)

