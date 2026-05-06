import assert from "node:assert/strict";

import {
  applyPracticeKey,
  castSpell,
  endFreeRun,
  finalizeFreeChain,
  createInvokerState,
  createPracticeSession,
  getInvokeCooldown,
  invokeSpell,
  makeKeyBindings,
  pushOrb,
  refreshCooldowns,
  setBindingAtPath,
  spellFromOrbs
} from "../app.js";
import { ITEMS } from "../data/items.js";
import { SPELLS } from "../data/spells.js";

const spell = (id) => SPELLS.find((entry) => entry.id === id);
const item = (id) => ITEMS.find((entry) => entry.id === id);

function press(session, code, now = 0) {
  const outcome = applyPracticeKey(session, code, now);
  return outcome.session;
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("orb buffer keeps only the newest three orbs", () => {
  assert.deepEqual(pushOrb([], "quas"), ["quas"]);
  assert.deepEqual(pushOrb(["quas", "wex", "exort"], "quas"), ["wex", "exort", "quas"]);
});

test("spell lookup treats orb order as irrelevant", () => {
  assert.equal(spellFromOrbs(SPELLS, ["wex", "quas", "wex"])?.id, "tornado");
  assert.equal(spellFromOrbs(SPELLS, ["exort", "quas", "wex"])?.id, "deafening_blast");
  assert.equal(spellFromOrbs(SPELLS, ["quas", "quas"])?.id, undefined);
});

test("invoke cooldown follows the official 7s minus 0.3s per total orb level rule", () => {
  assert.equal(getInvokeCooldown(0), 7);
  assert.equal(getInvokeCooldown(1), 6.7);
  assert.equal(getInvokeCooldown(3), 6.1);
  assert.equal(getInvokeCooldown(21), 0.7);
});

test("invoke slot rotation matches Dota behavior and reinvoking an active spell is free", () => {
  let state = createInvokerState({ totalOrbLevel: 3 });

  let result = invokeSpell(state, "tornado", 0);
  state = result.state;
  assert.equal(result.consumedCooldown, true);
  assert.equal(state.slots.primary, "tornado");
  assert.equal(state.slots.secondary, null);
  assert.equal(state.invokeReadyAt, 6100);

  result = invokeSpell(state, "emp", 7000);
  state = result.state;
  assert.equal(state.slots.primary, "emp");
  assert.equal(state.slots.secondary, "tornado");

  result = invokeSpell(state, "chaos_meteor", 14000);
  state = result.state;
  assert.equal(state.slots.primary, "chaos_meteor");
  assert.equal(state.slots.secondary, "emp");

  result = invokeSpell(state, "emp", 21000);
  state = result.state;
  assert.equal(result.consumedCooldown, false);
  assert.equal(state.slots.primary, "emp");
  assert.equal(state.slots.secondary, "chaos_meteor");
  assert.equal(state.invokeReadyAt, 20100);
});

test("casting a spell starts its own cooldown", () => {
  let state = createInvokerState({ totalOrbLevel: 3 });
  state = invokeSpell(state, "cold_snap", 0).state;

  const cast = castSpell(state, spell("cold_snap"), "primary", 100);
  assert.equal(cast.ok, true);
  assert.equal(cast.state.spellCooldowns.cold_snap, 18100);

  const blocked = castSpell(cast.state, spell("cold_snap"), "primary", 1000);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "spell-cooldown");
});

test("random simple mode completes a target after the requested orb combo", () => {
  let session = createPracticeSession({
    keyBindings: makeKeyBindings("modern"),
    mode: "random",
    requireInvokeCast: false,
    targets: [{ type: "spell", id: "cold_snap" }]
  });

  session = press(session, "KeyQ");
  session = press(session, "KeyQ");
  const outcome = applyPracticeKey(session, "KeyQ");
  assert.equal(outcome.result.targetCompleted, true);
  assert.equal(outcome.session.currentIndex, 1);
  assert.equal(outcome.session.completed[0].status, "success");
});

test("random mode keeps a failed target in history and advances", () => {
  const session = createPracticeSession({
    keyBindings: makeKeyBindings("modern"),
    mode: "random",
    requireInvokeCast: true,
    targets: [
      { type: "spell", id: "cold_snap" },
      { type: "spell", id: "tornado" }
    ]
  });

  const outcome = applyPracticeKey(session, "KeyD");
  assert.equal(outcome.result.targetFailed, true);
  assert.equal(outcome.session.currentIndex, 1);
  assert.equal(outcome.session.completed[0].id, "cold_snap");
  assert.equal(outcome.session.completed[0].status, "fail");
});

test("random full mode does not fail the next target while entering orbs", () => {
  let session = createPracticeSession({
    keyBindings: makeKeyBindings("modern"),
    mode: "random",
    requireInvokeCast: true,
    targets: [
      { type: "spell", id: "cold_snap" },
      { type: "spell", id: "tornado" }
    ]
  });

  session = press(session, "KeyQ", 0);
  session = press(session, "KeyQ", 0);
  session = press(session, "KeyQ", 0);
  session = press(session, "KeyR", 0);

  let outcome = applyPracticeKey(session, "KeyD", 0);
  assert.equal(outcome.result.targetCompleted, true);
  session = outcome.session;

  outcome = applyPracticeKey(session, "KeyQ", 100);
  assert.equal(outcome.result.targetFailed, undefined);
  assert.equal(outcome.session.currentIndex, 1);

  outcome = applyPracticeKey(outcome.session, "KeyW", 200);
  assert.equal(outcome.result.targetFailed, undefined);
  assert.equal(outcome.session.currentIndex, 1);
});

