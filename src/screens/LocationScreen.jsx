import React, { useMemo, useRef, useCallback } from "react";
import { View, StyleSheet, Platform, Pressable, Text, Linking, Image } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useFocusEffect } from "@react-navigation/native";
import { colors } from "../theme/colors";
import boothMarker from "../assets/markers/londoncafe.png";

const LAT = 31.70075;
const LNG = -106.38848;

export default function LocationScreen() {
  const mapRef = useRef(null);

  const region = useMemo(
    () => ({
      latitude: LAT,
      longitude: LNG,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }),
    []
  );

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.animateToRegion(region, 600);
        }
      }, 100);

      return () => clearTimeout(t);
    }, [region])
  );

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
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton
        toolbarEnabled={false}
      >
        <Marker
          coordinate={{ latitude: LAT, longitude: LNG }}
          title="LondonCafe"
          description="Café de especialidad"
          //anchor={{ x: 0.5, y: 1 }} // ✅ “punta” abajo centrada
        >
          <Image
            source={boothMarker}
            style={styles.markerImg}
            resizeMode="none"
          />
        </Marker>
      </MapView>

      <Pressable onPress={openMaps} style={styles.fab}>
        <Text style={styles.fabText}>Abrir en Maps</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ✅ Ajusta tamaño del pin aquí
  markerImg: {
    width: 46,
    height: 46,
  },

  fab: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 18,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  fabText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
});
