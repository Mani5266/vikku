import React, { useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  Activity,
  BarChart3,
  CalendarCheck,
  CalendarClock,
  ClipboardCheck,
  HandCoins,
  Radio,
  ShieldAlert,
  UserPlus,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Filter,
  Gauge,
  Inbox,
  IndianRupee,
  Menu,
  MessageCircleQuestion,
  RefreshCcw,
  RotateCcw,
  LogOut,
  ScrollText,
  SearchCode,
  Sparkles,
  Target,
  Users,
  X,
} from "lucide-react";
import Today from "@/pages/Today";
import LeadDetail from "@/pages/LeadDetail";
import NewCall from "@/pages/NewCall";
import Qualification from "@/pages/Qualification";
import FollowUpPlan from "@/pages/FollowUpPlan";
import AppointmentBooking from "@/pages/AppointmentBooking";
import CloseLead from "@/pages/CloseLead";
import Composer from "@/pages/Composer";

import TemplateLibrary from "@/pages/TemplateLibrary";
import CommunicationPerformance from "@/pages/CommunicationPerformance";
import ManagerDashboard from "@/pages/ManagerDashboard";
import DailyMonitor from "@/pages/DailyMonitor";
import FollowUpCompliance from "@/pages/FollowUpCompliance";
import AssignmentBoard from "@/pages/AssignmentBoard";
import Team from "@/pages/Team";
import EscalationDesk from "@/pages/EscalationDesk";
import AppointmentBoard from "@/pages/AppointmentBoard";
import CounselingDesk from "@/pages/CounselingDesk";
import LeadSources from "@/pages/LeadSources";
import VikkuAi from "@/pages/VikkuAi";
import SheetDiagnosis from "@/pages/SheetDiagnosis";
import FunnelDashboard from "@/pages/FunnelDashboard";
import AgentScorecard from "@/pages/AgentScorecard";
import FounderDashboard from "@/pages/FounderDashboard";
import SourceRoi from "@/pages/SourceRoi";
import CohortComparison from "@/pages/CohortComparison";
import DrillDown from "@/pages/DrillDown";
import DiagnosticReport from "@/pages/DiagnosticReport";
import RecoveryConsole from "@/pages/RecoveryConsole";
import AskExplorer from "@/pages/AskExplorer";
import AuditLog from "@/pages/AuditLog";
import SignIn from "@/pages/SignIn";
import NoAccess from "@/components/shared/NoAccess";
import { useStore } from "@/store/store";
import { useSession } from "@/store/session";
import { canOpenScreen, homeFor, roleOf, screenForPath } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Navigation, grouped by the role that works in it — the split the client asked for: one
// screen an agent works in, one a manager monitors from, one leadership decides from.
const NAV = [
  {
    role: "Agent",
    items: [
      { to: "/", label: "Today", screen: "A1", icon: Inbox, end: true },
    ],
  },
  {
    role: "Manager",
    items: [
      { to: "/manager", label: "Manager Dashboard", screen: "M1", icon: Gauge },
      { to: "/daily", label: "Daily Conversion Monitor", screen: "M2", icon: Activity },
      { to: "/funnel", label: "Funnel Dashboard", screen: "M3", icon: Filter },
      { to: "/compliance", label: "Follow-up Compliance", screen: "M4", icon: ClipboardCheck },
      { to: "/assign", label: "Assignment Board", screen: "M5", icon: UserPlus },
      { to: "/scorecard", label: "Agent Scorecard", screen: "M6", icon: Users },
      { to: "/team", label: "Team", screen: "M7", icon: Users },
      { to: "/escalations", label: "Escalations", screen: "M8", icon: ShieldAlert },
      { to: "/performance", label: "Communication", screen: "M9", icon: BarChart3 },
      { to: "/vikku", label: "Vikku AI", screen: "M10", icon: Sparkles },
      { to: "/sheet", label: "Weekly Sheet Diagnosis", screen: "M11", icon: FileSpreadsheet },
    ],
  },
  {
    role: "Leadership",
    items: [
      { to: "/founder", label: "Founder Dashboard", screen: "L1", icon: Target },
      { to: "/roi", label: "Campaign ROI", screen: "L2", icon: IndianRupee },
      { to: "/cohorts", label: "Cohort Comparison", screen: "L3", icon: Users },
      { to: "/drill", label: "Drill-Down Explorer", screen: "L5", icon: SearchCode },
      { to: "/report", label: "15-Day Report", screen: "L6", icon: FileBarChart },
      { to: "/ask", label: "Ask", screen: "L7", icon: MessageCircleQuestion },
    ],
  },
  {
    role: "Operations",
    items: [
      { to: "/appointments", label: "Appointments & No-shows", screen: "O1", icon: CalendarClock },
      { to: "/counseling", label: "Financial Counseling", screen: "O2", icon: HandCoins },
      { to: "/recovery", label: "Recovery & Reactivation", screen: "O4", icon: RefreshCcw },
    ],
  },
  {
    role: "Administration",
    items: [
      { to: "/sources", label: "Lead Sources & Intake", screen: "S1", icon: Radio },
      { to: "/templates", label: "Template Library", screen: "S3", icon: FileText },
      { to: "/audit", label: "Audit Log", screen: "S5", icon: ScrollText },
    ],
  },
];

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-primary text-base font-bold text-primary-foreground">
        V
      </span>
      <p className="text-sm font-semibold leading-tight">Vikku Lead Conversion CRM</p>
    </div>
  );
}

