// Vendors the Socket.IO v2 client into public/js/vendor/ so
// streamlabs-relay.html can load it as a plain <script>, self-hosted rather
// than pulled from a CDN at runtime. Pinned to 2.x in package.json: the
// Streamlabs socket server speaks the Socket.IO v2 protocol, and a v3/v4
// client can't complete the handshake against it.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/js/vendor", { recursive: true });
copyFileSync(
  "node_modules/socket.io-client/dist/socket.io.js",
  "public/js/vendor/socket.io.js",
);
