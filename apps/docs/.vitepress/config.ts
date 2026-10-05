import { defineConfig } from "vitepress";

export default defineConfig({
  base: process.env.PUBLIC_BASE_PATH ?? "/",
  lang: "zh-CN",
  title: "Milanote API",
  titleTemplate: ":title · Milanote API",
  description: "把 Milanote 公开共享画板整理为可验证的 JSON。",
  cleanUrls: false,
  ignoreDeadLinks: ["/playground/"],
  head: [
    ["meta", { name: "theme-color", content: "#faf9f6" }],
    ["meta", { name: "color-scheme", content: "light dark" }],
    [
      "script",
      {},
      `(() => {
        try {
          const preference = localStorage.getItem("vitepress-theme-appearance");
          const isDark = preference === "dark" || (preference !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
          document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#1c1b19" : "#faf9f6");
        } catch {}
      })();`,
    ],
  ],
  markdown: {
    lineNumbers: true,
    config(md) {
      const renderLink = md.renderer.rules.link_open;
      md.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
        const token = tokens[index]!;
        const href = token.attrGet("href");
        // Keep deployment files as downloads; otherwise unknown suffixes become .html pages.
        if (href?.startsWith("/templates/")) {
          token.attrSet("href", `${process.env.PUBLIC_BASE_PATH ?? "/"}${href.slice(1)}`);
          token.attrSet("download", "");
          return renderer.renderToken(tokens, index, options);
        }
        return renderLink
          ? renderLink(tokens, index, options, env, renderer)
          : renderer.renderToken(tokens, index, options);
      };
    },
  },
  transformHead({ pageData }) {
    if (pageData.relativePath !== "index.md") return [];
    return [
      [
        "meta",
        { "http-equiv": "refresh", content: `0;url=${process.env.PUBLIC_BASE_PATH ?? "/"}docs/` },
      ],
    ];
  },
  themeConfig: {
    logoLink: `${process.env.PUBLIC_BASE_PATH ?? "/"}docs/`,
    siteTitle: "Milanote API",
    nav: [
      { text: "指南", link: "/guide/getting-started" },
      { text: "API", link: "/reference/http-api" },
      { text: "字段筛选", link: "/reference/field-selectors" },
      { text: "数据模型", link: "/reference/schemas" },
      { text: "调试台", link: "/playground/", target: "_self" },
    ],
    sidebar: [
      {
        text: "开始使用",
        items: [
          { text: "快速开始", link: "/guide/getting-started" },
          { text: "调试台", link: "/guide/playground" },
        ],
      },
      {
        text: "HTTP API",
        items: [
          { text: "解析 API", link: "/reference/http-api" },
          { text: "字段选择器", link: "/reference/field-selectors" },
          { text: "错误码", link: "/reference/errors" },
          { text: "隐私与数据边界", link: "/guide/security" },
        ],
      },
      {
        text: "开发者参考",
        items: [
          { text: "Zod 数据模型", link: "/reference/schemas" },
          { text: "Parser SDK", link: "/reference/parser" },
          { text: "部署指南", link: "/guide/deployment" },
          { text: "GitHub Actions 采集", link: "/guide/actions" },
          { text: "Workers 定时采集", link: "/guide/scheduled-worker" },
          { text: "Linux 与 SQLite", link: "/guide/linux" },
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
