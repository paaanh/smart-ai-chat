import { useTheme } from '../../hooks/useTheme';

export default function ThemedSurface({
    children,
    className = '',
    elevated = false,
    interactive = false,
}) {
    const { themeId } = useTheme();

    const isGlassTheme = themeId === 'glassmorphism' || themeId === 'neon-night';
    const isPixelTheme = themeId === 'pixel-art';

    const base = 'transition-all duration-300';
    const skin = isGlassTheme
        ? 'glass-panel'
        : 'bg-white';
    const pixel = isPixelTheme ? 'font-pixel pixel-card' : '';
    const depth = elevated ? 'shadow-lg border border-white/10' : '';
    const hover = interactive ? 'hover:-translate-y-0.5 hover:shadow-xl' : '';

    return (
        <div className={`${base} ${skin} ${pixel} ${depth} ${hover} ${className}`.trim()}>
            {children}
        </div>
    );
}
