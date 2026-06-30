// add-figure-catalog.js — catalog search source for the Add Figure modal.
// GENERATED from gijoe_db_figures_2.0.csv (canonical, 654 rows) — sample span 1982–1986,
// grouped to version level (code_name + version). Each entry mirrors the route.js shape:
//   { id, name, alt?, ver, year, faction(JOE|COBRA), role, blueprint:[[acc, qtyReq]],
//     variants:[{letter, ver, tell, owned}]  |  variant + owned (single-variant figures) }
// alt = alt_name from the CSV — searched under the hood so "Snake-Eyes" matches "Snake Eyes"
// and "Rock & Roll" matches "Rock 'N Roll".
const AF_CATALOG = [
  { id:1001, name:"Breaker", ver:"1", year:1982, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1]], variants:[{letter:"A",ver:"1",tell:"Straight-Arm, Thin Thumbs, Flat Paint Finish",owned:1},{letter:"B",ver:"1",tell:"Straight-Arm, Thick Thumbs, Glossy Paint Finish",owned:0},{letter:"C",ver:"1",tell:"Straight-Arm, Thick Thumbs, Reverse Rivits",owned:0}] },
  { id:1002, name:"Clutch", ver:"1", year:1982, faction:"JOE", role:"Transportation", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variants:[{letter:"A",ver:"1",tell:"Straight-Arm, Thin Thumbs, Flat Paint Finish",owned:0},{letter:"B",ver:"1",tell:"Straight-Arm, Thick Thumbs, Glossy Paint Finish",owned:0},{letter:"C",ver:"1",tell:"Straight-Arm, Thick Thumbs, Reverse Rivits",owned:0}] },
  { id:1003, name:"Cobra", alt:"Cobra Soldier or Cobra Trooper", ver:"1", year:1982, faction:"COBRA", role:"Infantry", blueprint:[["Backpack",1],["AK Rifle",1]], variants:[{letter:"A",ver:"1",tell:"Straight-Arm, Thin Thumbs, Flat Paint Finish",owned:0},{letter:"B",ver:"1",tell:"Straight-Arm, Thick Thumbs, Glossy Paint Finish",owned:0}] },
  { id:1004, name:"Cobra Commander", ver:"1", year:1982, faction:"COBRA", role:"Intelligence", blueprint:[["Backpack",1],["AK Rifle",1],["Pistol",1]], variants:[{letter:"A",ver:"1",tell:"Straight-Arm,Mickey Mouse Cobra Logo",owned:1},{letter:"B",ver:"1",tell:"Straight-Arm",owned:0}] },
  { id:1005, name:"Cobra Officer", ver:"1", year:1982, faction:"COBRA", role:"Infantry", blueprint:[["Backpack",1],["AK Rifle",1]], variants:[{letter:"A",ver:"1",tell:"Straight-Arm, Thin Thumbs, Flat Paint Finish",owned:0},{letter:"B",ver:"1",tell:"Straight-Arm, Thick Thumbs, Glossy Paint Finish",owned:0}] },
  { id:1006, name:"Flash", ver:"1", year:1982, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variants:[{letter:"A",ver:"1",tell:"Straight-Arm, Thin Thumbs, Flat Paint Finish",owned:0},{letter:"B",ver:"1",tell:"Straight-Arm, Thick Thumbs, Glossy Paint Finish",owned:0},{letter:"C",ver:"1",tell:"Straight-Arm, Thick Thumbs, Reverse Rivits",owned:0}] },
  { id:1007, name:"Grand Slam", ver:"1", year:1982, faction:"JOE", role:"Artillery", blueprint:[["Backpack",1],["Rifle",1]], variants:[{letter:"A",ver:"1",tell:"Straight-Arm, Thin Thumbs, Flat Paint Finish",owned:0},{letter:"B",ver:"1",tell:"Straight-Arm, Thick Thumbs, Glossy Paint Finish",owned:0},{letter:"C",ver:"1",tell:"Straight-Arm, Thick Thumbs, Reverse Rivits",owned:0}] },
  { id:1008, name:"Grunt", ver:"1", year:1982, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variants:[{letter:"A",ver:"1",tell:"Straight-Arm, Thin Thumbs, Flat Paint Finish",owned:0},{letter:"B",ver:"1",tell:"Straight-Arm, Thick Thumbs, Glossy Paint Finish",owned:0},{letter:"C",ver:"1",tell:"Straight-Arm, Thick Thumbs, Reverse Rivits",owned:0}] },
  { id:1009, name:"Hawk", ver:"1", year:1982, faction:"JOE", role:"Artillery", blueprint:[["Backpack",1],["Rifle",1]], variants:[{letter:"A",ver:"1",tell:"Straight-Arm, Thin Thumbs, Flat Paint Finish",owned:0},{letter:"B",ver:"1",tell:"Straight-Arm, Thick Thumbs, Glossy Paint Finish",owned:0},{letter:"C",ver:"1",tell:"Straight-Arm, Thick Thumbs, Reverse Rivits",owned:0}] },
  { id:1010, name:"Rock 'N Roll", alt:"Rock & Roll", ver:"1", year:1982, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variants:[{letter:"A",ver:"1",tell:"Straight-Arm, Thin Thumbs, Flat Paint Finish",owned:1},{letter:"B",ver:"1",tell:"Straight-Arm, Thick Thumbs, Glossy Paint Finish",owned:0},{letter:"C",ver:"1",tell:"Straight-Arm, Thick Thumbs, Reverse Rivits",owned:0}] },
  { id:1011, name:"Scarlett", ver:"1", year:1982, faction:"JOE", role:"Intelligence", blueprint:[["Backpack",1],["Rifle",1]], variants:[{letter:"A",ver:"1",tell:"Straight-Arm, Thin Thumbs, Flat Paint Finish",owned:0},{letter:"B",ver:"1",tell:"Straight-Arm, Thick Thumbs, Glossy Paint Finish",owned:0}] },
  { id:1012, name:"Short-Fuze", alt:"Short-Fuse or Shortfuse", ver:"1", year:1982, faction:"JOE", role:"Artillery", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variants:[{letter:"A",ver:"1",tell:"Straight-Arm, Thin Thumbs, Flat Paint Finish",owned:0},{letter:"B",ver:"1",tell:"Straight-Arm, Thick Thumbs, Glossy Paint Finish",owned:0},{letter:"C",ver:"1",tell:"Straight-Arm, Thick Thumbs, Reverse Rivits",owned:0}] },
  { id:1013, name:"Snake Eyes", alt:"Snake-Eyes", ver:"1", year:1982, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1]], variants:[{letter:"A",ver:"1",tell:"Straight-Arm, Thin Thumbs, Flat Paint Finish",owned:2},{letter:"B",ver:"1",tell:"Straight-Arm, Thick Thumbs, Glossy Paint Finish",owned:0},{letter:"C",ver:"1",tell:"Straight-Arm, Thick Thumbs, Reverse Rivits",owned:0}] },
  { id:1014, name:"Stalker", ver:"1", year:1982, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variants:[{letter:"A",ver:"1",tell:"Straight-Arm, Thin Thumbs, Flat Paint Finish",owned:0},{letter:"B",ver:"1",tell:"Straight-Arm, Thick Thumbs, Glossy Paint Finish",owned:0},{letter:"C",ver:"1",tell:"Straight-Arm, Thick Thumbs, Reverse Rivits",owned:0}] },
  { id:1015, name:"Steeler", ver:"1", year:1982, faction:"JOE", role:"Armor", blueprint:[["Backpack",1],["Rifle",1]], variants:[{letter:"A",ver:"1",tell:"Straight-Arm, Thin Thumbs, Flat Paint Finish",owned:0},{letter:"B",ver:"1",tell:"Straight-Arm, Thick Thumbs, Glossy Paint Finish",owned:0}] },
  { id:1016, name:"Zap", ver:"1", year:1982, faction:"JOE", role:"Engineer", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variants:[{letter:"A",ver:"1",tell:"Straight-Arm, Thin Thumbs, Flat Paint Finish",owned:0},{letter:"B",ver:"1",tell:"Straight-Arm, Thick Thumbs, Glossy Paint Finish",owned:0},{letter:"C",ver:"1",tell:"Straight-Arm, Thick Thumbs, Reverse Rivits",owned:0}] },
  { id:1017, name:"Ace", ver:"1", year:1983, faction:"JOE", role:"Fixed Wing Pilot, Single and Multiple Engine", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1018, name:"Airborne", ver:"1", year:1983, faction:"JOE", role:"Airborne Infantryman", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variants:[{letter:"A",ver:"1",tell:"Thin chevron stripes",owned:0},{letter:"B",ver:"1",tell:"Thick chevron stripes",owned:0}] },
  { id:1019, name:"Breaker", ver:"1.5", year:1983, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:1 },
  { id:1020, name:"Clutch", ver:"1.5", year:1983, faction:"JOE", role:"Transportation", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1021, name:"Cobra", alt:"Cobra Soldier or Cobra Trooper", ver:"1.5", year:1983, faction:"COBRA", role:"Infantry", blueprint:[["Backpack",1],["AK Rifle",1]], variant:"Enemy", owned:0 },
  { id:1022, name:"Cobra Commander", ver:"1.5", year:1983, faction:"COBRA", role:"Intelligence", blueprint:[["Backpack",1],["AK Rifle",1],["Pistol",1]], variant:"Enemy", owned:1 },
  { id:1023, name:"Cobra Officer", ver:"1.5", year:1983, faction:"COBRA", role:"Infantry", blueprint:[["Backpack",1],["AK Rifle",1]], variant:"Enemy", owned:0 },
  { id:1024, name:"Cover Girl", ver:"1", year:1983, faction:"JOE", role:"Armor", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variants:[{letter:"A",ver:"1",tell:"Dark eyebrows, lighter shirt, darker boots & belt",owned:0},{letter:"B",ver:"1",tell:"Eyebrows match hair, darker shirt, lighter boots & belt",owned:0}] },
  { id:1025, name:"Destro", ver:"1", year:1983, faction:"COBRA", role:"Weapons Manufacturer", blueprint:[["Backpack",1],["AK Rifle",1]], variants:[{letter:"A",ver:"1",tell:"Hasbro 1983 leg stamp",owned:0},{letter:"B",ver:"1",tell:"No leg stamp",owned:0}] },
  { id:1026, name:"Doc", ver:"1", year:1983, faction:"JOE", role:"Medicial Doctor", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1027, name:"Duke", ver:"1", year:1983, faction:"JOE", role:"Airborne Infantryman", blueprint:[["Backpack",1],["Rifle",1]], variants:[{letter:"A",ver:"1",tell:"Rolled jacket sleeves, smooth hair, Doc v1 waist, American flag sticker on right arm",owned:1},{letter:"B",ver:"1",tell:"Rolled jacket sleeves, smooth hair, Doc v1 waist, no sticker",owned:0},{letter:"C",ver:"1",tell:"Rolled jacket sleeves, more detailed hair, Doc v1 waist, no sticker",owned:0},{letter:"D",ver:"1",tell:"Grunt v1.5 arms with cuffed sleeves that end at wrists, detailed hair, Doc v1 waist, no sticker",owned:0},{letter:"E",ver:"1",tell:"Grunt v1.5 arms with cuffed sleeves that end at wrists, detailed hair, Cobra v1 waist, no sticker",owned:0}] },
  { id:1028, name:"Flash", ver:"1.5", year:1983, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1029, name:"Grand Slam", ver:"1.5", year:1983, faction:"JOE", role:"Artillery", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1030, name:"Grand Slam", alt:"Silver Pads Grand Slam", ver:"2", year:1983, faction:"JOE", role:"Artillery", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1031, name:"Grunt", ver:"1.5", year:1983, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1032, name:"Grunt", alt:"Tan Grunt", ver:"2", year:1983, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1033, name:"Gung-Ho", ver:"1", year:1983, faction:"JOE", role:"Recando", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1034, name:"H.I.S.S. Driver", alt:"Cobra H.I.S.S. Driver", ver:"1", year:1983, faction:"COBRA", role:"H.I.S.S. Driver", blueprint:[["Backpack",1],["AK Rifle",1],["Pistol",1]], variant:"Enemy", owned:0 },
  { id:1035, name:"Hawk", ver:"1.5", year:1983, faction:"JOE", role:"Artillery", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1036, name:"Major Bludd", ver:"1", year:1983, faction:"COBRA", role:"Terrorist", blueprint:[["Backpack",1],["AK Rifle",1],["Pistol",1]], variant:"Enemy", owned:0 },
  { id:1037, name:"Rock 'N Roll", ver:"1.5", year:1983, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:1 },
  { id:1038, name:"Scarlett", ver:"1.5", year:1983, faction:"JOE", role:"Intelligence", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1039, name:"Short-Fuze", alt:"Short-Fuse or Shortfuse", ver:"1.5", year:1983, faction:"JOE", role:"Artillery", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1040, name:"Snake Eyes", alt:"Snake-Eyes", ver:"1.5", year:1983, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:2 },
  { id:1041, name:"Snow Job", ver:"1", year:1983, faction:"JOE", role:"Arctic Ski Patrol", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1042, name:"Stalker", ver:"1.5", year:1983, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variants:[{letter:"A",ver:"1.5",tell:"Swivel-Arm, darker glossy green camo uniform",owned:0},{letter:"B",ver:"1.5",tell:"Swivel-Arm, lighter flat green camo uniform",owned:0}] },
  { id:1043, name:"Steeler", ver:"1.5", year:1983, faction:"JOE", role:"Armor", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1044, name:"Torpedo", ver:"1", year:1983, faction:"JOE", role:"Navy SEAL", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1045, name:"Tripwire", ver:"1", year:1983, faction:"JOE", role:"Explosive Ordnance Disposal", blueprint:[["Backpack",1],["Rifle",1]], variants:[{letter:"A",ver:"1",tell:"Thin chevron stripes",owned:0},{letter:"B",ver:"1",tell:"Thick chevron stripes",owned:0}] },
  { id:1046, name:"Viper Pilot", alt:"Cobra Viper Pilot", ver:"1", year:1983, faction:"COBRA", role:"Infantry", blueprint:[["Backpack",1],["AK Rifle",1],["Pistol",1]], variant:"Enemy", owned:0 },
  { id:1047, name:"Wild Bill", ver:"1", year:1983, faction:"JOE", role:"Helicopter Pilot", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1048, name:"Zap", ver:"1.5", year:1983, faction:"JOE", role:"Engineer", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1049, name:"Baroness", ver:"1", year:1984, faction:"COBRA", role:"Intelligence", blueprint:[["Backpack",1],["AK Rifle",1]], variant:"Enemy", owned:0 },
  { id:1050, name:"Blowtorch", ver:"1", year:1984, faction:"JOE", role:"Infantry Special Weapons", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variants:[{letter:"A",ver:"1",tell:"Dark eyes and eyebrows, short neck",owned:0},{letter:"B",ver:"1",tell:"Eyes and eybrows match hair color, short neck",owned:0},{letter:"C",ver:"1",tell:"Eyes and eybrows match hair color, long neck",owned:0}] },
  { id:1051, name:"Clutch", alt:"Tan Clutch", ver:"2", year:1984, faction:"JOE", role:"Transportation", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1052, name:"Cobra Commander", alt:"Hooded Cobra Commander", ver:"2", year:1984, faction:"COBRA", role:"Intelligence", blueprint:[["Backpack",1],["AK Rifle",1],["Pistol",1]], variant:"Enemy", owned:1 },
  { id:1053, name:"Copperhead", ver:"1", year:1984, faction:"COBRA", role:"Air-Driver Swamp Vehicle Operator", blueprint:[["Backpack",1],["AK Rifle",1]], variants:[{letter:"A",ver:"1",tell:"Light green gloves & helmet trim",owned:0},{letter:"B",ver:"1",tell:"Blue/green gloves & helmet trim",owned:0},{letter:"C",ver:"1",tell:"Dark green gloves & helmet trim",owned:0}] },
  { id:1054, name:"Cutter", ver:"1", year:1984, faction:"JOE", role:"Hovercraft Captain", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1055, name:"Deep Six", ver:"1", year:1984, faction:"JOE", role:"Driver", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1056, name:"Firefly", ver:"1", year:1984, faction:"COBRA", role:"Sabotage, Demolitions, and Terror", blueprint:[["Backpack",1],["AK Rifle",1],["Pistol",1]], variants:[{letter:"A",ver:"1",tell:"Black eyes",owned:0},{letter:"B",ver:"1",tell:"Brown eyes",owned:0}] },
  { id:1057, name:"Mutt", ver:"1", year:1984, faction:"JOE", role:"Dog Handler", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1058, name:"Recondo", ver:"1", year:1984, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variants:[{letter:"A",ver:"1",tell:"Tan uniform, green camo stripes on legs",owned:0},{letter:"B",ver:"1",tell:"Tan uniform, dark olive camo stripes on legs",owned:0}] },
  { id:1059, name:"Rip Cord", alt:"Ripcord", ver:"1", year:1984, faction:"JOE", role:"Airborne Infantry", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1060, name:"Roadblock", ver:"1", year:1984, faction:"JOE", role:"Infantry Heavy Weapons", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1061, name:"Scrap-Iron", ver:"1", year:1984, faction:"COBRA", role:"Tank Destroyer", blueprint:[["Backpack",1],["AK Rifle",1]], variant:"Enemy", owned:0 },
  { id:1062, name:"Spirit", ver:"1", year:1984, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variants:[{letter:"A",ver:"1",tell:"Light blue shirt, tan pants, large emblem on right arm",owned:0},{letter:"B",ver:"1",tell:"Light blue shirt, tan pants, small emblem on right arm",owned:0}] },
  { id:1063, name:"Stinger Driver", alt:"Cobra Stinger Driver", ver:"1", year:1984, faction:"COBRA", role:"Stinger Driver, Infantry", blueprint:[["Backpack",1],["AK Rifle",1]], variant:"Enemy", owned:0 },
  { id:1064, name:"Storm Shadow", ver:"1", year:1984, faction:"COBRA", role:"Assassin", blueprint:[["Backpack",1],["AK Rifle",1],["Pistol",1]], variant:"Enemy", owned:0 },
  { id:1065, name:"Thunder", ver:"1", year:1984, faction:"JOE", role:"Artillery", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1066, name:"Tollbooth", ver:"1", year:1984, faction:"JOE", role:"Combat Engineer", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1067, name:"Wild Weasel", ver:"1", year:1984, faction:"COBRA", role:"Ground Support Pilot", blueprint:[["Backpack",1],["AK Rifle",1]], variants:[{letter:"A",ver:"1",tell:"Map on right leg has grid pattern on right side",owned:0},{letter:"B",ver:"1",tell:"Map on right leg has grid pattern on left side",owned:0}] },
  { id:1068, name:"Zartan", ver:"1", year:1984, faction:"JOE", role:"—", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1069, name:"Airtight", ver:"1", year:1985, faction:"JOE", role:"Chemical, Biological and Radiological Warfare", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1070, name:"Alpine", ver:"1", year:1985, faction:"JOE", role:"Mountain Trooper", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1071, name:"Barbecue", ver:"1", year:1985, faction:"JOE", role:"Fireman", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1072, name:"Bazooka", ver:"1", year:1985, faction:"JOE", role:"Armor Defeating Weapons Systems", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variants:[{letter:"A",ver:"1",tell:"Red football jersey, blue 14 with white outline",owned:0},{letter:"B",ver:"1",tell:"Red football jersey, solid white 14",owned:0}] },
  { id:1073, name:"Buzzer", ver:"1", year:1985, faction:"JOE", role:"—", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1074, name:"Crankcase", ver:"1", year:1985, faction:"JOE", role:"Motor Vehicle Driver", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1075, name:"Crimson Guard", ver:"1", year:1985, faction:"COBRA", role:"Undercover Espionage", blueprint:[["Backpack",1],["AK Rifle",1]], variants:[{letter:"A",ver:"1",tell:"Lighter red uniform",owned:0},{letter:"B",ver:"1",tell:"Darker red uniform",owned:0}] },
  { id:1076, name:"Dusty", ver:"1", year:1985, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1077, name:"Eels", alt:"Eel", ver:"1", year:1985, faction:"COBRA", role:"Underwater Demolitions", blueprint:[["Backpack",1],["AK Rifle",1]], variants:[{letter:"A",ver:"1",tell:"Lighter red chest",owned:0},{letter:"B",ver:"1",tell:"Darker red chest, no country stamp",owned:0}] },
  { id:1078, name:"Flint", ver:"1", year:1985, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1079, name:"Footloose", ver:"1", year:1985, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1080, name:"Frostbite", ver:"1", year:1985, faction:"JOE", role:"Motor Vehicle Driver", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variants:[{letter:"A",ver:"1",tell:"Darker gray fur, dark blue emblem",owned:0},{letter:"B",ver:"1",tell:"Lighter gray fur, pale blue emblem",owned:0}] },
  { id:1081, name:"Heavy Metal", alt:"Rampage", ver:"1", year:1985, faction:"JOE", role:"Armor", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1082, name:"Keel-Haul", alt:"Admiral Keel-Haul", ver:"1", year:1985, faction:"JOE", role:"Command", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variants:[{letter:"A",ver:"1",tell:"Brown jacket, tan pants, patch on right arm, painted stars on collar",owned:0}] },
  { id:1083, name:"Lady Jaye", ver:"1", year:1985, faction:"JOE", role:"Intelligence", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1084, name:"Lampreys", alt:"Lamprey", ver:"1", year:1985, faction:"COBRA", role:"Hydrofoil Pilot", blueprint:[["Backpack",1],["AK Rifle",1],["Pistol",1]], variant:"Enemy", owned:0 },
  { id:1085, name:"Quick Kick", ver:"1", year:1985, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1]], variants:[{letter:"A",ver:"1",tell:"—",owned:0}] },
  { id:1086, name:"Ripper", ver:"1", year:1985, faction:"JOE", role:"—", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1087, name:"Shipwreck", ver:"1", year:1985, faction:"JOE", role:"Gunners Mate", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1088, name:"Snake Eyes", alt:"Snake-Eyes", ver:"2", year:1985, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:1 },
  { id:1089, name:"Snow Serpent", alt:"Cobra Snow Viper", ver:"1", year:1985, faction:"COBRA", role:"Arctic Operations", blueprint:[["Backpack",1],["AK Rifle",1]], variant:"Enemy", owned:0 },
  { id:1090, name:"Starduster", alt:"Starduster [Version 1A]", ver:"1", year:1985, faction:"JOE", role:"Infantry Transportable Air Recon", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variants:[{letter:"A",ver:"1",tell:"Recondo v1 torso, Recondo v1 waist, pale blue uniform",owned:0}] },
  { id:1091, name:"Tele-Vipers", alt:"Tele-Viper", ver:"1", year:1985, faction:"COBRA", role:"Communications", blueprint:[["Backpack",1],["AK Rifle",1]], variant:"Enemy", owned:0 },
  { id:1092, name:"Tomax", ver:"1", year:1985, faction:"COBRA", role:"Infiltration, Espionage, Sabotage, Propaganda and Corporate Law.", blueprint:[["Backpack",1],["AK Rifle",1],["Pistol",1]], variant:"Enemy", owned:0 },
  { id:1093, name:"Torch", ver:"1", year:1985, faction:"JOE", role:"—", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1094, name:"Tripwire", alt:"Listen 'n Fun Tripwire", ver:"2", year:1985, faction:"JOE", role:"Explosive Ordnance Disposal", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1095, name:"Xamot", ver:"1", year:1985, faction:"COBRA", role:"Infiltration, Espionage, Sabotage, Propaganda and Corporate Law.", blueprint:[["Backpack",1],["AK Rifle",1]], variants:[{letter:"A",ver:"1",tell:"Red sash over left shoulder, large Cobra emblem on right side, short pink scar on left side of face.",owned:0},{letter:"B",ver:"1",tell:"Red sash over left shoulder, large Cobra emblem on right side, long red scar on left side of face.",owned:0}] },
  { id:1096, name:"A.V.A.C.", ver:"1", year:1986, faction:"COBRA", role:"—", blueprint:[["Backpack",1],["AK Rifle",1],["Pistol",1]], variant:"Enemy", owned:0, coo:["China","Hong Kong"] },
  { id:1097, name:"B.A.T.S.", alt:"B.A.T.", ver:"1", year:1986, faction:"COBRA", role:"—", blueprint:[["Backpack",1],["AK Rifle",1]], variants:[{letter:"A",ver:"1",tell:"Orange paint trim",owned:0},{letter:"B",ver:"1",tell:"Yellow paint trim",owned:0}] },
  { id:1098, name:"Beach Head", alt:"Beach-Head", ver:"1", year:1986, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1099, name:"Claymore", ver:"1", year:1986, faction:"JOE", role:"Anti-Terrorist Specialist", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1100, name:"Cross-Country", ver:"1", year:1986, faction:"JOE", role:"Armor", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variants:[{letter:"A",ver:"1",tell:"Feet molded in gray plastic",owned:0},{letter:"B",ver:"1",tell:"Feet molded in white plastic",owned:0}] },
  { id:1101, name:"Dial-Tone", ver:"1", year:1986, faction:"JOE", role:"Radio Telecommunications", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1102, name:"Dial-Tone", ver:"2", year:1986, faction:"JOE", role:"Radio Telecommunications", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1103, name:"Dr. Mindbender", ver:"1", year:1986, faction:"COBRA", role:"—", blueprint:[["Backpack",1],["AK Rifle",1]], variant:"Enemy", owned:0 },
  { id:1104, name:"Hawk", ver:"2", year:1986, faction:"JOE", role:"Artillery", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1105, name:"Iceberg", ver:"1", year:1986, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1106, name:"Leatherneck", ver:"1", year:1986, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1107, name:"Leatherneck", ver:"2", year:1986, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1108, name:"Lifeline", ver:"1", year:1986, faction:"JOE", role:"Medic", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1109, name:"Lift-Ticket", ver:"1", year:1986, faction:"JOE", role:"Rotary Wing Aircraft Pilot", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1110, name:"Low-Light", ver:"1", year:1986, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1111, name:"Mainframe", ver:"1", year:1986, faction:"JOE", role:"Computer Technology", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1112, name:"Mainframe", ver:"2", year:1986, faction:"JOE", role:"Computer Technology", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1113, name:"Monkeywrench", ver:"1", year:1986, faction:"JOE", role:"—", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1114, name:"Motor Viper", alt:"Motor-Viper", ver:"1", year:1986, faction:"COBRA", role:"—", blueprint:[["Backpack",1],["AK Rifle",1],["Pistol",1]], variants:[{letter:"A",ver:"1",tell:"Light blue helmet, pale blue neck joint",owned:0},{letter:"B",ver:"1",tell:"Dark blue helmet, two-tone neck joint",owned:0}] },
  { id:1115, name:"Roadblock", ver:"2", year:1986, faction:"JOE", role:"Infantry Heavy Weapons", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1116, name:"Sci-Fi", ver:"1", year:1986, faction:"JOE", role:"Infantry", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1117, name:"Serpentor", ver:"1", year:1986, faction:"COBRA", role:"—", blueprint:[["Backpack",1],["AK Rifle",1]], variants:[{letter:"A",ver:"1",tell:"Flesh colored neck",owned:0},{letter:"B",ver:"1",tell:"Yellow colored neck",owned:0}] },
  { id:1118, name:"Sgt. Slaughter", ver:"1", year:1986, faction:"JOE", role:"Infantry/Drill Instructor", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variants:[{letter:"A",ver:"1",tell:"Thick red border around chevron on boots",owned:0},{letter:"B",ver:"1",tell:"Thin red border around chevron on boots",owned:0}] },
  { id:1119, name:"Sgt. Slaughter", ver:"2", year:1986, faction:"JOE", role:"Infantry/Drill Instructor", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1120, name:"Slip-Stream", ver:"1", year:1986, faction:"JOE", role:"Fighter Pilot", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variants:[{letter:"A",ver:"1",tell:"Teeth painted on face",owned:0},{letter:"B",ver:"1",tell:"No teeth painted on face.",owned:0}] },
  { id:1121, name:"Strato-Viper", ver:"1", year:1986, faction:"COBRA", role:"—", blueprint:[["Backpack",1],["AK Rifle",1]], variant:"Enemy", owned:0 },
  { id:1122, name:"Thrasher", ver:"1", year:1986, faction:"JOE", role:"—", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1123, name:"Vipers", alt:"Viper", ver:"1", year:1986, faction:"COBRA", role:"—", blueprint:[["Backpack",1],["AK Rifle",1]], variant:"Enemy", owned:0 },
  { id:1124, name:"Wet-Suit", ver:"1", year:1986, faction:"JOE", role:"SEAL", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1125, name:"Wet-Suit", ver:"2", year:1986, faction:"JOE", role:"SEAL", blueprint:[["Backpack",1],["Rifle",1]], variant:"Trooper", owned:0 },
  { id:1126, name:"Zandar", ver:"1", year:1986, faction:"JOE", role:"—", blueprint:[["Backpack",1],["Rifle",1],["Helmet",1]], variant:"Trooper", owned:0 },
  { id:1127, name:"Zarana", ver:"1", year:1986, faction:"JOE", role:"—", blueprint:[["Backpack",1],["Rifle",1]], variants:[{letter:"A",ver:"1",tell:"Earrings, darker red gloves & kneepads",owned:0},{letter:"B",ver:"1",tell:"No earrings, lighter red gloves & kneepads",owned:0},{letter:"C",ver:"1",tell:"No earrings",owned:0}] }
];

