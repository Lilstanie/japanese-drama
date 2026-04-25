import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "日本語ドラマ | 沉浸式日语学习",
  description: "沉浸式情景对话，中文教练实时辅助，学习日语从未如此自然",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
