const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

// Allow connections from any origin
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
    console.log(`Create Game: ${gameId} by ${socket.id} with size ${gameSize}, Host starts: ${hostStarts}`);

    // Get board dimensions and total cell count
    const dimension = gameSize === "3x3" ? 3 : gameSize === "6x6" ? 6 : 9;
    const boardSize = dimension * dimension;

    if (!games[gameId]) {
      games[gameId] = {
        players: [],
        board: Array(boardSize).fill(null),
        gameSize: gameSize,
        boardDimension: dimension,
        turn: "X", // X always goes first
        restartRequests: [],
        host: socket.id,
        hostStarts: hostStarts, // But this determines who plays as X
        winningCombinations: generateWinningCombinations(boardSize),
        restartPending: false
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
          // If hostStarts is true, the host plays as X and guest plays as O
          // If hostStarts is false, the host plays as O and guest plays as X
          const playerSymbol = games[gameId].hostStarts ? "O" : "X";
          console.log(`Assigning symbol ${playerSymbol} to joining player. Host starts: ${games[gameId].hostStarts}`);

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

    if (!game || game.board[index] !== null) {
      return; // No valid game or cell already taken
    }

    const currentPlayerIndex = game.players.indexOf(socket.id);
    if (currentPlayerIndex === -1) {
      console.log(`Player ${socket.id} not found in game ${gameId}`);
      return; // Player not in this game
    }

    // Determine which player should be X based on hostStarts
    const playerX = game.hostStarts ? game.players[0] : game.players[1];
    const playerO = game.hostStarts ? game.players[1] : game.players[0];

    // Check if it's this player's turn
    const isValidMove = (game.turn === "X" && socket.id === playerX) ||
        (game.turn === "O" && socket.id === playerO);

    if (isValidMove) {
      console.log(`Valid move by ${socket.id} (${game.turn}) at position ${index}`);

      // Make the move
      game.board[index] = game.turn;
      const result = checkWinner(game.board, game.winningCombinations);

      if (result) {
        io.to(gameId).emit("updateBoard", game);
        setTimeout(() => {
          io.to(gameId).emit("gameOver", result);
        }, 300);
      } else {
        // Switch turn
        game.turn = game.turn === "X" ? "O" : "X";
        io.to(gameId).emit("updateBoard", game);
      }
    } else {
      console.log(`Invalid move attempt by ${socket.id}. Current turn is ${game.turn}`);
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
          // Track that a restart request is pending
          game.restartPending = true;
          socket.to(otherPlayer).emit("restartRequest");
        }
      }
      // If the request is from the other player accepting the restart
      else {
        console.log(`Restarting game. Players: ${game.players.length}`);
        // Reset the game
        game.board = Array(game.board.length).fill(null);
        game.turn = "X";
        // Clear the pending restart flag
        game.restartPending = false;

        // Emit game restart to both players
        io.to(gameId).emit("gameRestarted", game);
      }
    } else {
      console.log(`Game ${gameId} not found`);
    }
  });

  // Handle restart decline
  socket.on("declineRestart", (gameId) => {
    console.log(`Restart declined for game: ${gameId} by ${socket.id}`);
    const game = games[gameId];

    if (game && game.restartPending) {
      // Clear the pending restart flag
      game.restartPending = false;

      // Notify the host that the restart was declined
      if (game.host && game.host !== socket.id) {
        io.to(game.host).emit("restartDeclined");
      }
    }
  });

  // Change game settings
  socket.on("changeGameSettings", ({ gameId, gameSize, hostStarts, applyImmediately }) => {
    console.log(`Change Game Settings: ${gameId}, Size: ${gameSize}, Host Starts: ${hostStarts}, Apply Immediately: ${applyImmediately}`);
    const game = games[gameId];

    if (!game || socket.id !== game.host) {
      return;
    }

    // Get board dimensions and total cell count
    const dimension = gameSize === "3x3" ? 3 : gameSize === "6x6" ? 6 : 9;
    const boardSize = dimension * dimension;

    // Only reset the game if we're applying immediately or the game is over
    const shouldReset = applyImmediately ||
        game.board.every(cell => cell === null) ||
        checkWinner(game.board, game.winningCombinations);

    if (shouldReset) {
      // Reset the game with new settings
      game.gameSize = gameSize;
      game.boardDimension = dimension;
      game.hostStarts = hostStarts;
      game.board = Array(boardSize).fill(null);
      game.winningCombinations = generateWinningCombinations(boardSize);
      game.turn = "X";

      // Only reassign player symbols if we have 2 players
      if (game.players.length >= 2) {
        const hostSymbol = hostStarts ? "X" : "O";
        const guestSymbol = hostStarts ? "O" : "X";

        // Notify host of their symbol
        io.to(game.players[0]).emit("assignSymbol", {
          symbol: hostSymbol,
          isHost: true
        });

        // Notify guest of their symbol
        io.to(game.players[1]).emit("assignSymbol", {
          symbol: guestSymbol,
          isHost: false
        });
      }

      // Notify clients of the reset game
      io.to(gameId).emit("gameRestarted", game);
    } else {
      game.gameSize = gameSize;
      game.boardDimension = dimension;

      // Notify clients of the changed settings
      io.to(gameId).emit("gameSettingsChanged", {
        gameSize,
        hostStarts: game.hostStarts,
        boardSize,
        dimension
      });
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

// Route to check if server is running
app.get("/", (req, res) => {
  res.send("Tic-Tac-Toe Server is running!");
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));