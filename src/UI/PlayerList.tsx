import { useGameStore } from '../stores/useGameStore'
import { useVoiceStore } from '../stores/useVoiceStore'

export default function PlayerList() {
    const players = useGameStore((state) => state.players)
    const myId = useGameStore((state) => state.playerId)
    const { mutedPlayers, toggleMute } = useVoiceStore()

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-black/80 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                        <span className="text-3xl">👥</span>
                        Players Connected
                    </h2>
                    <div className="px-4 py-1 rounded-full bg-white/10 text-white/60 text-sm font-mono border border-white/5">
                        {Object.keys(players).length} Online
                    </div>
                </div>

                {/* List */}
                <div className="max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
                    <div className="flex flex-col gap-2">
                        {Object.values(players).map((player) => {
                            const isMe = player.id === myId
                            const isMuted = mutedPlayers[player.id]

                            return (
                                <div
                                    key={player.id}
                                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isMe
                                            ? 'bg-white/10 border-white/20'
                                            : 'bg-white/5 border-white/5 hover:bg-white/10'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${isMe ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'
                                            }`}>
                                            {player.nickname.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-white text-lg">
                                                    {player.nickname}
                                                </span>
                                                {isMe && (
                                                    <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                                                        YOU
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-white/40 font-mono mt-0.5">
                                                ID: {player.id.slice(0, 8)}...
                                            </div>
                                        </div>
                                    </div>

                                    {!isMe && (
                                        <button
                                            onClick={() => toggleMute(player.id)}
                                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${isMuted
                                                    ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30'
                                                    : 'bg-white/10 text-white border border-white/10 hover:bg-white/20'
                                                }`}
                                        >
                                            {isMuted ? (
                                                <>
                                                    <span>🔇</span> UNMUTE
                                                </>
                                            ) : (
                                                <>
                                                    <span>🔊</span> MUTE
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-white/5 text-center text-white/30 text-sm font-mono">
                    Press [TAB] to close
                </div>
            </div>
        </div>
    )
}
