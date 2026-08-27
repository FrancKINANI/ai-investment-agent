export const pageLoaders = {
  dashboardLayout: () => import("../components/DashboardLayout"),
  activity: () => import("../pages/Activity"),
  alerts: () => import("../pages/Alerts"),
  chat: () => import("../pages/Chat"),
  changelog: () => import("../pages/Changelog"),
  decisions: () => import("../pages/DecisionDesk"),
  mission: () => import("../pages/MissionControl"),
  notFound: () => import("../pages/NotFound"),
  portfolio: () => import("../pages/Portfolio"),
  settings: () => import("../pages/Settings"),
  tasks: () => import("../pages/Tasks"),
  welcome: () => import("../pages/Welcome"),
};

export const prefetchablePaths = ["/", "/chat", "/tasks", "/decisions", "/portfolio", "/wallets", "/mandates", "/platforms", "/connections", "/alerts", "/settings", "/activity", "/welcome", "/changelog"] as const;

const routeLoaders: Record<(typeof prefetchablePaths)[number], Array<() => Promise<unknown>>> = {
  "/": [pageLoaders.dashboardLayout, pageLoaders.mission],
  "/chat": [pageLoaders.dashboardLayout, pageLoaders.chat],
  "/tasks": [pageLoaders.dashboardLayout, pageLoaders.tasks],
  "/decisions": [pageLoaders.dashboardLayout, pageLoaders.decisions],
  "/portfolio": [pageLoaders.dashboardLayout, pageLoaders.portfolio],
  "/wallets": [pageLoaders.dashboardLayout, pageLoaders.portfolio],
  "/mandates": [pageLoaders.dashboardLayout, pageLoaders.portfolio],
  "/platforms": [pageLoaders.dashboardLayout, pageLoaders.portfolio],
  "/connections": [pageLoaders.dashboardLayout, pageLoaders.portfolio],
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
