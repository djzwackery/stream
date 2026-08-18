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

  // Tokens Streamlabs' Alert Box substitutes per alert type (verified against
  // github.com/neferent/streamlabs-custom-code-starter's real templates).
  // profile_image is included defensively on every type even though it isn't
  // in that reference material: streamlabs-alertbox.ts treats any token that
  // comes through still shaped like "{token}" as absent, so an unrecognised
  // one costs nothing if Streamlabs doesn't actually support it.
  const SL_TOKENS: Record<string, string[]> = {
    follow: ["name", "profile_image", "img", "messageTemplate"],
    sub: [
      "name",
      "profile_image",
      "img",
      "message",
      "userMessage",
      "messageTemplate",
    ],
    resub: [
      "name",
      "profile_image",
      "img",
      "amount",
      "message",
      "userMessage",
      "messageTemplate",
    ],
    giftsub: ["name", "count"],
    bits: [
      "name",
      "profile_image",
      "img",
      "amount",
      "message",
      "userMessage",
      "messageTemplate",
    ],
    raid: ["name", "profile_image", "img", "count", "messageTemplate"],
    tip: [
      "name",
      "profile_image",
      "img",
      "amount",
      "message",
      "userMessage",
      "messageTemplate",
    ],
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

  function generateStreamlabsHtml(
    type: string,
    tier: string,
    variant: string,
  ): string {
    const tokens = SL_TOKENS[type] ?? [];
    const richTokens = tokens.filter((t) => t in SL_RICH_TOKEN_IDS);
    const simpleTokens = tokens.filter((t) => !(t in SL_RICH_TOKEN_IDS));

    const richBlock = richTokens.length
      ? [
          richTokens.includes("img")
            ? [
                '<div id="alert-image-wrap">',
                `  <div id="alert-image" data-token="img">{img}</div>`,
                "</div>",
              ].join("\n")
            : "",
          '<div id="alert-text-wrap">',
          '  <div id="alert-text">',
          richTokens.includes("messageTemplate")
            ? `    <div id="alert-message" data-token="messageTemplate">{messageTemplate}</div>`
            : "",
          richTokens.includes("userMessage")
            ? `    <div id="alert-user-message" data-token="userMessage">{userMessage}</div>`
            : "",
          "  </div>",
          "</div>",
        ]
          .filter(Boolean)
          .join("\n")
      : "";

    const simpleSpans = simpleTokens
      .map((t) => `    <span data-token="${t}">{${t}}</span>`)
      .join("\n");

    return [
      '<link rel="stylesheet" href="https://djzwackery.com/stream/styles.css" />',
      richBlock,
      `<div id="zw-tokens" data-alert-type="${type}" data-tier="${tier}" data-variant="${variant}" hidden>`,
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
    $<HTMLTextAreaElement>("sl-html").value = generateStreamlabsHtml(
      type,
      tier,
      variant,
    );
    $<HTMLTextAreaElement>("sl-css").value = SL_CSS;
  }
  $<HTMLSelectElement>("sl-type").addEventListener("change", () => {
    fillSlVariants();
    updateStreamlabsCode();
  });
  $<HTMLSelectElement>("sl-tier").addEventListener(
    "change",
    updateStreamlabsCode,
  );
  $<HTMLSelectElement>("sl-variant").addEventListener(
    "change",
    updateStreamlabsCode,
  );
  fillSlVariants();
  updateStreamlabsCode();

  // Matches the placeholder streamlabs-alertbox.ts ships with (that file's
  // own source is the other place this exact string is defined).
  const API_TOKEN_PLACEHOLDER = "PASTE_YOUR_API_TOKEN_HERE";
  const API_TOKEN_STORAGE_KEY = "zw-api-token";

  // The JS box doesn't vary per type (streamlabs-alertbox.ts reads the type
  // off data-alert-type at run time), so it's fetched once, as the
  // esbuild-bundled self-contained build (Streamlabs runs it standalone, it
  // can't resolve `import`s). Kept separate from what's shown: the token
  // substitution below re-derives the displayed value each time instead of
  // mutating it in place.
  let slJsBundle = "";

  function renderSlJs(): void {
    const token = $<HTMLInputElement>("sl-token").value.trim();
    $<HTMLTextAreaElement>("sl-js").value = token
      ? slJsBundle.replace(API_TOKEN_PLACEHOLDER, token)
      : slJsBundle;
  }

  const savedToken = localStorage.getItem(API_TOKEN_STORAGE_KEY);
  if (savedToken) {
    $<HTMLInputElement>("sl-token").value = savedToken;
  }
  $<HTMLInputElement>("sl-token").addEventListener("input", () => {
    const value = $<HTMLInputElement>("sl-token").value.trim();
    if (value) {
      localStorage.setItem(API_TOKEN_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(API_TOKEN_STORAGE_KEY);
    }
    renderSlJs();
  });

  fetch("js/streamlabs-alertbox.bundle.js", { cache: "no-store" })
    .then((r) => r.text())
    .then((js) => {
      slJsBundle = js;
      renderSlJs();
    })
    .catch(() =>
      console.warn(
        "[zw] could not load streamlabs-alertbox.bundle.js, run `npm run build` first",
      ),
    );

  $<HTMLButtonElement>("sl-html-copy").onclick = () => copyField("sl-html");
  $<HTMLButtonElement>("sl-css-copy").onclick = () => copyField("sl-css");
  $<HTMLButtonElement>("sl-js-copy").onclick = () => copyField("sl-js");
})();
