import HeaderAuth from "@/components/header-auth";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import QueryProvider from "@/components/providers/query-provider";
import { Toaster } from "sonner";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Trakure",
  description: "Export Workflows, Perfected.",
};

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geistSans.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <QueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {/* <main className="min-h-screen flex flex-col items-center"> */}
            {/* <div className="flex-1 w-full flex flex-col gap-20 items-center"> */}
            {/* <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16"> */}
            {/* <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm"> */}
            {/* <div className="flex gap-5 items-center font-semibold"> */}
            {/* <ThemeSwitcher /> */}
            {/* </div> */}
            {/* <HeaderAuth /> */}
            {/* </div> */}
            {/* </nav> */}
            <div>{children}</div>
            <SpeedInsights />
            {/* </div> */}
            {/* </main> */}
          </ThemeProvider>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