function NavItems({ onNavigate, user }) {
  // Only the groups this role owns are rendered. A hidden item is not the guard — the route
  // guard is — but a role should never be shown a door it cannot open.
  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => canOpenScreen(user, item.screen)),
  })).filter((group) => group.items.length > 0);

  // The group label separates one role's screens from another's. A role that owns a single group
  // has nothing to separate them from, so the label is dropped — an agent does not need a heading
  // reading "Agent" above the one place they work.
  const labelled = groups.length > 1;

  return (
    <nav className="scroll-slim flex-1 space-y-6 overflow-y-auto px-2 py-4">
      {groups.map(({ role, items }) => (
        <div key={role}>
          {labelled && <p className="px-4 pb-2 text-xs font-semibold text-placeholder">{role}</p>}
          <div className="space-y-1">
            {items.map(({ to, label, screen, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    // Selected is a solid brand fill with white text — the one place the brand is
                    // used as a fill in navigation, and what makes the sidebar readable at a glance.
                    "flex h-12 items-center gap-2 rounded-md px-4 text-sm transition-colors",
                    isActive
                      ? "bg-primary font-semibold text-primary-foreground shadow-card"
                      : "text-muted-foreground hover:bg-secondary active:bg-secondary"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn("h-6 w-6 shrink-0", isActive ? "text-primary-foreground" : "text-placeholder")} />
                    <span className="flex-1 truncate">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter() {
  const { reset } = useStore();
  const { user, signOut } = useSession();
  const role = roleOf(user);

  return (
    <div className="space-y-2 p-2">
      <div className="flex items-center gap-2 rounded-md bg-secondary px-4 py-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary-tint text-xs font-semibold text-primary">
          {user?.name
            .split(" ")
            .map((part) => part[0])
            .join("")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{user?.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{role?.label}</span>
        </span>
        <button
          type="button"
          onClick={signOut}
          aria-label="Sign out"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted-foreground active:bg-card"
        >
          <LogOut className="h-6 w-6" />
        </button>
      </div>
      <Button variant="outline" size="sm" className="w-full" onClick={reset}>
        <RotateCcw className="h-4 w-4" />
        Reset demo data
      </Button>
      <p className="px-2 text-xs text-placeholder">
        Roles are enforced in the interface. The same map has to be enforced on the server before real
        patient data reaches it.
      </p>
    </div>
  );
}

/** Renders a screen only if the signed-in role owns it. */
function Guard({ children }) {
  const { user } = useSession();
  const location = useLocation();
  const screen = screenForPath(location.pathname);
  if (!canOpenScreen(user, screen)) return <NoAccess screen={screen} />;
  return children;
}

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const { user } = useSession();
  const role = roleOf(user);

  // Nobody signed in: the only screen is the sign-in screen.
  if (!user) return <SignIn />;

  // "/" is the agent queue. A role that does not own it lands on its own home instead of being
  // refused on the way in — signing in should never open with a locked door.
  if (location.pathname === "/" && !canOpenScreen(user, "A1")) {
    return <Navigate to={homeFor(user)} replace />;
  }

  const current = NAV.flatMap((group) => group.items)
    .filter((item) => canOpenScreen(user, item.screen))
    .find((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)));

  const guard = (element) => <Guard>{element}</Guard>;

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar — 256px, the width every dense console settles on.
          Pinned: `sticky top-0 h-screen` keeps it in place while the page scrolls. Without it the
          sidebar is as tall as the content, so on a 3,000px dashboard the nav is somewhere above the
          fold and switching screens means scrolling back up first. The nav list inside scrolls on
          its own when a role has more items than fit. */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-card shadow-card md:flex">
        <div className="px-4 py-4">
          <BrandMark />
        </div>
        <NavItems user={user} />
        <SidebarFooter />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-card shadow-raised">
            <div className="flex items-center justify-between gap-2 px-4 py-4">
              <BrandMark />
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setDrawerOpen(false)}
                className="grid h-12 w-12 place-items-center rounded-md text-muted-foreground active:bg-secondary"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <NavItems user={user} onNavigate={() => setDrawerOpen(false)} />
            <SidebarFooter />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col bg-background">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-40 flex h-14 items-center gap-2 bg-card px-4 shadow-card md:hidden">
          <Button variant="outline" size="icon" aria-label="Open navigation" onClick={() => setDrawerOpen(true)}>
            <Menu className="h-6 w-6" />
          </Button>
          <span className="truncate text-sm font-semibold">{current?.label ?? role?.label}</span>
        </div>

        <main className="min-w-0 flex-1 overflow-x-hidden">
          <Routes>
            <Route path="/signin" element={<SignIn />} />
            {/* One home. "/" and "/tasks" render the same screen: My Leads and Daily Tasks were
                two lists of the same leads in the same order, and choosing between them was the
                agent's first decision every morning. */}
            <Route path="/" element={guard(<Today />)} />
            <Route path="/tasks" element={guard(<Today />)} />
            <Route path="/leads/:leadId" element={guard(<LeadDetail />)} />
            <Route path="/leads/:leadId/call" element={guard(<NewCall />)} />
            <Route path="/leads/:leadId/qualify" element={guard(<Qualification />)} />
            <Route path="/leads/:leadId/plan" element={guard(<FollowUpPlan />)} />
            <Route path="/leads/:leadId/appointment" element={guard(<AppointmentBooking />)} />
            <Route path="/leads/:leadId/close" element={guard(<CloseLead />)} />
            <Route path="/leads/:leadId/compose" element={guard(<Composer />)} />
            <Route path="/manager" element={guard(<ManagerDashboard />)} />
            <Route path="/daily" element={guard(<DailyMonitor />)} />
            <Route path="/funnel" element={guard(<FunnelDashboard />)} />
            <Route path="/compliance" element={guard(<FollowUpCompliance />)} />
            <Route path="/assign" element={guard(<AssignmentBoard />)} />
            <Route path="/scorecard" element={guard(<AgentScorecard />)} />
            <Route path="/team" element={guard(<Team />)} />
            <Route path="/escalations" element={guard(<EscalationDesk />)} />
            <Route path="/performance" element={guard(<CommunicationPerformance />)} />
            <Route path="/vikku" element={guard(<VikkuAi />)} />
            <Route path="/sheet" element={guard(<SheetDiagnosis />)} />
            <Route path="/founder" element={guard(<FounderDashboard />)} />
            <Route path="/roi" element={guard(<SourceRoi />)} />
            <Route path="/cohorts" element={guard(<CohortComparison />)} />
            <Route path="/drill" element={guard(<DrillDown />)} />
            <Route path="/report" element={guard(<DiagnosticReport />)} />
            <Route path="/appointments" element={guard(<AppointmentBoard />)} />
            <Route path="/counseling" element={guard(<CounselingDesk />)} />
            <Route path="/recovery" element={guard(<RecoveryConsole />)} />
            <Route path="/ask" element={guard(<AskExplorer />)} />
            <Route path="/sources" element={guard(<LeadSources />)} />
            <Route path="/templates" element={guard(<TemplateLibrary />)} />
            <Route path="/audit" element={guard(<AuditLog />)} />
            <Route path="*" element={<NoAccess />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
