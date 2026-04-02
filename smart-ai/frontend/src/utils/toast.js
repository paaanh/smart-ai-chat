export function emitToast(message, options = {}) {
    if (typeof window === 'undefined' || !message) return;

    const detail = {
        message,
        type: options.type || 'info',
        duration: options.duration || 2800,
    };

    window.dispatchEvent(new CustomEvent('app:toast', { detail }));
}
