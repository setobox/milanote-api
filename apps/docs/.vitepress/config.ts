import { defineConfig } from "vitepress";

export default defineConfig({
  lang: "zh-CN",
  title: "Milanote API",
  titleTemplate: ":title · Milanote API",
  description: "把 Milanote 公开共享画板整理为可验证的 JSON。",
  cleanUrls: true,
  ignoreDeadLinks: ["/playground"],
  head: [
    ["meta", { name: "theme-color", content: "#f0efe8" }],
    ["meta", { name: "color-scheme", content: "light dark" }],
    [
      "script",
      {},
      `(() => {
        try {
          const preference = localStorage.getItem("vitepress-theme-appearance");
          const isDark = preference === "dark" || (preference !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
          document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#141413" : "#f0efe8");
        } catch {}
      })();`,
    ],
  ],
  markdown: {
    lineNumbers: true,
  },
  themeConfig: {
    siteTitle: "Milanote API",
    nav: [
      { text: "指南", link: "/guide/getting-started" },
      { text: "API", link: "/reference/http-api" },
      { text: "字段筛选", link: "/reference/field-selectors" },
      { text: "数据模型", link: "/reference/schemas" },
      { text: "Playground", link: "/playground", target: "_self" },
    ],
    sidebar: [
      {
        text: "开始使用",
        items: [
          { text: "快速开始", link: "/guide/getting-started" },
          { text: "Playground", link: "/guide/playground" },
        ],
      },
      {
        text: "HTTP API",
        items: [
          { text: "Search 与 Detail", link: "/reference/http-api" },
          { text: "字段选择器", link: "/reference/field-selectors" },
          { text: "错误码", link: "/reference/errors" },
          { text: "安全与缓存", link: "/guide/security" },
        ],
      },
      {
        text: "开发者参考",
        items: [
          { text: "Zod 数据模型", link: "/reference/schemas" },
          { text: "Parser SDK", link: "/reference/parser" },
          { text: "Cloudflare 部署", link: "/guide/deployment" },
        ],
      },
    ],
    search: {
      provider: "local",
      options: {
        miniSearch: {
          searchOptions: {
            fuzzy: 0.2,
            prefix: true,
          },
        },
      },
    },
    outline: {
      level: [2, 3],
      label: "本页内容",
    },
    docFooter: {
      prev: "上一页",
      next: "下一页",
    },
    darkModeSwitchLabel: "外观",
    lightModeSwitchTitle: "切换到浅色模式",
    darkModeSwitchTitle: "切换到深色模式",
    sidebarMenuLabel: "菜单",
    returnToTopLabel: "返回顶部",
    notFound: {
      title: "页面不存在",
      quote: "你访问的文档地址不存在或已经移动。",
      linkLabel: "返回首页",
      linkText: "回到文档首页",
    },
    footer: {
      message: "Milanote 上游接口未公开；生产环境请做好兼容性预案。",
    },
  },
});
