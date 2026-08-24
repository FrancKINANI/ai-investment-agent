import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import React, { useEffect, useMemo, useState } from "react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Activity, Bell, Bot, Cable, ChevronRight, Keyboard, Landmark, LogOut, MessageSquareText, Moon, Settings2, Sun, UserRound, WalletCards, X } from "lucide-react";
import { useLocation } from "wouter";

const menuItems = [
  { icon: Bot, label: "Command", path: "/" },
  { icon: MessageSquareText, label: "Chat", path: "/chat" },
  { icon: WalletCards, label: "Wallets & mandates", path: "/wallets" },
  { icon: Cable, label: "Connections", path: "/connections" },
  { icon: Settings2, label: "Agent & policy", path: "/settings" },
  { icon: Activity, label: "Activity log", path: "/activity" },
];

function WorkspaceTopbar({
  location,
  isAuthenticated,
  theme,
  toggleTheme,
}: {
  location: string;
  isAuthenticated: boolean;
  theme: "light" | "dark";
  toggleTheme: () => void;
}) {
  const { isMobile, openMobile, state } = useSidebar();
  const drawerLabel = isMobile ? (openMobile ? "Close navigation" : "Open navigation") : state === "collapsed" ? "Show navigation" : "Hide navigation";
  const shortcutLabel = isMobile ? "Navigation drawer" : `${drawerLabel} · ⌘/Ctrl B`;

  return <header className="os-topbar"><div className="os-trail"><SidebarTrigger className="os-sidebar-trigger" aria-label={drawerLabel} title={shortcutLabel} /><span className="os-mobile-drawer-label" aria-live="polite">{drawerLabel}</span><span>ledgerline</span><b>{menuItems.find((item) => item.path === location)?.label ?? "Workspace"}</b></div><div className="os-topbar-status"><span><i /> agents ready</span><span className="os-mode-chip">simulation default</span><span className="os-shortcut-hint" title="Use Command or Control plus B to hide or show navigation"><Keyboard size={12} /><kbd>⌘</kbd><kbd>B</kbd></span><button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}</button>{!isAuthenticated && <Button size="sm" onClick={startLogin}>Sign in</Button>}</div></header>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const safeToggleTheme = toggleTheme ?? (() => undefined);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDetailsOpen, setProfileDetailsOpen] = useState(false);
  const activityQuery = trpc.history.list.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchInterval: 30_000 });
  const activityKey = user?.openId ? `ledgerline.activity.last-seen.${user.openId}` : "";
  const [lastSeenAt, setLastSeenAt] = useState<number | null>(null);
  const activityEntries = activityQuery.data ?? [];
  const newestActivityAt = activityEntries[0] ? new Date(activityEntries[0].createdAt).getTime() : null;
  const unreadActivityCount = useMemo(() => lastSeenAt === null ? 0 : activityEntries.filter((entry) => new Date(entry.createdAt).getTime() > lastSeenAt).length, [activityEntries, lastSeenAt]);

  useEffect(() => {
    if (!activityKey || lastSeenAt !== null) return;
    const stored = window.localStorage.getItem(activityKey);
    setLastSeenAt(stored ? Number(stored) : newestActivityAt);
  }, [activityKey, lastSeenAt, newestActivityAt]);

  const markActivityRead = () => {
    if (newestActivityAt === null) return;
    setLastSeenAt(newestActivityAt);
    if (activityKey) window.localStorage.setItem(activityKey, String(newestActivityAt));
  };

  const navigate = (path: string) => {
    if (path === "/activity") markActivityRead();
    setLocation(path);
  };

  if (loading) return <div className="os-loading">Preparing your operating system…</div>;

  return <SidebarProvider defaultOpen>
    <div className="os-layout">
      <Sidebar collapsible="offcanvas" className="os-sidebar">
        <SidebarHeader className="os-sidebar-brand"><div className="os-logo-mark"><Landmark size={17} /></div><div className="os-brand-copy"><strong>ledgerline</strong><span>autonomous investment os</span></div></SidebarHeader>
        <SidebarContent className="os-sidebar-content"><div className="os-rail-label">Operating system</div><SidebarMenu className="os-nav">{menuItems.map((item) => <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={location === item.path} tooltip={item.label} onClick={() => navigate(item.path)}><item.icon size={16} /><span>{item.label}</span>{item.path === "/activity" && unreadActivityCount > 0 && <b className="os-unread-badge" aria-label={`${unreadActivityCount} unread activity updates`}>{unreadActivityCount > 9 ? "9+" : unreadActivityCount}</b>}</SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu><div className="os-rail-status"><span><i />AUTONOMY MODE</span><strong>SIMULATION DEFAULT</strong><small>Real mode requires a named mandate.</small></div></SidebarContent>
        <SidebarFooter className="os-sidebar-footer">{isAuthenticated ? <div className="os-user"><DropdownMenu open={profileOpen} onOpenChange={setProfileOpen}><DropdownMenuTrigger asChild><button className="os-profile-button" type="button" aria-label="Open owner profile menu"><Avatar><AvatarFallback>{user?.name?.slice(0, 1).toUpperCase() ?? "O"}</AvatarFallback></Avatar><span><strong>{user?.name ?? "Owner"}</strong><small>Owner profile & settings</small></span><ChevronRight size={14} /></button></DropdownMenuTrigger><DropdownMenuContent className="os-profile-menu" side="top" align="start" sideOffset={10}><DropdownMenuLabel><strong>{user?.name ?? "Owner"}</strong><span>Personal investment operator</span></DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => setProfileDetailsOpen(true)}><UserRound size={14} /> Profile details</DropdownMenuItem><DropdownMenuItem onSelect={() => navigate("/settings")}><Settings2 size={14} /> Agent & Policy</DropdownMenuItem><DropdownMenuItem onSelect={safeToggleTheme}>{theme === "dark" ? <Sun size={14} /> : <Moon size={14} />} Use {theme === "dark" ? "light" : "dark"} mode</DropdownMenuItem><DropdownMenuItem onSelect={() => { markActivityRead(); navigate("/activity"); }}><Bell size={14} /> Activity log {unreadActivityCount > 0 && <span className="os-profile-unread">{unreadActivityCount} new</span>}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="os-signout-item" onSelect={logout}><LogOut size={14} /> Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu>{profileDetailsOpen && <section className="os-profile-card" role="dialog" aria-label="Owner profile"><header><span>OWNER PROFILE</span><button type="button" onClick={() => setProfileDetailsOpen(false)} aria-label="Close owner profile"><X size={13} /></button></header><div><Avatar><AvatarFallback>{user?.name?.slice(0, 1).toUpperCase() ?? "O"}</AvatarFallback></Avatar><span><strong>{user?.name ?? "Owner"}</strong><small>{user?.email ?? "Personal investment operator"}</small></span></div><p>This local panel does not expose wallet credentials, venue keys, or signing authority.</p><Button type="button" variant="outline" size="sm" onClick={() => { setProfileDetailsOpen(false); navigate("/settings"); }}>Open Agent & Policy</Button></section>}</div> : <Button className="os-signin" onClick={startLogin}>Sign in to operate</Button>}</SidebarFooter>
      </Sidebar>
      <SidebarInset className="os-inset"><WorkspaceTopbar location={location} isAuthenticated={isAuthenticated} theme={theme} toggleTheme={safeToggleTheme} /><main className="os-main">{children}</main></SidebarInset>
    </div>
  </SidebarProvider>;
}
