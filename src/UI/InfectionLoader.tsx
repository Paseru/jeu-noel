import { useEffect, useState } from 'react'
import { useGameStore } from '../stores/useGameStore'

export default function InfectionLoader() {
    const { currentRoomId, rooms, infectionTransitionEnd, clearInfectionTransition } = useGameStore()
    const room = rooms.find(r => r.id === currentRoomId)
    
    const [countdown, setCountdown] = useState<number>(3)
    
    useEffect(() => {
        if (!infectionTransitionEnd) return
        
        const updateCountdown = () => {
            const remaining = Math.max(0, Math.ceil((infectionTransitionEnd - Date.now()) / 1000))
            setCountdown(remaining)
            
            // When countdown reaches 0, clear the transition
            if (remaining <= 0) {
                clearInfectionTransition()
            }
        }
        
        updateCountdown()
        const interval = setInterval(updateCountdown, 100)
        return () => clearInterval(interval)
    }, [infectionTransitionEnd, clearInfectionTransition])

    if (!room) {
        return (
            <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-black text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 relative">
                        <div className="absolute inset-0 border-4 border-red-500/20 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-t-red-500 rounded-full animate-spin"></div>
                    </div>
                    <p className="text-red-400/60 font-mono tracking-[0.3em] text-sm animate-pulse">
                        TRANSFORMING...
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-black text-white overflow-hidden">
            {/* Background Image with Blur and Red Tint */}
            <div className="absolute inset-0 overflow-hidden">
                <img 
                    src={room.mapImage} 
                    alt={room.name}
                    className="w-full h-full object-cover opacity-30 blur-sm scale-110"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/1920x1080/1a1a1a/FFF?text=Loading';
                    }}
                />
            </div>
            
            {/* Dark Red Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-red-900/80 via-black/70 to-black/90" />
            
            {/* Blood drip effect */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-red-800/50 to-transparent" />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                {/* Infection Badge */}
                <div className="mb-6 px-8 py-3 rounded-full text-2xl font-black uppercase tracking-wider bg-red-600/90 text-white border-2 border-red-400/50 shadow-[0_0_50px_rgba(220,38,38,0.6)] animate-pulse">
                    YOU HAVE BEEN INFECTED
                </div>
                
                <div className="flex flex-col items-center gap-4 mt-4">
                    <div className="text-[11px] uppercase tracking-[0.26em] text-red-300/60">
                        Respawning in
                    </div>
                    
                    <div className="text-8xl font-black tabular-nums text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]">
                        {countdown}
                    </div>
                    
                    <p className="text-lg font-medium mt-4 text-red-300/80">
                        You are now a zombie. Hunt the survivors!
                    </p>
                </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-8 text-red-400/30 font-mono text-xs tracking-widest">
                TELEPORTING TO ZOMBIE SPAWN...
            </div>
        </div>
    )
}
