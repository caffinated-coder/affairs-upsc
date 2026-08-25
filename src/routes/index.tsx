import { createFileRoute } from "@tanstack/react-router";
import { DigestApp } from "@/components/digest-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <DigestApp />;
}
