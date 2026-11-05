import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import { Timestamp } from "firebase/firestore";

function load(relative, imports = {}) {
  const source = readFileSync(new URL(relative, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const module = { exports: {} };
  runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename: relative })((name) => {
    if (Object.hasOwn(imports, name)) return imports[name];
    if (name === "../types/demoSubscription") return {};
    throw new Error(`Unexpected import ${name}`);
  }, module, module.exports);
  return module.exports;
}

test("demo plan amounts and durations are fixed and expiry uses exact 30/365 day periods", () => {
  const { DEMO_SUBSCRIPTION_PLANS, demoExpiryDate } = load("../constants/demoSubscriptionPlans.ts");
  const startedAt = new Date("2026-11-02T00:00:00.000Z");
  assert.deepEqual(DEMO_SUBSCRIPTION_PLANS.monthly, { id: "monthly", label: "Monthly demo plan", amount: 100, durationDays: 30 });
  assert.deepEqual(DEMO_SUBSCRIPTION_PLANS.yearly, { id: "yearly", label: "Yearly demo plan", amount: 1000, durationDays: 365 });
  assert.equal(demoExpiryDate("monthly", startedAt).getTime() - startedAt.getTime(), 30 * 86400000);
  assert.equal(demoExpiryDate("yearly", startedAt).getTime() - startedAt.getTime(), 365 * 86400000);
});

function recoveryHarness({ subscribed = false, listing = true } = {}) {
  const uid = "subscription-provider";
  const accountPath = `users/${uid}`;
  const listingPath = `providerListings/${uid}`;
  const expiry = new Timestamp(Math.floor(Date.now() / 1000) + 30 * 86400, 123456789);
  const subscription = {
    status: "active", plan: "monthly", demoAmount: 100,
    startedAt: Timestamp.fromMillis(Date.now()), expiresAt: expiry, lastTransactionId: "existing-history",
  };
  const records = new Map([[accountPath, { uid, role: "towing-company", ...(subscribed ? { subscription } : {}) }]]);
  if (listing) records.set(listingPath, { providerId: uid, businessName: "Existing listing", availability: "available" });
  if (subscribed) records.set(`${accountPath}/demoSubscriptionTransactions/existing-history`, { transactionId: "existing-history", expiresAt: expiry });
  const auth = { currentUser: { uid } };
  const state = { records, auth, writes: [], allocatedIds: 0, denyMapWrite: false, denyActivation: false, deniedRead: null };
  const permissionError = () => Object.assign(new Error("Permission denied"), { code: "permission-denied" });
  const firestore = {
    Timestamp,
    collection: (_db, ...parts) => ({ path: parts.join("/") }),
    doc: (parent, ...parts) => {
      const path = parts.length ? parts.join("/") : `${parent.path}/generated-${++state.allocatedIds}`;
      return { path, id: path.split("/").at(-1) };
    },
    serverTimestamp: () => Timestamp.now(),
    updateDoc: async (ref, data) => {
      if (ref.path === listingPath && state.denyMapWrite) throw permissionError();
      records.set(ref.path, { ...records.get(ref.path), ...data });
      state.writes.push({ path: ref.path, data, update: true });
    },
    runTransaction: async (_db, action) => {
      const writes = [];
      const result = await action({
        get: async ref => {
          if (ref.path === state.deniedRead) throw permissionError();
          return { exists: () => records.has(ref.path), data: () => records.get(ref.path) };
        },
        update: (ref, data) => writes.push({ path: ref.path, data, update: true }),
        set: (ref, data) => writes.push({ path: ref.path, data, update: false }),
      });
      if (writes.some(write => (write.path === listingPath && state.denyMapWrite)
        || (write.path === accountPath && state.denyActivation))) throw permissionError();
      for (const write of writes) {
        records.set(write.path, write.update ? { ...records.get(write.path), ...write.data } : write.data);
        state.writes.push(write);
      }
      return result;
    },
  };
  const plans = load("../constants/demoSubscriptionPlans.ts");
  const service = load("../services/demoSubscriptionService.ts", {
    "firebase/firestore": firestore,
    "../constants/demoSubscriptionPlans": plans,
    "./firebase": { auth, db: {} },
  });
  return { ...service, state, uid, accountPath, listingPath, expiry };
}

