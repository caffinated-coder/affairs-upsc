import { createFileRoute } from "@tanstack/react-router";
import { DigestApp } from "@/components/digest-app";

export const Route = createFileRoute("/")({ component: DigestApp });
