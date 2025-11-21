import { Canvas } from '@react-three/fiber'
import { Experience } from './Experience'
import { KeyboardControls } from '@react-three/drei'
import { useMemo, Suspense, useState, useRef, useEffect } from 'react'
import MainMenu from './UI/MainMenu'
import PauseMenu from './UI/PauseMenu'
import Chat from './UI/Chat'
import Settings from './UI/Settings'
import VoiceIndicator from './UI/VoiceIndicator'
import VoiceChatManager from './components/VoiceChatManager'
import { useGameStore } from './stores/useGameStore'
import { useVoiceStore } from './stores/useVoiceStore'
import MobileControls from './UI/MobileControls'

export default function App() {
    const map = useMemo(() => [
        { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
        { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
        { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
        { name: 'right', keys: ['ArrowRight', 'KeyD'] },
        { name: 'jump', keys: ['Space'] },
        { name: 'run', keys: ['Shift'] },
        { name: 'toggleView', keys: ['KeyC'] },
    ], [])

    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [isPauseMenuOpen, setIsPauseMenuOpen] = useState(false)
    const audioRef = useRef<HTMLAudioElement>(null)

    const { phase, volumes } = useGameStore()

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volumes.music
            // Try to play automatically (might be blocked by browser policy until interaction)
            audioRef.current.play().catch(() => {
                console.log("Audio autoplay blocked, waiting for interaction")
            })
        }
    }, [volumes.music])

    // Play on first interaction if autoplay was blocked
    const audioListener = useVoiceStore((state) => state.audioListener)

    // Play on first interaction if autoplay was blocked
    useEffect(() => {
        const handleInteraction = () => {
            if (audioRef.current && audioRef.current.paused) {
                audioRef.current.play()
            }
            if (audioListener && audioListener.context.state === 'suspended') {
                audioListener.context.resume()
            }
        }
        window.addEventListener('click', handleInteraction)
        window.addEventListener('keydown', handleInteraction)
        return () => {
            window.removeEventListener('click', handleInteraction)
            window.removeEventListener('keydown', handleInteraction)
        }
    }, [audioListener])

    // Handle Escape key for Pause Menu
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Escape') {
                if (phase === 'PLAYING') {
                    if (isSettingsOpen) {
                        setIsSettingsOpen(false)
                    } else {
                        setIsPauseMenuOpen(prev => !prev)
                    }
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [phase, isSettingsOpen])

    const handleQuit = () => {
        setIsPauseMenuOpen(false)
        setIsSettingsOpen(false)
        // Disconnect/Leave room logic could go here if needed
        // For now just switch phase to MENU
        useGameStore.setState({ phase: 'MENU', currentRoomId: null })
    }

    return (
        <KeyboardControls map={map}>
            {/* Background Music */}
            <audio
                ref={audioRef}
                src="/sounds/John Carpenter Halloween Theme [Movie Version Extended by Gilles Nuytens].mp3"
                loop
            />

            <Canvas
                shadows
                camera={{
                    fov: 60,
                    near: 0.1,
                    far: 200,
                    position: [0, 2, 10]
                }}
            >
                <Suspense fallback={null}>
                    <Experience isSettingsOpen={isSettingsOpen || isPauseMenuOpen} />
                </Suspense>
            </Canvas>

            {/* Main Menu */}
            {phase === 'MENU' && !isSettingsOpen && (
                <MainMenu onOpenSettings={() => setIsSettingsOpen(true)} />
            )}

            {/* UI Overlay (Only when playing) */}
            {phase === 'PLAYING' && (
                <>
                    <Chat />
                    <VoiceChatManager />
                    <VoiceIndicator />
                    {!isSettingsOpen && !isPauseMenuOpen && <MobileControls />}

                    {/* Pause Menu */}
                    {isPauseMenuOpen && !isSettingsOpen && (
                        <PauseMenu
                            onResume={() => setIsPauseMenuOpen(false)}
                            onOpenSettings={() => setIsSettingsOpen(true)}
                            onQuit={handleQuit}
                        />
                    )}
                </>
            )}

            {/* Settings Modal */}
            <Settings
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </KeyboardControls>
    )
}
