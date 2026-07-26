import React, { useEffect, useRef, useState } from 'react';
import { X, Camera as CameraIcon, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

interface CameraProps {
  onClose: () => void;
}

export default function Camera({ onClose }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsStreaming(true);
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError("Could not access camera. Please check permissions.");
      }
    }

    startCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-2xl bg-surface border border-matrix/30 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,255,65,0.1)]">
        <div className="p-4 border-b border-border flex items-center justify-between bg-surface/50">
          <div className="flex items-center gap-2">
            <CameraIcon size={18} className="text-matrix" />
            <span className="font-mono text-xs text-matrix uppercase tracking-widest">Live Feed: Secure Channel</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="relative aspect-video bg-black flex items-center justify-center">
          {error ? (
            <div className="text-center p-6">
              <p className="text-red-500 font-mono text-sm mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-matrix/20 border border-matrix/50 text-matrix text-xs font-bold rounded hover:bg-matrix/30 transition-all"
              >
                RETRY CONNECTION
              </button>
            </div>
          ) : (
            <>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              {!isStreaming && (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  <RefreshCw className="text-matrix animate-spin" size={32} />
                </div>
              )}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-mono text-red-500 uppercase tracking-tighter bg-black/50 px-2 py-0.5 rounded">REC</span>
              </div>
              <div className="absolute bottom-4 right-4 text-[10px] font-mono text-matrix/50 bg-black/50 px-2 py-0.5 rounded">
                ENC: AES-256-GCM
              </div>
            </>
          )}
        </div>

        <div className="p-4 bg-surface/50 flex justify-center">
          <button 
            onClick={onClose}
            className="px-8 py-2 bg-matrix text-black text-xs font-bold rounded-lg hover:bg-matrix/80 transition-all uppercase tracking-widest"
          >
            Terminate Feed
          </button>
        </div>
      </div>
    </motion.div>
  );
}
