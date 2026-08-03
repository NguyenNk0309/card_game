import GameApp from "@/ui/GameApp";
import { DeviceSupportGate } from "@/ui/components/DeviceSupportGate";

export default function Home() {
  return <DeviceSupportGate><GameApp/></DeviceSupportGate>;
}
