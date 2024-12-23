package com.example.demo;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;

/**
 * WebSocket handler for a real-time multiplayer game where players compete to
 * collect squares.
 * Players are matched in pairs and compete for 60 seconds to collect randomly
 * spawning squares.
 */
@Component
public class GameWebSocketHandler extends TextWebSocketHandler {
    // Thread-safe collections for managing game state
    private final Map<String, Player> players = new ConcurrentHashMap<>();
    private final Map<String, Game> games = new ConcurrentHashMap<>();
    private final Queue<WebSocketSession> waitingPlayers = new ConcurrentLinkedQueue<>();
    private final ObjectMapper mapper = new ObjectMapper();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);

    /**
     * Represents a player in the game with their position, score, and WebSocket
     * session.
     */
    private static class Player {
        WebSocketSession session;
        double x;
        double y;
        int score;
        int playerId;

        Player(WebSocketSession session) {
            this.session = session;
            this.score = 0;
        }
    }

    /**
     * Represents an active game between two players.
     * Includes game state like the current square, time remaining, and scheduled
     * tasks.
     */
    private static class Game {
        Player player1;
        Player player2;
        Square square;
        int timeLeft = 60; // Game duration in seconds
        ScheduledFuture<?> timerTask;

        Game(Player player1, Player player2) {
            this.player1 = player1;
            this.player2 = player2;
        }
    }

    /**
     * Represents a collectible square in the game with random coordinates.
     * Squares spawn within the bounds: x(50-750), y(50-550)
     */
    private static class Square {
        int x;
        int y;

        Square() {
            Random rand = new Random();
            this.x = rand.nextInt(700) + 50; // 50-750 range
            this.y = rand.nextInt(500) + 50; // 50-550 range
        }
    }

    /**
     * Handles new WebSocket connections by creating a player and adding them to the
     * waiting queue.
     */
    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        // Sequential access/write for waitingPlayers
        waitingPlayers.add(session);
        players.put(session.getId(), new Player(session));

        synchronized (this) {
            // Ensure that create game is thread-safe
            checkAndCreateGame();
        }
    }

    /**
     * Attempts to create a new game if there are at least 2 players waiting.
     * Sets up initial player positions and starts the game.
     */
    private synchronized void checkAndCreateGame() {
        if (waitingPlayers.size() >= 2) {
            WebSocketSession session1 = waitingPlayers.poll();
            WebSocketSession session2 = waitingPlayers.poll();

            if (session1 != null && session2 != null) {

                Player player1 = players.get(session1.getId());
                Player player2 = players.get(session2.getId());

                // Initialize player positions and IDs
                player1.playerId = 1;
                player2.playerId = 2;
                player1.x = 100; // Left side of screen
                player1.y = 300; // Middle height
                player2.x = 700; // Right side of screen
                player2.y = 300; // Middle height

                Game game = new Game(player1, player2);
                games.put(session1.getId(), game);
                games.put(session2.getId(), game);
                startGame(game);
            }
        }
    }

    /**
     * Initializes a new game by sending initial states to players and starting the
     * game loop.
     * Message format 'i': Initial game state with player positions and colors
     */
    private void startGame(Game game) {
        // Create initial player data: [x, y, playerId, color]
        List<List<Object>> playersData = Arrays.asList(
                Arrays.asList(game.player1.x, game.player1.y, 1, 0xff0000), // Player 1: Red
                Arrays.asList(game.player2.x, game.player2.y, 2, 0x0000ff) // Player 2: Blue
        );

        // Send initial state to both players
        sendToPlayer(game.player1, "i", Map.of("id", 1, "p", playersData));
        sendToPlayer(game.player2, "i", Map.of("id", 2, "p", playersData));

        // Start game timer that runs every second
        game.timerTask = scheduler.scheduleAtFixedRate(() -> {
            gameLoop(game);
        }, 0, 1, TimeUnit.SECONDS);

        // Spawn first collectible square
        spawnSquare(game);
    }

    /**
     * Main game loop that runs every second.
     * Updates timer and spawns new squares every 10 seconds.
     * Message format 't': Time update
     */
    private void gameLoop(Game game) {
        game.timeLeft--;

        // Update time for both players
        sendToPlayer(game.player1, "t", game.timeLeft);
        sendToPlayer(game.player2, "t", game.timeLeft);

        // Spawn new square every 10 seconds
        if (game.timeLeft % 5 == 0) {
            spawnSquare(game);
        }

        // End game when time runs out
        if (game.timeLeft <= 0) {
            endGame(game);
        }
    }

    /**
     * Creates and sends a new collectible square to both players.
     * Message format 's': Square position [x, y]
     */
    private void spawnSquare(Game game) {
        game.square = new Square();
        sendToPlayer(game.player1, "s", Arrays.asList(game.square.x, game.square.y));
        sendToPlayer(game.player2, "s", Arrays.asList(game.square.x, game.square.y));
    }

    /**
     * Handles incoming WebSocket messages from players.
     * Message types:
     * 'p': Position update [x, y]
     * 'c': Collect square attempt
     */
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {

            Game game = games.get(session.getId());

            if (game == null)
                return;

            Player currentPlayer = players.get(session.getId());
            Player otherPlayer = game.player1 == currentPlayer ? game.player2 : game.player1;

            String payload = message.getPayload();
            char type = payload.charAt(0);
            String data = payload.length() > 1 ? payload.substring(1) : "";

            switch (type) {
                case 'p': // Position update
                    List<Integer> pos = mapper.readValue(data, List.class);

                    // We could synchronize currentPlayer, but we will not have concurrent updates
                    currentPlayer.x = pos.get(0);
                    currentPlayer.y = pos.get(1);

                    // Broadcast position to other player
                    sendToPlayer(otherPlayer, "p",
                            Arrays.asList(currentPlayer.playerId, currentPlayer.x, currentPlayer.y));
                    break;

                case 'c': // Square collection attempt
                    if (game.square != null) {
                        // Check if player is within collection distance (32 units)
                        double dx = currentPlayer.x - game.square.x;
                        double dy = currentPlayer.y - game.square.y;
                        double distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance < 32) {
                            currentPlayer.score++;
                            game.square = null;

                            // Update scores for both players
                            List<Integer> scoreData = Arrays.asList(
                                    currentPlayer.playerId,
                                    game.player1.score,
                                    game.player2.score);
                            sendToPlayer(game.player1, "c", scoreData);
                            sendToPlayer(game.player2, "c", scoreData);
                        }
                    }
                    break;
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    /**
     * Ends the game by sending final scores and cleaning up game resources.
     * Message format 'o': Game over with final scores [player1Score, player2Score]
     */
    private void endGame(Game game) {
        // Send final scores to both players
        List<Integer> finalScores = Arrays.asList(game.player1.score, game.player2.score);

        if (this.players.containsKey(game.player1.session.getId())) {
            sendToPlayer(game.player1, "o", finalScores);
        }

        if (this.players.containsKey(game.player2.session.getId())) {
            sendToPlayer(game.player2, "o", finalScores);
        }

        // Cancel timer and cleanup game resources
        if (game.timerTask != null) {
            game.timerTask.cancel(false);
        }

        games.remove(game.player1.session.getId());
        games.remove(game.player2.session.getId());
    }

    /**
     * Handles WebSocket connection closures by cleaning up player and game
     * resources.
     */
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        players.remove(session.getId());
        waitingPlayers.remove(session);

        Game game = games.remove(session.getId());
        if (game != null) {
            endGame(game);
        }

    }

    /**
     * Sends a message to a specific player with the given type and data.
     * Messages are formatted as: type + JSON data
     * 
     * @param player The target player
     * @param type   Single character message type
     * @param data   Data to be JSON serialized (can be null)
     */
    private void sendToPlayer(Player player, String type, Object data) {
        try {
            String message = type;
            if (data != null) {
                message += mapper.writeValueAsString(data);
            }
            synchronized (player.session) {
                player.session.sendMessage(new TextMessage(message));
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}