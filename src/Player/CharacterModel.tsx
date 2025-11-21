import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations, Html } from '@react-three/drei'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Group, PositionalAudio as ThreePositionalAudio } from 'three'
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
    const remoteStreams = useVoiceStore((state) => state.remoteStreams)
    const audioRef = useRef<ThreePositionalAudio>(null!)

    useEffect(() => {
        if (playerId && remoteStreams[playerId] && audioRef.current) {
            const sound = audioRef.current
            const stream = remoteStreams[playerId]

            // Create a source from the stream
            // Note: In R3F/Three, we usually attach the listener to the camera
            // But for PositionalAudio to work with MediaStream, we need to set the source
            if (sound.context.state === 'suspended') {
                sound.context.resume()
            }

            sound.setMediaStreamSource(stream)
            sound.setRefDistance(2)
            sound.setRolloffFactor(2)
            sound.setVolume(1)
        }
    }, [playerId, remoteStreams])

    useEffect(() => {
        // Helper to find animation by name (case insensitive, partial match)
        const findAction = (name: string) => {
            const clip = animations.find(a => a.name.toLowerCase().includes(name.toLowerCase()))
            return clip ? actions[clip.name] : null
        }

        // Robust fallback logic
        const runAction = findAction('run') || actions[Object.keys(actions)[2]] // Fallback to 3rd anim
        const walkAction = findAction('walk') || actions[Object.keys(actions)[1]] // Fallback to 2nd anim
        const idleAction = findAction('idle') || actions[Object.keys(actions)[0]] // Fallback to 1st anim

        // Reset all actions
        if (runAction) runAction.fadeOut(0.2)
        if (walkAction) walkAction.fadeOut(0.2)
        if (idleAction) idleAction.fadeOut(0.2)

        if (isMoving) {
            if (isRunning && runAction) {
                runAction.reset().fadeIn(0.2).play()
            } else if (walkAction) {
                walkAction.reset().fadeIn(0.2).play()
            } else if (runAction) {
                // Fallback to run if walk missing
                runAction.reset().fadeIn(0.2).play()
            }
        } else {
            if (idleAction) {
                idleAction.reset().fadeIn(0.2).play()
            }
        }

        return () => {
            // Cleanup
        }
    }, [isMoving, isRunning, actions, animations, characterIndex])

    useFrame((state) => {
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
    })

    return (
        <group ref={group} dispose={null}>
            <primitive object={cloneScene} />

            {/* Nameplate - Only visible when playing AND showNameplate is true */}
            {phase === 'PLAYING' && showNameplate && (
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
            {playerId && remoteStreams[playerId] && useVoiceStore.getState().audioListener && (
                <positionalAudio ref={audioRef} args={[useVoiceStore.getState().audioListener!]} />
            )}
        </group>
    )
}
