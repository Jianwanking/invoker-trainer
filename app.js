import { INVOKE, ORB_ORDER, ORBS, SPELLS } from "./data/spells.js";
import { ITEMS } from "./data/items.js";

const RAIL_CARD_WIDTH = 184;
const RAIL_CARD_GAP = 22;

const STORAGE_KEYS = {
  combos: "invoker-trainer-combos-v1",
  settings: "invoker-trainer-settings-v1"
};

const MODE_LABELS = {
  random: "随机技能",
  combo: "固定连招",
  real: "真实实战",
  free: "自由模式"
};

const DEFAULT_COMBOS = [
  { id: "combo-tornado-emp", name: "吹风接 EMP", steps: spellSteps(["tornado", "emp"]) },
  { id: "combo-meatball-blast", name: "经典陨石声波", steps: spellSteps(["tornado", "chaos_meteor", "deafening_blast"]) },
  { id: "combo-teamfight", name: "团战四连", steps: spellSteps(["tornado", "emp", "chaos_meteor", "deafening_blast"]) },
  { id: "combo-euls-burst", name: "风杖单杀", steps: [{ type: "item", id: "cyclone" }, ...spellSteps(["sun_strike", "chaos_meteor", "deafening_blast"]) ] },
  { id: "combo-summon-snap", name: "冰火压制", steps: spellSteps(["cold_snap", "forge_spirit", "alacrity"]) },
  { id: "combo-ghost-pickoff", name: "隐身留人", steps: spellSteps(["ghost_walk", "cold_snap", "ice_wall"]) },
  { id: "combo-atos-sun", name: "阿托斯阳炎", steps: [{ type: "item", id: "rod_of_atos" }, ...spellSteps(["sun_strike", "chaos_meteor"]) ] },
  { id: "combo-gleipnir-meteor", name: "缚灵索陨石", steps: [{ type: "item", id: "gleipnir" }, ...spellSteps(["chaos_meteor", "deafening_blast"]) ] },
  { id: "combo-hex-burst", name: "羊刀爆发", steps: [{ type: "item", id: "sheepstick" }, ...spellSteps(["chaos_meteor", "sun_strike", "deafening_blast"]) ] },
  { id: "combo-blink-wall", name: "跳刀冰墙", steps: [{ type: "item", id: "blink" }, ...spellSteps(["ice_wall", "cold_snap", "chaos_meteor"]) ] },
  { id: "combo-dagon-snap", name: "大根急冷", steps: [{ type: "item", id: "dagon" }, { type: "spell", id: "cold_snap" }] },
  { id: "combo-sun-meteor-blast", name: "阳炎陨石声波", steps: spellSteps(["tornado", "sun_strike", "chaos_meteor", "deafening_blast"]) },
  {
    id: "combo-refresher-double",
    name: "刷新球双陨石",
    steps: [
      ...spellSteps(["tornado", "chaos_meteor", "deafening_blast"]),
      { type: "item", id: "refresher" },
      ...spellSteps(["chaos_meteor", "deafening_blast"])
    ]
  }
];

const MAX_EQUIPPED_ITEMS = 6;
const DEFAULT_EQUIPPED_ITEM_IDS = [
  "blink",
  "cyclone",
  "sheepstick",
  "gleipnir",
  "rod_of_atos",
  "refresher"
];

function spellSteps(ids) {
  return ids.map((id) => ({ type: "spell", id }));
}

function cloneState(state) {
  return {
    ...state,
    slots: { ...state.slots },
    orbs: [...state.orbs],
    spellCooldowns: { ...state.spellCooldowns },
    itemCooldowns: { ...state.itemCooldowns }
  };
}

function cloneSession(session) {
  return {
    ...session,
    targets: session.targets.map((target) => ({ ...target })),
    invoker: cloneState(session.invoker),
    comboTimer: session.comboTimer ? { ...session.comboTimer } : createComboTimer(),
    recentKeys: [...session.recentKeys],
    equippedItemIds: [...session.equippedItemIds],
    completed: session.completed.map((target) => ({ ...target })),
    free: session.free
      ? {
          ...session.free,
          summary: session.free.summary ? { ...session.free.summary } : null,
          activeSteps: session.free.activeSteps.map((step) => ({ ...step })),
          history: session.free.history.map((row) => ({
            ...row,
            steps: row.steps.map((step) => ({ ...step }))
          }))
        }
      : createFreeState()
  };
}

export function normalizeCode(input) {
  if (!input) return "";
  if (typeof input === "string") return input;
  return input.code || input.key || "";
}

export function keyLabelFromCode(code) {
  if (!code) return "-";
  if (code.startsWith("Key")) return code.slice(3).toUpperCase();
  if (code.startsWith("Digit")) return code.slice(5);
  if (code === "Space") return "Space";
  return code.replace("Arrow", "");
}

export function pushOrb(buffer, orbId) {
  return [...buffer, orbId].slice(-3);
}

export function orbSignature(orbs) {
  const counts = Object.fromEntries(ORB_ORDER.map((orb) => [orb, 0]));
  for (const orb of orbs) {
    if (Object.hasOwn(counts, orb)) counts[orb] += 1;
  }
  return ORB_ORDER.map((orb) => `${orb}:${counts[orb]}`).join("|");
}

export function spellFromOrbs(spells, orbs) {
  if (!Array.isArray(orbs) || orbs.length !== 3) return undefined;
  const signature = orbSignature(orbs);
  return spells.find((spell) => orbSignature(spell.combo) === signature);
}

export function getSpell(spellId) {
  return SPELLS.find((spell) => spell.id === spellId);
}

export function getItem(itemId) {
  return ITEMS.find((item) => item.id === itemId);
}

export function getInvokeCooldown(totalOrbLevel = 0) {
  const cooldown = INVOKE.baseCooldown - Number(totalOrbLevel) * INVOKE.cooldownReductionPerOrbLevel;
  return Number(Math.max(0, cooldown).toFixed(1));
}

export function createInvokerState({ totalOrbLevel = 3, now = 0, slots, orbs } = {}) {
  return {
    totalOrbLevel,
    orbs: orbs ? [...orbs] : [],
    slots: slots ? { ...slots } : { primary: null, secondary: null },
    invokeReadyAt: now,
    spellCooldowns: {},
    itemCooldowns: {}
  };
}

export function invokeSpell(state, spellOrId, now = Date.now(), options = {}) {
  const spellId = typeof spellOrId === "string" ? spellOrId : spellOrId?.id;
  if (!spellId) return { ok: false, reason: "unknown-spell", state };

  const next = cloneState(state);
  const isAlreadyActive = next.slots.primary === spellId || next.slots.secondary === spellId;
  if (!options.ignoreCooldown && now < next.invokeReadyAt) {
    return {
      ok: false,
      reason: "invoke-cooldown",
      remainingMs: next.invokeReadyAt - now,
      state
    };
  }

  if (next.slots.primary === spellId) {
    return { ok: true, consumedCooldown: false, state: next };
  }

  if (next.slots.secondary === spellId) {
    next.slots = { primary: spellId, secondary: next.slots.primary };
    return { ok: true, consumedCooldown: false, state: next };
  }

  next.slots = {
    primary: spellId,
    secondary: isAlreadyActive ? next.slots.secondary : next.slots.primary
  };
  if (!options.ignoreCooldown) {
    next.invokeReadyAt = now + Math.round(getInvokeCooldown(next.totalOrbLevel) * 1000);
  }
  return { ok: true, consumedCooldown: true, state: next };
}

