/**
 * Ringtone generator using Web Audio API.
 * No external file needed — generates a pleasant phone-ring pattern.
 */

let audioCtx = null;
let gainNode = null;
let oscillator = null;
let ringInterval = null;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

/** Start ringing — plays a "ring…pause…ring…pause" pattern */
export function startRingtone() {
    stopRingtone(); // clean up any previous ring

    const ctx = getAudioContext();
    gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(ctx.destination);

    // Ring pattern: 1s ring, 2s silence
    let ringing = false;

    const ring = () => {
        if (ringing) return;
        ringing = true;

        oscillator = ctx.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = 440;
        oscillator.connect(gainNode);
        oscillator.start();

        // fade in
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);

        // ring for 1 second then stop
        setTimeout(() => {
            if (oscillator) {
                gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
                setTimeout(() => {
                    try { oscillator?.stop(); } catch { /* already stopped */ }
                    oscillator = null;
                    ringing = false;
                }, 60);
            }
        }, 1000);
    };

    // Start immediately, then repeat every 3s (1s ring + 2s pause)
    ring();
    ringInterval = setInterval(ring, 3000);
}

/** Stop all ringing */
export function stopRingtone() {
    if (ringInterval) {
        clearInterval(ringInterval);
        ringInterval = null;
    }
    if (oscillator) {
        try { oscillator.stop(); } catch { /* ok */ }
        oscillator = null;
    }
    if (gainNode) {
        gainNode.disconnect();
        gainNode = null;
    }
}
