/** `next/headers` for a server component rendered in a preview: no request, so no cookies and no headers. */
const cookieStore = {
  get: (_name: string) => undefined, getAll: () => [], has: () => false, set: () => {}, delete: () => {}, size: 0,
  [Symbol.iterator]: function* () {},
};
export const cookies = async () => cookieStore;
export const headers = async () => new Headers();
export const draftMode = async () => ({ isEnabled: false, enable: () => {}, disable: () => {} });
