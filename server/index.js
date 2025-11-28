const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;
const io = new Server(PORT, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
});

// Define available rooms (maps)
const ROOMS = [
    {
        id: "server-assault",
        name: "CS Assault",
        mapImage: "/maps/assault.jpg",
        modelPath: "/models/cs_assault.glb",
        maxPlayers: 40,
        spawnPoint: [34.32, 9.45, -38.86],
        zombieSpawnPoint: [-3.52, 6.37, 33.50],
    },
    {
        id: "server-aztec",
        name: "DE Aztec",
        mapImage: "/maps/aztec.jpg",
        modelPath: "/models/de_aztec.glb",
        maxPlayers: 40,
        spawnPoint: [0, 5, 0],
        zombieSpawnPoint: [0, 5, 5],
    },
    {
        id: "server-carpark",
        name: "Car Park",
        mapImage: "/maps/carpark.jpg",
        modelPath: "/models/gm_car_park.glb",
        maxPlayers: 40,
        spawnPoint: [0, 5, 0],
        zombieSpawnPoint: [0, 5, 5],
    },
    {
        id: "server-mansion",
        name: "Playboy Mansion",
        mapImage: "/maps/mansion.jpg",
        modelPath: "/models/gm_playboy_mansion.glb",
        maxPlayers: 40,
        spawnPoint: [0, 5, 0],
        zombieSpawnPoint: [0, 5, 5],
    }
];

const MIN_PLAYERS = 3;
const COUNTDOWN_SECONDS = 60;
const STARTING_SECONDS = 5;
const VOTE_SECONDS = 20;
const ATTACK_RANGE = 1.0;

let players = {}; // { socketId: { ...playerData, roomId, lastSeen } }
let nextCharacterIndex = 1;

// Game state per room
let roomGameState = {}; // { roomId: { state, countdownEnd, infectedPlayers, votes, voteEnd } }

const STALE_PLAYER_MS = 15000;

const getInitialRoomState = () => ({
    state: 'WAITING', // WAITING, COUNTDOWN, STARTING, PLAYING, VOTING
    countdownEnd: null,
    infectedPlayers: [], // array of player IDs who are zombies
    pendingInfectedId: null, // player ID who will become zombie (set during STARTING)
    votes: {}, // { playerId: mapId }
    voteEnd: null,
});

const getRoomPlayers = (roomId) => {
    return Object.values(players).filter(p => p.roomId === roomId);
};

const getSurvivors = (roomId) => {
    const roomState = roomGameState[roomId];
    if (!roomState) return [];
    return getRoomPlayers(roomId).filter(p => !roomState.infectedPlayers.includes(p.id));
};

const broadcastGameState = (roomId) => {
    const roomState = roomGameState[roomId];
    if (!roomState) return;
    
    const roomPlayers = getRoomPlayers(roomId);
    const survivors = getSurvivors(roomId);
    
    io.to(roomId).emit('gameStateUpdate', {
        state: roomState.state,
        countdownEnd: roomState.countdownEnd,
        infectedPlayers: roomState.infectedPlayers,
        playerCount: roomPlayers.length,
        survivorCount: survivors.length,
        minPlayers: MIN_PLAYERS,
    });
};

const startCountdown = (roomId) => {
    const roomState = roomGameState[roomId];
    if (!roomState || roomState.state !== 'WAITING') return;
    
    roomState.state = 'COUNTDOWN';
    roomState.countdownEnd = Date.now() + (COUNTDOWN_SECONDS * 1000);
    roomState.infectedPlayers = [];
    
    broadcastGameState(roomId);
    console.log(`[${roomId}] Countdown started`);
};

const cancelCountdown = (roomId) => {
    const roomState = roomGameState[roomId];
    if (!roomState || roomState.state !== 'COUNTDOWN') return;
    
    roomState.state = 'WAITING';
    roomState.countdownEnd = null;
    
    broadcastGameState(roomId);
    console.log(`[${roomId}] Countdown cancelled - not enough players`);
};

