import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { SettingsProvider } from "@/lib/settings-context";
import { SettingsUIProvider } from "@/lib/settings-ui-context";

export const metadata: Metadata = {
  title: "Visual Response Engine",
  description: "Interactive visual components in an AI chat stream",
};

// Applied before React hydrates — prevents a flash of wrong theme on load.
const themeScript = `(function(){try{var s=JSON.parse(localStorage.getItem('ir_settings')||'{}');var t=s.theme||'dark';var dark=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);document.documentElement.classList.toggle('light',!dark);document.documentElement.setAttribute('data-theme',dark?'dark':'light');var fs={'sm':'0.8125rem','md':'0.9375rem','lg':'1.0625rem'};document.documentElement.style.setProperty('--ir-font-size',fs[s.fontSize]||'0.9375rem');if(s.accentColor)document.documentElement.style.setProperty('--ir-accent',s.accentColor);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark h-full antialiased bg-background text-foreground"
      suppressHydrationWarning
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col items-center" suppressHydrationWarning>
        <SessionProvider>
          <SettingsProvider>
            <SettingsUIProvider>
              <main className="flex-1 w-full h-full flex flex-col">
                {children}
              </main>
            </SettingsUIProvider>
          </SettingsProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
