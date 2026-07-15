import type { Metadata } from "next";
import { Inter, Cairo } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { AcademicProvider } from "@/context/AcademicContext";
import { SWRProvider } from "@/lib/swr-config";
import { ThemeProvider } from "@/context/ThemeContext";
import { NextIntlClientProvider } from "next-intl";
import { cookies } from "next/headers";
import enMessages from "../../messages/en.json";
import arMessages from "../../messages/ar.json";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "Studently - School Management System",
  description: "Comprehensive school management SaaS platform",
  manifest: "/manifest.json",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get('studently_language')?.value;
  const locale = rawLocale === 'ar' ? 'ar' : 'en';
  const messages = locale === 'ar' ? arMessages : enMessages;
  const isRTL = locale === "ar";

  return (
    <html
      lang={locale}
      dir={isRTL ? "rtl" : "ltr"}
      className={isRTL ? cairo.variable : inter.variable}
      suppressHydrationWarning
      translate="no"
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Polyfill Promise.withResolvers — required by pdfjs-dist v4+ (react-pdf v10+).
              // Chrome 119+, Firefox 121+, Safari 17.4+ have it natively; older browsers do not.
              if (typeof Promise.withResolvers !== 'function') {
                Promise.withResolvers = function() {
                  var resolve, reject;
                  var promise = new Promise(function(res, rej) { resolve = res; reject = rej; });
                  return { promise: promise, resolve: resolve, reject: reject };
                };
              }

              (function() {
                function getCookie(name) {
                  const value = '; ' + document.cookie;
                  const parts = value.split('; ' + name + '=');
                  if (parts.length === 2) return parts.pop().split(';').shift();
                }

                const theme = getCookie('studently-theme') ||
                              (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeProvider>
            <AuthProvider>
              <AcademicProvider>
                <SWRProvider>
                  {children}
                </SWRProvider>
              </AcademicProvider>
            </AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
