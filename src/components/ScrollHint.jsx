import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { colors } from "../theme/colors";

// Aviso de "hay más abajo" para la pantalla principal: degradado oscuro en
// la orilla de abajo + "Desliza para ver más ⌄" rebotando suave.
// - Solo aparece si el contenido de verdad no cabe en la pantalla.
// - Se desvanece en cuanto la persona baja un poco.
// - Después de que la persona ya bajó SEEN_LIMIT veces (en distintas
//   aperturas), ya no vuelve a salir: quien ya sabe que hay más no lo
//   necesita.
const STORAGE_KEY = "home_scroll_hint_scrolls";
const SEEN_LIMIT = 3;
const HIDE_AFTER_Y = 40;

export function useScrollHint() {
  const { height: windowHeight } = useWindowDimensions();
  const [enabled, setEnabled] = useState(false);
  const [layoutH, setLayoutH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const countedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => alive && setEnabled(Number(v || 0) < SEEN_LIMIT))
      .catch(() => alive && setEnabled(true));
    return () => {
      alive = false;
    };
  }, []);

  const onScroll = useCallback((e) => {
    const y = e?.nativeEvent?.contentOffset?.y || 0;
    if (y > HIDE_AFTER_Y) {
      setScrolled(true);
      if (!countedRef.current) {
        countedRef.current = true; // una vez por apertura de la pantalla
        AsyncStorage.getItem(STORAGE_KEY)
          .then((v) => AsyncStorage.setItem(STORAGE_KEY, String(Number(v || 0) + 1)))
          .catch(() => {});
      }
    }
  }, []);

  const onLayout = useCallback((e) => setLayoutH(e?.nativeEvent?.layout?.height || 0), []);
  const onContentSizeChange = useCallback((_w, h) => setContentH(h || 0), []);

  const viewport = layoutH || windowHeight;
  const hasMore = contentH > viewport + 60;

  return {
    visible: enabled && hasMore && !scrolled,
    scrollProps: { onScroll, onLayout, onContentSizeChange, scrollEventThrottle: 32 },
  };
}

export default function ScrollHint({ visible }) {
  const tabBarHeight = useContext(BottomTabBarHeightContext) || 0;
  const opacity = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: visible ? 450 : 250,
      delay: visible ? 900 : 0, // deja ver la pantalla antes de aparecer
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bounce]);

  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { bottom: tabBarHeight, opacity }]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="scrollHintFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0b0709" stopOpacity="0" />
            <Stop offset="1" stopColor="#0b0709" stopOpacity="0.92" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#scrollHintFade)" />
      </Svg>
      <Animated.View style={[styles.pill, { transform: [{ translateY }] }]}>
        <Text style={styles.text}>Desliza para ver más</Text>
        <Text style={styles.chevron}>⌄</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 110,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 12,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(122,30,58,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  text: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12.5,
  },
  chevron: {
    color: colors.accent || "#fff",
    fontWeight: "900",
    fontSize: 16,
    marginTop: -6,
  },
});
