import { UtensilsCrossed } from "lucide-react";
import { Link } from "react-router-dom";

export default function BrandLogo() {
  return (
    <Link
      to="/"
      className="group inline-flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-slate-100 transition"
      aria-label="Phố Ẩm Thực homepage"
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-orange-500 via-amber-500 to-red-500 shadow-md shadow-orange-300/70 ring-1 ring-white">
        <UtensilsCrossed size={22} className="text-white" />
      </span>
      <span className="leading-tight">
        <span className="block text-[11px] uppercase tracking-[0.22em] text-slate-500">
          Food Map
        </span>
        <span className="block text-xl font-extrabold text-slate-900 group-hover:text-orange-600 transition">
          Phố Ẩm Thực
        </span>
      </span>
    </Link>
  );
}
