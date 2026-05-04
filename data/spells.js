const ABILITY_CDN = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities";

export const ORB_ORDER = ["quas", "wex", "exort"];

export const ORBS = [
  {
    id: "quas",
    zh: "冰",
    en: "Quas",
    defaultCode: "KeyQ",
    label: "Q",
    color: "#7fd7ff",
    icon: `${ABILITY_CDN}/invoker_quas.png`
  },
  {
    id: "wex",
    zh: "雷",
    en: "Wex",
    defaultCode: "KeyW",
    label: "W",
    color: "#c58bff",
    icon: `${ABILITY_CDN}/invoker_wex.png`
  },
  {
    id: "exort",
    zh: "火",
    en: "Exort",
    defaultCode: "KeyE",
    label: "E",
    color: "#ffc857",
    icon: `${ABILITY_CDN}/invoker_exort.png`
  }
];

export const INVOKE = {
  id: "invoke",
  zh: "元素祈唤",
  en: "Invoke",
  defaultCode: "KeyR",
  label: "R",
  baseCooldown: 7,
  cooldownReductionPerOrbLevel: 0.3,
  icon: `${ABILITY_CDN}/invoker_invoke.png`
};

export const SPELLS = [
  {
    id: "cold_snap",
    zh: "急速冷却",
    en: "Cold Snap",
    combo: ["quas", "quas", "quas"],
    comboText: "QQQ",
    legacyCode: "KeyY",
    legacyLabel: "Y",
    cooldown: 18,
    manaCost: 100,
    icon: `${ABILITY_CDN}/invoker_cold_snap.png`
  },
  {
    id: "ghost_walk",
    zh: "幽灵漫步",
    en: "Ghost Walk",
    combo: ["quas", "quas", "wex"],
    comboText: "QQW",
    legacyCode: "KeyV",
    legacyLabel: "V",
    cooldown: 32,
    manaCost: 175,
    icon: `${ABILITY_CDN}/invoker_ghost_walk.png`
  },
  {
    id: "tornado",
    zh: "强袭飓风",
    en: "Tornado",
    combo: ["quas", "wex", "wex"],
    comboText: "QWW",
    legacyCode: "KeyX",
    legacyLabel: "X",
    cooldown: 27,
    manaCost: 140,
    icon: `${ABILITY_CDN}/invoker_tornado.png`
  },
  {
    id: "emp",
    zh: "电磁脉冲",
    en: "E.M.P.",
    combo: ["wex", "wex", "wex"],
    comboText: "WWW",
    legacyCode: "KeyC",
    legacyLabel: "C",
    cooldown: 27,
    manaCost: 125,
    icon: `${ABILITY_CDN}/invoker_emp.png`
  },
  {
    id: "alacrity",
    zh: "灵动迅捷",
    en: "Alacrity",
    combo: ["wex", "wex", "exort"],
    comboText: "WWE",
    legacyCode: "KeyZ",
    legacyLabel: "Z",
    cooldown: 15,
    manaCost: 75,
    icon: `${ABILITY_CDN}/invoker_alacrity.png`
  },
  {
    id: "chaos_meteor",
    zh: "混沌陨石",
    en: "Chaos Meteor",
    combo: ["wex", "exort", "exort"],
    comboText: "WEE",
    legacyCode: "KeyD",
    legacyLabel: "D",
    cooldown: 50,
    manaCost: 200,
    icon: `${ABILITY_CDN}/invoker_chaos_meteor.png`
  },
  {
    id: "sun_strike",
    zh: "阳炎冲击",
    en: "Sun Strike",
    combo: ["exort", "exort", "exort"],
    comboText: "EEE",
    legacyCode: "KeyT",
    legacyLabel: "T",
    cooldown: 23,
    manaCost: 175,
    icon: `${ABILITY_CDN}/invoker_sun_strike.png`
  },
  {
    id: "forge_spirit",
    zh: "熔炉精灵",
    en: "Forge Spirit",
    combo: ["quas", "exort", "exort"],
    comboText: "QEE",
    legacyCode: "KeyF",
    legacyLabel: "F",
    cooldown: 27,
    manaCost: 75,
    icon: `${ABILITY_CDN}/invoker_forge_spirit.png`
  },
  {
    id: "ice_wall",
    zh: "寒冰之墙",
    en: "Ice Wall",
    combo: ["quas", "quas", "exort"],
    comboText: "QQE",
    legacyCode: "KeyG",
    legacyLabel: "G",
    cooldown: 23,
    manaCost: 125,
    icon: `${ABILITY_CDN}/invoker_ice_wall.png`
  },
  {
    id: "deafening_blast",
    zh: "超震声波",
    en: "Deafening Blast",
    combo: ["quas", "wex", "exort"],
    comboText: "QWE",
    legacyCode: "KeyB",
    legacyLabel: "B",
    cooldown: 36,
    manaCost: 250,
    icon: `${ABILITY_CDN}/invoker_deafening_blast.png`
  }
];
