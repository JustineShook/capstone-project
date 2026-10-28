import React, { useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Platform, Text, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

type Props = { value: string; onChange: (value: string) => void; placeholder: string; inputStyle?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle> };

export default function DateOfBirthInput({ value, onChange, placeholder, inputStyle, textStyle }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <TouchableOpacity style={inputStyle} onPress={() => setVisible(true)}>
        <Text style={textStyle}>{value || placeholder}</Text>
      </TouchableOpacity>
      {visible && <DateTimePicker
        value={value ? new Date(`${value}T12:00:00`) : new Date(2000, 0, 1)}
        mode="date"
        display={Platform.OS === "ios" ? "spinner" : "default"}
        maximumDate={new Date()}
        onChange={(_event: unknown, date?: Date) => {
          if (Platform.OS !== "ios") setVisible(false);
          if (date) onChange(`${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`);
        }}
      />}
      {Platform.OS === "ios" && visible && <TouchableOpacity onPress={() => setVisible(false)}><Text style={{ color: "#F51F3B" }}>Done</Text></TouchableOpacity>}
    </View>
  );
}
