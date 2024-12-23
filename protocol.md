# WebSocket Communication Protocol

This guide explains the WebSocket communication protocol used in the example multiplayer-game.

---

## Message Types

The protocol uses specific message types to communicate between the client and server. Each message consists of a single character indicating the type, followed by optional JSON-encoded data.

### 1. **Initialization (`i`):**

- **Type:** `i`
- **Description:** Sent by the server to initialize the game state for a player.
- **Data Format:**
  ```json
  {
      "id": <playerId>,
      "p": [
          [x, y, id, color],
          [x, y, id, color],
          ...
      ]
  }
  ```
  - `id`: The ID of the player receiving the message.
  - `p`: An array of all players' initial positions and properties:
    - `x`, `y`: Coordinates.
    - `id`: Player ID.
    - `color`: Color of the player (hexadecimal).

### 2. **Position Update (`p`):**

- **Type:** `p`
- **Description:** Sent by a client to update their position, or by the server to update another player’s position.
- **Data Format:**
  ```json
  [playerId, x, y]
  ```
  - `playerId`: The ID of the player whose position is updated.
  - `x`, `y`: The new coordinates of the player.

### 3. **Square Spawn (`s`):**

- **Type:** `s`
- **Description:** Sent by the server to spawn a new square.
- **Data Format:**
  ```json
  [x, y]
  ```
  - `x`, `y`: Coordinates of the square.

### 4. **Square Collection (`c`):**

- **Type:** `c`
- **Description:** Sent by a client to indicate a square collection, or by the server to update scores after a collection.
- **Data Format (Client to Server):**
  No additional data is required.
- **Data Format (Server to Clients):**
  ```json
  [squareId, playerScore, otherScore]
  ```
  - `squareId`: Identifier for the collected square.
  - `playerScore`: Updated score of the collecting player.
  - `otherScore`: Updated score of the other player.

### 5. **Time Update (`t`):**

- **Type:** `t`
- **Description:** Sent by the server to update the remaining game time.
- **Data Format:**
  ```json
  <timeLeft>
  ```
  - `timeLeft`: Remaining time in seconds.

### 6. **Game Over (`o`):**

- **Type:** `o`
- **Description:** Sent by the server to end the game and provide the final scores.
- **Data Format:**
  ```json
  [playerScore, otherScore]
  ```
  - `playerScore`: Final score of the player receiving the message.
  - `otherScore`: Final score of the other player.

---

## Example Communication

### Server Initialization

1. **Server to Client:**
    ```text
    i{"id":1,"p":[[100,100,1,"0xff0000"],[300,300,2,"0x0000ff"]]}
    ```
    - Initializes the player (ID: 1) and provides initial positions and colors of both players.

### Player Position Update

2. **Client to Server:**
    ```text
    p[1,150,150]
    ```
    - Player (ID: 1) updates their position to (150, 150).

3. **Server to Client:**
    ```text
    p[2,320,320]
    ```
    - Server updates the position of player (ID: 2) to (320, 320).

### Square Spawn

4. **Server to Client:**
    ```text
    s[400,400]
    ```
    - A new square is spawned at (400, 400).

### Square Collection

5. **Client to Server:**
    ```text
    c
    ```
    - Player collects the square.

6. **Server to Clients:**
    ```text
    c[1,5,3]
    ```
    - Square (ID: 1) was collected. Player scores are updated: 5 for the collecting player, 3 for the other player.

### Time Update

7. **Server to Client:**
    ```text
    t45
    ```
    - Updates the remaining time to 45 seconds.

### Game Over

8. **Server to Client:**
    ```text
    o[7,5]
    ```
    - The game ends with a score of 7 for the player and 5 for the opponent.

---

## Notes

- All messages start with a single character representing the message type.
- Clients must handle messages asynchronously as they are received from the server.
- The server is responsible for synchronizing game state and broadcasting updates to all clients.
