import Particles from './Particles';

export function BackgroundOne() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full overflow-hidden"
    >
      {/* React Bits: OGL particle system */}
      <Particles
        particleColors={['#fafafa', '#d4d4d8', '#a1a1aa']}
        particleCount={150}
        particleSpread={15}
        speed={0.2}
        particleBaseSize={140}
        alphaParticles
        moveParticlesOnHover
      />
    </div>
  );
}