test("full practice mode requires orbs, invoke, then the active cast key", () => {
  let session = createPracticeSession({
    keyBindings: makeKeyBindings("modern"),
    mode: "combo",
    requireInvokeCast: true,
    targets: [{ type: "spell", id: "deafening_blast" }]
  });

  session = press(session, "KeyQ");
  session = press(session, "KeyW");
  session = press(session, "KeyE");

  let outcome = applyPracticeKey(session, "KeyR", 0);
  assert.equal(outcome.result.targetCompleted, false);
  session = outcome.session;

  outcome = applyPracticeKey(session, "KeyD", 0);
  assert.equal(outcome.result.targetCompleted, true);
  assert.equal(outcome.session.currentIndex, 1);
});

test("combo and real modes track combo time from first release key to final release key", () => {
  let session = createPracticeSession({
    keyBindings: makeKeyBindings("modern"),
    mode: "combo",
    requireInvokeCast: true,
    targets: [
      { type: "spell", id: "cold_snap" },
      { type: "spell", id: "tornado" }
    ]
  });

  session = press(session, "KeyQ", 100);
  session = press(session, "KeyQ", 200);
  session = press(session, "KeyQ", 300);
  session = press(session, "KeyR", 400);
  session = press(session, "KeyD", 500);

  session = press(session, "KeyQ", 600);
  session = press(session, "KeyW", 700);
  session = press(session, "KeyW", 800);
  session = press(session, "KeyR", 850);

  const outcome = applyPracticeKey(session, "KeyD", 900);
  assert.equal(outcome.result.targetCompleted, true);
  assert.equal(outcome.session.comboTimer.startedAt, null);
  assert.equal(outcome.session.comboTimer.lastCompletedMs, 400);
});

test("random mode timer starts after first valid key", () => {
  let session = createPracticeSession({
    keyBindings: makeKeyBindings("modern"),
    mode: "random",
    requireInvokeCast: true,
    targets: [{ type: "spell", id: "cold_snap" }]
  });

  assert.equal(session.comboTimer.startedAt, null);
  session = press(session, "KeyQ", 120);
  assert.equal(session.comboTimer.startedAt, 120);
});

test("real mode blocks repeated spell casts until cooldown expires", () => {
  let session = createPracticeSession({
    keyBindings: makeKeyBindings("modern"),
    mode: "real",
    requireInvokeCast: true,
    targets: [
      { type: "spell", id: "tornado" },
      { type: "spell", id: "tornado" }
    ],
    totalOrbLevel: 3
  });

  session = press(session, "KeyQ", 0);
  session = press(session, "KeyW", 0);
  session = press(session, "KeyW", 0);
  session = press(session, "KeyR", 0);

  let outcome = applyPracticeKey(session, "KeyD", 0);
  assert.equal(outcome.result.targetCompleted, true);
  session = outcome.session;

  outcome = applyPracticeKey(session, "KeyD", 1000);
  assert.equal(outcome.result.ok, false);
  assert.equal(outcome.result.reason, "spell-cooldown");

  outcome = applyPracticeKey(outcome.session, "KeyD", 28000);
  assert.equal(outcome.result.targetCompleted, true);
  assert.equal(outcome.session.currentIndex, 2);
});

test("real mode blocks repeated item casts until cooldown expires", () => {
  assert.equal(item("blink").cooldown, 15);

  let session = createPracticeSession({
    keyBindings: makeKeyBindings("modern"),
    mode: "real",
    requireInvokeCast: true,
    targets: [
      { type: "item", id: "blink" },
      { type: "item", id: "blink" }
    ]
  });

  let outcome = applyPracticeKey(session, "Digit1", 0);
  assert.equal(outcome.result.targetCompleted, true);

  outcome = applyPracticeKey(outcome.session, "Digit1", 1000);
  assert.equal(outcome.result.ok, false);
  assert.equal(outcome.result.reason, "item-cooldown");

  outcome = applyPracticeKey(outcome.session, "Digit1", 15000);
  assert.equal(outcome.result.targetCompleted, true);
});

test("item keys only work for equipped items", () => {
  let session = createPracticeSession({
    keyBindings: makeKeyBindings("modern"),
    mode: "real",
    requireInvokeCast: true,
    equippedItemIds: ["blink"],
    targets: [{ type: "item", id: "cyclone" }]
  });

  let outcome = applyPracticeKey(session, "Digit2", 0);
  assert.equal(outcome.result.ok, false);
  assert.equal(outcome.result.reason, "unmapped-key");
  assert.equal(outcome.session.currentIndex, 0);

  session = createPracticeSession({
    keyBindings: makeKeyBindings("modern"),
    mode: "real",
    requireInvokeCast: true,
    equippedItemIds: ["cyclone"],
    targets: [{ type: "item", id: "cyclone" }]
  });

  outcome = applyPracticeKey(session, "Digit2", 0);
  assert.equal(outcome.result.targetCompleted, true);
});

