import { useEffect, useState } from 'react'
import { useGameStore } from '../stores/useGameStore'

export const DeathScreen = () => {
    const { infectedGameState } = useGameStore()
    const playerId = useGameStore((state) => state.playerId)
    const infectedPlayers = useGameStore((state) => state.infectedPlayers)
    
    const [showInfectedMessage, setShowInfectedMessage] = useState(false)
    const [wasInfected, setWasInfected] = useState(false)
    
    // Detect when player becomes infected
    useEffect(() => {
        if (playerId && infectedPlayers.includes(playerId) && !wasInfected && infectedGameState === 'PLAYING') {
            setWasInfected(true)
            setShowInfectedMessage(true)
            // Hide message after 3 seconds
            const timer = setTimeout(() => setShowInfectedMessage(false), 3000)
            return () => clearTimeout(timer)
        }
    }, [playerId, infectedPlayers, wasInfected, infectedGameState])
    
    // Reset wasInfected when game state changes
    useEffect(() => {
        if (infectedGameState !== 'PLAYING') {
            setWasInfected(false)
        }
    }, [infectedGameState])

    // Show "You are infected" message briefly when becoming a zombie
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

    // Don't show death screen during infected mode - players become zombies instead
    return null
}
