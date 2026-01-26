import { posFetch } from "./client";

export function getPromos() {
  return posFetch("/promos", { method: "GET" });
}
