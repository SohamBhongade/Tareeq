/**
 * Runs once when the server starts: connect to the database right away, so the
 * first person to open the site doesn't wait for the connection (and DNS) setup.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getStore } = await import("./lib/store");
  const started = Date.now();
  getStore()
    .warmUp()
    .then(() => {
      if (getStore().mode === "mongo") console.log(`[mongo] connected in ${Date.now() - started} ms`);
    })
    .catch((e) => console.warn("[mongo] early connect failed (will retry on first request):", (e as Error)?.message));
}
