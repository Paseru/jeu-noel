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
    { id: "server-1", name: "Snowy Village", mapImage: "/maps/Snowy Village.jpg", modelPath: "/models/snowy_village_ps1_environment.glb", maxPlayers: 20 },
    { id: "server-2", name: "City Center", mapImage: "/maps/City 1.jpeg", modelPath: "/models/city 1.glb", maxPlayers: 20, scale: 15 },
    { id: "server-3", name: "The Hood", mapImage: "/maps/Hood.jpeg", modelPath: "/models/compressed_1763758312648_hood.glb", maxPlayers: 20 },
    { id: "server-4", name: "Subway Station", mapImage: "/maps/Subway.jpg", modelPath: "/models/compressed_1763750890387_Subway.glb", maxPlayers: 20 },
    { id: "server-5", name: "Santa's Workshop", mapImage: "/maps/Workshop.jpeg", modelPath: "/models/compressed_1763750836374_Workshop.glb", maxPlayers: 20 },
    { id: "server-6", name: "Jailhouse", mapImage: "/maps/Jailhouse.jpeg", modelPath: "/models/jailhouse_rock.glb", maxPlayers: 20 },
    { id: "server-7", name: "Abandoned Hospital", mapImage: "/maps/Abandonned Hospital.jpeg", modelPath: "/models/compressed_1763750895660_Abandonned Hospital.glb", maxPlayers: 20 }
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