const startGame = (roomId) => {
    const roomState = roomGameState[roomId];
    if (!roomState) return;
    
    const roomPlayers = getRoomPlayers(roomId);
    if (roomPlayers.length < MIN_PLAYERS) {
        cancelCountdown(roomId);
        return;
    }
    
    // Choose random player to be infected
    const randomIndex = Math.floor(Math.random() * roomPlayers.length);
    const infectedPlayer = roomPlayers[randomIndex];
    
    const room = ROOMS.find(r => r.id === roomId);
    const spawnPoint = room?.spawnPoint || [0, 5, 0];
    const zombieSpawnPoint = room?.zombieSpawnPoint || [0, 5, 5];
    
    // Enter STARTING state (transition screen for 5 seconds)
    roomState.state = 'STARTING';
    roomState.countdownEnd = Date.now() + (STARTING_SECONDS * 1000);
    roomState.pendingInfectedId = infectedPlayer.id;
    roomState.infectedPlayers = [];
    
    // Send gameStarting event to show transition screen
    io.to(roomId).emit('gameStarting', {
        infectedPlayerId: infectedPlayer.id,
        spawnPoint,
        zombieSpawnPoint,
        startingDuration: STARTING_SECONDS,
    });
    
    broadcastGameState(roomId);
    console.log(`[${roomId}] Game starting! Infected will be: ${infectedPlayer.nickname}`);
};

const actuallyStartGame = (roomId) => {
    const roomState = roomGameState[roomId];
    if (!roomState || roomState.state !== 'STARTING') return;
    
    const roomPlayers = getRoomPlayers(roomId);
    const infectedPlayerId = roomState.pendingInfectedId;
    const infectedPlayer = roomPlayers.find(p => p.id === infectedPlayerId);
    
    if (!infectedPlayer) {
        // Infected player left, pick a new one
        if (roomPlayers.length < MIN_PLAYERS) {
            roomState.state = 'WAITING';
            roomState.countdownEnd = null;
            roomState.pendingInfectedId = null;
            broadcastGameState(roomId);
            checkRoomState(roomId);
            return;
        }
        const randomIndex = Math.floor(Math.random() * roomPlayers.length);
        roomState.pendingInfectedId = roomPlayers[randomIndex].id;
    }
    
    const room = ROOMS.find(r => r.id === roomId);
    const spawnPoint = room?.spawnPoint || [0, 5, 0];
    const zombieSpawnPoint = room?.zombieSpawnPoint || [0, 5, 5];
    
    roomState.state = 'PLAYING';
    roomState.countdownEnd = null;
    roomState.infectedPlayers = [roomState.pendingInfectedId];
    
    // Teleport all players
    roomPlayers.forEach(player => {
        if (player.id === roomState.pendingInfectedId) {
            player.position = zombieSpawnPoint;
            player.isInfected = true;
        } else {
            player.position = spawnPoint;
            player.isInfected = false;
        }
        player.isDead = false;
    });
    
    // Send gameStart event to actually start the game
    io.to(roomId).emit('gameStart', {
        infectedPlayerId: roomState.pendingInfectedId,
        spawnPoint,
        zombieSpawnPoint,
    });
    
    roomState.pendingInfectedId = null;
    broadcastGameState(roomId);
    console.log(`[${roomId}] Game started! Infected: ${infectedPlayer?.nickname || 'Unknown'}`);
};

const infectPlayer = (roomId, victimId, attackerId) => {
    const roomState = roomGameState[roomId];
    if (!roomState || roomState.state !== 'PLAYING') return;
    
    if (roomState.infectedPlayers.includes(victimId)) return; // Already infected
    if (!roomState.infectedPlayers.includes(attackerId)) return; // Attacker not infected
    
    const victim = players[victimId];
    if (!victim) return;
    
    roomState.infectedPlayers.push(victimId);
    victim.isInfected = true;
    
    const room = ROOMS.find(r => r.id === roomId);
    const zombieSpawnPoint = room?.zombieSpawnPoint || [0, 5, 5];
    victim.position = zombieSpawnPoint;
    
    io.to(roomId).emit('playerInfected', {
        playerId: victimId,
        attackerId,
        zombieSpawnPoint,
    });
    
    broadcastGameState(roomId);
    console.log(`[${roomId}] ${victim.nickname} was infected by ${players[attackerId]?.nickname}`);
    
    // Check if all players are infected
    const survivors = getSurvivors(roomId);
    if (survivors.length === 0) {
        startVoting(roomId);
    }
};

const startVoting = (roomId) => {
    const roomState = roomGameState[roomId];
    if (!roomState) return;
    
    roomState.state = 'VOTING';
    roomState.votes = {};
    roomState.voteEnd = Date.now() + (VOTE_SECONDS * 1000);
    
    io.to(roomId).emit('voteStart', {
        maps: ROOMS.map(r => ({ id: r.id, name: r.name, mapImage: r.mapImage })),
        voteEnd: roomState.voteEnd,
    });
    
    broadcastGameState(roomId);
    console.log(`[${roomId}] Voting started`);
};

