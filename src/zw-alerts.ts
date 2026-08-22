/**
 * Stream alert driver.
 *
 * Event sources, all active at once:
 * 1. StreamElements custom widget → window `onEventReceived`
 * 2. control.html on the same origin → BroadcastChannel + localStorage poll
 * 3. `window.ZW.fire({...})` / `postMessage({zwAlert:{...}})`
 * 4. `?test=sub&tier=huge` in the URL, and keys 1–6 in your browser source's "Interact" window
 * 5. The Twitch relay Worker's WebSocket hub, `redemptions.html` only: real
 *    Channel Point redemptions, the one event type nothing else here covers
 *    live (see worker/README.md)
 */
import { AlertStage } from "./components/AlertStage.js";
import { VARIANTS } from "./components/variants.js";

const qs = new URLSearchParams(location.search);

/**
 * The Twitch relay Worker's WebSocket hub. Baked in rather than left for a
 * streamer to configure, `?worker=` overrides it for local testing against
 * `wrangler dev`.
 */
const REDEMPTION_HUB_URL =
  qs.get("worker") || "wss://zw-twitch-relay.djzwackery.workers.dev/ws";

function num(key: string, fallback: number): number {
  const v = parseFloat(qs.get(key) ?? "");
  return isNaN(v) ? fallback : v;
}

/**
 * Narrows an untrusted `postMessage`/`BroadcastChannel` payload before reading fields off it.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const CFG: AlertsConfig = {
  duration: num("duration", 5000),
  top: num("top", 96),
  tipBig: num("tipBig", 20),
  tipHuge: num("tipHuge", 100),
  bitsBig: num("bitsBig", 1000),
  bitsHuge: num("bitsHuge", 5000),
  raidBig: num("raidBig", 20),
  raidHuge: num("raidHuge", 100),
  monthsBig: num("monthsBig", 6),
  giftHuge: num("giftHuge", 10),
  currency: qs.get("currency") || "AUD",
  // alerts.html takes the five live events; redemptions.html sets
  // ?accept=redeem so the two never queue behind each other.
  accept: (qs.get("accept") || "follow,sub,tip,bits,raid").split(","),
  rewards: qs.get("rewards") || "rewards.json",
};

/**
 * Locked variant per type from the query string, or "cycle" to rotate through the three.
 */
const PIN: Record<AlertType, string | null> = {
  follow: qs.get("follow"),
  sub: qs.get("sub"),
  tip: qs.get("tip"),
  bits: qs.get("bits"),
  raid: qs.get("raid"),
  redeem: null,
};
const spin: Record<AlertType, number> = {
  follow: 0,
  sub: 0,
  tip: 0,
  bits: 0,
  raid: 0,
  redeem: 0,
};

function variantFor(type: AlertType): string | undefined {
  const list = VARIANTS[type] ?? [];
  const pinned = PIN[type];
  if (pinned && pinned !== "cycle") {
    return pinned;
  }
  const v = list[spin[type] % list.length];
  spin[type]++;
  return v?.id;
}

function tierFor(type: AlertType, e: RawAlertPayload): AlertTier {
  if (e.tier) {
    return e.tier;
  }
  const n = e.value ?? 0;
  if (type === "tip") {
    return n >= CFG.tipHuge ? "huge" : n >= CFG.tipBig ? "big" : "small";
  }
  if (type === "bits") {
    return n >= CFG.bitsHuge ? "huge" : n >= CFG.bitsBig ? "big" : "small";
  }
  if (type === "raid") {
    return n >= CFG.raidHuge ? "huge" : n >= CFG.raidBig ? "big" : "small";
  }
  if (type === "sub") {
    return (e.gifted ?? 0) >= CFG.giftHuge
      ? "huge"
      : n >= CFG.monthsBig
        ? "big"
        : "small";
  }
  return "small";
}

const fmt = (n: number): string =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * Reward book: reward title → its display config, loaded from `rewards.json`.
 */
