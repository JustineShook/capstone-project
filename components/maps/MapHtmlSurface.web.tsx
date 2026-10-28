import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import type { MapHtmlMessageEvent, MapHtmlSurfaceHandle } from "./MapHtmlSurface.native";

type Props = {
  sourceHtml: string;
  style?: StyleProp<ViewStyle>;
  scrollEnabled?: boolean;
  nestedScrollEnabled?: boolean;
  startInLoadingState?: boolean;
  overScrollMode?: "always" | "content" | "never";
  accessibilityLabel?: string;
  onMessage?: (event: MapHtmlMessageEvent) => void;
  onLoadEnd?: () => void;
  onTouchStart?: () => void;
  onTouchEnd?: () => void;
  onTouchCancel?: () => void;
};
type EvalWindow = Window & { eval: (script: string) => unknown };

function prepareHtml(html: string) {
  const bridge = `<script>(function(){window.ReactNativeWebView=window.ReactNativeWebView||{};window.ReactNativeWebView.postMessage=function(data){parent.postMessage({__verescMapBridge:true,payload:String(data)},'*');};document.addEventListener('touchstart',function(){parent.postMessage({__verescMapBridge:true,__verescMapTouch:'start'},'*');},{passive:true});document.addEventListener('touchend',function(){parent.postMessage({__verescMapBridge:true,__verescMapTouch:'end'},'*');},{passive:true});document.addEventListener('touchcancel',function(){parent.postMessage({__verescMapBridge:true,__verescMapTouch:'cancel'},'*');},{passive:true});})();</script>`;
  let prepared = html
    .replace(/L\.tileLayer\(['"]https:\/\/\{s\}\.tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png['"],\s*\{/g,
      "L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors',")
    .replace(/\.leaflet-control-attribution\s*\{\s*display:\s*none\s*!important;?\s*\}/g, "")
    .replace(/attributionControl:\s*false/g, "attributionControl: true");
  const bodyOpen = /<body[^>]*>/i;
  prepared = bodyOpen.test(prepared) ? prepared.replace(bodyOpen, (tag) => `${tag}${bridge}`) : `${bridge}${prepared}`;
  return prepared;
}

const MapHtmlSurface = forwardRef<MapHtmlSurfaceHandle, Props>(function MapHtmlSurface(
  { sourceHtml, style, accessibilityLabel, onMessage, onLoadEnd, onTouchStart, onTouchEnd, onTouchCancel },
  forwardedRef,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isMapReady = useRef(false);
  const pendingScripts = useRef<string[]>([]);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onLoadEndRef = useRef(onLoadEnd);
  onLoadEndRef.current = onLoadEnd;
  const onTouchStartRef = useRef(onTouchStart);
  onTouchStartRef.current = onTouchStart;
  const onTouchEndRef = useRef(onTouchEnd);
  onTouchEndRef.current = onTouchEnd;
  const onTouchCancelRef = useRef(onTouchCancel);
  onTouchCancelRef.current = onTouchCancel;

  // `contentWindow` can point at the iframe's initial about:blank document,
  // whose readyState is already "complete" before srcDoc has initialized the
  // Leaflet map. Wait for the iframe load event before running map commands.
  useLayoutEffect(() => {
    isMapReady.current = false;
  }, [sourceHtml]);

  useImperativeHandle(forwardedRef, () => ({
    injectJavaScript: (script) => {
      const win = iframeRef.current?.contentWindow as EvalWindow | null;
      if (win && isMapReady.current) {
        try {
          win.eval(script);
        } catch (error) {
          console.error("Map command failed", error);
        }
      } else {
        pendingScripts.current.push(script);
      }
    },
  }), []);

  const handleLoad = useCallback(() => {
    const win = iframeRef.current?.contentWindow as EvalWindow | null;
    isMapReady.current = Boolean(win);
    const scripts = pendingScripts.current.splice(0);
    if (win) {
      for (const script of scripts) {
        try {
          win.eval(script);
        } catch (error) {
          console.error("Map command failed", error);
        }
      }
    }
    onLoadEndRef.current?.();
  }, []);

  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || !event.data?.__verescMapBridge) return;
      if (event.data.__verescMapTouch === "start") onTouchStartRef.current?.();
      else if (event.data.__verescMapTouch === "end") onTouchEndRef.current?.();
      else if (event.data.__verescMapTouch === "cancel") onTouchCancelRef.current?.();
      else onMessageRef.current?.({ nativeEvent: { data: String(event.data.payload ?? "") } });
    };
    window.addEventListener("message", handleWindowMessage);
    return () => window.removeEventListener("message", handleWindowMessage);
  }, []);

  return (
    <View style={[{ overflow: "hidden" }, style]}>
      <iframe
        ref={iframeRef}
        title={accessibilityLabel ?? "Interactive map"}
        srcDoc={prepareHtml(sourceHtml)}
        onLoad={handleLoad}
        sandbox="allow-scripts allow-same-origin"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, display: "block" }}
      />
    </View>
  );
});

export default MapHtmlSurface;
