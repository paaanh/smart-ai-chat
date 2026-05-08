import { useEffect, useRef, useState, useCallback } from 'react';

// Lightweight draggable hook for floating toolbars/widgets.
// - Drag only when mousedown lands on the wrapper (not on a button/input).
// - Persists translate offset to localStorage (per `storageKey`).
// - Clamps the element inside the viewport on drag and on window resize.
//
// Usage:
//   const { ref, style, resetPosition, dragHandleProps } = useDraggable('callToolbar');
//   <div ref={ref} style={style} {...dragHandleProps}>...</div>
//
// `dragHandleProps.onMouseDown` is what initiates a drag — buttons inside
// stop the event so clicks still work.
export function useDraggable(storageKey, { initial = { x: 0, y: 0 } } = {}) {
    const ref = useRef(null);
    const dragRef = useRef({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });

    const [pos, setPos] = useState(() => {
        if (!storageKey) return initial;
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') return parsed;
            }
        } catch { /* ignore */ }
        return initial;
    });

    const clamp = useCallback((next) => {
        const el = ref.current;
        if (!el) return next;
        const rect = el.getBoundingClientRect();
        // rect already includes the current translate. Convert to "if we set pos.x = next.x"
        // we need to know where the box would end up. Easiest: clamp around viewport.
        const margin = 8;
        const maxX = window.innerWidth - rect.width - margin;
        const maxY = window.innerHeight - rect.height - margin;
        // Compute current top-left without the translate offset.
        const baseLeft = rect.left - pos.x;
        const baseTop = rect.top - pos.y;
        const minX = margin - baseLeft;
        const minY = margin - baseTop;
        return {
            x: Math.min(Math.max(next.x, minX), maxX - baseLeft),
            y: Math.min(Math.max(next.y, minY), maxY - baseTop),
        };
    }, [pos.x, pos.y]);

    useEffect(() => {
        const onMove = (e) => {
            if (!dragRef.current.active) return;
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;
            setPos(clamp({ x: dragRef.current.baseX + dx, y: dragRef.current.baseY + dy }));
        };
        const onUp = () => {
            if (!dragRef.current.active) return;
            dragRef.current.active = false;
            document.body.style.userSelect = '';
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [clamp]);

    // Persist + re-clamp on resize
    useEffect(() => {
        if (storageKey) {
            try { localStorage.setItem(storageKey, JSON.stringify(pos)); } catch { /* quota */ }
        }
    }, [pos, storageKey]);

    useEffect(() => {
        const onResize = () => setPos((p) => clamp(p));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [clamp]);

    const onMouseDown = useCallback((e) => {
        // Don't initiate drag when the user clicks an interactive element.
        const target = e.target;
        if (target?.closest && target.closest('button, a, input, textarea, select, [data-no-drag]')) return;
        dragRef.current = {
            active: true,
            startX: e.clientX,
            startY: e.clientY,
            baseX: pos.x,
            baseY: pos.y,
        };
        document.body.style.userSelect = 'none';
    }, [pos.x, pos.y]);

    const onDoubleClick = useCallback((e) => {
        if (e.target?.closest && e.target.closest('button, a, input, textarea, select')) return;
        setPos({ x: 0, y: 0 });
    }, []);

    const resetPosition = useCallback(() => setPos({ x: 0, y: 0 }), []);

    return {
        ref,
        style: { transform: `translate(${pos.x}px, ${pos.y}px)`, touchAction: 'none' },
        dragHandleProps: { onMouseDown, onDoubleClick, style: { cursor: 'grab' } },
        resetPosition,
    };
}
