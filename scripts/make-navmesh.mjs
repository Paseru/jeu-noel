#!/usr/bin/env node
/**
 * Generate navmesh GLB files from map GLBs by carving walkable surfaces
 * and removing triangles that sit under obstacles.
 *
 * Maps supported:
 *   - snowy  : public/models/snowy_village_ps1_environment.glb
 *              walkable names: terreno/terreno_snow_0
 *              drop: tree/plant
 *   - tacos  : public/models/tacos (1).glb
 *              walkable names: road/sidewalk/parking/asphalt
 *              obstacles: everything else
 *
 * Usage: node scripts/make-navmesh.mjs [snowy|tacos]
 * Default: snowy
 */
import { Document, NodeIO } from '@gltf-transform/core'
import { flatten, getBounds, prune } from '@gltf-transform/functions'
import path from 'node:path'
import fs from 'node:fs'

const CONFIGS = {
    snowy: {
        input: 'public/models/snowy_village_ps1_environment.glb',
        output: 'public/navmesh/navmesh.glb',
        keep: [/terreno_snow_0/i, /\bterreno\b/i],
        drop: [/tree/i, /plant/i]
    },
    tacos: {
        input: 'public/models/tacos (1).glb',
        output: 'public/navmesh/navmesh_tacos.glb',
        keep: [/road/i, /sidewalk/i, /parking/i, /asphalt/i],
        drop: [] // obstacles = tout le reste
    }
}

const mapName = (process.argv[2] || 'snowy').toLowerCase()
const cfg = CONFIGS[mapName]
if (!cfg) {
    console.error(`Unknown map "${mapName}". Use one of: ${Object.keys(CONFIGS).join(', ')}`)
    process.exit(1)
}

async function build({ input, output, keep, drop }) {
    if (!fs.existsSync(input)) {
        console.error(`[navmesh] input file not found: ${input}`)
        process.exit(1)
    }

    const io = new NodeIO()
    const doc = await io.read(input)

    // Bake transforms so geometry is in world space
    await doc.transform(flatten())

    const nodes = doc.getRoot().listNodes()

    // Collect obstacle AABBs (everything non-walkable, non-dropped)
    const obstacleBounds = []
    nodes.forEach(node => {
        const name = node.getName() || ''
        if (drop.some(re => re.test(name))) return
        const isWalkable = keep.some(re => re.test(name))
        if (isWalkable) return
        if (!node.getMesh()) return
        const bounds = getBounds(node)
        if (bounds) obstacleBounds.push(bounds)
    })

    // Collect walkable triangles, culling those whose centroid is inside an obstacle AABB
    const outPositions = []
    const outIndices = []
    let vIndex = 0
    const margin = 0.35 // extra clearance around obstacles

    const isInsideObstacle = (p) => {
        for (const b of obstacleBounds) {
            if (
                p[0] >= b.min[0] - margin && p[0] <= b.max[0] + margin &&
                p[1] >= b.min[1] - margin && p[1] <= b.max[1] + margin &&
                p[2] >= b.min[2] - margin && p[2] <= b.max[2] + margin
            ) return true
        }
        return false
    }

    nodes.forEach(node => {
        const name = node.getName() || ''
        if (!keep.some(re => re.test(name))) return
        const mesh = node.getMesh()
        if (!mesh) return
        mesh.listPrimitives().forEach(prim => {
            const posAttr = prim.getAttribute('POSITION')
            if (!posAttr) return
            const idxAttr = prim.getIndices()
            const posArr = posAttr.getArray()
            const idxArr = idxAttr ? Array.from(idxAttr.getArray()) : [...Array(posAttr.getCount()).keys()]
            for (let i = 0; i < idxArr.length; i += 3) {
                const i0 = idxArr[i] * 3
                const i1 = idxArr[i + 1] * 3
                const i2 = idxArr[i + 2] * 3
                const c0 = [posArr[i0], posArr[i0 + 1], posArr[i0 + 2]]
                const c1 = [posArr[i1], posArr[i1 + 1], posArr[i1 + 2]]
                const c2 = [posArr[i2], posArr[i2 + 1], posArr[i2 + 2]]
                const centroid = [
                    (c0[0] + c1[0] + c2[0]) / 3,
                    (c0[1] + c1[1] + c2[1]) / 3,
                    (c0[2] + c1[2] + c2[2]) / 3
                ]
                if (isInsideObstacle(centroid)) continue
                outPositions.push(...c0, ...c1, ...c2)
                outIndices.push(vIndex, vIndex + 1, vIndex + 2)
                vIndex += 3
            }
        })
    })

    // Build minimal doc with one mesh/primitive
    const outDoc = new Document()
    const buffer = outDoc.createBuffer('navmesh-buffer')
    const prim = outDoc.createPrimitive()
    prim.setAttribute('POSITION', outDoc.createAccessor()
        .setType('VEC3')
        .setArray(new Float32Array(outPositions))
        .setBuffer(buffer)
    )
    prim.setIndices(outDoc.createAccessor()
        .setArray(outIndices.length > 65535 ? new Uint32Array(outIndices) : new Uint16Array(outIndices))
        .setBuffer(buffer)
    )

    const mesh = outDoc.createMesh('NavMesh').addPrimitive(prim)
    const node = outDoc.createNode('NavMesh').setMesh(mesh)
    outDoc.createScene('Scene').addChild(node)

    await outDoc.transform(prune())

    fs.mkdirSync(path.dirname(output), { recursive: true })
    await io.write(output, outDoc)

    console.log(`[navmesh] written ${output} triangles=${outIndices.length / 3} obstacles=${obstacleBounds.length}`)
}

build(cfg).catch(err => {
    console.error('[navmesh] failed:', err)
    process.exit(1)
})
