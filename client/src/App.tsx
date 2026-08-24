import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const DashboardLayout = lazy(() => import("./components/DashboardLayout"));
const Activity = lazy(() => import("./pages/Activity"));
const Chat = lazy(() => import("./pages/Chat"));
const CommandCenter = lazy(() => import("./pages/CommandCenter"));
const Connections = lazy(() => import("./pages/Connections"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Settings = lazy(() => import("./pages/Settings"));
const Wallets = lazy(() => import("./pages/Wallets"));
const Welcome = lazy(() => import("./pages/Welcome"));

function Router() {
  const Workspace = ({ children }: { children: React.ReactNode }) => <DashboardLayout>{children}</DashboardLayout>;
  return (
    <Suspense fallback={<div className="os-loading">Loading Ledgerline…</div>}><Switch>
      <Route path={"/welcome"} component={Welcome} />
      <Route path={"/"}><Workspace><CommandCenter /></Workspace></Route>
      <Route path={"/chat"}><Workspace><Chat /></Workspace></Route>
      <Route path={"/wallets"}><Workspace><Wallets /></Workspace></Route>
      <Route path={"/connections"}><Workspace><Connections /></Workspace></Route>
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
