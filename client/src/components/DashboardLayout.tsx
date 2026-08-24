import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import React from "react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Activity, Bot, Cable, Landmark, LogOut, MessageSquareText, Moon, PanelLeft, Settings2, Sun, WalletCards } from "lucide-react";
import { useLocation } from "wouter";

const menuItems = [
  { icon: Bot, label: "Command", path: "/" },
  { icon: MessageSquareText, label: "Chat", path: "/chat" },
  { icon: WalletCards, label: "Wallets & mandates", path: "/wallets" },
  { icon: Cable, label: "Connections", path: "/connections" },
  { icon: Settings2, label: "Agent & policy", path: "/settings" },
  { icon: Activity, label: "Activity log", path: "/activity" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location, setLocation] = useLocation();

  if (loading) return <div className="os-loading">Preparing your operating system…</div>;

  return <SidebarProvider defaultOpen>
    <div className="os-layout">
      <Sidebar collapsible="icon" className="os-sidebar">
        <SidebarHeader className="os-sidebar-brand"><div className="os-logo-mark"><Landmark size={17} /></div><div><strong>ledgerline</strong><span>autonomous investment os</span></div></SidebarHeader>
        <SidebarContent className="os-sidebar-content"><div className="os-rail-label">Operating system</div><SidebarMenu className="os-nav">{menuItems.map((item) => <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={location === item.path} tooltip={item.label} onClick={() => setLocation(item.path)}><item.icon size={16} /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu><div className="os-rail-status"><span><i />AUTONOMY MODE</span><strong>SIMULATION DEFAULT</strong><small>Real mode requires a named mandate.</small></div></SidebarContent>
        <SidebarFooter className="os-sidebar-footer">{isAuthenticated ? <div className="os-user"><Avatar><AvatarFallback>{user?.name?.slice(0, 1).toUpperCase() ?? "O"}</AvatarFallback></Avatar><div><strong>{user?.name ?? "Owner"}</strong><span>owner authority</span></div><button aria-label="Sign out" onClick={logout}><LogOut size={14} /></button></div> : <Button className="os-signin" onClick={startLogin}>Sign in to operate</Button>}</SidebarFooter>
      </Sidebar>
      <SidebarInset className="os-inset"><header className="os-topbar"><div className="os-trail"><PanelLeft size={15} /><span>ledgerline</span><b>{menuItems.find((item) => item.path === location)?.label ?? "Workspace"}</b></div><div className="os-topbar-status"><span><i /> agents ready</span><span className="os-mode-chip">simulation default</span><button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}</button>{isAuthenticated ? <em>{user?.name ?? "Owner"}</em> : <Button size="sm" onClick={startLogin}>Sign in</Button>}</div></header><main className="os-main">{children}</main></SidebarInset>
    </div>
  </SidebarProvider>;
}
