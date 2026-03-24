import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { translations } from '../i18n/translations';

export const LanguageContext = createContext(null);

const getByPath = (objectValue, path) => {
    return path.split('.').reduce((current, segment) => {
        if (!current || typeof current !== 'object') {
            return undefined;
        }
        return current[segment];
    }, objectValue);
};

export function LanguageProvider({ children }) {
    const [language, setLanguageState] = useState('vi');

    useEffect(() => {
        localStorage.setItem('preferredLanguage', 'vi');
        document.documentElement.lang = 'vi';
        if (language !== 'vi') {
            setLanguageState('vi');
        }
    }, [language]);

    const setLanguage = useCallback(() => {
        setLanguageState('vi');
    }, []);

    const t = useCallback((key, fallback = key) => {
        const activeValue = getByPath(translations[language], key);
        if (typeof activeValue === 'string') {
            return activeValue;
        }

        const fallbackValue = getByPath(translations.vi, key);
        if (typeof fallbackValue === 'string') {
            return fallbackValue;
        }

        return fallback;
    }, [language]);

    const value = useMemo(() => ({
        language,
        setLanguage,
        t,
    }), [language, setLanguage, t]);

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}
