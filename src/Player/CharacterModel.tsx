import { useRef, useEffect, useMemo } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Group } from 'three'

interface CharacterModelProps {
    characterIndex?: number
    isMoving?: boolean
    isRunning?: boolean
}

export default function CharacterModel({ characterIndex = 1, isMoving = false, isRunning = false }: CharacterModelProps) {
    const group = useRef<Group>(null)
    const { scene, animations } = useGLTF(`/models/characters/character_${characterIndex}.glb`)

    // Clone scene for multiple instances
    const cloneScene = useMemo(() => clone(scene), [scene])
    const { actions } = useAnimations(animations, group)

    useEffect(() => {
        // Default animation names often found in Mixamo or standard rigs
        const runAction = actions['Run'] || actions['run'] || actions['Running'] || actions[Object.keys(actions)[2]] // Fallback to 3rd anim
        const walkAction = actions['Walk'] || actions['walk'] || actions['Walking'] || actions[Object.keys(actions)[1]] // Fallback to 2nd anim
        const idleAction = actions['Idle'] || actions['idle'] || actions[Object.keys(actions)[0]] // Fallback to 1st anim

        // Reset all actions
        if (runAction) runAction.fadeOut(0.2)
        if (walkAction) walkAction.fadeOut(0.2)
        if (idleAction) idleAction.fadeOut(0.2)

        if (isMoving) {
            if (isRunning && runAction) {
                runAction.reset().fadeIn(0.2).play()
            } else if (walkAction) {
                walkAction.reset().fadeIn(0.2).play()
            }
        } else {
            if (idleAction) {
                idleAction.reset().fadeIn(0.2).play()
            }
        }

        return () => {
            // Cleanup if needed, though fadeOut usually handles transitions
        }
    }, [isMoving, isRunning, actions])

    return (
        <group ref={group} dispose={null}>
            <primitive object={cloneScene} />
        </group>
    )
}
