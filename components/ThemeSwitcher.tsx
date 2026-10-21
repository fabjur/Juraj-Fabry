import React from 'react';
import { useTheme } from '../theme/index.tsx';
import { useTranslation } from '../i18n/index.tsx';
import { Sun, Moon } from 'lucide-react';

interface ThemeSwitcherProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ className = '', showLabel = false }) => {
  const { isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();

  const label = isDark 
    ? (t('themeLight') || 'Svetlý režim') 
    : (t('themeDark') || 'Tmavý režim');

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center justify-center gap-1.5 p-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-zinc-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-500 ${className}`}
      title={`${label} (${t('themeSwitch') || 'Prepnúť režim'})`}
      aria-label={`${label}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-zinc-600 transition-transform duration-300 hover:-rotate-12" />
      )}
      {showLabel && (
        <span className="text-xs font-medium truncate">
          {label}
        </span>
      )}
    </button>
  );
};