export function findSpellSlot(state, spellId) {
  if (state.slots.primary === spellId) return "primary";
  if (state.slots.secondary === spellId) return "secondary";
  return null;
}

export function castSpell(state, spell, slot, now = Date.now(), options = {}) {
  if (!spell) return { ok: false, reason: "unknown-spell", state };
  if (state.slots[slot] !== spell.id) return { ok: false, reason: "spell-not-in-slot", state };

  const readyAt = state.spellCooldowns[spell.id] || 0;
  if (!options.ignoreCooldown && now < readyAt) {
    return {
      ok: false,
      reason: "spell-cooldown",
      remainingMs: readyAt - now,
      state
    };
  }

  const next = cloneState(state);
  if (!options.ignoreCooldown) {
    next.spellCooldowns[spell.id] = now + Math.round(spell.cooldown * 1000);
  }
  return { ok: true, state: next };
}

export function castItem(state, item, now = Date.now(), options = {}) {
  if (!item) return { ok: false, reason: "unknown-item", state };
  const readyAt = state.itemCooldowns[item.id] || 0;
  if (!options.ignoreCooldown && now < readyAt) {
    return {
      ok: false,
      reason: "item-cooldown",
      remainingMs: readyAt - now,
      state
    };
  }

  const next = cloneState(state);
  if (item.refreshesCooldowns) {
    const refreshed = refreshCooldowns(next, now);
    if (!options.ignoreCooldown) {
      refreshed.itemCooldowns[item.id] = now + Math.round(item.cooldown * 1000);
    }
    return { ok: true, state: refreshed };
  }

  if (!options.ignoreCooldown) {
    next.itemCooldowns[item.id] = now + Math.round(item.cooldown * 1000);
  }
  return { ok: true, state: next };
}

export function refreshCooldowns(state, now = 0) {
  const next = cloneState(state);
  next.invokeReadyAt = now;
  next.spellCooldowns = {};
  next.itemCooldowns = {};
  return next;
}

export function makeKeyBindings(preset = "modern", overrides = {}) {
  const modern = {
    preset,
    castStyle: "slot",
    orbs: Object.fromEntries(ORBS.map((orb) => [orb.id, orb.defaultCode])),
    invoke: INVOKE.defaultCode,
    castSlots: { primary: "KeyD", secondary: "KeyF" },
    spellKeys: Object.fromEntries(SPELLS.map((spell) => [spell.id, spell.legacyCode])),
    items: Object.fromEntries(ITEMS.map((item) => [item.id, item.defaultCode]))
  };

  if (preset === "legacy") {
    modern.castStyle = "legacy";
    modern.castSlots = { primary: "KeyD", secondary: "KeyF" };
  }

  return mergeBindings(modern, overrides);
}

function mergeBindings(base, overrides) {
  return {
    ...base,
    ...overrides,
    orbs: { ...base.orbs, ...(overrides.orbs || {}) },
    castSlots: { ...base.castSlots, ...(overrides.castSlots || {}) },
    spellKeys: { ...base.spellKeys, ...(overrides.spellKeys || {}) },
    items: { ...base.items, ...(overrides.items || {}) }
  };
}

export function createPracticeSession({
  keyBindings = makeKeyBindings("modern"),
  mode = "random",
  requireInvokeCast = false,
  equippedItemIds = DEFAULT_EQUIPPED_ITEM_IDS,
  targets = [],
  totalOrbLevel = 3,
  now = 0
} = {}) {
  return {
    mode,
    requireInvokeCast,
    keyBindings,
    targets: targets.map((target) => ({ ...target })),
    currentIndex: 0,
    pendingSpellId: null,
    equippedItemIds: limitEquippedItems(equippedItemIds),
    invoker: createInvokerState({ totalOrbLevel, now }),
    comboTimer: createComboTimer(),
    recentKeys: [],
    completed: [],
    free: createFreeState(),
    streak: 0,
    mistakes: 0,
    lastResult: null
  };
}

function createFreeState() {
  return {
    activeSteps: [],
    history: [],
    runStartAt: null,
    runStepCount: 0,
    summary: null,
    lastActionAt: null,
    gapMs: 5000
  };
}

function createComboTimer() {
  return {
    startedAt: null,
    lastCompletedMs: null
  };
}

export function getCurrentTarget(session) {
  return session.targets[session.currentIndex] || null;
}

function completeCurrentTarget(session, result) {
  const target = getCurrentTarget(session);
  session.completed.push({ ...target, status: "success" });
  session.currentIndex += 1;
  session.pendingSpellId = null;
  session.streak += 1;
  result.ok = true;
  result.correct = true;
  result.targetCompleted = true;
}

function markMistake(session, result, reason, options = {}) {
  session.mistakes += 1;
  session.streak = 0;
  result.ok = false;
  result.correct = false;
  result.reason = reason;

  if (session.mode === "random" && options.advanceRandom) {
    const target = getCurrentTarget(session);
    if (target) {
      session.completed.push({ ...target, status: "fail" });
      session.currentIndex += 1;
      session.pendingSpellId = null;
      result.targetFailed = true;
    }
  }
}

function recordKey(session, code) {
  session.recentKeys = [
    { code, label: keyLabelFromCode(code), at: Date.now() },
    ...session.recentKeys
  ].slice(0, 12);
}

function usesRealCooldowns(mode) {
  return mode === "real" || mode === "free";
}

function updateSessionTimer(session, result, actionKind, now, previousIndex) {
  if (session.mode === "random") {
    if (session.comboTimer.startedAt === null && actionKind !== "unknown") {
      session.comboTimer.startedAt = now;
    }
    return;
  }

  if (!isComboPracticeMode(session.mode)) return;

  if (
    session.comboTimer.startedAt === null &&
    result.targetCompleted &&
    previousIndex === 0
  ) {
    session.comboTimer.startedAt = now;
  }

  if (!result.targetCompleted) return;
  if (getCurrentTarget(session)) return;
  if (session.comboTimer.startedAt === null) return;

  session.comboTimer.lastCompletedMs = Math.max(0, now - session.comboTimer.startedAt);
  session.comboTimer.startedAt = null;
}

function ensureFreeState(session) {
  if (!session.free) session.free = createFreeState();
}

function collectFreeSteps(free) {
  return [
    ...free.history.flatMap((row) => row.steps),
    ...free.activeSteps
  ];
}

