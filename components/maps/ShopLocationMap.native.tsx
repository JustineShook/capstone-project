import React from "react";
import MapView, { Marker, type Region } from "react-native-maps";
import type { StyleProp, ViewStyle } from "react-native";

type Coordinate = { latitude: number; longitude: number };
type Props = { style?: StyleProp<ViewStyle>; region: Region; pin: Coordinate | null; onSelect: (point: Coordinate) => void };

export default function ShopLocationMap({ style, region, pin, onSelect }: Props) {
  return (
    <MapView
      style={style}
      region={region}
      onPress={(event) => onSelect({ latitude: event.nativeEvent.coordinate.latitude, longitude: event.nativeEvent.coordinate.longitude })}
    >
      <Marker coordinate={pin ?? { latitude: region.latitude, longitude: region.longitude }} pinColor="#F51F3B" />
    </MapView>
  );
}
