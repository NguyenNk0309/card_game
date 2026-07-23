export type TeamId = "veil" | "ember";

export type Hero = {
  id: string;
  name: string;
  title: string;
  role: string;
  skill: string;
  skillText: string;
  hp: number;
  maxHp: number;
  team: TeamId;
  color: string;
  initials: string;
  isYou?: boolean;
};

export type ActionCard = {
  id: string;
  name: string;
  type: "Might" | "Wit" | "Spirit";
  description: string;
  bonus: number;
  risk: number;
};

export type Realm = {
  id: string;
  name: string;
  region: string;
  weather: string;
  objective: string;
  threat: string;
  accent: string;
  sceneClass: string;
};

export type Adventure = {
  seed: string;
  realm: Realm;
  chapter: number;
  maxChapters: number;
  story: string;
  event: string;
  target: number;
  worldDoom: number;
  veilInfluence: number;
  emberInfluence: number;
};
