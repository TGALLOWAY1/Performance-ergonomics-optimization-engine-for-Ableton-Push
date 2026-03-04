import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // 1. Initialize state from localStorage or default to 'dark'
    const [theme, setTheme] = useState<Theme>(() => {
        const savedTheme = localStorage.getItem('push_perf_theme');
        if (savedTheme === 'light' || savedTheme === 'dark') {
            return savedTheme;
        }
        return 'dark';
    });

    // 2. Add/remove class AND save to localStorage when theme changes
    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'light') {
            root.classList.add('theme-light');
        } else {
            root.classList.remove('theme-light');
        }
        localStorage.setItem('push_perf_theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
