// wf-data.jsx — sample catalog + completeness helpers + shared low-fi widgets
// All exported to window for the other babel scripts to consume.

// ----- SAMPLE COLLECTION (modeled on the route.js schema) -----------------
// year  -> figures[]; each figure mirrors the catalog + owned shape:
//   code_name, variant, faction (JOE|COBRA), owned (instance count),
//   accessories[{ name, req (quantity_required), own (quantity_owned) }]
const DATA = [
  { year: 1982, label: "THE ORIGINAL 13", figures: [
    { id: 101, name: "SNAKE EYES", variant: "v1 · straight-arm", faction: "JOE",   owned: 2, acc: [["Uzi SMG",1,1],["Backpack",1,1]] },
    { id: 102, name: "STALKER",    variant: "Ranger",            faction: "JOE",   owned: 1, acc: [["M-32 Rifle",1,1],["Backpack",1,0]] },
    { id: 103, name: "SCARLETT",   variant: "Counter Intel",     faction: "JOE",   owned: 1, acc: [["Pistol Crossbow",1,1],["Backpack",1,1]] },
    { id: 104, name: "BREAKER",    variant: "Communications",    faction: "JOE",   owned: 1, acc: [["M-16 Rifle",1,0],["Backpack",1,1]] },
    { id: 105, name: "GRUNT",      variant: "Infantry",          faction: "JOE",   owned: 1, acc: [["M-16 Rifle",1,1],["Backpack",1,1]] },
    { id: 106, name: "COBRA CMDR", variant: "Enemy Leader",      faction: "COBRA", owned: 1, acc: [["Pistol",1,1],["Backpack",1,0]] },
    { id: 107, name: "COBRA OFFICER", variant: "The Enemy",      faction: "COBRA", owned: 3, acc: [["AK Rifle",1,2],["Backpack",1,1]] },
    { id: 108, name: "FLASH",      variant: "Laser Trooper",       faction: "JOE",   owned: 0, acc: [["Laser Rifle",1,0],["Backpack",1,0]] },
    { id: 109, name: "COBRA TROOPER", variant: "The Enemy",        faction: "COBRA", owned: 0, acc: [["AK Rifle",1,0],["Backpack",1,0]] },
  ]},
  { year: 1983, label: "SWIVEL-ARM BATTLE GRIP", figures: [
    { id: 201, name: "DUKE",       variant: "First Sergeant",    faction: "JOE",   owned: 1, acc: [["Rifle",1,1],["Backpack",1,1],["Helmet",1,0]] },
    { id: 202, name: "GUNG-HO",    variant: "Marine",            faction: "JOE",   owned: 1, acc: [["M-16 Rifle",1,1],["Backpack",1,1]] },
    { id: 203, name: "AIRBORNE",   variant: "Helicopter Assault",faction: "JOE",   owned: 1, acc: [["Rifle",1,1],["Backpack",1,1]] },
    { id: 204, name: "SNOW JOB",   variant: "Arctic Trooper",    faction: "JOE",   owned: 1, acc: [["XMLR-3A Rifle",1,1],["Backpack",1,0],["Skis",2,1],["Poles",2,2]] },
    { id: 205, name: "DESTRO",     variant: "Weapons Supplier",  faction: "COBRA", owned: 1, acc: [["Pistol",1,1],["Backpack",1,1]] },
    { id: 206, name: "MAJOR BLUDD",variant: "Mercenary",         faction: "COBRA", owned: 1, acc: [["Rifle",1,0],["Backpack",1,1],["Arm Cannon",1,1]] },
  ]},
  { year: 1984, label: "SERIES 3 · 1984", figures: [
    // ── LIVE DATA: sourced from gijoe_db_figures_2.0 + figures_accessories (1984 only).
    //    name=code_name · version · fullName · specialty · vehicle (is_vehicle_driver) · variants (mold count).
    //    A/B/C mold variants collapsed to one character; accessories kept in CSV order (typos & dup rows faithful).
    { id: 301, name: "BARONESS", version: "v1", faction: "COBRA", fullName: "Classified", specialty: "Intelligence", owned: 1, acc: [["Backpack",1,0],["Laser Rifle",1,1]] },
    { id: 302, name: "BLOWTORCH", version: "v1", faction: "JOE", fullName: "Hanrahan, Timothy P.", specialty: "Infantry Special Weapons", owned: 1, variants: 3, acc: [["Helmet",1,1],["Helmet (with holes)",1,1],["Oxygen Mask",1,1],["M-7 Manpack",1,0],["Flamethrower",1,1],["Flamethrower",1,1]] },
    { id: 303, name: "CLUTCH", version: "v2", faction: "JOE", fullName: "Steinberg, Lance J.", specialty: "Transportation", owned: 1, vehicle: "VAMP Mark II", acc: [["Helmet",1,1]] },
    { id: 304, name: "COBRA COMMANDER", version: "v2", faction: "COBRA", fullName: "Classified", specialty: "Intelligence", owned: 1, acc: [["\"Venom\" Laser Pistol",1,1]] },
    { id: 305, name: "COPPERHEAD", version: "v1", faction: "COBRA", fullName: "Classified", specialty: "Air-Driver Swamp Vehicle Operator", owned: 2, vehicle: "Water Moccasin", variants: 3, acc: [] },
    { id: 306, name: "CUTTER", version: "v1", faction: "JOE", fullName: "Stone, Skip A.", specialty: "Hovercraft Captain", owned: 1, vehicle: "Killer W.H.A.L.E.", acc: [] },
    { id: 307, name: "DEEP SIX", version: "v1", faction: "JOE", fullName: "Willoughby, Malcom R.", specialty: "Driver", owned: 1, vehicle: "S.H.A.R.C.", acc: [["Bellows",1,1],["One-Way Valve",1,1],["Connector",1,0],["Tubing",1,1],["String",1,1]] },
    { id: 308, name: "FIREFLY", version: "v1", faction: "COBRA", fullName: "Classified", specialty: "Sabotage, Demolitions, and Terror", owned: 1, variants: 2, acc: [["Demolition Backpack",1,1],["Demolition Backpack Cover",1,0],["Submachine Gun",1,1],["Submachine Gun",1,1],["Walkie-Talkie",1,1],["Walkie-Talkie",1,0]] },
    { id: 309, name: "MUTT", version: "v1", faction: "JOE", fullName: "Perlmutter, Stanley R.", specialty: "Dog Handler", owned: 1, acc: [["Helmet",1,0],["Helmet (with holes)",1,1],["Face Mask",1,1],["Mac-11 Submachine Gun",1,1],["Night Stick",1,0],["Leash",1,1],["Dog, Junkyard",1,1]] },
    { id: 310, name: "RECONDO", version: "v1", faction: "JOE", fullName: "LeClaire, Daniel M.", specialty: "Infantry", owned: 1, variants: 2, acc: [["Cross Country Backpack",1,1],["Cross Country Packpack",1,1],["M-14E2X Rifle",1,1],["M-14E2X Rifle",1,0]] },
    { id: 311, name: "RIP CORD", version: "v1", faction: "JOE", fullName: "Weems, Wallace A.", specialty: "Airborne Infantry", owned: 1, acc: [["Helmet",1,1],["Helmet (with holes)",1,1],["Oxygen Mask",1,0],["Parachute Pack",1,1],["SLR-W1L1 Rifle",1,1],["SLR-W1L1 Rifle",1,1]] },
    { id: 312, name: "ROADBLOCK", version: "v1", faction: "JOE", fullName: "Hinton, Marvin F.", specialty: "Infantry Heavy Weapons", owned: 2, acc: [["Helmet (no holes)",1,1],["Machine Gunner Backpack",1,0],["Ammo Box",1,1],["M-2X Heavy Machine Gun",1,1],["M-2X Heavy Machine Gun",1,1],["Tripod",1,0],["Tripod",1,1]] },
    { id: 313, name: "SCRAP-IRON", version: "v1", faction: "COBRA", fullName: "Classified", specialty: "Tank Destroyer", owned: 1, acc: [["RAR Pistol",1,0],["Missile System Top",1,1],["Missile System Bottom",1,1],["Missile System Base",1,1],["Missile System Legs",2,1],["Missiles",2,2],["Remote Activator (thin handle)",1,1],["Remote Activator (thick handle)",1,1]] },
    { id: 314, name: "SPIRIT", version: "v1", faction: "JOE", fullName: "Iron-Knife, Charlie", specialty: "Infantry", owned: 1, variants: 2, acc: [["Arrow Cassette Pack",1,1],["Arrow Cassette Pack",1,1],["Auto-Arrow Launcher",1,1],["Auto-Arrow Launcher",1,0],["Belt",1,1],["Freedom, Eagle",1,1],["Freedom Claw",1,1]] },
    { id: 315, name: "STINGER DRIVER", version: "v1", faction: "COBRA", fullName: "", specialty: "Stinger Driver, Infantry", owned: 0, vehicle: "Stinger", acc: [] },
    { id: 316, name: "STORM SHADOW", version: "v1", faction: "COBRA", fullName: "Classified", specialty: "Assassin", owned: 1, acc: [["Long Bow",1,1],["Nunchaku Sticks",1,0],["Wakizashi (Short Samurai Sword)",1,1],["Katana (Long Samurai Sword)",1,1]] },
    { id: 317, name: "THUNDER", version: "v1", faction: "JOE", fullName: "Breckinridge, Matthew Harris", specialty: "Artillery", owned: 1, vehicle: "Slugger", acc: [["Radio Headset",1,0],["Radio Headset",1,1],["Visor",1,1],["Monocular",1,1]] },
    { id: 318, name: "TOLLBOOTH", version: "v1", faction: "JOE", fullName: "Goren, Chuck X.", specialty: "Combat Engineer", owned: 1, vehicle: "Toss 'N Cross", acc: [["Sledgehammer",1,1]] },
    { id: 319, name: "WILD WEASEL", version: "v1", faction: "COBRA", fullName: "Classified", specialty: "Ground Support Pilot", owned: 0, vehicle: "Rattler Jet", variants: 2, acc: [] },
    { id: 320, name: "ZARTAN", version: "v1", faction: "DREADNOK", fullName: "", specialty: "Master of Disguise", owned: 1, vehicle: "Chameleon", acc: [["Face Mask Disguise",1,1],["Chest Armor",1,0],["Left Thigh Pad",1,1],["Right Thigh Pad",1,1],["Backpack",1,1],["Pistol",1,0],["Chest Armor Heat Sticker (single-sided)",1,1],["Thigh Pad Heat Sticker (single-sided)",2,2],["Thigh Pad Heat Sticker (double-sided)",2,2],["Chest Armor Heat Sticker (double-sided)",1,0]] },
  ]},
  { year: 1985, label: "WOLVES & SERPENTS", figures: [
    { id: 401, name: "SNAKE EYES", variant: "v2 · w/ Timber",    faction: "JOE",   owned: 1, acc: [["Uzi SMG",1,1],["Backpack",1,1],["Timber (wolf)",1,0]] },
    { id: 402, name: "FLINT",      variant: "Warrant Officer",   faction: "JOE",   owned: 1, acc: [["Rifle",1,1],["Backpack",1,1]] },
    { id: 403, name: "LADY JAYE",  variant: "Covert Ops",        faction: "JOE",   owned: 1, acc: [["Javelin",1,1],["Backpack",1,1]] },
    { id: 404, name: "SHIPWRECK",  variant: "Sailor",            faction: "JOE",   owned: 1, acc: [["Rifle",1,1],["Polly (parrot)",1,0]] },
    { id: 405, name: "SNOW SERPENT", variant: "Polar Assault",   faction: "COBRA", owned: 1, acc: [["Rifle",1,1],["Backpack",1,1],["Skis",1,0],["Ice Axe",1,1],["Snowshoes",2,1]] },
    { id: 406, name: "CRIMSON GUARD", variant: "Elite Trooper",  faction: "COBRA", subteam: "Crimson Guard", owned: 4, acc: [["Rifle",1,3],["Backpack",1,2],["Bayonet",1,1],["Spare Clip",4,2]] },
    { id: 407, name: "ZARTAN",     variant: "Master of Disguise", faction: "COBRA", owned: 0, acc: [["Pistol",1,0],["Crossbow",1,0],["Backpack",1,0]] },
    { id: 408, name: "BUZZER",     variant: "Dreadnok",            faction: "DREADNOK", owned: 1, acc: [["Chainsaw",1,1],["Backpack",1,0]] },
    { id: 409, name: "RIPPER",     variant: "Dreadnok",            faction: "DREADNOK", owned: 1, acc: [["Rifle",1,1],["Backpack",1,1]] },
  ]},
  { year: 1986, label: "SERPENTOR'S LEGION", figures: [
    { id: 501, name: "BEACH HEAD",  variant: "Ranger",            faction: "JOE",   owned: 1, acc: [["Rifle",1,1],["Backpack",1,1],["Balaclava",1,0]] },
    { id: 502, name: "LIFELINE",    variant: "Rescue Trooper",    faction: "JOE",   owned: 1, acc: [["Pistol",1,0],["Med Pack",1,1]] },
    { id: 503, name: "WET-SUIT",    variant: "SEAL",              faction: "JOE",   owned: 1, acc: [["Harpoon",1,1],["Tanks",1,1],["Fins",2,1]] },
    { id: 504, name: "LEATHERNECK", variant: "Marine",            faction: "JOE",   owned: 1, acc: [["Machine Gun",1,1],["Backpack",1,1]] },
    { id: 505, name: "VIPER",       variant: "Infantry",          faction: "COBRA", owned: 5, coo: ["China","Hong Kong"], acc: [["Rifle",1,4],["Backpack",1,3],["Spare Mag",5,3]] },
    { id: 506, name: "DR. MINDBENDER", variant: "Mind Control",   faction: "COBRA", owned: 1, acc: [["Scepter",1,1],["Cape",1,0]] },
    { id: 507, name: "SERPENTOR",   variant: "Cobra Emperor",     faction: "COBRA", owned: 1, acc: [["Snake Staff",1,1],["Cape",1,1],["Chariot Parts",1,0]] },
  ]},
  { year: 1987, label: "SEASON OF THE FALCON", figures: [
    { id: 601, name: "FALCON",      variant: "Green Beret",       faction: "JOE",   owned: 1, acc: [["Rifle",1,1],["Backpack",1,1],["Knife",1,0]] },
    { id: 602, name: "JINX",        variant: "Ninja Intel",       faction: "JOE",   owned: 1, acc: [["Sword",2,2],["Nunchaku",1,1]] },
    { id: 603, name: "LAW & ORDER", variant: "MP & K9",           faction: "JOE",   owned: 1, acc: [["Pistol",1,1],["Order (dog)",1,1]] },
    { id: 604, name: "OUTBACK",     variant: "Survivalist",       faction: "JOE",   owned: 1, acc: [["Rifle",1,1],["Backpack",1,0]] },
    { id: 605, name: "CROC MASTER", variant: "Reptile Trainer",   faction: "COBRA", owned: 1, acc: [["Whip",1,1],["Crocodile",1,1],["Mask",1,0]] },
    { id: 606, name: "BIG BOA",     variant: "Trainer",           faction: "COBRA", owned: 1, acc: [["Gloves",2,2],["Mask",1,1]] },
  ]},
  { year: 1988, label: "IRON GRENADIERS", figures: [
    { id: 701, name: "HIT & RUN",   variant: "Light Infantry",    faction: "JOE",   owned: 1, acc: [["Rifle",1,1],["Grappling Hook",1,0]] },
    { id: 702, name: "SHOCKWAVE",   variant: "S.W.A.T.",          faction: "JOE",   owned: 1, acc: [["MP5",1,1],["Pistol",1,1],["Shield",1,1]] },
    { id: 703, name: "STORM SHADOW",variant: "v2 · Ninja",        faction: "COBRA", owned: 1, acc: [["Sword",2,1],["Backpack",1,1]] },
    { id: 704, name: "ASTRO-VIPER", variant: "Cobra Astronaut",   faction: "COBRA", owned: 1, acc: [["Rifle",1,1],["Pod",1,0]] },
    { id: 705, name: "DESTRO",      variant: "v2 · Iron Grenadier",faction: "COBRA", subteam: "Iron Grenadiers", owned: 1, acc: [["Pistol",1,1],["Cape",1,1]] },
    { id: 706, name: "VOLTAR",      variant: "General",           faction: "COBRA", subteam: "Iron Grenadiers", owned: 1, acc: [["Pistol",1,1],["Backpack",1,1]] },
  ]},
  { year: 1989, label: "NIGHT FORCE", figures: [
    { id: 801, name: "SNAKE EYES",  variant: "v3 · Battle Forces",faction: "JOE",   owned: 2, acc: [["Uzi SMG",1,1],["Backpack",1,1]] },
    { id: 802, name: "STALKER",     variant: "v2 · Night Force",  faction: "JOE",   subteam: "Night Force", owned: 1, acc: [["Rifle",1,1],["Backpack",1,1]] },
    { id: 809, name: "FALCON",      variant: "v2 · Night Force",  faction: "JOE",   subteam: "Night Force", owned: 1, acc: [["Rifle",1,1],["Backpack",1,0]] },
    { id: 803, name: "BACKBLAST",   variant: "Anti-Aircraft",     faction: "JOE",   owned: 1, acc: [["Missile Launcher",1,1],["Backpack",1,0]] },
    { id: 804, name: "ALLEY-VIPER", variant: "Urban Assault",     faction: "COBRA", owned: 3, acc: [["Rifle",1,2],["Shield",1,2],["Backpack",1,1]] },
    { id: 805, name: "NIGHT-VIPER", variant: "Night Fighter",     faction: "COBRA", owned: 2, acc: [["Rifle",1,1],["Goggles",1,0]] },
    { id: 806, name: "ANNIHILATOR", variant: "Elite Trooper",     faction: "COBRA", owned: 1, acc: [["Rifle",1,1],["Backpack",1,1]] },
    { id: 807, name: "COL. BREKHOV", variant: "Oktober Guard",    faction: "OKTOBER", owned: 1, acc: [["AK Rifle",1,1],["Backpack",1,0]] },
    { id: 808, name: "HORROR-SHOW",  variant: "Oktober Guard",    faction: "OKTOBER", owned: 1, acc: [["Machine Gun",1,1],["Backpack",1,1]] },
  ]},
  { year: 1990, label: "SONIC FIGHTERS", figures: [
    { id: 901, name: "AMBUSH",      variant: "Concealment",       faction: "JOE",   owned: 1, acc: [["Rifle",1,1],["Bush Cover",1,0]] },
    { id: 902, name: "SUB-ZERO",    variant: "Winter Ops",        faction: "JOE",   owned: 1, acc: [["Rifle",1,1],["Backpack",1,1]] },
    { id: 903, name: "RAMPART",     variant: "Shoreline Defense", faction: "JOE",   owned: 1, acc: [["Launcher",1,1]] },
    { id: 904, name: "RANGE-VIPER", variant: "Wilderness Trooper",faction: "COBRA", owned: 2, acc: [["Rifle",1,1],["Pack",1,1],["Claw",1,0]] },
    { id: 905, name: "NIGHT CREEPER",variant: "Ninja",            faction: "COBRA", owned: 1, acc: [["Staff",1,1],["Bow",1,0]] },
    { id: 906, name: "METAL-HEAD",  variant: "Anti-Tank",         faction: "COBRA", owned: 1, acc: [["Launcher",1,1],["Backpack",1,1]] },
  ]},
  { year: 1991, label: "SUPER SONIC FIGHTERS", figures: [
    { id: 1001, name: "BIG BEN",    variant: "British S.A.S.",    faction: "JOE",   owned: 1, acc: [["Rifle",1,1],["Backpack",1,1]] },
    { id: 1002, name: "HEAVY DUTY", variant: "Heavy Ordnance",    faction: "JOE",   owned: 1, acc: [["MG",1,1],["Tripod",1,0]] },
    { id: 1003, name: "SNAKE EYES", variant: "v4 · Sonic Fighter",faction: "JOE",   owned: 1, acc: [["Sword",1,1],["Uzi SMG",1,1]] },
    { id: 1004, name: "SNOW SERPENT",variant: "v2 · Polar",       faction: "COBRA", owned: 1, acc: [["Rifle",1,1],["Skis",2,2]] },
    { id: 1005, name: "CG IMMORTAL",variant: "Elite Crimson",     faction: "COBRA", subteam: "Crimson Guard", owned: 2, acc: [["Rifle",1,2],["Backpack",1,1]] },
    { id: 1006, name: "B.A.T.",     variant: "v2 · Android",      faction: "COBRA", owned: 4, acc: [["Arm Tools",3,2]] },
  ]},
  { year: 1992, label: "DESTRO'S DESTROYERS", figures: [
    { id: 1101, name: "WILD BILL",  variant: "v2 · Aero-Scout",   faction: "JOE",   owned: 1, acc: [["Rifle",1,1],["Hat",1,1]] },
    { id: 1102, name: "GUNG-HO",    variant: "v3 · Marine",       faction: "JOE",   owned: 1, acc: [["MG",1,1],["Backpack",1,0]] },
    { id: 1103, name: "ROADBLOCK",  variant: "v4 · Heavy MG",     faction: "JOE",   owned: 1, acc: [["MG",1,1],["Visor",1,1]] },
    { id: 1104, name: "FIREFLY",    variant: "v2 · Saboteur",     faction: "COBRA", owned: 1, acc: [["Rifle",1,1],["Backpack",1,1]] },
    { id: 1105, name: "DESTRO",     variant: "v3 · Battle Corps", faction: "COBRA", owned: 1, acc: [["Pistol",1,1],["Cape",1,1]] },
    { id: 1106, name: "HEADMAN",    variant: "Drug Kingpin",      faction: "COBRA", owned: 0, acc: [["Pistol",1,0]] },
  ]},
];

