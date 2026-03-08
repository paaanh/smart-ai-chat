/**
 * ThemeContext.jsx — Manages app color theme.
 *
 * - Applies CSS custom properties to <html> on theme change
 * - Persists choice to localStorage (immediate) and optionally to backend
 * - Provides current theme ID + setter to consumers
 */
import { useState, useEffect, useCallback, createContext } from 'react';
import { THEMES, DEFAULT_THEME } from '../config/themes';

export const ThemeContext = createContext(null);

function applyTheme(themeId) {
    const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
    const root = document.documentElement;

    // Set data-theme attribute so CSS selectors can target it
    root.setAttribute('data-theme', themeId);

    // Apply all theme-specific variables to :root
    Object.entries(theme.vars).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });

    // Toggle dark mode class for App.css overrides
    if (theme.isDark) {
        root.classList.add('theme-dark');
    } else {
        root.classList.remove('theme-dark');
    }
}

export function ThemeProvider({ children }) {
    const [themeId, setThemeId] = useState(() => {
        // Priority: localStorage > user.preferredTheme > default
        const saved = localStorage.getItem('theme');
        if (saved && THEMES.some((t) => t.id === saved)) return saved;
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            if (user?.preferredTheme && THEMES.some((t) => t.id === user.preferredTheme)) {
                return user.preferredTheme;
            }
        } catch { /* ignore */ }
        return DEFAULT_THEME;
    });

    // Apply CSS variables whenever theme changes
    useEffect(() => {
        applyTheme(themeId);
    }, [themeId]);

    // Apply on mount (before first paint via useLayoutEffect-like behavior)
    useEffect(() => {
        applyTheme(themeId);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const changeTheme = useCallback((newThemeId) => {
        if (THEMES.some((t) => t.id === newThemeId)) {
            setThemeId(newThemeId);
            localStorage.setItem('theme', newThemeId);
        }
    }, []);

    return (
        <ThemeContext.Provider value={{ themeId, changeTheme, themes: THEMES }}>
            {children}
        </ThemeContext.Provider>
    );
}
