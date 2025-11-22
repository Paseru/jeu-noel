import { useEffect } from 'react'
import { useGameStore } from '../stores/useGameStore'

export const DeathScreen = () => {
    const { setPhase, setPlayerDead, isPlayerDead, setMapLoaded } = useGameStore()

    // Keep pointer unlocked and cursor visible once dead
    useEffect(() => {
        if (!isPlayerDead) return
        if (document.pointerLockElement) {
            document.exitPointerLock()
        }
    }, [isPlayerDead])

    if (!isPlayerDead) return null

    const handleBackToMenu = () => {
        setPlayerDead(false)
        setPhase('MENU')
        setMapLoaded(false)
        useGameStore.setState({ currentRoomId: null })
    }

    return (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-gradient-to-br from-black via-[#170202] to-black text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,0,0,0.12),transparent_60%)] pointer-events-none" />
            <div className="relative z-10 text-center space-y-6 px-6">
                <p className="text-sm font-mono tracking-[0.4em] text-white/70">
                    YOU ARE DEAD
                </p>
                <h1 className="text-6xl md:text-7xl font-black tracking-tight text-red-500 drop-shadow-[0_0_25px_rgba(248,113,113,0.6)]">
                    GAME OVER
                </h1>
                <p className="text-white/60 font-mono text-sm">
                    Le zombie t&apos;a eu. Retourne au menu pour relancer une partie.
                </p>
                <button
                    onClick={handleBackToMenu}
                    className="group relative inline-flex items-center justify-center px-8 py-3 bg-white text-black font-bold text-lg rounded-full hover:scale-105 transition-all duration-200 shadow-[0_0_35px_rgba(255,255,255,0.25)]"
                >
                    <span className="relative z-10">Retour au menu</span>
                    <div className="absolute inset-0 rounded-full bg-white blur-md opacity-50 group-hover:opacity-80 transition-opacity" />
                </button>
            </div>
        </div>
    )
}