const endVoting = (roomId) => {
    const roomState = roomGameState[roomId];
    if (!roomState || roomState.state !== 'VOTING') return;
    
    // Count votes
    const voteCounts = {};
    Object.values(roomState.votes).forEach(mapId => {
        voteCounts[mapId] = (voteCounts[mapId] || 0) + 1;
    });
    
    // Find winner (or default to current map)
    let winningMapId = roomId;
    let maxVotes = 0;
    Object.entries(voteCounts).forEach(([mapId, count]) => {
        if (count > maxVotes) {
            maxVotes = count;
            winningMapId = mapId;
        }
    });
    
    io.to(roomId).emit('voteEnd', { winningMapId });
    console.log(`[${roomId}] Vote ended. Winner: ${winningMapId}`);
    
    // Reset game state for new round
    roomState.state = 'WAITING';
    roomState.countdownEnd = null;
    roomState.infectedPlayers = [];
    roomState.votes = {};
    roomState.voteEnd = null;
    
    // Reset all players
    getRoomPlayers(roomId).forEach(player => {
        player.isInfected = false;
        player.isDead = false;
    });
    
    broadcastGameState(roomId);
    
    // Check if we can start countdown again
    checkRoomState(roomId);
};

const checkRoomState = (roomId) => {
    const roomState = roomGameState[roomId];
    if (!roomState) return;
    
    const roomPlayers = getRoomPlayers(roomId);
    const playerCount = roomPlayers.length;
    
    if (roomState.state === 'WAITING') {
        if (playerCount >= MIN_PLAYERS) {
            startCountdown(roomId);
        }
    } else if (roomState.state === 'COUNTDOWN') {
        if (playerCount < MIN_PLAYERS) {
            cancelCountdown(roomId);
        }
    }
};

// Game loop - check countdowns, starting, and votes
setInterval(() => {
    const now = Date.now();
    
    Object.entries(roomGameState).forEach(([roomId, state]) => {
        if (state.state === 'COUNTDOWN' && state.countdownEnd && now >= state.countdownEnd) {
            startGame(roomId);
        }
        
        if (state.state === 'STARTING' && state.countdownEnd && now >= state.countdownEnd) {
            actuallyStartGame(roomId);
        }
        
        if (state.state === 'VOTING' && state.voteEnd && now >= state.voteEnd) {
            endVoting(roomId);
        }
    });
}, 1000);

