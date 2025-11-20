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
        rotation: [0, 0, 0],
        isMoving: false,
        isRunning: false,
        characterIndex: 1, // Default
    };

    // Send current players to the new player
    socket.emit("currentPlayers", players);

    // Broadcast new player to everyone else
    socket.broadcast.emit("newPlayer", players[socket.id]);

    // Handle player initialization (character choice)
    socket.on("initPlayer", (data) => {
        if (players[socket.id]) {
            players[socket.id].characterIndex = data.characterIndex;
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
            players[socket.id].rotation = data.rotation;
            players[socket.id].isMoving = data.isMoving;
            players[socket.id].isRunning = data.isRunning;

            socket.broadcast.emit("playerMoved", {
                id: socket.id,
                position: data.position,
                rotation: data.rotation,
                isMoving: data.isMoving,
                isRunning: data.isRunning,
                characterIndex: players[socket.id].characterIndex
            });
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
