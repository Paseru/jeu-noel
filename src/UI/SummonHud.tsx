import { useMemo } from 'react'
import { useGameStore } from '../stores/useGameStore'
import { SUMMON_COUNTDOWN_MS, SUMMON_RADIUS } from '../Enemies/ZombieSummonZone'

const formatSeconds = (ms: number) => Math.max(0, Math.ceil(ms / 1000))

const SummonHud = () => {
    const phase = useGameStore((state) => state.phase)
    const mapLoaded = useGameStore((state) => state.mapLoaded)
    const gather = useGameStore((state) => state.gather)
    const roundActive = useGameStore((state) => state.roundActive)
    const zombies = useGameStore((state) => state.zombies)
    const players = useGameStore((state) => state.players)

    if (phase !== 'PLAYING' || !mapLoaded) return null

    const aliveCount = useMemo(
        () => Object.values(players).filter((p) => p && !p.isDead).length,
        [players]
    )
    const totalCount = useMemo(
        () => Object.keys(players).length,
        [players]
    )

    const showAlive = (roundActive || zombies.length > 0) && totalCount > 0
    const canSummon = !roundActive && zombies.length === 0
    const showCountdown = canSummon && gather.status === 'countdown' && gather.countdownMs !== null
    const countdownSeconds = showCountdown && gather.countdownMs !== null
        ? formatSeconds(gather.countdownMs)
        : null
    const progress = showCountdown && gather.countdownMs !== null
        ? Math.min(1, Math.max(0, 1 - gather.countdownMs / SUMMON_COUNTDOWN_MS))
        : 0

    const insideDisplayTotal = gather.alive || totalCount || 1

    return (
        <>
            {canSummon && (
                <div className="pointer-events-none fixed top-6 left-1/2 z-[1200] -translate-x-1/2 flex flex-col items-center gap-2">
                    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-red-700/70 via-red-600/70 to-red-700/70 px-5 py-4 shadow-[0_12px_45px_rgba(255,0,80,0.35)] backdrop-blur-lg">
                        <div className="text-[11px] uppercase tracking-[0.26em] text-white/70">Cercle de rassemblement</div>

                        {showCountdown && countdownSeconds !== null ? (
                            <>
                                <div className="mt-1 flex items-end gap-3">
                                    <span className="text-4xl font-black tabular-nums text-white">{countdownSeconds}s</span>
                                    <span className="text-sm text-white/70">avant l'arrivée du zombie</span>
                                </div>

                                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                                    <div
                                        className="h-full w-full origin-left bg-gradient-to-r from-red-300 via-amber-300 to-amber-100"
                                        style={{ transform: `scaleX(${progress})` }}
                                    />
                                </div>

                                <div className="mt-2 flex items-center gap-2 text-xs text-white/70">
                                    <span className="inline-flex h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_12px_rgba(190,242,100,0.8)]" />
                                    Joueurs dans le cercle : {gather.inside}/{insideDisplayTotal}
                                </div>
                            </>
                        ) : (
                            <div className="mt-1 flex items-center gap-2 text-sm text-white/80">
                                <span className="inline-flex h-2 w-2 animate-ping rounded-full bg-red-200" />
                                <span>Placez-vous dans le cercle rouge (rayon {SUMMON_RADIUS} m) pour lancer la chasse</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showAlive && (
                <div className="pointer-events-none fixed top-6 right-6 z-[1200]">
                    <div className="rounded-2xl border border-white/10 bg-black/60 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-md">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-white/60">Players Alive</div>
                        <div className="mt-1 flex items-baseline gap-2 text-white">
                            <span className="text-3xl font-black tabular-nums">{aliveCount}</span>
                            <span className="text-lg text-white/50">/ {totalCount}</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default SummonHud