function computeFreeMetrics(free, now = Date.now()) {
  const steps = collectFreeSteps(free);
  const stepCount = free.runStepCount || steps.length;
  if (!stepCount) return null;
  const earliestStepAt = steps.length ? Math.min(...steps.map((step) => step.at ?? now)) : now;
  const startedAt = free.runStartAt ?? earliestStepAt;
  const endedAt = steps.length ? Math.max(now, ...steps.map((step) => step.at ?? startedAt)) : now;
  const totalMs = Math.max(0, endedAt - startedAt);
  const averageMs = totalMs / stepCount;
  return {
    startedAt,
    endedAt,
    totalMs,
    averageMs,
    steps: stepCount
  };
}

function pushFreeHistory(session, now) {
  ensureFreeState(session);
  if (!session.free.activeSteps.length) return false;
  session.free.history = [
    {
      id: `free-${now}`,
      endedAt: now,
      steps: session.free.activeSteps.map((step) => ({ ...step }))
    },
    ...session.free.history
  ].slice(0, 8);
  session.free.activeSteps = [];
  session.free.lastActionAt = null;
  return true;
}

export function finalizeFreeChain(session, now = Date.now()) {
  if (session.mode !== "free" || !session.free?.activeSteps.length) return session;
  if (session.free.lastActionAt === null || now - session.free.lastActionAt < session.free.gapMs) return session;
  const next = cloneSession(session);
  pushFreeHistory(next, now);
  return next;
}

export function endFreeRun(session, now = Date.now()) {
  if (session.mode !== "free") return session;
  const next = cloneSession(session);
  ensureFreeState(next);
  pushFreeHistory(next, now);
  next.free.summary = computeFreeMetrics(next.free, now);
  next.lastResult = {
    ok: true,
    correct: false,
    reason: null,
    action: "free-end",
    targetCompleted: false
  };
  return next;
}

function appendFreeStep(session, step, now) {
  ensureFreeState(session);
  if (session.free.summary) {
    session.free.history = [];
    session.free.activeSteps = [];
    session.free.runStartAt = null;
    session.free.runStepCount = 0;
    session.free.summary = null;
  }
  if (
    session.free.activeSteps.length &&
    session.free.lastActionAt !== null &&
    now - session.free.lastActionAt >= session.free.gapMs
  ) {
    pushFreeHistory(session, now);
  }
  if (session.free.runStartAt === null) {
    session.free.runStartAt = now;
  }
  session.free.activeSteps.push({ ...step, at: now });
  session.free.runStepCount += 1;
  session.free.lastActionAt = now;
}

function actionFromCode(session, code) {
  const bindings = session.keyBindings;
  const orbId = Object.entries(bindings.orbs).find(([, bound]) => bound === code)?.[0];
  if (orbId) return { kind: "orb", id: orbId };
  if (bindings.invoke === code) return { kind: "invoke" };

  const itemId = Object.entries(bindings.items)
    .filter(([id]) => session.equippedItemIds.includes(id))
    .find(([, bound]) => bound === code)?.[0];
  if (itemId) return { kind: "item", id: itemId };

  if (bindings.castStyle === "legacy") {
    const activeSlots = ["primary", "secondary"];
    for (const slot of activeSlots) {
      const spellId = session.invoker.slots[slot];
      if (spellId && bindings.spellKeys[spellId] === code) {
        return { kind: "cast", slot, spellId };
      }
    }
    const spellKeyId = Object.entries(bindings.spellKeys).find(([, bound]) => bound === code)?.[0];
    if (spellKeyId) return { kind: "inactive-spell-key", spellId: spellKeyId };
  } else {
    const slot = Object.entries(bindings.castSlots).find(([, bound]) => bound === code)?.[0];
    if (slot) return { kind: "cast", slot, spellId: session.invoker.slots[slot] };
  }

  return { kind: "unknown" };
}

export function getSpellCastCode(spellId, state, bindings) {
  if (bindings.castStyle === "legacy") return bindings.spellKeys[spellId];
  const slot = findSpellSlot(state, spellId);
  return slot ? bindings.castSlots[slot] : bindings.castSlots.primary;
}

export function applyPracticeKey(session, rawCode, now = Date.now()) {
  const code = normalizeCode(rawCode);
  const next = cloneSession(session);
  const result = {
    ok: true,
    correct: false,
    reason: null,
    action: "unknown",
    targetCompleted: false
  };

  recordKey(next, code);

  const target = getCurrentTarget(next);
  const isFree = next.mode === "free";
  if (!target && !isFree) {
    result.ok = false;
    result.reason = "already-complete";
    next.lastResult = result;
    return { session: next, result };
  }

  const action = actionFromCode(next, code);
  result.action = action.kind;
  const previousIndex = next.currentIndex;

  if (action.kind === "orb") {
    next.invoker.orbs = pushOrb(next.invoker.orbs, action.id);
    const recognized = spellFromOrbs(SPELLS, next.invoker.orbs);
    if (recognized) next.pendingSpellId = recognized.id;

    if (isFree) {
      result.correct = Boolean(recognized);
    } else if (target.type === "spell" && recognized?.id === target.id) {
      result.correct = true;
      if (!next.requireInvokeCast && !usesRealCooldowns(next.mode)) {
        completeCurrentTarget(next, result);
      }
    } else if (next.invoker.orbs.length === 3 && !next.requireInvokeCast) {
      markMistake(next, result, "wrong-orbs");
    }
  } else if (action.kind === "invoke") {
    const recognized = spellFromOrbs(SPELLS, next.invoker.orbs);
    if (!recognized) {
      markMistake(next, result, "no-spell-to-invoke");
    } else {
      const invoked = invokeSpell(next.invoker, recognized.id, now, {
        ignoreCooldown: !usesRealCooldowns(next.mode)
      });
      if (!invoked.ok) {
        markMistake(next, result, invoked.reason);
        result.remainingMs = invoked.remainingMs;
      } else {
        next.invoker = invoked.state;
        next.pendingSpellId = recognized.id;
        result.correct = isFree || target.type !== "spell" || recognized.id === target.id;
      }
    }
  } else if (action.kind === "cast") {
    const spellId = action.spellId;
    if (!spellId) {
      markMistake(next, result, "empty-slot", { advanceRandom: true });
    } else if (!isFree && (target.type !== "spell" || target.id !== spellId)) {
      markMistake(next, result, "wrong-spell-cast", { advanceRandom: true });
    } else {
      const cast = castSpell(next.invoker, getSpell(spellId), action.slot, now, {
        ignoreCooldown: !usesRealCooldowns(next.mode)
      });
      if (!cast.ok) {
        markMistake(next, result, cast.reason);
        result.remainingMs = cast.remainingMs;
      } else {
        next.invoker = cast.state;
        if (isFree) {
          appendFreeStep(next, { type: "spell", id: spellId }, now);
          result.ok = true;
          result.correct = true;
          result.freeStepRecorded = true;
        } else {
          completeCurrentTarget(next, result);
        }
      }
    }
  } else if (action.kind === "inactive-spell-key") {
    markMistake(next, result, "spell-not-in-slot");
  } else if (action.kind === "item") {
    if (!isFree && (target.type !== "item" || target.id !== action.id)) {
      markMistake(next, result, "wrong-item", { advanceRandom: true });
    } else {
      const cast = castItem(next.invoker, getItem(action.id), now, {
        ignoreCooldown: !usesRealCooldowns(next.mode)
      });
      if (!cast.ok) {
        markMistake(next, result, cast.reason);
        result.remainingMs = cast.remainingMs;
      } else {
        next.invoker = cast.state;
        if (isFree) {
          appendFreeStep(next, { type: "item", id: action.id }, now);
          result.ok = true;
          result.correct = true;
          result.freeStepRecorded = true;
        } else {
          completeCurrentTarget(next, result);
        }
      }
    }
  } else {
    result.ok = false;
    result.reason = "unmapped-key";
  }

  updateSessionTimer(next, result, action.kind, now, previousIndex);
  next.lastResult = result;
  return { session: next, result };
}

