import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Video Shorts Generator',
  description:
    'Generate TikTok and YouTube Shorts from a text prompt using Ollama, Edge TTS, and Stable Horde — 100% free.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

