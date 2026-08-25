import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useState } from "react";
import { Toaster } from "sonner";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AuthProvider } from "@/lib/auth/provider";
import appCss from "../styles.css?url";

const APP_NAME = "Press Digest";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "description", content: "Curated stories from India's press on policy, diplomacy and public affairs." },
      { name: "theme-color", content: "#3d9b80" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
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
            <Toaster position="bottom-center" toastOptions={{ className: "font-sans text-sm", style: { background: "#fff", color: "#1c2434", border: "1px solid #e6eaf3" } }} />
          </QueryClientProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
