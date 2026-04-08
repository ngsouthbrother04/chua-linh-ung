import AnimatedBackground from "../components/AnimatedBackground";

export default function About() {
  return (
    <div className="relative w-full min-h-full overflow-hidden">
      <AnimatedBackground />
      <div className="relative z-10 min-h-full flex flex-col justify-center items-center p-6">
        <div className="w-full max-w-2xl rounded-3xl border border-white/60 bg-white/82 backdrop-blur-xl shadow-[0_24px_80px_rgba(15,23,42,0.16)] p-8 md:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-orange-500 mb-3">
            Explore the story
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-6">
            About
          </h1>
          <div className="space-y-4 text-slate-700 leading-relaxed">
            <p>
              Phố Ẩm Thực is a location-based food narration system that helps
              users explore restaurants on a map and listen to multi-language
              narration when they interact with points of interest.
            </p>

            <h2 className="text-2xl font-semibold text-blue-600 mt-6 mb-3">
              Key Features
            </h2>
            <ul className="list-disc list-inside space-y-2 text-slate-600">
              <li>Interactive map view with restaurant markers</li>
              <li>Multi-language narration (15 supported languages)</li>
              <li>User-triggered audio playback via tap or QR code</li>
              <li>Offline-first content access</li>
              <li>Single-voice rule enforcement</li>
            </ul>

            <h2 className="text-2xl font-semibold text-orange-500 mt-6 mb-3">
              Technology
            </h2>
            <p className="text-slate-600">
              Built with React, React Router, Leaflet Maps, and Tailwind CSS for
              a seamless user experience.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
