/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BeatScene } from './three/BeatScene';
import { AudioEngine } from './audio/AudioEngine';
import { WelcomeScreen } from './components/WelcomeScreen';
import { GameHUD } from './components/GameHUD';
import { ExportModal } from './components/ExportModal';
import { GameStats, HitRating, NoteCubeData } from './types';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BeatScene | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);

  // Application State
  const [inGame, setInGame] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [gyroActive, setGyroActive] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [speed, setSpeed] = useState(36);

  // Gyroscope calibration offsets
  const gyroOffsetsRef = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });

  // Game Stats
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfectCount: 0,
    greatCount: 0,
    goodCount: 0,
    missCount: 0,
    accuracy: 100,
  });

  const [lastRating, setLastRating] = useState<{
    rating: HitRating;
    text: string;
    id: number;
  } | null>(null);

  // 1. Check for Mobile Device
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera || '';
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobileDevice(isMobileUA || (hasTouch && window.innerWidth <= 1024));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 2. Scene callbacks
  const handleHit = useCallback((cube: NoteCubeData, rating: HitRating) => {
    // 1. Play piano note via Web Audio API
    if (audioRef.current) {
      audioRef.current.playPianoNote(cube.freq, rating === 'PERFECT' ? 1.0 : 0.8);
    }

    // 2. Haptic Feedback
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(rating === 'PERFECT' ? 45 : 30);
      } catch {
        // Safe fallback
      }
    }

    // 3. Update stats
    setStats((prev) => {
      const newCombo = prev.combo + 1;
      const points = rating === 'PERFECT' ? 100 : rating === 'GREAT' ? 75 : 50;
      const multiplier = Math.min(4, Math.floor(newCombo / 10) + 1);
      const newScore = prev.score + points * multiplier;

      const newPerfect = rating === 'PERFECT' ? prev.perfectCount + 1 : prev.perfectCount;
      const newGreat = rating === 'GREAT' ? prev.greatCount + 1 : prev.greatCount;
      const newGood = rating === 'GOOD' ? prev.goodCount + 1 : prev.goodCount;

      const totalNotes = newPerfect + newGreat + newGood + prev.missCount;
      const accuracy = totalNotes > 0 ? Math.round(((newPerfect + newGreat * 0.8 + newGood * 0.5) / totalNotes) * 100) : 100;

      return {
        ...prev,
        score: newScore,
        combo: newCombo,
        maxCombo: Math.max(prev.maxCombo, newCombo),
        perfectCount: newPerfect,
        greatCount: newGreat,
        goodCount: newGood,
        accuracy,
      };
    });

    setLastRating({
      rating,
      text: `${rating}!`,
      id: Date.now() + Math.random(),
    });
  }, []);

  const handleMiss = useCallback((_cube: NoteCubeData) => {
    if (audioRef.current) {
      audioRef.current.playMissSound();
    }

    // Haptic feedback on miss
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch {
        // Safe fallback
      }
    }

    setStats((prev) => {
      const newMiss = prev.missCount + 1;
      const totalNotes = prev.perfectCount + prev.greatCount + prev.goodCount + newMiss;
      const accuracy = totalNotes > 0 ? Math.round(((prev.perfectCount + prev.greatCount * 0.8 + prev.goodCount * 0.5) / totalNotes) * 100) : 100;

      return {
        ...prev,
        combo: 0,
        missCount: newMiss,
        accuracy,
      };
    });

    setLastRating({
      rating: 'MISS',
      text: 'MISS',
      id: Date.now() + Math.random(),
    });
  }, []);

  // 3. Initialize Three.js Scene and Audio
  useEffect(() => {
    if (!containerRef.current) return;

    audioRef.current = new AudioEngine();

    const scene = new BeatScene(containerRef.current, {
      onHit: handleHit,
      onMiss: handleMiss,
    });
    sceneRef.current = scene;

    return () => {
      scene.dispose();
      audioRef.current?.stopMusic();
    };
  }, [handleHit, handleMiss]);

  // 4. Gyroscope Event Handler
  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    if (e.gamma !== null && e.beta !== null && sceneRef.current) {
      // Gamma: left/right tilt [-90, 90]
      const rawYaw = e.gamma - gyroOffsetsRef.current.yaw;
      // Beta: front/back tilt
      const rawPitch = (e.beta - 45) - gyroOffsetsRef.current.pitch;

      sceneRef.current.setGyroscopeAngles(rawYaw, rawPitch);
    }
  }, []);

  const initGyroscope = async () => {
    // Explicit iOS 13+ permission request
    const DevOrientation = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (typeof DevOrientation !== 'undefined' && typeof DevOrientation.requestPermission === 'function') {
      try {
        const permission = await DevOrientation.requestPermission();
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation, true);
          setGyroActive(true);
        } else {
          console.warn('Gyroscope permission denied by user');
        }
      } catch (err) {
        console.warn('Error requesting gyroscope permission:', err);
      }
    } else if ('DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation, true);
      setGyroActive(true);
    }
  };

  const handleCalibrateGyro = () => {
    // Set current orientation as center zero
    if ('DeviceOrientationEvent' in window) {
      const oneTimeHandler = (e: DeviceOrientationEvent) => {
        if (e.gamma !== null && e.beta !== null) {
          gyroOffsetsRef.current = {
            yaw: e.gamma,
            pitch: e.beta - 45,
          };
        }
        window.removeEventListener('deviceorientation', oneTimeHandler);
      };
      window.addEventListener('deviceorientation', oneTimeHandler);
    }
  };

  // 5. Game Loop Spawner & Music Sync
  useEffect(() => {
    if (!inGame || !sceneRef.current || !audioRef.current) return;

    sceneRef.current.isRunning = true;
    sceneRef.current.speed = speed;
    audioRef.current.startMusic();

    let spawnTimer = 0;
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      // Rhythm spawner: ~124 BPM -> note every ~0.48s
      spawnTimer += dt;
      if (spawnTimer >= 0.48) {
        spawnTimer = 0;
        const randomLane = Math.floor(Math.random() * 4);
        sceneRef.current?.spawnCube({
          id: `${Date.now()}-${Math.random()}`,
          lane: randomLane,
          z: -115,
          targetZ: 0,
          colorHex: 0x00f0ff,
          noteName: 'C4',
          freq: 261.63,
          hit: false,
          missed: false,
        });
      }

      // Audio reactive update
      const bass = audioRef.current?.getBassIntensity() || 0;
      sceneRef.current?.update(bass);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      if (sceneRef.current) sceneRef.current.isRunning = false;
    };
  }, [inGame, speed]);

  // Keyboard shortcut listener for PC players (D, F, J, K)
  useEffect(() => {
    if (!inGame) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toUpperCase();
      let lane = -1;
      if (key === 'D') lane = 0;
      else if (key === 'F') lane = 1;
      else if (key === 'J') lane = 2;
      else if (key === 'K') lane = 3;

      if (lane !== -1) {
        sceneRef.current?.triggerLaneHit(lane);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inGame]);

  // Start Experience
  const handleStartExperience = (enableSensors: boolean) => {
    setInGame(true);
    audioRef.current?.init();
    if (enableSensors) {
      initGyroscope();
    }
  };

  const handleRestart = () => {
    sceneRef.current?.resetGame();
    setStats({
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfectCount: 0,
      greatCount: 0,
      goodCount: 0,
      missCount: 0,
      accuracy: 100,
    });
    setLastRating(null);
  };

  const handleExitToMenu = () => {
    setInGame(false);
    audioRef.current?.stopMusic();
    sceneRef.current?.resetGame();
    if (gyroActive) {
      window.removeEventListener('deviceorientation', handleOrientation);
      setGyroActive(false);
    }
  };

  const handleLaneTap = (laneId: number) => {
    sceneRef.current?.triggerLaneHit(laneId);
  };

  const handleToggleMute = () => {
    return audioRef.current?.toggleMute() ?? false;
  };

  const handleUploadMp3 = (file: File) => {
    audioRef.current?.loadMp3FromFile(file);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#070216] text-white">
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 z-0 w-full h-full" />

      {/* Welcome Screen with Dynamic QR Code / Mobile Detection */}
      {!inGame && (
        <WelcomeScreen
          onStart={handleStartExperience}
          onOpenExportModal={() => setShowExportModal(true)}
          isMobileDevice={isMobileDevice}
        />
      )}

      {/* In-Game HUD & Ergonomic Bottom Dock */}
      {inGame && (
        <GameHUD
          stats={stats}
          lastRating={lastRating}
          gyroActive={gyroActive}
          onCalibrateGyro={handleCalibrateGyro}
          onLaneTap={handleLaneTap}
          onToggleMute={handleToggleMute}
          onUploadMp3={handleUploadMp3}
          onRestart={handleRestart}
          onExitToMenu={handleExitToMenu}
          speed={speed}
          onSpeedChange={setSpeed}
        />
      )}

      {/* Standalone Single-File HTML Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </div>
  );
}
