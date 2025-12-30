// ⚠️ CAMBIA ESTA IP por la de tu PC en la red local
// Si estás probando en el navegador (Expo web) puedes usar "http://localhost:4000"
const API_BASE = "http://192.168.1.90:4000"; 

export async function getMenu() {
  const res = await fetch(`${API_BASE}/api/menu`);
  if (!res.ok) {
    throw new Error("Error al cargar el menú");
  }
  return res.json();
}
