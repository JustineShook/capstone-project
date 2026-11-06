import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";

const DEFAULT_BRAND_COLOR = "#3B507D";

export function useBrandColor() {
  const [color, setColor] = useState(DEFAULT_BRAND_COLOR);

  useEffect(() => onSnapshot(doc(db, "appSettings", "branding"), snapshot => {
    const value = snapshot.data()?.brandColor;
    if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) setColor(value);
  }, () => setColor(DEFAULT_BRAND_COLOR)), []);

  return color;
}
