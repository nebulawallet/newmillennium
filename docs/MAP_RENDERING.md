# Map rendering: benchmark and decision

Phase 3 built both candidate province renderers behind the same interface (`src/render/WorldMap.ts`). Open the app with `?bench` to rerun the comparison; `?renderer=texture` runs the game with approach B.

- **A, meshes** (`layers/ProvinceMesh.ts`): one merged triangle mesh of all provinces. Each vertex carries its province id, and the colour comes from a 256×256 lookup texture (`layers/ProvinceColors.ts`). Borders are a separate quad mesh with screen-space width (`layers/Borders.ts`).
- **B, id texture** (`layers/ProvinceTexture.ts`): one quad textured with the 8192×4103 province-id raster. The fragment shader decodes the id, looks up its colour, and draws borders by comparing neighbouring texels.

Both use the same lookup texture, so switching map modes costs the same: one 256 KB texture upload.

## Results (2026-10-14)

Test setup:
- Intel UHD Graphics (ANGLE/D3D11), 1280×720, MSAA.
- 4,564 provinces, 145k vertices, 46k country/coast and 45k province border segments.
- Frame time is a synchronous render plus a 1-pixel readback, averaged over 40 frames. It includes labels and lakes.

| metric | A: meshes | B: id texture |
|---|---:|---:|
| init (ms) | 209 | 339 |
| frame, world (ms) | 22.9 | 15.1 |
| frame, continent (Europe) (ms) | 23.6 | 19.0 |
| frame, country (Germany) (ms) | 19.8 | 21.6 |
| frame, max zoom (Ruhr) (ms) | 11.8 | 11.7 |
| map-mode switch (ms) | 38 | 29 |
| GPU memory, est. (MB) | 18 | 128 |

Approach A was first measured at 33.6 / 33.2 / 23.3 / 16.2 ms frame times. Two optimisations brought it down to the figures above:
- Off-screen world copies are hidden; the map is drawn three times for wrap-around.
- Province borders get their own mesh, which is skipped when they are invisible at low zoom.

## Decision: A (meshes)

1. **Border quality.** A's vector borders stay crisp at every zoom. B's borders are texel stair-steps: one texel is about 4.4 km, which is clearly visible at province zoom. Fixing that would need a 16k–32k texture or distance fields.
2. **Memory.** A uses 18 MB against B's 128 MB. B's full-resolution RGBA id texture alone is 128 MB, which is risky on integrated and mobile GPUs.
3. **Speed.** The two are equal at country and province zoom, where players spend most of their time. B is about 8 ms faster only at world zoom.
4. **Flexibility.** A makes later features straightforward: animated fronts, occupation hatching through a second attribute, and per-province vertex effects.

## Follow-ups

- **World-zoom LOD.** A coarser mesh (about 3% simplification) used below zoom 2 should close the world-zoom gap.
- **Picking.** Picking stays on the CPU id raster in both approaches. Lookup is O(1) and needs no GPU readback.
- **Terrain shading.** If terrain shading needs per-pixel data later, sample a separate low-resolution relief texture in the mesh shader.
