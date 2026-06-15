'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

export interface Settings {
  theme: 'dark' | 'light' | 'system';
  accentColor: string;
  fontSize: 'sm' | 'md' | 'lg';
  defaultModel: string;
  defaultMode: 'standard' | 'agent';
  showQuickChips: boolean;
  sidebarCollapsed: boolean;
  autoRun: boolean;
  streamResponses: boolean;
  showTokenCount: boolean;
}

export const SETTINGS_DEFAULTS: Settings = {
  theme: 'dark',
  accentColor: '#8AB4F8',
  fontSize: 'md',
  defaultModel: 'DeepSeek-V4-Flash',
  defaultMode: 'standard',
  showQuickChips: true,
  sidebarCollapsed: false,
  autoRun: false,
  streamResponses: true,
  showTokenCount: false,
};

const STORAGE_KEY = 'ir_settings';

const FONT_SIZES: Record<Settings['fontSize'], string> = {
  sm: '0.8125rem',
  md: '0.9375rem',
  lg: '1.0625rem',
};

interface SettingsContextValue {
  settings: Settings;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: SETTINGS_DEFAULTS,
  set: () => {},
});

function applyTheme(theme: Settings['theme']) {
  const html = document.documentElement;
  const apply = (isDark: boolean) => {
    html.classList.toggle('dark', isDark);
    html.classList.toggle('light', !isDark);
    html.setAttribute('data-theme', isDark ? 'dark' : 'light');
  };
  if (theme === 'system') {
    apply(window.matchMedia('(prefers-color-scheme: dark)').matches);
  } else {
    apply(theme === 'dark');
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(SETTINGS_DEFAULTS);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSettings({ ...SETTINGS_DEFAULTS, ...JSON.parse(stored) });
      } catch {}
    }
  }, []);

  useEffect(() => {
    let mq: MediaQueryList | undefined;
    const handler = () => applyTheme(settings.theme);
    applyTheme(settings.theme);
    if (settings.theme === 'system') {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', handler);
    }
    return () => mq?.removeEventListener('change', handler);
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--ir-font-size', FONT_SIZES[settings.fontSize]);
  }, [settings.fontSize]);

  useEffect(() => {
    document.documentElement.style.setProperty('--ir-accent', settings.accentColor);
  }, [settings.accentColor]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const set = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, set }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
