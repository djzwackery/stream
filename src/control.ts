/**
 * Rehearsal panel driver for control.html. Fires test alerts
 * into every alerts.html source on this origin (the live one included) over
 * BroadcastChannel with a localStorage fallback, and mirrors whichever page
 * owns the event type in the preview iframe.
 */
(function () {
  const TYPES: AlertType[] = ["follow", "sub", "tip", "bits", "raid", "redeem"];
  const VAR: Record<AlertType, string[]> = {
    follow: ["stamp", "ticker", "glitch"],
    sub: ["card", "slab", "party"],
    tip: ["receipt", "jar", "banner"],
    bits: ["meter", "chip", "slab"],
    raid: ["squad", "siren", "band"],
    redeem: ["sidecar", "frame", "reel"],
  };
  function $<T extends HTMLElement = HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
  }

  const AVATARS = [
    "https://static-cdn.jtvnw.net/jtv_user_pictures/37567ea1-8246-4385-bcf6-8a3cdb9ca93b-profile_image-70x70.png",
    "https://static-cdn.jtvnw.net/jtv_user_pictures/5e22a6ae-be13-4acc-9067-907f0a8b00b0-profile_image-70x70.png",
    "https://static-cdn.jtvnw.net/jtv_user_pictures/2455c449-f3bd-4fd5-931e-aa34504dbb65-profile_image-50x50.png",
  ];
  function randomAvatar(): string {
    return AVATARS[Math.floor(Math.random() * AVATARS.length)]!;
  }

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel("zw-alerts");
  } catch {
    // BroadcastChannel unsupported. The localStorage fallback below still reaches alerts.html
  }

  function send(payload: RawAlertPayload): void {
    const o: RawAlertPayload = { ...payload, at: Date.now() };
    bc?.postMessage(o);
    try {
      localStorage.setItem("zw-alert", JSON.stringify(o));
    } catch {
      // storage unavailable (private browsing etc.). BroadcastChannel already carried it
    }
    // the preview pane mirrors the live source for whichever page owns this type
    const want = o.type === "redeem" ? "redemptions.html" : "alerts.html";
    const frame = $<HTMLIFrameElement>("pv");
    const post = () => frame.contentWindow?.postMessage({ zwAlert: o }, "*");
    if (frame.getAttribute("src") !== want) {
      frame.setAttribute("src", want);
      frame.onload = () => setTimeout(post, 150);
    } else {
      post();
    }
  }

  // `variantOverride` is only for the "run all 18" sequence below, which
  // needs to step through combinations the Type/Variant selects aren't
  // currently showing; the Fire button always leaves it unset and reads the
  // (type-scoped) Variant select instead.
  function payload(type: AlertType, variantOverride?: string): RawAlertPayload {
    const o: RawAlertPayload = {
      type,
      variant: variantOverride ?? $<HTMLSelectElement>("variant").value,
      name: $<HTMLInputElement>("name").value || "someone",
      value: parseFloat($<HTMLInputElement>("value").value) || 1,
      message:
        type === "redeem"
          ? undefined
          : $<HTMLInputElement>("message").value || undefined,
      plan: 2,
      tier: $<HTMLSelectElement>("tier").value as AlertTier,
      avatar: randomAvatar(),
    };
    if (type === "redeem") {
      o.reward = $<HTMLSelectElement>("reward").value;
    }
    if (type === "raid") {
      // Squad (raid's layout) stacks up to 6 tiles off party_avatars, not avatar
      o.party_avatars = Array.from({ length: 6 }, randomAvatar);
    }
    return o;
  }

  // Variant only ever lists the selected type's own three, and Message/
  // Reward disable themselves when the selected type doesn't use them
  // (previously a global list of all 18 variant names applied to whichever
  // type you fired, so most combinations were invalid and silently fell
  // back to that type's first variant instead of what was picked).
  function updateForType(): void {
    const type = $<HTMLSelectElement>("type").value as AlertType;
    const variantSelect = $<HTMLSelectElement>("variant");
    variantSelect.innerHTML = "";
    VAR[type].forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      variantSelect.appendChild(o);
    });
    $<HTMLInputElement>("message").disabled = type === "redeem";
    $<HTMLSelectElement>("reward").disabled = type !== "redeem";
  }
  $<HTMLSelectElement>("type").addEventListener("change", updateForType);
  updateForType();

  $<HTMLButtonElement>("fire").onclick = () => {
    send(payload($<HTMLSelectElement>("type").value as AlertType));
  };

  // Fetched rather than hardcoded so the dropdown can't drift out of sync
  // with rewards.json (a reward added there used to need a matching edit here).
  fetch("rewards.json", { cache: "no-store" })
    .then((r) => r.json())
    .then((rewards: Record<string, RewardConfig>) => {
      const select = $<HTMLSelectElement>("reward");
      for (const title of Object.keys(rewards)) {
        const o = document.createElement("option");
        o.value = title;
        o.textContent = title;
        select.appendChild(o);
      }
    })
    .catch(() =>
      console.warn("[zw] no rewards.json, reward dropdown will be empty"),
    );

  $<HTMLButtonElement>("cycle").onclick = () => {
    let i = 0;
    const all = TYPES.flatMap((t) =>
      VAR[t].map((v): [AlertType, string] => [t, v]),
    );
    const step = () => {
      if (i >= all.length) {
        return;
      }
      const [t, v] = all[i++]!;
      send(payload(t, v));
      setTimeout(step, 6000);
    };
    step();
  };

  function copyField(id: string): void {
    const field = $<HTMLInputElement | HTMLTextAreaElement>(id);
    field.select();
    navigator.clipboard?.writeText(field.value).catch(() => {
      // clipboard permission denied; the field is still selected for a manual copy
    });
  }

  // Tokens Streamlabs' Alert Box substitutes per alert type (verified
  // against support.streamlabs.com's own Message Template Parameters doc).
  // profile_image isn't included: confirmed live it never substitutes,
  // Streamlabs leaves it as the literal "{profile_image}". Streamlabs
  // exposes no subscription tier token at all, for any sub-related type.
  // giftsub's {name} is the recipient, not the gifter, that's {gifter};
  // {amount} is the count, only present for a community gift.
  const SL_TOKENS: Record<string, string[]> = {
    follow: ["name", "img", "messageTemplate"],
    sub: ["name", "img", "message", "userMessage", "messageTemplate"],
    resub: [
      "name",
      "img",
      "months",
      "message",
      "userMessage",
      "messageTemplate",
    ],
    giftsub: [
      "gifter",
      "name",
      "amount",
      "img",
      "message",
      "userMessage",
      "messageTemplate",
    ],
    bits: [
      "name",
      "img",
      "amount",
      "message",
      "userMessage",
      "messageTemplate",
    ],
    powerup: [
      "name",
      "img",
      "powerUpName",
      "bitsSpent",
      "message",
      "userMessage",
      "messageTemplate",
    ],
    raid: ["name", "img", "count", "message", "userMessage", "messageTemplate"],
    tip: ["name", "img", "amount", "message", "userMessage", "messageTemplate"],
  };

  // The default Message Template text Streamlabs itself prefills per type
  // (support.streamlabs.com), used to seed the preview field below. tip has
  // no confirmed default, left blank rather than guessed.
  const SL_DEFAULT_TEMPLATES: Record<string, string> = {
    follow: "{name} just followed!",
    sub: "{name} just subscribed!",
    resub: "{name} just resubbed for {months} months!",
    giftsub: "{gifter} has gifted a sub to {name}",
    bits: "{name} cheered! x{amount}",
    powerup: "{name} redeemed {powerUpName} x{bitsSpent}",
    raid: "{name} is raiding with a party of {count}!",
  };

  // Which token the preview's generic "Value" field below feeds, per type.
  const SL_NUMERIC_TOKEN: Record<string, string> = {
    resub: "months",
    giftsub: "amount",
    bits: "amount",
    powerup: "bitsSpent",
    raid: "count",
    tip: "amount",
  };
  // #root fills the widget's own real size instead of the 1920x1080
  // alerts.html always assumes: AlertStage centers relative to #root, and a
  // hardcoded 1920x1080 here would center against a canvas the widget never
  // actually shows.
  // #alert-image-wrap/#alert-text-wrap carry the id-keyed tokens (see
  // SL_RICH_TOKEN_IDS below), so they can't sit inside the hidden
  // #zw-tokens div; hidden here with plain CSS instead, off-screen rather
  // than relying on an attribute Streamlabs' own injection might treat
  // differently.
  const SL_CSS = [
    "html,body{margin:0;height:100%;background:transparent;overflow:hidden}",
    "#root{position:fixed;inset:0;width:100%;height:100%;font-family:var(--font-body);color:var(--white)}",
    "#alert-image-wrap,#alert-text-wrap{position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none}",
  ].join("\n");

  // Layout variant options per Streamlabs box type, mirroring
  // src/components/variants.ts's per-AlertType lists (resub/giftsub share
  // sub's, since both map to the "sub" AlertType). Duplicated here rather
  // than imported, control.ts stays import-free like redemptions.ts.
  const SL_VARIANTS: Record<string, string[]> = {
    follow: ["stamp", "ticker", "glitch"],
    sub: ["card", "slab", "party"],
    resub: ["card", "slab", "party"],
    giftsub: ["card", "slab", "party"],
    bits: ["meter", "chip", "slab"],
    powerup: ["surge"],
    raid: ["squad", "siren", "band"],
    tip: ["receipt", "jar", "banner"],
  };

  // img/messageTemplate/userMessage substitute by element id, not text
  // matching (see readRichText's doc in streamlabs-alertbox.ts); the rest
  // go in the plain hidden token div instead.
  const SL_RICH_TOKEN_IDS: Record<string, string> = {
    img: "alert-image",
    messageTemplate: "alert-message",
    userMessage: "alert-user-message",
  };

  function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Without `values`, tokens render as their literal "{token}" placeholder
  // for Streamlabs to substitute (the copy-paste output). With `values`,
  // real text goes in instead, for the local preview below to run the real
  // JS box against, as if Streamlabs had already substituted it.
  function generateStreamlabsHtml(
    type: string,
    tier: string,
    variant: string,
    values?: Record<string, string>,
    debug?: boolean,
    durationSeconds?: string,
    avatarSource: "twitch" | "streamlabs" = "twitch",
  ): string {
    const tokens = SL_TOKENS[type] ?? [];
    const richTokens = tokens.filter((t) => t in SL_RICH_TOKEN_IDS);
    const simpleTokens = tokens.filter((t) => !(t in SL_RICH_TOKEN_IDS));
    const text = (t: string) =>
      values ? escapeHtml(values[t] ?? "") : `{${t}}`;

    const richBlock = richTokens.length
      ? [
          richTokens.includes("img")
            ? [
                '<div id="alert-image-wrap">',
                `  <div id="alert-image" data-token="img">${text("img")}</div>`,
                "</div>",
              ].join("\n")
            : "",
          '<div id="alert-text-wrap">',
          '  <div id="alert-text">',
          richTokens.includes("messageTemplate")
            ? `    <div id="alert-message" data-token="messageTemplate">${text("messageTemplate")}</div>`
            : "",
          richTokens.includes("userMessage")
            ? `    <div id="alert-user-message" data-token="userMessage">${text("userMessage")}</div>`
            : "",
          "  </div>",
          "</div>",
        ]
          .filter(Boolean)
          .join("\n")
      : "";

    const simpleSpans = simpleTokens
      .map((t) => `    <span data-token="${t}">${text(t)}</span>`)
      .join("\n");

    return [
      '<link rel="stylesheet" href="https://djzwackery.com/stream/styles.css" />',
      richBlock,
      `<div id="zw-tokens" data-alert-type="${type}" data-tier="${tier}" data-variant="${variant}"${durationSeconds ? ` data-duration="${durationSeconds}"` : ""}${debug ? ' data-debug="1"' : ""}${avatarSource === "streamlabs" ? ' data-avatar-source="streamlabs"' : ""} hidden>`,
      simpleSpans,
      "</div>",
      '<div id="root"></div>',
    ]
      .filter(Boolean)
      .join("\n");
  }

  function fillSlVariants(): void {
    const type = $<HTMLSelectElement>("sl-type").value;
    const select = $<HTMLSelectElement>("sl-variant");
    select.innerHTML = "";
    (SL_VARIANTS[type] ?? []).forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      select.appendChild(o);
    });
  }

  function updateStreamlabsCode(): void {
    const type = $<HTMLSelectElement>("sl-type").value;
    const tier = $<HTMLSelectElement>("sl-tier").value;
    const variant = $<HTMLSelectElement>("sl-variant").value;
    const debug = $<HTMLInputElement>("sl-debug").checked;
    const duration = $<HTMLInputElement>("sl-duration").value.trim();
    const avatarSource = $<HTMLInputElement>("sl-avatar-streamlabs").checked
      ? "streamlabs"
      : "twitch";
    $<HTMLTextAreaElement>("sl-html").value = generateStreamlabsHtml(
      type,
      tier,
      variant,
      undefined,
      debug,
      duration,
      avatarSource,
    );
    $<HTMLTextAreaElement>("sl-css").value = SL_CSS;
  }
  function fillSlDefaultTemplate(): void {
    const type = $<HTMLSelectElement>("sl-type").value;
    $<HTMLTextAreaElement>("sl-p-template").value =
      SL_DEFAULT_TEMPLATES[type] ?? "";
  }
  $<HTMLSelectElement>("sl-type").addEventListener("change", () => {
    fillSlVariants();
    updateStreamlabsCode();
    fillSlDefaultTemplate();
  });
  $<HTMLSelectElement>("sl-tier").addEventListener(
    "change",
    updateStreamlabsCode,
  );
  $<HTMLSelectElement>("sl-variant").addEventListener(
    "change",
    updateStreamlabsCode,
  );
  $<HTMLInputElement>("sl-debug").addEventListener(
    "change",
    updateStreamlabsCode,
  );
  $<HTMLInputElement>("sl-avatar-streamlabs").addEventListener(
    "change",
    updateStreamlabsCode,
  );
  $<HTMLInputElement>("sl-duration").addEventListener(
    "input",
    updateStreamlabsCode,
  );
  fillSlVariants();
  updateStreamlabsCode();
  fillSlDefaultTemplate();

  const API_TOKEN_STORAGE_KEY = "zw-api-token";

  const HOSTED_BUNDLE_URL =
    "https://djzwackery.com/stream/js/streamlabs-alertbox.bundle.js";

  // The JS box pasted into Streamlabs is a tiny loader, not the bundle
  // itself. It sets window.ZW_SL_TOKEN and injects a <script src> pulling
  // the real logic from djzwackery.com, so a fix only needs pushing here,
  // never re-pasting into Streamlabs. `?v=Date.now()` cache-busts every
  // fetch (see now-playing-theme.html's cache-buster for the same bug class).
  function renderSlJs(): void {
    const token = $<HTMLInputElement>("sl-token").value.trim();
    $<HTMLTextAreaElement>("sl-js").value = [
      `window.ZW_SL_TOKEN = ${JSON.stringify(token)};`,
      "(function () {",
      '  var s = document.createElement("script");',
      `  s.src = ${JSON.stringify(HOSTED_BUNDLE_URL)} + "?v=" + Date.now();`,
      "  document.body.appendChild(s);",
      "})();",
    ].join("\n");
  }

  // Used only by the sandboxed preview below, which runs this text directly
  // instead of the loader stub, so local edits show up without a push.
  let slJsBundle = "";

  const savedToken = localStorage.getItem(API_TOKEN_STORAGE_KEY);
  if (savedToken) {
    $<HTMLInputElement>("sl-token").value = savedToken;
  }
  renderSlJs();
  $<HTMLInputElement>("sl-token").addEventListener("input", () => {
    const value = $<HTMLInputElement>("sl-token").value.trim();
    if (value) {
      localStorage.setItem(API_TOKEN_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(API_TOKEN_STORAGE_KEY);
    }
    renderSlJs();
    previewStreamlabs();
  });

  fetch("js/streamlabs-alertbox.bundle.js", { cache: "no-store" })
    .then((r) => r.text())
    .then((js) => {
      slJsBundle = js;
      previewStreamlabs();
    })
    .catch(() =>
      console.warn(
        "[zw] could not load streamlabs-alertbox.bundle.js, run `npm run build` first",
      ),
    );

  $<HTMLButtonElement>("sl-html-copy").onclick = () => copyField("sl-html");
  $<HTMLButtonElement>("sl-css-copy").onclick = () => copyField("sl-css");
  $<HTMLButtonElement>("sl-js-copy").onclick = () => copyField("sl-js");

  // Substitutes {token} inside a Message Template string the same way
  // Streamlabs does before it ever reaches this file's own script, so the
  // preview below sees plain resolved text, same as the real widget.
  function substituteTokens(
    template: string,
    values: Record<string, string>,
  ): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) =>
      key in values ? values[key]! : match,
    );
  }

  // No fallback text for name/gifter: leaving either blank tests Streamlabs'
  // own anonymous-gift/no-recipient conditions, same as a token it never
  // substituted. The inputs still carry sensible defaults in the HTML for a
  // first-time, non-empty preview.
  function buildPreviewValues(type: string): Record<string, string> {
    const values: Record<string, string> = {
      name: $<HTMLInputElement>("sl-p-name").value.trim(),
      gifter: $<HTMLInputElement>("sl-p-gifter").value.trim(),
      powerUpName: $<HTMLInputElement>("sl-p-powerup").value.trim(),
      img: randomAvatar(),
      message: $<HTMLInputElement>("sl-p-message").value.trim(),
    };
    values.userMessage = values.message!;
    const numericKey = SL_NUMERIC_TOKEN[type];
    if (numericKey) {
      values[numericKey] =
        $<HTMLInputElement>("sl-p-value").value.trim() || "1";
    }
    const template = $<HTMLTextAreaElement>("sl-p-template").value.trim();
    if (template) {
      values.messageTemplate = substituteTokens(template, values);
    }
    return values;
  }

  // Runs the exact JS box against simulated, already-substituted tokens in
  // a sandboxed iframe, so this shows what Streamlabs will really render
  // (Message Template included) without ever pasting anything there.
  function previewStreamlabs(): void {
    if (!slJsBundle) {
      console.warn(
        "[zw] streamlabs-alertbox.bundle.js not loaded yet, try again in a moment",
      );
      return;
    }
    const type = $<HTMLSelectElement>("sl-type").value;
    const tier = $<HTMLSelectElement>("sl-tier").value;
    const variant = $<HTMLSelectElement>("sl-variant").value;
    const html = generateStreamlabsHtml(
      type,
      tier,
      variant,
      buildPreviewValues(type),
      true,
      $<HTMLInputElement>("sl-duration").value.trim(),
      $<HTMLInputElement>("sl-avatar-streamlabs").checked
        ? "streamlabs"
        : "twitch",
    );
    const safeBundle = slJsBundle.replace(/<\/script/gi, "<\\/script");
    const token = $<HTMLInputElement>("sl-token").value.trim();
    const doc = [
      '<!doctype html><html><head><meta charset="utf-8" />',
      '<link rel="stylesheet" href="styles.css" />',
      `<style>${SL_CSS}</style>`,
      "</head><body>",
      html,
      // Same global the real loader stub sets, just without the fetch.
      `<script>window.ZW_SL_TOKEN = ${JSON.stringify(token)};</script>`,
      `<script>${safeBundle}</script>`,
      "</body></html>",
    ].join("\n");
    $<HTMLIFrameElement>("sl-preview-frame").srcdoc = doc;
  }
  $<HTMLButtonElement>("sl-preview-fire").onclick = previewStreamlabs;

  // Mirrors the fields live, same as Streamlabs substituting a token the
  // moment you save it: no separate "apply" step to remember. Debounced so
  // fast typing doesn't restart the alert's animation on every keystroke.
  let previewDebounce: ReturnType<typeof setTimeout> | undefined;
  function schedulePreview(): void {
    clearTimeout(previewDebounce);
    previewDebounce = setTimeout(previewStreamlabs, 400);
  }
  [
    "sl-p-name",
    "sl-p-gifter",
    "sl-p-powerup",
    "sl-p-value",
    "sl-p-message",
    "sl-p-template",
    "sl-duration",
  ].forEach((id) => $(id).addEventListener("input", schedulePreview));
  $<HTMLSelectElement>("sl-type").addEventListener("change", schedulePreview);
  $<HTMLSelectElement>("sl-tier").addEventListener("change", schedulePreview);
  $<HTMLSelectElement>("sl-variant").addEventListener(
    "change",
    schedulePreview,
  );
  $<HTMLInputElement>("sl-avatar-streamlabs").addEventListener(
    "change",
    schedulePreview,
  );
})();
