import { h } from "vue";
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import CopyOrDownloadAsMarkdownButtons from "vitepress-plugin-llms/vitepress-components/CopyOrDownloadAsMarkdownButtons.vue";
import HeroCode from "./components/HeroCode.vue";
import HeroVideo from "./components/HeroVideo.vue";
import "./styles/brand.css";

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      "home-hero-image": () => h(HeroCode),
      "home-hero-after": () => h(HeroVideo),
    });
  },
  enhanceApp({ app }) {
    app.component("CopyOrDownloadAsMarkdownButtons", CopyOrDownloadAsMarkdownButtons);
  },
} satisfies Theme;