// ----- completeness math --------------------------------------------------
// figParts = the BEST/optimal copy (Σ min(owned, req)). Its pct===100 means the
// figure is COMPLETABLE (parts owned could make a copy whole). Per-instance
// "complete-now" lives in figState below. See OPEN_QUESTIONS.md #5.
function figParts(fig) {
  let req = 0, own = 0;
  fig.acc.forEach(([n, r, o]) => { req += r; own += Math.min(o, r); });
  return { req, own, pct: req ? Math.round((own / req) * 100) : 100 };
}

// ---- per-instance allocation + rebalance engine --------------------------
// The sample data only stores aggregate owned counts, so we derive a plausible
// per-copy allocation: a scattered "as-stored" arrangement (what the shelf looks
// like) and a greedy "optimal" one (fill copies one at a time → max whole copies).
function _copyWhole(row, acc) { return acc.every(([n, r], k) => row[k] >= r); }
function _emptyGrid(n, k) { return Array.from({ length: n }, () => new Array(k).fill(0)); }

// scattered: spread units round-robin across copies (≤ req per copy). Tends to
// leave no single copy whole even when concentrating could → drives the recommender.
function _scatter(fig) {
  const N = fig.owned, acc = fig.acc, grid = _emptyGrid(N, acc.length);
  acc.forEach(([n, req, pool], k) => {
    const off = (fig.id + k * 3) % N;
    let placed = 0, step = 0, guard = 0;
    while (placed < pool && guard < pool + N * (req + 1)) {
      const c = (off + step) % N;
      if (grid[c][k] < req) { grid[c][k]++; placed++; }
      step++; guard++;
    }
  });
  return grid;
}
// optimal: fill copy #1 fully, then #2 … → maximizes whole copies.
function _optimal(fig) {
  const N = fig.owned, acc = fig.acc, grid = _emptyGrid(N, acc.length);
  acc.forEach(([n, req, pool], k) => {
    let rem = pool;
    for (let c = 0; c < N && rem > 0; c++) { const take = Math.min(req, rem); grid[c][k] = take; rem -= take; }
  });
  return grid;
}
// move list: turn the (completeness-sorted) copies into `target` whole copies;
// pull each missing part from the least-complete donor that won't be whole anyway.
// `rows` are already sorted most-complete-first, so from/to ARE display numbers.
function _planMoves(rows, acc, target) {
  const N = rows.length, have = rows.map(r => r.slice()), moves = [];
  for (let t = 0; t < target; t++) {
    acc.forEach(([name, req], k) => {
      while (have[t][k] < req) {
        let d = -1;
        for (let c = N - 1; c >= 0; c--) {
          if (c === t || have[c][k] === 0) continue;
          if (c < target && have[c][k] <= req) continue; // don't rob a copy we're completing
          d = c; break;
        }
        if (d === -1) break; // remainder would come from the Parts Bin
        have[d][k]--; have[t][k]++;
        moves.push({ part: name, from: d + 1, to: t + 1, qty: req });
      }
    });
  }
  return moves;
}

