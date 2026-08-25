import { createFileRoute } from "@tanstack/react-router";
import { DigestApp } from "@/components/digest-app";
import { ViewersBadge } from "@/components/viewers-badge";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <>
      <DigestApp />
      <div className="fixed bottom-4 right-4 z-40">
        <ViewersBadge />
      </div>
    </>
  );
}