io.on("connection", (socket) => {
    console.log("New connection:", socket.id);

    const touchPlayer = () => {
        if (players[socket.id]) {
            players[socket.id].lastSeen = Date.now();
        }
    };

    const removePlayer = () => {
        const player = players[socket.id];
        if (player) {
            console.log("Player disconnected/removed:", socket.id);
            const roomId = player.roomId;
            delete players[socket.id];
            io.to(roomId).emit("playerDisconnected", socket.id);
            checkRoomState(roomId);
            broadcastGameState(roomId);
        }
    };

    socket.on("getRooms", () => {
        const roomData = ROOMS.map(room => {
            const count = Object.values(players).filter(p => p.roomId === room.id).length;
            return { ...room, playerCount: count };
        });
        socket.emit("roomList", roomData);
    });

    socket.on("joinRoom", ({ roomId, nickname }) => {
        const room = ROOMS.find(r => r.id === roomId);
        if (!room) {
            socket.emit("error", "Invalid room");
            return;
        }

        socket.join(roomId);

        // Initialize room state if needed
        if (!roomGameState[roomId]) {
            roomGameState[roomId] = getInitialRoomState();
        }

        const assignedCharacterIndex = nextCharacterIndex;
        nextCharacterIndex++;
        if (nextCharacterIndex > 5) {
            nextCharacterIndex = 1;
        }

        const roomState = roomGameState[roomId];
        const isSpectator = roomState.state === 'PLAYING';

        players[socket.id] = {
            id: socket.id,
            roomId: roomId,
            position: room.spawnPoint,
            quaternion: [0, 0, 0, 1],
            isMoving: false,
            isRunning: false,
            isDead: false,
            isInfected: false,
            isSpectator,
            characterIndex: assignedCharacterIndex,
            isSpeaking: false,
            nickname: nickname || "Player",
            lastSeen: Date.now()
        };

        const roomPlayers = {};
        Object.values(players).forEach(p => {
            if (p.roomId === roomId) {
                roomPlayers[p.id] = p;
            }
        });

        socket.emit("currentPlayers", roomPlayers);
        socket.emit("joinedRoom", { 
            roomId, 
            isSpectator,
            gameState: roomState.state,
            infectedPlayers: roomState.infectedPlayers,
        });
        
        socket.to(roomId).emit("newPlayer", players[socket.id]);

        console.log(`Player ${socket.id} joined room ${roomId} as ${players[socket.id].nickname}${isSpectator ? ' (spectator)' : ''}`);
        
        checkRoomState(roomId);
        broadcastGameState(roomId);
    });

    socket.on("leaveRoom", () => {
        removePlayer();
        socket.leaveAll();
    });

    socket.on("heartbeat", () => touchPlayer());

    socket.on("playerMove", (data) => {
        const player = players[socket.id];
        if (player && !player.isSpectator) {
            touchPlayer();
            player.position = data.position;
            player.quaternion = data.quaternion;
            player.isMoving = data.isMoving;
            player.isRunning = data.isRunning;

            socket.to(player.roomId).emit("playerMoved", {
                id: socket.id,
                position: data.position,
                quaternion: data.quaternion,
                isMoving: data.isMoving,
                isRunning: data.isRunning,
                characterIndex: player.characterIndex,
                isSpeaking: player.isSpeaking,
                isInfected: player.isInfected,
            });
        }
    });

    socket.on("attack", ({ targetId }) => {
        const attacker = players[socket.id];
        if (!attacker || !attacker.isInfected) return;
        
        const roomState = roomGameState[attacker.roomId];
        if (!roomState || roomState.state !== 'PLAYING') return;
        
        const target = players[targetId];
        if (!target || target.roomId !== attacker.roomId) return;
        if (roomState.infectedPlayers.includes(targetId)) return; // Already infected
        
        // Check distance
        const dx = attacker.position[0] - target.position[0];
        const dy = attacker.position[1] - target.position[1];
        const dz = attacker.position[2] - target.position[2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (distance <= ATTACK_RANGE) {
            infectPlayer(attacker.roomId, targetId, socket.id);
        }
    });

    socket.on("vote", ({ mapId }) => {
        const player = players[socket.id];
        if (!player) return;
        
        const roomState = roomGameState[player.roomId];
        if (!roomState || roomState.state !== 'VOTING') return;
        
        // Validate map exists
        if (!ROOMS.find(r => r.id === mapId)) return;
        
        roomState.votes[socket.id] = mapId;
        
        // Broadcast vote update
        const voteCounts = {};
        Object.values(roomState.votes).forEach(id => {
            voteCounts[id] = (voteCounts[id] || 0) + 1;
        });
        
        io.to(player.roomId).emit("voteUpdate", { votes: voteCounts });
    });

    socket.on("signal", (data) => {
        const sender = players[socket.id];
        const target = players[data.target];

        if (sender && target && sender.roomId === target.roomId) {
            io.to(data.target).emit("signal", {
                sender: socket.id,
                signal: data.signal
            });
        }
    });

    socket.on("speaking", (isSpeaking) => {
        const player = players[socket.id];
        if (player) {
            player.isSpeaking = isSpeaking;
            socket.to(player.roomId).emit("playerSpeaking", {
                id: socket.id,
                isSpeaking
            });
        }
    });

    socket.on("chatMessage", (text) => {
        const player = players[socket.id];
        if (player) {
            const message = {
                id: Date.now().toString(),
                senderId: socket.id,
                senderName: player.nickname,
                text: text,
                timestamp: Date.now()
            };
            io.to(player.roomId).emit("chatMessage", message);
        }
    });

    socket.on("disconnect", () => {
        removePlayer();
    });
});

// Purge stale connections
setInterval(() => {
    const now = Date.now();
    Object.entries(players).forEach(([id, player]) => {
        if (now - player.lastSeen > STALE_PLAYER_MS) {
            console.log(`Pruning stale player ${id}`);
            const roomId = player.roomId;
            delete players[id];
            io.to(roomId).emit("playerDisconnected", id);
            checkRoomState(roomId);
            broadcastGameState(roomId);
        }
    });
}, 5000);

console.log(`Server running on port ${PORT}`);
