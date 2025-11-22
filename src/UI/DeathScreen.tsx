import { useGameStore } from '../stores/useGameStore'

export const DeathScreen = () => {
    const { setPhase, setPlayerDead, isPlayerDead } = useGameStore()

    if (!isPlayerDead) return null

    const handleBackToMenu = () => {
        setPlayerDead(false)
        setPhase('MENU')
        // Optionally clear room selection
        useGameStore.setState({ currentRoomId: null })
    }

    return (
        <div className="absolute inset-0 z-[1200] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="text-center mb-10 animate-in fade-in duration-300">
                <h1 className="text-6xl md:text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 drop-shadow-2xl uppercase">
                    You Are Dead
                </h1>
                <p className="text-white/70 mt-3 text-lg font-mono tracking-[0.3em] uppercase">Devoured by the horde</p>
            </div>

            <button
                onClick={handleBackToMenu}
                className="group relative px-8 py-4 bg-white text-black font-bold text-xl rounded-full hover:scale-105 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.35)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)]"
            >
                <span className="relative z-10">Back to Menu</span>
                <div className="absolute inset-0 rounded-full bg-white blur-md opacity-50 group-hover:opacity-80 transition-opacity" />
            </button>
        </div>
    )
}
