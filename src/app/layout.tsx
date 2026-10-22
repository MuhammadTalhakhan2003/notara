import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
// Fraunces is reserved for the Notara wordmark.
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz"] });

export const metadata: Metadata = {
  title: { default: "Notara — AI research notebook", template: "%s · Notara" },
  description:
    "Upload PDFs, websites, YouTube videos and notes, then chat with them, get cited answers, and turn them into podcasts, mind maps, quizzes, flashcards and slides you can download.",
  applicationName: "Notara",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Jet black is the default look; light mode only when the user picked it. Runs before first paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem('notara:theme');if(t!=='light')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} ${jakarta.variable} ${fraunces.variable} antialiased`}>{children}</body>
    </html>
  );
}
