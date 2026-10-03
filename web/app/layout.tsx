import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Young_Serif } from 'next/font/google';
import './tokens.css';
import './globals.css';

const youngSerif = Young_Serif({ weight: '400', subsets: ['latin'], variable: '--font-young-serif', display: 'swap' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });

export const metadata: Metadata = {
  title: 'Gift Marshal Pots',
  description: 'Chip in together for one great gift. Nobody is charged unless the pot fills.',
};

export const viewport: Viewport = { themeColor: '#DCE8F0' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${youngSerif.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
