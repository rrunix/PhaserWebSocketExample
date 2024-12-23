# Real-Time Multiplayer Game

This is a real-time multiplayer game where players compete to collect squares within a time limit. The game is built using a WebSocket backend and a Phaser frontend.

## Important Notes

This code serves as starter code and is not intended to represent a fully functional or polished game. It includes basic features but lacks refined design and functionality. Below are some specific considerations:

- **Visual Design**: The game uses basic geometric shapes and lacks indicators (e.g., to show which player you control).
- **Scene Limitations**: The `MainScene` is not intended to function as a standalone scene. It assumes certain external setups that are not present in this example.
- **Known Issues**:
  - **Player Identification**: There is no visual indication of which circle belongs to the player.
  - **Asset Quality**: Basic assets are used (e.g., rectangles for squares and circles for players).
  - **Connection Edge Cases**: If a player refreshes their browser during matchmaking, it can result in unexpected behavior:
    - For example, if the server pairs two connections from the same player (one from the refreshed browser and the other from the old connection), the game may result in a "draw" because the game ends before scoring can occur. This occurrs because the old connection closes before the actual game has started.

This project is a starting point for developing a multiplayer game. To create a complete and enjoyable experience, further enhancements are recommended, including improved visuals, better handling of game states, and additional features to enrich gameplay.

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