const REWARDS: Record<string, RewardConfig> = {};
const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
fetch(CFG.rewards, { cache: "no-store" })
  .then((r) => r.json())
  .then((rewards: Record<string, RewardConfig>) => {
    for (const [title, cfg] of Object.entries(rewards)) {
      REWARDS[slug(title)] = cfg;
    }
  })
  .catch(() =>
    console.warn(`[zw] no ${CFG.rewards}, redemptions will use placeholders`),
  );

/**
 * Substitutes Streamlabs-style `{token}` placeholders in a template string,
 * leaving anything not in `values` untouched (same absent-token handling as
 * streamlabs-alertbox.ts).
 */
function substituteTokens(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? values[key]! : match,
  );
}

const TOKEN_SHAPE = /\{[a-zA-Z]+\}/;

/**
 * Normalises anything thrown at it into the shape `AlertStage` renders. A
 * `message` containing `{token}`-shaped text is treated as a Streamlabs-style
 * Message Template, substituted and used as the alert's detail line instead
 * of its type default, so control.html's rehearsal panel previews a custom
 * template the same way the real Streamlabs Alert Box would; a plain message
 * (no tokens) keeps its existing role as the quoted comment underneath.
 */
function build(raw: RawAlertPayload): AlertStageEvent {
  const type = raw.type;
  const name = raw.name || "someone";
  const isTemplate = !!raw.message && TOKEN_SHAPE.test(raw.message);
  const message = isTemplate
    ? substituteTokens(raw.message!, { name, value: String(raw.value ?? "") })
    : raw.message;
  const detail = (fallback: string) => (isTemplate ? message! : fallback);
  const e: AlertStageEvent = {
    type,
    name,
    avatar: raw.avatar,
    message,
    goal: raw.goal,
    variant: raw.variant || variantFor(type),
    tier: "small", // overwritten below, or by the redeem branch
  };
  if (type === "tip") {
    e.amount =
      raw.amount || `$${raw.value || 0} ${raw.currency || CFG.currency}`;
    e.detail = detail("chucked in");
    e.fill = raw.fill ?? Math.min(1, (raw.value || 0) / CFG.tipHuge);
  } else if (type === "bits") {
    e.amount = raw.amount || `${fmt(raw.value || 0)} bits`;
    e.detail = detail("cheered");
    e.fill = raw.fill ?? Math.min(1, (raw.value || 0) / CFG.bitsHuge);
  } else if (type === "raid") {
    e.party = raw.value || raw.party || 1;
    e.party_avatars = raw.party_avatars;
    e.detail = detail(
      `${e.party} ${e.party === 1 ? "mate in tow" : "mates in tow"}`,
    );
    e.amount = String(e.party);
    e.headline = "Incoming raid";
  } else if (type === "sub") {
    if (raw.gifted) {
      e.detail = detail(`${raw.gifted} subs gifted`);
      e.amount = `×${raw.gifted}`;
      e.headline = "Gifted";
      // A deeper shade of sub's magenta, not a whole new tone: the four
      // brand tones are all already claimed by other alert types.
      e.tone = "--magenta-contrast";
    } else {
      e.detail = detail(
        `Tier ${raw.plan || 1} · ${raw.value || 1} ${raw.value === 1 ? "month" : "months"}`,
      );
      e.amount = String(raw.value || 1);
    }
  } else if (type === "redeem") {
    const cfg = REWARDS[slug(raw.reward ?? raw.name ?? "")] ?? {};
    e.reward = raw.reward || cfg.reward;
    e.name = raw.name || "someone";
    e.media = raw.media || cfg.media;
    e.cost = raw.cost || cfg.cost;
    e.tone = raw.tone || cfg.tone;
    e.detail = e.reward;
    e.headline = raw.headline || cfg.headline || "Redeemed";
    e.variant = raw.variant || cfg.variant || variantFor(type);
    e.tier = raw.tier || cfg.tier || "big";
    return e;
  } else {
    e.detail = detail("just followed");
  }
  e.tier = tierFor(type, raw);
  if (raw.headline) {
    e.headline = raw.headline;
  }
  return e;
}

