import React from "react";
import { Image, View, StyleSheet } from "react-native";

interface QRCodeProps {
  value: string;
  size?: number;
  backgroundColor?: string;
  testID?: string;
}

function QRCodeComponent({ value, size = 200, backgroundColor = "#FFFFFF", testID }: QRCodeProps) {
  const encoded = encodeURIComponent(value);
  const uri = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=8&bgcolor=${backgroundColor.replace("#", "")}`;

  return (
    <View
      style={[styles.wrap, { width: size, height: size, backgroundColor }]}
      testID={testID ?? "qr-code"}
    >
      <Image
        source={{ uri }}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    overflow: "hidden",
  },
});

export default React.memo(QRCodeComponent);