const _stateCache = {};
function figState(fig) {
  // cache key includes the owned-count signature so an OPTIMISTIC edit (same id,
  // changed acc-owned counts) recomputes instead of returning the stale allocation.
  const _k = fig.id + '|' + fig.owned + '|' + fig.acc.map(a => a[2]).join(',');
  if (_stateCache[_k]) return _stateCache[_k];
  const acc = fig.acc;
  const reqPer = acc.reduce((s, a) => s + a[1], 0);
  if (fig.owned === 0) {
    const r = { owned: 0, reqPer, instances: [], completeNow: false, completable: false, currentWhole: 0, optimalWhole: 0, moves: [], surplus: [] };
    return (_stateCache[_k] = r);
  }
  // build per-copy info from the scattered "as-stored" arrangement
  let copies = _scatter(fig).map((row) => {
    const own = row.reduce((s, c, k) => s + Math.min(c, acc[k][1]), 0);
    const pct = reqPer ? Math.round((own / reqPer) * 100) : 100;
    const missing = acc.map((a, k) => row[k] < a[1] ? (a[1] > 1 ? a[0] + " " + row[k] + "/" + a[1] : a[0]) : null).filter(Boolean);
    return { own, pct, missing, have: row.slice(), whole: _copyWhole(row, acc) };
  });
  // No. 1 is always the most complete copy, No. 2 next, … (re-numbered contiguously)
  copies.sort((a, b) => (b.whole - a.whole) || (b.own - a.own));
  copies.forEach((c, i) => { c.no = i + 1; c.req = reqPer; });

  const currentWhole = copies.filter(c => c.whole).length;
  const optimalWhole = _optimal(fig).filter(r => _copyWhole(r, acc)).length;
  const completable = optimalWhole > 0;
  const completeNow = currentWhole > 0;
  // recommend a rebalance whenever rearranging would yield MORE whole copies
  const moves = optimalWhole > currentWhole ? _planMoves(copies.map(c => c.have), acc, optimalWhole) : [];
  const surplus = acc.map(([name, req, pool]) => ({ name, extra: Math.max(0, pool - req * fig.owned) })).filter(s => s.extra > 0);
  const r = { owned: fig.owned, reqPer, instances: copies, completeNow, completable, currentWhole, optimalWhole, moves, surplus };
  return (_stateCache[_k] = r);
}
function figComplete(fig) { return figState(fig).completeNow; }

