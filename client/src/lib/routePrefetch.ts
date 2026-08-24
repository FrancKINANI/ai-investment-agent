export const pageLoaders = {
  dashboardLayout: () => import("../components/DashboardLayout"),
  activity: () => import("../pages/Activity"),
  chat: () => import("../pages/Chat"),
  changelog: () => import("../pages/Changelog"),
  command: () => import("../pages/CommandCenter"),
  connections: () => import("../pages/Connections"),
  notFound: () => import("../pages/NotFound"),
  settings: () => import("../pages/Settings"),
  wallets: () => import("../pages/Wallets"),
  welcome: () => import("../pages/Welcome"),
};

export const prefetchablePaths = ["/", "/chat", "/wallets", "/connections", "/settings", "/activity", "/welcome", "/changelog"] as const;

const routeLoaders: Record<(typeof prefetchablePaths)[number], Array<() => Promise<unknown>>> = {
  "/": [pageLoaders.dashboardLayout, pageLoaders.command],
  "/chat": [pageLoaders.dashboardLayout, pageLoaders.chat],
  "/wallets": [pageLoaders.dashboardLayout, pageLoaders.wallets],
  "/connections": [pageLoaders.dashboardLayout, pageLoaders.connections],
  "/settings": [pageLoaders.dashboardLayout, pageLoaders.settings],
  "/activity": [pageLoaders.dashboardLayout, pageLoaders.activity],
  "/welcome": [pageLoaders.welcome],
  "/changelog": [pageLoaders.changelog],
};

const requested = new Set<string>();

export function prefetchRoute(path: string, enabled = true) {
  if (!enabled) return;
  const loaders = routeLoaders[path as keyof typeof routeLoaders];
  if (!loaders || requested.has(path)) return;
  requested.add(path);
  void Promise.all(loaders.map((load) => load())).catch(() => requested.delete(path));
}
