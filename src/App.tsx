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
import { InteractionPrompt } from './UI/InteractionPrompt'
import PlayerList from './UI/PlayerList'
import { DeathScreen } from './UI/DeathScreen'
import Loader from './UI/Loader'
import GameStartingLoader from './UI/GameStartingLoader'
import InfectionLoader from './UI/InfectionLoader'
import GameStatusHud from './UI/GameStatusHud'
import VoteScreen from './UI/VoteScreen'
import SpectatorHud from './UI/SpectatorHud'

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
    const menuAudioRef = useRef<HTMLAudioElement>(null)
    const gameAudioRef = useRef<HTMLAudioElement>(null)
    const ambientAudioRef = useRef<HTMLAudioElement>(null)
    const windAudioRef = useRef<HTMLAudioElement>(null)

    const { phase, volumes, mapLoaded, infectedGameState, isBeingInfected } = useGameStore()
    useEffect(() => {
        const handleBeforeUnload = () => {
            useGameStore.getState().leaveRoom()
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [])

    useEffect(() => {
        if (menuAudioRef.current) menuAudioRef.current.volume = volumes.music
        if (gameAudioRef.current) gameAudioRef.current.volume = volumes.music
        if (ambientAudioRef.current) ambientAudioRef.current.volume = volumes.ambient
        if (windAudioRef.current) windAudioRef.current.volume = volumes.wind
    }, [volumes.music, volumes.ambient, volumes.wind])

    useEffect(() => {
        const menuAudio = menuAudioRef.current
        const gameAudio = gameAudioRef.current
        const ambientAudio = ambientAudioRef.current
        const windAudio = windAudioRef.current

        if (!menuAudio || !gameAudio || !ambientAudio || !windAudio) return

        if (phase === 'MENU') {
            gameAudio.pause()
            gameAudio.currentTime = 0
            ambientAudio.pause()
            ambientAudio.currentTime = 0
            windAudio.pause()
            windAudio.currentTime = 0

            menuAudio.volume = volumes.music
            menuAudio.play().catch(() => {
                console.log('Menu music autoplay blocked, waiting for interaction')
            })
        } else if (phase === 'PLAYING') {
            menuAudio.pause()
            
            gameAudio.volume = volumes.music
            ambientAudio.volume = volumes.ambient
            windAudio.volume = volumes.wind
            
            const playPromise = Promise.all([
                gameAudio.play(),
                ambientAudio.play(),
                windAudio.play()
            ])
            
            playPromise.catch(() => {
                console.log('In-game music autoplay blocked, waiting for interaction')
            })
        }
    }, [phase, volumes.music, volumes.ambient, volumes.wind])

    // Play on first interaction if autoplay was blocked
    const audioListener = useVoiceStore((state) => state.audioListener)

    // Play on first interaction if autoplay was blocked
    useEffect(() => {
        const handleInteraction = () => {
            if (phase === 'PLAYING') {
                if (gameAudioRef.current && gameAudioRef.current.paused) gameAudioRef.current.play()
                if (ambientAudioRef.current && ambientAudioRef.current.paused) ambientAudioRef.current.play()
                if (windAudioRef.current && windAudioRef.current.paused) windAudioRef.current.play()
            } else {
                if (menuAudioRef.current && menuAudioRef.current.paused) menuAudioRef.current.play()
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
    }, [audioListener, phase])

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

    const handleResume = () => {
        setIsPauseMenuOpen(false)
        if (phase === 'PLAYING' && !document.pointerLockElement) {
            // Request pointer lock to go back "in game"
            (document.body as HTMLElement).requestPointerLock?.()
        }
    }

    const handleQuit = () => {
        setIsPauseMenuOpen(false)
        setIsSettingsOpen(false)
        setIsPlayerListOpen(false)
        // Leave current room to avoid ghost players
        useGameStore.getState().leaveRoom()
    }

    return (
        <KeyboardControls map={map}>
            {/* Background Music */}
            <audio
                ref={menuAudioRef}
                src="/sounds/John Carpenter Halloween Theme [Movie Version Extended by Gilles Nuytens].mp3"
                loop
                preload="auto"
            />
            <audio
                ref={gameAudioRef}
                src="/sounds/(Free) Horror Ambiance - Ominous Background Music.mp3"
                loop
                preload="auto"
            />
            <audio
                ref={ambientAudioRef}
                src="/sounds/night-ambient.mp3"
                loop
                preload="auto"
            />
            <audio
                ref={windAudioRef}
                src="/sounds/wind.mp3"
                loop
                preload="auto"
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

            {/* Loader */}
            {phase === 'PLAYING' && !mapLoaded && infectedGameState !== 'STARTING' && <Loader />}
            
            {/* Game Starting Loader (transition screen before game starts) */}
            {phase === 'PLAYING' && infectedGameState === 'STARTING' && <GameStartingLoader />}
            
            {/* Infection Loader (transition when player gets infected mid-game) */}
            {phase === 'PLAYING' && isBeingInfected && <InfectionLoader />}

            {/* UI Overlay (Only when playing) */}
            {phase === 'PLAYING' && mapLoaded && (
                infectedGameState === 'VOTING' ? (
                    // During voting, show only the vote UI to keep things clean
                    <VoteScreen />
                ) : (
                    <>
                        <Chat />
                        <VoiceChatManager />
                        <VoiceIndicator />
                        <GameStatusHud />
                        <SpectatorHud />
                        {!isSettingsOpen && !isPauseMenuOpen && !isPlayerListOpen && (
                            <MobileControls onOpenMenu={() => setIsPauseMenuOpen(true)} />
                        )}

                        <InteractionPrompt />

                        {/* Player List Overlay */}
                        {isPlayerListOpen && <PlayerList />}

                        {/* Pause Menu */}
                        {isPauseMenuOpen && !isSettingsOpen && (
                            <PauseMenu
                                onResume={handleResume}
                                onOpenSettings={() => setIsSettingsOpen(true)}
                                onQuit={handleQuit}
                            />
                        )}
                        
                        {/* Vote Screen */}
                        <VoteScreen />
                    </>
                )
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
