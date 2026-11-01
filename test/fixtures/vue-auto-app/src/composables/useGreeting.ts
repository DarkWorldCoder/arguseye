export function useGreeting(name: string) {
  return computed(() => `Hi ${name}`);
}