function yearParts(y) {
  let req = 0, own = 0, figs = 0, owned = 0, completeNow = 0;
  y.figures.forEach(f => {
    const p = figParts(f); req += p.req; own += p.own; figs++;
    if (f.owned > 0) { owned++; if (figComplete(f)) completeNow++; }
  });
  return {
    req, own, figs, owned, completeNow,
    complete: completeNow,                                   // back-compat alias
    coverage: figs ? Math.round((owned / figs) * 100) : 0,   // owned ÷ roster
    completion: owned ? Math.round((completeNow / owned) * 100) : 0, // whole ÷ owned
    pct: owned ? Math.round((completeNow / owned) * 100) : 0,
  };
}
function totals(data = DATA) {
  let req = 0, own = 0, figs = 0, instances = 0, complete = 0, incomplete = 0, inInventory = 0, notAcquired = 0, rebalanceable = 0;
  data.forEach(y => y.figures.forEach(f => {
    const p = figParts(f); req += p.req; own += p.own; figs++; instances += f.owned;
    if (f.owned === 0) { notAcquired++; return; }
    inInventory++;
    const st = figState(f);
    if (st.completeNow) complete++; else { incomplete++; if (st.completable) rebalanceable++; }
  }));
  return { req, own, figs, instances, complete, incomplete, inInventory, notAcquired, rebalanceable, missing: req - own, pct: req ? Math.round((own / req) * 100) : 100 };
}
function allFiguresFlat() {
  const out = [];
  DATA.forEach(y => y.figures.forEach(f => out.push({ ...f, year: y.year, ...figParts(f) })));
  return out;
}

