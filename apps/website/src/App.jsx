import "./App.css";
import {
  useRoutes,
  Link,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useState, useEffect } from "react";
import { routes } from "./routes";
import MapComponent from "./components/MapComponent";
import BrandLogo from "./components/BrandLogo";
import LanguageSelector from "./components/LanguageSelector";
import { useTranslation } from "./hooks/useLanguageContext";
import { getRoleFromToken } from "./lib/jwt";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => !!localStorage.getItem("accessToken"),
  );
  const navigate = useNavigate();
  const t = useTranslation();

  // Get user role from JWT token
  const accessToken = localStorage.getItem("accessToken");
  const userRole = accessToken ? getRoleFromToken(accessToken) : "USER";
  const isAdmin = userRole === "ADMIN";

  const navItems = [
    { to: "/", label: t.nav.map },
    ...(isAdmin ? [{ to: "/admin", label: t.nav.admin }] : []),
    { to: "/about", label: t.nav.about },
    ...(isLoggedIn ? [] : [{ to: "/login", label: t.nav.login }]),
  ];

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "accessToken" || e.key === null) {
        const newToken = localStorage.getItem("accessToken");
        setIsLoggedIn(!!newToken);
        // Force re-render to update navItems with new role
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setIsLoggedIn(false);
    navigate("/login");
  };
  const routeElement = useRoutes(routes);
  const location = useLocation();

  // Check if current route should hide navbar (admin dashboard has its own layout)
  const hideNavbar = location.pathname === "/admin";

  // Check if current route should show map in background
  const showMapBackground = ![
    "/",
    "/admin",
    "/login",
    "/register",
    "/profile",
    "/partner-profile",
  ].includes(location.pathname);

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-100">
      {/* Navigation Bar - hidden on admin dashboard */}
      {!hideNavbar && (
        <nav className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 backdrop-blur-md shadow-sm">
          <div className="max-w-7xl mx-auto px-3 md:px-5 py-3 flex items-center justify-between gap-3">
            <BrandLogo />

            <div className="flex items-center gap-2 sm:gap-3">
              <ul className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-1 py-1 shadow-xs overflow-hidden">
                {navItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        [
                          "px-3 sm:px-4 py-2 text-sm font-semibold rounded-xl transition whitespace-nowrap",
                          isActive
                            ? "bg-slate-900 text-white shadow-sm"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
                        ].join(" ")
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>

              <LanguageSelector />

              <Link
                to={isLoggedIn ? "/profile" : "/register"}
                className="px-3 sm:px-5 py-2 rounded-xl bg-linear-to-r from-orange-500 to-rose-500 text-white text-sm font-bold shadow-md shadow-orange-200 hover:brightness-105 transition whitespace-nowrap"
              >
                {isLoggedIn ? t.nav.profile : t.nav.join}
              </Link>

              {isLoggedIn && (
                <button
                  onClick={handleLogout}
                  className="px-3 sm:px-5 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition whitespace-nowrap"
                >
                  {t.nav.logout}
                </button>
              )}
            </div>
          </div>
        </nav>
      )}

      {/* Main Content Area */}
      <div className="flex-1 w-screen relative overflow-hidden">
        {/* Map Background */}
        {showMapBackground && (
          <div className="absolute inset-0 z-0">
            <MapComponent />
          </div>
        )}

        {/* Route Content */}
        <div className="relative z-10 w-full h-full overflow-y-auto">
          {routeElement}
        </div>
      </div>
    </div>
  );
}

export default App;
