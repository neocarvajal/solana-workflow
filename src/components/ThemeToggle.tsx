
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
      className="fixed bottom-20 right-8 z-50 p-3 rounded-full bg-muted hover:bg-muted/80 transition-all duration-300 shadow-lg hover:shadow-xl"
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDarkMode ? (
        <Sun className="h-5 w-5 text-yellow-400" />
      ) : (
        <Moon className="h-5 w-5 text-purple-500" />
      )}
    </button>
  );
};

export default ThemeToggle;
