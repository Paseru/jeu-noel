import * as THREE from 'three'
import { useGameStore } from '../stores/useGameStore'
import { useVoiceStore } from '../stores/useVoiceStore'
import { useRef, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useKeyboardControls, PointerLockControls } from '@react-three/drei'
import { CapsuleCollider, RigidBody, RapierRigidBody, useRapier } from '@react-three/rapier'

const SPEED = 3.2
const RUN_SPEED = 6
const JUMP_FORCE = 6

import CharacterModel from './CharacterModel'

interface PlayerControllerProps {
    isSettingsOpen: boolean
}

export const PlayerController = ({ isSettingsOpen }: PlayerControllerProps) => {
    const { socket, phase, isChatOpen, mobileInput, resetLookDelta } = useGameStore()
    const body = useRef<RapierRigidBody>(null!)
    const [subscribeKeys, getKeys] = useKeyboardControls()
    const { camera } = useThree()
    const { rapier, world } = useRapier()

    // Reference to the character mesh group for rotation
    const characterRef = useRef<THREE.Group>(null)

    // Head bobbing state
    const bobState = useRef(0)

    // Random character index (1-5)
    const characterIndex = useRef(1)

    // Network throttling
    const lastEmitTime = useRef(0)

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

    const setAudioListener = useVoiceStore((state) => state.setAudioListener)

    // Audio Listener (The "Ears" of the player)
    useEffect(() => {
        const listener = new THREE.AudioListener()
        camera.add(listener)
        setAudioListener(listener)
        return () => {
            camera.remove(listener)
            setAudioListener(null)
        }
    }, [camera, setAudioListener])

    // Toggle View
    useEffect(() => {
        const unsubscribe = subscribeKeys(
            (state) => state.toggleView,
            (value) => {
                if (value && !isChatOpen) {
                    setCameraMode((prev) => (prev === 'FIRST' ? 'THIRD' : 'FIRST'))
                }
            }
        )
        return unsubscribe
    }, [subscribeKeys, isChatOpen])

    // Jump Logic
    const lastJumpTime = useRef(0)

    useFrame((_state, delta) => {
        if (!body.current) return

        const keys = getKeys()
        // Disable movement if chat is open
        const { forward, backward, left, right, jump, run } = isChatOpen
            ? { forward: false, backward: false, left: false, right: false, jump: false, run: false }
            : keys

        const { joystick, lookDelta } = mobileInput

        const velocity = body.current.linvel()
        const translation = body.current.translation()

        // Movement Logic
        const sideVector = new THREE.Vector3(
            (left ? 1 : 0) - (right ? 1 : 0) - joystick.x,
            0,
            0
        )
        const frontVector = new THREE.Vector3(
            0,
            0,
            (backward ? 1 : 0) - (forward ? 1 : 0) + joystick.y
        )
        const direction = new THREE.Vector3()

        direction
            .subVectors(frontVector, sideVector)
            .normalize()
            .multiplyScalar(run ? RUN_SPEED : SPEED)
            .applyEuler(camera.rotation) // Use camera for direction so it's responsive

        body.current.setLinvel({ x: direction.x, y: velocity.y, z: direction.z }, true)

        // Apply Camera Rotation from Touch
        if (lookDelta.x !== 0 || lookDelta.y !== 0) {
            const SENSITIVITY = 0.002
            camera.rotation.y -= lookDelta.x * SENSITIVITY
            // Clamp pitch? For now just simple yaw/pitch
            // Actually, PointerLockControls usually handles this.
            // If we are using PointerLockControls, we might fight it.
            // But on mobile, PointerLockControls might not be active or we might need to manually rotate the camera object.
            // Let's try modifying camera.rotation directly first.

            // Note: PointerLockControls modifies camera.rotation.

            resetLookDelta()
        }

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

            // First person: Camera matches player position
            camera.position.set(translation.x, translation.y + 1 + bobOffset, translation.z)
        } else {
            // Third Person Camera (Orbit)
            // 1. Get the camera's current rotation (controlled by PointerLockControls)
            // 2. Calculate the "backward" vector relative to where we are looking
            const cameraDirection = new THREE.Vector3(0, 0, -1)
            cameraDirection.applyQuaternion(camera.quaternion) // Use camera for responsive orbit
            cameraDirection.normalize()

            // 3. Position camera behind the player
            // Distance: 3 units (Requested)
            // Height: 1.4 units (Lowered to look more "at" the character)
            // Offset: 0 unit (Centered)
            const cameraDist = 2
            const cameraHeight = 1.4
            const rightOffset = 0

            const rightVector = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)

            const targetPos = new THREE.Vector3(
                translation.x - cameraDirection.x * cameraDist + rightVector.x * rightOffset,
                translation.y + cameraHeight,
                translation.z - cameraDirection.z * cameraDist + rightVector.z * rightOffset
            )

            // Optional: Raycast to prevent camera clipping through walls?
            // For now, simple lerp
            camera.position.lerp(targetPos, 0.2) // Slightly faster position follow than rotation to prevent drift
        }

        // Character Rotation (Face movement direction)
        if (cameraMode === 'THIRD' && isMoving) {
            // Calculate angle from velocity
            const angle = Math.atan2(velocity.x, velocity.z)
            // We need to rotate the character mesh, not the RigidBody (which is locked)
            // We can use a ref for the character group
            if (characterRef.current) {
                // Smooth rotation
                const targetRotation = new THREE.Quaternion()
                targetRotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle)
                characterRef.current.quaternion.slerp(targetRotation, 0.2)
            }
        }

        // Socket Update (Throttled to ~120Hz)
        const now = Date.now()
        if (socket && now - lastEmitTime.current > 8) { // ~120 updates per second
            lastEmitTime.current = now

            // Calculate rotation to send (Quaternion)
            let quaternionToSend = [0, 0, 0, 1]
            if (cameraMode === 'THIRD' && characterRef.current) {
                // In 3rd person, send the character's quaternion directly
                const q = characterRef.current.quaternion
                quaternionToSend = [q.x, q.y, q.z, q.w]
            } else {
                // In 1st person, use Camera Direction (Forward Vector)
                // This avoids Gimbal Lock and Euler angle flipping issues
                const direction = new THREE.Vector3()
                camera.getWorldDirection(direction)
                direction.y = 0 // Flatten to XZ plane
                direction.normalize()

                const angle = Math.atan2(direction.x, direction.z)
                const q = new THREE.Quaternion()
                q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle)

                quaternionToSend = [q.x, q.y, q.z, q.w]
            }

            socket.emit('playerMove', {
                position: [translation.x, translation.y, translation.z],
                quaternion: quaternionToSend,
                isMoving: moving,
                isRunning: run
            })
        }

        // Jump Logic
        if (jump) {
            const now = Date.now()
            if (now - lastJumpTime.current > 1000) { // 1 second cooldown
                // Simple ground check: raycast down
                const origin = body.current.translation()
                origin.y -= 0.65 // Start slightly below center
                const ray = new rapier.Ray(origin, { x: 0, y: -1, z: 0 })
                const hit = world.castRay(ray, 0.5, true)

                // Only jump if grounded AND not already moving up fast (prevents double jump / flying)
                if (hit && hit.timeOfImpact < 0.2 && Math.abs(velocity.y) < 0.5) {
                    body.current.setLinvel({ x: velocity.x, y: JUMP_FORCE, z: velocity.z }, true)
                    lastJumpTime.current = now
                }
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

            {/* Controls: Only active if settings are CLOSED and we are PLAYING and Chat is CLOSED */}
            {!isSettingsOpen && !isChatOpen && phase === 'PLAYING' && (
                <PointerLockControls />
            )}

            {/* Local Character Model (Only visible in 3rd person) */}
            {cameraMode === 'THIRD' && (
                <group ref={characterRef} position={[0, -0.8, 0]}> {/* Adjust height to match collider */}
                    <CharacterModel
                        characterIndex={characterIndex.current}
                        isMoving={isMoving}
                        isRunning={isRunning}
                        showNameplate={false}
                    />
                </group>
            )}
        </RigidBody>
    )
}