export function describeStep(step) {
  if (!step) return null;
  if (step.type === "spell") return getSpell(step.id);
  return getItem(step.id);
}

export function randomSpellTargets(count = 24) {
  return Array.from({ length: count }, () => {
    const spell = SPELLS[Math.floor(Math.random() * SPELLS.length)];
    return { type: "spell", id: spell.id };
  });
}

export function getDefaultCombos() {
  return DEFAULT_COMBOS.map((combo) => ({
    ...combo,
    steps: combo.steps.map((step) => ({ ...step }))
  }));
}

if (typeof document !== "undefined") {
  boot();
}

function boot() {
  const app = createAppModel();
  const elements = collectElements();
  bindUi(app, elements);
  render(app, elements);
  startClock(app, elements);
}

function createAppModel() {
  const savedSettings = readJson(STORAGE_KEYS.settings, {});
  const preset = savedSettings.preset || "modern";
  const settings = {
    mode: "random",
    preset,
    requireInvokeCast: savedSettings.requireInvokeCast ?? true,
    heroLevel: savedSettings.heroLevel ?? 7,
    totalOrbLevel: savedSettings.totalOrbLevel ?? levelToOrbLevel(savedSettings.heroLevel ?? 7),
    equippedItemIds: normalizeEquippedItems(savedSettings.equippedItemIds),
    selectedComboId: savedSettings.selectedComboId || "combo-meatball-blast",
    editorComboId: null,
    pickerOpenFor: null
  };
  const keyBindings = makeKeyBindings(preset, savedSettings.keyBindings || {});
  const combos = loadCombos();
  const session = createSessionForMode(settings, keyBindings, combos);
  return { settings, keyBindings, combos, session, flash: null, editingKey: null };
}

function collectElements() {
  return {
    modeTabs: [...document.querySelectorAll("[data-mode-tab]")],
    modeTitle: document.querySelector("#mode-title"),
    modeSubtitle: document.querySelector("#mode-subtitle"),
    rail: document.querySelector("#skill-rail"),
    centerTarget: document.querySelector("#center-target"),
    status: document.querySelector("#status-line"),
    sessionTimer: document.querySelector("#session-timer"),
    sessionComboNav: document.querySelector("#session-combo-nav"),
    sessionComboName: document.querySelector("#session-combo-name"),
    orbs: document.querySelector("#orb-row"),
    slots: document.querySelector("#slot-row"),
    cooldowns: document.querySelector("#cooldown-row"),
    equipment: document.querySelector("#equipment-row"),
    recent: document.querySelector("#recent-keys"),
    preset: document.querySelector("#preset-select"),
    castStyle: document.querySelector("#cast-style"),
    requireInvoke: document.querySelector("#require-invoke"),
    heroLevel: document.querySelector("#hero-level"),
    totalOrbLevel: document.querySelector("#total-orb-level"),
    invokeCd: document.querySelector("#invoke-cd"),
    comboSelect: document.querySelector("#combo-select"),
    comboEditor: document.querySelector("#combo-editor"),
    comboName: document.querySelector("#combo-name"),
    comboSteps: document.querySelector("#combo-steps"),
    addSpell: document.querySelector("#add-spell"),
    addItem: document.querySelector("#add-item"),
    saveCombo: document.querySelector("#save-combo"),
    newCombo: document.querySelector("#new-combo"),
    deleteCombo: document.querySelector("#delete-combo"),
    comboOffsetButtons: [...document.querySelectorAll("[data-combo-offset]")],
    picker: document.querySelector("#picker"),
    pickerGrid: document.querySelector("#picker-grid"),
    spellbook: document.querySelector("#spellbook"),
    spellbookGrid: document.querySelector("#spellbook-grid"),
    keybinds: document.querySelector("#keybinds"),
    equipmentSettings: document.querySelector("#equipment-settings"),
    drawerToggles: [...document.querySelectorAll("[data-toggle-drawer]")],
    refreshCds: document.querySelector("#refresh-cds"),
    reset: document.querySelector("#reset-run"),
    endFreeRun: document.querySelector("#end-free-run")
  };
}

