import type { EventInput } from "./types";

export type MenuSuggestion = {
  name: string;
  category: EventInput["menu"][number]["category"];
  reason: string;
};

type Key = `${string}:${string}`; // `${cuisineGroup}:${mealType}`

// Curated starting menus. Deliberately small and editable — the user
// keeps, removes, and adds dishes before anything is generated.
const SOUTH_LUNCH: MenuSuggestion[] = [
  { name: "Buttermilk", category: "welcome", reason: "Customary welcome drink at daytime functions" },
  { name: "White rice", category: "main", reason: "The base of a South Indian function meal" },
  { name: "Sambar", category: "main", reason: "Standard first rice course" },
  { name: "Rasam", category: "main", reason: "Standard second rice course" },
  { name: "Vegetable curry", category: "side", reason: "Dry curry to accompany rice courses" },
  { name: "Dal", category: "side", reason: "Pappu is expected at Telugu functions" },
  { name: "Curd", category: "main", reason: "Closing rice course" },
  { name: "Pulihora", category: "special", reason: "Festive tamarind rice for auspicious occasions" },
  { name: "Payasam", category: "sweet", reason: "Traditional sweet finish" },
  { name: "Vada", category: "special", reason: "Commonly served fried item at functions" },
  { name: "Pickle and papad", category: "side", reason: "Standard accompaniments" },
];

const SOUTH_TIFFIN: MenuSuggestion[] = [
  { name: "Idli", category: "main", reason: "Crowd-safe tiffin staple" },
  { name: "Vada", category: "main", reason: "Pairs with idli on the plate" },
  { name: "Upma", category: "main", reason: "Filling and easy at scale" },
  { name: "Coconut chutney", category: "side", reason: "Standard accompaniment" },
  { name: "Sambar", category: "side", reason: "For idli and vada" },
  { name: "Kesari", category: "sweet", reason: "Simple sweet for tiffin functions" },
  { name: "Filter coffee", category: "welcome", reason: "Expected at morning functions" },
];

const NORTH_MEAL: MenuSuggestion[] = [
  { name: "Paneer butter masala", category: "main", reason: "Reliable crowd favourite" },
  { name: "Dal makhani", category: "main", reason: "Rich dal for function menus" },
  { name: "Jeera rice", category: "main", reason: "Base for gravies" },
  { name: "Roti", category: "main", reason: "Bread course" },
  { name: "Mixed veg sabzi", category: "side", reason: "Dry side for balance" },
  { name: "Raita", category: "side", reason: "Cooling accompaniment" },
  { name: "Gulab jamun", category: "sweet", reason: "Standard function sweet" },
  { name: "Masala chaas", category: "welcome", reason: "Welcome drink" },
];

const MENUS: Record<Key, MenuSuggestion[]> = {
  "south:lunch": SOUTH_LUNCH,
  "south:dinner": SOUTH_LUNCH,
  "south:breakfast": SOUTH_TIFFIN,
  "south:tiffin": SOUTH_TIFFIN,
  "north:lunch": NORTH_MEAL,
  "north:dinner": NORTH_MEAL,
  "north:breakfast": NORTH_MEAL,
  "north:tiffin": NORTH_MEAL,
};

function cuisineGroup(cuisine: EventInput["cuisine"]): "south" | "north" {
  return cuisine === "north_indian" ? "north" : "south";
}

export function suggestMenu(
  cuisine: EventInput["cuisine"],
  mealType: EventInput["mealType"],
): MenuSuggestion[] {
  return MENUS[`${cuisineGroup(cuisine)}:${mealType}`] ?? SOUTH_LUNCH;
}

export const LABELS: Record<string, string> = {
  housewarming: "Housewarming",
  wedding: "Wedding",
  birthday: "Birthday",
  pooja: "Pooja / religious function",
  other: "Other function",
  telugu: "Telugu",
  andhra: "Andhra",
  telangana: "Telangana",
  tamil: "Tamil",
  north_indian: "North Indian",
  mixed: "Mixed / multi-regional",
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  tiffin: "Evening tiffin",
  banana_leaf: "Banana leaf (served)",
  buffet: "Buffet",
  plated: "Plated service",
  self_service: "Self service",
  light: "Light eaters",
  average: "Average",
  heavy: "Heavy eaters",
  welcome: "Welcome",
  main: "Main",
  side: "Side",
  sweet: "Sweet",
  special: "Special",
};

export function label(key: string): string {
  return LABELS[key] ?? key;
}
