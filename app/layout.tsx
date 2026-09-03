import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
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
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
