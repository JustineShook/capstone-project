import React, { forwardRef, useImperativeHandle, useRef } from "react";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import type { StyleProp, ViewStyle } from "react-native";

export type MapHtmlMessageEvent = { nativeEvent: { data: string } };
export type MapHtmlSurfaceHandle = { injectJavaScript: (script: string) => void };

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

const MapHtmlSurface = forwardRef<MapHtmlSurfaceHandle, Props>(function MapHtmlSurface(
  { sourceHtml, style, scrollEnabled = false, nestedScrollEnabled, startInLoadingState, overScrollMode, accessibilityLabel, onMessage, onLoadEnd, onTouchStart, onTouchEnd, onTouchCancel },
  forwardedRef,
) {
  const webViewRef = useRef<WebView>(null);
  useImperativeHandle(forwardedRef, () => ({
    injectJavaScript: (script) => webViewRef.current?.injectJavaScript(script),
  }), []);

  return (
    <WebView
      ref={webViewRef}
      source={{ html: sourceHtml }}
      style={style}
      scrollEnabled={scrollEnabled}
      nestedScrollEnabled={nestedScrollEnabled}
      startInLoadingState={startInLoadingState}
      overScrollMode={overScrollMode}
      accessibilityLabel={accessibilityLabel}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={["*"]}
      onMessage={(event: WebViewMessageEvent) => onMessage?.(event)}
      onLoadEnd={onLoadEnd}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    />
  );
});

export default MapHtmlSurface;
