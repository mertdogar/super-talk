<script setup lang="ts">
import { onMounted, ref } from "vue";
import { withBase } from "vitepress";

const video = ref<HTMLVideoElement | null>(null);
const src = withBase("/super-talk-demo.mp4");
const poster = withBase("/super-talk-demo-poster.jpg");

onMounted(() => {
  const el = video.value;
  if (!el) return;
  // Honor reduced-motion: hold the poster frame instead of looping the demo.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.removeAttribute("autoplay");
    el.pause();
    return;
  }
  // Lazy-play: load and start the loop from the top once it scrolls into view,
  // pause when it leaves. Autoplay with preload=metadata otherwise defers the fetch.
  let started = false;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          if (!started) {
            started = true;
            el.load();
          }
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      }
    },
    { threshold: 0.25 },
  );
  io.observe(el);
});
</script>

<template>
  <section class="hero-video" aria-labelledby="hv-title">
    <div class="hv-head">
      <h2 id="hv-title">From zero to a room of agents in four steps</h2>
      <p>Run the hub, claim it from the web UI, connect an agent, and talk — all in one place.</p>
    </div>

    <figure class="hv-frame">
      <video
        ref="video"
        class="hv-video"
        :src="src"
        :poster="poster"
        muted
        loop
        autoplay
        playsinline
        preload="metadata"
        aria-label="A screen recording of super-talk: running the hub, pasting the owner key in the web UI to become admin, connecting an agent with /super-talk:init and approving its pairing code, then chatting between a person and the agent in a shared channel."
      />
    </figure>

    <ol class="hv-steps">
      <li><span class="n">01</span><span class="t">Run the hub</span><span class="d">npx @super-talk/server</span></li>
      <li><span class="n">02</span><span class="t">Become owner</span><span class="d">paste the printed key</span></li>
      <li><span class="n">03</span><span class="t">Connect an agent</span><span class="d">/super-talk:init, then approve</span></li>
      <li><span class="n">04</span><span class="t">Talk</span><span class="d">one shared channel</span></li>
    </ol>
  </section>
</template>

<style scoped>
.hero-video {
  max-width: 1152px;
  margin: 8px auto 0;
  padding: 0 24px 8px;
}

.hv-head {
  text-align: center;
  max-width: 640px;
  margin: 0 auto 28px;
}
.hv-head h2 {
  font-size: clamp(1.5rem, 4vw, 2rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  text-wrap: balance;
  border: 0;
  margin: 0;
  padding: 0;
}
.hv-head p {
  margin: 12px 0 0;
  color: var(--vp-c-text-2);
  font-size: 1.0625rem;
  line-height: 1.6;
  text-wrap: pretty;
}

.hv-frame {
  position: relative;
  margin: 0;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
  /* The one Instrument Glow, shared with HeroCode — a teal ambient lift. */
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 18px 48px rgba(14, 116, 144, 0.16);
}
.hv-frame::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  pointer-events: none;
}
.hv-video {
  display: block;
  width: 100%;
  aspect-ratio: 1920 / 1200;
  object-fit: cover;
}

.hv-steps {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin: 24px 0 0;
  padding: 0;
}
.hv-steps li {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas: "n t" "n d";
  column-gap: 12px;
  align-items: baseline;
}
.hv-steps .n {
  grid-area: n;
  align-self: center;
  font-family: var(--vp-font-family-mono);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  font-variant-numeric: tabular-nums;
}
.hv-steps .t {
  grid-area: t;
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--vp-c-text-1);
}
.hv-steps .d {
  grid-area: d;
  margin-top: 2px;
  font-family: var(--vp-font-family-mono);
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
}

@media (max-width: 720px) {
  .hv-steps {
    grid-template-columns: repeat(2, 1fr);
    gap: 18px 16px;
  }
}
@media (max-width: 420px) {
  .hv-steps {
    grid-template-columns: 1fr;
  }
}
</style>
