import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'THE TRANSMISSION',
  description: 'Intercepted signals from a world that already exists. The story never ends.',
  robots: 'index, follow',
  openGraph: {
    title: 'THE TRANSMISSION',
    description: 'A world is broadcasting. You are receiving.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
