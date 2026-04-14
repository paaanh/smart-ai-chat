const SIZE_MAP = {
    sm: {
        frame: 'w-[72px] h-[38px] rounded-[999px]',
        emoji: 'text-base',
    },
    md: {
        frame: 'w-[88px] h-[46px] rounded-[999px]',
        emoji: 'text-lg',
    },
    lg: {
        frame: 'w-[112px] h-[58px] rounded-[999px]',
        emoji: 'text-2xl',
    },
};

export default function StickerCard({ sticker, size = 'md', interactive = false, selected = false, onClick, className = '' }) {
    const chosenSize = SIZE_MAP[size] || SIZE_MAP.md;
    const shellClassName = `relative ${chosenSize.frame} overflow-hidden border shadow-sm ${selected ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary-light)]' : 'border-white/50'} ${className}`.trim();
    const stickerBackground = {
        backgroundImage: `linear-gradient(135deg, ${sticker.gradientFrom}, ${sticker.gradientTo})`,
    };

    const body = (
        <>
            <div className="absolute inset-[2px] rounded-[999px]" style={stickerBackground} />
            <div
                className="absolute left-2 bottom-1.5 w-2.5 h-2.5 rounded-full opacity-80"
                style={{ backgroundColor: sticker.accent }}
            />
            <div
                className="absolute right-3 top-1.5 w-1.5 h-1.5 rounded-full bg-white/70"
                aria-hidden="true"
            />
            <div className={`absolute inset-0 flex items-center justify-center ${chosenSize.emoji}`}>
                <span className="drop-shadow-sm" aria-hidden="true">{sticker.emoji}</span>
            </div>
        </>
    );

    if (!interactive) {
        return <div className={shellClassName}>{body}</div>;
    }

    return (
        <button
            type="button"
            onClick={onClick}
            className={`${shellClassName} transition hover:brightness-105 active:scale-[0.97]`}
            title={sticker.id}
        >
            {body}
        </button>
    );
}
