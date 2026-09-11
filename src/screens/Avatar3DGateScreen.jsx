import React, { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import AvatarCustomizeScreen from "./AvatarCustomizeScreen";

// Migración OBLIGATORIA: toda cuenta sin avatar3d.owned pasa por acá antes
// de poder usar el resto de la app (montado directo en App.js, fuera del
// NavigationContainer normal -- no hay "Cerrar" ni forma de saltárselo).
// Reusa AvatarCustomizeScreen en modo `forced` para no duplicar todo el
// picker de partes/colores.
export default function Avatar3DGateScreen() {
  const { setUser } = useContext(AuthContext);

  return (
    <AvatarCustomizeScreen
      forced
      onDone={(avatar3d) => {
        setUser((prev) => ({ ...(prev || {}), avatar3d }));
      }}
    />
  );
}
