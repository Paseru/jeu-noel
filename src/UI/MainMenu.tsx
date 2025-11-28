import { useState, useEffect } from 'react'
import { useGameStore } from '../stores/useGameStore'

interface MainMenuProps {
    onOpenSettings: () => void
}

export default function MainMenu({ onOpenSettings }: MainMenuProps) {
    const [nickname, setNickname] = useState('')
    const { setNickname: setStoreNickname, joinRoom, connectSocket } = useGameStore()

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
            connectSocket()
            
            // Wait for socket to be connected before joining
            const checkSocket = setInterval(() => {
                const state = useGameStore.getState()
                const socket = state.socket
                if (socket?.connected) {
                    clearInterval(checkSocket)
                    // Fetch rooms first to populate the list for Loader
                    socket.emit('getRooms')
                    // Small delay then join
                    setTimeout(() => {
                        joinRoom('server-assault')
                    }, 100)
                }
            }, 100)
            
            // Safety timeout after 5 seconds
            setTimeout(() => clearInterval(checkSocket), 5000)
        }
    }

    return (
        <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm overflow-hidden">
            <div className="text-center mb-12 landscape:mb-4 landscape:scale-75 origin-bottom transition-transform">
                <h1 className="text-8xl landscape:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 drop-shadow-2xl">
                    Frozen Hollow
                </h1>
                <p className="text-white/60 text-xl landscape:text-lg font-mono tracking-[0.5em] mt-4 uppercase">
                    Infected Mode
                </p>
            </div>

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

            <div className="absolute bottom-8 landscape:bottom-2 text-white/30 text-sm font-mono">
                v0.2.0 • INFECTED MODE
            </div>
        </div>
    )
}
