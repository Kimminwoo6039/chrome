import type {Metadata} from "next";
import localFont from "next/font/local";
import "./globals.css";
import {Providers} from "@/app/providers";
import {AppSidebar} from "@/components/sidebar/app-sidebar";
import {SidebarInset, SidebarProvider} from "@/components/ui/sidebar";
import CaptureToDetection from "@/components/detection/capture-to-detection";
import {GamblingProvider} from "@/lib/provider/gambling-context";

const customFont = localFont(
    {
      src: [
        {
          path: './fonts/Pretendard-Light.otf',
          weight: '300',
          style: 'light',
        },
        {
          path: './fonts/Pretendard-Regular.otf',
          weight: '400',
          style: 'normal',
        },
        {
          path: './fonts/Pretendard-Medium.otf',
          weight: '500',
          style: 'normal',
        },
        {
          path: './fonts/Pretendard-Bold.otf',
          weight: '600',
          style: 'normal',
        },

      ],
    })


export const metadata: Metadata = {
  title: "meerCat.ch",
  description: "meerCat.ch",
  icons: "/meer.ico"
};

export default function RootLayout({
                                     children,
                                   }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en">
      <body
          className={customFont.className}
      >
      <Providers>
        <GamblingProvider>
          <CaptureToDetection/>
          <SidebarProvider>
            <AppSidebar/>
            <SidebarInset>
              {children}
            </SidebarInset>
          </SidebarProvider>
        </GamblingProvider>
      </Providers>
      </body>
      </html>
  );
}
