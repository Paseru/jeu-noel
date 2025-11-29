import * as THREE from 'three'
import { useGameStore } from '../stores/useGameStore'
import { useVoiceStore } from '../stores/useVoiceStore'

import { useRef, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useKeyboardControls, PointerLockControls } from '@react-three/drei'
import { CapsuleCollider, RigidBody, RapierRigidBody } from '@react-three/rapier'

const SPEED = 3.2
const RUN_SPEED = 6
const JUMP_FORCE = 8
const FLY_SPEED = 15

import CharacterModel from './CharacterModel'
import { PositionalAudio as ThreePositionalAudio, AudioLoader } from 'three'


interface PlayerControllerProps {
    isSettingsOpen: boolean
}

export const PlayerController = ({ isSettingsOpen }: PlayerControllerProps) => {
    const { socket, phase, isChatOpen, mobileInput, resetLookDelta, addChatMessage } = useGameStore()
    const body = useRef<RapierRigidBody>(null!)
    const [subscribeKeys, getKeys] = useKeyboardControls()
    const { camera, scene } = useThree()
    
    // Infected mode
    const isInfected = useGameStore((state) => state.isInfected)
    const infectedGameState = useGameStore((state) => state.infectedGameState)
    const pendingSpawnPoint = useGameStore((state) => state.pendingSpawnPoint)
    const pendingZombieSpawnPoint = useGameStore((state) => state.pendingZombieSpawnPoint)
    const isBeingInfected = useGameStore((state) => state.isBeingInfected)
    const pendingInfectionSpawn = useGameStore((state) => state.pendingInfectionSpawn)

    // Reference to the character mesh group for rotation
    const characterRef = useRef<THREE.Group>(null)
    
    // Grounded state for jump
    const isGrounded = useRef(false)

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
    const [isAttacking, setIsAttacking] = useState(false)
    const mapLoaded = useGameStore((state) => state.mapLoaded)
    const wasMapLoaded = useRef(false)
    const movementLocked = useGameStore((state) => state.movementLocked)
    const forcedCameraMode = useGameStore((state) => state.forcedCameraMode)

    // Debug / Fly Mode
    const [flyMode, setFlyMode] = useState(false)
    const stepBuffers = useRef<AudioBuffer[]>([])

    const setAudioListener = useVoiceStore((state) => state.setAudioListener)
    const audioListener = useVoiceStore((state) => state.audioListener)

    // Keep local camera in sync with forced mode (e.g., when a zombie grabs the player)
    useEffect(() => {
        if (forcedCameraMode && forcedCameraMode !== cameraMode) {
            setCameraMode(forcedCameraMode)
        }
    }, [forcedCameraMode, cameraMode])
    
    // Track previous game state to detect transition to PLAYING
    const prevGameState = useRef<string | null>(null)
    
    // Teleport player when game transitions from STARTING to PLAYING
    useEffect(() => {
        if (prevGameState.current === 'STARTING' && infectedGameState === 'PLAYING') {
            if (body.current && pendingSpawnPoint && pendingZombieSpawnPoint) {
                const spawn = isInfected ? pendingZombieSpawnPoint : pendingSpawnPoint
                body.current.setTranslation({ x: spawn[0], y: spawn[1], z: spawn[2] }, true)
                body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
                console.log(`Teleported to ${isInfected ? 'zombie' : 'survivor'} spawn:`, spawn)
            }
        }
        prevGameState.current = infectedGameState
    }, [infectedGameState, isInfected, pendingSpawnPoint, pendingZombieSpawnPoint])
    
    // Track previous infection transition state
    const wasBeingInfected = useRef(false)
    
    // Teleport player when infection transition ends
    useEffect(() => {
        if (wasBeingInfected.current && !isBeingInfected && pendingInfectionSpawn) {
            if (body.current) {
                body.current.setTranslation({ 
                    x: pendingInfectionSpawn[0], 
                    y: pendingInfectionSpawn[1], 
                    z: pendingInfectionSpawn[2] 
                }, true)
                body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
                console.log('Teleported to zombie spawn after infection:', pendingInfectionSpawn)
            }
        }
        wasBeingInfected.current = isBeingInfected
    }, [isBeingInfected, pendingInfectionSpawn])

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

    // Preload positional footstep buffers once listener is ready
    useEffect(() => {
        if (!audioListener) return
        const loader = new AudioLoader()
        const buffers: AudioBuffer[] = []
        let mounted = true
        const files = ['/sounds/steps/1.mp3', '/sounds/steps/2.mp3', '/sounds/steps/3.mp3']
        files.forEach((file) => {
            loader.load(file, (buffer) => {
                if (!mounted) return
                buffers.push(buffer)
                stepBuffers.current = buffers
            })
        })
        return () => { mounted = false }
    }, [audioListener])

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

            // Toggle View (C) disabled when a forced camera mode is active
            if (e.code === 'KeyC') {
                if (forcedCameraMode) return
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
    
    // Attack cooldown for infected players
    const lastAttackTime = useRef(0)
    
    // Camera lunge effect for zombie attack
    const attackLungeProgress = useRef(0)
    const isLunging = useRef(false)

    const performAttack = () => {
        const state = useGameStore.getState()
        const { isInfected, infectedGameState, players, playerId, attack, infectedPlayers } = state
        
        if (!isInfected || infectedGameState !== 'PLAYING') return

        const now = Date.now()
        if (now - lastAttackTime.current < 1000) return // 1000ms cooldown (1s)
        lastAttackTime.current = now
        
        // Trigger attack animation
        setIsAttacking(true)
        setTimeout(() => setIsAttacking(false), 1000) // Reset after animation (1s)
        
        // Trigger camera lunge effect
        isLunging.current = true
        attackLungeProgress.current = 0
        
        if (!body.current || !playerId) return
        
        const myPos = body.current.translation()
        const myPosition: [number, number, number] = [myPos.x, myPos.y, myPos.z]
        
        // Find nearest non-infected player within attack range
        let nearestId: string | null = null
        let nearestDist = Infinity
        
        Object.values(players).forEach((player) => {
            if (player.id === playerId) return
            if (infectedPlayers.includes(player.id)) return
            
            const dx = player.position[0] - myPosition[0]
            const dy = player.position[1] - myPosition[1]
            const dz = player.position[2] - myPosition[2]
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
            
            if (dist < nearestDist && dist <= 1.5) { // 1.5m range on client, server checks 1m
                nearestDist = dist
                nearestId = player.id
            }
        })
        
        if (nearestId) {
            console.log('Attacking player:', nearestId)
            attack(nearestId)
        }
    }
    
    // Handle click to attack (for infected players)
    useEffect(() => {
        const handleClick = () => performAttack()
        window.addEventListener('click', handleClick)
        return () => window.removeEventListener('click', handleClick)
    }, [])

    // Mobile attack tracking
    const wasMobileAttacking = useRef(false)

    useFrame((_state, delta) => {
        if (!body.current) return

        // Mobile Attack Check
        if (mobileInput.isAttacking && !wasMobileAttacking.current) {
            performAttack()
        }
        wasMobileAttacking.current = mobileInput.isAttacking

        // If not actively playing, freeze physics and skip networking
        if (useGameStore.getState().phase !== 'PLAYING') {
            body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
            return
        }

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
        
        // Freeze player during STARTING phase (transition screen)
        const currentGameState = useGameStore.getState().infectedGameState
        if (currentGameState === 'STARTING') {
            body.current.setGravityScale(0, true)
            body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
            return
        }
        
        // Freeze player during infection transition (when getting infected mid-game)
        const currentlyBeingInfected = useGameStore.getState().isBeingInfected
        if (currentlyBeingInfected) {
            body.current.setGravityScale(0, true)
            body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
            return
        }

        // Re-enable gravity once after load
        if (!wasMapLoaded.current) {
            wasMapLoaded.current = true
            body.current.setGravityScale(1, true)
        }

        const keys = getKeys()
        // Disable movement if chat is open or settings/menu is open
        const controlsLocked = isChatOpen || isSettingsOpen || movementLocked
        const { forward, backward, left, right, jump: keyJump, run: keyRun } = controlsLocked
            ? { forward: false, backward: false, left: false, right: false, jump: false, run: false }
            : keys

        // When a killcam target is present (zombie grabbed you), we force first-person view
        const killCamTarget = useGameStore.getState().killCamTarget
        if (killCamTarget && cameraMode !== 'FIRST') {
            setCameraMode('FIRST')
        }

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
            // Enable Rapier gravity for trimesh collision
            body.current.setGravityScale(1, true)

            direction
                .subVectors(frontVector, sideVector)
                .normalize()
                .multiplyScalar(run ? RUN_SPEED : SPEED)
                .applyEuler(camera.rotation)

            // Set horizontal velocity, keep current Y velocity for gravity/jump
            const currentVel = body.current.linvel()
            body.current.setLinvel({ x: direction.x, y: currentVel.y, z: direction.z }, true)
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

        // Head Bobbing + footstep timing (only when not flying)
        const playFootstep = () => {
            const listener = useVoiceStore.getState().audioListener
            const sfxVolume = useGameStore.getState().volumes.sfx
            if (!listener || stepBuffers.current.length === 0) return
            const buffer = stepBuffers.current[Math.floor(Math.random() * stepBuffers.current.length)]
            const sound = new ThreePositionalAudio(listener)
            sound.setBuffer(buffer)
            sound.setRefDistance(1)
            sound.setMaxDistance(12)
            sound.setRolloffFactor(1)
            sound.setVolume(0.35 * sfxVolume)
            sound.position.set(translation.x, translation.y, translation.z)
            scene.add(sound)
            sound.play()
            sound.source?.addEventListener('ended', () => {
                scene.remove(sound)
                sound.disconnect()
            })
        }

        if (!flyMode) {
            if (moving) {
                const previousBob = bobState.current
                bobState.current += delta * (run ? 15 : 10)

                // Phase check:
                const cycle = Math.PI * 2
                const prevPhase = previousBob % cycle
                const currentPhase = bobState.current % cycle

                // Trigger at bottom (3PI/2)
                if (prevPhase < 4.71 && currentPhase >= 4.71) {
                    playFootstep()
                }

            } else {
                bobState.current = 0
            }
        }

        const bobOffset = (!flyMode && cameraMode === 'FIRST' && moving) ? Math.sin(bobState.current) * 0.1 : 0

        // Camera lunge effect for zombie attack
        let lungeOffset = 0
        if (isLunging.current) {
            attackLungeProgress.current += delta * 1.0 // Full cycle in 1 second
            
            const p = attackLungeProgress.current
            
            if (p < 0.2) {
                // Wind up: Pull back slightly (-0.2 units)
                // Smooth step from 0 to -0.2
                lungeOffset = -0.2 * (p / 0.2)
            } else if (p < 0.3) {
                // Strike: Fast forward to +0.5 units
                // Map 0.2-0.3 to -0.2 -> 0.5
                const t = (p - 0.2) / 0.1
                lungeOffset = -0.2 + (0.7 * t)
            } else if (p < 1.0) {
                // Recovery: Ease out from 0.5 back to 0
                const t = (p - 0.3) / 0.7
                lungeOffset = 0.5 * (1 - t * t) // Quadratic ease out
            } else {
                // Done
                isLunging.current = false
                attackLungeProgress.current = 0
                lungeOffset = 0
            }
        }

        if (cameraMode === 'FIRST') {
            // First person: Camera matches player position
            if (lungeOffset > 0) {
                // Apply lunge in view direction
                const lungeDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
                camera.position.set(
                    translation.x + lungeDirection.x * lungeOffset,
                    translation.y + 1 + bobOffset - lungeOffset * 0.15, // Slight downward for headbutt effect
                    translation.z + lungeDirection.z * lungeOffset
                )
            } else {
                camera.position.set(translation.x, translation.y + 1 + bobOffset, translation.z)
            }
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

        // Force the view to look at the attacker when grabbed/finishing blow happens
        if (killCamTarget) {
            const eyePos = new THREE.Vector3(translation.x, translation.y + 1 + bobOffset, translation.z)
            camera.position.copy(eyePos)

            const targetVec = new THREE.Vector3(killCamTarget[0], killCamTarget[1], killCamTarget[2])
            const toTarget = targetVec.clone().sub(eyePos)
            if (toTarget.lengthSq() > 1e-6) {
                camera.rotation.order = 'YXZ'
                camera.lookAt(targetVec)
                camera.rotation.z = 0
            }
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

        const currentRoomId = useGameStore.getState().currentRoomId
        if (socket && currentRoomId && now - lastEmitTime.current > 30) { // ~33 updates per second
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

        // Gravity and jump handled by Rapier physics with trimesh collider
        if (!flyMode) {
            const vel = body.current.linvel()
            
            // Check if grounded (small downward velocity means on ground)
            isGrounded.current = Math.abs(vel.y) < 0.5
            
            // Jump
            if (jump && isGrounded.current) {
                const now = Date.now()
                if (now - lastJumpTime.current > 1000) {
                    body.current.setLinvel({ x: vel.x, y: JUMP_FORCE, z: vel.z }, true)
                    isGrounded.current = false
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
                        isInfected={isInfected}
                        isAttacking={isAttacking}
                    />
                </group>
            )}
        </RigidBody>
    )
}