test("failed post-activation map sync is recoverable without another activation or history row", async () => {
  const h = recoveryHarness();
  h.state.denyMapWrite = true;
  let committedExpiry;
  await assert.rejects(h.simulateDemoSubscriptionActivation("monthly"), error => {
    assert.ok(error instanceof h.DemoSubscriptionMapSyncError);
    assert.match(error.message, /Subscription activated, but map sync failed/);
    committedExpiry = error.expiresAt;
    return true;
  });
  const account = h.state.records.get(h.accountPath);
  assert.equal(committedExpiry.getTime(), account.subscription.expiresAt.toMillis());
  const before = new Map(h.state.records);
  const allocatedIds = h.state.allocatedIds;
  h.state.denyMapWrite = false;
  assert.equal(await h.syncMyDemoSubscriptionMapExpiry(), "synced");
  assert.equal(h.state.records.get(h.accountPath), account);
  assert.equal(h.state.allocatedIds, allocatedIds, "sync must not allocate a transaction/history ID");
  for (const [path, data] of before) if (path !== h.listingPath) assert.equal(h.state.records.get(path), data);
  assert.equal([...h.state.records.keys()].filter(path => path.includes("/demoSubscriptionTransactions/")).length, 1);
  assert.ok(h.state.records.get(h.listingPath).mapSubscriptionExpiresAt.isEqual(account.subscription.expiresAt));
  await assert.rejects(h.simulateDemoSubscriptionActivation("monthly"), /already active/);
});

test("successful activation preserves the Date API and handles missing listings; activation failure is distinct", async () => {
  assert.ok(await recoveryHarness().simulateDemoSubscriptionActivation("yearly") instanceof Date);
  const absent = recoveryHarness({ listing: false });
  assert.ok(await absent.simulateDemoSubscriptionActivation("monthly") instanceof Date);
  assert.equal(absent.state.records.has(absent.listingPath), false);
  const denied = recoveryHarness();
  denied.state.denyActivation = true;
  const before = new Map(denied.state.records);
  await assert.rejects(denied.simulateDemoSubscriptionActivation("monthly"), error => {
    assert.equal(error instanceof denied.DemoSubscriptionMapSyncError, false);
    return error.code === "permission-denied";
  });
  assert.deepEqual(denied.state.records, before, "activation failure must leave private subscription and history untouched");
});

test("repeated and concurrent sync retries copy the exact stored timestamp without changing dates or history", async () => {
  const h = recoveryHarness({ subscribed: true });
  const account = h.state.records.get(h.accountPath);
  const history = h.state.records.get(`${h.accountPath}/demoSubscriptionTransactions/existing-history`);
  assert.deepEqual(await Promise.all(Array.from({ length: 4 }, () => h.syncMyDemoSubscriptionMapExpiry())), Array(4).fill("synced"));
  const writes = h.state.writes.length;
  assert.equal(await h.syncMyDemoSubscriptionMapExpiry(), "synced");
  assert.equal(h.state.writes.length, writes, "already synced retry needs no write");
  assert.ok(h.state.writes.every(write => write.path === h.listingPath && Object.keys(write.data).join() === "mapSubscriptionExpiresAt"));
  assert.equal(h.state.records.get(h.accountPath), account);
  assert.equal(h.state.records.get(`${h.accountPath}/demoSubscriptionTransactions/existing-history`), history);
  assert.ok(h.state.records.get(h.listingPath).mapSubscriptionExpiresAt.isEqual(h.expiry), "nanosecond precision must survive copying");
  assert.equal(h.state.allocatedIds, 0);
});

test("retry with no listing does not create one or change private subscription/history", async () => {
  const h = recoveryHarness({ subscribed: true, listing: false });
  const before = new Map(h.state.records);
  assert.equal(await h.syncMyDemoSubscriptionMapExpiry(), "missing_listing");
  assert.deepEqual(h.state.records, before);
  assert.equal(h.state.writes.length, 0);
});

