import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Xtra DevPilot | Elite AI Frontend Engineering",
  description: "Xtra DevPilot is a highly advanced, next-generation AI Developer Tool that seamlessly bridges your live Chrome Browser with your AI-powered IDE.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
        <link href="https://cdn.jsdelivr.net/npm/geist@1.3.0/dist/fonts/geist.css" rel="stylesheet"/>
        <link href="https://cdn.jsdelivr.net/npm/jetbrains-mono@1.0.6/css/jetbrains-mono.min.css" rel="stylesheet"/>
      </head>
      <body className="font-body-md text-body-md bg-background text-on-surface min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
