const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;
const io = new Server(PORT, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
});

let players = {};

io.on("connection", (socket) => {
    console.log("New player connected:", socket.id);

    // Add new player
    players[socket.id] = {
        id: socket.id,
        position: [0, 0, 0],
        quaternion: [0, 0, 0, 1],
        isMoving: false,
        isRunning: false,
        characterIndex: 1, // Default
        isSpeaking: false,
        nickname: "Player" // Default
    };

    // Send current players to the new player
    socket.emit("currentPlayers", players);

    // Broadcast new player to everyone else
    socket.broadcast.emit("newPlayer", players[socket.id]);

    // Handle player initialization (character choice)
    socket.on("initPlayer", (data) => {
        if (players[socket.id]) {
            players[socket.id].characterIndex = data.characterIndex;
            players[socket.id].nickname = data.nickname;
            // Broadcast the update so everyone knows this player's character
            io.emit("playerMoved", players[socket.id]); // Re-using playerMoved or create new event?
            // Better to emit a specific update or just rely on newPlayer if it happens early.
            // But initPlayer might happen after connection.
            // Let's emit a full update for this player.
            io.emit("updatePlayerState", players[socket.id]);
        }
    });

    // Handle player movement
    socket.on("playerMove", (data) => {
        if (players[socket.id]) {
            players[socket.id].position = data.position;
            players[socket.id].quaternion = data.quaternion;
            players[socket.id].isMoving = data.isMoving;
            players[socket.id].isRunning = data.isRunning;

            socket.broadcast.emit("playerMoved", {
                id: socket.id,
                position: data.position,
                quaternion: data.quaternion,
                isMoving: data.isMoving,
                isRunning: data.isRunning,
                characterIndex: players[socket.id].characterIndex,
                isSpeaking: players[socket.id].isSpeaking // Broadcast speaking state
            });
        }
    });

    // Handle WebRTC Signaling
    socket.on("signal", (data) => {
        io.to(data.target).emit("signal", {
            sender: socket.id,
            signal: data.signal
        });
    });

    // Handle Speaking State
    socket.on("speaking", (isSpeaking) => {
        if (players[socket.id]) {
            players[socket.id].isSpeaking = isSpeaking;
            socket.broadcast.emit("playerSpeaking", {
                id: socket.id,
                isSpeaking
            });
        }
    });

    // Handle Chat Messages
    socket.on("chatMessage", (text) => {
        if (players[socket.id]) {
            const message = {
                id: Date.now().toString(), // Simple ID generation
                senderId: socket.id,
                senderName: players[socket.id].nickname,
                text: text,
                timestamp: Date.now()
            };
            io.emit("chatMessage", message);
        }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
        console.log("Player disconnected:", socket.id);
        delete players[socket.id];
        io.emit("playerDisconnected", socket.id);
    });
});

console.log(`Server running on port ${PORT}`);
