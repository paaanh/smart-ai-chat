import { useEffect, useRef, useCallback } from 'react';
import Phaser from 'phaser';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import GameScene from '../../game/GameScene';

/**
 * VirtualOffice — React wrapper that initializes a Phaser 3 game instance.
 *
 * Retrieves the username from AuthContext, injects socket helpers into the
 * Phaser scene, and cleans up on unmount.
 */
export default function VirtualOffice({ officeId = 'main-office' }) {
    const gameRef = useRef(null);
    const containerRef = useRef(null);
    const { user } = useAuth();
    const { emit, on, off, socketReady } = useSocket();

    // Stable refs for socket helpers so Phaser doesn't capture stale closures
    const emitRef = useRef(emit);
    const onRef = useRef(on);
    const offRef = useRef(off);
    useEffect(() => { emitRef.current = emit; }, [emit]);
    useEffect(() => { onRef.current = on; }, [on]);
    useEffect(() => { offRef.current = off; }, [off]);

    const stableEmit = useCallback((...args) => emitRef.current(...args), []);
    const stableOn = useCallback((...args) => onRef.current(...args), []);
    const stableOff = useCallback((...args) => offRef.current(...args), []);

    useEffect(() => {
        if (!containerRef.current || !socketReady || !user) return;

        // Prevent double initialization
        if (gameRef.current) return;

        const config = {
            type: Phaser.AUTO,
            parent: containerRef.current,
            width: 960,
            height: 640,
            backgroundColor: '#1a1a2e',
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: 0 },
                    debug: false,
                },
            },
            scene: [GameScene],
            scale: {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH,
            },
            render: {
                pixelArt: true,
                antialias: false,
            },
        };

        const game = new Phaser.Game(config);
        gameRef.current = game;

        // Pass data to the scene once it's ready
        game.events.on('ready', () => {
            const scene = game.scene.getScene('GameScene');
            if (scene) {
                scene._myUserId = user._id;
                scene.init({
                    socketEmit: stableEmit,
                    socketOn: stableOn,
                    socketOff: stableOff,
                    username: user.username,
                    officeId,
                });
                scene.scene.restart();
            }
        });

        return () => {
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
        };
    }, [socketReady, user, officeId, stableEmit, stableOn, stableOff]);

    if (!socketReady) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
                    <p className="text-[var(--color-text-secondary)]">Connecting to office...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header bar */}
            <div className="flex items-center gap-3 px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
                <span className="text-lg">🏢</span>
                <h2 className="font-semibold text-[var(--color-text-primary)]">Virtual Office</h2>
                <span className="text-sm text-[var(--color-text-secondary)]">
                    — {user?.username}
                </span>
                <div className="ml-auto flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs text-[var(--color-text-secondary)]">Connected</span>
                </div>
            </div>

            {/* Game canvas container */}
            <div
                ref={containerRef}
                className="flex-1 relative bg-[#1a1a2e] flex items-center justify-center overflow-hidden"
            />

            {/* Controls hint */}
            <div className="px-4 py-2 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] text-center">
                Use <kbd className="px-1 py-0.5 bg-[var(--color-bg-primary)] rounded text-[var(--color-text-primary)]">↑</kbd>{' '}
                <kbd className="px-1 py-0.5 bg-[var(--color-bg-primary)] rounded text-[var(--color-text-primary)]">↓</kbd>{' '}
                <kbd className="px-1 py-0.5 bg-[var(--color-bg-primary)] rounded text-[var(--color-text-primary)]">←</kbd>{' '}
                <kbd className="px-1 py-0.5 bg-[var(--color-bg-primary)] rounded text-[var(--color-text-primary)]">→</kbd>{' '}
                arrow keys to move your character
            </div>
        </div>
    );
}
