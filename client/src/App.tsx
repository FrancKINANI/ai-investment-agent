import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import RouteLoadingBar from "./components/RouteLoadingBar";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { pageLoaders } from "./lib/routePrefetch";

const DashboardLayout = lazy(pageLoaders.dashboardLayout);
const Activity = lazy(pageLoaders.activity);
const Alerts = lazy(pageLoaders.alerts);
const Chat = lazy(pageLoaders.chat);
const Changelog = lazy(pageLoaders.changelog);
const CommandCenter = lazy(pageLoaders.command);
const Connections = lazy(pageLoaders.connections);
const Mandates = lazy(pageLoaders.mandates);
const NotFound = lazy(pageLoaders.notFound);
const Platforms = lazy(pageLoaders.platforms);
const Settings = lazy(pageLoaders.settings);
const Wallets = lazy(pageLoaders.wallets);
const Welcome = lazy(pageLoaders.welcome);

function Router() {
  const Workspace = ({ children }: { children: React.ReactNode }) => <DashboardLayout>{children}</DashboardLayout>;
  return (
    <Suspense fallback={<><RouteLoadingBar /><div className="os-loading">Loading Ledgerline…</div></>}><Switch>
      <Route path={"/welcome"} component={Welcome} />
      <Route path={"/changelog"} component={Changelog} />
      <Route path={"/"}><Workspace><CommandCenter /></Workspace></Route>
      <Route path={"/chat"}><Workspace><Chat /></Workspace></Route>
      <Route path={"/wallets"}><Workspace><Wallets /></Workspace></Route>
      <Route path={"/mandates"}><Workspace><Mandates /></Workspace></Route>
      <Route path={"/platforms"}><Workspace><Platforms /></Workspace></Route>
      <Route path={"/connections"}><Workspace><Connections /></Workspace></Route>
      <Route path={"/alerts"}><Workspace><Alerts /></Workspace></Route>
      <Route path={"/settings"}><Workspace><Settings /></Workspace></Route>
      <Route path={"/activity"}><Workspace><Activity /></Workspace></Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch></Suspense>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
