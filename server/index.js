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
        spawnPoint: [-0.19, 1.80, -9.25]
    },
    {
        id: "server-tacos",
        name: "Tacos World",
        mapImage: "/maps/Snowy Village.jpg", // Placeholder image
        modelPath: "/models/tacos (1).glb",
        maxPlayers: 40,
        spawnPoint: [0, 5, 0]
    }
];

let players = {}; // { socketId: { ...playerData, roomId } }
let nextCharacterIndex = 1;

io.on("connection", (socket) => {
    console.log("New connection:", socket.id);

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
            characterIndex: assignedCharacterIndex,
            isSpeaking: false,
            nickname: nickname || "Player"
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

        // Broadcast new player to everyone else in the room
        socket.to(roomId).emit("newPlayer", players[socket.id]);

        console.log(`Player ${socket.id} joined room ${roomId} as ${players[socket.id].nickname}`);
    });

    // Handle player movement
    socket.on("playerMove", (data) => {
        const player = players[socket.id];
        if (player) {
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
        const player = players[socket.id];
        if (player) {
            console.log("Player disconnected:", socket.id);
            const roomId = player.roomId;
            delete players[socket.id];
            io.to(roomId).emit("playerDisconnected", socket.id);
        }
    });
});

console.log(`Server running on port ${PORT}`);
