import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrimeWave Lab | Resource reservations",
  description: "Sign in to reserve and manage PrimeWave Lab resources.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full font-sans antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
