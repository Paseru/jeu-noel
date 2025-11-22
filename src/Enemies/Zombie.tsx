import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import { CapsuleCollider, RigidBody, RapierRigidBody, useRapier } from '@react-three/rapier'
import { Group } from 'three'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useGameStore } from '../stores/useGameStore'

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

        if (next === 'idle') fade(idle)
        if (next === 'run') fade(run || idle)
        if (next === 'attack') fade(attack || run || idle)
        setCurrentState(next)
    }

    // Initial idle
    useEffect(() => {
        playState('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

        // Trigger damage only when actually in range
        if (flatLen < ATTACK_RANGE) {
            playState('attack')
            body.setLinvel({ x: 0, y: body.linvel().y, z: 0 }, true)
            if (nearestTarget.id === localId && !useGameStore.getState().isPlayerDead) {
                setPlayerDead(true)
                if (document.pointerLockElement) document.exitPointerLock()
            }
            return
        }

        // Normalized forward direction
        dir.y = 0
        dir.normalize()

        // Simple obstacle avoidance: raycast forward, then left/right if blocked
        const desired = new rapier.Vector3(dir.x, 0, dir.z)
        const forwardRay = new rapier.Ray(origin, desired)
        const forwardHit = world.castRay(forwardRay, 0.9, true) as any

        let moveDir = dir.clone()

        if (forwardHit && forwardHit.toi < 0.9) {
            const left = new THREE.Vector3(-dir.z, 0, dir.x).normalize()
            const right = new THREE.Vector3(dir.z, 0, -dir.x).normalize()

            const leftHit = world.castRay(new rapier.Ray(origin, new rapier.Vector3(left.x, 0, left.z)), 0.9, true) as any
            const rightHit = world.castRay(new rapier.Ray(origin, new rapier.Vector3(right.x, 0, right.z)), 0.9, true) as any

            if (!leftHit && rightHit) moveDir = left
            else if (!rightHit && leftHit) moveDir = right
            else if (!leftHit && !rightHit) moveDir = Math.random() > 0.5 ? left : right
            // if both blocked, keep original dir (it will push softly)
        }

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
