'use client';

import { useState, useEffect, useRef } from 'react';

interface DigitalHumanProps {
  isSpeaking: boolean;
  audioLevel?: number;
  isListening?: boolean;
  isProcessing?: boolean;
  isError?: boolean;
  customImage?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  mouthPosition?: { x: number; y: number };
  mouthSize?: { width: number; height: number };
}

const SIZE_CLASSES = {
  sm: 'w-24 h-24',
  md: 'w-32 h-32',
  lg: 'w-40 h-40',
  xl: 'w-48 h-48',
};

const INNER_SIZE_CLASSES = {
  sm: 'w-20 h-20',
  md: 'w-28 h-28',
  lg: 'w-36 h-36',
  xl: 'w-44 h-44',
};

const RIPPLE_COUNT = 4;

const DigitalHuman: React.FC<DigitalHumanProps> = ({
  isSpeaking,
  audioLevel = 0,
  isListening = false,
  isProcessing = false,
  isError = false,
  customImage,
  size = 'xl',
  mouthPosition: _mouthPosition,
  mouthSize: _mouthSize,
}) => {
  const [blinkState, setBlinkState] = useState(false);
  const [rippleIntensity, setRippleIntensity] = useState(0);

  const rafRef = useRef<number | null>(null);
  const lastBlinkRef = useRef<number>(0);
  const smoothLevelRef = useRef(0);

  // Smooth audio level mapping for ripple intensity
  const levelToRipple = (level: number): number => {
    const target = level < 0.02 ? 0
      : level < 0.08 ? 0.2
      : level < 0.15 ? 0.4
      : level < 0.25 ? 0.6
      : level < 0.4 ? 0.8
      : 1.0;
    smoothLevelRef.current += (target - smoothLevelRef.current) * 0.3;
    return smoothLevelRef.current;
  };

  // Unified animation loop
  useEffect(() => {
    const animate = () => {
      const now = Date.now();

      // Random blink
      if (now - lastBlinkRef.current > 3000 + Math.random() * 5000) {
        setBlinkState(true);
        lastBlinkRef.current = now;
        setTimeout(() => setBlinkState(false), 150);
      }

      // Ripple animation driven by audio level
      if (isSpeaking) {
        const intensity = levelToRipple(audioLevel);
        setRippleIntensity(intensity);
      } else {
        // Smooth decay when not speaking
        smoothLevelRef.current *= 0.9;
        setRippleIntensity(smoothLevelRef.current);
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isSpeaking, audioLevel]);

  // Default digital human: eyes
  const renderDefaultEyes = () => {
    if (customImage) return null;
    if (blinkState) {
      return (
        <>
          <div className="absolute top-1/3 left-1/4 w-4 h-1 bg-foreground/80 rounded-full" />
          <div className="absolute top-1/3 right-1/4 w-4 h-1 bg-foreground/80 rounded-full" />
        </>
      );
    }
    if (isError) {
      return (
        <>
          <div className="absolute top-1/3 left-1/4 w-4 h-4 flex items-center justify-center"><span className="text-destructive font-bold text-xs">×</span></div>
          <div className="absolute top-1/3 right-1/4 w-4 h-4 flex items-center justify-center"><span className="text-destructive font-bold text-xs">×</span></div>
        </>
      );
    }
    if (isProcessing) {
      return (
        <>
          <div className="absolute top-1/3 left-1/4 w-4 h-4 bg-primary/60 rounded-full animate-pulse" />
          <div className="absolute top-1/3 right-1/4 w-4 h-4 bg-primary/60 rounded-full animate-pulse" />
        </>
      );
    }
    if (isListening) {
      return (
        <>
          <div className="absolute top-1/3 left-1/4 w-4 h-4 bg-primary rounded-full animate-pulse"><div className="absolute top-1 left-1 w-2 h-2 bg-primary-foreground rounded-full" /></div>
          <div className="absolute top-1/3 right-1/4 w-4 h-4 bg-primary rounded-full animate-pulse"><div className="absolute top-1 left-1 w-2 h-2 bg-primary-foreground rounded-full" /></div>
        </>
      );
    }
    return (
      <>
        <div className="absolute top-1/3 left-1/4 w-4 h-4 bg-foreground rounded-full"><div className="absolute top-1 left-1 w-2 h-2 bg-background rounded-full" /></div>
        <div className="absolute top-1/3 right-1/4 w-4 h-4 bg-foreground rounded-full"><div className="absolute top-1 left-1 w-2 h-2 bg-background rounded-full" /></div>
      </>
    );
  };

  // Default digital human: mouth (simple style, no complex overlay)
  const renderDefaultMouth = () => {
    if (customImage) return null;
    const h = isSpeaking ? 3 + rippleIntensity * 8 : 2;
    const w = isSpeaking ? 8 + rippleIntensity * 6 : 6;
    return (
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2">
        <div className="bg-muted rounded-full" style={{ width: `${w * 4}px`, height: `${h * 4}px`, transition: 'all 0.12s ease-out' }} />
      </div>
    );
  };

  // Sound wave ripples around the photo frame
  const renderRipples = () => {
    if (!isSpeaking || rippleIntensity < 0.05) return null;

    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {Array.from({ length: RIPPLE_COUNT }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-2xl border border-primary"
            style={{
              inset: `-${8 + i * 8}px`,
              opacity: Math.max(0, (1 - i / RIPPLE_COUNT) * rippleIntensity * 0.6),
              transform: `scale(${1 + i * 0.06 * rippleIntensity})`,
              animation: `digital-human-ripple ${1.2 + i * 0.3}s ease-out infinite`,
              animationDelay: `${i * 0.15}s`,
              borderWidth: `${2 - i * 0.3}px`,
            }}
          />
        ))}
      </div>
    );
  };

  // Status ring - warm style (simplified, no longer overlaps with ripples)
  const renderStatusRing = () => {
    if (isError) return <div className="absolute -inset-2"><div className="w-full h-full rounded-2xl border-4 border-destructive animate-pulse" /></div>;
    if (isProcessing) return <div className="absolute -inset-2"><div className="w-full h-full rounded-2xl border-2 border-primary/40 warm-breathe-ring" /></div>;
    if (isListening) return <div className="absolute -inset-2"><div className="w-full h-full rounded-2xl border-2 border-primary/60 animate-pulse" /></div>;
    return null;
  };

  return (
    <div className={`relative ${SIZE_CLASSES[size]} flex items-center justify-center`}>
      {renderStatusRing()}
      {renderRipples()}

      <div className={`${INNER_SIZE_CLASSES[size]} rounded-2xl relative overflow-hidden border border-border/30 shadow-md`}>
        {customImage ? (
          <div className="relative w-full h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={customImage}
              alt="AI数字教师"
              className="w-full h-full object-cover"
            />
            {/* Mouth overlay removed - replaced by ripple animation */}
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/15 flex items-center justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/8 to-transparent rounded-2xl" />
            {renderDefaultEyes()}
            {renderDefaultMouth()}
            <div className="absolute top-1/4 left-[20%] w-8 h-1 bg-foreground/20 rounded-full -rotate-12" />
            <div className="absolute top-1/4 right-[20%] w-8 h-1 bg-foreground/20 rounded-full rotate-12" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-4 bg-primary/30 rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
};

export default DigitalHuman;
