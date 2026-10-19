import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
export default defineConfig(({ command }) => {
  const notebookPrefix =
    command === "serve" && process.env.VC_PREFIX && process.env.GSL_LOCAL_FRONT_PORT
      ? `${process.env.VC_PREFIX.replace(/\/$/, "")}/proxy/${process.env.GSL_LOCAL_FRONT_PORT}`
      : "";
  const base = `${notebookPrefix}${process.env.VITE_BASE_PATH || "/g-super-league/"}`;
  const apiProxy = {
    target: `http://127.0.0.1:${process.env.GSL_LOCAL_API_PORT || 8787}`,
    changeOrigin: true,
    headers: {
      Origin: `http://localhost:${process.env.GSL_LOCAL_FRONT_PORT || 5173}`,
    },
    rewrite: (path: string) =>
      path.startsWith(base) ? `/${path.slice(base.length)}` : path,
  };
  return {
    plugins: [
      react(),
      {
        name: "notebook-proxy-path",
        apply: "serve",
        configureServer(server) {
          if (!notebookPrefix) return;
          // code-server strips its proxy prefix before forwarding HTTP and WebSocket requests.
          const restorePrefix = (request: { url?: string }) => {
            if (
              request.url &&
              !request.url.startsWith(notebookPrefix) &&
              !request.url.startsWith("/api")
            ) {
              request.url = `${notebookPrefix}${request.url}`;
            }
          };
          server.middlewares.use((request, _response, next) => {
            restorePrefix(request);
            next();
          });
          server.httpServer?.prependListener("upgrade", restorePrefix);
        },
      },
    ],
    base,
    resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
    server: {
      allowedHosts: ["nat2-notebook-inspire.sii.edu.cn"],
      proxy: {
        "/api": apiProxy,
        [`${base}api`]: apiProxy,
      },
    },
  };
});
