import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AQYL — Аким на 5 часов",
  description: "Учебный симулятор управления городом. Команда ILON.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
