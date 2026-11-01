/** `next/cache`: caching and revalidation do nothing in a preview; cached functions run directly. */
export const unstable_cache = <T extends (...args: any[]) => any>(fn: T) => fn;
export const revalidatePath = () => {};
export const revalidateTag = () => {};
export const unstable_noStore = () => {};
export const unstable_cacheLife = () => {};
export const unstable_cacheTag = () => {};
