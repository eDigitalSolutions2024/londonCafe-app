import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Platform,
  Pressable,
  Text,
  Linking,
  Animated,
  Dimensions,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { DeviceMotion } from "expo-sensors";
import { colors } from "../theme/colors";

const LAT = 31.70075;
const LNG = -106.38848;

const { width, height } = Dimensions.get("window");

export default function LocationScreen() {
  const tabBarHeight = useBottomTabBarHeight();

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    DeviceMotion.setUpdateInterval(120);

    const sub = DeviceMotion.addListener((motion) => {
      const beta = motion?.rotation?.beta;
      const gamma = motion?.rotation?.gamma;

      // si no vienen números válidos, no hacemos nada
      if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return;

      // movimiento mucho más suave y controlado
      const rawX = gamma * 10;
      const rawY = beta * 6;

      const moveX = Math.max(-22, Math.min(22, rawX));
      const moveY = Math.max(-12, Math.min(12, rawY));

      Animated.timing(translateX, {
        toValue: -moveX,
        duration: 120,
        useNativeDriver: true,
      }).start();

      Animated.timing(translateY, {
        toValue: -moveY,
        duration: 120,
        useNativeDriver: true,
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
          source={require("../assets/MapsLondon.jpeg")}
          resizeMode="cover"
          style={[
            styles.bgImage,
            {
              transform: [{ translateX }, { translateY }],
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
    backgroundColor: "#000",
  },
  bgImage: {
    position: "absolute",
    top: -30,
    left: -30,
    width: width + 140,
    height: height + 60,
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