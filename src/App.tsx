import { Canvas } from '@react-three/fiber'
import { Experience } from './Experience'
import { KeyboardControls } from '@react-three/drei'
import { useMemo, Suspense, useState, useRef, useEffect } from 'react'
import MainMenu from './UI/MainMenu'
import Chat from './UI/Chat'
import VoiceChatManager from './components/VoiceChatManager'
import { useGameStore } from './stores/useGameStore'

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
    const [volume, setVolume] = useState(0.05)
    const audioRef = useRef<HTMLAudioElement>(null)

    const { phase } = useGameStore()

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume
            // Try to play automatically (might be blocked by browser policy until interaction)
            audioRef.current.play().catch(() => {
                console.log("Audio autoplay blocked, waiting for interaction")
            })
        }
    }, [volume])

    // Play on first interaction if autoplay was blocked
    useEffect(() => {
        const handleInteraction = () => {
            if (audioRef.current && audioRef.current.paused) {
                audioRef.current.play()
            }
        }
        window.addEventListener('click', handleInteraction)
        return () => window.removeEventListener('click', handleInteraction)
    }, [])

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
                    <Experience isSettingsOpen={isSettingsOpen} />
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
                    <div className="absolute top-0 left-0 w-full p-8 pointer-events-none flex justify-between items-start z-50">
                        {/* Top Left: Settings Button */}
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="pointer-events-auto bg-white/10 backdrop-blur-md p-3 rounded-full hover:bg-white/20 transition-all group"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white group-hover:rotate-90 transition-transform">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>

                        {/* Top Right: Title */}
                        <div className="text-right">
                            <h1 className="text-4xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 drop-shadow-lg">
                                Frozen Hollow
                            </h1>
                            <p className="text-white/50 text-sm font-mono tracking-widest mt-1">Pre-Alpha Build</p>
                        </div>
                    </div>
                </>
            )}

            {/* Settings Modal */}
            {isSettingsOpen && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1c1c2e] border border-white/10 p-8 rounded-2xl w-96 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-white">Paramètres</h2>
                            <button
                                onClick={() => setIsSettingsOpen(false)}
                                className="text-white/50 hover:text-white transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Volume Control */}
                            <div>
                                <div className="flex justify-between text-white mb-2">
                                    <span className="text-sm font-medium">Musique</span>
                                    <span className="text-sm text-white/50">{Math.round(volume * 100)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={volume}
                                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white hover:accent-gray-200"
                                />
                            </div>

                            {/* Controls Guide */}
                            <div className="pt-6 border-t border-white/10">
                                <h3 className="text-white font-bold mb-4 text-lg">Commandes</h3>
                                <div className="space-y-3 text-sm text-white/80">
                                    <div className="flex justify-between items-center">
                                        <span>Se déplacer</span>
                                        <span className="font-mono text-xs bg-white/10 px-2 py-1 rounded text-white/70">ZQSD / Arrows</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>Courir</span>
                                        <span className="font-mono text-xs bg-white/10 px-2 py-1 rounded text-white/70">Shift</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>Sauter</span>
                                        <span className="font-mono text-xs bg-white/10 px-2 py-1 rounded text-white/70">Space</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>Parler (Maintenir)</span>
                                        <span className="font-mono text-xs bg-white/10 px-2 py-1 rounded text-white/70">V</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>Chat</span>
                                        <span className="font-mono text-xs bg-white/10 px-2 py-1 rounded text-white/70">Enter</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>Changer de vue</span>
                                        <span className="font-mono text-xs bg-white/10 px-2 py-1 rounded text-white/70">C</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </KeyboardControls>
    )
}
