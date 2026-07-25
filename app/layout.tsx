import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shattered Oath — Multiplayer Card Arena",
  description: "A team-versus-team card and dice game for up to ten players."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
