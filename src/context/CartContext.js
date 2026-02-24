import React, { createContext, useContext, useMemo, useReducer } from "react";

const CartContext = createContext(null);

function cartReducer(state, action) {
  switch (action.type) {
    case "ADD": {
      const p = action.payload;
      const id = String(p._id);

      const existing = state.itemsById[id];
      const nextQty = (existing?.qty || 0) + 1;

      return {
        ...state,
        itemsById: {
          ...state.itemsById,
          [id]: {
            id,
            title: p.title,
            price: Number(p.price || 0),
            imageUrl: p.imageUrl || "",
            qty: nextQty,
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
        itemsById: { ...state.itemsById, [id]: { ...it, qty: it.qty + 1 } },
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
      add: (p) => dispatch({ type: "ADD", payload: p }),
      inc: (id) => dispatch({ type: "INC", payload: id }),
      dec: (id) => dispatch({ type: "DEC", payload: id }),
      remove: (id) => dispatch({ type: "REMOVE", payload: id }),
      clear: () => dispatch({ type: "CLEAR" }),
    }),
    [items, state.itemsById, cartCount, subtotal]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}