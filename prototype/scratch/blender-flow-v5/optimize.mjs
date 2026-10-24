import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { copyFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder
});
if(!existsSync('output/zibloo_flow_v5_source.glb'))
  await copyFile('output/zibloo_flow_v5.glb','output/zibloo_flow_v5_source.glb');
const doc=await io.read('output/zibloo_flow_v5_source.glb');
const before=doc.getRoot().listAnimations().map(animation=>({name:animation.getName(),channels:animation.listChannels().length}));
await doc.transform(dedup(),prune(),resample({tolerance:1e-4}),meshopt({encoder:MeshoptEncoder,level:'high',quantizeWeight:12}));
await io.write('output/zibloo_flow_v5.glb',doc);
const report={source_bytes:(await stat('output/zibloo_flow_v5_source.glb')).size,
  optimized_bytes:(await stat('output/zibloo_flow_v5.glb')).size,
  codec:'EXT_meshopt_compression',animation_tolerance:1e-4,animations:before};
await writeFile('output/optimization.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
