import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment } from '@react-three/drei';
import { Lights } from './Lights';
import { CameraRig } from './CameraRig';
import { Burger } from './Burger';
import { HeroEffects } from './HeroEffects';

interface BurgerSceneProps {
  progress: React.MutableRefObject<number>;
  isMobile: boolean;
}

class EnvBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {}
  render() { return this.state.failed ? null : <>{this.props.children}</>; }
}

export function BurgerScene({ progress, isMobile }: BurgerSceneProps) {
  return (
    <Canvas
      shadows={!isMobile}
      dpr={isMobile ? 1 : [1, 2]}
      performance={{ min: 0.5 }}
      camera={{ position: [0, 1.6, isMobile ? 5.7 : 6], fov: 40 }}
      gl={{ antialias: !isMobile, alpha: true, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <Lights progress={progress} />

        <EnvBoundary>
          <Suspense fallback={null}>
            <Environment preset="sunset" />
          </Suspense>
        </EnvBoundary>

        <CameraRig progress={progress} isMobile={isMobile} />
        <Burger progress={progress} />
        <HeroEffects isMobile={isMobile} />

        {!isMobile && (
          <ContactShadows
            position={[0, -1.4, 0]}
            opacity={0.55}
            scale={10}
            blur={2.6}
            far={4}
            resolution={512}
            color="#000000"
          />
        )}
      </Suspense>
    </Canvas>
  );
}
