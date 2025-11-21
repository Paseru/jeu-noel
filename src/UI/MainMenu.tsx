import { useState, useEffect } from 'react'
import { useGameStore } from '../stores/useGameStore'

interface MainMenuProps {
    onOpenSettings: () => void
}

export function MainMenu({ onOpenSettings }: MainMenuProps) {
    const [nickname, setNickname] = useState('')
    const [view, setView] = useState<'nickname' | 'serverList'>('nickname')
    const { setNickname: setStoreNickname, joinRoom, fetchRooms, rooms } = useGameStore()

    useEffect(() => {
        const savedNickname = localStorage.getItem('nickname')
        if (savedNickname) {
            setNickname(savedNickname)
        }
    }, [])

    const handlePlayClick = () => {
        if (nickname.trim().length > 0) {
            setStoreNickname(nickname)
            localStorage.setItem('nickname', nickname)
            fetchRooms()
            setView('serverList')
        }
    }

    const handleJoinRoom = (roomId: string) => {
        joinRoom(roomId)
    }

    return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
            <div className="bg-[#1a1a1a] p-8 rounded-2xl border border-white/10 shadow-2xl w-full max-w-4xl">
                <h1 className="text-4xl font-bold text-white mb-8 text-center tracking-wider">
                    NOËL <span className="text-red-500">TOGETHER</span>
                </h1>

                {view === 'nickname' ? (
                    <div className="flex flex-col gap-6 max-w-md mx-auto">
                        <div className="space-y-2">
                            <label className="text-gray-400 text-sm font-medium uppercase tracking-wider ml-1">
                                NICKNAME
                            </label>
                            <input
                                type="text"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                placeholder="Enter your nickname..."
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors text-lg"
                                onKeyDown={(e) => e.key === 'Enter' && handlePlayClick()}
                            />
                        </div>

                        <button
                            onClick={handlePlayClick}
                            disabled={nickname.trim().length === 0}
                            className={`
                                w-full py-4 rounded-xl font-bold text-lg tracking-widest transition-all duration-200
                                ${nickname.trim().length > 0
                                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20 transform hover:scale-[1.02]'
                                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'}
                            `}
                        >
                            PLAY
                        </button>

                        <button
                            onClick={onOpenSettings}
                            className="w-full py-3 rounded-xl font-bold text-lg tracking-widest transition-all duration-200 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-white/5 hover:border-white/20"
                        >
                            SETTINGS
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-white">Select a Server</h2>
                            <button
                                onClick={() => setView('nickname')}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                Back
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {rooms.map((room) => (
                                <div
                                    key={room.id}
                                    onClick={() => handleJoinRoom(room.id)}
                                    className="group relative bg-black/40 rounded-xl overflow-hidden border border-white/10 hover:border-red-500/50 transition-all cursor-pointer hover:shadow-lg hover:shadow-red-900/10"
                                >
                                    {/* Map Preview Image */}
                                    <div className="aspect-video w-full bg-gray-900 relative overflow-hidden">
                                        <img
                                            src={room.mapImage}
                                            alt={room.name}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                            onError={(e) => {
                                                // Fallback if image fails
                                                (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/1a1a1a/FFF?text=No+Image';
                                            }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

                                        {/* Player Count Badge */}
                                        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-xs font-bold text-white border border-white/10 flex items-center gap-1">
                                            <div className={`w-2 h-2 rounded-full ${room.playerCount < room.maxPlayers ? 'bg-green-500' : 'bg-red-500'}`} />
                                            {room.playerCount} / {room.maxPlayers}
                                        </div>
                                    </div>

                                    {/* Room Info */}
                                    <div className="p-4">
                                        <h3 className="text-lg font-bold text-white group-hover:text-red-400 transition-colors">
                                            {room.name}
                                        </h3>
                                        <p className="text-gray-400 text-sm mt-1">
                                            Join the holiday fun!
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {rooms.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                <p>Loading servers...</p>
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-8 text-center text-white/30 text-sm font-mono">
                    v0.1.0 • PRE-ALPHA
                </div>
            </div>
        </div>
    )
}