function bindUi(app, elements) {
  elements.drawerToggles.forEach((button) => {
    button.addEventListener("click", () => {
      const drawer = document.querySelector(`[data-drawer="${button.dataset.toggleDrawer}"]`);
      const shouldOpen = drawer && !drawer.classList.contains("open");

      document.querySelectorAll("[data-drawer]").forEach((panel) => {
        const isOpen = Boolean(shouldOpen && panel === drawer);
        const panelButton = document.querySelector(`[data-toggle-drawer="${panel.dataset.drawer}"]`);
        const label = panelButton?.dataset.drawerLabel ?? "面板";

        panel.classList.toggle("open", isOpen);
        panelButton?.setAttribute("aria-expanded", String(isOpen));
        panelButton?.setAttribute("aria-label", `${isOpen ? "关闭" : "打开"}${label}`);
      });
    });
  });

  elements.modeTabs.forEach((button) => {
    button.addEventListener("click", () => {
      app.settings.mode = button.dataset.modeTab;
      resetSession(app);
      render(app, elements);
    });
  });

  elements.preset.addEventListener("change", () => {
    app.settings.preset = elements.preset.value;
    app.keyBindings = makeKeyBindings(app.settings.preset, app.settings.preset === "custom" ? app.keyBindings : {});
    persistSettings(app);
    resetSession(app);
    render(app, elements);
  });

  elements.castStyle.addEventListener("change", () => {
    app.settings.preset = "custom";
    app.keyBindings.preset = "custom";
    app.keyBindings.castStyle = elements.castStyle.value;
    persistSettings(app);
    resetSession(app);
    render(app, elements);
  });

  elements.requireInvoke.addEventListener("change", () => {
    app.settings.requireInvokeCast = elements.requireInvoke.checked;
    persistSettings(app);
    resetSession(app);
    render(app, elements);
  });

  elements.heroLevel.addEventListener("input", () => {
    app.settings.heroLevel = Number(elements.heroLevel.value);
    app.settings.totalOrbLevel = levelToOrbLevel(app.settings.heroLevel);
    persistSettings(app);
    resetSession(app);
    render(app, elements);
  });

  elements.totalOrbLevel.addEventListener("input", () => {
    app.settings.totalOrbLevel = Number(elements.totalOrbLevel.value);
    persistSettings(app);
    resetSession(app);
    render(app, elements);
  });

  elements.equipmentSettings.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-equip-item]");
    if (!checkbox) return;
    const itemId = checkbox.dataset.equipItem;
    app.settings.equippedItemIds = checkbox.checked
      ? addEquippedItem(app.settings.equippedItemIds, itemId)
      : app.settings.equippedItemIds.filter((id) => id !== itemId);
    persistSettings(app);
    resetSession(app);
    render(app, elements);
  });

  elements.equipmentSettings.addEventListener("click", (event) => {
    const button = event.target.closest("[data-bind-path]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    app.settings.preset = "custom";
    elements.preset.value = "custom";
    app.keyBindings.preset = "custom";
    app.editingKey = button.dataset.bindPath;
    button.textContent = "按任意键...";
    button.classList.add("listening");
  });

  elements.comboSelect.addEventListener("change", () => {
    selectCombo(app, elements, elements.comboSelect.value);
  });

  elements.comboOffsetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectComboByOffset(app, elements, Number(button.dataset.comboOffset));
    });
  });

  elements.newCombo.addEventListener("click", () => {
    const combo = { id: `custom-${Date.now()}`, name: "新的连招", steps: [] };
    app.combos.push(combo);
    app.settings.selectedComboId = combo.id;
    app.settings.editorComboId = combo.id;
    saveCombos(app.combos);
    resetSession(app);
    render(app, elements);
  });

  elements.saveCombo.addEventListener("click", () => {
    const combo = currentEditableCombo(app);
    combo.name = elements.comboName.value.trim() || "未命名连招";
    saveCombos(app.combos);
    render(app, elements);
  });

  elements.deleteCombo.addEventListener("click", () => {
    if (app.combos.length <= 1) return;
    app.combos = app.combos.filter((combo) => combo.id !== app.settings.selectedComboId);
    app.settings.selectedComboId = app.combos[0].id;
    app.settings.editorComboId = app.combos[0].id;
    saveCombos(app.combos);
    resetSession(app);
    render(app, elements);
  });

  elements.addSpell.addEventListener("click", () => openPicker(app, elements, "spell"));
  elements.addItem.addEventListener("click", () => openPicker(app, elements, "item"));

  elements.picker.addEventListener("click", (event) => {
    if (event.target === elements.picker || event.target.matches("[data-close-picker]")) {
      closePicker(app, elements);
    }
  });

  elements.reset.addEventListener("click", () => {
    resetSession(app);
    render(app, elements);
  });

  elements.endFreeRun.addEventListener("click", () => {
    app.session = endFreeRun(app.session, performance.now());
    render(app, elements);
  });

  elements.refreshCds.addEventListener("click", () => {
    app.session.invoker = refreshCooldowns(app.session.invoker, performance.now());
    app.session.lastResult = {
      ok: true,
      correct: false,
      reason: null,
      action: "manual-refresh",
      targetCompleted: false
    };
    render(app, elements);
  });

  elements.keybinds.addEventListener("click", (event) => {
    const button = event.target.closest("[data-bind-path]");
    if (!button) return;
    app.settings.preset = "custom";
    elements.preset.value = "custom";
    app.keyBindings.preset = "custom";
    app.editingKey = button.dataset.bindPath;
    button.textContent = "按任意键...";
    button.classList.add("listening");
  });

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (app.editingKey) {
      event.preventDefault();
      setBindingAtPath(app.keyBindings, app.editingKey, event.code);
      app.editingKey = null;
      persistSettings(app);
      resetSession(app);
      render(app, elements);
      return;
    }
    if (isTypingTarget(event.target)) return;
    if (app.settings.pickerOpenFor) return;

    if (event.code === "Enter" && isComboPracticeMode(app.settings.mode)) {
      event.preventDefault();
      selectComboByOffset(app, elements, event.shiftKey ? -1 : 1);
      return;
    }

    event.preventDefault();
    const outcome = applyPracticeKey(app.session, event.code, performance.now());
    app.session = outcome.session;
    app.flash = outcome.result.ok ? "good" : "bad";

    if (app.settings.mode === "random" && app.session.currentIndex > app.session.targets.length - 6) {
      app.session.targets.push(...randomSpellTargets(12));
    }

    render(app, elements);
    window.setTimeout(() => {
      app.flash = null;
      render(app, elements);
    }, 220);
  });
}

function createSessionForMode(settings, keyBindings, combos) {
  const mode = settings.mode;
  const targets = mode === "free"
    ? []
    : mode === "random"
      ? randomSpellTargets(24)
      : (combos.find((combo) => combo.id === settings.selectedComboId) || combos[0]).steps;

  return createPracticeSession({
    keyBindings,
    mode,
    requireInvokeCast: usesRealCooldowns(mode) ? true : settings.requireInvokeCast,
    targets,
    equippedItemIds: settings.equippedItemIds,
    totalOrbLevel: settings.totalOrbLevel
  });
}

function resetSession(app) {
  app.session = createSessionForMode(app.settings, app.keyBindings, app.combos);
}

function render(app, elements) {
  document.body.dataset.flash = app.flash || "";
  document.body.dataset.mode = app.settings.mode;
  renderMode(app, elements);
  renderRail(app, elements);
  renderSessionTimer(app, elements);
  renderHud(app, elements);
  renderSettings(app, elements);
  renderCombos(app, elements);
  renderSpellbook(app, elements);
  renderKeybinds(app, elements);
  renderEquipmentSettings(app, elements);
}

function renderMode(app, elements) {
  elements.modeTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.modeTab === app.settings.mode);
  });
  elements.modeTitle.textContent = MODE_LABELS[app.settings.mode];
  elements.modeSubtitle.textContent = app.settings.mode === "random"
    ? "滚动随机技能，放大的目标是当前要搓的招。"
    : app.settings.mode === "combo"
      ? "练固定连招，不考虑 CD；Enter 下一套，Shift + Enter 上一套。"
      : app.settings.mode === "real"
        ? "技能槽、Invoke、技能和物品 CD 都按真实节奏走；Enter 切连招。"
        : "不设定目标，随便按；5 秒内算同一段连招。点“结束统计”结算总时间和平均时间。";
  elements.endFreeRun.hidden = app.settings.mode !== "free";
}

