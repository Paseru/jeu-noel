#!/usr/bin/env node
import { NodeIO, Document, Buffer as GltfBuffer, Accessor, Primitive, Mesh, Scene, Node } from '@gltf-transform/core';
import Recast from 'recast-detour';
import path from 'path';
import fs from 'fs';

const input = process.argv[2] || 'public/models/snowyvillagenavmesh.glb';
const output = process.argv[3] || 'public/navmesh/navmesh_snowy_village.glb';

async function main() {
  const io = new NodeIO();
  const doc = await io.read(input);
  const positions = [];
  const indices = [];
  let vertexOffset = 0;

  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const posArr = Array.from(pos.getArray());
      // collect positions
      for (let i = 0; i < posArr.length; i++) positions.push(posArr[i]);

      const idx = prim.getIndices();
      if (idx) {
        const idxArr = Array.from(idx.getArray());
        for (let i = 0; i < idxArr.length; i++) indices.push(idxArr[i] + vertexOffset);
      } else {
        // assume triangles sequential
        const triCount = pos.getCount();
        for (let i = 0; i < triCount; i++) indices.push(vertexOffset + i);
      }
      vertexOffset += pos.getCount();
    }
  }

  if (positions.length === 0 || indices.length === 0) {
    console.error('No geometry found in input');
    process.exit(1);
  }

  // compute bounds
  const bmin = [Infinity, Infinity, Infinity];
  const bmax = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i+1], z = positions[i+2];
    if (x < bmin[0]) bmin[0] = x;
    if (y < bmin[1]) bmin[1] = y;
    if (z < bmin[2]) bmin[2] = z;
    if (x > bmax[0]) bmax[0] = x;
    if (y > bmax[1]) bmax[1] = y;
    if (z > bmax[2]) bmax[2] = z;
  }

  // Recast params (tuned for human-sized agent ~1.6m height, 0.25m radius)
  const cs = 0.15; // cell size
  const ch = 0.08; // cell height
  const walkableSlopeAngle = 45;
  const walkableHeight = Math.ceil(1.6 / ch);
  const walkableClimb = Math.ceil(0.4 / ch);
  const walkableRadius = Math.ceil(0.25 / cs);
  const maxEdgeLen = Math.floor(12 / cs);
  const maxSimplificationError = 1.3;
  const minRegionArea = 20; // (2m * 2m) expressed in polys
  const mergeRegionArea = 40;
  const maxVertsPerPoly = 6;
  const detailSampleDist = 6;
  const detailSampleMaxError = 1;

  const width = Math.ceil((bmax[0] - bmin[0]) / cs);
  const height = Math.ceil((bmax[2] - bmin[2]) / cs);

  const recast = await Recast();
  const navMesh = new recast.NavMesh();
  const cfg = new recast.rcConfig();
  cfg.cs = cs;
  cfg.ch = ch;
  cfg.width = width;
  cfg.height = height;
  cfg.walkableSlopeAngle = walkableSlopeAngle;
  cfg.walkableHeight = walkableHeight;
  cfg.walkableClimb = walkableClimb;
  cfg.walkableRadius = walkableRadius;
  cfg.maxEdgeLen = maxEdgeLen;
  cfg.maxSimplificationError = maxSimplificationError;
  cfg.minRegionArea = minRegionArea;
  cfg.mergeRegionArea = mergeRegionArea;
  cfg.maxVertsPerPoly = maxVertsPerPoly;
  cfg.detailSampleDist = detailSampleDist;
  cfg.detailSampleMaxError = detailSampleMaxError;
  cfg.bmin = new recast.Vec3(bmin[0], bmin[1], bmin[2]);
  cfg.bmax = new recast.Vec3(bmax[0], bmax[1], bmax[2]);

  navMesh.build(new Float32Array(positions), positions.length/3, new Int32Array(indices), indices.length, cfg);

  const debug = navMesh.getDebugNavMesh();
  const triCount = debug.getTriangleCount();
  const outPositions = new Float32Array(triCount * 3 * 3);
  const outIndices = new Uint32Array(triCount * 3);

  for (let i = 0; i < triCount; i++) {
    const tri = debug.getTriangle(i);
    for (let p = 0; p < 3; p++) {
      const v = tri.getPoint(p);
      const dstIdx = i*9 + p*3;
      outPositions[dstIdx] = v.x;
      outPositions[dstIdx+1] = v.y;
      outPositions[dstIdx+2] = v.z;
      outIndices[i*3 + p] = i*3 + p;
    }
  }

  // Build GLB
  const outDoc = new Document();
  const buffer = outDoc.createBuffer('buffer');
  const positionAccessor = outDoc.createAccessor('POSITION')
    .setType('VEC3')
    .setArray(outPositions)
    .setBuffer(buffer);
  const indexAccessor = outDoc.createAccessor('INDICES')
    .setType('SCALAR')
    .setArray(outIndices)
    .setBuffer(buffer);

  const prim = outDoc.createPrimitive()
    .setAttribute('POSITION', positionAccessor)
    .setIndices(indexAccessor);
  const mesh = outDoc.createMesh('NavMesh').addPrimitive(prim);
  const node = outDoc.createNode('NavMesh').setMesh(mesh);
  outDoc.createScene('Scene').addChild(node);

  fs.mkdirSync(path.dirname(output), { recursive: true });
  const arrayBuffer = await new NodeIO().writeBinary(outDoc);
  fs.writeFileSync(output, Buffer.from(arrayBuffer));
  console.log(`Navmesh baked: ${triCount} tris -> ${output}`);
}

main().catch((err)=>{
  console.error(err);
  process.exit(1);
});
