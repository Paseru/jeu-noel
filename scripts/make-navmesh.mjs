#!/usr/bin/env node
/**
 * Build a minimal navmesh GLB by keeping only walkable meshes from the scene.
 * Walkable rule (for the Snowy map):
 *   - keep nodes whose name contains "terreno_snow_0" (case-insensitive)
 *   - optionally you can extend KEEP_NAMES below.
 * Everything else is dropped. Obstacles (pillars, rocks, etc.) are NOT baked into
 * the navmesh here; they will be avoided at runtime by local avoidance.
 */
import { NodeIO } from '@gltf-transform/core'
import { prune } from '@gltf-transform/functions'
import path from 'node:path'
import fs from 'node:fs'

const INPUT = 'public/models/snowy_village_ps1_environment.glb'
const OUTPUT = 'public/navmesh/navmesh.glb'

const KEEP_MATCH = [/terreno_snow_0/i, /\bterreno\b/i]
// ignore meshes containing these substrings entirely (foliage)
const DROP_MATCH = [/tree/i, /plant/i]

async function main() {
    if (!fs.existsSync(INPUT)) {
        console.error(`[navmesh] input file not found: ${INPUT}`)
        process.exit(1)
    }

    const io = new NodeIO()
    const doc = await io.read(INPUT)

    const nodes = doc.getRoot().listNodes()

    // Build parent map (scene graph traversal)
    const parentMap = new Map()
    const scenes = doc.getRoot().listScenes()
    const stack = []
    scenes.forEach(scene => {
        scene.listChildren().forEach(child => stack.push([child, null]))
    })
    while (stack.length) {
        const [node, parent] = stack.pop()
        parentMap.set(node, parent)
        node.listChildren().forEach(child => stack.push([child, node]))
    }

    const keepSet = new Set()
    nodes.forEach(node => {
        const name = node.getName() || ''
        if (KEEP_MATCH.some(re => re.test(name))) {
            // keep node and its ancestors so it stays attached to the scene
            let cur = node
            while (cur && !keepSet.has(cur)) {
                keepSet.add(cur)
                cur = parentMap.get(cur)
            }
        }
    })

    nodes.forEach((node) => {
        const name = node.getName() || ''
        const dropByName = DROP_MATCH.some(re => re.test(name))
        if (dropByName) {
            node.dispose()
            return
        }
        if (!keepSet.has(node)) {
            node.dispose()
        }
    })

    // Remove dangling resources
    await doc.transform(prune())

    // Ensure output dir exists
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })

    await io.write(OUTPUT, doc)
    const kept = doc.getRoot().listNodes().map(n => n.getName())
    console.log(`[navmesh] written ${OUTPUT} with nodes: ${kept.join(', ') || '(none)'}`)
}

main().catch((err) => {
    console.error('[navmesh] failed:', err)
    process.exit(1)
})
