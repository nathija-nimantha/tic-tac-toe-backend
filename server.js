const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Allow all origins
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store game rooms
const games = {};

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create or join a game room
  socket.on("createGame", (gameId) => {
    if (!games[gameId]) {
      games[gameId] = { players: [], board: Array(9).fill(null), turn: "X" };
    }

    if (games[gameId].players.length < 2) {
      games[gameId].players.push(socket.id);
      const playerSymbol = games[gameId].players.length === 1 ? "X" : "O";
      
      // Send only to the joining player
      socket.join(gameId);
      socket.emit("assignSymbol", playerSymbol);
      
      // Notify both players
      if (games[gameId].players.length === 2) {
        io.to(gameId).emit("gameStart", games[gameId]);
      }
    }
  });

  const checkWinner = (board) => {
    const winningCombinations = [
      // Rows
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      // Columns
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      // Diagonals
      [0, 4, 8], [2, 4, 6]
    ];
  
    for (let combo of winningCombinations) {
      const [a, b, c] = combo;
      // Return the winner and the line
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], winningLine: [a, b, c] };
      }
    }
  
    return board.includes(null) ? null : { winner: "draw", winningLine: [] };
  };
  
  socket.on("makeMove", ({ gameId, index }) => {
    const game = games[gameId];
  
    if (game && game.board[index] === null) {
      const currentPlayerIndex = game.turn === "X" ? 0 : 1;
  
      if (socket.id === game.players[currentPlayerIndex]) {
        // Update the board first!
        game.board[index] = game.turn;
        // Check for winner after move
        const result = checkWinner(game.board);
  
        if (result) {
          // Ensure the board updates
          io.to(gameId).emit("updateBoard", game);
          // Delay ending the game slightly
          setTimeout(() => {
            io.to(gameId).emit("gameOver", result);
            // Reset game after win or draw
            delete games[gameId];
          }, 300);
        } else {
          game.turn = game.turn === "X" ? "O" : "X";
          io.to(gameId).emit("updateBoard", game);
        }
      }
    }
  });

  socket.on("restartGame", (gameId) => {
    const game = games[gameId];

    if (game) {
      game.board = Array(9).fill(null); // Reset board
      game.turn = "X"; // X always starts
      io.to(gameId).emit("gameRestarted", game);
    }
  });

  // Chat functionality to handle messages
  socket.on("chatMessage", ({ gameId, message, sender }) => {
    io.to(gameId).emit("receiveMessage", { message, sender });
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    for (const gameId in games) {
      games[gameId].players = games[gameId].players.filter((p) => p !== socket.id);
      // Remove empty games
      if (games[gameId].players.length === 0) {
        delete games[gameId];
      }
    }
  });
});

server.listen(3001, () => console.log("Server running on port 3001"));
