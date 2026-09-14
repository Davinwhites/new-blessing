import { createFileRoute } from "@tanstack/react-router";
import { PublicEmergencyPage } from "./public";

export const Route = createFileRoute("/")({ component: PublicEmergencyPage });
