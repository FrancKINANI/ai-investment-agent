import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Activity from "./pages/Activity";
import Chat from "./pages/Chat";
import CommandCenter from "./pages/CommandCenter";
import Connections from "./pages/Connections";
import Home from "./pages/Home";
import Settings from "./pages/Settings";
import Welcome from "./pages/Welcome";
import Wallets from "./pages/Wallets";

function Router() {
  const Workspace = ({ children }: { children: React.ReactNode }) => <DashboardLayout>{children}</DashboardLayout>;
  return (
    <Switch>
      <Route path={"/welcome"} component={Welcome} />
      <Route path={"/"}><Workspace><CommandCenter /></Workspace></Route>
      <Route path={"/chat"}><Workspace><Chat /></Workspace></Route>
      <Route path={"/wallets"}><Workspace><Wallets /></Workspace></Route>
      <Route path={"/connections"}><Workspace><Connections /></Workspace></Route>
      <Route path={"/settings"}><Workspace><Settings /></Workspace></Route>
      <Route path={"/activity"}><Workspace><Activity /></Workspace></Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
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
