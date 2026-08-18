// One-time local OAuth exchange for the Twitch relay Worker (worker/). Run
// this once to get a refresh token, then seed the Worker's secrets with the
// values it prints at the end. Your Client Secret is only ever sent
// directly to Twitch's own token endpoint from this machine, never
// committed or transmitted anywhere else.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import readline from "node:readline/promises";

const PORT = 3939;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPE = "channel:read:redemptions";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const clientId = await rl.question("Twitch Client ID: ");
const clientSecret = await rl.question("Twitch Client Secret: ");
rl.close();

const state = randomBytes(16).toString("hex");
const authorizeUrl = new URL("https://id.twitch.tv/oauth2/authorize");
authorizeUrl.searchParams.set("client_id", clientId);
authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authorizeUrl.searchParams.set("response_type", "code");
authorizeUrl.searchParams.set("scope", SCOPE);
authorizeUrl.searchParams.set("state", state);

console.log(
  "\nAdd this exact redirect URI to your Twitch app first, if you haven't:",
);
console.log(`  ${REDIRECT_URI}\n`);
console.log("Then open this URL in a browser and approve access:\n");
console.log(`  ${authorizeUrl.href}\n`);
console.log("Waiting for the redirect...");

const code = await new Promise((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url, REDIRECT_URI);
    if (url.pathname !== "/callback") {
      res.writeHead(404).end();
      return;
    }
    const error = url.searchParams.get("error");
    const returnedState = url.searchParams.get("state");
    const returnedCode = url.searchParams.get("code");
    res.writeHead(200, { "Content-Type": "text/plain" });
    if (error) {
      res.end(`Twitch returned an error: ${error}. You can close this tab.`);
      server.close();
      reject(new Error(error));
      return;
    }
    if (returnedState !== state || !returnedCode) {
      res.end("State mismatch or missing code, close this tab and try again.");
      server.close();
      reject(new Error("state mismatch or missing code"));
      return;
    }
    res.end("Success, you can close this tab and return to the terminal.");
    server.close();
    resolve(returnedCode);
  });
  server.listen(PORT);
});

const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: REDIRECT_URI,
  }),
});
if (!tokenRes.ok) {
  console.error(
    `Token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`,
  );
  process.exit(1);
}
const tokens = await tokenRes.json();

console.log(
  "\nSuccess. Now seed the Worker's secrets (from the worker/ directory):\n",
);
console.log("  cd worker");
console.log(
  `  npx wrangler secret put TWITCH_CLIENT_ID          # paste: ${clientId}`,
);
console.log(
  "  npx wrangler secret put TWITCH_CLIENT_SECRET      # paste your Client Secret",
);
console.log(
  `  npx wrangler secret put TWITCH_REFRESH_TOKEN      # paste: ${tokens.refresh_token}`,
);
console.log(
  "\nGenerate one more secret yourself (any long random string) and store it too:",
);
console.log("  npx wrangler secret put TWITCH_WEBHOOK_SECRET");
console.log(
  "\nThen see worker/README.md for creating the KV namespace and the EventSub subscription.",
);
