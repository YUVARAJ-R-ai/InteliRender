import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  title: "Visual Response Engine",
  description: "Interactive visual components in an AI chat stream",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark h-full antialiased bg-background text-foreground"
    >
      <body className="min-h-full flex flex-col items-center" suppressHydrationWarning>
        <SessionProvider>
          <main className="flex-1 w-full h-full flex flex-col">
            {children}
          </main>
        </SessionProvider>
      </body>
    </html>
  );
}
