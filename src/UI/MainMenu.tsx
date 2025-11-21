import { useState, useEffect } from 'react'
import { useGameStore } from '../stores/useGameStore'

interface MainMenuProps {
    onOpenSettings: () => void
}

export default function MainMenu({ onOpenSettings }: MainMenuProps) {
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
        <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm overflow-hidden">
            <div className="text-center mb-12 landscape:mb-4 landscape:scale-75 origin-bottom transition-transform">
                <h1 className="text-8xl landscape:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 drop-shadow-2xl">
                    Frozen Hollow
                </h1>
                <p className="text-white/60 text-xl landscape:text-lg font-mono tracking-[0.5em] mt-4 uppercase">
                    Multiplayer Experience
                </p>
            </div>

            {view === 'nickname' ? (
                <div className="flex flex-col gap-6 w-80 landscape:scale-75 origin-top transition-transform">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="NICKNAME"
                            maxLength={15}
                            value={nickname}
                            className="w-full px-8 py-4 bg-white/10 text-white font-bold text-xl rounded-full border border-white/20 focus:border-white focus:bg-white/20 outline-none transition-all text-center placeholder:text-white/30"
                            onChange={(e) => setNickname(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handlePlayClick()}
                        />
                    </div>

                    <button
                        disabled={!nickname.trim()}
                        onClick={handlePlayClick}
                        className="group relative px-8 py-4 bg-white text-black font-bold text-xl rounded-full hover:scale-105 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none"
                    >
                        <span className="relative z-10">PLAY</span>
                        <div className="absolute inset-0 rounded-full bg-white blur-md opacity-50 group-hover:opacity-80 transition-opacity" />
                    </button>

                    <button
                        onClick={onOpenSettings}
                        className="px-8 py-4 bg-white/10 text-white font-bold text-xl rounded-full hover:bg-white/20 backdrop-blur-md border border-white/10 transition-all duration-300 hover:scale-105"
                    >
                        SETTINGS
                    </button>
                </div>
            ) : (
                <div className="w-full max-w-6xl px-8 animate-in fade-in zoom-in duration-300">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-3xl font-bold text-white tracking-tight">Select Server</h2>
                        <button
                            onClick={() => setView('nickname')}
                            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-md border border-white/10"
                        >
                            Back
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {rooms.map((room) => (
                            <div
                                key={room.id}
                                onClick={() => handleJoinRoom(room.id)}
                                className="group relative bg-black/40 rounded-2xl overflow-hidden border border-white/10 hover:border-white/40 transition-all cursor-pointer hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:-translate-y-1"
                            >
                                {/* Map Preview Image */}
                                <div className="aspect-video w-full bg-gray-900 relative overflow-hidden">
                                    <img
                                        src={room.mapImage}
                                        alt={room.name}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/1a1a1a/FFF?text=No+Image';
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                                    {/* Player Count Badge */}
                                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white border border-white/10 flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${room.playerCount < room.maxPlayers ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]' : 'bg-red-500'}`} />
                                        {room.playerCount} / {room.maxPlayers}
                                    </div>
                                </div>

                                {/* Room Info */}
                                <div className="absolute bottom-0 left-0 w-full p-5">
                                    <h3 className="text-xl font-bold text-white group-hover:text-white transition-colors drop-shadow-lg">
                                        {room.name}
                                    </h3>
                                </div>
                            </div>
                        ))}
                    </div>

                    {rooms.length === 0 && (
                        <div className="text-center py-12 text-white/50 font-mono">
                            <p>Loading servers...</p>
                        </div>
                    )}
                </div>
            )}

            <div className="absolute bottom-8 landscape:bottom-2 text-white/30 text-sm font-mono">
                v0.1.0 • PRE-ALPHA
            </div>
        </div>
    )
}