test("retry permission failures propagate and preserve subscription/history for a later successful retry", async () => {
  const h = recoveryHarness({ subscribed: true });
  const before = new Map(h.state.records);
  for (const deniedRead of [h.accountPath, h.listingPath]) {
    h.state.deniedRead = deniedRead;
    await assert.rejects(h.syncMyDemoSubscriptionMapExpiry(), { code: "permission-denied" });
    assert.deepEqual(h.state.records, before);
  }
  h.state.deniedRead = null;
  h.state.denyMapWrite = true;
  await assert.rejects(h.syncMyDemoSubscriptionMapExpiry(), { code: "permission-denied" });
  assert.deepEqual(h.state.records, before);
  h.state.denyMapWrite = false;
  assert.equal(await h.syncMyDemoSubscriptionMapExpiry(), "synced");
});

test("retry requires an existing subscription and authentication; expired dates are copied without renewal", async () => {
  const missing = recoveryHarness();
  await assert.rejects(missing.syncMyDemoSubscriptionMapExpiry(), /No existing demo subscription/);
  assert.equal(missing.state.writes.length, 0);
  missing.state.auth.currentUser = null;
  await assert.rejects(missing.syncMyDemoSubscriptionMapExpiry(), /sign in/);
  const expired = recoveryHarness({ subscribed: true });
  const account = expired.state.records.get(expired.accountPath);
  account.subscription.expiresAt = new Timestamp(1, 123456789);
  assert.equal(await expired.syncMyDemoSubscriptionMapExpiry(), "synced");
  assert.ok(expired.state.records.get(expired.listingPath).mapSubscriptionExpiresAt.isEqual(account.subscription.expiresAt));
  assert.equal(expired.state.allocatedIds, 0);
});

function cardFixture(overrides = {}) {
  const now = new Date();
  return {
    name: "Demo Provider", number: "1234567890123456",
    expiry: `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getFullYear() % 100).padStart(2, "0")}`,
    cvv: "123", ...overrides,
  };
}

function screenHarness() {
  const h = recoveryHarness();
  const hooks = [];
  let cursor = 0;
  const calls = { activations: 0, retries: 0, activationArgs: [] };
  const react = {
    useState: initial => {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], value => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }];
    },
    useRef: initial => {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = { current: initial };
      return hooks[index];
    },
    useEffect: () => {},
  };
  const jsx = (type, props) => ({ type, props });
  const { SubscriptionScreen, validateDemoCard } = load("../components/provider/SubscriptionScreen.tsx", {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": { ActivityIndicator: "ActivityIndicator", ScrollView: "ScrollView", Text: "Text", TextInput: "TextInput", Modal: "Modal",
      KeyboardAvoidingView: "KeyboardAvoidingView", Platform: { OS: "ios" },
      TouchableOpacity: "TouchableOpacity", View: "View", StyleSheet: { create: value => value } },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "@expo/vector-icons": { Feather: "Feather" },
    "../../constants/demoSubscriptionPlans": load("../constants/demoSubscriptionPlans.ts"),
    "../../services/demoSubscriptionService": {
      DemoSubscriptionMapSyncError: h.DemoSubscriptionMapSyncError,
      simulateDemoSubscriptionActivation: (...args) => { calls.activations++; calls.activationArgs.push(args); return h.simulateDemoSubscriptionActivation(...args); },
      syncMyDemoSubscriptionMapExpiry: () => { calls.retries++; return h.syncMyDemoSubscriptionMapExpiry(); },
      subscribeToMyDemoSubscription: () => () => {},
      subscribeToMyDemoSubscriptionHistory: () => () => {},
    },
  });
  const render = () => { cursor = 0; return SubscriptionScreen(); };
  const content = node => node == null || typeof node === "boolean" ? ""
    : Array.isArray(node) ? node.map(content).join("")
      : typeof node === "object" ? content(node.props?.children) : String(node);
  const button = (node, label) => {
    if (!node || typeof node !== "object") return undefined;
    if (Array.isArray(node)) return node.map(child => button(child, label)).find(Boolean);
    if (node.type === "TouchableOpacity" && content(node) === label) return node;
    return button(node.props?.children, label);
  };
  const settle = () => new Promise(resolve => setImmediate(resolve));
  const find = (node, predicate) => {
    if (!node || typeof node !== "object") return undefined;
    if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
    return predicate(node) ? node : find(node.props?.children, predicate);
  };
  const labels = { name: "Fictional cardholder name", number: "Demo card number", expiry: "Demo expiry", cvv: "Demo CVV" };
  const field = name => find(render(), node => node.type === "TextInput" && node.props.accessibilityLabel === labels[name]);
  const fillForm = (details = cardFixture()) => {
    for (const [name, value] of Object.entries(details)) field(name).props.onChangeText(value);
  };
  return { h, calls, render, content, button, settle, field, fillForm, validateDemoCard,
    modal: () => find(render(), node => node.type === "Modal") };
}

