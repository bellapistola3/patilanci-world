import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Патиланци World — Вълшебно оцветяване",
  description: "Безопасно интерактивно оцветяване и тематични книжки за малките художници.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="bg"><body className="antialiased">{children}</body></html>;
}
