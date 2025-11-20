import * as THREE from 'three'
import { useGameStore } from '../stores/useGameStore'
import { useRef, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { CapsuleCollider, RigidBody, RapierRigidBody, useRapier } from '@react-three/rapier'

const SPEED = 5
const RUN_SPEED = 8
const JUMP_FORCE = 8

import CharacterModel from './CharacterModel'

export const PlayerController = () => {
    const { socket } = useGameStore()
    const body = useRef<RapierRigidBody>(null!)
    const [subscribeKeys, getKeys] = useKeyboardControls()
    const { camera } = useThree()
    const { rapier, world } = useRapier()

    // Head bobbing state
    const bobState = useRef(0)

    // Random character index (1-5)
    const characterIndex = useRef(Math.floor(Math.random() * 5) + 1)

    // Camera Mode
    const [cameraMode, setCameraMode] = useState<'FIRST' | 'THIRD'>('FIRST')
    const [isMoving, setIsMoving] = useState(false)
    const [isRunning, setIsRunning] = useState(false)

    // Initialize player on server
    useEffect(() => {
        if (socket) {
            socket.emit('initPlayer', { characterIndex: characterIndex.current })
        }
    }, [socket])

    // Toggle View
    useEffect(() => {
        const unsubscribe = subscribeKeys(
            (state) => state.toggleView,
            (value) => {
                if (value) {
                    setCameraMode((prev) => (prev === 'FIRST' ? 'THIRD' : 'FIRST'))
                }
            }
        )
        return unsubscribe
    }, [subscribeKeys])

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

        // Update Animation State
        const moving = direction.length() > 0.1
        setIsMoving(moving)
        setIsRunning(run)

        // Head Bobbing (Only in First Person)
        if (cameraMode === 'FIRST') {
            if (moving) {
                bobState.current += delta * (run ? 15 : 10)
            } else {
                bobState.current = 0
            }
            const bobOffset = moving ? Math.sin(bobState.current) * 0.1 : 0
            camera.position.set(translation.x, translation.y + 0.8 + bobOffset, translation.z)
        } else {
            // Third Person Camera
            // Position camera behind and above player
            // We need to calculate the position based on camera rotation? 
            // Or just fixed offset relative to player?
            // Usually 3rd person camera rotates around player.
            // For now, let's keep the camera controls (PointerLock) but offset the position.
            // PointerLockControls rotates the camera object itself.
            // So we might need to detach camera from direct player position set.

            // Actually, PointerLockControls controls the camera rotation.
            // If we set camera.position, we move the camera.
            // To get a 3rd person view where we look AT the player, we need to:
            // 1. Calculate offset vector (e.g. [0, 2, 4])
            // 2. Rotate this offset by the camera's horizontal rotation (yaw).
            // 3. Add to player position.

            // Simple approach:
            // Just offset backwards relative to camera's current forward direction.
            const offset = new THREE.Vector3(0, 0, 4) // 4 units back
            offset.applyQuaternion(camera.quaternion)
            offset.y = 2 // Force height

            // This makes the camera follow the rotation.
            // But we want to see the player.
            // If we use PointerLock, the camera rotates.
            // If we offset BACK from where the camera is looking, we look at the player.

            // const cameraOffset = new THREE.Vector3(0, 2, 5)
            // We want the camera to be at playerPos + offset rotated by player rotation?
            // But player doesn't rotate, camera does.

            // Let's try: Position camera at player + offset.
            // But we need to rotate the offset based on where we are looking.
            // Actually, if we use PointerLock, `camera.rotation` is controlled by mouse.
            // We want the camera to orbit? Or just follow?
            // If we want standard FPS-like 3rd person (like WoW/Fortnite):
            // The camera is at a distance behind the "pivot".
            // The pivot is the player.

            // Let's calculate the position behind the player based on camera's yaw.
            // But `camera.rotation` includes pitch (looking up/down).

            // Simplified:
            // 1. Get camera forward vector (ignoring Y for movement direction).
            // 2. Place camera behind player.

            // Actually, simpler:
            // Just set camera position to player position + offset.
            // But then rotating mouse rotates camera around its own axis, not around player.
            // PointerLockControls rotates the camera object.

            // To make 3rd person work well with PointerLockControls, we usually need a rig.
            // But let's try a simple offset logic:
            // We want the camera to look AT the player.
            // But PointerLock rotates the camera.
            // So if we look left, the camera rotates left.
            // If we are behind the player, looking left means looking away from player?
            // No, usually "looking left" means rotating the camera around the player.

            // This is complex to do with just `camera.position.set` and `PointerLockControls`.
            // `PointerLockControls` assumes 1st person (camera is the pivot).

            // Alternative:
            // When in 3rd person, we render the character at `translation`.
            // We calculate camera position:
            // `camera.position.copy(translation).add(offset)`
            // But `offset` needs to rotate with mouse.
            // `PointerLockControls` rotates the camera.
            // So `camera.getWorldDirection()` gives us where we are looking.
            // If we want to look AT the player, we should be in the opposite direction of "forward".

            const forward = new THREE.Vector3(0, 0, -1)
            forward.applyQuaternion(camera.quaternion)
            forward.y = 0 // Keep horizontal
            forward.normalize()

            const targetCamPos = new THREE.Vector3(translation.x, translation.y + 2, translation.z)
            targetCamPos.addScaledVector(forward, -4) // Move back 4 units

            // We also need to adjust for pitch (looking down should move camera up/forward?)
            // Let's stick to simple horizontal follow for now to avoid clipping into ground.

            // Wait, if we update camera.position every frame, PointerLockControls might fight it?
            // No, PointerLockControls updates rotation. We update position.

            camera.position.lerp(targetCamPos, 0.2) // Smooth follow
        }

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

            {/* Local Character Model (Only visible in 3rd person) */}
            {cameraMode === 'THIRD' && (
                <group position={[0, -0.8, 0]}> {/* Adjust height to match collider */}
                    <CharacterModel
                        characterIndex={characterIndex.current}
                        isMoving={isMoving}
                        isRunning={isRunning}
                    />
                </group>
            )}
        </RigidBody>
    )
}
