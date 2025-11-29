import { useEffect, useState } from 'react'
import { useGameStore } from '../stores/useGameStore'

export default function GameStartingLoader() {
    const currentRoomId = useGameStore((state) => state.currentRoomId)
    const rooms = useGameStore((state) => state.rooms)
    const startingCountdownEnd = useGameStore((state) => state.startingCountdownEnd)
    const playerId = useGameStore((state) => state.playerId)
    const infectedPlayers = useGameStore((state) => state.infectedPlayers)
    const storeIsInfected = useGameStore((state) => state.isInfected)
    const room = rooms.find(r => r.id === currentRoomId)
    
    // Calculate isInfected locally for reliability (store's isInfected may not be updated yet)
    // Prefer explicit flag (set by gameStarting), fall back to list membership
    const isInfected = storeIsInfected || (playerId ? infectedPlayers.includes(playerId) : false)
    
    // Debug log
    console.log('[GameStartingLoader] isInfected:', isInfected, 'playerId:', playerId, 'infectedPlayers:', infectedPlayers)
    
    const [countdown, setCountdown] = useState<number>(5)
    
    useEffect(() => {
        if (!startingCountdownEnd) return
        
        const updateCountdown = () => {
            const remaining = Math.max(0, Math.ceil((startingCountdownEnd - Date.now()) / 1000))
            setCountdown(remaining)
        }
        
        updateCountdown()
        const interval = setInterval(updateCountdown, 100)
        return () => clearInterval(interval)
    }, [startingCountdownEnd])

    if (!room) {
        return (
            <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-black text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 relative">
                        <div className="absolute inset-0 border-4 border-white/20 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-t-white rounded-full animate-spin"></div>
                    </div>
                    <p className="text-white/60 font-mono tracking-[0.3em] text-sm animate-pulse">
                        PREPARING...
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-black text-white overflow-hidden">
            {/* Background Image with Blur */}
            <div className="absolute inset-0 overflow-hidden">
                <img 
                    src={room.mapImage} 
                    alt={room.name}
                    className="w-full h-full object-cover opacity-50 blur-sm scale-110"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/1920x1080/1a1a1a/FFF?text=Loading';
                    }}
                />
            </div>
            
            {/* Dark Overlay - colored based on role */}
            <div className={`absolute inset-0 ${
                isInfected 
                    ? 'bg-gradient-to-b from-red-900/70 via-black/60 to-black/90' 
                    : 'bg-gradient-to-b from-green-900/70 via-black/60 to-black/90'
            }`} />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                {/* Role Badge */}
                <div className={`mb-6 px-6 py-2 rounded-full text-lg font-black uppercase tracking-wider ${
                    isInfected 
                        ? 'bg-red-600/90 text-white border-2 border-red-400/50 shadow-[0_0_30px_rgba(220,38,38,0.5)]' 
                        : 'bg-green-600/90 text-white border-2 border-green-400/50 shadow-[0_0_30px_rgba(34,197,94,0.5)]'
                }`}>
                    {isInfected ? 'YOU ARE THE ZOMBIE' : 'YOU ARE A SURVIVOR'}
                </div>
                
                <h1 className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 drop-shadow-2xl mb-4">
                    {room.name}
                </h1>
                
                <div className="flex flex-col items-center gap-4 mt-4">
                    <div className="text-[11px] uppercase tracking-[0.26em] text-white/60">
                        Game starts in
                    </div>
                    
                    <div className={`text-7xl font-black tabular-nums drop-shadow-2xl ${
                        isInfected 
                            ? 'text-red-400' 
                            : 'text-green-400'
                    }`}>
                        {countdown}
                    </div>
                    
                    <p className={`text-sm font-medium mt-2 ${
                        isInfected ? 'text-red-300/80' : 'text-green-300/80'
                    }`}>
                        {isInfected 
                            ? 'Get ready to hunt the survivors!' 
                            : 'Get ready to run from the zombie!'}
                    </p>
                </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-8 text-white/20 font-mono text-xs tracking-widest">
                TELEPORTING...
            </div>
        </div>
    )
}
