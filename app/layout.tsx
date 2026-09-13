import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LayoutShell } from "@/components/layout-shell";
import { getCurrentStudent, toViewer } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SAT Tutor Pro",
  description: "AI-powered SAT tutoring with wrong answer intelligence",
  appleWebApp: {
    capable: true,
    title: "SAT Tutor",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/icon-180.png",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nav needs the viewer, but a failure here (for example the multi-user
  // migration not yet applied) must not take down every page: render the
  // bare shell and let the page's own requireStudent() surface the error.
  let viewer = null;
  try {
    const student = await getCurrentStudent();
    viewer = student ? toViewer(student) : null;
  } catch (err) {
    console.error('Root layout: could not resolve the signed-in student:', err);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // Apply the saved theme before hydration to avoid a flash
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('theme')==='dark'||(!localStorage.getItem('theme')&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LayoutShell viewer={viewer}>
          {children}
        </LayoutShell>
      </body>
    </html>
  );
}
