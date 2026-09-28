# Raj's reusable portrait model

The hero now samples an actual 3D surface. Facial depth comes from a 468-landmark fit to
`public/raj-avatar.webp`, the existing colored cartoon. The nose, eyelids, cheeks, lips and chin have
independent geometry. An authored cranium, neck, shoulders, rear surface and spiral curl meshes
complete the volume. The original cartoon supplies the front texture; the rear has inferred colors.

## Deliverables

- [`raj-bust.glb`](../../public/models/raj-bust.glb): standard, self-contained glTF 2.0, with an embedded
  JPEG, normals, UVs, rear vertex colors and two rough, nonmetallic materials. Editable in Blender and
  loadable by standard glTF viewers/engines.
- [`raj-cloud.bin`](../../public/models/raj-cloud.bin): samples of those same triangles and a copy of
  their geometry for the hero's depth prepass. The site needs no 3D framework or ML runtime.
- [`raj-cloud-poster.webp`](../../public/models/raj-cloud-poster.webp): the same model rendered front-on
  into the existing points/work-stars/personal-stars mask panels. Used without WebGL and in Saver.
- [`raj-bust.json`](../../public/models/raj-bust.json): generated counts, bounds and uncompressed sizes.
- [`face-fit.json`](../../scripts/avatar/face-fit.json): checked-in landmark fit and reference SHA-256.

This is a **stylized single-view reconstruction, not a scan**. The source cannot establish an exact
profile, ear anatomy or the back of the head. Those surfaces are inferred. The front material retains
lighting painted into the cartoon, and its projection stretches at extreme profile angles. Modest
turns, as used in the hero, preserve the likeness best. There is no facial rig, lip sync or expression
animation in this export. Those would require further modeling/rigging; a rigid floating/turning
colored avatar can already reuse the GLB.

## Reuse for the future colored agent

Load `/models/raj-bust.glb` in the renderer chosen for the agent. Preserve both materials, the embedded
texture's sRGB interpretation and the linear vertex colors. Use soft lighting with a transparent
background; there is already shading in the reference texture. The GLB is **Y up, Z forward**,
centered around the bust, with a roughly 0.9-unit height. A head-centered camera can aim near
`[0, 0.15, 0]`; use the generated bounds to frame it. Animate its parent transform for float/yaw/pitch.
The hero's binary flips Y to match its screen-space convention. No floating agent UI is implemented.

## Rebuild

Use Python 3.12 in a virtual environment, plus Bun for the poster's shared star selection:

```sh
python3 -m venv /tmp/raj-avatar-tools
/tmp/raj-avatar-tools/bin/pip install -r scripts/avatar/requirements.txt
/tmp/raj-avatar-tools/bin/python scripts/avatar/build-model.py
/tmp/raj-avatar-tools/bin/python scripts/avatar/build-poster.py
```

The build is seeded. The reference hash must match the fit; a mismatch stops the build. The original
`hero-cloud-src.png` is used **only as a silhouette matte**, mapped back to the avatar crop. Its old
ellipsoid depth is not used. Bump the `?v=` values in `hero.tsx` together after rebuilding. The legacy
`scripts/portrait-images.py` still creates the old portrait images; it does not update this 3D model.

Only when replacing the reference, refit with MediaPipe (not needed for normal rebuilding):

```sh
/tmp/raj-avatar-tools/bin/pip install mediapipe==0.10.21
curl -fL -o /tmp/face_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
/tmp/raj-avatar-tools/bin/python scripts/avatar/fit-face.py /tmp/face_landmarker.task
```

The landmark step runs locally on the already-public portrait. No portrait is uploaded to a service.
The hair/neck/shoulder proportions are authored for this cartoon and need review when it changes.
MediaPipe's [Face Landmarker documentation](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/python)
describes the 3D landmark output. Its model is a build-time tool, not a shipped dependency.

## Hero rendering

The GLB and hero binary are generated from the same vertex/triangle arrays. High draws 18,000
surface samples; Medium draws a deterministic 8,000-point prefix. Stars are selected from front-facing
samples present in both tiers. By area the eyes would get only about 60 points each, so the lash
lines and irises get extra samples (about 360 per eye; tune with the `EYE_*` constants in
`build-model.py`). Points on and around the eyes are stored at 254/255 brightness, which keeps stars
off them. The renderer rotates normals with the head and writes the mesh to the
depth buffer before drawing points, so the far cheek, nose and rear surfaces occlude correctly.
CPU ray intersections also prevent hidden stars from being clicked. Assembly runs before the depth
prepass begins. Offscreen/tab-hidden pausing, brush interaction and motion-tier fallback are retained.

The binary layout is little-endian: `RJC2`, uint32 point count, uint32 vertex count, uint32 index count;
then 10 bytes per point (three int16 positions divided by 65534, three int8 normal components
renormalized on load, one uint8 brightness divided by 255), three int16s per mesh vertex and uint16
triangle indices. Position quantization introduces less than .02px error at a 1000px figure. It is intentionally separate from the colored GLB so the hero never downloads its
texture or color/material data (the hero asset is 916 KiB raw, about 658 KiB with gzip). `surface.ts` rejects truncated data, zero normals and out-of-range indices.

## Validation

`bun run test -- app/components/site/cloud` checks mesh bounds, normals, nonplanar facial relief,
identity between GLB and hero vertices, both point budgets, deterministic star selection, invalid
assets and occluded star picking. The GLB was also checked with Khronos glTF Validator and imported
into Blender for front, three-quarter, profile and rear renders. Visual browser checks cover desktop,
mobile, both live tiers and Saver. The [three-quarter preview](previews/three-quarter.png) is a Blender render of the exported asset, not site UI.

To reproduce the colored preview with Blender 4.3+:

```sh
blender --background --python scripts/avatar/render-preview.py -- \
  "$PWD/public/models/raj-bust.glb" "$PWD/docs/avatar/previews/three-quarter.png" 35
```
