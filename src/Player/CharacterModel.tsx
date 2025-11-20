import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
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
        // Helper to find animation by name (case insensitive, partial match)
        const findAction = (name: string) => {
            const clip = animations.find(a => a.name.toLowerCase().includes(name.toLowerCase()))
            return clip ? actions[clip.name] : null
        }

        // Robust fallback logic
        const runAction = findAction('run') || actions[Object.keys(actions)[2]] // Fallback to 3rd anim
        const walkAction = findAction('walk') || actions[Object.keys(actions)[1]] // Fallback to 2nd anim
        const idleAction = findAction('idle') || actions[Object.keys(actions)[0]] // Fallback to 1st anim

        // Reset all actions
        if (runAction) runAction.fadeOut(0.2)
        if (walkAction) walkAction.fadeOut(0.2)
        if (idleAction) idleAction.fadeOut(0.2)

        if (isMoving) {
            if (isRunning && runAction) {
                runAction.reset().fadeIn(0.2).play()
            } else if (walkAction) {
                walkAction.reset().fadeIn(0.2).play()
            } else if (runAction) {
                // Fallback to run if walk missing
                runAction.reset().fadeIn(0.2).play()
            }
        } else {
            if (idleAction) {
                idleAction.reset().fadeIn(0.2).play()
            }
        }

        return () => {
            // Cleanup
        }
    }, [isMoving, isRunning, actions, animations, characterIndex])

    useFrame((state) => {
        // Procedural Animation Fallback (if no animations found)
        if (animations.length === 0 && group.current) {
            if (isMoving) {
                // Bobbing and wobble when moving
                const speed = isRunning ? 15 : 10
                const amp = isRunning ? 0.1 : 0.05

                group.current.position.y = Math.sin(state.clock.elapsedTime * speed) * amp
                group.current.rotation.z = Math.cos(state.clock.elapsedTime * speed) * (amp * 0.5)
            } else {
                // Breathing idle
                group.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.02
                group.current.rotation.z = 0
            }
        }
    })

    return (
        <group ref={group} dispose={null}>
            <primitive object={cloneScene} />
        </group>
    )
}
