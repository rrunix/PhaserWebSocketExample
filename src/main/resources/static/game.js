/**
 * Message types used for WebSocket communication.
 * @enum {string}
 */
const MSG_TYPES = {
    INIT: 'i',        // Initialize game state
    POS: 'p',         // Update player position
    SQUARE: 's',      // Spawn a square
    COLLECT: 'c',     // Square collection event
    TIME: 't',        // Update game timer
    OVER: 'o'         // End game event
};

/**
 * Main game scene for a multiplayer Phaser game.
 * Manages the game logic, WebSocket communication, and player interactions.
 */
class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });

        // Game variables
        /** @type {Phaser.GameObjects.GameObject} Player-controlled circle */
        this.player = null;

        /** @type {Phaser.GameObjects.GameObject} Opponent's circle */
        this.otherPlayer = null;

        /** @type {Phaser.GameObjects.GameObject} Square to be collected */
        this.square = null;

        /** @type {WebSocket} WebSocket for server communication */
        this.socket = null;

        /** @type {number} Current player score */
        this.score = 0;

        /** @type {number} Opponent's score */
        this.otherScore = 0;

        /** @type {number} Remaining time in seconds */
        this.timeLeft = 60;

        /** @type {Phaser.GameObjects.Text} Score display */
        this.scoreText = null;

        /** @type {Phaser.GameObjects.Text} Timer display */
        this.timeText = null;

        /** @type {Phaser.GameObjects.Text} Player display */
        this.playerText = null;

        /** @type {boolean} Indicates whether the game has started */
        this.gameStarted = false;

        /** @type {number|null} Player ID assigned by the server */
        this.playerId = null;

        // Network optimization variables
        /** @type {{x: number, y: number}} Last sent position */
        this.lastSentPosition = { x: 0, y: 0 };

        /** @type {number} Last update timestamp */
        this.lastUpdateTime = 0;

        /** @type {number} Interval for position updates in milliseconds */
        this.POSITION_UPDATE_INTERVAL = 50;

        /** @type {number} Minimum movement threshold for sending position updates */
        this.POSITION_THRESHOLD = 2;
    }

    /**
     * Preloads assets for the game.
     */
    preload() {
        // Add any asset loading here
    }

    /**
     * Creates the game scene, initializes WebSocket connection, and UI elements.
     */
    create() {
        // Connect to WebSocket
        this.socket = new WebSocket("ws://" + location.host + "/ws");

        // Initialize text displays
        this.scoreText = this.add.text(16, 16, 'Score: 0 - 0', { fontSize: '32px', fill: '#fff' });
        this.timeText = this.add.text(16, 50, 'Time: 60', { fontSize: '32px', fill: '#fff' });
        this.playerText = this.add.text(16, 84, 'Player: ', { fontSize: '32px', fill: '#fff' });

        // Setup WebSocket event handlers
        this.setupWebSocket();
    }

    /**
     * Updates the game logic on each frame.
     */
    update() {
        if (!this.gameStarted || !this.player) return;

        this.handlePlayerMovement();
        this.handlePositionUpdates();
        this.checkSquareCollection();
    }

    /**
     * Handles player movement based on keyboard input.
     */
    handlePlayerMovement() {
        const cursors = this.input.keyboard.createCursorKeys();
        const speed = 200;

        this.player.body.setVelocity(0);

        if (cursors.left.isDown) {
            this.player.body.setVelocityX(-speed);
        } else if (cursors.right.isDown) {
            this.player.body.setVelocityX(speed);
        }

        if (cursors.up.isDown) {
            this.player.body.setVelocityY(-speed);
        } else if (cursors.down.isDown) {
            this.player.body.setVelocityY(speed);
        }
    }

    /**
     * Sends player position updates to the server based on movement thresholds.
     */
    handlePositionUpdates() {
        const currentTime = Date.now();
        if (currentTime - this.lastUpdateTime >= this.POSITION_UPDATE_INTERVAL) {
            const dx = Math.abs(this.player.x - this.lastSentPosition.x);
            const dy = Math.abs(this.player.y - this.lastSentPosition.y);

            if (dx > this.POSITION_THRESHOLD || dy > this.POSITION_THRESHOLD) {
                this.sendPosition();
                this.lastUpdateTime = currentTime;
                this.lastSentPosition = { x: this.player.x, y: this.player.y };
            }
        }
    }

    /**
     * Checks if the player has collected the square and notifies the server.
     */
    checkSquareCollection() {
        if (this.square && Phaser.Geom.Intersects.CircleToRectangle(this.player, this.square.getBounds())) {
            this.sendMessage(MSG_TYPES.COLLECT);
        }
    }

    /**
     * Sends a message to the server via WebSocket.
     * @param {string} type Message type
     * @param {object|null} [data=null] Optional message data
     */
    sendMessage(type, data = null) {
        if (this.socket.readyState === WebSocket.OPEN) {
            if (data) {
                this.socket.send(`${type}${JSON.stringify(data)}`);
            } else {
                this.socket.send(type);
            }
        }
    }

    /**
     * Sends the player's position to the server.
     */
    sendPosition() {
        this.sendMessage(MSG_TYPES.POS, [
            Math.round(this.player.x),
            Math.round(this.player.y),
            0, // vx (not used in this version). 
            0  // vy (not used in this version)
        ]); // vx and vy could be used to interpolate positions
    }

    /**
     * Configures WebSocket event handlers for communication.
     */
    setupWebSocket() {
        this.socket.onopen = () => {
            console.log('Connected to server');
        };

        this.socket.onmessage = (event) => {
            const type = event.data.charAt(0);
            const data = event.data.length > 1 ? JSON.parse(event.data.substring(1)) : null;

            switch(type) {
                case MSG_TYPES.INIT:
                    this.handleInit(data);
                    break;
                case MSG_TYPES.POS:
                    this.handlePosition(data);
                    break;
                case MSG_TYPES.SQUARE:
                    this.handleSquareSpawn(data);
                    break;
                case MSG_TYPES.COLLECT:
                    this.handleSquareCollection(data);
                    break;
                case MSG_TYPES.TIME:
                    this.handleTimeUpdate(data);
                    break;
                case MSG_TYPES.OVER:
                    this.handleGameOver(data);
                    break;
            }
        };

        this.socket.onclose = () => {
            this.gameStarted = false;
        };
    }

    /**
     * Handles the initialization of the game state.
     * @param {object} data Initialization data from the server
     */
    handleInit(data) {
        this.playerId = data.id;
        this.initializePlayers(data.p);
        this.gameStarted = true;
    }

    /**
     * Updates the position of the opponent player.
     * @param {Array} data Position data [playerId, x, y]
     */
    handlePosition(data) {
        if (data[0] !== this.playerId && this.otherPlayer) {
            this.otherPlayer.x = data[1];
            this.otherPlayer.y = data[2];
        }
    }

    /**
     * Spawns a new square on the game field.
     * @param {Array} data Square position [x, y]
     */
    handleSquareSpawn(data) {
        if (this.square) this.square.destroy();
        this.square = this.add.rectangle(data[0], data[1], 32, 32, 0x00ff00);
        this.physics.add.existing(this.square, true);
    }

    /**
     * Handles square collection events and updates scores.
     * @param {Array} data Collection data [squareId, playerScore, otherScore]
     */
    handleSquareCollection(data) {
        if (this.square) this.square.destroy();
        this.square = null;
        this.score = data[1];
        this.otherScore = data[2];
        this.updateScore();
    }

    /**
     * Updates the game timer.
     * @param {number} data Remaining time
     */
    handleTimeUpdate(data) {
        this.timeLeft = data;
        this.updateTimer();
    }

    /**
     * Handles game over logic and displays the result.
     * @param {Array} scores Final scores [playerScore, otherScore]
     */
    handleGameOver(scores) {
        this.gameStarted = false;

        const gameOverText = this.add.text(400, 300, '', {
            fontSize: '64px',
            fill: '#fff'
        }).setOrigin(0.5);

        if (scores[0] > scores[1]) {
            gameOverText.setText(this.playerId === 1 ? 'You Win!' : 'You Lose!');
        } else if (scores[0] < scores[1]) {
            gameOverText.setText(this.playerId === 1 ? 'You Lose!' : 'You Win!');
        } else {
            gameOverText.setText('Draw!');
        }

        if (this.socket) this.socket.close();
    }

    /**
     * Initializes player objects on the game field.
     * @param {Array} players List of players [x, y, id, color]
     */
    initializePlayers(players) {
        players.forEach(p => {
            const circle = this.add.circle(p[0], p[1], 16, p[3]);
            this.physics.add.existing(circle);
            circle.body.setCollideWorldBounds(true);

            if (p[2] === this.playerId) {
                this.player = circle;
                this.lastSentPosition = { x: p[0], y: p[1] };
                this.playerText.setText("Player:"+ p[2]);
                this.playerText.setBackgroundColor(p[3].toString(16).padStart(6, '0'));
            } else {
                this.otherPlayer = circle;
            }
        });
    }

    /**
     * Updates the score display.
     */
    updateScore() {
        this.scoreText.setText(`Score: ${this.score} - ${this.otherScore}`);
    }

    /**
     * Updates the timer display.
     */
    updateTimer() {
        this.timeText.setText(`Time: ${this.timeLeft}`);
    }
}

/**
 * Game configuration object.
 */
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: MainScene
};

// Create the Phaser game instance
let game = new Phaser.Game(config);
