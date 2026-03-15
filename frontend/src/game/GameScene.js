import Phaser from 'phaser';

// ─── Constants ──────────────────────────────────────────────────────
const TILE_SIZE = 32;
const PLAYER_SPEED = 160;
const SPRITE_SIZE = 32;
const FRAME_RATE = 8;
const FLOOR_TILE_INDEX = 2;          // Tiled index for walkable floor tiles
const MOVEMENT_EMIT_INTERVAL = 50;   // Client-side throttle interval (~20fps)

/**
 * GameScene — Phaser 3 Scene for the Virtual Office.
 *
 * Handles the local player, remote players, tilemap, and socket-based
 * multiplayer synchronization.
 */
export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.localPlayer = null;
        this.remotePlayers = new Map(); // id → { sprite, nameLabel }
        this.cursors = null;
        this.socketEmit = null;
        this.socketOn = null;
        this.socketOff = null;
        this.username = '';
        this.officeId = 'main-office';
        this.lastAnim = 'idle-down';
        this._lastEmitTime = 0;  // client-side movement throttle
    }

    /**
     * Called by the React wrapper to inject socket helpers & user data.
     */
    init(data) {
        this.socketEmit = data.socketEmit;
        this.socketOn = data.socketOn;
        this.socketOff = data.socketOff;
        this.username = data.username || 'Player';
        this.officeId = data.officeId || 'main-office';
    }

    // ─── PRELOAD ────────────────────────────────────────────────────
    preload() {
        // Generate tileset texture procedurally (wall, floor, desk)
        this._generateTilesetTexture();
        // Generate character spritesheet procedurally
        this._generateCharacterTexture();
        // Load tilemap JSON
        this.load.tilemapTiledJSON('office-map', '/office/office-map.json');
    }

    // ─── CREATE ─────────────────────────────────────────────────────
    create() {
        // Build tilemap
        const map = this.make.tilemap({ key: 'office-map' });
        const tileset = map.addTilesetImage('office-tileset', 'office-tileset');
        const floorLayer = map.createLayer('Floor', tileset, 0, 0);

        // Set collision on all tiles except walkable floor tiles
        floorLayer.setCollisionByExclusion([FLOOR_TILE_INDEX]);

        // Create animations
        this._createAnimations();

        // Create local player
        this.localPlayer = this.physics.add.sprite(400, 300, 'character', 0);
        this.localPlayer.setCollideWorldBounds(true);
        this.localPlayer.setDepth(10);
        this.localPlayer.body.setSize(SPRITE_SIZE * 0.6, SPRITE_SIZE * 0.6);

        // Name label above local player
        this.localNameLabel = this.add.text(0, 0, this.username, {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff',
            backgroundColor: '#1e40af',
            padding: { x: 4, y: 2 },
            resolution: 2,
        }).setOrigin(0.5, 1).setDepth(20);

        // Collisions
        this.physics.add.collider(this.localPlayer, floorLayer);

        // Camera
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.startFollow(this.localPlayer, true, 0.1, 0.1);

        // World bounds
        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

        // Keyboard input
        this.cursors = this.input.keyboard.createCursorKeys();

        // Register socket listeners
        this._registerSocketListeners();

        // Join the office
        this.socketEmit('office:join', { officeId: this.officeId });
    }

    // ─── UPDATE (game loop) ─────────────────────────────────────────
    update() {
        if (!this.localPlayer) return;

        const { left, right, up, down } = this.cursors;
        let vx = 0;
        let vy = 0;

        if (left.isDown) vx = -PLAYER_SPEED;
        else if (right.isDown) vx = PLAYER_SPEED;

        if (up.isDown) vy = -PLAYER_SPEED;
        else if (down.isDown) vy = PLAYER_SPEED;

        this.localPlayer.setVelocity(vx, vy);

        // Normalize diagonal speed
        if (vx !== 0 && vy !== 0) {
            this.localPlayer.setVelocity(vx * 0.707, vy * 0.707);
        }

        // Determine animation
        let anim = this.lastAnim;
        if (vx < 0) anim = 'walk-left';
        else if (vx > 0) anim = 'walk-right';
        else if (vy < 0) anim = 'walk-up';
        else if (vy > 0) anim = 'walk-down';
        else {
            // Idle based on last direction
            if (this.lastAnim.includes('left')) anim = 'idle-left';
            else if (this.lastAnim.includes('right')) anim = 'idle-right';
            else if (this.lastAnim.includes('up')) anim = 'idle-up';
            else anim = 'idle-down';
        }

        if (anim !== this.lastAnim) {
            this.localPlayer.anims.play(anim, true);
            this.lastAnim = anim;
        } else {
            this.localPlayer.anims.play(anim, true);
        }

        // Update name label position
        this.localNameLabel.setPosition(
            this.localPlayer.x,
            this.localPlayer.y - SPRITE_SIZE * 0.6
        );

        // Update remote player name labels in the main loop
        this.remotePlayers.forEach((remote) => {
            if (remote.sprite.active) {
                remote.nameLabel.setPosition(remote.sprite.x, remote.sprite.y - SPRITE_SIZE * 0.6);
            }
        });

        // Send movement to server with client-side throttle (~20fps)
        if (vx !== 0 || vy !== 0) {
            const now = Date.now();
            if (now - this._lastEmitTime >= MOVEMENT_EMIT_INTERVAL) {
                this._lastEmitTime = now;
                this.socketEmit('office:player-movement', {
                    officeId: this.officeId,
                    x: Math.round(this.localPlayer.x),
                    y: Math.round(this.localPlayer.y),
                    anim,
                });
            }
        }
    }

    // ─── Socket Listeners ───────────────────────────────────────────
    _registerSocketListeners() {
        this._onCurrentPlayers = (players) => {
            players.forEach((p) => {
                const id = p.userId || p._id;
                if (id === this._getMyId()) return;
                this._addRemotePlayer(id, p.username, p.x, p.y, p.anim);
            });
        };

        this._onPlayerJoined = ({ id, username, x, y, anim }) => {
            if (id === this._getMyId()) return;
            this._addRemotePlayer(id, username, x, y, anim);
        };

        this._onPlayerMoved = ({ id, x, y, anim }) => {
            const remote = this.remotePlayers.get(id);
            if (!remote) return;

            // Smooth interpolation using tweens
            this.tweens.add({
                targets: remote.sprite,
                x,
                y,
                duration: 80,
                ease: 'Linear',
            });

            if (anim) {
                remote.sprite.anims.play(anim, true);
            }
        };

        this._onPlayerLeft = ({ id }) => {
            this._removeRemotePlayer(id);
        };

        this.socketOn('office:current-players', this._onCurrentPlayers);
        this.socketOn('office:player-joined', this._onPlayerJoined);
        this.socketOn('office:player-moved', this._onPlayerMoved);
        this.socketOn('office:player-left', this._onPlayerLeft);
    }

    // ─── Remote Player Management ───────────────────────────────────
    _addRemotePlayer(id, username, x, y, anim) {
        if (this.remotePlayers.has(id)) return;

        const sprite = this.physics.add.sprite(x, y, 'character', 0);
        sprite.setDepth(10);
        if (anim) sprite.anims.play(anim, true);

        const nameLabel = this.add.text(x, y - SPRITE_SIZE * 0.6, username || 'Player', {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff',
            backgroundColor: '#059669',
            padding: { x: 4, y: 2 },
            resolution: 2,
        }).setOrigin(0.5, 1).setDepth(20);

        this.remotePlayers.set(id, { sprite, nameLabel });
    }

    _removeRemotePlayer(id) {
        const remote = this.remotePlayers.get(id);
        if (!remote) return;
        remote.sprite.destroy();
        remote.nameLabel.destroy();
        this.remotePlayers.delete(id);
    }

    _getMyId() {
        // Passed via init data or fallback
        return this._myUserId || '';
    }

    // ─── Procedural Texture Generation ──────────────────────────────
    _generateTilesetTexture() {
        const gfx = this.add.graphics();

        // Tile 0 (index 1 in Tiled) — Wall
        gfx.fillStyle(0x4b5563);
        gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        gfx.lineStyle(1, 0x374151);
        gfx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);

        // Tile 1 (index 2 in Tiled) — Floor
        gfx.fillStyle(0xe5e7eb);
        gfx.fillRect(0, TILE_SIZE, TILE_SIZE, TILE_SIZE);
        gfx.lineStyle(1, 0xd1d5db);
        gfx.strokeRect(0, TILE_SIZE, TILE_SIZE, TILE_SIZE);

        // Tile 2 (index 3 in Tiled) — Desk
        gfx.fillStyle(0x92400e);
        gfx.fillRect(0, TILE_SIZE * 2, TILE_SIZE, TILE_SIZE);
        gfx.lineStyle(1, 0x78350f);
        gfx.strokeRect(0, TILE_SIZE * 2, TILE_SIZE, TILE_SIZE);

        gfx.generateTexture('office-tileset', TILE_SIZE, TILE_SIZE * 3);
        gfx.destroy();
    }

    _generateCharacterTexture() {
        const gfx = this.add.graphics();
        const S = SPRITE_SIZE;

        // 4 rows (down, left, right, up) × 4 frames each
        const directions = [
            { bodyColor: 0x3b82f6, faceDir: 'down' },
            { bodyColor: 0x3b82f6, faceDir: 'left' },
            { bodyColor: 0x3b82f6, faceDir: 'right' },
            { bodyColor: 0x3b82f6, faceDir: 'up' },
        ];

        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const ox = col * S;
                const oy = row * S;
                const dir = directions[row];

                // Body
                gfx.fillStyle(dir.bodyColor);
                gfx.fillRect(ox + 8, oy + 12, 16, 18);

                // Head
                gfx.fillStyle(0xfbbf24);
                gfx.fillCircle(ox + 16, oy + 10, 8);

                // Eyes based on direction
                gfx.fillStyle(0x1f2937);
                if (dir.faceDir === 'down') {
                    gfx.fillRect(ox + 13, oy + 10, 2, 2);
                    gfx.fillRect(ox + 17, oy + 10, 2, 2);
                } else if (dir.faceDir === 'left') {
                    gfx.fillRect(ox + 11, oy + 10, 2, 2);
                } else if (dir.faceDir === 'right') {
                    gfx.fillRect(ox + 19, oy + 10, 2, 2);
                }
                // 'up' — no eyes visible

                // Walk animation offset for odd frames
                if (col % 2 === 1) {
                    gfx.fillStyle(dir.bodyColor);
                    gfx.fillRect(ox + 10, oy + 28, 4, 3);
                    gfx.fillRect(ox + 18, oy + 26, 4, 3);
                }
            }
        }

        gfx.generateTexture('character', S * 4, S * 4);
        gfx.destroy();

        // Create spritesheet from generated texture
        const tex = this.textures.get('character');
        if (tex) {
            tex.add('__BASE', 0, 0, 0, S * 4, S * 4);
            // Add individual frames
            let frameIndex = 0;
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col < 4; col++) {
                    tex.add(frameIndex, 0, col * S, row * S, S, S);
                    frameIndex++;
                }
            }
        }
    }

    _createAnimations() {
        // Row 0: down (frames 0-3), Row 1: left (4-7), Row 2: right (8-11), Row 3: up (12-15)
        const anims = [
            { key: 'walk-down', start: 0, end: 3 },
            { key: 'walk-left', start: 4, end: 7 },
            { key: 'walk-right', start: 8, end: 11 },
            { key: 'walk-up', start: 12, end: 15 },
            { key: 'idle-down', start: 0, end: 0 },
            { key: 'idle-left', start: 4, end: 4 },
            { key: 'idle-right', start: 8, end: 8 },
            { key: 'idle-up', start: 12, end: 12 },
        ];

        anims.forEach(({ key, start, end }) => {
            if (!this.anims.exists(key)) {
                this.anims.create({
                    key,
                    frames: this.anims.generateFrameNumbers('character', { start, end }),
                    frameRate: FRAME_RATE,
                    repeat: key.startsWith('walk') ? -1 : 0,
                });
            }
        });
    }

    // ─── Cleanup ────────────────────────────────────────────────────
    shutdown() {
        // Leave office on scene shutdown
        this.socketEmit('office:leave', { officeId: this.officeId });

        // Remove socket listeners
        this.socketOff('office:current-players', this._onCurrentPlayers);
        this.socketOff('office:player-joined', this._onPlayerJoined);
        this.socketOff('office:player-moved', this._onPlayerMoved);
        this.socketOff('office:player-left', this._onPlayerLeft);

        // Clean up remote players
        this.remotePlayers.forEach((remote) => {
            remote.sprite.destroy();
            remote.nameLabel.destroy();
        });
        this.remotePlayers.clear();
    }
}
