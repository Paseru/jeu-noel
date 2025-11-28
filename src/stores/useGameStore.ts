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
    isDead?: boolean
    isInfected?: boolean
    isSpectator?: boolean
}

interface MobileInputState {
    joystick: { x: number, y: number }
    lookDelta: { x: number, y: number }
    isJumping: boolean
    isRunning: boolean
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
    navMeshPath?: string
    maxPlayers: number
    playerCount: number
    scale?: number
    spawnPoint?: [number, number, number]
    zombieSpawnPoint?: [number, number, number]
}

interface MapVoteOption {
    id: string
    name: string
    mapImage: string
}

type InfectedGameState = 'WAITING' | 'COUNTDOWN' | 'STARTING' | 'PLAYING' | 'VOTING'

interface GameState {
    phase: 'MENU' | 'PLAYING'
    setPhase: (phase: 'MENU' | 'PLAYING') => void
    socket: Socket | null
    players: Record<string, PlayerState>
    
    // Infected mode state
    infectedGameState: InfectedGameState
    countdownEnd: number | null
    infectedPlayers: string[]
    isInfected: boolean
    isSpectator: boolean
    spectatingPlayerId: string | null
    survivorCount: number
    minPlayers: number
    
    // Voting
    voteOptions: MapVoteOption[]
    votes: Record<string, number>
    voteEnd: number | null
    myVote: string | null
    
    // Pending spawn points (set during STARTING phase)
    pendingSpawnPoint: [number, number, number] | null
    pendingZombieSpawnPoint: [number, number, number] | null
    startingCountdownEnd: number | null
    
    // Infection transition (when player gets infected mid-game)
    isBeingInfected: boolean
    infectionTransitionEnd: number | null
    pendingInfectionSpawn: [number, number, number] | null
    clearInfectionTransition: () => void
    
    isPlayerDead: boolean
    setPlayerDead: (dead: boolean) => void
    movementLocked: boolean
    movementLockSources: string[]
    lockMovement: (source: string) => void
    unlockMovement: (source: string) => void
    forcedCameraMode: 'FIRST' | 'THIRD' | null
    cameraForceSources: string[]
    forceCameraMode: (mode: 'FIRST' | 'THIRD', source: string) => void
    releaseCameraMode: (source: string) => void
    killCamTarget: [number, number, number] | null
    setKillCamTarget: (target: [number, number, number] | null) => void
    mapLoaded: boolean
    setMapLoaded: (loaded: boolean) => void
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
    setMobileJump: (isJumping: boolean) => void
    setMobileRun: (isRunning: boolean) => void

    myCharacterIndex: number
    setMyCharacterIndex: (index: number) => void

    setNickname: (name: string) => void
    setChatOpen: (isOpen: boolean) => void
    setSpeaking: (isSpeaking: boolean) => void

    // Debug Mode
    isDebugMode: boolean
    toggleDebugMode: () => void

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
    leaveRoom: () => void
    
    // Attack (for infected players)
    attack: (targetId: string) => void
    
    // Vote
    vote: (mapId: string) => void
    
    // Spectator
    setSpectatingPlayer: (playerId: string | null) => void
    nextSpectatorTarget: () => void
    prevSpectatorTarget: () => void

    updatePlayer: (id: string, position: [number, number, number], quaternion: [number, number, number, number]) => void
    addPlayer: (player: PlayerState) => void
    removePlayer: (id: string) => void
    setPlayers: (players: Record<string, PlayerState>) => void
    sendMessage: (text: string) => void
    addChatMessage: (message: ChatMessage) => void

    setLocalPlayerTransform: (
        position: [number, number, number],
        quaternion: [number, number, number, number],
        isMoving: boolean,
        isRunning: boolean
    ) => void

    // Interaction System
    interactionText: string | null
    setInteractionText: (text: string | null) => void
}

