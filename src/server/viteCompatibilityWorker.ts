import { createViteBackend } from "./createViteBackend.js";

let backend: Awaited<ReturnType<typeof createViteBackend>> | undefined;
let pending = Promise.resolve();
process.on("message", (message: any) => {
  pending = pending.then(async () => {
    try {
      if (message.method === "start") backend = await createViteBackend(message.args[0], (event) => process.send?.({ event }));
      else if (!backend) throw new Error("Vite compatibility worker has not started");
      const value = message.method === "start" ? backend!.url : await (backend as any)[message.method](...message.args);
      process.send?.({ id: message.id, value, state: message.method === "close" ? undefined : backend!.snapshot() });
    } catch (error) { process.send?.({ id: message.id, error: String((error as Error).stack ?? error) }); }
  });
});
process.on("disconnect", () => { void backend?.close().finally(() => process.exit()); });
