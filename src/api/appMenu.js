import { posFetch } from "./client";

export function getAppMenu() {
  return posFetch("/app-Menu", { method: "GET" });
}