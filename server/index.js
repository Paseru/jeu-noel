const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;
const io = new Server(PORT, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
});

// Define available rooms (servers)
const ROOMS = [
    {
        id: "server-1",
        name: "Snowy Village",
        mapImage: "/maps/Snowy Village.jpg",
        modelPath: "/models/snowy_village_ps1_environment.glb",
        maxPlayers: 40,
        spawnPoint: [1.98, 9.55, -11.47],
        zombieSpawnPoint: [47.74, 13.03, -140.37],
        summonPoint: [-4.67, 0.80, -20.92]
    },
    {
        id: "server-tacos",
        name: "Tacos World",
        mapImage: "/maps/Tacos.jpg",
        modelPath: "/models/tacos (1).glb",
        maxPlayers: 40,
        spawnPoint: [-0.13, 2.06, 16.38],
        zombieSpawnPoint: [-73.19, 4.78, -17.39]
    }
];

let players = {}; // { socketId: { ...playerData, roomId, lastSeen } }
let roomZombies = {}; // { roomId: [{ id, spawnPoint }] }
let nextCharacterIndex = 1;

const STALE_PLAYER_MS = 15000; // remove players that haven't heartbeat'ed for 15s
const ZOMBIE_COOLDOWN_MS = 1500; // throttle spawn requests per socket
const lastSpawnBySocket = {}; // { socketId: timestamp }

const clearZombiesForRoom = (roomId, reason) => {
    if (roomZombies[roomId]?.length) {
        roomZombies[roomId] = [];
        io.to(roomId).emit("zombiesCleared");
        console.log(`Cleared zombies in ${roomId}: ${reason}`);
    }
};

const evaluateRoomState = (roomId) => {
    const roomPlayers = Object.values(players).filter(p => p.roomId === roomId);
    if (roomPlayers.length === 0) {
        clearZombiesForRoom(roomId, "room empty");
        return;
    }

    const alivePlayers = roomPlayers.filter(p => !p.isDead);
    if (alivePlayers.length === 0) {
        clearZombiesForRoom(roomId, "all players dead");
    }
};

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
            delete lastSpawnBySocket[socket.id];
            io.to(roomId).emit("playerDisconnected", socket.id);
            evaluateRoomState(roomId);
        }
    };

    // Send available rooms and their current player counts
    socket.on("getRooms", () => {
        const roomData = ROOMS.map(room => {
            const count = Object.values(players).filter(p => p.roomId === room.id).length;
            return { ...room, playerCount: count };
        });
        socket.emit("roomList", roomData);
    });

    socket.on("joinRoom", ({ roomId, nickname }) => {
        // Validate room
        const room = ROOMS.find(r => r.id === roomId);
        if (!room) {
            socket.emit("error", "Invalid room");
            return;
        }

        // Join the socket.io room
        socket.join(roomId);

        // Assign character index sequentially
        const assignedCharacterIndex = nextCharacterIndex;
        nextCharacterIndex++;
        if (nextCharacterIndex > 5) {
            nextCharacterIndex = 1;
        }

        // Create player object
        players[socket.id] = {
            id: socket.id,
            roomId: roomId,
            position: [0, 0, -1],
            quaternion: [0, 0, 0, 1],
            isMoving: false,
            isRunning: false,
            isDead: false,
            characterIndex: assignedCharacterIndex,
            isSpeaking: false,
            nickname: nickname || "Player",
            lastSeen: Date.now()
        };

        // Get all players in THIS room
        const roomPlayers = {};
        Object.values(players).forEach(p => {
            if (p.roomId === roomId) {
                roomPlayers[p.id] = p;
            }
        });

        // Send current players in this room to the new player
        socket.emit("currentPlayers", roomPlayers);

        // Send existing zombies in this room
        const zombies = roomZombies[roomId] || [];
        socket.emit("currentZombies", zombies);

        // Broadcast new player to everyone else in the room
        socket.to(roomId).emit("newPlayer", players[socket.id]);

        console.log(`Player ${socket.id} joined room ${roomId} as ${players[socket.id].nickname}`);
    });

    // Player explicitly leaves the room (e.g., back to menu)
    socket.on("leaveRoom", () => {
        removePlayer();
        socket.leaveAll();
    });

    // Heartbeat to keep player alive even when standing still
    socket.on("heartbeat", () => touchPlayer());

    // Handle player movement
    socket.on("playerMove", (data) => {
        const player = players[socket.id];
        if (player && !player.isDead) {
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
                isSpeaking: player.isSpeaking
            });
        }
    });

    socket.on("playerDead", () => {
        const player = players[socket.id];
        if (!player || player.isDead) return;
        player.isDead = true;
        io.to(player.roomId).emit("updatePlayerState", player);
        evaluateRoomState(player.roomId);
    });

    // Spawn zombie for the player's current room
    socket.on("spawnZombie", () => {
        const player = players[socket.id];
        if (!player || player.isDead) return;
        const now = Date.now();
        const last = lastSpawnBySocket[socket.id] || 0;
        if (now - last < ZOMBIE_COOLDOWN_MS) {
            return; // spam guard
        }
        lastSpawnBySocket[socket.id] = now;
        const room = ROOMS.find(r => r.id === player.roomId);
        const spawnPoint = room?.zombieSpawnPoint || room?.spawnPoint || [0, 2, 0];
        const zombie = {
            id: `z-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            spawnPoint
        };
        if (!roomZombies[player.roomId]) roomZombies[player.roomId] = [];
        roomZombies[player.roomId].push(zombie);
        io.to(player.roomId).emit("zombieSpawned", zombie);
        console.log(`Zombie spawned in ${player.roomId} by ${socket.id} @`, spawnPoint);
    });

    // Handle WebRTC Signaling
    socket.on("signal", (data) => {
        // Ensure target is in the same room (optional security, but good practice)
        const sender = players[socket.id];
        const target = players[data.target];

        if (sender && target && sender.roomId === target.roomId) {
            io.to(data.target).emit("signal", {
                sender: socket.id,
                signal: data.signal
            });
        }
    });

    // Handle Speaking State
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

    // Handle Chat Messages
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
            // Broadcast to room only
            io.to(player.roomId).emit("chatMessage", message);
        }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
        removePlayer();
    });
});

// Periodically purge stale connections that never sent a disconnect
setInterval(() => {
    const now = Date.now();
    Object.entries(players).forEach(([id, player]) => {
        if (now - player.lastSeen > STALE_PLAYER_MS) {
            console.log(`Pruning stale player ${id}`);
            const roomId = player.roomId;
            delete players[id];
            io.to(roomId).emit("playerDisconnected", id);
            evaluateRoomState(roomId);
        }
    });
}, 5000);

console.log(`Server running on port ${PORT}`);
