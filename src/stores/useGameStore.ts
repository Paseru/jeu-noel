import { create } from 'zustand'
import { io, Socket } from 'socket.io-client'

interface PlayerState {
    id: string
    position: [number, number, number]
    rotation: [number, number, number]
    isMoving?: boolean
    isRunning?: boolean
    characterIndex: number
}

interface GameState {
    phase: 'MENU' | 'PLAYING'
    socket: Socket | null
    players: Record<string, PlayerState>

    playerId: string | null

    startPlaying: () => void
    connectSocket: () => void
    updatePlayer: (id: string, position: [number, number, number], rotation: [number, number, number]) => void
    addPlayer: (player: PlayerState) => void
    removePlayer: (id: string) => void
    setPlayers: (players: Record<string, PlayerState>) => void
}

export const useGameStore = create<GameState>((set, get) => ({
    phase: 'MENU',
    socket: null,
    players: {},
    playerId: null,

    startPlaying: () => {
        set({ phase: 'PLAYING' })
        get().connectSocket()
    },

    connectSocket: () => {
        if (get().socket) return

        const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
        const socket = io(serverUrl)

        socket.on('connect', () => {
            console.log('Connected to server:', serverUrl)
            set({ playerId: socket.id })
        })

        socket.on('currentPlayers', (players) => {
            set({ players })
        })

        socket.on('newPlayer', (player) => {
            set((state) => ({
                players: { ...state.players, [player.id]: player }
            }))
        })

        socket.on('playerMoved', ({ id, position, rotation }) => {
            set((state) => {
                if (!state.players[id]) return state
                return {
                    players: {
                        ...state.players,
                        [id]: { ...state.players[id], position, rotation }
                    }
                }
            })
        })

        socket.on('updatePlayerState', (player) => {
            set((state) => ({
                players: { ...state.players, [player.id]: player }
            }))
        })

        socket.on('playerDisconnected', (id) => {
            set((state) => {
                const newPlayers = { ...state.players }
                delete newPlayers[id]
                return { players: newPlayers }
            })
        })

        set({ socket })
    },

    updatePlayer: (_id, _position, _rotation) => {
        // This is for local updates if needed, but mostly handled by socket events
    },

    addPlayer: (player) => set((state) => ({ players: { ...state.players, [player.id]: player } })),
    removePlayer: (id) => set((state) => {
        const { [id]: _, ...rest } = state.players
        return { players: rest }
    }),
    setPlayers: (players) => set({ players })
}))
