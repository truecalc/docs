import { Hanken_Grotesk, JetBrains_Mono, Archivo } from 'next/font/google';
import { Provider } from '@/components/provider';
import type { Metadata } from 'next';
import './global.css';

// TrueCalc brand fonts (see truecalc/distributions branding/design.md):
// Hanken Grotesk — UI/body/display · JetBrains Mono — code/values · Archivo (expanded) — logotype
const sans = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
const logo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-logo', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://docs.truecalc.app'),
  title: {
    template: '%s | TrueCalc',
    default: 'TrueCalc',
  },
  description:
    'Official documentation for TrueCalc — conformant spreadsheet formula evaluation for Google Sheets and Excel formulas in JavaScript, Rust, and WebAssembly.',
}

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${logo.variable}`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
