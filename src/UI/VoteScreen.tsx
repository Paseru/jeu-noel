import { useEffect, useState } from 'react'
import { useGameStore } from '../stores/useGameStore'

export const VoteScreen = () => {
    const infectedGameState = useGameStore((state) => state.infectedGameState)
    const voteOptions = useGameStore((state) => state.voteOptions)
    const votes = useGameStore((state) => state.votes)
    const voteEnd = useGameStore((state) => state.voteEnd)
    const myVote = useGameStore((state) => state.myVote)
    const vote = useGameStore((state) => state.vote)
    
    const [countdown, setCountdown] = useState<number | null>(null)
    
    useEffect(() => {
        if (!voteEnd) {
            setCountdown(null)
            return
        }
        
        const updateCountdown = () => {
            const remaining = Math.max(0, Math.ceil((voteEnd - Date.now()) / 1000))
            setCountdown(remaining)
        }
        
        updateCountdown()
        const interval = setInterval(updateCountdown, 100)
        return () => clearInterval(interval)
    }, [voteEnd])
    
    if (infectedGameState !== 'VOTING' || voteOptions.length === 0) return null
    
    const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0)
    
    return (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-4xl px-8">
                <div className="text-center mb-8">
                    <h2 className="text-4xl font-black text-white mb-2">VOTE FOR NEXT MAP</h2>
                    {countdown !== null && (
                        <div className="text-xl text-amber-400 font-bold">
                            {countdown}s remaining
                        </div>
                    )}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {voteOptions.map((map) => {
                        const mapVotes = votes[map.id] || 0
                        const isSelected = myVote === map.id
                        const percentage = totalVotes > 0 ? Math.round((mapVotes / totalVotes) * 100) : 0
                        
                        return (
                            <button
                                key={map.id}
                                onClick={() => vote(map.id)}
                                className={`group relative rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                                    isSelected 
                                        ? 'border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.4)] scale-105' 
                                        : 'border-white/20 hover:border-white/50 hover:scale-102'
                                }`}
                            >
                                <div className="aspect-video w-full bg-gray-900 relative overflow-hidden">
                                    <img
                                        src={map.mapImage}
                                        alt={map.name}
                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/1a1a1a/FFF?text=No+Image'
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                                    
                                    {/* Vote count */}
                                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur px-2 py-1 rounded text-sm font-bold text-white">
                                        {mapVotes} vote{mapVotes !== 1 ? 's' : ''}
                                    </div>
                                    
                                    {/* Selected checkmark */}
                                    {isSelected && (
                                        <div className="absolute top-2 left-2 bg-amber-400 rounded-full p-1">
                                            <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    )}
                                    
                                    {/* Progress bar */}
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                                        <div 
                                            className="h-full bg-amber-400 transition-all duration-300"
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                                
                                <div className="absolute bottom-0 left-0 w-full p-3">
                                    <h3 className="text-sm font-bold text-white drop-shadow-lg">
                                        {map.name}
                                    </h3>
                                </div>
                            </button>
                        )
                    })}
                </div>
                
                <div className="text-center mt-6 text-white/50 text-sm">
                    Click on a map to vote • Your vote: {myVote ? voteOptions.find(m => m.id === myVote)?.name : 'None'}
                </div>
            </div>
        </div>
    )
}

export default VoteScreen
