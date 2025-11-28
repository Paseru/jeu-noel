import { useEffect } from 'react'
import { useGameStore } from '../stores/useGameStore'

export const SpectatorHud = () => {
    const isSpectator = useGameStore((state) => state.isSpectator)
    const spectatingPlayerId = useGameStore((state) => state.spectatingPlayerId)
    const players = useGameStore((state) => state.players)
    const nextSpectatorTarget = useGameStore((state) => state.nextSpectatorTarget)
    const prevSpectatorTarget = useGameStore((state) => state.prevSpectatorTarget)
    const playerId = useGameStore((state) => state.playerId)
    const infectedGameState = useGameStore((state) => state.infectedGameState)
    
    const spectatingPlayer = spectatingPlayerId ? players[spectatingPlayerId] : null
    const otherPlayers = Object.values(players).filter(p => p.id !== playerId)
    
    useEffect(() => {
        if (!isSpectator) return
        
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                nextSpectatorTarget()
            } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                prevSpectatorTarget()
            }
        }
        
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isSpectator, nextSpectatorTarget, prevSpectatorTarget])
    
    // Auto-select first player if none selected
    useEffect(() => {
        if (isSpectator && !spectatingPlayerId && otherPlayers.length > 0) {
            useGameStore.getState().setSpectatingPlayer(otherPlayers[0].id)
        }
    }, [isSpectator, spectatingPlayerId, otherPlayers])
    
    if (!isSpectator || infectedGameState !== 'PLAYING') return null
    
    return (
        <>
            {/* Spectator banner */}
            <div className="pointer-events-none fixed top-20 left-1/2 z-[1200] -translate-x-1/2">
                <div className="rounded-xl border border-blue-500/30 bg-blue-900/70 px-6 py-3 shadow-lg backdrop-blur-lg">
                    <div className="text-center">
                        <div className="text-[10px] uppercase tracking-[0.26em] text-blue-200/70 mb-1">
                            Spectating
                        </div>
                        <div className="text-xl font-bold text-white">
                            {spectatingPlayer?.nickname || 'No player'}
                        </div>
                        {spectatingPlayer?.isInfected && (
                            <span className="text-xs text-red-400 font-semibold">(INFECTED)</span>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Controls hint */}
            <div className="pointer-events-none fixed bottom-6 left-1/2 z-[1200] -translate-x-1/2">
                <div className="rounded-xl border border-white/10 bg-black/60 px-4 py-2 backdrop-blur-lg">
                    <div className="flex items-center gap-4 text-sm text-white/70">
                        <div className="flex items-center gap-2">
                            <kbd className="px-2 py-1 bg-white/10 rounded text-xs font-mono">A</kbd>
                            <span>Previous</span>
                        </div>
                        <div className="h-4 w-px bg-white/20" />
                        <div className="flex items-center gap-2">
                            <kbd className="px-2 py-1 bg-white/10 rounded text-xs font-mono">D</kbd>
                            <span>Next</span>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Player list */}
            <div className="fixed right-4 top-1/2 -translate-y-1/2 z-[1200]">
                <div className="rounded-xl border border-white/10 bg-black/60 p-3 backdrop-blur-lg max-h-[60vh] overflow-y-auto">
                    <div className="text-[10px] uppercase tracking-wider text-white/50 mb-2 px-1">
                        Players ({otherPlayers.length})
                    </div>
                    <div className="space-y-1">
                        {otherPlayers.map((player) => (
                            <button
                                key={player.id}
                                onClick={() => useGameStore.getState().setSpectatingPlayer(player.id)}
                                className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                                    spectatingPlayerId === player.id
                                        ? 'bg-blue-600/50 text-white'
                                        : 'hover:bg-white/10 text-white/70'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${
                                        player.isInfected ? 'bg-red-500' : 'bg-green-500'
                                    }`} />
                                    <span className="truncate">{player.nickname}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Joining next round message */}
            <div className="pointer-events-none fixed bottom-20 left-1/2 z-[1200] -translate-x-1/2">
                <div className="text-white/50 text-sm">
                    You will join the next round
                </div>
            </div>
        </>
    )
}

export default SpectatorHud
