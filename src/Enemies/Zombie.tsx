import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import { CapsuleCollider, RigidBody, RapierRigidBody, useRapier } from '@react-three/rapier'
import { Group } from 'three'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useGameStore } from '../stores/useGameStore'
import { useVoiceStore } from '../stores/useVoiceStore'
import { AudioLoader, PositionalAudio } from 'three'

const RUN_SPEED = 3.6
const ATTACK_RANGE = 1.0

type ZombieState = 'idle' | 'run' | 'attack'

interface ZombieProps {
    spawnPoint: [number, number, number]
}

export function Zombie({ spawnPoint }: ZombieProps) {
    const bodyRef = useRef<RapierRigidBody>(null!)
    const modelRef = useRef<Group>(null)
    const { scene, animations } = useGLTF('/models/zombies/terror_engine_-_psycho_zombie.glb')
    const cloneScene = useMemo(() => clone(scene), [scene])
    const { actions } = useAnimations(animations, modelRef)
    const { rapier, world } = useRapier()
    const [currentState, setCurrentState] = useState<ZombieState>('idle')
    const attackStartRef = useRef<number | null>(null)
    const attackDurationRef = useRef<number>(1)
    const attackAppliedRef = useRef<boolean>(false)
    const attackLockUntilRef = useRef<number>(0) // timestamp in ms
    const attackClipDuration = useMemo(() => {
        const clip = animations.find(a => a.name.toLowerCase().includes('attack'))
        return clip?.duration || 1.167
    }, [animations])
    const zombieSoundRef = useRef<PositionalAudio | null>(null)

    // Helper to find actions by partial name (case insensitive)
    const findAction = (name: string) => {
        const clip = animations.find(a => a.name.toLowerCase().includes(name.toLowerCase()))
        return clip ? actions[clip.name] : null
    }

    const playState = (next: ZombieState) => {
        if (next === currentState) return
        const idle = findAction('idle') || actions[Object.keys(actions)[0]]
        const run = findAction('run')
        const attack = findAction('attack')

        const fade = (action: THREE.AnimationAction | null | undefined) => {
            if (action) action.reset().fadeIn(0.2).play()
        }
        // Fade out others
        Object.values(actions).forEach(act => {
            if (act) act.fadeOut(0.15)
        })

        if (next === 'idle') {
            attackStartRef.current = null
            attackAppliedRef.current = false
            fade(idle)
        }
        if (next === 'run') {
            attackStartRef.current = null
            attackAppliedRef.current = false
            fade(run || idle)
        }
        if (next === 'attack') {
            const now = performance.now()
            const clipDuration = attack?.getClip()?.duration || attackClipDuration
            if (now < attackLockUntilRef.current) return // prevent spam/restart while attack is active
            attackLockUntilRef.current = now + clipDuration * 1000

            attackStartRef.current = performance.now()
            attackAppliedRef.current = false
            attackDurationRef.current = clipDuration
            fade(attack || run || idle)
        }
        setCurrentState(next)
    }

    // Initial idle
    useEffect(() => {
        playState('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

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
            sound.setRefDistance(2.5)
            sound.setMaxDistance(28)
            sound.setRolloffFactor(1)
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

    useFrame(() => {
        const body = bodyRef.current
        if (!body) return

        // Current position
        const pos = body.translation()
        const origin = new rapier.Vector3(pos.x, pos.y + 0.4, pos.z)

        // Pick nearest player (includes self thanks to setLocalPlayerTransform)
        const players = useGameStore.getState().players as Record<string, { position: [number, number, number] }>
        const localId = useGameStore.getState().playerId
        const setPlayerDead = useGameStore.getState().setPlayerDead
        let nearest: { id: string, position: [number, number, number] } | null = null
        let minDist = Infinity

        Object.entries(players).forEach(([id, p]) => {
            const d = Math.hypot(
                p.position[0] - pos.x,
                p.position[1] - pos.y,
                p.position[2] - pos.z
            )
            if (d < minDist) {
                minDist = d
                nearest = { id, position: p.position }
            }
        })

        if (!nearest) {
            playState('idle')
            body.setLinvel({ x: 0, y: body.linvel().y, z: 0 }, true)
            return
        }

        const nearestTarget = nearest as { id: string, position: [number, number, number] }

        // Direction on XZ plane
        const targetPos = nearestTarget.position
        const target = new THREE.Vector3(targetPos[0], pos.y, targetPos[2])
        const dir = target.clone().sub(new THREE.Vector3(pos.x, pos.y, pos.z))
        const flatLen = Math.hypot(dir.x, dir.z)

        // Trigger attack when in range (death is applied mid-animation)
        if (flatLen < ATTACK_RANGE) {
            if (currentState !== 'attack') {
                playState('attack')
            } else if (attackStartRef.current === null) {
                // Ensure we still have a start time even if lock prevented a restart
                attackStartRef.current = performance.now()
                attackDurationRef.current = attackClipDuration
                attackAppliedRef.current = false
            }
            body.setLinvel({ x: 0, y: body.linvel().y, z: 0 }, true)
        } else {
            // Reset attack progress if we leave range
            attackStartRef.current = null
            attackAppliedRef.current = false
        }

        // Apply damage halfway through the attack animation if still in range
        if (
            attackStartRef.current !== null &&
            !attackAppliedRef.current
        ) {
            const elapsed = (performance.now() - attackStartRef.current) / 1000
            const triggerTime = attackDurationRef.current * 0.5
            if (elapsed >= triggerTime && flatLen < ATTACK_RANGE) {
                attackAppliedRef.current = true
                if (nearestTarget.id === localId && !useGameStore.getState().isPlayerDead) {
                    setPlayerDead(true)
                    if (document.pointerLockElement) document.exitPointerLock()
                }
            }
            // If animation finished with no hit, unlock to chase again
            if (elapsed >= attackDurationRef.current) {
                attackStartRef.current = null
                attackAppliedRef.current = false
            }
        }

        // Normalized forward direction
        dir.y = 0
        dir.normalize()

        // Obstacle avoidance: sample three rays (forward, 30° left/right) and pick the freest
        const sampleDirs = [
            dir.clone(),
            dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 6),
            dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 6),
        ]
        let bestDir = dir.clone()
        let bestScore = -Infinity
        sampleDirs.forEach(d => {
            const ray = new rapier.Ray(origin, new rapier.Vector3(d.x, 0, d.z))
            const hit = world.castRay(ray, 1.6, true) as any
            const score = hit ? hit.toi : 2 // farther is better
            if (score > bestScore) {
                bestScore = score
                bestDir = d
            }
        })

        const moveDir = bestDir.normalize()

        // Apply velocity
        body.setLinvel({
            x: moveDir.x * RUN_SPEED,
            y: body.linvel().y,
            z: moveDir.z * RUN_SPEED
        }, true)

        playState('run')

        // Rotate visual model toward movement direction
        if (modelRef.current && moveDir.lengthSq() > 0.0001) {
            const targetQuat = new THREE.Quaternion()
            targetQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(moveDir.x, moveDir.z))
            modelRef.current.quaternion.slerp(targetQuat, 0.2)
        }
    })

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
