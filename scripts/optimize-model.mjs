// Shrinks a .glb for the web: merges duplicate textures, re-encodes them as
// WebP at most 1024px, welds shared vertices, and compresses
// the geometry with meshopt (decoded in the browser by three's MeshoptDecoder).
//
//   node scripts/optimize-model.mjs media-source/models/ISS_stationary.glb public/models/iss.glb

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  prune,
  weld,
  quantize,
  meshopt,
  textureCompress,
  resample,
  flatten,
} from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import sharp from "sharp";
import { statSync } from "node:fs";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: node scripts/optimize-model.mjs <in.glb> <out.glb>");
  process.exit(1);
}

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });

const doc = await io.read(input);
await doc.transform(
  dedup(),
  flatten(),
  weld(),
  resample(),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024], quality: 82 }),
  quantize(),
  meshopt({ encoder: MeshoptEncoder, level: "medium" }),
);
await io.write(output, doc);

const mb = (p) => (statSync(p).size / 1e6).toFixed(1) + " MB";
console.log(`${input} ${mb(input)} -> ${output} ${mb(output)}`);