// ----- shared low-fi widgets ---------------------------------------------
// hatched "drop a photo here" placeholder
function PhotoSlot({ label = "FIG. PHOTO", className = "", style = {} }) {
  return (
    <div className={"wf-photo " + className} style={style}>
      <span className="wf-photo__tag">{label}</span>
    </div>
  );
}

// faction tag
const FAC_NAMES = { JOE: "G.I. Joe", COBRA: "Cobra", OKTOBER: "Oktober Guard", DREADNOK: "Dreadnoks" };
function FactionTag({ faction, mini }) {
  return (
    <span className={"wf-fac wf-fac--" + faction.toLowerCase() + (mini ? " wf-fac--mini" : "")}>
      {FAC_NAMES[faction] || faction}
    </span>
  );
}

// completeness chip "4/6 · 67%"
function CompChip({ own, req, pct, big }) {
  const done = pct === 100;
  return (
    <span className={"wf-chip" + (done ? " is-done" : "") + (big ? " wf-chip--big" : "")}>
      <span className="wf-chip__frac">{own}/{req}</span>
      <span className="wf-chip__pct">{done ? "✓ COMPLETE" : pct + "%"}</span>
    </span>
  );
}

// completeness bar (striped fill)
function CompBar({ pct, height = 12 }) {
  const done = pct === 100;
  return (
    <div className="wf-bar" style={{ height }}>
      <div className={"wf-bar__fill" + (done ? " is-done" : "")} style={{ width: pct + "%" }}></div>
    </div>
  );
}

// completeness ring (conic)
function CompRing({ pct, size = 58, neutral = false }) {
  const done = pct === 100;
  const col = done ? "var(--ok)" : (neutral ? "var(--ink-soft)" : "var(--accent)");
  return (
    <div className="wf-ring" style={{
      width: size, height: size,
      background: `conic-gradient(${col} ${pct * 3.6}deg, var(--ring-track) 0)`
    }}>
      <div className="wf-ring__hole">
        <span className="wf-ring__pct">{pct}<small>%</small></span>
      </div>
    </div>
  );
}

// little accessory tick row used in drill-downs
function AccRow({ a }) {
  const [name, req, own] = a;
  const done = own >= req;
  return (
    <div className={"wf-acc" + (done ? " is-done" : "")}>
      <span className="wf-acc__box">{done ? "✓" : ""}</span>
      <span className="wf-acc__name">{name}</span>
      <span className="wf-acc__qty">{own}/{req}</span>
    </div>
  );
}

Object.assign(window, {
  DATA, figParts, figState, figComplete, yearParts, totals, allFiguresFlat,
  PhotoSlot, FactionTag, CompChip, CompBar, CompRing, AccRow,
});
