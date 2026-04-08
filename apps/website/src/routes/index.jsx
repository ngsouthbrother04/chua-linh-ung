import Map from "../pages/Map";
import AdminDashboard from "../pages/AdminDashboard";
import About from "../pages/About";
import Login from "../pages/Login";
import Register from "../pages/Register";
import NotFound from "../pages/NotFound";

export const routes = [
  {
    path: "/",
    element: <Map />,
  },
  {
    path: "/admin",
    element: <AdminDashboard />,
  },
  {
    path: "/about",
    element: <About />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/register",
    element: <Register />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];
