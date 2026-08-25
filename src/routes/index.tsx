import { createFileRoute } from "@tanstack/react-router";
import { DigestApp } from "@/components/digest-app";
import { ViewersBadge } from "@/components/viewers-badge";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute right-4 top-4 z-40 sm:right-6">
        <div className="pointer-events-auto">
          <ViewersBadge />
        </div>
      </div>
      <DigestApp />
    </div>
  );
}
