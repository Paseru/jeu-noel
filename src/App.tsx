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
import { ZombieSpawnButton } from './components/ZombieSpawnButton'
import { InteractionPrompt } from './UI/InteractionPrompt'
import PlayerList from './UI/PlayerList'
import { DeathScreen } from './UI/DeathScreen'

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
    const [isPlayerListOpen, setIsPlayerListOpen] = useState(false)
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

    // Handle Escape key & Tab Key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Tab for Player List
            if (e.code === 'Tab') {
                e.preventDefault() // Prevent focus change
                if (phase === 'PLAYING' && !isSettingsOpen && !isPauseMenuOpen) {
                    setIsPlayerListOpen(prev => !prev)
                }
            }
        }

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Escape') {
                if (phase === 'PLAYING') {
                    // If player list is open, close it
                    if (isPlayerListOpen) {
                        setIsPlayerListOpen(false)
                        return
                    }

                    // If settings are open, close them
                    if (isSettingsOpen) {
                        setIsSettingsOpen(false)
                    }
                    // If pause menu is open, close it
                    else if (isPauseMenuOpen) {
                        setIsPauseMenuOpen(false)
                    }
                    // If nothing is open, open pause menu
                    else {
                        setIsPauseMenuOpen(true)
                    }
                }
            }

            // Debug Mode (P)
            if (e.code === 'KeyP') {
                useGameStore.getState().toggleDebugMode()
            }
        }

        // Pointer Lock Change Listener (For Escape key behavior)
        const handlePointerLockChange = () => {
            // If pointer lock is lost AND we are playing AND no menu is open, open pause menu
            // This handles the case where user presses Escape (which natively exits pointer lock)
            if (
                document.pointerLockElement === null &&
                phase === 'PLAYING' &&
                !isSettingsOpen &&
                !isPauseMenuOpen &&
                !isPlayerListOpen // Don't open pause menu if player list is open (since we need cursor there)
            ) {
                setIsPauseMenuOpen(true)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
        document.addEventListener('pointerlockchange', handlePointerLockChange)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
            document.removeEventListener('pointerlockchange', handlePointerLockChange)
        }
    }, [phase, isSettingsOpen, isPauseMenuOpen, isPlayerListOpen])

    const handleQuit = () => {
        setIsPauseMenuOpen(false)
        setIsSettingsOpen(false)
        setIsPlayerListOpen(false)
        // Disconnect/Leave room logic could go here if needed
        // For now just switch phase to MENU
        useGameStore.setState({ phase: 'MENU', currentRoomId: null, isPlayerDead: false })
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
                    <Experience isSettingsOpen={isSettingsOpen || isPauseMenuOpen || isPlayerListOpen} />
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
                    {!isSettingsOpen && !isPauseMenuOpen && !isPlayerListOpen && (
                        <MobileControls onOpenMenu={() => setIsPauseMenuOpen(true)} />
                    )}

                    <ZombieSpawnButton />

                    <InteractionPrompt />

                    {/* Player List Overlay */}
                    {isPlayerListOpen && <PlayerList />}

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

            {/* Death Overlay (on top of everything) */}
            <DeathScreen />

            {/* Settings Modal */}
            <Settings
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </KeyboardControls>
    )
}
