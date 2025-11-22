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
const FLY_SPEED = 15 // Faster speed for flying

import CharacterModel from './CharacterModel'

interface PlayerControllerProps {
    isSettingsOpen: boolean
}

export const PlayerController = ({ isSettingsOpen }: PlayerControllerProps) => {
    const { socket, phase, isChatOpen, mobileInput, resetLookDelta, addChatMessage } = useGameStore()
    const body = useRef<RapierRigidBody>(null!)
    const [subscribeKeys, getKeys] = useKeyboardControls()
    const { camera } = useThree()
    const { rapier, world } = useRapier()

    // Reference to the character mesh group for rotation
    const characterRef = useRef<THREE.Group>(null)

    // Head bobbing state
    const bobState = useRef(0)

    // Character Index from Server
    const characterIndex = useGameStore((state) => state.myCharacterIndex)

    // Network throttling
    const lastEmitTime = useRef(0)

    // Camera Mode
    const [cameraMode, setCameraMode] = useState<'FIRST' | 'THIRD'>('FIRST')
    const [isMoving, setIsMoving] = useState(false)
    const [isRunning, setIsRunning] = useState(false)
    const mapLoaded = useGameStore((state) => state.mapLoaded)
    const wasMapLoaded = useRef(false)

    // Debug / Fly Mode
    const [flyMode, setFlyMode] = useState(false)

    // Initialize player on server (Nickname only)
    useEffect(() => {
        if (socket) {
            // We don't send characterIndex anymore, server assigns it
            socket.emit('initPlayer', { nickname: useGameStore.getState().nickname })
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

    // Toggle View & Debug Fly Mode
    useEffect(() => {
        const unsubscribe = subscribeKeys(
            (state) => state,
            (_values) => {
                // Toggle View (V) handled by subscribeKeys usually, but we can do it here or via event listener
            }
        )

        const handleKeyDown = (e: KeyboardEvent) => {
            if (isChatOpen) return

            // Toggle View (C)
            if (e.code === 'KeyC') {
                setCameraMode((prev) => (prev === 'FIRST' ? 'THIRD' : 'FIRST'))
            }

            // Toggle Fly Mode (L)
            if (e.code === 'KeyL') {
                setFlyMode((prev) => {
                    const newState = !prev
                    const pos = body.current.translation()
                    const coords = `x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}`

                    console.log(`📍 Position: ${coords}`)
                    // Try to add to chat if function exists
                    if (addChatMessage) {
                        addChatMessage({
                            id: Date.now().toString(),
                            senderId: 'SYSTEM',
                            senderName: 'SYSTEM',
                            text: newState ? `✈️ Fly Mode ON. Pos: ${coords}` : `🚶 Fly Mode OFF. Pos: ${coords}`,
                            timestamp: Date.now()
                        })
                    }

                    // Reset gravity when turning off
                    if (!newState && body.current) {
                        body.current.setGravityScale(1, true)
                    }

                    return newState
                })
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            unsubscribe()
        }
    }, [subscribeKeys, isChatOpen, addChatMessage])

    // Jump Logic
    const lastJumpTime = useRef(0)

    useFrame((_state, delta) => {
        if (!body.current) return

        // Keep player safe while map loads
        if (!mapLoaded) {
            wasMapLoaded.current = false
            body.current.setGravityScale(0, true)
            body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
            // Pin to spawn to avoid drifting
            const room = useGameStore.getState().rooms.find(r => r.id === useGameStore.getState().currentRoomId)
            const spawn = room?.spawnPoint || [0, 10, 0]
            body.current.setTranslation({ x: spawn[0], y: spawn[1], z: spawn[2] }, true)
            return
        }

        // Re-enable gravity once after load
        if (!wasMapLoaded.current) {
            wasMapLoaded.current = true
            body.current.setGravityScale(1, true)
        }

        const keys = getKeys()
        // Disable movement if chat is open or settings/menu is open
        const { forward, backward, left, right, jump: keyJump, run: keyRun } = (isChatOpen || isSettingsOpen)
            ? { forward: false, backward: false, left: false, right: false, jump: false, run: false }
            : keys

        const { joystick, lookDelta, isJumping, isRunning: isMobileRunning } = mobileInput

        // Combine keyboard and mobile inputs
        const jump = keyJump || isJumping
        const run = keyRun || isMobileRunning

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

        if (flyMode) {
            // --- FLY MODE LOGIC ---
            body.current.setGravityScale(0, true)

            // Direction relative to camera
            direction
                .subVectors(frontVector, sideVector)
                .normalize()
                .multiplyScalar(FLY_SPEED)
                .applyEuler(camera.rotation)

            // Vertical Movement (Space = Up, Shift/Run = Down)
            if (jump) direction.y += FLY_SPEED
            if (run) direction.y -= FLY_SPEED // Using 'run' key (Shift) for down

            // Apply velocity directly
            body.current.setLinvel({ x: direction.x, y: direction.y, z: direction.z }, true)

        } else {
            // --- NORMAL WALKING LOGIC ---
            body.current.setGravityScale(1, true)

            direction
                .subVectors(frontVector, sideVector)
                .normalize()
                .multiplyScalar(run ? RUN_SPEED : SPEED)
                .applyEuler(camera.rotation) // Use camera for direction so it's responsive

            body.current.setLinvel({ x: direction.x, y: velocity.y, z: direction.z }, true)
        }

        // Apply Camera Rotation from Touch
        if (lookDelta.x !== 0 || lookDelta.y !== 0) {
            const SENSITIVITY = 0.008 // Increased sensitivity for mobile

            camera.rotation.order = 'YXZ' // Important for FPS camera to avoid gimbal lock

            camera.rotation.y -= lookDelta.x * SENSITIVITY
            camera.rotation.x -= lookDelta.y * SENSITIVITY

            // Clamp pitch (X axis) to avoid flipping
            // Limit to ~85 degrees up and down
            const maxPolarAngle = 1.5
            camera.rotation.x = Math.max(-maxPolarAngle, Math.min(maxPolarAngle, camera.rotation.x))

            // Ensure no roll
            camera.rotation.z = 0

            resetLookDelta()
        }

        // Update Animation State
        const moving = direction.length() > 0.1
        setIsMoving(moving)
        setIsRunning(run)

        // Head Bobbing (Only in First Person AND NOT Flying)
        if (cameraMode === 'FIRST') {
            if (moving && !flyMode) {
                const previousBob = bobState.current
                bobState.current += delta * (run ? 15 : 10)

                // Phase check:
                const cycle = Math.PI * 2
                const prevPhase = previousBob % cycle
                const currentPhase = bobState.current % cycle

                // Trigger at bottom (3PI/2)
                if (prevPhase < 4.71 && currentPhase >= 4.71) {
                    const randomIdx = Math.floor(Math.random() * 3) + 1
                    const audio = new Audio(`/sounds/steps/${randomIdx}.mp3`)
                    // Use SFX volume from store
                    const sfxVolume = useGameStore.getState().volumes.sfx
                    audio.volume = 0.3 * sfxVolume // Not too loud
                    audio.play().catch(() => { }) // Ignore autoplay errors
                }

            } else {
                bobState.current = 0
            }
            const bobOffset = (moving && !flyMode) ? Math.sin(bobState.current) * 0.1 : 0

            // First person: Camera matches player position
            camera.position.set(translation.x, translation.y + 1 + bobOffset, translation.z)
        } else {
            // Third Person Camera (Orbit)
            const cameraDirection = new THREE.Vector3(0, 0, -1)
            cameraDirection.applyQuaternion(camera.quaternion) // Use camera for responsive orbit
            cameraDirection.normalize()

            const cameraDist = 2
            const cameraHeight = 1.4
            const rightOffset = 0

            const rightVector = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)

            const targetPos = new THREE.Vector3(
                translation.x - cameraDirection.x * cameraDist + rightVector.x * rightOffset,
                translation.y + cameraHeight,
                translation.z - cameraDirection.z * cameraDist + rightVector.z * rightOffset
            )

            camera.position.lerp(targetPos, 0.2)
        }

        // Character Rotation (Face movement direction)
        if (cameraMode === 'THIRD' && isMoving) {
            // Calculate angle from velocity
            const angle = Math.atan2(velocity.x, velocity.z)
            if (characterRef.current) {
                const targetRotation = new THREE.Quaternion()
                targetRotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle)
                characterRef.current.quaternion.slerp(targetRotation, 0.2)
            }
        }

        // Socket Update (Throttled to ~120Hz)
        const now = Date.now()
        // Calculate rotation to send (Quaternion)
        let quaternionToSend: [number, number, number, number] = [0, 0, 0, 1]
        if (cameraMode === 'THIRD' && characterRef.current) {
            const q = characterRef.current.quaternion
            quaternionToSend = [q.x, q.y, q.z, q.w]
        } else {
            const direction = new THREE.Vector3()
            camera.getWorldDirection(direction)
            direction.y = 0 // Flatten to XZ plane
            direction.normalize()

            const angle = Math.atan2(direction.x, direction.z)
            const q = new THREE.Quaternion()
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle)

            quaternionToSend = [q.x, q.y, q.z, q.w]
        }

        if (socket && now - lastEmitTime.current > 8) { // ~120 updates per second
            lastEmitTime.current = now

            socket.emit('playerMove', {
                position: [translation.x, translation.y, translation.z],
                quaternion: quaternionToSend,
                isMoving: moving,
                isRunning: run
            })
        }

        // Keep local store in sync for AI (zombies) to find the nearest player (including self)
        useGameStore.getState().setLocalPlayerTransform(
            [translation.x, translation.y, translation.z],
            quaternionToSend,
            moving,
            run
        )

        // Jump Logic (Only when NOT flying)
        if (jump && !flyMode) {
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
            position={(() => {
                const room = useGameStore.getState().rooms.find(r => r.id === useGameStore.getState().currentRoomId)
                return room?.spawnPoint || [0, 10, 0]
            })()}
            enabledRotations={[false, false, false]}
            friction={0}
        >
            <CapsuleCollider args={[0.5, 0.3]} sensor={flyMode} />

            {/* Controls: Only active if settings are CLOSED and we are PLAYING and Chat is CLOSED */}
            {!isSettingsOpen && !isChatOpen && phase === 'PLAYING' && (
                <PointerLockControls />
            )}

            {/* Local Character Model (Only visible in 3rd person) */}
            {cameraMode === 'THIRD' && (
                <group ref={characterRef} position={[0, -0.8, 0]}> {/* Adjust height to match collider */}
                    <CharacterModel
                        characterIndex={characterIndex}
                        isMoving={isMoving}
                        isRunning={isRunning}
                        showNameplate={false}
                    />
                </group>
            )}
        </RigidBody>
    )
}
