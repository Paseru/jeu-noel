import { create } from 'zustand'
import { io, Socket } from 'socket.io-client'

interface PlayerState {
    id: string
    position: [number, number, number]
    quaternion: [number, number, number, number]
    isMoving?: boolean
    isRunning?: boolean
    nickname: string
    isSpeaking?: boolean
    characterIndex: number
}

interface ChatMessage {
    id: string
    senderId: string
    senderName: string
    text: string
    timestamp: number
}

interface GameState {
    phase: 'MENU' | 'PLAYING'
    socket: Socket | null
    players: Record<string, PlayerState>
    messages: ChatMessage[]

    playerId: string | null
    nickname: string

    setNickname: (name: string) => void
    setSpeaking: (isSpeaking: boolean) => void
    startPlaying: () => void
    connectSocket: () => void
    updatePlayer: (id: string, position: [number, number, number], quaternion: [number, number, number, number]) => void
    addPlayer: (player: PlayerState) => void
    removePlayer: (id: string) => void
    setPlayers: (players: Record<string, PlayerState>) => void
    sendMessage: (text: string) => void
}

export const useGameStore = create<GameState>((set, get) => ({
    phase: 'MENU',
    socket: null,
    players: {},
    messages: [],
    playerId: null,
    nickname: 'Player',

    setNickname: (name) => set({ nickname: name }),
    setSpeaking: (isSpeaking) => {
        const socket = get().socket
        if (socket) {
            socket.emit('speaking', isSpeaking)
        }
    },

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
            // Send initial player info including nickname
            socket.emit('initPlayer', {
                nickname: get().nickname,
                characterIndex: 1
            })
        })

        socket.on('currentPlayers', (players) => {
            set({ players })
        })

        socket.on('newPlayer', (player) => {
            set((state) => ({
                players: { ...state.players, [player.id]: player }
            }))
        })

        socket.on('playerMoved', ({ id, position, quaternion, isMoving, isRunning }) => {
            set((state) => {
                if (!state.players[id]) return state
                return {
                    players: {
                        ...state.players,
                        [id]: {
                            ...state.players[id],
                            position,
                            quaternion,
                            isMoving,
                            isRunning
                        }
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

        socket.on('chatMessage', (message: ChatMessage) => {
            set((state) => ({
                messages: [...state.messages, message]
            }))
        })

        socket.on('playerSpeaking', ({ id, isSpeaking }) => {
            set((state) => {
                if (!state.players[id]) return state
                return {
                    players: {
                        ...state.players,
                        [id]: {
                            ...state.players[id],
                            isSpeaking
                        }
                    }
                }
            })
        })

        set({ socket })
    },

    sendMessage: (text: string) => {
        const socket = get().socket
        if (socket) {
            socket.emit('chatMessage', text)
        }
    },

    updatePlayer: (_id, _position, _quaternion) => {
        // This is for local updates if needed, but mostly handled by socket events
    },

    addPlayer: (player) => set((state) => ({ players: { ...state.players, [player.id]: player } })),
    removePlayer: (id) => set((state) => {
        const { [id]: _, ...rest } = state.players
        return { players: rest }
    }),
    setPlayers: (players) => set({ players })
}))
