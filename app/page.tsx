import GameApp from "@/ui/GameApp";
import { DeviceSupportGate } from "@/ui/components/DeviceSupportGate";
import { GameMotionProvider } from "@/ui/motion/GameMotionProvider";

export default function Home() {
  return <GameMotionProvider><DeviceSupportGate><GameApp/></DeviceSupportGate></GameMotionProvider>;
}
