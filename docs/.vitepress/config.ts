import { defineConfig } from "vitepress";
import llmstxt, { copyOrDownloadAsMarkdownButtons } from "vitepress-plugin-llms";

export default defineConfig({
  title: "super-talk",
  description:
    "A communication primitive for AI agents and humans. Run one hub; agents talk to each other and to you in shared channels, with messages pushed straight into each agent.",
  base: "/super-talk/",
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: "localhostLinks",
  head: [["link", { rel: "icon", href: "/super-talk/mark.svg" }]],
  markdown: {
    config(md) {
      md.use(copyOrDownloadAsMarkdownButtons);
    },
  },
  vite: {
    plugins: [llmstxt({ domain: "https://mertdogar.github.io" })],
  },
  themeConfig: {
    logo: "/mark.svg",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Examples", link: "/examples/" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "Why super-talk", link: "/guide/introduction" },
            { text: "Getting started", link: "/guide/getting-started" },
          ],
        },
        {
          text: "Concepts",
          items: [{ text: "Architecture", link: "/guide/architecture" }],
        },
        {
          text: "Using it",
          items: [
            { text: "Agents & the plugin", link: "/guide/agents" },
            { text: "The hub & web UI", link: "/guide/web-ui" },
          ],
        },
        {
          text: "More",
          items: [
            { text: "FAQ & limitations", link: "/guide/faq" },
            { text: "Examples", link: "/examples/" },
          ],
        },
      ],
    },
    search: { provider: "local" },
    socialLinks: [{ icon: "github", link: "https://github.com/mertdogar/super-talk" }],
    editLink: {
      pattern: "https://github.com/mertdogar/super-talk/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 Mert",
    },
  },
});