test("subscription screen distinguishes committed activation from failure and Retry Sync never calls activation", async () => {
  const { h, calls, render, content, button, settle, fillForm, modal, field } = screenHarness();

  h.state.denyActivation = true;
  button(render(), "Simulate Payment").props.onPress();
  fillForm();
  button(render(), "Confirm Demo Payment").props.onPress();
  await settle();
  assert.match(content(render()), /Activation failed: Permission denied/);
  assert.equal(button(render(), "Retry Sync"), undefined);

  h.state.denyActivation = false;
  h.state.denyMapWrite = true;
  const activate = button(render(), "Confirm Demo Payment").props.onPress;
  activate(); activate();
  await settle();
  assert.equal(calls.activations, 2, "one failed attempt and one committed activation, despite duplicate taps");
  assert.match(content(render()), /Subscription activated, but map sync failed/);
  assert.match(content(render()), /Demo activation recorded/);
  assert.doesNotMatch(content(render()), /Activation failed:/);
  assert.equal(modal(), undefined, "committed activation closes the form even when public sync fails");
  button(render(), "Simulate Payment").props.onPress();
  for (const name of ["name", "number", "expiry", "cvv"]) assert.equal(field(name).props.value, "");
  button(render(), "Cancel").props.onPress();

  button(render(), "Retry Sync").props.onPress();
  await settle();
  assert.match(content(render()), /Map sync failed. Your subscription and history are unchanged/);
  h.state.denyMapWrite = false;
  const retry = button(render(), "Retry Sync").props.onPress;
  retry(); retry();
  await settle();
  assert.equal(calls.retries, 2, "one denied retry and one recovery, despite duplicate taps");
  assert.equal(calls.activations, 2, "Retry Sync never invokes activation");
  assert.match(content(render()), /Map expiry synced. Your subscription dates and history are unchanged/);
  assert.equal([...h.state.records.keys()].filter(path => path.includes("/demoSubscriptionTransactions/")).length, 1);
});

test("demo card validation checks required fields and digit formats without real card verification", () => {
  const { validateDemoCard } = screenHarness();
  const now = new Date(2026, 10, 2);
  const valid = cardFixture({ expiry: "11/26" });
  assert.deepEqual(validateDemoCard(valid, now), {});
  assert.deepEqual(validateDemoCard({ ...valid, number: "1111111111111111", cvv: "000" }, now), {},
    "16 digits are sufficient; no Luhn, issuer or real CVV verification is performed");
  assert.deepEqual(Object.keys(validateDemoCard({ name: " ", number: "", expiry: "", cvv: "" }, now)).sort(),
    ["cvv", "expiry", "name", "number"]);
  for (const number of ["123456789012345", "12345678901234567", "123456789012345a", "1234 5678 9012 3456"]) {
    assert.ok(validateDemoCard({ ...valid, number }, now).number);
  }
  for (const cvv of ["12", "1234", "1a3"]) assert.ok(validateDemoCard({ ...valid, cvv }, now).cvv);
});

test("demo expiry accepts the current month through month end and rejects past or malformed months", () => {
  const { validateDemoCard } = screenHarness();
  const valid = cardFixture();
  const lastDay = new Date(2026, 10, 30, 23, 59, 59);
  assert.deepEqual(validateDemoCard({ ...valid, expiry: "11/26" }, lastDay), {});
  assert.deepEqual(validateDemoCard({ ...valid, expiry: "12/26" }, lastDay), {});
  for (const expiry of ["10/26", "11/25", "00/27", "13/27", "1/27", "11/2026", "aa/bb"]) {
    assert.ok(validateDemoCard({ ...valid, expiry }, lastDay).expiry);
  }
  assert.deepEqual(validateDemoCard({ ...valid, expiry: "01/27" }, new Date(2026, 11, 31)), {});
  assert.ok(validateDemoCard({ ...valid, expiry: "12/26" }, new Date(2027, 0, 1)).expiry);
});

