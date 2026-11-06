import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function loadFunction(source, name, context = {}) {
  const ast = ts.createSourceFile("screen.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(declaration, name);
  const code = ts.transpileModule(declaration.getText(ast), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText;
  return runInNewContext(`${code}\n${name}`, context);
}
const plain = value => JSON.parse(JSON.stringify(value));

for (const role of ["onsite-mechanic", "towing-company"]) {
  const source = readFileSync(new URL(`../app/(${role})/request-details.tsx`, import.meta.url), "utf8");
  test(`${role}: saved destination and provider marker coordinates survive overlay padding`, () => {
    const html = loadFunction(source, "mapHtml")(14.6, 121.1, 14.7, 121.2);
    const markers = [], lines = [], fits = [];
    const map = { setView() { return this; }, invalidateSize() {}, fitBounds(points, options) { fits.push(plain({ points, options })); } };
    const context = { window: {}, L: {
      map: () => map, tileLayer: () => ({ addTo() {} }), divIcon: value => value,
      marker: point => { markers.push(plain(point)); return { addTo() {} }; },
      polyline: points => { lines.push(plain(points)); return { addTo() {} }; },
    } };
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
    runInNewContext(script, context);
    assert.deepEqual(markers.sort(), [[14.6, 121.1], [14.7, 121.2]].sort());
    assert.deepEqual(lines, [[[14.7, 121.2], [14.6, 121.1]]]);
    context.window.setOverlayPadding(90, 420);
    assert.deepEqual(fits.at(-1).points, [[14.7, 121.2], [14.6, 121.1]]);
    assert.deepEqual(fits.at(-1).options.paddingTopLeft, [24, 90]);
    assert.deepEqual(fits.at(-1).options.paddingBottomRight, [24, 420]);
    assert.equal(fits.at(-1).options.animate, false);
    assert.equal(markers.length, 2);
  });

  test(`${role}: provider progress transitions and terminal guards`, () => {
    const next = loadFunction(source, "nextStatus");
    for (const [status, expected] of Object.entries({ accepted: "en_route", en_route: "arrived", arrived: "in_progress", in_progress: "completed" })) {
      assert.equal(next(status), expected);
      assert.ok(loadFunction(source, "actionLabel")(status));
    }
    for (const status of ["pending", "completed", "cancelled", "rejected"]) assert.equal(next(status), undefined);
  });

  test(`${role}: only handle captures dragging; scrolling, details and action stay separate`, () => {
    let gestures;
    const heights = [], values = [], springs = [];
    class Value {
      constructor(value) { this.value = value; values.push(this); }
      stopAnimation() {}
      setValue(value) { this.value = value; this.listener?.({ value }); }
      addListener(listener) { this.listener = listener; return 1; }
      removeListener() {}
    }
    const createElement = (type, props, ...children) => ({ type, props: props || {}, children });
    const component = loadFunction(source, "JobProgressSheet", {
      React: { createElement }, View: "View", Pressable: "Pressable", Text: "Text", ScrollView: "ScrollView",
      progressStyles: {}, useSafeAreaInsets: () => ({ top: 24, bottom: 20 }), useWindowDimensions: () => ({ height: 800 }),
      useRef: current => ({ current }), useCallback: callback => callback, useMemo: factory => factory(), useEffect: callback => callback(),
      Animated: { Value, View: "Animated.View", spring: (value, options) => { springs.push(options); return { start: callback => { value.setValue(options.toValue); callback({ finished: true }); } }; } },
      PanResponder: { create: callbacks => { gestures = callbacks; return { panHandlers: { handleDrag: true } }; } },
    });
    const details = () => {}, action = { originalAction: true };
    const tree = component({ children: "progress", action, onDetails: details, onHeightChange: height => heights.push(height) });
    assert.equal(tree.children[0].props.handleDrag, true);
    assert.equal(tree.children[1].type, "ScrollView");
    assert.equal(tree.children[1].props.handleDrag, undefined);
    assert.equal(tree.children[2].children[0].props.onPress, details);
    assert.equal(tree.children[2].children[1].children[0], action);
    assert.equal(gestures.onMoveShouldSetPanResponder(null, { dx: 20, dy: 3 }), false);
    assert.equal(gestures.onMoveShouldSetPanResponder(null, { dx: 1, dy: 10 }), true);
    gestures.onPanResponderGrant();
    gestures.onPanResponderMove(null, { dy: 9999 });
    assert.equal(values[0].value, 210);
    gestures.onPanResponderRelease(null, { dy: 9999, vy: 1 });
    assert.equal(heights.at(-1), 210);
    tree.props.onLayout({ nativeEvent: { layout: { height: 210.25 } } });
    assert.equal(heights.at(-1), 210.25);
    tree.children[0].children[0].props.onPress();
    assert.ok(Math.abs(heights.at(-1) - 464) < 0.001);
    assert.equal(springs.at(-1).useNativeDriver, false);
  });
}

test("mechanic without shared GPS keeps only the saved pickup marker", () => {
  const source = readFileSync(new URL("../app/(onsite-mechanic)/request-details.tsx", import.meta.url), "utf8");
  const html = loadFunction(source, "mapHtml")(14.6, 121.1);
  assert.equal((html.match(/L\.marker\(/g) || []).length, 1);
  assert.ok(html.includes("var c=[14.6,121.1]"));
});

test("towing switches to the saved destination only during towing", () => {
  const source = readFileSync(new URL("../app/(towing-company)/request-details.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("screen.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const expressions = {};
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ["headingToDestination", "targetLatitude", "targetLongitude"].includes(node.name.getText(ast))) {
      expressions[node.name.getText(ast)] = node.initializer.getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const booking = { latitude: 14.6, longitude: 121.1, destinationLatitude: 15.2, destinationLongitude: 120.9 };
  for (const status of ["accepted", "en_route", "arrived", "in_progress"]) {
    const result = runInNewContext(`const headingToDestination = ${expressions.headingToDestination}; [${expressions.targetLatitude}, ${expressions.targetLongitude}]`, { booking: { ...booking, status } });
    assert.deepEqual(plain(result), status === "in_progress" ? [15.2, 120.9] : [14.6, 121.1]);
  }
});
