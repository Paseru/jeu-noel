import * as THREE from 'three'
import { useGameStore } from '../stores/useGameStore'
import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { CapsuleCollider, RigidBody, RapierRigidBody, useRapier } from '@react-three/rapier'

const SPEED = 5
const RUN_SPEED = 8
const JUMP_FORCE = 8

export const PlayerController = () => {
    const { socket } = useGameStore()
    const body = useRef<RapierRigidBody>(null!)
    const [_, getKeys] = useKeyboardControls()
    const { camera } = useThree()
    const { rapier, world } = useRapier()

    // Head bobbing state
    const bobState = useRef(0)

    useFrame((_state, delta) => {
        if (!body.current) return

        const { forward, backward, left, right, jump, run } = getKeys()

        const velocity = body.current.linvel()
        const translation = body.current.translation()

        // Movement Logic
        const frontVector = new THREE.Vector3(
            0,
            0,
            (backward ? 1 : 0) - (forward ? 1 : 0)
        )
        const sideVector = new THREE.Vector3(
            (left ? 1 : 0) - (right ? 1 : 0),
            0,
            0
        )
        const direction = new THREE.Vector3()

        direction
            .subVectors(frontVector, sideVector)
            .normalize()
            .multiplyScalar(run ? RUN_SPEED : SPEED)
            .applyEuler(camera.rotation)

        body.current.setLinvel({ x: direction.x, y: velocity.y, z: direction.z }, true)

        // Head Bobbing
        const isMoving = direction.length() > 0.1
        if (isMoving) {
            bobState.current += delta * (run ? 15 : 10)
        } else {
            bobState.current = 0
        }

        const bobOffset = isMoving ? Math.sin(bobState.current) * 0.1 : 0

        // Camera follow with bobbing
        camera.position.set(translation.x, translation.y + 0.8 + bobOffset, translation.z)

        // Socket Update
        if (socket) {
            socket.emit('playerMove', {
                position: [translation.x, translation.y, translation.z],
                rotation: [camera.rotation.x, camera.rotation.y, camera.rotation.z]
            })
        }

        // Jump Logic
        if (jump) {
            // Simple ground check: raycast down
            const origin = body.current.translation()
            origin.y -= 0.65 // Start slightly below center
            const ray = new rapier.Ray(origin, { x: 0, y: -1, z: 0 })
            const hit = world.castRay(ray, 0.5, true)

            // Only jump if grounded AND not already moving up fast (prevents double jump / flying)
            if (hit && hit.timeOfImpact < 0.2 && Math.abs(velocity.y) < 0.5) {
                body.current.setLinvel({ x: velocity.x, y: JUMP_FORCE, z: velocity.z }, true)
            }
        }
    })

    return (
        <RigidBody
            ref={body}
            colliders={false}
            mass={1}
            type="dynamic"
            position={[0, 10, 0]}
            enabledRotations={[false, false, false]}
            friction={0}
        >
            <CapsuleCollider args={[0.5, 0.3]} />
        </RigidBody>
    )
}
