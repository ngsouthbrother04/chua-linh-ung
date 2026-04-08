export default function AnimatedBackground() {
  return (
    <div className="animated-scene" aria-hidden="true">
      <div className="animated-scene__grid" />
      <div className="animated-scene__orb animated-scene__orb--one" />
      <div className="animated-scene__orb animated-scene__orb--two" />
      <div className="animated-scene__orb animated-scene__orb--three" />
      <div className="animated-scene__wave animated-scene__wave--one" />
      <div className="animated-scene__wave animated-scene__wave--two" />
      <div className="animated-scene__noise" />
    </div>
  );
}
