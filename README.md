# Real-Time Multiplayer Game

This is a real-time multiplayer game where players compete to collect squares within a time limit. The game is built using a WebSocket backend and a Phaser frontend.

## Features

- **Real-Time Multiplayer**: Players are matched in pairs and play in real-time.
- **Dynamic Gameplay**: Squares spawn randomly, and players compete to collect them for points.
- **Smooth Communication**: WebSocket ensures low-latency communication between the server and players.
- **Timer-Based Rounds**: Each game lasts for 60 seconds.
- **Phaser Graphics**: Frontend built with the Phaser game engine for an engaging 2D experience.

## Gameplay

- Players control a circle on the game field.
- Squares appear randomly on the field.
- The goal is to collect as many squares as possible before time runs out.
- The player with the highest score at the end wins.

## Technical Details

### Backend

- **Framework**: Spring Boot
- **WebSocket**: Handles real-time communication with clients.
- **Game State Management**: Uses `ConcurrentHashMap` and synchronization to ensure thread safety.
- **Game Logic**: 
  - Manages player positions, scores, and square spawns.
  - Ends games and sends results to players.
- **Message Types**:
  - `i`: Initialize game state
  - `p`: Update player position
  - `s`: Spawn a new square
  - `c`: Square collection event
  - `t`: Update game timer -- This is an example of message that is not necessary. The clients can update locally the time.
  - `o`: Game over event

### Frontend

- **Framework**: Phaser 3
- **WebSocket**: Communicates with the backend for real-time updates.
- **UI Elements**:
  - Player scores and timer display.
  - Endgame message (win/lose/draw).
  - Player indicator (1/2)
- **Player Control**: Arrow keys to move the player's circle.
- **Game Logic**:
  - Tracks player and opponent positions.
  - Detects square collection.
  - Updates the game state based on server messages.