// fuzzy name key: lowercase, &->and, strip punctuation/whitespace so
// "Snake-Eyes" / "snake eyes" / "SnakeEyes" and "Rock & Roll" / "Rock and Roll" / "Rock 'N Roll" collapse.
function afNorm(s){
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bn\b/g, "and")        // "rock 'n roll" -> "rock and roll"
    .replace(/[^a-z0-9]+/g, "");      // drop spaces, hyphens, apostrophes, dots
}
// haystack of normalized search keys for one catalog entry
function afKeys(f){
  const ks = [afNorm(f.name)];
  if (f.alt) f.alt.split(/\s+or\s+/i).forEach(a => ks.push(afNorm(a)));
  return ks;
}
// search: returns chronological matches. Empty query -> [] (no preloaded list).
function afSearch(query, year){
  const q = afNorm(query);
  let list = AF_CATALOG.slice();
  if (year) list = list.filter(f => f.year === +year);
  if (q) list = list.filter(f => afKeys(f).some(k => k.includes(q)) ||
                                  afNorm(f.role).includes(q) ||
                                  String(f.year).includes(query.trim()) ||
                                  afNorm(f.faction).includes(q));
  return list.sort((a, b) => a.year - b.year || a.name.localeCompare(b.name));
}
const afYears = [...new Set(AF_CATALOG.map(f => f.year))].sort();
const afCatOwned = (f) => f.variants ? f.variants.reduce((s, v) => s + v.owned, 0) : (f.owned || 0);

Object.assign(window, { AF_CATALOG, afNorm, afKeys, afSearch, afYears, afCatOwned });
