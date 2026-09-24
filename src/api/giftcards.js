import { apiFetch } from "./client";

export function fetchMyGiftCards(token) {

  return apiFetch("/giftcards/mine", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Antes purchaseGiftCard llamaba directo a /giftcards/purchase y creaba
// la tarjeta sin cobrar nada -- ahora es un flujo de 2 pasos con Stripe
// (mismo patrón que el Pase VIP en StoreScreen.jsx): sheet arma el
// PaymentIntent, confirm crea la tarjeta después de que el PaymentSheet
// ya cobró de verdad.
export function createGiftCardSheet(token, payload) {
  return apiFetch("/giftcards/purchase/sheet", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function confirmGiftCard(token, paymentIntentId) {
  return apiFetch("/giftcards/purchase/confirm", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ paymentIntentId }),
  });
}

export function redeemGiftCard(token, code) {

  return apiFetch("/giftcards/redeem", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code }),
  });
}
