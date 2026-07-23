import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shattered Oath — A 30 Minute Fantasy Roguelike",
  description: "Rival teams. One doomed road. A fast cooperative fantasy adventure for up to 10 players."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
