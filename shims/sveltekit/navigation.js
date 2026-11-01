// $app/navigation in a preview: navigation does not leave the component; every call resolves.
const done = async () => {};
export const goto = done;
export const invalidate = done;
export const invalidateAll = done;
export const preloadData = async () => ({ type: "loaded", status: 200, data: {} });
export const preloadCode = done;
export const beforeNavigate = () => {};
export const afterNavigate = () => {};
export const onNavigate = () => {};
export const pushState = () => {};
export const replaceState = () => {};
export const disableScrollHandling = () => {};
export const refreshAll = done;
