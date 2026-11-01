import { defineStore } from "pinia";
export const useCounter = defineStore("counter", { state: () => ({ count: 41 }), actions: { inc() { this.count++; } } });
