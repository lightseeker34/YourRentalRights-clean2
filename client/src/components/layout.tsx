import { Link, useLocation } from "wouter";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Scale, Home, Info, FileText, LayoutDashboard, LogOut, LogIn, User, Settings, MessageSquare } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";

interface LayoutProps {
  children: React.ReactNode;
  hideTicker?: boolean;
  hideFooter?: boolean;
}

export function Layout({ children, hideTicker = false, hideFooter = false }: LayoutProps) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { user, logoutMutation } = useAuth();

  // Auto-hide ticker/footer on dashboard pages and enable immersive incident view
  const isDashboard = location.startsWith('/dashboard');
  const isAuth = location.startsWith('/auth');
  const isIncidentView = location.startsWith('/dashboard/incident/');
  const shouldHideTicker = hideTicker || isDashboard || isAuth;
  const shouldHideFooter = hideFooter || isDashboard || isAuth;
  const shouldHideHeader = isDashboard || isAuth; // Hide global chrome on dashboard + auth routes

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/about", label: "About Us", icon: Info },
    { href: "/resources", label: "Resources", icon: FileText },
    { href: "/forum", label: "Community", icon: MessageSquare },
  ];

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const tickerItems = [
    "Black mold discovered in HVAC system, management unresponsive for 6 months - BBB Complaint filed",
    "Hidden fees labeled as smart home charges added without disclosure - FTC Complaint pending",
    "Security deposit withheld with fabricated painting charges after move-out - Consumer Affairs Review",
    "Sewage backup in yard ignored for 10 days despite multiple service requests - Health Department notified",
    "Air conditioning failure during July heatwave, elderly resident affected - State Attorney General complaint",
    "Lease renewal fee of $450 charged without prior disclosure in original agreement - Housing Authority report",
  ];

  return (
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-hidden flex flex-col font-sans text-slate-900">
      {/* News Ticker */}
      {!shouldHideTicker && (
        <div className="ticker-wrap h-[46px] flex items-center z-50 relative shadow-md overflow-hidden">
          <div className="ticker whitespace-nowrap">
            {tickerItems.map((item, idx) => (
              <span 
                key={idx}
                className="px-16 text-sm text-white/95 tracking-wide relative after:content-['•'] after:absolute after:right-0 after:text-white/30 font-normal"
              >
                {item}
              </span>
            ))}
            {tickerItems.map((item, idx) => (
              <span 
                key={`dup-${idx}`}
                className="px-16 text-sm text-white/95 tracking-wide relative after:content-['•'] after:absolute after:right-0 after:text-white/30 font-normal"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* Navigation Bar */}
      {!shouldHideHeader && <header className="sticky top-0 z-40 w-full border-b-0 md:border-b border-slate-200 bg-white md:bg-white/80 md:backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-slate-900 hover:opacity-80 transition-opacity cursor-pointer">
            <div className="bg-slate-100 p-1.5 rounded-md border border-slate-200/50">
              <Scale className="w-5 h-5 text-slate-700" />
            </div>
            YourRentalRights.com
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href}
                className={`text-sm font-medium transition-colors hover:text-slate-900 cursor-pointer ${
                  location === item.href ? "text-slate-900" : "text-slate-500"
                }`}
              >
                {item.label}
              </Link>
            ))}

            <div className="h-6 w-px bg-slate-200 mx-2 ml-[0px] mr-[0px]" />

            {user ? (
              <div className="flex items-center gap-4">
                <Link href="/dashboard">
                  <span className={`text-sm font-medium transition-colors hover:text-slate-900 cursor-pointer flex items-center gap-2 ${
                    location.startsWith("/dashboard") ? "text-slate-900" : "text-slate-500"
                  }`}>
                    <LayoutDashboard className="w-4 h-4" /> Dashboard
                  </span>
                </Link>
                <Link href="/profile">
                  <span className={`text-sm font-medium transition-colors hover:text-slate-900 cursor-pointer flex items-center gap-2 ${
                    location === "/profile" ? "text-slate-900" : "text-slate-500"
                  }`}>
                    <User className="w-4 h-4" /> Account
                  </span>
                </Link>
                {user.isAdmin && (
                  <Link href="/admin">
                    <span className={`text-sm font-medium transition-colors hover:text-slate-900 cursor-pointer flex items-center gap-2 ${
                      location === "/admin" ? "text-slate-900" : "text-slate-500"
                    }`}>
                      <Settings className="w-4 h-4" /> Admin
                    </span>
                  </Link>
                )}
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500 hover:text-red-600">
                  <LogOut className="w-4 h-4 mr-2" /> Logout
                </Button>
              </div>
            ) : (
              <Link href="/auth">
                <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white">
                  <LogIn className="w-4 h-4 mr-2" /> Login
                </Button>
              </Link>
            )}
          </nav>

          {/* Mobile Nav (Hamburger) */}
          <div className="md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-slate-700">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <SheetTitle className="text-left font-bold text-slate-900 mt-4 mb-2">Menu</SheetTitle>
                <SheetDescription className="text-left mb-6 text-slate-500">
                  Navigate our services and resources.
                </SheetDescription>
                <nav className="flex flex-col gap-2">
                  {navItems.map((item) => (
                    <Link 
                      key={item.href} 
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors cursor-pointer ${
                        location === item.href 
                          ? "bg-slate-100 text-slate-900 font-semibold" 
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                      onClick={() => setOpen(false)}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  ))}
                  
                  <div className="h-px bg-slate-100 my-2" />
                  
                  {user ? (
                    <>
                      <Link 
                        href="/dashboard"
                        className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors cursor-pointer ${
                          location.startsWith("/dashboard")
                            ? "bg-slate-100 text-slate-900 font-semibold" 
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                        onClick={() => setOpen(false)}
                      >
                        <LayoutDashboard className="w-5 h-5" />
                        Dashboard
                      </Link>
                      <Link 
                        href="/profile"
                        className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors cursor-pointer ${
                          location === "/profile"
                            ? "bg-slate-100 text-slate-900 font-semibold" 
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                        onClick={() => setOpen(false)}
                      >
                        <User className="w-5 h-5" />
                        Account
                      </Link>
                      {user.isAdmin && (
                        <Link 
                          href="/admin"
                          className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors cursor-pointer ${
                            location === "/admin"
                              ? "bg-slate-100 text-slate-900 font-semibold" 
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                          onClick={() => setOpen(false)}
                        >
                          <Settings className="w-5 h-5" />
                          Admin
                        </Link>
                      )}
                      <button 
                        className="flex w-full items-center gap-3 px-4 py-3 rounded-md transition-colors cursor-pointer text-slate-600 hover:bg-red-50 hover:text-red-600 text-left"
                        onClick={() => {
                          handleLogout();
                          setOpen(false);
                        }}
                      >
                        <LogOut className="w-5 h-5" />
                        Logout
                      </button>
                    </>
                  ) : (
                    <Link 
                      href="/auth"
                      className="flex items-center gap-3 px-4 py-3 rounded-md transition-colors cursor-pointer bg-slate-900 text-white font-semibold hover:bg-slate-800"
                      onClick={() => setOpen(false)}
                    >
                      <LogIn className="w-5 h-5" />
                      Login / Register
                    </Link>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>}
      {/* Main Content */}
      <main className="flex-1 w-full max-w-full flex flex-col relative z-10 overflow-x-hidden">
        <div className="fixed top-[20%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(80vh,95vw)] h-[min(80vh,95vw)] bg-[radial-gradient(circle,rgba(203,213,225,0.4)_0%,rgba(241,245,249,0)_70%)] -z-10 pointer-events-none" />
        {children}
      </main>
      {/* Footer */}
      {!shouldHideFooter && (
        <footer className="border-t border-slate-200 bg-slate-50 py-12 px-4 mt-auto pt-[15px] pb-[15px]">
          <div className="container mx-auto text-center text-slate-500 text-sm">
            <p className="mb-4 text-[13px]">Copywrite © 2026 YourRentalRights.com -All Rights Reserved</p>
            <div className="flex justify-center gap-6 ml-[10px] mr-[10px] text-center text-[13px]">
              <Link href="/privacy" className="hover:text-slate-700">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-slate-700">Terms of Service</Link>
              <Link href="/contact" className="hover:text-slate-700">Contact</Link>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
