import { useEffect, useMemo, useRef } from 'react'
import { useAnimations, useGLTF } from '@react-three/drei'
import { CapsuleCollider, RigidBody, RapierRigidBody } from '@react-three/rapier'
import { Group } from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useVoiceStore } from '../stores/useVoiceStore'
import { AudioLoader, PositionalAudio } from 'three'

interface ZombieProps {
    spawnPoint: [number, number, number]
}

export function Zombie({ spawnPoint }: ZombieProps) {
    const bodyRef = useRef<RapierRigidBody>(null!)
    const modelRef = useRef<Group>(null)
    const { scene, animations } = useGLTF('/models/zombies/terror_engine_-_psycho_zombie.glb')
    const cloneScene = useMemo(() => clone(scene), [scene])
    const { actions } = useAnimations(animations, modelRef)
    const zombieSoundRef = useRef<PositionalAudio | null>(null)

    // Helper to find actions by partial name (case insensitive)
    const findAction = (name: string) => {
        const clip = animations.find(a => a.name.toLowerCase().includes(name.toLowerCase()))
        return clip ? actions[clip.name] : null
    }

    // Play idle animation on mount
    useEffect(() => {
        const idle = findAction('idle') || actions[Object.keys(actions)[0]]
        if (idle) {
            idle.reset().fadeIn(0.2).play()
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actions])

    // Looping zombie growl (positional)
    useEffect(() => {
        const listener = useVoiceStore.getState().audioListener
        if (!listener) return
        const loader = new AudioLoader()
        let disposed = false
        loader.load('/sounds/zombie/zombie sound.mp3', (buffer) => {
            if (disposed) return
            const sound = new PositionalAudio(listener)
            zombieSoundRef.current = sound
            sound.setBuffer(buffer)
            sound.setLoop(true)
            sound.setVolume(0.4)
            sound.setRefDistance(1.5)
            sound.setMaxDistance(10)
            sound.setRolloffFactor(2)
            if (modelRef.current) {
                modelRef.current.add(sound)
            }
            sound.play()
        })

        return () => {
            disposed = true
            if (zombieSoundRef.current) {
                zombieSoundRef.current.stop()
                zombieSoundRef.current.disconnect()
                zombieSoundRef.current = null
            }
        }
    }, [])

    return (
        <RigidBody
            ref={bodyRef}
            colliders={false}
            friction={0.5}
            mass={10}
            position={spawnPoint}
            enabledRotations={[false, false, false]}
        >
            <CapsuleCollider args={[0.5, 0.25]} />
            <group ref={modelRef} position={[0, -0.55, 0]} scale={0.5}>
                <primitive object={cloneScene} />
            </group>
        </RigidBody>
    )
}

useGLTF.preload('/models/zombies/terror_engine_-_psycho_zombie.glb')
