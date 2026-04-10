import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Platform,
  Pressable,
  Text,
  Linking,
  Animated,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { DeviceMotion } from "expo-sensors";
import { colors } from "../theme/colors";
import locationBg from "../assets/MapsLondon.jpeg";

const LAT = 31.70075;
const LNG = -106.38848;

export default function LocationScreen() {
  const tabBarHeight = useBottomTabBarHeight();

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    DeviceMotion.setUpdateInterval(80);

    const sub = DeviceMotion.addListener((motion) => {
      const x = motion?.rotation?.beta ?? 0;  // inclinación adelante/atrás
      const y = motion?.rotation?.gamma ?? 0; // inclinación izquierda/derecha

      // limita el movimiento para que no se vea exagerado
      const moveX = Math.max(-18, Math.min(18, y * 18));
      const moveY = Math.max(-25, Math.min(25, x * 18));

      Animated.spring(translateX, {
        toValue: -moveX,
        useNativeDriver: true,
        speed: 20,
        bounciness: 6,
      }).start();

      Animated.spring(translateY, {
        toValue: -moveY,
        useNativeDriver: true,
        speed: 20,
        bounciness: 6,
      }).start();
    });

    return () => sub?.remove();
  }, [translateX, translateY]);

  const openMaps = () => {
    const label = "LondonCafe";
    const latlng = `${LAT},${LNG}`;

    const url =
      Platform.OS === "ios"
        ? `maps:0,0?q=${encodeURIComponent(label)}@${latlng}`
        : `geo:0,0?q=${latlng}(${encodeURIComponent(label)})`;

    const fallback = `https://www.google.com/maps/search/?api=1&query=${latlng}`;

    Linking.canOpenURL(url)
      .then((supported) => Linking.openURL(supported ? url : fallback))
      .catch(() => Linking.openURL(fallback));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.bg}>
        <Animated.Image
          source={locationBg}
          resizeMode="cover"
          style={[
            styles.bgImage,
            {
              transform: [
                { translateX },
                { translateY },
                { scale: 1.18 }, // la hacemos más grande para que haya “margen” al moverla
              ],
            },
          ]}
        />

        <View style={styles.overlay} />

        <Pressable
          onPress={openMaps}
          style={[styles.fab, { bottom: tabBarHeight + 16 }]}
        >
          <Text style={styles.fabText}>Abrir en Maps</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bg: {
    flex: 1,
    overflow: "hidden",
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  fab: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    zIndex: 10,
    elevation: 5,
  },
  fabText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
});