import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PetWidget } from "./PetWidget";

const BASE_URL = "https://app.londoncafejrz.com/api";

async function fetchPet() {
  try {
    const token =
      (await AsyncStorage.getItem("londoncaf_token")) ||
      (await AsyncStorage.getItem("token")) ||
      "";
    if (!token) return { error: true };

    const res = await fetch(`${BASE_URL}/pet`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) return { error: true };
    const j = await res.json();
    if (!j?.pet?.owned) return { error: true };
    return { pet: j.pet, mood: j.mood, need: j.need, ageDays: j.ageDays };
  } catch {
    return { error: true };
  }
}

export async function widgetTaskHandler(props) {
  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
    case "WIDGET_CLICK": {
      const data = await fetchPet();
      props.renderWidget(<PetWidget {...data} />);
      break;
    }
    case "WIDGET_DELETED":
    default:
      break;
  }
}