export const useGameStore = create<GameState>((set, get) => ({
    phase: 'MENU',
    setPhase: (phase) => set({ phase }),
    socket: null,
    players: {},
    
    // Infected mode defaults
    infectedGameState: 'WAITING',
    countdownEnd: null,
    infectedPlayers: [],
    isInfected: false,
    isSpectator: false,
    spectatingPlayerId: null,
    survivorCount: 0,
    minPlayers: 3,
    
    // Voting defaults
    voteOptions: [],
    votes: {},
    voteEnd: null,
    myVote: null,
    
    // Pending spawn points defaults
    pendingSpawnPoint: null,
    pendingZombieSpawnPoint: null,
    startingCountdownEnd: null,
    
    // Infection transition defaults
    isBeingInfected: false,
    infectionTransitionEnd: null,
    pendingInfectionSpawn: null,
    clearInfectionTransition: () => set({
        isBeingInfected: false,
        infectionTransitionEnd: null,
        pendingInfectionSpawn: null,
    }),
    
    isPlayerDead: false,
    setPlayerDead: (dead) => {
        set((state) => {
            const players = { ...state.players }
            const playerId = state.playerId
            if (playerId && players[playerId]) {
                players[playerId] = { ...players[playerId], isDead: dead }
            }
            const baseState = { isPlayerDead: dead, players }
            return dead ? baseState : { ...baseState, killCamTarget: null }
        })
    },
    movementLocked: false,
    movementLockSources: [],
    lockMovement: (source) => set((state) => {
        if (state.movementLockSources.includes(source)) return state
        const movementLockSources = [...state.movementLockSources, source]
        return { movementLockSources, movementLocked: true }
    }),
    unlockMovement: (source) => set((state) => {
        if (!state.movementLockSources.includes(source)) return state
        const movementLockSources = state.movementLockSources.filter((s) => s !== source)
        return { movementLockSources, movementLocked: movementLockSources.length > 0 }
    }),
    forcedCameraMode: null,
    cameraForceSources: [],
    forceCameraMode: (mode, source) => set((state) => {
        const exists = state.cameraForceSources.includes(source)
        const cameraForceSources = exists ? state.cameraForceSources : [...state.cameraForceSources, source]
        return { forcedCameraMode: mode, cameraForceSources }
    }),
    releaseCameraMode: (source) => set((state) => {
        if (!state.cameraForceSources.includes(source)) return state
        const cameraForceSources = state.cameraForceSources.filter((s) => s !== source)
        return {
            cameraForceSources,
            forcedCameraMode: cameraForceSources.length > 0 ? state.forcedCameraMode : null
        }
    }),
    killCamTarget: null,
    setKillCamTarget: (target) => set({ killCamTarget: target }),
    mapLoaded: false,
    setMapLoaded: (loaded) => set({ mapLoaded: loaded }),
    messages: [],
    rooms: [],
    currentRoomId: null,
    playerId: null,
    nickname: '',
    isChatOpen: false,

    volumes: {
        music: 0.01,
        voice: 1.0,
        sfx: 0.5
    },

    setVolume: (type, value) => set((state) => ({
        volumes: { ...state.volumes, [type]: value }
    })),

    mobileInput: {
        joystick: { x: 0, y: 0 },
        lookDelta: { x: 0, y: 0 },
        isJumping: false,
        isRunning: false
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

    setMobileJump: (isJumping) => set((state) => ({
        mobileInput: { ...state.mobileInput, isJumping }
    })),

    setMobileRun: (isRunning) => set((state) => ({
        mobileInput: { ...state.mobileInput, isRunning }
    })),

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

    isDebugMode: false,
    toggleDebugMode: () => set((state) => ({ isDebugMode: !state.isDebugMode })),

    connectSocket: () => {
        if (get().socket) return

        const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
        const socket = io(serverUrl)
        let heartbeatInterval: number | null = null

        socket.on('connect', () => {
            console.log('Connected to server:', serverUrl)
            set({ playerId: socket.id })
            heartbeatInterval = window.setInterval(() => {
                socket.emit('heartbeat')
            }, 5000)
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
        
        socket.on('joinedRoom', ({ isSpectator, gameState, infectedPlayers }) => {
            const playerId = get().playerId
            set({
                isSpectator,
                infectedGameState: gameState,
                infectedPlayers,
                isInfected: playerId ? infectedPlayers.includes(playerId) : false,
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

        socket.on('playerMoved', ({ id, position, quaternion, isMoving, isRunning, isInfected }) => {
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
                            isRunning,
                            isInfected
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

        socket.on('gameStateUpdate', ({ state: gameState, countdownEnd, infectedPlayers, survivorCount, minPlayers }) => {
            const playerId = get().playerId
            set({
                infectedGameState: gameState,
                countdownEnd,
                infectedPlayers,
                survivorCount,
                minPlayers,
                isInfected: playerId ? infectedPlayers.includes(playerId) : false,
            })
        })
        
        socket.on('gameStarting', ({ infectedPlayerId, spawnPoint, zombieSpawnPoint, startingDuration }) => {
            const playerId = get().playerId
            const isInfected = playerId === infectedPlayerId
            set({
                infectedGameState: 'STARTING',
                isInfected,
                infectedPlayers: [infectedPlayerId],
                pendingSpawnPoint: spawnPoint,
                pendingZombieSpawnPoint: zombieSpawnPoint,
                startingCountdownEnd: Date.now() + (startingDuration * 1000),
            })
            console.log(`Game starting! You will be ${isInfected ? 'INFECTED' : 'a SURVIVOR'}`)
        })
        
        socket.on('gameStart', ({ infectedPlayerId, spawnPoint, zombieSpawnPoint }) => {
            const playerId = get().playerId
            const isInfected = playerId === infectedPlayerId
            set({
                infectedGameState: 'PLAYING',
                isInfected,
                infectedPlayers: [infectedPlayerId],
                pendingSpawnPoint: spawnPoint,
                pendingZombieSpawnPoint: zombieSpawnPoint,
            })
            console.log(`Game started! You are ${isInfected ? 'INFECTED' : 'a SURVIVOR'}`)
        })
        
        socket.on('playerInfected', ({ playerId: victimId, zombieSpawnPoint }) => {
            const myId = get().playerId
            const isMe = myId === victimId
            
            set((state) => {
                const newInfected = state.infectedPlayers.includes(victimId) 
                    ? state.infectedPlayers 
                    : [...state.infectedPlayers, victimId]
                
                const baseUpdate = {
                    infectedPlayers: newInfected,
                    isInfected: isMe ? true : state.isInfected,
                    survivorCount: Object.keys(state.players).length - newInfected.length,
                }
                
                // If it's us being infected, trigger the transition loader
                if (isMe) {
                    return {
                        ...baseUpdate,
                        isBeingInfected: true,
                        infectionTransitionEnd: Date.now() + 3000, // 3 seconds
                        pendingInfectionSpawn: zombieSpawnPoint,
                    }
                }
                
                return baseUpdate
            })
            
            if (isMe) {
                console.log('You have been INFECTED! Transitioning...')
            }
        })
        
        socket.on('voteStart', ({ maps, voteEnd }) => {
            set({
                infectedGameState: 'VOTING',
                voteOptions: maps,
                voteEnd,
                votes: {},
                myVote: null,
            })
        })
        
        socket.on('voteUpdate', ({ votes }) => {
            set({ votes })
        })
        
        socket.on('voteEnd', ({ winningMapId }) => {
            console.log('Vote ended, next map:', winningMapId)
            set({
                infectedGameState: 'WAITING',
                voteOptions: [],
                votes: {},
                voteEnd: null,
                myVote: null,
                infectedPlayers: [],
                isInfected: false,
                isSpectator: false,
            })
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

        socket.on('disconnect', () => {
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval)
                heartbeatInterval = null
            }
        })

        set({ socket })
    },

    fetchRooms: () => {
        const socket = get().socket
        if (socket) {
            socket.emit('getRooms')
        } else {
            get().connectSocket()
            setTimeout(() => {
                get().socket?.emit('getRooms')
            }, 500)
        }
    },

    joinRoom: (roomId: string) => {
        const socket = get().socket
        if (socket) {
            socket.emit('joinRoom', { roomId, nickname: get().nickname })
            set({
                phase: 'PLAYING',
                currentRoomId: roomId,
                isPlayerDead: false,
                mapLoaded: false,
                killCamTarget: null,
                infectedGameState: 'WAITING',
                infectedPlayers: [],
                isInfected: false,
                isSpectator: false,
            })
        }
    },

    leaveRoom: () => {
        const socket = get().socket
        if (socket) {
            socket.emit('leaveRoom')
            socket.disconnect()
        }
        set({
            phase: 'MENU',
            currentRoomId: null,
            players: {},
            isPlayerDead: false,
            mapLoaded: false,
            socket: null,
            playerId: null,
            movementLocked: false,
            movementLockSources: [],
            cameraForceSources: [],
            forcedCameraMode: null,
            killCamTarget: null,
            infectedGameState: 'WAITING',
            infectedPlayers: [],
            isInfected: false,
            isSpectator: false,
            spectatingPlayerId: null,
            voteOptions: [],
            votes: {},
            voteEnd: null,
            myVote: null,
            pendingSpawnPoint: null,
            pendingZombieSpawnPoint: null,
            startingCountdownEnd: null,
            isBeingInfected: false,
            infectionTransitionEnd: null,
            pendingInfectionSpawn: null,
        })
    },

    attack: (targetId: string) => {
        const socket = get().socket
        const isInfected = get().isInfected
        if (!socket || !isInfected) return
        socket.emit('attack', { targetId })
    },
    
    vote: (mapId: string) => {
        const socket = get().socket
        if (!socket) return
        socket.emit('vote', { mapId })
        set({ myVote: mapId })
    },
    
    setSpectatingPlayer: (playerId) => set({ spectatingPlayerId: playerId }),
    
    nextSpectatorTarget: () => {
        const { players, spectatingPlayerId, playerId: myId } = get()
        const playerIds = Object.keys(players).filter(id => id !== myId)
        if (playerIds.length === 0) return
        
        const currentIndex = spectatingPlayerId ? playerIds.indexOf(spectatingPlayerId) : -1
        const nextIndex = (currentIndex + 1) % playerIds.length
        set({ spectatingPlayerId: playerIds[nextIndex] })
    },
    
    prevSpectatorTarget: () => {
        const { players, spectatingPlayerId, playerId: myId } = get()
        const playerIds = Object.keys(players).filter(id => id !== myId)
        if (playerIds.length === 0) return
        
        const currentIndex = spectatingPlayerId ? playerIds.indexOf(spectatingPlayerId) : 0
        const prevIndex = (currentIndex - 1 + playerIds.length) % playerIds.length
        set({ spectatingPlayerId: playerIds[prevIndex] })
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

    updatePlayer: (_id, _position, _quaternion) => {},

    addPlayer: (player) => set((state) => ({ players: { ...state.players, [player.id]: player } })),
    removePlayer: (id) => set((state) => {
        const { [id]: _, ...rest } = state.players
        return { players: rest }
    }),
    setPlayers: (players) => set({ players }),

    setLocalPlayerTransform: (position, quaternion, isMoving, isRunning) => set((state) => {
        const { playerId, nickname, myCharacterIndex, phase, currentRoomId, isInfected } = state
        if (!playerId || phase !== 'PLAYING' || !currentRoomId) return state
        const existing = state.players[playerId]
        return {
            players: {
                ...state.players,
                [playerId]: {
                    ...existing,
                    id: playerId,
                    position,
                    quaternion,
                    isMoving,
                    isRunning,
                    nickname: existing?.nickname || nickname || 'Player',
                    isSpeaking: existing?.isSpeaking || false,
                    characterIndex: existing?.characterIndex || myCharacterIndex,
                    isInfected,
                }
            }
        }
    }),

    interactionText: null,
    setInteractionText: (text) => set({ interactionText: text }),
}))
