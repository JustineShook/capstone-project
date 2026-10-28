import React from "react";
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

type Props = { value: string; onChange: (value: string) => void; placeholder: string; inputStyle?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle> };

function toInputDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : "";
}

export default function DateOfBirthInput({ value, onChange, placeholder, inputStyle, textStyle }: Props) {
  const today = new Date();
  const max = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const style = StyleSheet.flatten(inputStyle);
  const paddingHorizontal = Number(style?.paddingHorizontal ?? 13);
  const backgroundColor = String(style?.backgroundColor ?? "#202B32");
  const borderColor = String(style?.borderColor ?? "#354249");
  const color = String(StyleSheet.flatten(textStyle)?.color ?? "#F7F9FA");
  return (
    <div style={{ minHeight: 50, borderRadius: 10, padding: `0 ${paddingHorizontal}px`, background: backgroundColor, border: `1px solid ${borderColor}`, display: "flex", alignItems: "center" }}>
      <input
        aria-label="Date of birth"
        type="date"
        value={toInputDate(value)}
        max={max}
        onChange={(event) => {
          const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(event.currentTarget.value);
          if (match) onChange(`${match[2]}/${match[3]}/${match[1]}`);
        }}
        placeholder={placeholder}
        style={{ width: "100%", minWidth: 0, height: 46, border: 0, outline: 0, background: "transparent", color, font: "inherit", colorScheme: "dark" }}
      />
    </div>
  );
}
