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

interface MobileInputState {
    joystick: { x: number, y: number }
    lookDelta: { x: number, y: number }
}

interface ChatMessage {
    id: string
    senderId: string
    senderName: string
    text: string
    timestamp: number
}

interface Room {
    id: string
    name: string
    mapImage: string
    modelPath: string
    maxPlayers: number
    playerCount: number
}

interface GameState {
    phase: 'MENU' | 'PLAYING'
    setPhase: (phase: 'MENU' | 'PLAYING') => void
    socket: Socket | null
    players: Record<string, PlayerState>
    messages: ChatMessage[]
    rooms: Room[]
    currentRoomId: string | null

    playerId: string | null
    nickname: string
    isChatOpen: boolean

    // Mobile Controls
    mobileInput: MobileInputState
    setJoystick: (x: number, y: number) => void
    addLookDelta: (x: number, y: number) => void
    resetLookDelta: () => void

    myCharacterIndex: number
    setMyCharacterIndex: (index: number) => void

    setNickname: (name: string) => void
    setChatOpen: (isOpen: boolean) => void
    setSpeaking: (isSpeaking: boolean) => void

    // Volume Settings
    volumes: {
        music: number
        voice: number
        sfx: number
    }
    setVolume: (type: 'music' | 'voice' | 'sfx', value: number) => void

    connectSocket: () => void
    fetchRooms: () => void
    joinRoom: (roomId: string) => void

    updatePlayer: (id: string, position: [number, number, number], quaternion: [number, number, number, number]) => void
    addPlayer: (player: PlayerState) => void
    removePlayer: (id: string) => void
    setPlayers: (players: Record<string, PlayerState>) => void
    sendMessage: (text: string) => void
    addChatMessage: (message: ChatMessage) => void
}

export const useGameStore = create<GameState>((set, get) => ({
    phase: 'MENU',
    setPhase: (phase) => set({ phase }),
    socket: null,
    players: {},
    messages: [],
    rooms: [],
    currentRoomId: null,
    playerId: null,
    nickname: '',
    isChatOpen: false,

    // Default Volumes
    volumes: {
        music: 0.05, // Default low music
        voice: 1.0,
        sfx: 0.5
    },

    setVolume: (type, value) => set((state) => ({
        volumes: { ...state.volumes, [type]: value }
    })),

    mobileInput: {
        joystick: { x: 0, y: 0 },
        lookDelta: { x: 0, y: 0 }
    },

    setJoystick: (x, y) => set((state) => ({
        mobileInput: { ...state.mobileInput, joystick: { x, y } }
    })),

    addLookDelta: (x, y) => set((state) => ({
        mobileInput: {
            ...state.mobileInput,
            lookDelta: {
                x: state.mobileInput.lookDelta.x + x,
                y: state.mobileInput.lookDelta.y + y
            }
        }
    })),

    resetLookDelta: () => set((state) => ({
        mobileInput: { ...state.mobileInput, lookDelta: { x: 0, y: 0 } }
    })),

    // My Character Index (Assigned by Server)
    myCharacterIndex: 1,
    setMyCharacterIndex: (index) => set({ myCharacterIndex: index }),

    setNickname: (name) => set({ nickname: name }),
    setChatOpen: (isOpen) => set({ isChatOpen: isOpen }),
    setSpeaking: (isSpeaking) => {
        const socket = get().socket
        if (socket) {
            socket.emit('speaking', isSpeaking)
        }
    },

    connectSocket: () => {
        if (get().socket) return

        const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
        const socket = io(serverUrl)

        socket.on('connect', () => {
            console.log('Connected to server:', serverUrl)
            set({ playerId: socket.id })
        })

        socket.on('roomList', (rooms) => {
            set({ rooms })
        })

        socket.on('currentPlayers', (players) => {
            set(() => {
                if (socket.id && players[socket.id]) {
                    return { players, myCharacterIndex: players[socket.id].characterIndex }
                }
                return { players }
            })
        })

        socket.on('newPlayer', (player) => {
            set((state) => {
                const newPlayers = { ...state.players, [player.id]: player }
                if (socket.id === player.id) {
                    return { players: newPlayers, myCharacterIndex: player.characterIndex }
                }
                return { players: newPlayers }
            })
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

    fetchRooms: () => {
        const socket = get().socket
        if (socket) {
            socket.emit('getRooms')
        } else {
            // Ensure socket is connected first
            get().connectSocket()
            // Wait a bit for connection (simple hack, or rely on auto-reconnect logic)
            setTimeout(() => {
                get().socket?.emit('getRooms')
            }, 500)
        }
    },

    joinRoom: (roomId: string) => {
        const socket = get().socket
        if (socket) {
            socket.emit('joinRoom', { roomId, nickname: get().nickname })
            set({ phase: 'PLAYING', currentRoomId: roomId })
        }
    },

    sendMessage: (text: string) => {
        const socket = get().socket
        if (socket) {
            socket.emit('chatMessage', text)
        }
    },

    addChatMessage: (message: ChatMessage) => set((state) => ({
        messages: [...state.messages, message]
    })),

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
