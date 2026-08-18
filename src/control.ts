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

  function payload(type: AlertType, variant?: string): RawAlertPayload {
    const o: RawAlertPayload = {
      type,
      variant: variant || $<HTMLSelectElement>("variant").value || undefined,
      name: $<HTMLInputElement>("name").value || "someone",
      value: parseFloat($<HTMLInputElement>("value").value) || 1,
      message: $<HTMLInputElement>("message").value || undefined,
      plan: 2,
      tier: $<HTMLSelectElement>("tier").value as AlertTier,
    };
    if (type === "redeem") {
      o.reward = $<HTMLSelectElement>("reward").value;
      o.message = undefined;
    }
    return o;
  }

  TYPES.forEach((t) => {
    const b = document.createElement("button");
    b.textContent = t;
    b.onclick = () => send(payload(t));
    $("buttons").appendChild(b);
  });

  function fillVariants(): void {
    const s = $<HTMLSelectElement>("variant");
    s.innerHTML = '<option value="">cycle</option>';
    [...new Set(TYPES.flatMap((t) => VAR[t]))].forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      s.appendChild(o);
    });
  }
  fillVariants();

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
})();
