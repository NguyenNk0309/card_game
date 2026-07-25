import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shattered Oath — Đấu trường thẻ bài nhiều người",
  description: "Trò chơi thẻ bài và xúc xắc đối kháng theo đội cho tối đa mười người chơi."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
