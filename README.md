# Tic-Tac-Toe Online

A modern online Tic-Tac-Toe game built with Next.js, TypeScript, Tailwind CSS, and Socket.io. Play with friends in real-time with different board sizes and customizable game settings.

## Features

- 🎮 Real-time multiplayer gameplay
- 💬 In-game chat with your opponent
- 🎨 Multiple theme options (Light, Dark, GitHub, Colorful)
- 📱 Fully responsive design for all devices
- 🎯 Game board sizes: 3x3, 6x6, and 9x9
- 🏆 Win by getting 3 in a row (on any board size)
- 🔄 Host can choose who starts the game
- 🎲 Host can change game settings

## Tech Stack

- **Frontend**: [GitHub Repository](https://github.com/nathija-nimantha/tic-tac-toe-frontend)
    - Next.js 14
    - TypeScript
    - Tailwind CSS
    - Socket.io Client
    - Zustand (State Management)
    - Radix UI Components
    - Lucide Icons
    - next-themes

- **Backend**:
    - Node.js
    - Express
    - Socket.io

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/tic-tac-toe-nextjs.git
   cd tic-tac-toe-nextjs
   ```

2. Install frontend dependencies
   ```bash
   npm install
   # or
   yarn install
   ```

3. Install backend dependencies
   ```bash
   cd server
   npm install
   # or
   yarn install
   ```

### Running the App

1. Start the backend server
   ```bash
   # In the server directory
   node server.js
   ```

2. Start the frontend development server
   ```bash
   # In the root directory
   npm run dev
   # or
   yarn dev
   ```

3. Open your browser and navigate to `http://localhost:3000`

## How to Play

1. **Create a Game**:
    - Choose your preferred board size (3x3, 6x6, or 9x9)
    - Decide who starts the game (you or your opponent)
    - Click "Create Game"

2. **Invite a Friend**:
    - Share the generated Game ID with your friend
    - Your friend can join using the "Join Game" option

3. **Playing the Game**:
    - Players take turns marking spaces on the grid
    - The first player to get 3 of their marks in a row (horizontally, vertically, or diagonally) wins
    - If the board fills up with no winner, the game ends in a draw

4. **Game Settings**:
    - The host can change the board size and starting player preferences
    - Changes will apply when the game is restarted

## Deployment

### Frontend

You can deploy the Next.js app to Vercel:

```bash
npm install -g vercel
vercel
```

### Backend

You can deploy the server to any Node.js hosting service like:
- Heroku
- Railway
- Render
- Digital Ocean

Remember to update the `NEXT_PUBLIC_SOCKET_URL` in your frontend environment variables to point to your deployed backend URL.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
