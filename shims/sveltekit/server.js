// $app/server is server-only; components that reach it need the app.
export const read = () => { throw new Error("$app/server cannot run in a component preview"); };
export const getRequestEvent = read;
