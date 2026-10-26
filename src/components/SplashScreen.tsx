import { useEffect, useRef } from 'react';
import StartupScreen from './StartupScreen';

let shown = false;
export const needsBrandSplash = () => !shown;
export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const complete = useRef(onComplete);
  complete.current = onComplete;
  useEffect(() => {
    const timer = setTimeout(() => { shown = true; complete.current(); }, 350);
    return () => clearTimeout(timer);
  }, []);
  return <StartupScreen />;
}
