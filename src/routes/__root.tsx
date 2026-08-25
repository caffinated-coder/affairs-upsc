import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useState } from "react";
import { Toaster } from "sonner";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AuthProvider } from "@/lib/auth/provider";
import appCss from "../styles.css?url";

const APP_NAME = "Affairs \u00d7 UPSC";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "description", content: "PIB, MEA and News on Air briefings for UPSC \u2014 daily, weekly or monthly PDFs." },
      { name: "theme-color", content: "#1e4d45" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: Root,
});

function Root() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 10 * 60 * 1000, gcTime: 24 * 60 * 60 * 1000, retry: 1, refetchOnWindowFocus: false, refetchOnReconnect: false } },
  }));
  return (
    <html lang="en" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body className="antialiased">
        <PreviewHostBridge />
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <Outlet />
            <Toaster position="bottom-center" toastOptions={{ className: "font-sans text-sm", style: { background: "#fbf8f2", color: "#1c1914", border: "1px solid #ddd4c6" } }} />
          </QueryClientProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
