import { useRef, useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations, Html } from '@react-three/drei'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Group, PositionalAudio as ThreePositionalAudio } from 'three'
import * as THREE from 'three'
import { useVoiceStore } from '../stores/useVoiceStore'
import { useGameStore } from '../stores/useGameStore'

interface CharacterModelProps {
    characterIndex?: number
    isMoving?: boolean
    isRunning?: boolean
    nickname?: string
    isSpeaking?: boolean
    playerId?: string
    showNameplate?: boolean
}

export default function CharacterModel({
    characterIndex = 1,
    isMoving = false,
    isRunning = false,
    nickname = "Player",
    isSpeaking = false,
    playerId,
    showNameplate = true
}: CharacterModelProps) {
    const group = useRef<Group>(null)
    const phase = useGameStore((state) => state.phase)
    const { scene, animations } = useGLTF(`/models/characters/character_${characterIndex}.glb`)

    // Clone scene for multiple instances
    const cloneScene = useMemo(() => clone(scene), [scene])
    const { actions } = useAnimations(animations, group)

    // Audio
    // Select specific stream to avoid re-renders when other players join
    const stream = useVoiceStore((state) => state.remoteStreams[playerId || ''])
    const audioListener = useVoiceStore((state) => state.audioListener)
    const audioRef = useRef<ThreePositionalAudio>(null!)
    const voiceVolume = useGameStore((state) => state.volumes.voice)

    useEffect(() => {
        if (playerId && stream && audioRef.current) {
            console.log(`[CharacterModel] Attaching audio for ${playerId}`)
            const sound = audioRef.current

            // Create a hidden audio element to ensure the browser plays the stream
            // This is often required for WebRTC audio to work with Web Audio API
            const audioEl = new Audio()
            audioEl.srcObject = stream
            audioEl.muted = true // Mute it because we want the 3D audio, not the flat audio
            audioEl.play()
                .then(() => console.log(`[CharacterModel] Hidden audio playing for ${playerId}`))
                .catch(e => console.error(`[CharacterModel] Error playing hidden audio for ${playerId}:`, e))

            if (sound.context.state === 'suspended') {
                console.log(`[CharacterModel] Resuming AudioContext`)
                sound.context.resume()
            }

            sound.setMediaStreamSource(stream)
            sound.setRefDistance(1) // Start dropping volume immediately
            sound.setMaxDistance(25) // Completely silent at 25 meters
            sound.setRolloffFactor(1) // Enable automatic attenuation
            sound.setDistanceModel('linear') // Linear falloff for clear proximity effect
            sound.setVolume(voiceVolume)

            // Cleanup function removed to prevent audio cutting out
            // We rely on the component unmounting to eventually garbage collect the audio element
            // This is a tradeoff to ensure reliability over memory usage for now
            return () => {
                // console.log(`[CharacterModel] Cleaning up audio for ${playerId}`)
                // audioEl.pause()
                // audioEl.srcObject = null
            }
        } else {
            if (playerId && !stream) {
                console.log(`[CharacterModel] No remote stream for ${playerId}`)
            }
        }
    }, [playerId, stream, audioListener, voiceVolume])

    useEffect(() => {
        // Helper to find animation by name (case insensitive, partial match)
        const findAction = (name: string) => {
            const clip = animations.find(a => a.name.toLowerCase().includes(name.toLowerCase()))
            return clip ? actions[clip.name] : null
        }

        if (!animations.length || !Object.keys(actions).length) return

        const runAction = findAction('run') || actions[Object.keys(actions)[2]] // Fallback to 3rd anim
        const walkAction = findAction('walk') || actions[Object.keys(actions)[1]] // Fallback to 2nd anim
        const idleAction = findAction('idle') || actions[Object.keys(actions)[0]] // Fallback to 1st anim

        const playExclusive = (action?: THREE.AnimationAction | null) => {
            if (!action) return
            Object.values(actions).forEach(a => {
                if (a && a !== action) a.stop()
            })
            action.reset().fadeIn(0.15).play()
        }

        if (isMoving) {
            if (isRunning && runAction) {
                playExclusive(runAction)
            } else if (walkAction) {
                playExclusive(walkAction)
            } else if (runAction) {
                playExclusive(runAction)
            }
        } else {
            playExclusive(idleAction)
        }

        return () => {
            // Keep current action; next effect run will replace if needed
        }
    }, [isMoving, isRunning, actions, animations, characterIndex, phase])

    // Safety: if mixer is idle (e.g., after respawn), kick idle once
    useEffect(() => {
        if (!animations.length || !Object.keys(actions).length) return
        const idleAction = actions[animations[0]?.name] || actions[Object.keys(actions)[0]]
        const anyRunning = Object.values(actions).some(a => a?.isRunning && a.isRunning())
        if (!anyRunning && idleAction) {
            Object.values(actions).forEach(a => a?.stop())
            idleAction.reset().fadeIn(0.15).play()
        }
    }, [animations, actions, phase])

    // Nameplate Visibility Logic
    const [isNameplateVisible, setIsNameplateVisible] = useState(true)

    useFrame((state) => {
        // Manual Proximity Volume Calculation Removed - Using Native Web Audio Attenuation
        // The PositionalAudio object handles distance attenuation automatically via PannerNode
        // when rolloffFactor is > 0.

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

        // Distance Check for Nameplate
        if (group.current) {
            const cameraPos = state.camera.position
            const characterPos = group.current.getWorldPosition(new THREE.Vector3())
            const distance = cameraPos.distanceTo(characterPos)

            // Only update state if it changes to avoid re-renders
            const shouldBeVisible = distance < 20
            if (shouldBeVisible !== isNameplateVisible) {
                setIsNameplateVisible(shouldBeVisible)
            }
        }
    })

    return (
        <group ref={group} dispose={null}>
            <primitive object={cloneScene} />

            {/* Nameplate - Only visible when playing AND showNameplate is true AND within distance */}
            {phase === 'PLAYING' && showNameplate && isNameplateVisible && (
                <Html position={[0, 2.2, 0]} center distanceFactor={10} zIndexRange={[0, 10]}>
                    <div className="flex items-center justify-center">
                        <div className="bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                            <span className="text-white font-bold text-xs whitespace-nowrap shadow-sm">
                                {nickname}
                            </span>
                            {isSpeaking && (
                                <div className="bg-white/20 p-0.5 rounded-full animate-pulse">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-green-400">
                                        <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                                        <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    </div>
                </Html>
            )}

            {/* Positional Audio for Remote Players */}
            {playerId && stream && audioListener && (
                <positionalAudio ref={audioRef} args={[audioListener]} />
            )}
        </group>
    )
}
