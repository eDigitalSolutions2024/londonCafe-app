import React, {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useEffect,
  useState,
} from "react";
import { AuthContext } from "./AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CartContext = createContext(null);
function getCartStorageKey(userId) {
  return `@london_cafe_cart_${String(userId || "guest")}`;
}

function normalizeFlavors(flavors) {
  if (!Array.isArray(flavors)) return [];
  return [...flavors].map((x) => String(x)).sort();
}

function buildLineId(product) {
  const productId = String(product?._id || product?.productId || "");
  const milk = String(product?.selectedOptions?.milk || "");
  const temp = String(product?.selectedOptions?.temp || "");
  const flavors = normalizeFlavors(product?.selectedOptions?.flavors).join("|");

  return `${productId}__${milk}__${temp}__${flavors}`;
}

function cartReducer(state, action) {
  switch (action.type) {
    case "HYDRATE": {
      return action.payload || { itemsById: {} };
    }

    case "ADD": {
      const p = action.payload;
      const lineId = buildLineId(p);
      const productId = String(p._id || p.productId || "");

      const existing = state.itemsById[lineId];
      const nextQty = (existing?.qty || 0) + 1;

      return {
        ...state,
        itemsById: {
          ...state.itemsById,
          [lineId]: {
            id: lineId,
            productId,
            title: p.title,
            price: Number(p.price || 0),
            imageUrl: p.imageUrl || "",
            qty: nextQty,
            selectedOptions: {
              milk: p?.selectedOptions?.milk || null,
              temp: p?.selectedOptions?.temp || null,
              flavors: normalizeFlavors(p?.selectedOptions?.flavors),
            },
          },
        },
      };
    }

    case "INC": {
      const id = String(action.payload);
      const it = state.itemsById[id];
      if (!it) return state;

      return {
        ...state,
        itemsById: {
          ...state.itemsById,
          [id]: { ...it, qty: it.qty + 1 },
        },
      };
    }

    case "DEC": {
      const id = String(action.payload);
      const it = state.itemsById[id];
      if (!it) return state;

      const nextQty = it.qty - 1;
      const next = { ...state.itemsById };

      if (nextQty <= 0) delete next[id];
      else next[id] = { ...it, qty: nextQty };

      return { ...state, itemsById: next };
    }

    case "REMOVE": {
      const id = String(action.payload);
      const next = { ...state.itemsById };
      delete next[id];
      return { ...state, itemsById: next };
    }

    case "CLEAR":
      return { itemsById: {} };

    default:
      return state;
  }
}

const initialState = { itemsById: {} };

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const [hydrated, setHydrated] = useState(false);

    const { user, token } = useContext(AuthContext);
  const userId = user?._id || user?.id || "guest";
  const storageKey = getCartStorageKey(userId);

  // cargar carrito guardado al abrir app
  useEffect(() => {
  async function loadCart() {
    try {
      const raw = await AsyncStorage.getItem(storageKey);

      if (raw) {
        const parsed = JSON.parse(raw);
        dispatch({ type: "HYDRATE", payload: parsed });
      } else {
        dispatch({ type: "HYDRATE", payload: { itemsById: {} } });
      }
    } catch (err) {
      console.log("Error loading cart:", err);
      dispatch({ type: "HYDRATE", payload: { itemsById: {} } });
    } finally {
      setHydrated(true);
    }
  }

  setHydrated(false);
  loadCart();
}, [storageKey]);

  // guardar carrito cada vez que cambie
  useEffect(() => {
  if (!hydrated) return;

  async function saveCart() {
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(state));
    } catch (err) {
      console.log("Error saving cart:", err);
    }
  }

  saveCart();
}, [state, hydrated, storageKey]);
  const items = useMemo(() => Object.values(state.itemsById), [state.itemsById]);

  const cartCount = useMemo(
    () => items.reduce((acc, it) => acc + (it.qty || 0), 0),
    [items]
  );

  const subtotal = useMemo(
    () => items.reduce((acc, it) => acc + (it.qty || 0) * (it.price || 0), 0),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      itemsById: state.itemsById,
      cartCount,
      subtotal,
      hydrated,
      add: (p) => dispatch({ type: "ADD", payload: p }),
      inc: (id) => dispatch({ type: "INC", payload: id }),
      dec: (id) => dispatch({ type: "DEC", payload: id }),
      remove: (id) => dispatch({ type: "REMOVE", payload: id }),
      clear: () => dispatch({ type: "CLEAR" }),
    }),
    [items, state.itemsById, cartCount, subtotal, hydrated]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}