import React, { useState } from 'react';
import { LANES, GameStats, HitRating } from '../types';
import { Volume2, VolumeX, Compass, ChevronDown, ChevronUp, Music, Upload, RotateCcw, Flame } from 'lucide-react';

interface GameHUDProps {
  stats: GameStats;
  lastRating: { rating: HitRating; text: string; id: number } | null;
  gyroActive: boolean;
  onCalibrateGyro: () => void;
  onLaneTap: (laneId: number) => void;
  onToggleMute: () => boolean;
  onUploadMp3: (file: File) => void;
  onRestart: () => void;
  onExitToMenu: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  stats,
  lastRating,
  gyroActive,
  onCalibrateGyro,
  onLaneTap,
  onToggleMute,
  onUploadMp3,
  onRestart,
  onExitToMenu,
  speed,
  onSpeedChange,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleMuteClick = () => {
    const muted = onToggleMute();
    setIsMuted(muted);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadMp3(e.target.files[0]);
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-between p-3 sm:p-5 select-none overflow-hidden">
      
      {/* TOP HEADER: Score, Combo, Gyro status */}
      <div className="flex items-start justify-between w-full max-w-4xl mx-auto">
        
        {/* Score & Multiplier */}
        <div className="pointer-events-auto bg-slate-900/80 border border-cyan-500/30 rounded-xl px-4 py-2 shadow-lg backdrop-blur-sm">
          <div className="text-[10px] uppercase font-cyber tracking-widest text-cyan-400">Puntaje</div>
          <div className="font-cyber text-2xl sm:text-3xl font-black text-white tracking-wider">
            {stats.score.toLocaleString()}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span>Precisión:</span>
            <span className="font-semibold text-cyan-300">{stats.accuracy}%</span>
          </div>
        </div>

        {/* Center: Combo Streak Counter */}
        {stats.combo > 0 && (
          <div className="flex flex-col items-center animate-bounce-short">
            <div className="flex items-center gap-1 font-cyber text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-yellow-300 to-cyan-300 drop-shadow-[0_0_15px_rgba(255,0,160,0.8)]">
              <Flame className="w-6 h-6 text-pink-500" />
              <span>{stats.combo}x</span>
            </div>
            <span className="font-cyber text-[10px] tracking-widest uppercase text-pink-300 font-bold">
              COMBO
            </span>
          </div>
        )}

        {/* Right: Gyro Status & Quick Menu */}
        <div className="pointer-events-auto flex items-center gap-2">
          {gyroActive && (
            <button
              onClick={onCalibrateGyro}
              title="Calibrar orientación central"
              className="bg-slate-900/80 border border-cyan-500/40 text-cyan-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-cyber flex items-center gap-1.5 shadow-md active:scale-95 transition-transform cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Calibrar</span>
            </button>
          )}

          <button
            onClick={onExitToMenu}
            className="bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md active:scale-95 transition-transform cursor-pointer"
          >
            Salir
          </button>
        </div>
      </div>

      {/* CENTER: Floating Hit Rating Text ("PERFECT!", "GREAT!", "MISS") */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
        {lastRating && (
          <div
            key={lastRating.id}
            className={`font-cyber text-2xl sm:text-4xl font-black tracking-widest transition-all duration-300 transform scale-110 drop-shadow-[0_0_20px_rgba(255,255,255,0.7)] ${
              lastRating.rating === 'PERFECT'
                ? 'text-cyan-300 drop-shadow-[0_0_25px_#00f0ff]'
                : lastRating.rating === 'GREAT'
                ? 'text-yellow-300 drop-shadow-[0_0_20px_#ffe600]'
                : lastRating.rating === 'GOOD'
                ? 'text-pink-400 drop-shadow-[0_0_20px_#ff00a0]'
                : 'text-red-500 drop-shadow-[0_0_20px_#ef4444]'
            }`}
          >
            {lastRating.text}
          </div>
        )}
      </div>

      {/* BOTTOM SECTION: Mobile Piano Hit Pads + Consolidated Collapsible Dock */}
      <div className="w-full max-w-xl mx-auto flex flex-col items-center gap-2 pointer-events-auto">
        
        {/* Ergonomic Mobile Hit Pads (4 Lanes: C4, E4, G4, B4) */}
        <div className="grid grid-cols-4 gap-2 w-full px-2">
          {LANES.map((lane) => (
            <button
              key={lane.id}
              onPointerDown={(e) => {
                e.preventDefault();
                onLaneTap(lane.id);
              }}
              style={{ borderColor: lane.color }}
              className="py-3 sm:py-4 px-1 rounded-xl bg-slate-950/70 border-2 active:bg-white/20 active:scale-95 transition-all flex flex-col items-center justify-center shadow-lg group cursor-pointer backdrop-blur-sm"
            >
              <span
                style={{ color: lane.color }}
                className="font-cyber text-sm sm:text-base font-black tracking-wider"
              >
                {lane.note.split(' ')[0]}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {lane.key}
              </span>
            </button>
          ))}
        </div>

        {/* Collapsible Dock Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-slate-400 hover:text-white text-[11px] font-cyber flex items-center gap-1 shadow-md transition-colors cursor-pointer"
        >
          {isCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          <span>{isCollapsed ? 'Mostrar Controles' : 'Modo Zen / Ocultar'}</span>
        </button>

        {/* Unified Bottom Control Dock (skill directive) */}
        {!isCollapsed && (
          <div className="w-full bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-2.5 sm:p-3 shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-2 text-xs">
            
            {/* Speed / Difficulty */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">Velocidad:</span>
              <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700">
                {[
                  { label: '1x', val: 28 },
                  { label: '1.3x', val: 36 },
                  { label: '1.8x', val: 46 }
                ].map((s) => (
                  <button
                    key={s.label}
                    onClick={() => onSpeedChange(s.val)}
                    className={`px-2 py-0.5 rounded font-cyber text-[10px] font-bold transition-colors cursor-pointer ${
                      speed === s.val
                        ? 'bg-cyan-500 text-slate-950 shadow-[0_0_8px_#00f0ff]'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Audio MP3 Loader */}
            <div className="flex items-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 rounded-lg bg-pink-950/60 hover:bg-pink-900/80 border border-pink-500/40 text-pink-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Cargar archivo MP3 propio"
              >
                <Upload className="w-3 h-3 text-pink-400" />
                <span>Cargar MP3</span>
              </button>
            </div>

            {/* Audio Toggle & Restart */}
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={handleMuteClick}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 transition-colors cursor-pointer"
                title="Silenciar / Activar Sonido"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={onRestart}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Reiniciar partida"
              >
                <RotateCcw className="w-3 h-3 text-cyan-400" />
                <span>Reiniciar</span>
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
