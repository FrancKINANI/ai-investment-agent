export const pageLoaders = {
  dashboardLayout: () => import("../components/DashboardLayout"),
  activity: () => import("../pages/Activity"),
  alerts: () => import("../pages/Alerts"),
  chat: () => import("../pages/Chat"),
  changelog: () => import("../pages/Changelog"),
  command: () => import("../pages/CommandCenter"),
  connections: () => import("../pages/Connections"),
  mandates: () => import("../pages/Mandates"),
  notFound: () => import("../pages/NotFound"),
  platforms: () => import("../pages/Platforms"),
  settings: () => import("../pages/Settings"),
  wallets: () => import("../pages/Wallets"),
  welcome: () => import("../pages/Welcome"),
};

export const prefetchablePaths = ["/", "/chat", "/wallets", "/mandates", "/platforms", "/connections", "/alerts", "/settings", "/activity", "/welcome", "/changelog"] as const;

const routeLoaders: Record<(typeof prefetchablePaths)[number], Array<() => Promise<unknown>>> = {
  "/": [pageLoaders.dashboardLayout, pageLoaders.command],
  "/chat": [pageLoaders.dashboardLayout, pageLoaders.chat],
  "/wallets": [pageLoaders.dashboardLayout, pageLoaders.wallets],
  "/mandates": [pageLoaders.dashboardLayout, pageLoaders.mandates],
  "/platforms": [pageLoaders.dashboardLayout, pageLoaders.platforms],
  "/connections": [pageLoaders.dashboardLayout, pageLoaders.connections],
  "/alerts": [pageLoaders.dashboardLayout, pageLoaders.alerts],
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
