import type { Metadata } from 'next';
import './fonts.css';
import './globals.css';
import './brand.css';
import './responsive.css';
import './logo-palette.css';
import { company } from '@/config/company';
export const metadata: Metadata = {
  metadataBase: company.siteUrl ? new URL(company.siteUrl) : undefined,
  alternates: company.siteUrl ? { canonical: company.siteUrl } : undefined,
  title: 'Commercial Laundry in Tirupati | Shree Sudhya',
  description: 'Commercial laundry for Tirupati businesses. Request a quote for linen, towel and uniform washing, finishing, pickup and delivery.',
  openGraph: { title: 'Shree Sudhya Laundry Services', description: 'Commercial linen, towel and uniform laundry for businesses in Tirupati.', images: company.siteUrl ? ['/images/brand-logo-clean.jpg'] : [] },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><head><link rel="preload" href="/fonts/dm-sans-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" /></head><body>{children}</body></html>;
}
