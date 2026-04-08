import "./App.css";
import { useRoutes, Link, NavLink, useLocation } from "react-router-dom";
import { routes } from "./routes";
import MapComponent from "./components/MapComponent";
import BrandLogo from "./components/BrandLogo";

const navItems = [
  { to: "/", label: "Map" },
  { to: "/admin", label: "Admin" },
  { to: "/about", label: "About" },
  { to: "/login", label: "Login" },
];

function App() {
  const routeElement = useRoutes(routes);
  const location = useLocation();

  // Check if current route should show map in background
  const showMapBackground = !["/", "/admin", "/login", "/register"].includes(
    location.pathname,
  );

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-100">
      {/* Navigation Bar */}
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

            <Link
              to="/register"
              className="px-3 sm:px-5 py-2 rounded-xl bg-linear-to-r from-orange-500 to-rose-500 text-white text-sm font-bold shadow-md shadow-orange-200 hover:brightness-105 transition whitespace-nowrap"
            >
              Join Now
            </Link>
          </div>
        </div>
      </nav>

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
