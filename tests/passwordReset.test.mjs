import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";

function load(path, imports) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const module = { exports: {} };
  runInThisContext(`(function(require, module, exports) { ${outputText}\n})`)((name) => {
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error(`Unexpected import: ${name}`);
  }, module, module.exports);
  return module.exports;
}

function authHarness() {
  const state = { calls: [], error: null };
  const auth = {};
  state.service = load("../services/auth.ts", {
    "firebase/auth": {
      sendPasswordResetEmail: async (...args) => {
        state.calls.push(args);
        if (state.error) throw state.error;
      },
    },
    "firebase/firestore": {},
    "./firebase": { auth, db: {} },
  });
  state.auth = auth;
  return state;
}

function screenHarness(resetPassword, canGoBack = true) {
  const slots = [];
  let cursor = 0;
  const navigation = [];
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const react = {
    useState: initial => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = value; }];
    },
    useRef: initial => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
  };
  const Screen = load("../app/(auth)/forgot-password.tsx", {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "expo-router": { useRouter: () => ({ canGoBack: () => canGoBack, back: () => navigation.push("back"), replace: path => navigation.push(path) }) },
    "react-native": {
      ...Object.fromEntries(["ActivityIndicator", "KeyboardAvoidingView", "Text", "TextInput", "TouchableOpacity", "View"].map(name => [name, name])),
      Platform: { OS: "web" }, StyleSheet: { create: styles => styles },
    },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "../../services/auth": { resetPassword },
  }).default;
  function render() {
    cursor = 0;
    const nodes = [];
    function visit(node) {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== "object") return;
      nodes.push(node);
      visit(node.props.children);
    }
    visit(Screen());
    return nodes;
  }
  const button = () => render().filter(node => node.type === "TouchableOpacity").at(-1);
  return {
    render, button, navigation,
    email: value => render().find(node => node.type === "TextInput").props.onChangeText(value),
    text: () => render().filter(node => node.type === "Text").map(node => node.props.children),
  };
}

test("reset service sends only trimmed email to mocked Firebase; missing accounts are neutral", async () => {
  const h = authHarness();
  await h.service.resetPassword("  member@example.com  ");
  assert.deepEqual(h.calls, [[h.auth, "member@example.com"]]);
  h.error = { code: "auth/user-not-found" };
  await h.service.resetPassword("unknown@example.com");
});

test("reset service preserves friendly errors without changing login error mapping", async () => {
  const h = authHarness();
  for (const [code, message] of [
    ["auth/network-request-failed", /Network error/],
    ["auth/too-many-requests", /Too many attempts/],
    ["auth/invalid-email", /doesn't look valid/],
  ]) {
    h.error = { code };
    await assert.rejects(h.service.resetPassword("member@example.com"), message);
  }
  assert.match(new h.service.AuthServiceError({ code: "auth/user-not-found" }).message, /Incorrect email or password/);
});

test("empty and malformed email never invoke reset", async () => {
  let calls = 0;
  const h = screenHarness(async () => { calls++; });
  for (const email of ["", "   ", "member", "member@", "a b@example.com"]) {
    h.email(email);
    await h.button().props.onPress();
    assert.ok(h.render().some(node => node.props.accessibilityRole === "alert"));
  }
  assert.equal(calls, 0);
});

test("same-render duplicate taps send once, show loading, then neutral confirmation", async () => {
  let finish;
  const calls = [];
  const h = screenHarness(email => { calls.push(email); return new Promise(resolve => { finish = resolve; }); });
  h.email("  member@example.com  ");
  const submit = h.button().props.onPress;
  const pending = submit();
  await submit();
  assert.deepEqual(calls, ["member@example.com"]);
  assert.equal(h.button().props.disabled, true);
  assert.equal(h.render().find(node => node.type === "TextInput").props.editable, false);
  assert.ok(h.render().some(node => node.type === "ActivityIndicator"));
  finish();
  await pending;
  assert.ok(h.text().includes("If an account exists for this email, you’ll receive a password reset link."));
  assert.equal(h.render().some(node => node.type === "TextInput"), false);
  h.button().props.onPress();
  assert.deepEqual(h.navigation, ["back"]);
});

test("failure restores controls, allows retry, and direct entry returns to login", async () => {
  let calls = 0;
  const h = screenHarness(async () => { if (++calls === 1) throw new Error("Network error. Check your connection and try again."); }, false);
  h.email("member@example.com");
  await h.button().props.onPress();
  assert.ok(h.text().includes("Network error. Check your connection and try again."));
  assert.equal(h.button().props.disabled, false);
  await h.button().props.onPress();
  assert.equal(calls, 2);
  assert.equal(h.render().some(node => node.props.accessibilityRole === "alert"), false);
  h.button().props.onPress();
  assert.deepEqual(h.navigation, ["/(auth)/login"]);
});
