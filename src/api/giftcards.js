import { apiFetch } from "./client";

export function fetchMyGiftCards(token) {
  
  return apiFetch("/giftcards/mine", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function purchaseGiftCard(token, payload) {
  
  return apiFetch("/giftcards/purchase", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function redeemGiftCard(token, code) {
   
  return apiFetch("/giftcards/redeem", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code }),
  });
}