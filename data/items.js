const ITEM_CDN = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items";

export const ITEMS = [
  {
    id: "blink",
    zh: "跳刀",
    en: "Blink Dagger",
    defaultCode: "Digit1",
    label: "1",
    cooldown: 15,
    manaCost: 0,
    icon: `${ITEM_CDN}/blink.png`
  },
  {
    id: "cyclone",
    zh: "风杖",
    en: "Eul's Scepter of Divinity",
    defaultCode: "Digit2",
    label: "2",
    cooldown: 23,
    manaCost: 175,
    icon: `${ITEM_CDN}/cyclone.png`
  },
  {
    id: "sheepstick",
    zh: "羊刀",
    en: "Scythe of Vyse",
    defaultCode: "Digit3",
    label: "3",
    cooldown: 20,
    manaCost: 250,
    icon: `${ITEM_CDN}/sheepstick.png`
  },
  {
    id: "gleipnir",
    zh: "缚灵索",
    en: "Gleipnir",
    defaultCode: "Digit4",
    label: "4",
    cooldown: 18,
    manaCost: 150,
    icon: `${ITEM_CDN}/gungir.png`
  },
  {
    id: "dagon",
    zh: "大根",
    en: "Dagon",
    defaultCode: "Digit5",
    label: "5",
    cooldown: 27,
    manaCost: 120,
    icon: `${ITEM_CDN}/dagon.png`
  },
  {
    id: "rod_of_atos",
    zh: "阿托斯",
    en: "Rod of Atos",
    defaultCode: "Digit6",
    label: "6",
    cooldown: 18,
    manaCost: 100,
    icon: `${ITEM_CDN}/rod_of_atos.png`
  },
  {
    id: "refresher",
    zh: "刷新球",
    en: "Refresher Orb",
    defaultCode: "Digit7",
    label: "7",
    cooldown: 180,
    manaCost: 325,
    icon: `${ITEM_CDN}/refresher.png`,
    refreshesCooldowns: true
  }
];
