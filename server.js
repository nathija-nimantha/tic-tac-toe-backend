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

// Function to generate winning combinations based on board size
// Always require 3 in a row/column/diagonal to win
const generateWinningCombinations = (size) => {
  const combinations = [];
  const sideLength = Math.sqrt(size);

  // Rows - check for 3 consecutive cells
  for (let i = 0; i < sideLength; i++) {
    for (let j = 0; j <= sideLength - 3; j++) {
      const row = [
        i * sideLength + j,
        i * sideLength + (j + 1),
        i * sideLength + (j + 2)
      ];
      combinations.push(row);
    }
  }

  // Columns - check for 3 consecutive cells
  for (let i = 0; i < sideLength; i++) {
    for (let j = 0; j <= sideLength - 3; j++) {
      const col = [
        j * sideLength + i,
        (j + 1) * sideLength + i,
        (j + 2) * sideLength + i
      ];
      combinations.push(col);
    }
  }

  // Diagonals - down right
  for (let i = 0; i <= sideLength - 3; i++) {
    for (let j = 0; j <= sideLength - 3; j++) {
      const diag = [
        i * sideLength + j,
        (i + 1) * sideLength + (j + 1),
        (i + 2) * sideLength + (j + 2)
      ];
      combinations.push(diag);
    }
  }

  // Diagonals - down left
  for (let i = 0; i <= sideLength - 3; i++) {
    for (let j = 2; j < sideLength; j++) {
      const diag = [
        i * sideLength + j,
        (i + 1) * sideLength + (j - 1),
        (i + 2) * sideLength + (j - 2)
      ];
      combinations.push(diag);
    }
  }

  return combinations;
};

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create a new game with options
  socket.on("createGame", (data) => {
    const { gameId, gameSize, hostStarts } = data;
    console.log(`Create Game: ${gameId} by ${socket.id} with size ${gameSize}`);

    const boardSize = gameSize === "3x3" ? 9 : gameSize === "6x6" ? 36 : 81;

    if (!games[gameId]) {
      games[gameId] = {
        players: [],
        board: Array(boardSize).fill(null),
        gameSize: gameSize,
        turn: "X",
        restartRequests: [],
        host: socket.id,
        hostStarts: hostStarts,
        winningCombinations: generateWinningCombinations(boardSize)
      };
    }

    // Add host to the game
    games[gameId].players.push(socket.id);
    socket.join(gameId);

    // Assign symbol based on host preference
    const playerSymbol = hostStarts ? "X" : "O";
    socket.emit("assignSymbol", {
      symbol: playerSymbol,
      isHost: true
    });

    socket.emit("waitingForOpponent", { gameId, gameSize });
  });

  // Join an existing game
  socket.on("joinGame", (gameId) => {
    console.log(`Join Game: ${gameId} by ${socket.id}`);

    if (games[gameId]) {
      // Check if player is already in the game
      if (!games[gameId].players.includes(socket.id)) {
        if (games[gameId].players.length < 2) {
          games[gameId].players.push(socket.id);

          // Assign symbol based on host preference
          const playerSymbol = games[gameId].hostStarts ? "O" : "X";

          socket.join(gameId);
          socket.emit("assignSymbol", {
            symbol: playerSymbol,
            isHost: false
          });

          // Start the game when second player joins
          io.to(gameId).emit("gameStart", games[gameId]);
        } else {
          socket.emit("gameFull", { message: `Game ${gameId} is full` });
          console.log(`Game ${gameId} is full`);
        }
      }
    } else {
      socket.emit("gameNotFound", { message: `Game ${gameId} not found` });
      console.log(`Game ${gameId} not found`);
    }
  });

  const checkWinner = (board, winningCombinations) => {
    for (let combo of winningCombinations) {
      // Check if all three positions in the combo have the same non-null value
      const firstValue = board[combo[0]];
      if (firstValue === null) continue;

      if (firstValue === board[combo[1]] && firstValue === board[combo[2]]) {
        return { winner: firstValue, winningLine: combo };
      }
    }

    return board.includes(null) ? null : { winner: "draw", winningLine: [] };
  };

  socket.on("makeMove", ({ gameId, index }) => {
    const game = games[gameId];

    if (game && game.board[index] === null) {
      const currentPlayerIndex = game.players.indexOf(socket.id);
      const expectedSymbol = game.turn;

      // Only allow move if it's the player's turn
      if ((expectedSymbol === "X" &&
              (game.hostStarts ? currentPlayerIndex === 0 : currentPlayerIndex === 1)) ||
          (expectedSymbol === "O" &&
              (game.hostStarts ? currentPlayerIndex === 1 : currentPlayerIndex === 0))) {

        game.board[index] = game.turn;
        const result = checkWinner(game.board, game.winningCombinations);

        if (result) {
          io.to(gameId).emit("updateBoard", game);
          setTimeout(() => {
            io.to(gameId).emit("gameOver", result);
          }, 300);
        } else {
          game.turn = game.turn === "X" ? "O" : "X";
          io.to(gameId).emit("updateBoard", game);
        }
      }
    }
  });

  socket.on("restartGame", (gameId) => {
    console.log(`Restart Game Request: ${gameId} by ${socket.id}`);
    const game = games[gameId];

    if (game) {
      // If the request is from the host, send restart request to other player
      if (socket.id === game.host) {
        const otherPlayer = game.players.find(playerId => playerId !== socket.id);
        if (otherPlayer) {
          console.log(`Sending restart request to other player: ${otherPlayer}`);
          socket.to(otherPlayer).emit("restartRequest");
        }
      }
      // If the request is from the other player accepting the restart
      else {
        console.log(`Restarting game. Players: ${game.players.length}`);
        // Reset the game
        game.board = Array(game.board.length).fill(null);
        game.turn = "X";

        // Emit game restart to both players
        io.to(gameId).emit("gameRestarted", game);
      }
    } else {
      console.log(`Game ${gameId} not found`);
    }
  });

  // Change game settings
  socket.on("changeGameSettings", ({ gameId, gameSize, hostStarts }) => {
    console.log(`Change Game Settings: ${gameId}, Size: ${gameSize}, Host Starts: ${hostStarts}`);
    const game = games[gameId];

    if (game && socket.id === game.host) {
      const boardSize = gameSize === "3x3" ? 9 : gameSize === "6x6" ? 36 : 81;

      game.gameSize = gameSize;
      game.hostStarts = hostStarts;
      game.board = Array(boardSize).fill(null);
      game.winningCombinations = generateWinningCombinations(boardSize);
      game.turn = "X";

      // Update player symbols based on hostStarts
      const hostIndex = 0;
      const guestIndex = 1;

      const hostSymbol = hostStarts ? "X" : "O";
      const guestSymbol = hostStarts ? "O" : "X";

      // Notify players about their updated symbols
      if (game.players[hostIndex]) {
        io.to(game.players[hostIndex]).emit("assignSymbol", {
          symbol: hostSymbol,
          isHost: true
        });
      }

      if (game.players[guestIndex]) {
        io.to(game.players[guestIndex]).emit("assignSymbol", {
          symbol: guestSymbol,
          isHost: false
        });
      }

      // Restart the game with new settings
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
      const playerIndex = games[gameId].players.indexOf(socket.id);

      // Remove the player
      if (playerIndex !== -1) {
        games[gameId].players.splice(playerIndex, 1);

        // If it was the host who left, delete the game
        if (socket.id === games[gameId].host) {
          io.to(gameId).emit("hostLeft");
          delete games[gameId];
        }
        // If it was the guest who left, notify the host
        else if (games[gameId].players.length > 0) {
          io.to(gameId).emit("opponentLeft");
        }
      }

      // Clean up empty games
      if (games[gameId] && games[gameId].players.length === 0) {
        delete games[gameId];
      }
    }
  });
});

server.listen(3002, () => console.log("Server running on port 3002"));