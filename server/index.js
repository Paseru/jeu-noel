const { Server } = require("socket.io");

const io = new Server(3001, {
    cors: {
        origin: "*",
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
    };

    // Send current players to the new player
    socket.emit("currentPlayers", players);

    // Broadcast new player to everyone else
    socket.broadcast.emit("newPlayer", players[socket.id]);

    // Handle player movement
    socket.on("playerMove", (data) => {
        if (players[socket.id]) {
            players[socket.id].position = data.position;
            players[socket.id].rotation = data.rotation;
            socket.broadcast.emit("playerMoved", {
                id: socket.id,
                position: data.position,
                rotation: data.rotation,
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

console.log("Server running on port 3001");