const root = document.getElementById("root")!;

// #root is a fixed 1920x1080 canvas, matching the recommended OBS source
// size, so it renders pixel-perfect there (scale is exactly 1). Opened in a
// plain browser tab for testing, a typical window is shorter than 1080px,
// and body's overflow:hidden makes anything past that edge unreachable, not
// just scrolled off, redemptions.html's corner-anchored layout in
// particular. Shrinking the whole canvas to fit fixes that without
// changing anything a real, correctly-sized OBS source ever sees.
function fitCanvas(): void {
  const scale = Math.min(
    1,
    window.innerWidth / 1920,
    window.innerHeight / 1080,
  );
  root.style.transform = `scale(${scale})`;
  root.style.transformOrigin = "top left";
}
window.addEventListener("resize", fitCanvas);
fitCanvas();

const stage = new AlertStage(root, {
  top: CFG.top,
  onDone: finished,
});
const queue: AlertStageEvent[] = [];
let busy = false;

function pump(): void {
  if (busy || queue.length === 0) {
    return;
  }
  busy = true;
  stage.show(queue.shift()!, CFG.duration);
}
let lastSeenAt = 0;
function fire(raw: RawAlertPayload): void {
  if (!CFG.accept.includes(raw.type)) {
    return;
  }
  // control.html delivers the same event over BroadcastChannel, a localStorage
  // write, and (for its own preview iframe) a direct postMessage all at once,
  // so whichever channel arrives first here needs to suppress the repeats.
  if (raw.at) {
    if (raw.at <= lastSeenAt) {
      return;
    }
    lastSeenAt = raw.at;
  }
  queue.push(build(raw));
  pump();
}
function finished(): void {
  busy = false;
  setTimeout(pump, 350);
}
window.ZW = { fire, config: CFG, build };

/**
 * The fields this driver reads from a StreamElements `onEventReceived` event.
 */
interface StreamElementsEvent {
  /**
   * Present on redemption-adjacent events this driver doesn't handle; used to skip them.
   */
  itemId?: string;
  /**
   * The triggering user's Twitch username.
   */
  name?: string;
  /**
   * The triggering user's display name, preferred over `name` when present.
   */
  displayName?: string;
  /**
   * Tip/cheer message or chat comment attached to the event.
   */
  message?: string;
  /**
   * Tip amount, bits count, or redemption point cost, depending on event type.
   */
  amount?: number;
  /**
   * Follower/subscriber count for bulk events.
   */
  quantity?: number;
  /**
   * Number of subs gifted at once, for bulk gifted-sub events.
   */
  bulkGifted?: number;
  /**
   * Whether this is a (single) gifted sub.
   */
  gifted?: boolean;
  /**
   * Twitch sub tier, e.g. "1000"/"2000"/"3000".
   */
  tier?: number | string;
  /**
   * The triggering user's profile image URL.
   */
  avatar?: string;
  /**
   * Currency code for tip events.
   */
  currency?: string;
  /**
   * The redeemed reward's title, for redemption events.
   */
  redemption?: string;
  /**
   * Alternate field some StreamElements payloads use instead of `redemption`.
   */
  reward?: string;
}
/**
 * The `detail` payload StreamElements dispatches on its `onEventReceived` custom event.
 */
interface StreamElementsEventDetail {
  /**
   * Which event stream this is, e.g. "follower-latest", "tip-latest".
   */
  listener?: string;
  /**
   * The event data itself.
   */
  event?: StreamElementsEvent;
}