test("equipped item ids default to six slots and include refresher", () => {
  const session = createPracticeSession({
    keyBindings: makeKeyBindings("modern"),
    mode: "free"
  });

  assert.equal(session.equippedItemIds.length, 6);
  assert.equal(session.equippedItemIds.includes("refresher"), true);
});

test("equipped item ids are clamped to six when input has overflow", () => {
  const session = createPracticeSession({
    keyBindings: makeKeyBindings("modern"),
    mode: "free",
    equippedItemIds: ITEMS.map((entry) => entry.id)
  });

  assert.equal(session.equippedItemIds.length, 6);
});

test("item key rebinding keeps new key and clears previous owner", () => {
  const bindings = makeKeyBindings("modern");
  assert.equal(bindings.items.blink, "Digit1");
  assert.equal(bindings.items.cyclone, "Digit2");

  setBindingAtPath(bindings, "items.cyclone", "Digit1");

  assert.equal(bindings.items.cyclone, "Digit1");
  assert.equal(bindings.items.blink, "");
});

test("refresher orb resets spell and item cooldowns but keeps its own cooldown", () => {
  let session = createPracticeSession({
    keyBindings: makeKeyBindings("modern"),
    mode: "real",
    requireInvokeCast: true,
    targets: [
      { type: "item", id: "blink" },
      { type: "item", id: "refresher" },
      { type: "item", id: "blink" }
    ]
  });

  let outcome = applyPracticeKey(session, "Digit1", 0);
  assert.equal(outcome.result.targetCompleted, true);
  assert.equal(outcome.session.invoker.itemCooldowns.blink, 15000);

  outcome = applyPracticeKey(outcome.session, "Digit7", 1000);
  assert.equal(outcome.result.targetCompleted, true);
  assert.equal(outcome.session.invoker.itemCooldowns.blink, undefined);
  assert.equal(outcome.session.invoker.itemCooldowns.refresher, 181000);

  outcome = applyPracticeKey(outcome.session, "Digit1", 2000);
  assert.equal(outcome.result.targetCompleted, true);
});

test("manual refresh button clears real cooldowns without changing slots or orbs", () => {
  let state = createInvokerState({ totalOrbLevel: 3, orbs: ["quas", "wex", "exort"] });
  state = invokeSpell(state, "deafening_blast", 0).state;
  state = castSpell(state, spell("deafening_blast"), "primary", 100).state;
  state.itemCooldowns.blink = 15000;

  const refreshed = refreshCooldowns(state);
  assert.deepEqual(refreshed.orbs, ["quas", "wex", "exort"]);
  assert.equal(refreshed.slots.primary, "deafening_blast");
  assert.deepEqual(refreshed.spellCooldowns, {});
  assert.deepEqual(refreshed.itemCooldowns, {});
  assert.equal(refreshed.invokeReadyAt, 0);
});

test("free mode records successful casts and splits rows after a five second gap", () => {
  let session = createPracticeSession({
    keyBindings: makeKeyBindings("modern"),
    mode: "free",
    totalOrbLevel: 21
  });

  session = press(session, "KeyQ", 0);
  session = press(session, "KeyW", 0);
  session = press(session, "KeyW", 0);
  session = press(session, "KeyR", 0);

  let outcome = applyPracticeKey(session, "KeyD", 100);
  assert.equal(outcome.result.freeStepRecorded, true);
  assert.equal(outcome.session.free.activeSteps.length, 1);
  assert.equal(outcome.session.free.activeSteps[0].id, "tornado");

  session = press(outcome.session, "Digit1", 3000);
  assert.equal(session.free.activeSteps.length, 2);
  assert.equal(session.free.history.length, 0);

  session = finalizeFreeChain(session, 8101);
  assert.equal(session.free.activeSteps.length, 0);
  assert.equal(session.free.history.length, 1);
  assert.deepEqual(session.free.history[0].steps.map((step) => step.id), ["tornado", "blink"]);
});

test("free mode end action settles total and average timing", () => {
  let session = createPracticeSession({
    keyBindings: makeKeyBindings("modern"),
    mode: "free",
    totalOrbLevel: 21
  });

  session = press(session, "KeyQ", 0);
  session = press(session, "KeyW", 0);
  session = press(session, "KeyW", 0);
  session = press(session, "KeyR", 0);
  session = applyPracticeKey(session, "KeyD", 100).session;
  session = applyPracticeKey(session, "Digit1", 3100).session;

  const ended = endFreeRun(session, 5100);
  assert.equal(ended.free.activeSteps.length, 0);
  assert.equal(ended.free.history.length, 1);
  assert.equal(ended.free.summary.steps, 2);
  assert.equal(ended.free.summary.totalMs, 5000);
  assert.equal(ended.free.summary.averageMs, 2500);
});

console.log("All tests passed.");
