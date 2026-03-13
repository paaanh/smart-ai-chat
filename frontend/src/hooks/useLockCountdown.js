import { useState, useEffect } from 'react';

/**
 * Calculates remaining lock time from a lockUntil timestamp.
 * Updates every second. Returns isLocked=false when time expires.
 *
 * @param {string|Date|null} lockUntil - The lock expiry timestamp
 * @returns {{ isLocked: boolean, timeDisplay: string, remainingMs: number }}
 */
export function useLockCountdown(lockUntil) {
    const calcRemaining = () => {
        if (!lockUntil) return 0;
        return Math.max(0, new Date(lockUntil).getTime() - Date.now());
    };

    const [remaining, setRemaining] = useState(calcRemaining);

    useEffect(() => {
        if (!lockUntil) {
            setRemaining(0);
            return;
        }

        const update = () => setRemaining(calcRemaining());
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [lockUntil]); // eslint-disable-line react-hooks/exhaustive-deps

    const isLocked = remaining > 0;

    const timeDisplay = (() => {
        if (!isLocked) return '';
        const totalSecs = Math.ceil(remaining / 1000);
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        const s = totalSecs % 60;
        const pad = (n) => n.toString().padStart(2, '0');
        if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
        return `${pad(m)}:${pad(s)}`;
    })();

    return { isLocked, timeDisplay, remainingMs: remaining };
}