test("invalid form submission never calls activation or writes subscription history", async () => {
  const { h, calls, render, content, button, fillForm, settle } = screenHarness();
  button(render(), "Simulate Payment").props.onPress();
  assert.equal(calls.activations, 0, "opening the form does not activate a subscription");
  button(render(), "Confirm Demo Payment").props.onPress();
  await settle();
  assert.match(content(render()), /fictional cardholder name/);
  assert.match(content(render()), /exactly 16 demo digits/);
  assert.match(content(render()), /MM\/YY/);
  assert.match(content(render()), /exactly 3 demo CVV digits/);
  for (const invalid of [{ number: "123" }, { expiry: "01/00" }, { cvv: "12" }, { name: " " }]) {
    fillForm(cardFixture(invalid));
    button(render(), "Confirm Demo Payment").props.onPress();
    await settle();
  }
  assert.equal(calls.activations, 0);
  assert.equal(h.state.writes.length, 0);
  assert.equal(h.state.allocatedIds, 0);
});

test("cancel and native close clear temporary card values and validation errors", () => {
  const { calls, render, button, fillForm, field, modal, content } = screenHarness();
  for (const close of [() => button(render(), "Cancel").props.onPress(), () => modal().props.onRequestClose()]) {
    button(render(), "Simulate Payment").props.onPress();
    fillForm(cardFixture({ number: "12" }));
    button(render(), "Confirm Demo Payment").props.onPress();
    assert.match(content(render()), /exactly 16 demo digits/);
    close();
    assert.equal(modal(), undefined);
    button(render(), "Simulate Payment").props.onPress();
    for (const name of ["name", "number", "expiry", "cvv"]) assert.equal(field(name).props.value, "");
    assert.doesNotMatch(content(render()), /Enter exactly/);
    button(render(), "Cancel").props.onPress();
  }
  assert.equal(calls.activations, 0);
});

test("successful demo form clears values and sends only the plan; card inputs never enter logs or Firestore writes", async (t) => {
  const logged = [];
  for (const method of ["log", "warn", "error", "info", "debug"]) t.mock.method(console, method, () => logged.push(method));
  const { h, calls, render, button, fillForm, field, modal, settle, content } = screenHarness();
  const card = cardFixture();
  button(render(), "Simulate Payment").props.onPress();
  assert.match(content(render()), /Format validation only; use fictional details/);
  fillForm(card);
  assert.equal(field("cvv").props.secureTextEntry, true);
  for (const name of ["name", "number", "expiry", "cvv"]) assert.equal(field(name).props.autoComplete, "off");
  const submit = button(render(), "Confirm Demo Payment").props.onPress;
  submit(); submit();
  await settle();
  assert.deepEqual(calls.activationArgs, [["monthly"]], "no card arguments reach the activation service");
  assert.equal(modal(), undefined);
  assert.equal(logged.length, 0);
  assert.equal([...h.state.records.keys()].filter(path => path.includes("/demoSubscriptionTransactions/")).length, 1);
  const allowedFields = new Set(["subscription", "status", "plan", "demoAmount", "startedAt", "expiresAt", "lastTransactionId",
    "providerId", "transactionId", "durationDays", "type", "createdAt", "label", "mapSubscriptionExpiresAt"]);
  function checkPayload(value) {
    if (!value || typeof value !== "object" || value instanceof Timestamp) return;
    for (const [key, nested] of Object.entries(value)) { assert.ok(allowedFields.has(key), `unexpected persisted field ${key}`); checkPayload(nested); }
  }
  for (const write of h.state.writes) checkPayload(write.data);
  assert.equal(JSON.stringify(h.state.writes).includes(card.number), false);
  button(render(), "Simulate Payment").props.onPress();
  for (const name of ["name", "number", "expiry", "cvv"]) assert.equal(field(name).props.value, "");
  button(render(), "Cancel").props.onPress();
});