function renderRail(app, elements) {
  if (app.settings.mode === "free") {
    renderFreeRail(app, elements);
    return;
  }

  elements.rail.classList.remove("free-rail");
  const past = app.session.completed.slice(-5).map((step) => ({ ...step, phase: "past" }));
  const current = getCurrentTarget(app.session);
  const future = app.session.targets
    .slice(app.session.currentIndex + 1, app.session.currentIndex + 7)
    .map((step) => ({ ...step, phase: "future" }));
  const visible = [...past, ...(current ? [{ ...current, phase: "current" }] : []), ...future];
  const activeIndex = past.length;
  elements.rail.style.setProperty("--rail-shift", `${RAIL_CARD_WIDTH / 2 + activeIndex * (RAIL_CARD_WIDTH + RAIL_CARD_GAP)}px`);
  elements.rail.innerHTML = visible.map((step) => {
    const detail = describeStep(step);
    const active = step.phase === "current" ? "active" : "";
    const status = step.status ? `is-${step.status}` : "";
    const badge = step.status === "success"
      ? `<b class="result-mark success">✓</b>`
      : step.status === "fail"
        ? `<b class="result-mark fail">×</b>`
        : "";
    return `<article class="rail-card ${active} ${step.phase} ${status}">
      <img src="${detail.icon}" alt="" loading="lazy">
      <span>${detail.zh}</span>
      <small>${detail.en}</small>
      ${badge}
    </article>`;
  }).join("");

  const target = describeStep(getCurrentTarget(app.session));
  const comboMode = isComboPracticeMode(app.settings.mode);
  if (elements.centerTarget) {
    elements.centerTarget.innerHTML = target
      ? `<img src="${target.icon}" alt=""><div><strong>${target.zh}</strong><span>${target.en}</span></div>`
      : comboMode
        ? `<div><strong>连招完成</strong><span>按 Enter 切下一套</span></div>`
        : `<strong>完成！</strong>`;
  }

  renderSessionComboNav(app, elements);

  const last = app.session.lastResult;
  elements.status.textContent = comboMode && !getCurrentTarget(app.session)
    ? "连招完成。按 Enter 下一套，Shift + Enter 上一套。"
    : last
    ? statusText(last)
    : "敲键开始。放大的图标就是当前目标，小手别慌。";
}

function renderFreeRail(app, elements) {
  elements.rail.classList.add("free-rail");
  elements.rail.style.removeProperty("--rail-shift");
  renderSessionComboNav(app, elements);
  const rows = app.session.free.activeSteps.length
    ? [{ id: "active", active: true, steps: app.session.free.activeSteps }, ...app.session.free.history]
    : app.session.free.history;

  elements.rail.innerHTML = `<div class="free-board">
    ${
      rows.length
        ? rows.map((row) => renderFreeRow(row)).join("")
        : `<div class="free-empty">先搓球、Invoke，再按技能或物品。你的连招图标会出现在这里。</div>`
    }
  </div>`;

  if (elements.centerTarget) {
    elements.centerTarget.innerHTML = `<div><strong>自由模式</strong><span>5 秒内继续输入会接在当前行</span></div>`;
  }
  const last = app.session.lastResult;
  elements.status.textContent = last
    ? statusText(last)
    : "没有目标，随便按。CD 和刷新球照样真实。";
}

function renderFreeRow(row) {
  const title = row.active ? "当前连招" : "上一段";
  return `<article class="free-row ${row.active ? "active" : ""}">
    <span>${title}</span>
    <div>
      ${row.steps.map((step) => {
        const detail = describeStep(step);
        return `<img src="${detail.icon}" title="${detail.zh}" alt="${detail.zh}">`;
      }).join("")}
    </div>
  </article>`;
}

function renderSessionComboNav(app, elements) {
  const visible = isComboPracticeMode(app.settings.mode);
  elements.sessionComboNav.hidden = !visible;
  if (!visible) return;

  const combo = currentEditableCombo(app);
  const index = Math.max(0, app.combos.findIndex((entry) => entry.id === combo.id));
  elements.sessionComboName.textContent = `${index + 1}/${app.combos.length} ${combo.name}`;
}

function renderSessionTimer(app, elements) {
  const panel = elements.sessionTimer;
  if (!panel) return;
  const now = performance.now();

  if (app.settings.mode === "random") {
    const startedAt = app.session.comboTimer.startedAt;
    const elapsedMs = startedAt === null ? null : Math.max(0, now - startedAt);
    const attempts = Math.max(0, app.session.completed.length);
    const averageMs = elapsedMs !== null && attempts > 0 ? elapsedMs / attempts : null;
    panel.hidden = false;
    panel.innerHTML = `
      <span class="timer-title">随机计时</span>
      <div class="timer-metric">
        <span>总时间</span>
        <strong>${formatDuration(elapsedMs)}</strong>
      </div>
      <div class="timer-metric">
        <span>平均每招</span>
        <strong>${formatDuration(averageMs)}</strong>
      </div>
    `;
    return;
  }

  if (isComboPracticeMode(app.settings.mode)) {
    const runningMs = app.session.comboTimer.startedAt === null
      ? null
      : Math.max(0, now - app.session.comboTimer.startedAt);
    const totalMs = runningMs ?? app.session.comboTimer.lastCompletedMs;
    panel.hidden = false;
    panel.innerHTML = `
      <span class="timer-title">连招计时</span>
      <div class="timer-metric">
        <span>总时间</span>
        <strong>${formatDuration(totalMs)}</strong>
      </div>
      <div class="timer-metric">
        <span>状态</span>
        <strong>${runningMs !== null ? "进行中" : totalMs !== null ? "已完成" : "等待开始"}</strong>
      </div>
    `;
    return;
  }

  if (app.settings.mode === "free") {
    const summary = app.session.free.summary || computeFreeMetrics(app.session.free, now);
    panel.hidden = false;
    panel.innerHTML = `
      <span class="timer-title">自由统计</span>
      <div class="timer-metric">
        <span>总时间</span>
        <strong>${formatDuration(summary?.totalMs)}</strong>
      </div>
      <div class="timer-metric">
        <span>平均每招</span>
        <strong>${formatDuration(summary?.averageMs)}</strong>
      </div>
    `;
    return;
  }

  panel.hidden = true;
}