window.addEventListener("onEventReceived", (obj: Event) => {
  const detail = (obj as CustomEvent<StreamElementsEventDetail>).detail ?? {};
  const listenerName = detail.listener ?? "";
  const ev = detail.event ?? {};
  if (ev.itemId || !listenerName.includes("-latest")) {
    return;
  }
  const map: Record<string, AlertType> = {
    "follower-latest": "follow",
    "subscriber-latest": "sub",
    "tip-latest": "tip",
    "cheer-latest": "bits",
    "raid-latest": "raid",
    "redemption-latest": "redeem",
  };
  const type = map[listenerName];
  if (!type) {
    return;
  }
  if (type === "redeem") {
    fire({
      type: "redeem",
      name: ev.name || ev.displayName,
      reward: ev.redemption || ev.reward || ev.message,
      cost: ev.amount,
      message: ev.message,
    });
    return;
  }
  fire({
    type,
    name: ev.name || ev.displayName,
    message: ev.message,
    value: ev.amount || ev.quantity || 1,
    gifted: ev.bulkGifted ? ev.amount : ev.gifted ? 1 : 0,
    plan: ev.tier ? String(ev.tier).replace("000", "") : 1,
    avatar: ev.avatar,
    currency: ev.currency,
  });
});

try {
  const bc = new BroadcastChannel("zw-alerts");
  bc.onmessage = (m: MessageEvent<unknown>) => {
    if (isRecord(m.data) && m.data.type) {
      fire(m.data as unknown as RawAlertPayload);
    }
  };
} catch {
  // BroadcastChannel unsupported. The localStorage poll below still covers control.html
}
setInterval(() => {
  try {
    const raw = localStorage.getItem("zw-alert");
    if (!raw) {
      return;
    }
    fire(JSON.parse(raw) as RawAlertPayload);
  } catch {
    // malformed localStorage value, wait for the next tick
  }
}, 250);

window.addEventListener("message", (m: MessageEvent<unknown>) => {
  if (isRecord(m.data) && m.data.zwAlert) {
    fire(m.data.zwAlert as RawAlertPayload);
  }
});

if (CFG.accept.includes("redeem")) {
  connectRedemptionHub();
}
function connectRedemptionHub(): void {
  const ws = new WebSocket(REDEMPTION_HUB_URL);
  ws.onmessage = (m: MessageEvent<unknown>) => {
    try {
      const data: unknown = JSON.parse(String(m.data));
      if (isRecord(data) && data.type) {
        fire(data as unknown as RawAlertPayload);
      }
    } catch {
      // malformed message from the hub, wait for the next one
    }
  };
  ws.onclose = () => {
    setTimeout(connectRedemptionHub, 3000);
  };
}

// manual test: ?test=sub&tier=huge, ?test=redeem&reward=Weights, and keys
// 1–6 (hold shift = big, alt = huge)
const TEST: Record<AlertType, RawAlertPayload> = {
  follow: { type: "follow", name: "dutchie" },
  sub: {
    type: "sub",
    name: "ravemum74",
    value: 12,
    plan: 2,
    message: "OI OI OI, hardcore till I die",
  },
  tip: {
    type: "tip",
    name: "ravemum74",
    value: 25,
    message: "play something filthy",
  },
  bits: {
    type: "bits",
    name: "ravemum74",
    value: 1500,
    message: "drop the gabber",
  },
  raid: { type: "raid", name: "hardcorehenry", value: 43 },
  redeem: { type: "redeem", name: "ravemum74", reward: "Attempt anime save" },
};
const t = qs.get("test");
if (t && t in TEST) {
  // Only overrides a field when the query string actually sets it: TEST's
  // own reward/name/tier are the defaults, so an absent param has to leave
  // them alone rather than blank them out.
  const payload: RawAlertPayload = { ...TEST[t as AlertType] };
  const tier = qs.get("tier");
  if (tier) {
    payload.tier = tier as AlertTier;
  }
  const reward = qs.get("reward");
  if (reward) {
    payload.reward = reward;
  }
  const name = qs.get("name");
  if (name) {
    payload.name = name;
  }
  setTimeout(() => fire(payload), 400);
}
const KEYS: AlertType[] = ["follow", "sub", "tip", "bits", "raid", "redeem"];
window.addEventListener("keydown", (ev: KeyboardEvent) => {
  const type = KEYS[parseInt(ev.key, 10) - 1];
  if (!type) {
    return;
  }
  fire({
    ...TEST[type],
    tier: ev.altKey ? "huge" : ev.shiftKey ? "big" : undefined,
  });
});
