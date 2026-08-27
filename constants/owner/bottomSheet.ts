// constants/bottomSheet.ts
import { Dimensions } from "react-native";

// ---------------------------------------------------------------------------
// BOTTOM SHEET SNAP POINTS (computed from real screen height)
// ---------------------------------------------------------------------------
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export const SHEET_COLLAPSED = Math.round(SCREEN_HEIGHT * 0.22); // handle + towing button peek
export const SHEET_MID = Math.round(SCREEN_HEIGHT * 0.48); // default resting height
export const SHEET_EXPANDED = Math.round(SCREEN_HEIGHT * 0.86); // full listings view
export const SNAP_POINTS = [SHEET_COLLAPSED, SHEET_MID, SHEET_EXPANDED];

export function nearestSnapPoint(value: number) {
  return SNAP_POINTS.reduce((closest, point) =>
    Math.abs(point - value) < Math.abs(closest - value) ? point : closest
  );
}