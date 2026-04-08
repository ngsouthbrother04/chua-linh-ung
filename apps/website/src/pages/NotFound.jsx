import { Link } from "react-router-dom";
import AnimatedBackground from "../components/AnimatedBackground";

export default function NotFound() {
  return (
    <div className="relative w-full min-h-full overflow-hidden">
      <AnimatedBackground />
      <div className="relative z-10 w-full min-h-full flex flex-col justify-center items-center px-4 py-10 text-center">
        <div className="rounded-full border border-white/70 bg-white/70 backdrop-blur-xl px-5 py-2 shadow-md mb-5 text-sm font-semibold uppercase tracking-[0.3em] text-orange-500">
          Lost route
        </div>
        <h1 className="text-6xl md:text-7xl font-black text-slate-900 mb-4">
          404
        </h1>
        <p className="text-xl text-slate-600 mb-8 max-w-md">
          Page not found. The route may have moved, but the food map is still
          waiting for you.
        </p>
        <Link
          to="/"
          className="px-6 py-3 bg-linear-to-r from-orange-500 to-rose-500 text-white rounded-xl hover:brightness-105 shadow-lg shadow-orange-200 font-semibold"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