function renderHud(app, elements) {
  elements.orbs.innerHTML = Array.from({ length: 3 }, (_, index) => {
    const orbId = app.session.invoker.orbs[index];
    const orb = ORBS.find((entry) => entry.id === orbId);
    return `<div class="orb ${orb ? "filled" : ""}" style="--orb:${orb?.color || "#32404f"}">
      ${orb ? `<img src="${orb.icon}" alt=""><span>${orb.zh}</span>` : "<span>空</span>"}
    </div>`;
  }).join("");

  elements.slots.innerHTML = ["primary", "secondary"].map((slot) => {
    const spellId = app.session.invoker.slots[slot];
    const spell = getSpell(spellId);
    const key = app.keyBindings.castStyle === "legacy" && spell
      ? app.keyBindings.spellKeys[spell.id]
      : app.keyBindings.castSlots[slot];
    return `<div class="slot-card">
      <span class="slot-name">${slot === "primary" ? "D 槽" : "F 槽"}</span>
      <kbd>${keyLabelFromCode(key)}</kbd>
      ${spell ? `<img src="${spell.icon}" alt=""><strong>${spell.zh}</strong>` : "<strong>空槽</strong>"}
    </div>`;
  }).join("");

  const equippedItems = limitEquippedItems(app.settings.equippedItemIds);
  elements.equipment.innerHTML = equippedItems.map((itemId) => {
    const item = getItem(itemId);
    if (!item) return "";
    const key = app.keyBindings.items[item.id];
    const readyAt = app.session.invoker.itemCooldowns[item.id] || 0;
    const remaining = Math.max(0, readyAt - performance.now());
    return `<div class="equipment-card ${remaining > 0 ? "cooling" : ""}">
      <img src="${item.icon}" alt="">
      <kbd>${keyLabelFromCode(key)}</kbd>
      <span>${item.zh}</span>
    </div>`;
  }).join("") || `<span class="empty-note">左侧装备栏勾选物品</span>`;

  renderCooldowns(app, elements);
  elements.recent.innerHTML = app.session.recentKeys.map((entry) => `<kbd>${entry.label}</kbd>`).join("");
}

function renderCooldowns(app, elements) {
  const now = performance.now();
  const spellCooldowns = SPELLS.filter((spell) => (app.session.invoker.spellCooldowns[spell.id] || 0) > now);
  const itemCooldowns = ITEMS.filter((item) => (app.session.invoker.itemCooldowns[item.id] || 0) > now);
  const invokeRemaining = Math.max(0, app.session.invoker.invokeReadyAt - now);
  elements.cooldowns.innerHTML = [
    cooldownPill(INVOKE, invokeRemaining, getInvokeCooldown(app.settings.totalOrbLevel), "R"),
    ...spellCooldowns.map((spell) => cooldownPill(spell, app.session.invoker.spellCooldowns[spell.id] - now, spell.cooldown)),
    ...itemCooldowns.map((item) => cooldownPill(item, app.session.invoker.itemCooldowns[item.id] - now, item.cooldown))
  ].join("");
}

function cooldownPill(entry, remainingMs, totalSeconds, fallbackKey = "") {
  const remainingSeconds = Math.max(0, remainingMs / 1000);
  const progress = totalSeconds ? Math.max(0, Math.min(1, remainingSeconds / totalSeconds)) : 0;
  return `<div class="cooldown-pill" style="--cd:${progress}">
    <img src="${entry.icon}" alt="">
    <span>${entry.zh || entry.en}</span>
    <b>${remainingSeconds > 0 ? remainingSeconds.toFixed(1) : fallbackKey || "OK"}</b>
  </div>`;
}

function renderSettings(app, elements) {
  elements.preset.value = app.settings.preset;
  elements.castStyle.value = app.keyBindings.castStyle;
  elements.requireInvoke.checked = app.settings.requireInvokeCast;
  elements.requireInvoke.disabled = usesRealCooldowns(app.settings.mode);
  elements.heroLevel.value = app.settings.heroLevel;
  elements.totalOrbLevel.value = app.settings.totalOrbLevel;
  elements.invokeCd.textContent = `${getInvokeCooldown(app.settings.totalOrbLevel).toFixed(1)}s`;
}

function renderCombos(app, elements) {
  elements.comboEditor.hidden = false;
  elements.comboSelect.innerHTML = app.combos.map((combo) => {
    return `<option value="${combo.id}" ${combo.id === app.settings.selectedComboId ? "selected" : ""}>${combo.name}</option>`;
  }).join("");

  const combo = currentEditableCombo(app);
  elements.comboName.value = combo.name;
  elements.comboSteps.innerHTML = combo.steps.map((step, index) => {
    const detail = describeStep(step);
    return `<li>
      <img src="${detail.icon}" alt="">
      <span>${detail.zh}<small>${detail.en}</small></span>
      <button type="button" data-move-step="${index}" data-dir="-1">↑</button>
      <button type="button" data-move-step="${index}" data-dir="1">↓</button>
      <button type="button" data-remove-step="${index}">删除</button>
    </li>`;
  }).join("");

  elements.comboSteps.querySelectorAll("[data-remove-step]").forEach((button) => {
    button.addEventListener("click", () => {
      combo.steps.splice(Number(button.dataset.removeStep), 1);
      saveCombos(app.combos);
      resetSession(app);
      render(app, elements);
    });
  });

  elements.comboSteps.querySelectorAll("[data-move-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const from = Number(button.dataset.moveStep);
      const to = from + Number(button.dataset.dir);
      if (to < 0 || to >= combo.steps.length) return;
      const [step] = combo.steps.splice(from, 1);
      combo.steps.splice(to, 0, step);
      saveCombos(app.combos);
      resetSession(app);
      render(app, elements);
    });
  });
}

function renderSpellbook(app, elements) {
  elements.spellbookGrid.innerHTML = SPELLS.map((spell) => {
    const path = buildSpellPath(spell, app.keyBindings, app.settings.requireInvokeCast || usesRealCooldowns(app.settings.mode));
    return `<article class="spell-card">
      <img src="${spell.icon}" alt="">
      <div>
        <strong>${spell.zh}</strong>
        <span>${spell.en}</span>
        <small>${path}</small>
      </div>
    </article>`;
  }).join("");
}

function renderKeybinds(app, elements) {
  const rows = [
    ...ORBS.map((orb) => [`orbs.${orb.id}`, `${orb.zh} ${orb.en}`, app.keyBindings.orbs[orb.id]]),
    ["invoke", "Invoke 合成", app.keyBindings.invoke],
    ...(app.keyBindings.castStyle === "slot"
      ? [
          ["castSlots.primary", "主技能槽", app.keyBindings.castSlots.primary],
          ["castSlots.secondary", "副技能槽", app.keyBindings.castSlots.secondary]
        ]
      : SPELLS.map((spell) => [`spellKeys.${spell.id}`, `${spell.zh} 释放`, app.keyBindings.spellKeys[spell.id]])),
  ];

  elements.keybinds.innerHTML = rows.map(([path, label, code]) => {
    return `<button type="button" class="bind-row" data-bind-path="${path}">
      <span>${label}</span><kbd>${keyLabelFromCode(code)}</kbd>
    </button>`;
  }).join("");
}

