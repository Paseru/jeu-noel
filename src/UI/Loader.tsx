import { useGameStore } from '../stores/useGameStore'

export default function Loader() {
    const { currentRoomId, rooms } = useGameStore()
    const room = rooms.find(r => r.id === currentRoomId)

    if (!room) return null

    return (
        <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-black text-white overflow-hidden">
            {/* Background Image with Blur */}
            <div className="absolute inset-0 overflow-hidden">
                <img 
                    src={room.mapImage} 
                    alt={room.name}
                    className="w-full h-full object-cover opacity-50 blur-sm scale-110 animate-[pulse_4s_ease-in-out_infinite]"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/1920x1080/1a1a1a/FFF?text=Loading';
                    }}
                />
            </div>
            
            {/* Dark Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/90" />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                <h1 className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 drop-shadow-2xl mb-4">
                    {room.name}
                </h1>
                
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 relative">
                        <div className="absolute inset-0 border-4 border-white/20 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-t-white rounded-full animate-spin"></div>
                    </div>
                    
                    <p className="text-white/60 font-mono tracking-[0.3em] text-sm animate-pulse">
                        LOADING ENVIRONMENT...
                    </p>
                </div>
            </div>

            {/* Footer/Version */}
            <div className="absolute bottom-8 text-white/20 font-mono text-xs tracking-widest">
                PREPARING GAME ASSETS
            </div>
        </div>
    )
}
