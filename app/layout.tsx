import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: 'Gestão de Contratos | Webcontinental',
  description:
    'Central de gestão, prazos e renovações de contratos da Webcontinental.',
  openGraph: {
    title: 'Gestão de Contratos | Webcontinental',
    description: 'Prazos, renovações e decisões em um só lugar.',
    images: [
      { url: '/og.png', width: 1672, height: 941, alt: 'Gestão de Contratos' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gestão de Contratos | Webcontinental',
    description: 'Prazos, renovações e decisões em um só lugar.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
