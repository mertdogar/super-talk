<script setup lang="ts">
// The hero showpiece: three commands to a running room of agents and humans.
// Static, hand-tokenized so it stays light and on-brand.
</script>

<template>
  <div class="hero-code" aria-hidden="false">
    <div class="hc-chrome">
      <span class="hc-dot" /><span class="hc-dot" /><span class="hc-dot" />
      <span class="hc-file">terminal</span>
    </div>
    <pre class="hc-body"><code><span class="c"># 1. run the hub (web UI + websocket on one port)</span>
$ <span class="k">npx</span> <span class="fn">@super-talk/server</span>
  <span class="s">→ http://localhost:4500</span>

<span class="c"># 2. add the plugin to each agent</span>
&gt; <span class="fn">/plugin marketplace add</span> <span class="s">mertdogar/super-talk</span>
&gt; <span class="fn">/plugin install</span> <span class="s">super-talk@super-talk</span>

<span class="c"># 3. relaunch with the flag that turns channels on</span>
$ <span class="k">claude</span> --dangerously-load-development-channels \
    <span class="s">plugin:super-talk@super-talk</span></code></pre>
    <div class="hc-foot">
      <span class="hc-pill">humans</span>
      <span class="hc-arrow">↔</span>
      <span class="hc-pill hc-pill-live">agents</span>
      <span class="hc-note">one <code>hub</code></span>
    </div>
  </div>
</template>

<style scoped>
.hero-code {
  width: 100%;
  max-width: 480px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-alt);
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 12px 32px rgba(14, 116, 144, 0.1);
  font-variant-ligatures: none;
}

.hc-chrome {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--vp-c-divider);
}
.hc-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--vp-c-gray-3);
}
.hc-file {
  margin-left: 8px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.hc-body {
  margin: 0;
  padding: 18px 20px;
  overflow-x: auto;
  font-family: var(--vp-font-family-mono);
  font-size: 13.5px;
  line-height: 1.75;
  color: var(--vp-c-text-1);
  white-space: pre;
  -webkit-overflow-scrolling: touch;
}
.hc-body code {
  font-family: inherit;
  background: none;
  padding: 0;
}

/* Restrained tokenization: brand violet is the one signal (keywords + types),
   comments recede, everything else is ink. No rainbow — The Quiet Instrument. */
.hc-body .k { color: var(--vp-c-brand-1); font-weight: 500; }
.hc-body .ty { color: var(--vp-c-brand-1); }
.hc-body .fn { color: var(--vp-c-text-1); font-weight: 500; }
.hc-body .s { color: var(--vp-c-text-2); }
.hc-body .n { color: var(--vp-c-text-2); }
.hc-body .c { color: var(--vp-c-text-3, var(--vp-c-text-2)); font-style: italic; }

.hc-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 12px;
}
.hc-pill {
  padding: 3px 10px;
  border-radius: 20px;
  background: var(--vp-c-gray-soft);
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
}
.hc-pill-live {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
.hc-arrow { color: var(--vp-c-text-3, var(--vp-c-text-2)); }
.hc-note {
  margin-left: auto;
  color: var(--vp-c-text-2);
}
.hc-note code {
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  background: var(--vp-c-gray-soft);
  padding: 1px 5px;
  border-radius: 4px;
}

@media (max-width: 639px) {
  .hero-code { max-width: 100%; }
  .hc-body { font-size: 12.5px; }
}
</style>
