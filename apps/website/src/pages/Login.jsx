import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import AnimatedBackground from "../components/AnimatedBackground";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // TODO: Replace with actual API call
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      const data = await response.json();
      // TODO: Store token in localStorage or secure storage
      localStorage.setItem("token", data.token);
      navigate("/");
    } catch (err) {
      setError(err.message || "An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full min-h-full overflow-hidden">
      <AnimatedBackground />
      <div className="relative z-10 w-full min-h-full flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/85 backdrop-blur-xl shadow-[0_24px_80px_rgba(15,23,42,0.18)] p-8 md:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-orange-500 text-center mb-3">
            Welcome back
          </p>
          <h2 className="text-3xl font-black text-center text-slate-900 mb-6">
            Login
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-700 font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 bg-white/90"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 bg-white/90"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-linear-to-r from-orange-500 to-rose-500 text-white font-bold py-3 px-4 rounded-xl hover:brightness-105 transition disabled:opacity-50 shadow-lg shadow-orange-200"
            >
              {isLoading ? "Logging in..." : "Login"}
            </button>
          </form>

          <p className="text-center text-slate-600 mt-6">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-orange-600 font-semibold hover:underline"
            >
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
