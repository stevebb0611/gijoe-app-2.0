// vehicle-data.jsx — sample VEHICLES + PLAYSETS for the Vehicles page.
// Mirrors the figure model so the page can reuse the figures layout language:
//   year groups → rows/cards → completeness off a parts blueprint.
//
//   { id, name, faction(JOE|COBRA), year, type('vehicle'|'playset'),
//     klass (display class e.g. "Assault Tank"), driver (packed-in figure | null),
//     owned (copies held), parts:[[name, qtyRequired, qtyHeld], …] }
//
// Completeness is computed exactly like a figure's accessories: a vehicle is
// "complete" when every required part is fully held. Parts feed the same kind of
// progress bar + missing-summary the figures use.

const VEH_DATA = [
  { year: 1982, label: "SERIES 1 · 1982", note: "THE ORIGINAL MOTOR POOL", vehicles: [
    { id: 1, name: "MOBAT", faction: "JOE", type: "vehicle", klass: "Motorized Battle Tank", driver: "Steeler",
      owned: 1, parts: [["Main Cannon", 1, 1], ["Antenna", 1, 1], ["Tread Set", 2, 2]] },
    { id: 2, name: "VAMP", faction: "JOE", type: "vehicle", klass: "Attack Jeep", driver: "Clutch",
      owned: 1, parts: [["Windshield", 1, 1], ["Twin Gun Mount", 1, 0], ["Missiles", 2, 2], ["Decals", 1, 1]] },
    { id: 3, name: "RAM", faction: "JOE", type: "vehicle", klass: "Rapid Fire Motorcycle", driver: null,
      owned: 0, parts: [["Sidecar Gun", 1, 0], ["Windscreen", 1, 0]] },
    { id: 4, name: "HAL", faction: "JOE", type: "vehicle", klass: "Heavy Artillery Laser", driver: "Grand Slam",
      owned: 1, parts: [["Laser Barrel", 1, 1], ["Seat", 1, 1], ["Tripod", 1, 0]] },
  ] },
  { year: 1983, label: "SERIES 2 · 1983", note: "SKY & SEA EXPAND", vehicles: [
    { id: 5, name: "WOLVERINE", faction: "JOE", type: "vehicle", klass: "Armored Missile Vehicle", driver: "Cover Girl",
      owned: 1, parts: [["Missiles", 6, 4], ["Radar Dish", 1, 1], ["Tow Hook", 1, 1]] },
    { id: 6, name: "SHARC", faction: "JOE", type: "vehicle", klass: "Submersible Attack Craft", driver: "Deep Six",
      owned: 1, parts: [["Canopy", 1, 1], ["Missiles", 2, 2]] },
    { id: 7, name: "FALCON GLIDER", faction: "JOE", type: "vehicle", klass: "Attack Glider", driver: "Grunt",
      owned: 0, parts: [["Wing Set", 1, 0], ["Nose Cannon", 1, 0]] },
    { id: 8, name: "HISS TANK", faction: "COBRA", type: "vehicle", klass: "High Speed Sentry", driver: "HISS Driver",
      owned: 2, parts: [["Tread Set", 2, 2], ["Canopy", 1, 1], ["Antenna", 1, 0], ["Twin Cannon", 1, 1]] },
    { id: 9, name: "FANG", faction: "COBRA", type: "vehicle", klass: "Attack Copter", driver: null,
      owned: 1, parts: [["Rotor", 1, 1], ["Skids", 1, 1], ["Missiles", 2, 2]] },
  ] },
  { year: 1984, label: "SERIES 3 · 1984", note: "RED SHADOWS RISING", vehicles: [
    { id: 10, name: "VAMP MARK II", faction: "JOE", type: "vehicle", klass: "Multi-Purpose Attack Vehicle", driver: "Clutch",
      owned: 1, parts: [["Windshield", 1, 1], ["Whip Antenna", 2, 2], ["Cannon", 1, 1]] },
    { id: 11, name: "SKYSTRIKER XP-14F", faction: "JOE", type: "vehicle", klass: "Combat Jet", driver: "Ace",
      owned: 1, parts: [["Missiles", 4, 3], ["Canopy", 1, 1], ["Landing Gear", 3, 3], ["Decal Sheet", 1, 0], ["Drop Tank", 2, 2]] },
    { id: 12, name: "RATTLER", faction: "COBRA", type: "vehicle", klass: "Ground Attack Jet", driver: "Wild Weasel",
      owned: 1, parts: [["Missiles", 4, 4], ["Canopy", 1, 1], ["Bombs", 2, 1]] },
    { id: 13, name: "STINGER", faction: "COBRA", type: "vehicle", klass: "Night Attack Jeep", driver: "Stinger Driver",
      owned: 1, parts: [["Windshield", 1, 1], ["Gun Mount", 1, 1], ["Spare Tire", 1, 0]] },
    { id: 14, name: "SLUGGER", faction: "JOE", type: "vehicle", klass: "Self-Propelled Cannon", driver: "Thunder",
      owned: 1, parts: [["Cannon Barrel", 1, 1], ["Shells", 3, 3], ["Seat", 1, 1]] },
  ] },
  { year: 1985, label: "SERIES 4 · 1985", note: "WOLVES & SERPENTS", vehicles: [
    { id: 15, name: "AWE STRIKER", faction: "JOE", type: "vehicle", klass: "All-Terrain Buggy", driver: "Crankcase",
      owned: 1, parts: [["Roll Cage", 1, 1], ["Tow Hook", 1, 1], ["Missiles", 2, 2]] },
    { id: 16, name: "SNOW CAT", faction: "JOE", type: "vehicle", klass: "Half-Track", driver: "Frostbite",
      owned: 1, parts: [["Ski Set", 2, 2], ["Cannon", 1, 1], ["Antenna", 1, 1]] },
    { id: 17, name: "MORAY", faction: "COBRA", type: "vehicle", klass: "Hydrofoil", driver: "Lamprey",
      owned: 1, parts: [["Missiles", 4, 2], ["Radar", 1, 1], ["Canopy", 1, 1]] },
    { id: 18, name: "BRIDGE LAYER", faction: "JOE", type: "vehicle", klass: "Toss 'N Cross", driver: "Tollbooth",
      owned: 0, parts: [["Bridge Span", 1, 0], ["Hydraulics", 1, 0]] },
  ] },
  { year: 1985, label: "PLAYSETS · COMMAND", note: "BASES & HQ", isPlayGroup: true, vehicles: [
    { id: 19, name: "USS FLAGG", faction: "JOE", type: "playset", klass: "Aircraft Carrier", driver: "Keel Haul",
      owned: 0, parts: [["Island Tower", 1, 0], ["Elevator", 1, 0], ["Jet Catapult", 1, 0], ["Tow Tractor", 1, 0], ["Decals", 1, 0]] },
    { id: 20, name: "TERROR DROME", faction: "COBRA", type: "playset", klass: "Fortress / Launch Base", driver: "A.V.A.C.",
      owned: 1, parts: [["Firebat Jet", 1, 1], ["Launch Arm", 1, 1], ["Prison Pod", 1, 0], ["Console", 1, 1], ["Decals", 1, 0]] },
  ] },
];

// ---- helpers (parallel to the figure helpers in wf-data.jsx) ----
function vehState(v) {
  const req = v.parts.reduce((s, p) => s + p[1], 0);
  const have = v.parts.reduce((s, p) => s + Math.min(p[1], p[2]), 0);
  const missing = v.parts.filter(p => p[2] < p[1]);
  const complete = v.owned > 0 && missing.length === 0;
  return { req, have, missing, complete, pct: req ? Math.round((have / req) * 100) : 100 };
}

function vehFactionClass(f) {
  return f === "COBRA" ? "wf-fac--cobra" : "wf-fac--joe";
}

window.VEH_DATA = VEH_DATA;
window.vehState = vehState;
window.vehFactionClass = vehFactionClass;
