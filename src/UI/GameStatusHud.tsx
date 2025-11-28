import { useEffect, useState } from 'react'
import { useGameStore } from '../stores/useGameStore'

export const GameStatusHud = () => {
    const phase = useGameStore((state) => state.phase)
    const mapLoaded = useGameStore((state) => state.mapLoaded)
    const infectedGameState = useGameStore((state) => state.infectedGameState)
    const countdownEnd = useGameStore((state) => state.countdownEnd)
    const players = useGameStore((state) => state.players)
    const infectedPlayers = useGameStore((state) => state.infectedPlayers)
    const isInfected = useGameStore((state) => state.isInfected)
    const minPlayers = useGameStore((state) => state.minPlayers)
    
    const [countdown, setCountdown] = useState<number | null>(null)
    
    const playerCount = Object.keys(players).length
    const survivorCount = playerCount - infectedPlayers.length
    
    useEffect(() => {
        if (!countdownEnd) {
            setCountdown(null)
            return
        }
        
        const updateCountdown = () => {
            const remaining = Math.max(0, Math.ceil((countdownEnd - Date.now()) / 1000))
            setCountdown(remaining)
        }
        
        updateCountdown()
        const interval = setInterval(updateCountdown, 100)
        return () => clearInterval(interval)
    }, [countdownEnd])
    
    if (phase !== 'PLAYING' || !mapLoaded) return null
    
    // WAITING state
    if (infectedGameState === 'WAITING') {
        return (
            <div className="pointer-events-none fixed top-6 left-1/2 z-[1200] -translate-x-1/2">
                <div className="rounded-2xl border border-white/10 bg-black/70 px-6 py-4 shadow-lg backdrop-blur-lg">
                    <div className="text-center">
                        <div className="text-[11px] uppercase tracking-[0.26em] text-white/60 mb-2">
                            Waiting for players
                        </div>
                        <div className="text-3xl font-black tabular-nums text-white">
                            {playerCount} / {minPlayers}
                        </div>
                        {playerCount < minPlayers && (
                            <div className="mt-2 text-sm text-amber-400/80">
                                Need {minPlayers - playerCount} more player{minPlayers - playerCount > 1 ? 's' : ''} to start
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }
    
    // COUNTDOWN state
    if (infectedGameState === 'COUNTDOWN' && countdown !== null) {
        return (
            <div className="pointer-events-none fixed top-6 left-1/2 z-[1200] -translate-x-1/2">
                <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-900/70 via-amber-800/70 to-amber-900/70 px-8 py-5 shadow-[0_12px_45px_rgba(245,158,11,0.25)] backdrop-blur-lg">
                    <div className="text-center">
                        <div className="text-[11px] uppercase tracking-[0.26em] text-amber-200/70 mb-1">
                            Game starting in
                        </div>
                        <div className="text-5xl font-black tabular-nums text-white drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">
                            {countdown}s
                        </div>
                        <div className="mt-3 text-sm text-amber-200/60">
                            {playerCount} players ready
                        </div>
                    </div>
                </div>
            </div>
        )
    }
    
    // STARTING state - don't show HUD, GameStartingLoader handles it
    if (infectedGameState === 'STARTING') {
        return null
    }
    
    // PLAYING state
    if (infectedGameState === 'PLAYING') {
        return (
            <div className="pointer-events-none fixed top-6 left-1/2 z-[1200] -translate-x-1/2 flex flex-col items-center gap-3">
                {/* Role indicator */}
                <div className={`rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wider ${
                    isInfected 
                        ? 'bg-red-600/80 text-white border border-red-400/50' 
                        : 'bg-green-600/80 text-white border border-green-400/50'
                }`}>
                    {isInfected ? 'INFECTED' : 'SURVIVOR'}
                </div>
                
                {/* Survivor count */}
                <div className="rounded-2xl border border-white/10 bg-black/70 px-6 py-3 shadow-lg backdrop-blur-lg">
                    <div className="flex items-center gap-4">
                        <div className="text-center">
                            <div className="text-[10px] uppercase tracking-wider text-green-400/70">Survivors</div>
                            <div className="text-2xl font-black tabular-nums text-green-400">
                                {survivorCount}
                            </div>
                        </div>
                        <div className="h-8 w-px bg-white/20" />
                        <div className="text-center">
                            <div className="text-[10px] uppercase tracking-wider text-red-400/70">Infected</div>
                            <div className="text-2xl font-black tabular-nums text-red-400">
                                {infectedPlayers.length}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
    
    return null
}

export default GameStatusHud
