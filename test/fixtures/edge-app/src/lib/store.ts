import { configureStore, createSlice } from "@reduxjs/toolkit";

const cart = createSlice({ name: "cart", initialState: { items: 3 }, reducers: { add: (s) => { s.items += 1; } } });
export const { add } = cart.actions;
export const store = configureStore({ reducer: { cart: cart.reducer } });
export type RootState = ReturnType<typeof store.getState>;
