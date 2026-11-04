
import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = () => {
  // Determine initial theme: saved preference or system setting
  const getInitialTheme = () => {
    if (typeof window === 'undefined') return true; // default to dark on server
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  const [isDarkMode, setIsDarkMode] = useState<boolean>(getInitialTheme());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Apply theme class on mount and when toggled
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  return (
    <button
      onClick={toggleTheme}
      className="fixed bottom-[calc(10.5rem+env(safe-area-inset-bottom))] right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-muted shadow-lg transition-all duration-300 hover:bg-muted/80 hover:shadow-xl sm:bottom-20 sm:right-8"
      aria-label={
        !mounted
          ? 'Cambiar tema'
          : isDarkMode
            ? 'Switch to light mode'
            : 'Switch to dark mode'
      }
    >
      {!mounted ? (
        <span className="h-5 w-5" aria-hidden="true" />
      ) : isDarkMode ? (
        <Sun className="h-5 w-5 text-yellow-400" />
      ) : (
        <Moon className="h-5 w-5 text-purple-500" />
      )}
    </button>
  );
};

export default ThemeToggle;
