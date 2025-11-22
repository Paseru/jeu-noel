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
        const currentPosVector = new THREE.Vector3(pos.x, pos.y, pos.z)
        const targetVector = new THREE.Vector3(targetPos[0], pos.y, targetPos[2])
        const dir = targetVector.clone().sub(currentPosVector)
        const flatLen = Math.hypot(dir.x, dir.z)

        // ---------------------------------------------------------
        // ATTACK LOGIC
        // ---------------------------------------------------------
        
        // If we are currently attacking, handle the animation/damage lifecycle
        if (currentState === 'attack') {
            // Look at player while attacking (optional, but good for realism)
            // dir is not normalized yet, but we can use it
            if (modelRef.current) {
                const lookDir = dir.clone().normalize()
                const targetQuat = new THREE.Quaternion()
                targetQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(lookDir.x, lookDir.z))
                modelRef.current.quaternion.slerp(targetQuat, 0.1)
            }

            // Stop movement
            body.setLinvel({ x: 0, y: body.linvel().y, z: 0 }, true)

            if (attackStartRef.current !== null) {
                const elapsed = (performance.now() - attackStartRef.current) / 1000
                
                // Attempt damage halfway through
                if (!attackAppliedRef.current && elapsed >= attackDurationRef.current * 0.4) {
                    // Check hit range (slightly forgiving)
                    if (flatLen < ATTACK_RANGE + 0.5) {
                        attackAppliedRef.current = true
                        if (nearestTarget.id === localId && !useGameStore.getState().isPlayerDead) {
                            setPlayerDead(true)
                            if (document.pointerLockElement) document.exitPointerLock()
                        }
                    }
                }

                // End attack when animation finishes
                if (elapsed >= attackDurationRef.current) {
                    playState('run')
                }
            }
            
            // Skip movement logic while attacking
            return
        }

        // Attempt to start attack if in range
        if (flatLen < ATTACK_RANGE) {
            playState('attack')
            // If we successfully switched to attack, return to stop movement logic for this frame
            // (We rely on the next frame to catch 'currentState === attack')
            // However, playState might fail due to lock. 
            // If it failed (still 'run' or 'idle'), we should probably stop or idle if we are VERY close.
            
            // Check if switch happened (using a small delay or just assuming logic holds)
            // Ideally playState would return success. 
            // Let's just verify state in next frame. But for this frame, if we are that close, stop moving.
            body.setLinvel({ x: 0, y: body.linvel().y, z: 0 }, true)
            return 
        }

        // ---------------------------------------------------------
        // MOVEMENT LOGIC
        // ---------------------------------------------------------
        playState('run')

        // Normalized forward direction
        dir.y = 0
        dir.normalize()

        // Obstacle avoidance: more rays for better navigation
        // Angles: 0, +/- 30, +/- 60
        const angles = [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3]
        let bestDir = dir.clone()
        let bestScore = -Infinity

        for (const angle of angles) {
            const testDir = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
            const ray = new rapier.Ray(origin, new rapier.Vector3(testDir.x, 0, testDir.z))
            // Cast ray slightly further to anticipate
            const hit = world.castRay(ray, 2.5, true) as any
            
            // Score: Higher is better.
            // If no hit, score is max (e.g. 10).
            // If hit, score is the distance (toi).
            // We penalize large angles slightly to prefer straight path if open.
            let distance = hit ? hit.toi : 3.0
            
            // Simple heuristic: Score = Distance - (AnglePenalty)
            // Angle penalty: 0 for straight, higher for sides.
            const anglePenalty = Math.abs(angle) * 0.5
            const score = distance - anglePenalty

            if (score > bestScore) {
                bestScore = score
                bestDir = testDir
            }
        }

        const moveDir = bestDir.normalize()

        // Apply velocity
        body.setLinvel({
            x: moveDir.x * RUN_SPEED,
            y: body.linvel().y,
            z: moveDir.z * RUN_SPEED
        }, true)

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
