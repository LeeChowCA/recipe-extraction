// app/layout.tsx
import "./globals.css";
import { MantineProvider } from "@mantine/core";

export const metadata = {
  title: "Recipe Extraction Demo",
  description: "Frontend-only Mantine + LangChain JSON extraction",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MantineProvider defaultColorScheme="light">
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
