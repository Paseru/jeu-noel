import { useEffect, useState, useRef } from 'react'
import { useGameStore } from '../stores/useGameStore'

export const DeathScreen = () => {
    const { infectedGameState } = useGameStore()
    const playerId = useGameStore((state) => state.playerId)
    const infectedPlayers = useGameStore((state) => state.infectedPlayers)
    
    const [showInfectedMessage, setShowInfectedMessage] = useState(false)
    const wasInfectedRef = useRef(false)
    const prevInfectedCountRef = useRef(0)
    
    // Detect when player becomes infected DURING GAMEPLAY (not at game start)
    useEffect(() => {
        if (!playerId) return
        
        const isPlayerInfected = infectedPlayers.includes(playerId)
        const infectedCount = infectedPlayers.length
        
        // Only show message if:
        // 1. We're in PLAYING state (not STARTING - that's handled by GameStartingLoader)
        // 2. Player just became infected (wasn't before)
        // 3. This is a mid-game infection (infected count increased, meaning someone was attacked)
        if (
            infectedGameState === 'PLAYING' &&
            isPlayerInfected &&
            !wasInfectedRef.current &&
            infectedCount > prevInfectedCountRef.current &&
            prevInfectedCountRef.current > 0
        ) {
            wasInfectedRef.current = true
            setShowInfectedMessage(true)
            const timer = setTimeout(() => setShowInfectedMessage(false), 3000)
            return () => clearTimeout(timer)
        }
        
        // Track infection state
        if (isPlayerInfected) {
            wasInfectedRef.current = true
        }
        prevInfectedCountRef.current = infectedCount
    }, [playerId, infectedPlayers, infectedGameState])
    
    // Reset when game ends
    useEffect(() => {
        if (infectedGameState === 'WAITING' || infectedGameState === 'VOTING') {
            wasInfectedRef.current = false
            prevInfectedCountRef.current = 0
            setShowInfectedMessage(false)
        }
    }, [infectedGameState])

    // Don't show death screen - InfectionLoader handles the transition now
    // This message is just a brief notification after the loader
    if (showInfectedMessage) {
        return (
            <div className="fixed inset-0 z-[12000] flex items-center justify-center pointer-events-none">
                <div className="text-center space-y-4 animate-pulse">
                    <h1 className="text-6xl md:text-7xl font-black tracking-tight text-red-500 drop-shadow-[0_0_35px_rgba(248,113,113,0.8)]">
                        YOU ARE INFECTED
                    </h1>
                    <p className="text-white/80 font-mono text-lg">
                        Hunt down the survivors!
                    </p>
                </div>
            </div>
        )
    }

    return null
}