function renderEquipmentSettings(app, elements) {
  const equippedSet = new Set(app.settings.equippedItemIds);
  const atLimit = equippedSet.size >= MAX_EQUIPPED_ITEMS;
  elements.equipmentSettings.innerHTML = ITEMS.map((item) => {
    const checked = equippedSet.has(item.id) ? "checked" : "";
    const disabled = !checked && atLimit ? "disabled" : "";
    return `<label class="equip-row">
      <input type="checkbox" data-equip-item="${item.id}" ${checked} ${disabled}>
      <img src="${item.icon}" alt="">
      <span>${item.zh}<small>${item.en}</small></span>
      <button type="button" class="equip-bind" data-bind-path="items.${item.id}">
        <kbd>${keyLabelFromCode(app.keyBindings.items[item.id])}</kbd>
      </button>
    </label>`;
  }).join("");
}

function openPicker(app, elements, type) {
  app.settings.pickerOpenFor = type;
  elements.picker.hidden = false;
  const source = type === "spell" ? SPELLS : ITEMS;
  elements.pickerGrid.innerHTML = source.map((entry) => {
    return `<button type="button" data-pick-id="${entry.id}">
      <img src="${entry.icon}" alt="">
      <span>${entry.zh}</span>
      <small>${entry.en}</small>
    </button>`;
  }).join("");

  elements.pickerGrid.querySelectorAll("[data-pick-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const combo = currentEditableCombo(app);
      combo.steps.push({ type, id: button.dataset.pickId });
      saveCombos(app.combos);
      resetSession(app);
      closePicker(app, elements);
      render(app, elements);
    });
  });
}

function closePicker(app, elements) {
  app.settings.pickerOpenFor = null;
  elements.picker.hidden = true;
}

function currentEditableCombo(app) {
  return app.combos.find((combo) => combo.id === app.settings.selectedComboId) || app.combos[0];
}

function selectCombo(app, elements, comboId) {
  if (!app.combos.some((combo) => combo.id === comboId)) return;
  app.settings.selectedComboId = comboId;
  app.settings.editorComboId = comboId;
  persistSettings(app);
  resetSession(app);
  render(app, elements);
}

function selectComboByOffset(app, elements, offset) {
  if (!app.combos.length) return;
  const currentIndex = Math.max(0, app.combos.findIndex((combo) => combo.id === app.settings.selectedComboId));
  const nextIndex = (currentIndex + offset + app.combos.length) % app.combos.length;
  selectCombo(app, elements, app.combos[nextIndex].id);
}

function isComboPracticeMode(mode) {
  return mode === "combo" || mode === "real";
}

function buildSpellPath(spell, bindings, requireInvoke) {
  const orbKeys = spell.combo.map((orbId) => keyLabelFromCode(bindings.orbs[orbId])).join(" ");
  if (!requireInvoke) return orbKeys;
  const castKey = bindings.castStyle === "legacy"
    ? keyLabelFromCode(bindings.spellKeys[spell.id])
    : `${keyLabelFromCode(bindings.castSlots.primary)}/${keyLabelFromCode(bindings.castSlots.secondary)}`;
  return `${orbKeys} -> ${keyLabelFromCode(bindings.invoke)} -> ${castKey}`;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return "--";
  const safeMs = Math.max(0, ms);
  const seconds = safeMs / 1000;
  return `${seconds >= 10 ? seconds.toFixed(1) : seconds.toFixed(2)}s`;
}

function statusText(result) {
  if (result.targetCompleted) return "正确，下一招。";
  if (result.freeStepRecorded) return "已记入当前自由连招，5 秒内继续接。";
  if (result.action === "free-end") return "自由模式统计已结算。";
  if (result.action === "manual-refresh") return "已刷新全部技能和物品 CD。";
  if (result.correct) return "对，继续把这招打完。";
  const reasonMap = {
    "wrong-orbs": "球不对，重新调整三球。",
    "no-spell-to-invoke": "现在三个球还拼不出技能。",
    "invoke-cooldown": "Invoke 还在 CD。",
    "wrong-spell-cast": "释放的不是当前目标技能。",
    "spell-not-in-slot": "这个技能还没在槽里。",
    "spell-cooldown": "技能还在 CD。",
    "wrong-item": "物品按错了。",
    "item-cooldown": "物品还在 CD。",
    "empty-slot": "这个技能槽还是空的。",
    "unmapped-key": "这个键现在没有绑定。",
    "manual-refresh": "已刷新全部技能和物品 CD。"
  };
  return reasonMap[result.reason] || "这下不对，再来。";
}

function levelToOrbLevel(level) {
  const heroLevel = Number(level) || 1;
  return Math.max(1, Math.min(21, heroLevel + (heroLevel >= 6 ? 1 : 0) + (heroLevel >= 12 ? 1 : 0) + (heroLevel >= 18 ? 1 : 0)));
}

export function setBindingAtPath(bindings, path, code) {
  const parts = path.split(".");
  if (parts[0] === "items" && parts[1]) {
    const targetId = parts[1];
    Object.keys(bindings.items).forEach((itemId) => {
      if (itemId !== targetId && bindings.items[itemId] === code) {
        bindings.items[itemId] = "";
      }
    });
    bindings.items[targetId] = code;
    return;
  }
  if (parts.length === 1) {
    bindings[parts[0]] = code;
    return;
  }
  bindings[parts[0]][parts[1]] = code;
}

function persistSettings(app) {
  writeJson(STORAGE_KEYS.settings, {
    ...app.settings,
    keyBindings: app.settings.preset === "custom" ? app.keyBindings : {}
  });
}

function normalizeEquippedItems(value) {
  if (!Array.isArray(value)) return [...DEFAULT_EQUIPPED_ITEM_IDS];
  const filtered = limitEquippedItems(value);
  return filtered.length ? filtered : [...DEFAULT_EQUIPPED_ITEM_IDS];
}

function limitEquippedItems(ids) {
  const validIds = new Set(ITEMS.map((item) => item.id));
  const deduped = [];
  for (const id of ids) {
    if (!validIds.has(id) || deduped.includes(id)) continue;
    deduped.push(id);
  }
  return deduped.slice(0, MAX_EQUIPPED_ITEMS);
}

function addEquippedItem(currentIds, itemId) {
  const next = currentIds.filter((id) => id !== itemId);
  next.push(itemId);
  return next.slice(-MAX_EQUIPPED_ITEMS);
}

function saveCombos(combos) {
  writeJson(STORAGE_KEYS.combos, combos);
}

function loadCombos() {
  const defaults = getDefaultCombos();
  const saved = readJson(STORAGE_KEYS.combos, null);
  if (!Array.isArray(saved)) return defaults;
  const savedIds = new Set(saved.map((combo) => combo.id));
  return [
    ...saved,
    ...defaults.filter((combo) => !savedIds.has(combo.id))
  ];
}

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function isTypingTarget(target) {
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName);
}

function startClock(app, elements) {
  window.setInterval(() => {
    if (app.settings.mode === "free") {
      const finalized = finalizeFreeChain(app.session, performance.now());
      if (finalized !== app.session) {
        app.session = finalized;
        render(app, elements);
        return;
      }
    }
    renderCooldowns(app, elements);
    renderSessionTimer(app, elements);
  }, 100);
}
