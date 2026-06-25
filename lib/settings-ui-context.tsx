'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { SettingsModal, type Section } from '@/components/SettingsModal';

interface SettingsUIValue {
  openSettings: (section?: Section) => void;
}

const SettingsUIContext = createContext<SettingsUIValue>({ openSettings: () => {} });

/**
 * Mounts the single master settings overlay and exposes openSettings() so any
 * component (sidebar, user menu) can open it at a given section. Also auto-opens
 * when returning from an OAuth flow (/?settings=Connectors&connected=gmail).
 */
export function SettingsUIProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<Section>('Appearance');
  const [oauthResult, setOauthResult] = useState<{ connected?: string; error?: string } | undefined>();

  const openSettings = useCallback((s: Section = 'Appearance') => {
    setOauthResult(undefined);
    setSection(s);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const s = params.get('settings');
    if (s) {
      const connected = params.get('connected') ?? undefined;
      const error = params.get('error') ?? undefined;
      setSection(s as Section);
      setOauthResult(connected || error ? { connected, error } : undefined);
      setOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const close = () => { setOpen(false); setOauthResult(undefined); };

  return (
    <SettingsUIContext.Provider value={{ openSettings }}>
      {children}
      {open && (
        <SettingsModal
          key={section}
          initialSection={section}
          oauthResult={oauthResult}
          onClose={close}
        />
      )}
    </SettingsUIContext.Provider>
  );
}

export function useSettingsUI() {
  return useContext(SettingsUIContext);
}
