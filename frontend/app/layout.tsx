import type { Metadata } from "next";
import { Montserrat, Open_Sans } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["600", "700", "800"], // Bold for headlines
});

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
  weight: ["400", "500", "600"], // Clean for body
});

export const metadata: Metadata = {
  title: "One Click Video - Crown Mercado Studio",
  description: "Creating Brand Preference through AI video solutions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${openSans.variable}`}>
      <body className="antialiased min-h-screen bg-[#F9F9F9] font-sans">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
