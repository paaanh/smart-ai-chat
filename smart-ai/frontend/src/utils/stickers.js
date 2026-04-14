export const STICKER_MESSAGE_PREFIX = '__smartsticker__:';

export const STICKER_CATALOG = [
    { id: 'default', emoji: '💙', gradientFrom: '#2563eb', gradientTo: '#60a5fa', accent: '#1d4ed8' },
    { id: 'capybara', emoji: '🦫', gradientFrom: '#d97706', gradientTo: '#f59e0b', accent: '#92400e' },
    { id: 'frog', emoji: '🐸', gradientFrom: '#16a34a', gradientTo: '#4ade80', accent: '#166534' },
    { id: 'catdog', emoji: '🐱', gradientFrom: '#f59e0b', gradientTo: '#fcd34d', accent: '#b45309' },
    { id: 'hug', emoji: '🫂', gradientFrom: '#6b7280', gradientTo: '#d1d5db', accent: '#374151' },
    { id: 'pepe-heart', emoji: '💚', gradientFrom: '#ec4899', gradientTo: '#f9a8d4', accent: '#be185d' },
    { id: 'dolphin-shark', emoji: '🐬', gradientFrom: '#60a5fa', gradientTo: '#c4b5fd', accent: '#4338ca' },
    { id: 'lazy-bear', emoji: '🦥', gradientFrom: '#f97316', gradientTo: '#fdba74', accent: '#9a3412' },
    { id: 'doge', emoji: '👍', gradientFrom: '#fbbf24', gradientTo: '#fde68a', accent: '#a16207' },
    { id: 'frog-duck', emoji: '🦆', gradientFrom: '#0ea5e9', gradientTo: '#bae6fd', accent: '#0369a1' },
    { id: 'overeat', emoji: '🍖', gradientFrom: '#ef4444', gradientTo: '#fb7185', accent: '#be123c' },
    { id: 'dinosaur', emoji: '🦕', gradientFrom: '#22d3ee', gradientTo: '#a5f3fc', accent: '#0e7490' },
    { id: 'lying-dog', emoji: '🐶', gradientFrom: '#92400e', gradientTo: '#d97706', accent: '#7c2d12' },
    { id: 'excited-pepe', emoji: '✨', gradientFrom: '#84cc16', gradientTo: '#bef264', accent: '#3f6212' },
    { id: 'shouting-seal', emoji: '😤', gradientFrom: '#fb7185', gradientTo: '#fda4af', accent: '#9f1239' },
];

const stickerLookup = new Map(STICKER_CATALOG.map((sticker) => [sticker.id, sticker]));

export function getStickerById(stickerId) {
    return stickerLookup.get(stickerId) || stickerLookup.get('default');
}

export function createStickerPayload(stickerId) {
    return `${STICKER_MESSAGE_PREFIX}${stickerId}`;
}

export function parseStickerPayload(content) {
    if (typeof content !== 'string') return null;
    if (!content.startsWith(STICKER_MESSAGE_PREFIX)) return null;

    const stickerId = content.slice(STICKER_MESSAGE_PREFIX.length).trim();
    if (!stickerId) return null;

    return {
        stickerId,
        sticker: getStickerById(stickerId),
    };
}

export function isStickerPayload(content) {
    return !!parseStickerPayload(content);
}
