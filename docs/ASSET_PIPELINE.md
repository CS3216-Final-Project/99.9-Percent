# Asset pipeline

How 3D models and textures get into the game, from a source file to something the browser downloads. The models live in `frontend/public/models/<pack>/`, and the photo textures live in `frontend/public/textures/<surface>/`. Every folder carries a `License.txt`.

## Where assets come from

Use CC0 assets only, so nothing needs credit and nothing restricts redistribution. A web game serves every model file publicly, so licences that allow use but not redistribution (Mixamo, for example) do not fit. Packs already in use:

| Folder | Source | Licence |
| --- | --- | --- |
| `models/creatures` | Quaternius, Ultimate Monsters | CC0 |
| `models/avatars` | Kenney, Cube Pets 2.0 (the 18 animals the crew are not) | CC0 |
| `models/kenney` | Kenney, Furniture Kit | CC0 |
| `models/kaykit` | Kay Lousberg, KayKit Furniture Bits | CC0 |
| `models/polyhaven` | Poly Haven models | CC0 |
| `textures/*` | Poly Haven and ambientCG materials | CC0 |

Good CC0 sources for more: [Quaternius](https://quaternius.com/), [Kenney](https://kenney.nl/assets), [KayKit](https://kaylousberg.com/game-assets), [Poly Haven](https://polyhaven.com/) and [ambientCG](https://ambientcg.com/). Sketchfab and Poly Pizza mix licences, so check each model before using it. Synty is paid.

Before adding a pack, list each file, its source, its licence and its size in the pull request. Record the authors in the folder's `License.txt`.

## Making a model in Blender

Blender source files (`.blend`) live in the team's Google Drive, not in Git (see `.gitignore`). To bring a model into the game:

1. Model in metres, and put the origin where the model stands on the floor. Blender is Z-up; its glTF exporter converts to the +Y-up that three.js uses, so leave "+Y Up" ticked. Each placement in the game sets the model's turn, so match the facing of the pack's other models.
2. Apply scale and rotation (Object → Apply → All Transforms), and apply modifiers on export.
3. Keep materials simple. The office uses plain colours or one shared texture atlas per pack, and the game recolours many models itself. Bake lighting into textures only if the model never moves.
4. Export as glTF Binary (`.glb`): File → Export → glTF 2.0. Tick "Selected Objects" and "Apply Modifiers", and leave cameras and lights unticked. Leave Blender's own compression off, because the next step compresses the file.
5. Put the file in its pack's folder under `frontend/public/models/`, with a short name in the style of the folder's other files.
6. Compress it (see below), load it through `loadGltf` in `frontend/src/components/scene/gltf.ts`, and check it in the browser at High and Low quality.

## Compressing models

Every model is compressed with [meshopt](https://meshoptimizer.org/) through [gltf-transform](https://gltf-transform.dev/). Meshopt quantizes positions, normals and texture coordinates to small integers and packs them. The game's loader decodes it, and geometry that is moved and merged goes through `toFloatAttributes` first.

```bash
cd frontend
npm run models:compress
```

This finds every `.glb` and `.gltf` under `public/models` that is not compressed yet and compresses it in place, keeping file names, texture names and buffer names. Use `npm run models:compress -- --check` to list what still needs compressing, failing if anything does. The script runs `@gltf-transform/cli@4.5.0` through `npx`, so the tool and its native image library never weigh on the app's own install or CI.

The Poly Haven furniture was also converted to WebP textures at 512 or 1024 px, and the large plant was simplified. Do those by hand with gltf-transform's `webp`, `resize` and `simplify` commands, and only after looking at the result. Do not run gltf-transform's `optimize` command with its defaults: it can simplify meshes and resample animations without asking.

KTX2 textures would save graphics memory, but need a native encoder, a transcoder served from `public/`, and a renderer before any model starts loading. The textures are small enough that this is not worth it yet.

## Photo textures

Surface textures are 1K sets from Poly Haven or ambientCG.

- Colour maps for surfaces the game tints are turned grey, so the game's own colour sets the hue. They are downscaled to 1K or less.
- The office's sets also keep a packed ambient-occlusion, roughness and metalness map.
- Record each set's source, authors and processing in `frontend/public/textures/License.txt`.
- Only HD detail fetches them. Low quality never does.
