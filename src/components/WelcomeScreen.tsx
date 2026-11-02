import React, { useEffect, useRef, useState } from 'react';
import { Smartphone, Monitor, QrCode, Play, Sparkles, Volume2, Compass, ShieldCheck, Copy, Check } from 'lucide-react';

interface WelcomeScreenProps {
  onStart: (enableSensors: boolean) => void;
  onOpenExportModal: () => void;
  isMobileDevice: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStart,
  onOpenExportModal,
  isMobileDevice,
}) => {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [qrGenerated, setQrGenerated] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    // Determine the best public URL to generate QR code for
    const url = window.location.href;
    setCurrentUrl(url);

    if (qrRef.current && !isMobileDevice) {
      // Clear any previous QR
      qrRef.current.innerHTML = '';

      // Check if QRCode is available from QRCode.js CDN
      const QRCodeLib = (window as unknown as { QRCode?: unknown }).QRCode;
      if (typeof QRCodeLib === 'function') {
        try {
          new (QRCodeLib as new (element: HTMLElement, options: unknown) => unknown)(qrRef.current, {
            text: url,
            width: 200,
            height: 200,
            colorDark: '#05021a',
            colorLight: '#00f0ff',
            correctLevel: 2, // H level
          });
          setQrGenerated(true);
        } catch (e) {
          console.warn('QRCode.js generation failed:', e);
        }
      }

      // Fallback if QRCode CDN was blocked or delayed: use dynamic SVG / QR API
      if (qrRef.current.children.length === 0) {
        const img = document.createElement('img');
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&color=00f0ff&bgcolor=05021a`;
        img.alt = 'QR Code';
        img.className = 'w-[200px] h-[200px] rounded-lg shadow-lg';
        img.onload = () => setQrGenerated(true);
        qrRef.current.appendChild(img);
      }
    }
  }, [isMobileDevice]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-gradient-to-b from-[#070216]/95 via-[#0e042b]/95 to-[#070216]/95 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-xl my-auto text-center">
        
        {/* Synthwave Retro Title */}
        <div className="relative mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-400 text-xs font-semibold uppercase tracking-widest mb-3">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            Experiencia 3D Inmersiva WebGL
          </div>
          <h1 className="font-cyber text-4xl sm:text-5xl md:text-6xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] via-[#ff00a0] to-[#ffe600] drop-shadow-[0_0_25px_rgba(255,0,160,0.6)]">
            BEAT PIANO
          </h1>
          <p className="font-cyber text-xs sm:text-sm tracking-[0.3em] text-cyan-300 uppercase mt-1">
            SYNTHWAVE RHYTHM HIGHWAY
          </p>
        </div>

        {/* Dynamic conditional view based on device detection */}
        {isMobileDevice ? (
          /* MOBILE VIEW: QR IS HIDDEN, DIRECT START BUTTON IS SHOWN */
          <div className="bg-slate-900/80 border border-pink-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-pink-500 to-yellow-400" />
            
            <div className="flex items-center justify-center gap-2 text-cyan-400 text-sm font-semibold mb-4">
              <Smartphone className="w-5 h-5 text-pink-400 animate-bounce" />
              <span>Dispositivo Móvil Detectado</span>
            </div>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6">
              El juego usará el <strong className="text-pink-400">Giroscopio</strong> de tu teléfono para rotar la cámara 3D suavemente (-90° a +90°) y <strong className="text-cyan-300">Controles Táctiles</strong> con respuesta háptica para destruir los cubos de notas.
            </p>

            {/* Permission Note */}
            <div className="flex items-start gap-2.5 bg-cyan-950/40 border border-cyan-500/20 rounded-xl p-3 text-left text-xs text-cyan-200 mb-6">
              <ShieldCheck className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
              <span>
                Al presionar Iniciar, se solicitará permiso para el giroscopio en iOS 13+ y se activará el sintetizador de piano Web Audio API.
              </span>
            </div>

            {/* Primary Mobile Action Button */}
            <button
              onClick={() => onStart(true)}
              className="w-full py-4 px-6 rounded-xl font-cyber text-base sm:text-lg font-bold tracking-wider uppercase text-white bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-500 hover:from-pink-500 hover:to-cyan-400 shadow-[0_0_30px_rgba(255,0,128,0.5)] active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              <Compass className="w-5 h-5 text-white animate-spin-slow" />
              <span>INICIAR EXPERIENCIA (Activar Sensores)</span>
            </button>
          </div>
        ) : (
          /* DESKTOP VIEW: SHOW DYNAMIC QR CODE WITH USER INSTRUCTIONS */
          <div className="bg-slate-900/85 border border-cyan-500/30 rounded-2xl p-6 sm:p-7 shadow-2xl relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-pink-500 to-yellow-400" />
            
            <div className="flex items-center justify-center gap-2 text-cyan-400 text-xs sm:text-sm font-semibold uppercase tracking-wider mb-3">
              <QrCode className="w-4 h-4 text-pink-400" />
              <span>Acceso Móvil Instantáneo</span>
            </div>

            {/* Specific mandatory prompt indication */}
            <h2 className="text-lg sm:text-xl font-bold text-white mb-2 leading-snug">
              Escanea este código QR con tu celular para jugar la experiencia interactiva 3D con giroscopio y controles táctiles
            </h2>

            <p className="text-xs sm:text-sm text-slate-400 mb-5 max-w-md mx-auto">
              Apunta la cámara de tu teléfono al código para cargar la pista Synthwave en tu dispositivo móvil con vibración háptica.
            </p>

            {/* Dynamic QR Code Container generated via QRCode.js */}
            <div className="flex flex-col items-center justify-center mb-5">
              <div className="p-3.5 bg-[#05021a] border-2 border-cyan-400/80 rounded-2xl shadow-[0_0_25px_rgba(0,240,255,0.35)] relative group">
                <div 
                  ref={qrRef} 
                  id="qrcode-container"
                  className="flex items-center justify-center min-w-[200px] min-h-[200px] rounded-lg overflow-hidden"
                />
                {!qrGenerated && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#05021a] text-cyan-400 text-xs">
                    Generando QR...
                  </div>
                )}
              </div>

              {/* Copy URL button */}
              <div className="flex items-center gap-2 mt-3 text-xs">
                <span className="text-slate-400 truncate max-w-[220px]">
                  {currentUrl}
                </span>
                <button
                  onClick={handleCopyUrl}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 flex items-center gap-1 border border-cyan-500/30 transition-colors"
                  title="Copiar URL"
                >
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            {/* Play on desktop option */}
            <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => onStart(false)}
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-cyber text-sm font-bold uppercase tracking-wider text-slate-900 bg-cyan-400 hover:bg-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.4)] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Monitor className="w-4 h-4 text-slate-900" />
                <span>Jugar en PC (Mouse / Teclado)</span>
              </button>

              <button
                onClick={onOpenExportModal}
                className="w-full sm:w-auto px-4 py-3 rounded-xl font-cyber text-xs uppercase tracking-wider text-pink-300 bg-pink-950/40 hover:bg-pink-900/60 border border-pink-500/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Descargar HTML Único</span>
              </button>
            </div>
          </div>
        )}

        {/* Feature Badges Footer */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6 text-xs text-slate-400">
          <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Giroscopio ±90°</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-pink-400" />
            <span>Háptica Vibrate</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-yellow-400" />
            <span>Web Audio FFT 128</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>60 FPS Three.js</span>
          </div>
        </div>

      </div>
    </div>
  );
};
