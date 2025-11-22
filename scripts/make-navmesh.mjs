#!/usr/bin/env node
/**
 * Generate navmesh GLB files from map GLBs.
 *
 * Maps supported:
 *   - snowy  : uses public/models/snowy_village_ps1_environment.glb
 *              keeps nodes matching /terreno|terreno_snow_0/i
 *              drops nodes containing tree/plant
 *   - tacos  : uses public/models/tacos (1).glb
 *              keeps nodes containing road|sidewalk|parking|asphalt
 *              drops nothing else (everything non-walkable is discarded)
 *
 * Usage: node scripts/make-navmesh.mjs [snowy|tacos]
 * Default: snowy
 */
import { NodeIO } from '@gltf-transform/core'
import { prune } from '@gltf-transform/functions'
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

    // Build parent map to preserve ancestors of kept nodes
    const parentMap = new Map()
    const scenes = doc.getRoot().listScenes()
    const stack = []
    scenes.forEach(scene => scene.listChildren().forEach(child => stack.push([child, null])))
    while (stack.length) {
        const [node, parent] = stack.pop()
        parentMap.set(node, parent)
        node.listChildren().forEach(child => stack.push([child, node]))
    }

    const keepSet = new Set()
    const nodes = doc.getRoot().listNodes()
    nodes.forEach(node => {
        const name = node.getName() || ''
        if (keep.some(re => re.test(name))) {
            let cur = node
            while (cur && !keepSet.has(cur)) {
                keepSet.add(cur)
                cur = parentMap.get(cur)
            }
        }
    })

    nodes.forEach(node => {
        const name = node.getName() || ''
        const dropByName = drop.some(re => re.test(name))
        if (dropByName) {
            node.dispose()
            return
        }
        if (!keepSet.has(node)) {
            node.dispose()
        }
    })

    await doc.transform(prune())
    fs.mkdirSync(path.dirname(output), { recursive: true })
    await io.write(output, doc)
    const kept = doc.getRoot().listNodes().map(n => n.getName())
    console.log(`[navmesh] written ${output} with nodes: ${kept.join(', ') || '(none)'}`)
}

build(cfg).catch(err => {
    console.error('[navmesh] failed:', err)
    process.exit(1)
})
