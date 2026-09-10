import React from "react";
import { Platform } from "react-native";
import { PetWidget } from "./PetWidget";

/**
 * Empuja un render fresco al widget de pantalla de inicio desde la app
 * (no depende de la tarea headless de la librería, que en dev-client+Metro
 * es poco confiable). Se llama cuando la app tiene datos nuevos de /pet.
 * Silencioso: si no está el módulo nativo o no hay widget colocado, no pasa nada.
 */
export async function updatePetWidget(data) {
  if (Platform.OS !== "android") return;
  try {
    const { requestWidgetUpdate } = require("react-native-android-widget");
    if (typeof requestWidgetUpdate !== "function") return;
    await requestWidgetUpdate({
      widgetName: "PetWidget",
      renderWidget: () => <PetWidget {...(data || { error: true })} />,
      widgetNotFound: () => {},
    });
  } catch (e) {
    // sin módulo nativo / sin widget colocado -> ignorar
  }
}
