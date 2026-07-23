import { NextResponse } from "next/server";
import { createAdventure, createParty } from "@/backend/game/engine";

export const dynamic = "force-dynamic";

export function GET() {
  const adventure = createAdventure();
  return NextResponse.json({ adventure, party: createParty(6) });
}
