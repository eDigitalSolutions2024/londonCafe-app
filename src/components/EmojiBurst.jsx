import React, { useEffect, useMemo, useRef } from "react";
import { View, Animated, StyleSheet, Dimensions, Easing } from "react-native";

const { width, height } = Dimensions.get("window");

export default function EmojiBurst({ visible, emoji = "😄", count = 18 }) {
  const items = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => ({
      id: i,
      x: Math.random() * width,
      y: Math.random() * height,
      s: 0.6 + Math.random() * 0.9,
      d: 700 + Math.random() * 700,
    }));
  }, [visible, emoji, count]);

  const anims = useRef(items.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!visible) return;

    // reset
    anims.forEach((a) => a.setValue(0));

    // run
    Animated.stagger(
      25,
      anims.map((a, idx) =>
        Animated.timing(a, {
          toValue: 1,
          duration: items[idx]?.d ?? 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      )
    ).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.layer}>
      {items.map((it, idx) => {
        const t = anims[idx] || new Animated.Value(0);

        const translateY = t.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -120 - Math.random() * 180],
        });

        const opacity = t.interpolate({
          inputRange: [0, 0.6, 1],
          outputRange: [0, 1, 0],
        });

        const scale = t.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0.6, 1.2, 0.2],
        });

        return (
          <Animated.Text
            key={it.id}
            style={[
              styles.emoji,
              {
                left: it.x,
                top: it.y,
                opacity,
                transform: [{ translateY }, { scale }],
                fontSize: 22 * it.s,
              },
            ]}
          >
            {emoji}
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,        // ✅ detrás del card
    elevation: 5,
  },
  emoji: {
    position: "absolute",
  },
});
