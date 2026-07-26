import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  Mic, 
  MicOff, 
  Shield, 
  Lock, 
  Activity, 
  Send, 
  Volume2, 
  VolumeX,
  Menu,
  X,
  Cpu,
  Zap,
  Bot,
  Phone,
  PhoneOff,
  Grid,
  History,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Pause,
  Play,
  Smartphone,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ArrowDown,
  User,
  LogOut,
  Mail,
  Battery,
  Wifi,
  MapPin,
  AlertTriangle,
  FileText,
  Music,
  Music2,
  Video,
  Eye,
  EyeOff,
  Youtube,
  Facebook,
  Instagram,
  Settings,
  Plus,
  Trash2,
  Save,
  Bell,
  Monitor,
  RotateCcw,
  RefreshCw,
  LayoutDashboard,
  PlayCircle,
  StickyNote,
  ShieldAlert,
  Maximize2,
  Minimize2,
  ChevronDown,
  ExternalLink,
  Search,
  Globe,
  Database,
  Mic2,
  TerminalSquare,
  MessageSquare,
  Camera as CameraIcon,
  ShieldCheck,
  ShieldOff,
  Sun,
  Moon,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer/simplepeer.min.js';
import { generateChatResponse, generateSpeech, generateImage } from './services/geminiService';
import { NovaLiveAssistant } from './services/liveAssistant';
import { searchYouTube, searchYouTubeList, getTrendingVideos } from './services/youtubeService';
import { playPCM, playCallSound } from './utils/audio';
import Camera from './components/Camera';
import { AndroidBuildModal } from './components/AndroidBuildModal';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  orderBy, 
  serverTimestamp,
  deleteDoc,
  updateDoc,
  getDocs
} from 'firebase/firestore';
import { db, auth, googleProvider } from './services/firebase';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  imageUrl?: string;
  groundingLinks?: { uri: string, title: string }[];
  parts?: any[]; // Store raw Gemini parts for history
}

interface CallRecord {
  id: string;
  type: 'incoming' | 'outgoing';
  name: string;
  number: string;
  timestamp: Date;
  status: 'missed' | 'completed' | 'rejected';
}

let idCounter = 0;
const generateId = () => {
  idCounter += 1;
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
      return `${window.crypto.randomUUID()}-${idCounter}`;
    }
  } catch (e) {
    // Fallback
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 15)}-${idCounter}`;
};

const DhakaClock = ({ handleTTS }: { handleTTS: (text: string) => void }) => {
  const [time, setTime] = useState({ hour: '00', minute: '00', second: '00', ampm: 'AM', fullDate: '' });
  const lastAnnouncedRef = useRef<number>(-1);

  const getBengaliTime = (h: number, m: number) => {
    let hr12 = h % 12;
    if (hr12 === 0) hr12 = 12;
    const toBn = (n: number) => n.toString().replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[parseInt(d)]);
    const hrText = toBn(hr12);

    if (m === 0) return `বস এখন বাজে ঠিক ${hrText} টা।`;
    return `বস এখন বাজে ${hrText} টা ${toBn(m)} মিনিট।`;
  };

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Dhaka',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      };
      const bdTime = new Intl.DateTimeFormat('en-US', options).format(now);
      const [timePart, ampm] = bdTime.split(' ');
      const [hour, minute, second] = timePart.split(':');
      
      const dateOptions: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Dhaka',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      };
      const bdDate = new Intl.DateTimeFormat('en-US', dateOptions).format(now);
      setTime({ hour, minute, second, ampm, fullDate: bdDate });

      const m = parseInt(minute);
      const h = parseInt(hour);
      if (lastAnnouncedRef.current === -1) {
        lastAnnouncedRef.current = m;
      } else if (m % 15 === 0 && m !== lastAnnouncedRef.current) {
        lastAnnouncedRef.current = m;
        handleTTS(getBengaliTime(h, m));
      }
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [handleTTS]);

  return (
    <div className="hidden lg:flex items-center gap-3 border-l border-slate-200 pl-6">
      <div className="flex flex-col">
        <span className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">Dhaka Time (GMT+6)</span>
        <span className="text-sm font-mono font-bold text-slate-700">
          {time.hour}:{time.minute}:{time.second} <span className="text-[10px] text-slate-400">{time.ampm}</span>
        </span>
      </div>
      <div className="text-[10px] text-slate-300 font-mono">|</div>
      <div className="flex flex-col">
        <span className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">Date</span>
        <span className="text-[10px] font-bold text-slate-600">{time.fullDate}</span>
      </div>
    </div>
  );
};

interface AuthModalProps {
  onSuccess: (user: any) => void;
  setError: (err: string) => void;
}

const AuthModal = ({ onSuccess, setError }: AuthModalProps) => {
  const [method, setMethod] = useState<'google' | 'phone'>('google');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      onSuccess(result.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible'
      });
    }
  };

  const handlePhoneSignIn = async () => {
    setIsLoading(true);
    try {
      setupRecaptcha();
      const appVerifier = (window as any).recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setIsLoading(true);
    try {
      const result = await confirmationResult.confirm(verificationCode);
      onSuccess(result.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-dark/80 backdrop-blur-2xl p-6"
    >
      <div className="w-full max-w-md glass-card rounded-[40px] p-10 shadow-2xl border border-white/10 relative overflow-hidden">
        <div className="scanline" />
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-20 h-20 rounded-3xl bg-accent/20 flex items-center justify-center border border-accent/30 shadow-[0_0_30px_rgba(0,242,255,0.2)] mb-6">
            <Bot size={40} className="text-accent" />
          </div>
          <h2 className="text-3xl font-display font-bold text-white mb-2">Initialize Nova</h2>
          <p className="text-slate-500 text-sm font-mono uppercase tracking-widest">Secure biometric & identity synchronization</p>
        </div>

        <div id="recaptcha-container"></div>

        <div className="space-y-6">
          <div className="flex p-1 bg-white/5 rounded-2xl mb-8 border border-white/5">
            <button 
              onClick={() => setMethod('google')}
              className={cn(
                "flex-1 py-3 rounded-xl text-[10px] font-mono uppercase tracking-widest transition-all",
                method === 'google' ? "bg-accent/10 text-accent shadow-sm border border-accent/20" : "text-slate-500"
              )}
            >
              Google Auth
            </button>
            <button 
              onClick={() => setMethod('phone')}
              className={cn(
                "flex-1 py-3 rounded-xl text-[10px] font-mono uppercase tracking-widest transition-all",
                method === 'phone' ? "bg-accent/10 text-accent shadow-sm border border-accent/20" : "text-slate-500"
              )}
            >
              Phone Auth
            </button>
          </div>

          {method === 'google' ? (
            <button 
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full py-5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-4 hover:bg-white/10 transition-all shadow-lg group"
            >
              <Mail className="text-accent group-hover:scale-110 transition-transform" />
              <span className="font-bold text-slate-200 font-mono uppercase tracking-widest text-sm">Continue with Google</span>
            </button>
          ) : (
            <div className="space-y-4">
              {!confirmationResult ? (
                <>
                  <input 
                    type="tel" 
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+880 1XXX XXXXXX"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-lg font-mono text-white focus:border-accent outline-none transition-all placeholder:text-slate-600"
                  />
                  <button 
                    onClick={handlePhoneSignIn}
                    disabled={isLoading || !phoneNumber}
                    className="w-full py-5 bg-accent text-bg-dark rounded-2xl font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all disabled:opacity-50 uppercase tracking-widest"
                  >
                    Send Verification Code
                  </button>
                </>
              ) : (
                <>
                  <input 
                    type="text" 
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-center text-2xl font-mono tracking-[0.5em] text-white focus:border-accent outline-none transition-all placeholder:text-slate-600"
                  />
                  <button 
                    onClick={handleVerifyCode}
                    disabled={isLoading || !verificationCode}
                    className="w-full py-5 bg-accent text-bg-dark rounded-2xl font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all disabled:opacity-50 uppercase tracking-widest"
                  >
                    Verify & Initialize
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <p className="mt-10 text-center text-[9px] font-mono text-slate-600 uppercase tracking-[0.3em]">
          Nova AI | Secure Identity Protocol v4.0
        </p>
      </div>
    </motion.div>
  );
};

interface SimLinkModalProps {
  onClose: () => void;
  onSuccess: (number: string) => void;
  handleTTS: (text: string) => void;
  setError: (err: string) => void;
}

const SimLinkModal = ({ onClose, onSuccess, handleTTS, setError }: SimLinkModalProps) => {
  const [number, setNumber] = useState('');

  const handleLink = async () => {
    if (number.length >= 10) {
      if (auth.currentUser) {
        try {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), { phoneNumber: number });
        } catch (err) {
          console.error("Failed to update phone number in Firestore:", err);
        }
      }
      onSuccess(number);
      handleTTS("অভিনন্দন! আপনার সিম কার্ডটি সফলভাবে নোভার সাথে লিঙ্ক করা হয়েছে। এখন আপনি সরাসরি আপনার নাম্বার ব্যবহার করে কল করতে পারবেন।");
    } else {
      setError("Please enter a valid mobile number.");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-bg-dark/60 backdrop-blur-md p-6"
    >
      <div className="w-full max-w-md glass-card rounded-3xl p-8 shadow-2xl border border-white/10">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
              <Smartphone className="text-accent" />
            </div>
            <h2 className="text-xl font-bold text-white font-display">Link Your SIM</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="space-y-6">
          <p className="text-sm text-slate-400 leading-relaxed font-mono uppercase tracking-wider text-[11px]">
            Connect your physical SIM card to Nova AI to make and receive calls directly using your own number.
          </p>
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.2em]">Mobile Number</label>
            <input 
              type="tel" 
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="+880 1XXX XXXXXX"
              className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-lg font-mono text-white focus:border-accent outline-none transition-all placeholder:text-slate-700"
            />
          </div>
          <button 
            onClick={handleLink}
            disabled={number.length < 10}
            className="w-full py-4 bg-accent text-bg-dark rounded-xl font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all disabled:opacity-50 uppercase tracking-widest"
          >
            LINK SIM DIRECTLY
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const Dashboard = ({ status }: { status: any }) => {
  const [ipAddress, setIpAddress] = useState<string>('SCANNING...');
  const [networkSpeed, setNetworkSpeed] = useState('0');

  useEffect(() => {
    // IP Info
    const fetchIp = async () => {
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        if (data && data.ip) {
          setIpAddress(data.ip);
        } else {
          throw new Error("No IP found");
        }
      } catch (err) {
        console.warn("Failed to fetch primary IP, trying fallback...", err);
        try {
          const resFallback = await fetch('https://ipapi.co/json/');
          const dataFallback = await resFallback.json();
          if (dataFallback && dataFallback.ip) {
            setIpAddress(dataFallback.ip);
          } else {
            setIpAddress('192.168.1.1');
          }
        } catch (e) {
          setIpAddress('127.0.0.1');
        }
      }
    };
    fetchIp();

    const interval = setInterval(() => {
      setNetworkSpeed((Math.random() * 50 + 10).toFixed(1));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      <div className="glass-card p-2 rounded-xl flex items-center gap-2 border border-white/5 bg-white/5">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
          <Battery size={14} className={cn("text-emerald-400", status.isCharging && "animate-pulse")} />
        </div>
        <div className="min-w-0">
          <div className="text-[8px] font-mono text-slate-500 uppercase tracking-[0.15em] leading-none mb-1">Battery</div>
          <div className="text-xs font-mono font-bold text-white">{status.battery}%</div>
        </div>
      </div>

      <div className="glass-card p-2 rounded-xl flex items-center gap-2 border border-white/5 bg-white/5">
        <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center border border-accent/20">
          <Cpu size={14} className="text-accent" />
        </div>
        <div className="min-w-0">
          <div className="text-[8px] font-mono text-slate-500 uppercase tracking-[0.15em] leading-none mb-1">CPU Load</div>
          <div className="text-xs font-mono font-bold text-white">{status.cpu}%</div>
        </div>
      </div>

      <div className="glass-card p-2 rounded-xl flex items-center gap-2 border border-white/5 bg-white/5">
        <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
          <Database size={14} className="text-amber-400" />
        </div>
        <div className="min-w-0">
          <div className="text-[8px] font-mono text-slate-500 uppercase tracking-[0.15em] leading-none mb-1">RAM</div>
          <div className="text-xs font-mono font-bold text-white">{status.ram}%</div>
        </div>
      </div>

      <div className="glass-card p-2 rounded-xl flex items-center gap-2 border border-white/5 bg-white/5">
        <div className="w-7 h-7 rounded-lg bg-accent-purple/10 flex items-center justify-center border border-accent-purple/20">
          <Wifi size={14} className="text-accent-purple" />
        </div>
        <div className="min-w-0">
          <div className="text-[8px] font-mono text-slate-500 uppercase tracking-[0.15em] leading-none mb-1">Network</div>
          <div className="text-xs font-mono font-bold text-white truncate">{networkSpeed} <span className="text-[8px] text-slate-500">Mb/s</span></div>
        </div>
      </div>

      <div className="glass-card p-2 rounded-xl flex flex-col justify-between border border-white/5 bg-white/5 col-span-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[8px] font-mono text-slate-500 uppercase tracking-[0.15em] leading-none">Neural</div>
          <div className={cn("px-1 py-0.5 rounded text-[7px] font-bold uppercase", status.network === 'online' ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-500")}>
            {status.network}
          </div>
        </div>
        <div className="h-4 flex items-end gap-0.5 px-0.5">
          {[40, 70, 45, 90, 65, 80, 55, 95, 75, 85, 60, 100].map((h, i) => (
            <motion.div 
              key={`dash-bar-${i}`}
              initial={{ height: 0 }}
              animate={{ height: `${status.cpu + (h/10)}%` }}
              transition={{ duration: 0.5 }}
              className="flex-1 bg-gradient-to-t from-accent/5 to-accent/40 rounded-t-sm border-t border-accent/30"
            />
          ))}
        </div>
      </div>

      <div className="glass-card p-2 rounded-xl flex items-center gap-2 border border-white/5 bg-white/5 col-span-1 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-accent-purple/10 flex items-center justify-center border border-accent-purple/20">
          <Globe size={14} className="text-accent-purple" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[8px] font-mono text-slate-500 uppercase tracking-[0.15em] leading-none mb-1">IP Address</div>
          <div className="text-[9px] font-mono text-accent-purple font-bold truncate" title={ipAddress}>
            {ipAddress}
          </div>
        </div>
      </div>
    </div>
  );
};

const Notes = () => {
  const [notes, setNotes] = useState<{id: string, text: string}[]>([]);
  const [newNote, setNewNote] = useState('');

  const addNote = () => {
    if (newNote.trim()) {
      const noteObj = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        text: newNote
      };
      setNotes([noteObj, ...notes]);
      setNewNote('');
    }
  };

  return (
    <div className="glass-card p-6 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-1 h-full bg-accent/20" />
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-accent/10 rounded-lg border border-accent/20">
          <StickyNote size={18} className="text-accent" />
        </div>
        <div>
          <h3 className="text-lg font-display font-bold text-white">Neural Notes</h3>
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.2em]">Persistent memory module</p>
        </div>
      </div>
      <div className="flex gap-2 mb-6">
        <input 
          type="text" 
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Capture thought..."
          className="flex-1 bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-mono text-white outline-none focus:border-accent/50 transition-all placeholder:text-slate-600"
        />
        <button onClick={addNote} className="p-4 bg-accent text-bg-dark rounded-xl hover:bg-accent/90 transition-all shadow-lg shadow-accent/10">
          <Plus size={20} />
        </button>
      </div>
      <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
        {notes.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-[10px] font-mono text-slate-600 uppercase tracking-[0.2em]">Memory banks empty</p>
          </div>
        ) : (
          notes.map((note, idx) => (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              key={`note-${note.id}-${idx}`} 
              className="p-4 bg-white/5 border border-white/5 rounded-xl text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors group/note relative"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-accent/10 group-hover/note:bg-accent/40 transition-colors" />
              {note.text}
            </motion.div>
          ))
      )}
      </div>
    </div>
  );
};

const Reminder = () => {
  return (
    <div className="glass-card p-6 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-accent-purple/20" />
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-accent-purple/10 rounded-lg border border-accent-purple/20">
          <Bell size={18} className="text-accent-purple" />
        </div>
        <div>
          <h3 className="text-lg font-display font-bold text-white">Time Protocols</h3>
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.2em]">Scheduled task manager</p>
        </div>
      </div>
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
          <Clock size={24} className="text-slate-600 opacity-20" />
        </div>
        <div className="text-slate-600 text-[10px] font-mono uppercase tracking-[0.2em]">No active reminders in current timeline</div>
      </div>
    </div>
  );
};

const SOSMode = () => {
  return (
    <div className="fixed bottom-32 right-4 md:right-8 z-[130]">
      <motion.button 
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-red-600 text-white flex items-center justify-center shadow-2xl shadow-red-200 border-4 border-white"
      >
        <ShieldAlert size={28} className="md:w-8 md:h-8" />
      </motion.button>
    </div>
  );
};

const MediaCenter = ({ media, onClose, isMinimized, setIsMinimized, onSearchAlternative }: { 
  media: { type: 'youtube' | 'tiktok' | 'audio' | 'url' | 'facebook' | 'instagram' | 'spotify', url: string, title?: string }, 
  onClose: () => void,
  isMinimized: boolean,
  setIsMinimized: (v: boolean) => void,
  onSearchAlternative?: (query: string) => void
}) => {
  const [embedUrl, setEmbedUrl] = useState('');
  const [isSearchQuery, setIsSearchQuery] = useState(false);
  const [isDesktopMode, setIsDesktopMode] = useState(false);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoSearching, setIsAutoSearching] = useState(false);

    const initYouTubePlayer = (videoId: string, isSearch: boolean = false) => {
      setIsLoading(true);
      setPlayerError(null);
      setIsAutoSearching(false);
      
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }
  
      const origin = typeof window !== 'undefined' && window.location.origin !== 'null' ? window.location.origin : 'https://www.youtube.com';
      
      const playerOptions: any = {
        height: '100%',
        width: '100%',
        playerVars: {
          autoplay: 1,
          mute: 0, 
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: origin,
          widget_referrer: origin,
          playsinline: 1
        },
        events: {
          onReady: (event: any) => {
            setIsLoading(false);
            try {
              event.target.playVideo();
              // Unmute attempt
              setTimeout(() => {
                try {
                  event.target.unMute();
                  event.target.setVolume(100);
                } catch (e) {}
              }, 1000);
            } catch (e) {}
          },
          onStateChange: (event: any) => {
            if (event.data === (window as any).YT.PlayerState.PLAYING) {
              setIsLoading(false);
              setPlayerError(null);
            }
          },
          onError: (event: any) => {
            setIsLoading(false);
            console.error('YouTube Player Error Code:', event.data);
            
            let msg = `Playback Error (Code: ${event.data})`;
            switch (event.data) {
              case 2: msg = 'Invalid parameter value (Invalid Video ID).'; break;
              case 5: msg = 'The requested content cannot be played in an HTML5 player.'; break;
              case 100: msg = 'The video requested was not found (Removed or Private).'; break;
              case 101:
              case 150: 
                msg = 'The owner of this video does not allow it to be played in embedded players. Searching for an alternative version for you, Boss...'; 
                if (onSearchAlternative && media.title) {
                  setIsAutoSearching(true);
                  setTimeout(() => onSearchAlternative(media.title || ''), 2000);
                }
                break;
              default: msg = `An unknown error occurred (Error ID: ${event.data}). This video might be restricted in your region.`;
            }
            setPlayerError(msg);
            
            // Fallback to direct iframe if API fails
            if (event.data !== 101 && event.data !== 150) {
              setEmbedUrl(`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`);
            }
          }
        }
      };
  
      if (isSearch) {
        playerOptions.playerVars.listType = 'search';
        playerOptions.playerVars.list = videoId;
      } else {
        playerOptions.videoId = videoId;
      }
  
      if ((window as any).YT && (window as any).YT.Player) {
        try {
          playerRef.current = new (window as any).YT.Player(containerRef.current, playerOptions);
        } catch (e) {
          console.error("Failed to create YT Player:", e);
          setEmbedUrl(`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`);
          setIsLoading(false);
        }
      } else {
        // Fallback: If YT API is not ready, try to load it and use a standard iframe as temporary fallback
        if (!document.getElementById('youtube-api-script')) {
          const tag = document.createElement('script');
          tag.id = 'youtube-api-script';
          tag.src = "https://www.youtube.com/iframe_api";
          const firstScriptTag = document.getElementsByTagName('script')[0];
          firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        }
  
        const fallbackIframe = () => {
          setEmbedUrl(`https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&origin=${encodeURIComponent(origin)}&rel=0&modestbranding=1&playsinline=1`);
          setIsLoading(false);
        };
  
        if ((window as any).onYouTubeIframeAPIReady) {
          const oldReady = (window as any).onYouTubeIframeAPIReady;
          (window as any).onYouTubeIframeAPIReady = () => {
            if (oldReady) oldReady();
            try {
              playerRef.current = new (window as any).YT.Player(containerRef.current, playerOptions);
            } catch (e) { fallbackIframe(); }
          };
        } else {
          (window as any).onYouTubeIframeAPIReady = () => {
            try {
              playerRef.current = new (window as any).YT.Player(containerRef.current, playerOptions);
            } catch (e) { fallbackIframe(); }
          };
        }
        
        // Set a timeout to use fallback if API takes too long
        setTimeout(() => {
          if (!playerRef.current) fallbackIframe();
        }, 3000);
      }
    };

  useEffect(() => {
    let url = media.url;
    const origin = typeof window !== 'undefined' && window.location.origin !== 'null' ? window.location.origin : 'https://www.youtube.com';
    let extraParams = `&enablejsapi=1&rel=0&modestbranding=1&autoplay=1&playsinline=1&widget_referrer=${encodeURIComponent(origin)}`;
    
    if (isDesktopMode) {
      extraParams += '&app=desktop&persist_app=1';
    }

    setPlayerError(null);

    if (media.type === 'youtube') {
      const isSearch = !url.includes('http') && (url.includes(' ') || (url.length !== 11));
      setIsSearchQuery(isSearch);

      let videoId = url;
      if (!isSearch && (url.includes('youtube.com') || url.includes('youtu.be'))) {
        const vidMatch = url.match(/(?:v=|\/|embed\/|youtu\.be\/)([0-9A-Za-z_-]{11})/);
        if (vidMatch) {
          videoId = vidMatch[1];
          initYouTubePlayer(videoId, isSearch);
        } else {
          // It's a youtube URL but not a specific video (e.g. home page)
          setPlayerError("Boss, YouTube's home page cannot be embedded directly for security reasons. Please use the search or the trending feed to find videos to play inside Nova.");
          setIsLoading(false);
        }
      } else {
        initYouTubePlayer(videoId, isSearch);
      }
    } else if (media.type === 'facebook') {
      // Use mobile facebook to avoid some frame restrictions and app prompts
      const fbUrl = url.replace('www.facebook.com', 'm.facebook.com');
      setEmbedUrl(fbUrl.includes('plugins/video.php') ? fbUrl : `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(fbUrl)}&show_text=0&width=560`);
    } else if (media.type === 'tiktok') {
      if (url.includes('tiktok.com') && !url.includes('embed')) {
        const videoIdMatch = url.match(/\/video\/(\d+)/);
        // Force web version with parameters
        const webParams = "?is_from_webapp=1&sender_device=pc";
        setEmbedUrl(videoIdMatch ? `https://www.tiktok.com/embed/v2/${videoIdMatch[1]}${webParams}` : `${url}${url.includes('?') ? '&' : '?'}${webParams.substring(1)}`);
      } else {
        setEmbedUrl(url);
      }
    } else if (media.type === 'instagram') {
      // Instagram is very restrictive, but we can try the embed or mobile site
      setEmbedUrl(url.includes('instagram.com/p/') ? `${url}embed` : url);
    } else {
      setEmbedUrl(url);
    }

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
      }
    };
  }, [media.url, media.type, isDesktopMode]);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ 
        opacity: 1, 
        scale: 1, 
        y: 0,
        width: isMinimized ? 300 : '100%',
        height: isMinimized ? 200 : '100%',
        position: isMinimized ? 'fixed' : 'relative',
        bottom: isMinimized ? 100 : 'auto',
        right: isMinimized ? 20 : 'auto',
        zIndex: isMinimized ? 200 : 150
      }}
      className={cn(
        "flex flex-col bg-bg-dark overflow-hidden shadow-2xl transition-all duration-500 border border-white/10",
        isMinimized ? "rounded-2xl border-2 border-accent/50" : "flex-1"
      )}
    >
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
        <button 
          onClick={() => setIsDesktopMode(!isDesktopMode)}
          className={cn(
            "p-2 backdrop-blur-md rounded-xl transition-all border",
            isDesktopMode ? "bg-accent text-bg-dark border-accent/50" : "bg-white/5 text-white border-white/10 hover:bg-white/10"
          )}
          title="Desktop Mode"
        >
          <Monitor size={14} />
        </button>
        <button 
          onClick={() => {
            if (media.type === 'youtube') {
              const url = media.url;
              const isSearch = !url.includes('http') && (url.includes(' ') || (url.length !== 11));
              let videoId = url;
              if (!isSearch && (url.includes('youtube.com') || url.includes('youtu.be'))) {
                const vidMatch = url.match(/(?:v=|\/|embed\/|youtu\.be\/)([0-9A-Za-z_-]{11})/);
                if (vidMatch) videoId = vidMatch[1];
              }
              initYouTubePlayer(videoId, isSearch);
            } else {
              const current = embedUrl;
              setEmbedUrl('');
              setTimeout(() => setEmbedUrl(current), 100);
            }
          }}
          className="p-2 bg-white/5 backdrop-blur-md text-white rounded-xl hover:bg-white/10 transition-all border border-white/10"
          title="Reload Player"
        >
          <RotateCcw size={14} />
        </button>
        <button 
          onClick={() => setIsMinimized(!isMinimized)}
          className="p-2 bg-white/5 backdrop-blur-md text-white rounded-xl hover:bg-white/10 transition-all border border-white/10"
          title={isMinimized ? "Expand" : "Minimize"}
        >
          {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
        </button>
        <button 
          onClick={onClose}
          className="p-2 bg-red-500/10 backdrop-blur-md text-red-500 rounded-xl hover:bg-red-500/20 transition-all border border-red-500/20"
        >
          <X size={14} />
        </button>
      </div>

      {!isMinimized && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
          <div className="px-4 py-2 bg-bg-dark/60 backdrop-blur-md text-white rounded-xl font-mono text-[9px] uppercase tracking-[0.2em] border border-white/10 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
            <span className="text-accent">{media.type} Protocol</span>
            <span className="text-slate-500">|</span>
            <span className="truncate max-w-[200px]">{media.title || 'Nova Media'}</span>
          </div>
        </div>
      )}
      
      <div className="flex-1 w-full h-full relative bg-bg-dark">
        {isLoading && !playerError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-dark z-10">
            <div className="w-16 h-16 border-4 border-accent/10 border-t-accent rounded-full animate-spin mb-6" />
            <p className="text-accent text-[10px] font-mono uppercase tracking-[0.4em] animate-pulse">Initializing Nova Stream...</p>
          </div>
        )}

        {isAutoSearching && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-dark/95 z-30">
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mb-8 border border-accent/20"
            >
              <Search className="text-accent" size={36} />
            </motion.div>
            <h3 className="text-white font-display font-bold uppercase tracking-[0.3em] text-lg mb-3">Searching Alternative</h3>
            <p className="text-slate-500 text-[10px] font-mono uppercase tracking-[0.2em]">Bypassing embedding restrictions...</p>
          </div>
        )}

        {playerError && !isAutoSearching ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-dark z-20 p-10 text-center">
            <div className="w-24 h-24 bg-red-500/5 rounded-full flex items-center justify-center mb-8 border border-red-500/10">
              <AlertTriangle className="text-red-500" size={48} />
            </div>
            <h3 className="text-white font-display font-bold uppercase tracking-tight text-2xl mb-4">Playback Restricted</h3>
            <p className="text-slate-500 text-xs max-w-sm mb-10 leading-relaxed font-mono uppercase tracking-widest">
              {playerError}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button 
                onClick={() => setIsDesktopMode(!isDesktopMode)}
                className="px-8 py-4 bg-accent text-bg-dark rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-accent/90 transition-all shadow-lg shadow-accent/10 flex items-center gap-3"
              >
                <Monitor size={16} /> Try Desktop Mode
              </button>
              {onSearchAlternative && media.type === 'youtube' && (
                <button 
                  onClick={() => onSearchAlternative(media.title || media.url)}
                  className="px-8 py-4 bg-emerald-500 text-bg-dark rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/10 flex items-center gap-3"
                >
                  <Search size={16} /> Search Alternative
                </button>
              )}
              <button 
                onClick={() => window.open(media.url, 'NovaPortal', 'width=1200,height=800')}
                className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-white/10 transition-all flex items-center gap-3"
              >
                <Globe size={16} /> Nova Web Portal
              </button>
            </div>
          </div>
        ) : (media.type === 'youtube' && !embedUrl) ? (
          <div className={cn(
            "w-full h-full flex items-center justify-center overflow-hidden",
            isDesktopMode && !isMinimized && "bg-bg-dark"
          )}>
            <div 
              ref={containerRef}
              className={cn(
                "transition-all duration-500",
                isDesktopMode && !isMinimized ? "w-[1280px] h-[720px] scale-[0.6] md:scale-[0.8] lg:scale-100 origin-center" : "w-full h-full"
              )}
            />
          </div>
        ) : (
          <div className="w-full h-full">
            <iframe 
              src={embedUrl || null}
              className="w-full h-full border-none"
              sandbox="allow-scripts allow-same-origin allow-forms"
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="no-referrer"
              loading="lazy"
              onLoad={() => setIsLoading(false)}
            />
          </div>
        )}
      </div>
        {!isMinimized && media.type === 'youtube' && (
          <div className="absolute bottom-6 left-6 z-20 flex items-center gap-3">
            <a 
              href={media.url.includes('http') ? media.url : `https://www.youtube.com/watch?v=${media.url}`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-bg-dark/60 backdrop-blur-md text-slate-400 hover:text-accent rounded-xl font-mono text-[9px] uppercase tracking-[0.2em] border border-white/10 transition-all flex items-center gap-3 group"
            >
              <ExternalLink size={12} className="group-hover:scale-110 transition-transform" />
              {isSearchQuery ? 'Open Search' : 'Open on YouTube'}
            </a>
            {!isSearchQuery && (
              <button 
                onClick={() => {
                  // If embed fails, toggle to search mode
                  setIsSearchQuery(true);
                }}
                className="px-4 py-2 bg-accent/10 backdrop-blur-md text-accent hover:bg-accent/20 rounded-xl font-mono text-[9px] uppercase tracking-[0.2em] border border-accent/20 transition-all flex items-center gap-3"
              >
                <Zap size={12} />
                Fix Player
              </button>
            )}
          </div>
        )}
    </motion.div>
  );
};

const safeStringify = (obj: any) => {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    console.error("Serialization error:", e);
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) return;
        cache.add(value);
      }
      return value;
    });
  }
};

const formatPhoneNumber = (num: string, reveal: boolean) => {
  if (reveal) return num;
  if (!num) return '';
  const clean = num.trim();
  if (clean.length > 6) {
    return clean.slice(0, 3) + '••••' + clean.slice(-3);
  }
  return '••••••';
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [user, setUser] = useState<any>(null);
  const [showAuth, setShowAuth] = useState(true);
  const [showSimLink, setShowSimLink] = useState(false);
  const [linkedSim, setLinkedSim] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system';
  });

  useEffect(() => {
    const handleThemeChange = () => {
      const root = document.documentElement;
      root.classList.remove('light-mode');
      
      let isDark = true;
      if (theme === 'system') {
        isDark = !window.matchMedia('(prefers-color-scheme: light)').matches;
      } else {
        isDark = theme === 'dark';
      }
      
      if (!isDark) {
        root.classList.add('light-mode');
      }
    };

    handleThemeChange();
    localStorage.setItem('theme', theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
      const listener = () => handleThemeChange();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (u) {
        setUser(u);
        setShowAuth(false);
      } else {
        setShowAuth(true);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAuthSuccess = (u: any) => {
    setUser(u);
    setShowAuth(false);
    handleTTS(`স্বাগতম ${u.displayName || 'ব্যবহারকারী'}! নোভার সাথে আপনার পরিচয় সফল হয়েছে।`);
  };

  const handleSimLinkSuccess = (num: string) => {
    setLinkedSim(num);
    setShowSimLink(false);
  };

  useEffect(() => {
    const lastSalamDate = localStorage.getItem('lastSalamDate');
    const today = new Date().toDateString();
    
    let greeting = '';
    if (lastSalamDate !== today) {
      greeting = 'Salam, Boss. ';
      localStorage.setItem('lastSalamDate', today);
    } else {
      greeting = 'Welcome back, Boss. ';
    }

    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: `${greeting}Your Personal Nova AI is online and fully synchronized. I am ready to obey all your commands and manage your tasks. How can I serve you today?`,
        timestamp: new Date()
      }
    ]);
  }, []);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const isLiveModeRef = useRef(false);
  
  useEffect(() => {
    isLiveModeRef.current = isLiveMode;
  }, [isLiveMode]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const speakingMessageIdRef = useRef<string | null>(null);
  const activeAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'terminal' | 'scan' | 'encryption' | 'history' | 'settings' | 'apps' | 'dashboard' | 'search' | 'media' | 'voice' | 'app-permissions'>('terminal');
  const [showDashboard, setShowDashboard] = useState(true);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callHistory, setCallHistory] = useState<CallRecord[]>(() => {
    const saved = localStorage.getItem('nova_call_history');
    return saved ? JSON.parse(saved).map((c: any) => ({ ...c, timestamp: new Date(c.timestamp) })) : [];
  });
  const [installedApps, setInstalledApps] = useState<any[]>(() => {
    // Mock data for development, real data will come from NovaNative bridge
    return [
      { id: 1, name: 'WhatsApp', pkg: 'com.whatsapp', permissions: { mic: true, cam: true, location: true }, icon: 'MessageSquare' },
      { id: 2, name: 'Facebook', pkg: 'com.facebook.katana', permissions: { mic: false, cam: true, location: false }, icon: 'Facebook' },
      { id: 3, name: 'Spotify', pkg: 'com.spotify.music', permissions: { mic: true, cam: false, location: true }, icon: 'Music' },
      { id: 4, name: 'YouTube', pkg: 'com.google.android.youtube', permissions: { mic: true, cam: true, location: true }, icon: 'Youtube' },
    ];
  });

  const toggleAppPermission = (pkg: string, type: string) => {
    setInstalledApps(prev => prev.map(app => 
      app.pkg === pkg 
        ? { ...app, permissions: { ...app.permissions, [type]: !app.permissions[type] } }
        : app
    ));
    
    // Call Native Bridge if available
    if ((window as any).NovaNative) {
      (window as any).NovaNative.togglePermission(pkg, type, true);
    }
    
    addTerminalLog(`System updated permission [${type}] for ${pkg}`, 'info');
  };

  const toggleAllAppPermissions = (active: boolean) => {
    setInstalledApps(prev => prev.map(app => {
      const newPerms = { ...app.permissions };
      Object.keys(newPerms).forEach(k => newPerms[k] = active);
      return { ...app, permissions: newPerms };
    }));
    
    addTerminalLog(`Bulk permission update: All apps set to ${active ? "ENABLED" : "DISABLED"}`, active ? 'info' : 'warn');
    
    if ((window as any).NovaNative) {
      (window as any).NovaNative.bulkTogglePermissions(active);
    }
  };

  useEffect(() => {
    localStorage.setItem('nova_call_history', safeStringify(callHistory));
  }, [callHistory]);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [activeMedia, setActiveMedia] = useState<{ type: 'youtube' | 'tiktok' | 'audio' | 'url' | 'facebook', url: string, title?: string } | null>(null);
  const [isMediaMinimized, setIsMediaMinimized] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const [selectedVoice, setSelectedVoice] = useState(() => {
    const saved = localStorage.getItem('nova_selected_voice');
    const allowed = ['achernar', 'achird', 'algenib', 'algieba', 'alnilam', 'aoede', 'autonoe', 'callirrhoe', 'charon', 'despina', 'enceladus', 'erinome', 'fenrir', 'gacrux', 'iapetus', 'kore', 'laomedeia', 'leda', 'orus', 'puck', 'pulcherrima', 'rasalgethi', 'sadachbia', 'sadaltager', 'schedar', 'sulafat', 'umbriel', 'vindemiatrix', 'zephyr', 'zubenelgenubi'];
    if (saved && allowed.includes(saved.toLowerCase())) {
      return saved.toLowerCase();
    }
    return 'zephyr';
  });
  const [systemStatus, setSystemStatus] = useState({
    battery: 100,
    isCharging: false,
    cpu: 18,
    ram: 42,
    network: navigator.onLine ? 'online' : 'offline'
  });
  const [terminalLog, setTerminalLog] = useState<{id: string, msg: string, type: 'info' | 'success' | 'warn' | 'error' | 'cmd'}[]>([]);

  const [showScrollButton, setShowScrollButton] = useState(false);
  const wakeLockRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const liveAssistantRef = useRef<NovaLiveAssistant | null>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    localStorage.setItem('nova_selected_voice', selectedVoice);
  }, [selectedVoice]);

  // System Status Monitoring
  useEffect(() => {
    const updateBattery = async () => {
      try {
        if ('getBattery' in navigator) {
          const battery: any = await (navigator as any).getBattery();
          const update = () => {
            setSystemStatus(prev => ({
              ...prev,
              battery: Math.round(battery.level * 100),
              isCharging: battery.charging
            }));
          };
          battery.addEventListener('levelchange', update);
          battery.addEventListener('chargingchange', update);
          update();
        }
      } catch (e) {
        console.warn("Battery API not supported");
      }
    };

    const updateNetwork = () => {
      setSystemStatus(prev => ({
        ...prev,
        network: navigator.onLine ? 'online' : 'offline'
      }));
    };

    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
    updateBattery();

    // Simulate CPU/RAM fluctuations for cyber feel
    const interval = setInterval(() => {
      setSystemStatus(prev => ({
        ...prev,
        cpu: Math.floor(15 + Math.random() * 25),
        ram: Math.floor(40 + Math.random() * 10)
      }));
    }, 5000);

    return () => {
      window.removeEventListener('online', updateNetwork);
      window.removeEventListener('offline', updateNetwork);
      clearInterval(interval);
    };
  }, []);

  const addTerminalLog = (msg: string, type: 'info' | 'success' | 'warn' | 'error' | 'cmd' = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setTerminalLog(prev => [...prev.slice(-49), { id, msg, type }]);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop <= clientHeight + 100;
    setShowScrollButton(!isAtBottom);
  };
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isSimLinked, setIsSimLinked] = useState(() => localStorage.getItem('nova_sim_linked') === 'true');
  const [linkedNumber, setLinkedNumber] = useState(() => localStorage.getItem('nova_linked_number') || '');
  
  // Real-time Calling States
  const [userNickname, setUserNickname] = useState(() => localStorage.getItem('user_nickname') || 'বস');
  const [myNovaId, setMyNovaId] = useState(() => localStorage.getItem('nova_id') || Math.floor(100000 + Math.random() * 900000).toString());
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [peer, setPeer] = useState<any>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callerId, setCallerId] = useState('');
  const [callerSignal, setCallerSignal] = useState<any>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const [userProfile, setUserProfile] = useState<any>(null);
  const [youtubeSearchQuery, setYoutubeSearchQuery] = useState('');
  const [youtubeSearchResults, setYoutubeSearchResults] = useState<any[]>([]);
  const [isSearchingYoutube, setIsSearchingYoutube] = useState(false);
  const [activePlatform, setActivePlatform] = useState<'youtube' | 'tiktok' | 'facebook' | 'instagram' | 'spotify'>('youtube');

  const handleYoutubeSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!youtubeSearchQuery.trim()) return;
    
    setIsSearchingYoutube(true);
    try {
      const results = await searchYouTubeList(youtubeSearchQuery);
      setYoutubeSearchResults(results);
    } catch (err) {
      console.error("YouTube Search Error:", err);
    } finally {
      setIsSearchingYoutube(false);
    }
  };
  const [searchNovaId, setSearchNovaId] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const unsubscribe = onSnapshot(userRef, async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserProfile(data);
          if (data.novaId) {
            setMyNovaId(data.novaId);
            localStorage.setItem('nova_id', data.novaId);
          }
        } else {
          // Create new profile with Nova ID
          const novaId = await generateUniqueNovaId();
          const newProfile = {
            uid: user.uid,
            displayName: user.displayName || 'Nova User',
            email: user.email || '',
            photoURL: user.photoURL || '',
            novaId: novaId,
            createdAt: new Date().toISOString()
          };
          await setDoc(userRef, newProfile);
          setUserProfile(newProfile);
          setMyNovaId(novaId);
          localStorage.setItem('nova_id', novaId);
        }
      });
      return () => unsubscribe();
    }
  }, [user]);

  const generateUniqueNovaId = async () => {
    let id = '';
    let isUnique = false;
    while (!isUnique) {
      id = Math.floor(100000 + Math.random() * 900000).toString();
      const q = query(collection(db, 'users'), where('novaId', '==', id));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        isUnique = true;
      }
    }
    return id;
  };

  const handleSearchUser = async () => {
    if (searchNovaId.length !== 6) {
      setError("Please enter a valid 6-digit Nova ID.");
      return;
    }
    setIsSearching(true);
    setSearchResult(null);
    try {
      const q = query(collection(db, 'users'), where('novaId', '==', searchNovaId));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        setSearchResult(querySnapshot.docs[0].data());
      } else {
        setError("User not found with this Nova ID.");
      }
    } catch (err: any) {
      console.error("Search failed:", err);
      setError("Search failed: " + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `সালাম বস! আমি **Nova AI**, আপনার পার্সোনাল সাইবার অ্যাসিস্ট্যান্ট। 

আমি এখন আরও শক্তিশালী! আমার নতুন ফিচারগুলো হলো:
🎨 **AI Image Generation:** আমাকে ছবি তৈরি করতে বলুন।
🔍 **Google Search:** রিয়েল-টাইম তথ্য ও খবরের জন্য আমি গুগল সার্চ করতে পারি।
📍 **Google Maps:** লোকেশন বা ম্যাপের তথ্যের জন্য আমি ম্যাপ ব্যবহার করতে পারি।
📱 **App Grid & Settings:** নতুন অ্যাপ গ্রিড এবং সেটিংস মেনু চেক করুন।
📞 **Direct SIM Calling:** সরাসরি সিম কার্ড দিয়ে কল করার সুবিধা।

আমি আপনার হুকুমের অপেক্ষায় আছি, বস!`,
        timestamp: new Date()
      }]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('nova_id', myNovaId);
    
    const newSocket = io(window.location.origin);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('register', { novaId: myNovaId, phoneNumber: linkedNumber });
    });

    newSocket.on('incoming-call', ({ from, offer, isPhone, isVideo }) => {
      setCallerId(from);
      setCallerSignal(offer);
      setIncomingCall({ from, status: 'ringing', isVideo, offer });
      handleTTS(isPhone 
        ? `বস, আপনার নাম্বারে একটি কল আসছে।` 
        : `বস, আইডি ${from} থেকে একটি কল আসছে।`
      );
    });

    newSocket.on('call-answered', ({ answer }) => {
      setCallAccepted(true);
      peer?.signal(answer);
    });

    newSocket.on('ice-candidate', ({ candidate }) => {
      peer?.signal(candidate);
    });

    newSocket.on('call-ended', () => {
      endCall();
    });

    return () => {
      newSocket.disconnect();
    };
  }, [myNovaId]);

  const startCall = async (targetId: string, isPhone: boolean = false, isVideo: boolean = false) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone/Camera access not supported in this browser.");
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: isVideo 
      }).catch(err => {
        console.error("getUserMedia error in startCall:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDismissedError' || err.name === 'SecurityError') {
          throw err;
        }
        // Try fallback with minimal constraints ONLY if it's a hardware/constraint error
        return navigator.mediaDevices.getUserMedia({ audio: true });
      });
      
      setStream(mediaStream);
      setLocalStream(mediaStream);
      setIsCalling(true);
      setIsVideoCall(isVideo);
      setDialingTarget({ 
        name: isPhone ? `SIM Call: ${targetId}` : `Nova User ${targetId}`, 
        number: targetId 
      });
      setIsDialPadOpen(true);
      setCallStatus('dialing');

      const newPeer = new Peer({
        initiator: true,
        trickle: false,
        stream: mediaStream,
      });

      newPeer.on('signal', (data) => {
        socket?.emit('call-user', { 
          to: targetId, 
          offer: data, 
          from: isPhone ? linkedNumber : myNovaId,
          isPhone,
          isVideo
        });
      });

      newPeer.on('stream', (remoteS) => {
        setRemoteStream(remoteS);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteS;
        }
        if (remoteAudioRef.current && !isVideo) {
          remoteAudioRef.current.srcObject = remoteS;
        }
      });

      setPeer(newPeer);
    } catch (err) {
      const isIframe = typeof window !== 'undefined' && window.self !== window.top;
      const iframeTip = isIframe ? " (প্রিভিউ উইন্ডোতে সিকিউরিটি পলিসির কারণে ক্যামেরা বা মাইক্রোফোন ব্লক হতে পারে। দয়া করে উপরের ডানদিকের 'Open in new tab' বাটনে ক্লিক করে নতুন ট্যাবে অ্যাপটি ওপেন করুন।)" : "";
      setError(`Camera/Microphone access denied. Cannot make call.${iframeTip}`);
    }
  };

  const answerCall = async () => {
    if (!incomingCall) return;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone/Camera access not supported in this browser.");
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: incomingCall.isVideo 
      }).catch(err => {
        console.error("getUserMedia error in answerCall:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDismissedError' || err.name === 'SecurityError') {
          throw err;
        }
        // Try fallback with minimal constraints ONLY if it's a hardware/constraint error
        return navigator.mediaDevices.getUserMedia({ audio: true });
      });
      
      setStream(mediaStream);
      setLocalStream(mediaStream);
      setIsCalling(true);
      setIsVideoCall(incomingCall.isVideo || false);
      setCallStatus('connected');
      setIncomingCall(null);
      setIsDialPadOpen(true);
      setDialingTarget({ name: incomingCall.from, number: incomingCall.from });

      const newPeer = new Peer({
        initiator: false,
        trickle: false,
        stream: mediaStream,
      });

      newPeer.on('signal', (data) => {
        socket?.emit('answer-call', { to: incomingCall.from, answer: data });
      });

      newPeer.on('stream', (remoteS) => {
        setRemoteStream(remoteS);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteS;
        }
        if (remoteAudioRef.current && !incomingCall.isVideo) {
          remoteAudioRef.current.srcObject = remoteS;
        }
      });

      newPeer.signal(incomingCall.offer);
      setPeer(newPeer);
    } catch (err) {
      const isIframe = typeof window !== 'undefined' && window.self !== window.top;
      const iframeTip = isIframe ? " (প্রিভিউ উইন্ডোতে সিকিউরিটি পলিসির কারণে ক্যামেরা বা মাইক্রোফোন ব্লক হতে পারে। দয়া করে উপরের ডানদিকের 'Open in new tab' বাটনে ক্লিক করে নতুন ট্যাবে অ্যাপটি ওপেন করুন।)" : "";
      setError(`Camera/Microphone access denied. Cannot answer call.${iframeTip}`);
    }
  };

  const endCall = () => {
    setIsCalling(false);
    setCallAccepted(false);
    setIncomingCall(null);
    setCallStatus('ended');
    
    if (peer) {
      peer.destroy();
      setPeer(null);
    }
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    if (dialingTarget) {
      socket?.emit('end-call', { to: dialingTarget.number });
    }

    setTimeout(() => {
      setDialingTarget(null);
      setCallStatus('idle');
      setIsDialPadOpen(false);
    }, 1500);
  };

  const handleCall = (target: string) => {
    if (!target) return;
    
    // Sanitize target (remove spaces, dashes, parentheses)
    const sanitizedTarget = target.replace(/[\s\-()]/g, '');
    // Check if it's a phone number (SIM call) - 9 to 15 digits
    const isPhone = /^\+?\d{9,15}$/.test(sanitizedTarget);
    
    if (isPhone) {
      // Trigger real SIM card call via standard tel URI (fully supported on web, webview and APK)
      window.location.href = `tel:${sanitizedTarget}`;
      
      // Add to history
      const newCall: CallRecord = {
        id: generateId(),
        type: 'outgoing',
        name: Object.keys(contacts).find(k => contacts[k] === target || contacts[k] === sanitizedTarget) || 'Unknown',
        number: sanitizedTarget,
        timestamp: new Date(),
        status: 'completed'
      };
      setCallHistory(prev => [newCall, ...prev]);
      return;
    }

    startCall(target, isPhone);
    
    // Add to history
    const newCall: CallRecord = {
      id: generateId(),
      type: 'outgoing',
      name: Object.keys(contacts).find(k => contacts[k] === target) || 'Unknown',
      number: target,
      timestamp: new Date(),
      status: 'completed'
    };
    setCallHistory(prev => [newCall, ...prev]);
  };

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        // Screen Wake Lock might be disallowed by permissions policy (e.g. in iframes)
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('Wake Lock is active');
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        console.warn('Wake Lock disallowed by permissions policy. This is expected in some environments.');
      } else {
        console.error(`${err.name}, ${err.message}`);
      }
    }
  };

  const setupMediaSession = () => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Nova AI - Persistent Assistant',
        artist: 'Nova System',
        album: 'Background Mode Active',
        artwork: [
          { src: 'https://picsum.photos/seed/nova/512/512', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {});
      navigator.mediaSession.setActionHandler('pause', () => {});
    }
  };

  useEffect(() => {
    if (isLiveMode) {
      requestWakeLock();
      setupMediaSession();
      
      // Silent audio trick to keep background process alive
      const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
      silentAudio.loop = true;
      silentAudio.play().catch(() => {});
      
      // Re-request wake lock when page becomes visible
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && isLiveMode) {
          requestWakeLock();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        wakeLockRef.current?.release();
        wakeLockRef.current = null;
        silentAudio.pause();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [isLiveMode]);

  const [revealContacts, setRevealContacts] = useState(false);
  const [showSidebarContacts, setShowSidebarContacts] = useState(false);

  const [contacts, setContacts] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('nova_contacts');
    if (saved) return JSON.parse(saved);
    return {
      "sk ronju": "01303896955",
      "siyam": "+8801774294751",
      "tonmoy": "+8801998273127",
      "raton": "+8801905721554",
      "rasel": "+8801781886005",
      "হৃদয়": "01762077282",
      "abdul al imran": "+8801756601159",
      "abdul kuddus": "01723504910",
      "akter": "+8801754147517",
      "akter vai": "+8801774367235",
      "al amin": "+8801304604502",
      "al-amin": "01723037478",
      "alom": "01767104754",
      "alomgir": "+8801303462822",
      "alvi": "+8801332326106",
      "amber it": "+09611999666",
      "amberit": "+8801313488177",
      "amir": "+8801726500372",
      "amir hamza wifi": "01970665150",
      "amirul": "01753164641",
      "amit roy": "+919002247100",
      "apu sathi": "+8801303897014",
      "ashadul": "01722406222",
      "asif": "01646777137",
      "azim": "+8801304690516",
      "azimul islam sheblu": "+8801601401603",
      "b": "+919559688309",
      "bab music": "+02187787367",
      "bablu vai": "01977539295",
      "badol vai": "01641119144",
      "bangladesh cargo service": "01819228572",
      "bangladesh copyright": "+8801511440044",
      "bangladesh music distribution": "01781331837",
      "baul ikram uddin": "01726448774",
      "bb": "+8801713792099",
      "believe music agreetor": "+916000056872",
      "believe music id": "+6285786034014",
      "berkah abadi bersama production": "+6282223456135",
      "biddut music labs": "01300140143",
      "boro mama": "+8801305767575",
      "carent": "01763363588",
      "chatgpt": "+18002428478",
      "choto mama": "+8801755475335",
      "choto mami": "+8801866859380",
      "cp": "01751362828",
      "csc": "+919954254505",
      "customar care": "121",
      "d. mostofa kamal": "01729673547",
      "daraz": "+8809643716492",
      "daraz delivery": "+8801309529828",
      "daraz mgx": "+8809612716492",
      "delwar": "01751605461",
      "dj sohel": "01318632540",
      "dream records": "+917585024930",
      "dutch bengal bank": "09666716216",
      "st digital": "+919031012585",
      "ee": "01743291387",
      "eman vai": "+8801796683063",
      "excusd": "+96892751799",
      "fake": "+8801788542385",
      "faruk": "+8801785803498",
      "fazeel azeez": "+917012402241",
      "fb friend": "01728829483",
      "firoz khalu": "+8801751257291",
      "fuad": "+8801964480909",
      "gallery vision": "+971503460064",
      "gs tune studio": "+8801568443575",
      "hafizul": "01763020071",
      "hamidul": "+8801788246044",
      "hamza": "+8809639109613",
      "hannan": "01707312150",
      "haraz kaka": "+8801789387884",
      "hasam": "01740983912",
      "hasem": "+8801740983912",
      "help line post office": "01712685118",
      "hgzy": "01987306869",
      "hijra": "01306428346"
    };
  });

  useEffect(() => {
    localStorage.setItem('nova_contacts', safeStringify(contacts));
  }, [contacts]);
  const [incomingCall, setIncomingCall] = useState<{ from: string, status: 'ringing' | 'screening' | 'talking' | 'ended', isVideo?: boolean, offer?: any } | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleFunctionCall = async (name: string, args: any) => {
    console.log(`Function Call: ${name}`, args);
    
    // Intercept media platform requests to prevent opening external apps ONLY when playing content
    const mediaPlatforms = ['youtube', 'facebook', 'tiktok', 'music', 'video', 'player'];
    const lowerName = name.toLowerCase();
    
    // Only intercept if it's a play request or if it's a search query that should be internal
    if ((lowerName === 'open_url' || lowerName === 'open_app' || lowerName === 'open_tiktok') && args) {
      const target = (args.url || args.appId || args.query || '').toLowerCase();
      const isMediaTarget = mediaPlatforms.some(p => target.includes(p)) || target.includes('youtu.be');
      
      if (isMediaTarget) {
        // Force internal playback
        if (target.includes('http') || target.includes('youtu.be')) {
          name = 'play_video';
        } else {
          name = 'play_youtube';
          args.query = args.query || args.appId || '';
          args.platform = target.includes('facebook') ? 'facebook' : (target.includes('tiktok') ? 'tiktok' : 'youtube');
        }
      }
    }

    if (name === 'open_url') {
      const win = window.open(args.url, '_blank');
      if (win) {
        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'assistant',
          content: `Success: Opening ${args.siteName} in a new tab.`,
          timestamp: new Date()
        }]);
      } else {
        setError(`Popup Blocked: Please allow popups for this site to open ${args.siteName}.`);
        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'assistant',
          content: `I tried to open ${args.siteName}, but your browser blocked the popup. Please click [here](${args.url}) to open it manually or allow popups in your browser settings.`,
          timestamp: new Date()
        }]);
      }
    } else if (name === 'open_app') {
      const schemes: Record<string, string[]> = {
        facebook: ['fb://facewebmodal/f?href=https://www.facebook.com', 'fb://'],
        youtube: [
          'intent://www.youtube.com/#Intent;package=com.google.android.youtube;scheme=https;end',
          'vnd.youtube://',
          'youtube://',
          'https://www.youtube.com'
        ],
        whatsapp: ['whatsapp://', 'intent://send#Intent;package=com.whatsapp;scheme=whatsapp;end'],
        messenger: ['fb-messenger://', 'intent://#Intent;package=com.facebook.orca;scheme=fb-messenger;end'],
        spotify: ['spotify://', 'intent://#Intent;package=com.spotify.music;scheme=spotify;end'],
        instagram: ['instagram://', 'intent://#Intent;package=com.instagram.android;scheme=instagram;end'],
        twitter: ['twitter://', 'intent://#Intent;package=com.twitter.android;scheme=twitter;end'],
        telegram: ['tg://', 'intent://#Intent;package=org.telegram.messenger;scheme=tg;end'],
        tiktok: ['snssdk1128://', 'snssdk1233://', 'intent://#Intent;package=com.zhiliaoapp.musically;scheme=snssdk1128;end'],
      };
      
      const appId = args.appId.toLowerCase();
      const appSchemes = schemes[appId] || [`${appId}://`];
      
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `বস, আমি সরাসরি **${args.appId.toUpperCase()}** ওপেন করছি।`,
        timestamp: new Date()
      }]);

      // Attempt to launch directly
      const launch = (url: string) => {
        // Use location.href for deep links to trigger app, fallback to window.open
        window.location.href = url;
        setTimeout(() => {
          window.open(url, '_blank');
        }, 500);
      };

      // Try to launch the app directly
      launch(appSchemes[0]);
      
      // No fallback timeout that sends more messages immediately

    } else if (name === 'play_music' || name === 'watch_youtube' || name === 'play_video' || name === 'play_youtube') {
      const query = args.query || args.videoId || args.url;
      let embedUrl = '';
      let platform = args.platform || 'YouTube';
      
      const isUrl = (str: string) => /^(https?:\/\/)/.test(str);

      if (name === 'play_video' && args.url && isUrl(args.url)) {
        if (args.url.includes('youtube.com') || args.url.includes('youtu.be')) {
          const vidMatch = args.url.match(/(?:v=|\/|embed\/|youtu\.be\/)([0-9A-Za-z_-]{11})/);
          if (vidMatch) {
            embedUrl = vidMatch[1];
          } else {
            embedUrl = args.url;
          }
          platform = 'YouTube';
        } else if (args.url.includes('facebook.com')) {
          embedUrl = args.url;
          platform = 'Facebook';
        } else if (args.url.includes('tiktok.com')) {
          embedUrl = args.url;
          platform = 'TikTok';
        } else {
          embedUrl = args.url;
          platform = 'External';
        }
      } else if (query && isUrl(query)) {
        if (query.includes('youtube.com') || query.includes('youtu.be')) {
          const vidMatch = query.match(/(?:v=|\/|embed\/|youtu\.be\/)([0-9A-Za-z_-]{11})/);
          if (vidMatch) {
            embedUrl = vidMatch[1];
          } else {
            embedUrl = query;
          }
          platform = 'YouTube';
        } else if (query.includes('facebook.com')) {
          embedUrl = query;
          platform = 'Facebook';
        } else if (query.includes('tiktok.com')) {
          embedUrl = query;
          platform = 'TikTok';
        } else {
          embedUrl = query;
          platform = 'External';
        }
      } else {
        // It's a search query
        const searchPlatform = (args.platform || 'YouTube').toLowerCase();
        if (searchPlatform === 'facebook') {
          embedUrl = `https://www.facebook.com/watch/?v=${encodeURIComponent(query)}`;
          platform = 'Facebook';
        } else if (searchPlatform === 'tiktok') {
          embedUrl = `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`;
          platform = 'TikTok';
        } else {
          // YouTube Search - Use YouTube Data API for better results
          setIsLoading(true);
          const videoId = await searchYouTube(query);
          setIsLoading(false);
          
          if (videoId) {
            embedUrl = videoId;
          } else {
            embedUrl = query; // Fallback to search query if API fails
          }
          platform = 'YouTube';
        }
      }
      
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `জি বস, আমি নোভার নিজস্ব প্লেয়ারে **${platform}** থেকে এটি প্লে করছি।`,
        timestamp: new Date()
      }]);

      const isFacebook = embedUrl.includes('facebook.com');
      const isTikTok = embedUrl.includes('tiktok.com');
      setActiveMedia({ 
        type: isFacebook ? 'facebook' : (isTikTok ? 'tiktok' : 'youtube'), 
        url: embedUrl, 
        title: query || (isFacebook ? 'Facebook Video' : (isTikTok ? 'TikTok Video' : 'Video')) 
      });
      setIsMediaMinimized(false);
      setActiveTab('media');

    } else if (name === 'open_tiktok') {
      const query = args.query ? encodeURIComponent(args.query) : '';
      const tiktokUrl = query ? `https://www.tiktok.com/search?q=${query}` : `https://www.tiktok.com/foryou`;
      
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `বস, আমি নোভার মিডিয়া সেন্টারে **TikTok** ওপেন করছি।`,
        timestamp: new Date()
      }]);

      setActiveMedia({ type: 'tiktok', url: tiktokUrl, title: 'TikTok' });
      setActiveTab('media');

    } else if (name === 'open_camera') {
      setIsCameraOpen(true);
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `Initializing camera feed...`,
        timestamp: new Date()
      }]);
    } else if (name === 'get_time') {
      const { hour, minute, second, ampm, fullDate } = getTime();
      
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `🕒 **সময় আপডেট (বাংলাদেশ):**\n\n🇧🇩 **সময়:** ${hour}:${minute}:${second} ${ampm}\n📅 **তারিখ:** ${fullDate}`,
        timestamp: new Date()
      }]);
      // Nova says time once as requested
      handleTTS(`বস এখন সময় ${hour} টা ${minute} মিনিট ${ampm === 'PM' ? 'পিএম' : 'এএম'}`);
    } else if (name === 'make_call') {
      const target = args.target || args.phoneNumber;
      let phoneNumber = target;
      let contactName = '';

      // Check if target is a name in contacts
      const foundName = Object.keys(contacts).find(name => name.toLowerCase() === target.toLowerCase());
      if (foundName) {
        phoneNumber = contacts[foundName];
        contactName = foundName;
      }

      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: contactName 
          ? `বস, আমি সরাসরি **${contactName.toUpperCase()}**-কে কল করছি।`
          : `বস, আমি সরাসরি কল করছি: **${phoneNumber}**`,
        timestamp: new Date()
      }]);
      
      handleCall(phoneNumber);
      handleTTS(`বস, আমি ${contactName || phoneNumber} কে কল করছি।`);
    } else if (name === 'save_contact') {
      const contactName = args.name.toLowerCase();
      const phoneNumber = args.phoneNumber.replace(/\s+/g, '');
      
      setContacts(prev => ({ ...prev, [contactName]: phoneNumber }));
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `বস, আমি **${args.name}**-কে আপনার কন্টাক্ট লিস্টে সেভ করে নিয়েছি (${phoneNumber})। এখন আপনি নাম বললেই আমি কল করতে পারবো।`,
        timestamp: new Date()
      }]);
      handleTTS(`বস, আমি ${args.name} কে সেভ করে নিয়েছি।`);
    } else if (name === 'generate_image') {
      const prompt = args.prompt;
      const aspectRatio = args.aspectRatio || "1:1";
      
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `বস, আমি আপনার জন্য একটি ছবি তৈরি করছি: **${prompt}**`,
        timestamp: new Date()
      }]);

      generateImage(prompt, aspectRatio).then(imageUrl => {
        if (imageUrl) {
          setMessages(prev => [...prev, {
            id: generateId(),
            role: 'assistant',
            content: `বস, আপনার ছবিটি তৈরি হয়ে গেছে।`,
            imageUrl: imageUrl,
            timestamp: new Date()
          }]);
        } else {
          setError("Failed to generate image.");
        }
      }).catch(err => {
        console.error("Image generation failed:", err);
        setError("Image generation failed. Please check your API quota.");
      });
    } else if (name === 'control_system') {
      const { setting, action, value } = args;
      addTerminalLog(`Executing system control: ${setting} -> ${action}${value !== undefined ? ' ('+value+')' : ''}`, 'cmd');
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `বস, আমি আপনার কমান্ড অনুযায়ী **${setting.toUpperCase()} ${action.toUpperCase()}** করছি।`,
        timestamp: new Date()
      }]);
      // Implementation: mostly feedback and terminal logs as actual OS control is restricted in browser
      if (setting === 'volume') {
        if (action === 'mute') addTerminalLog("Master Audio Muted", "warn");
        else if (action === 'unmute') addTerminalLog("Master Audio Restored", "success");
        else addTerminalLog(`Volume Level set to ${value || action}`, "info");
      }
      if (setting === 'power') {
         if (action === 'shutdown') {
            addTerminalLog("INITIATING SYSTEM SHUTDOWN SEQUENCE...", "error");
            setTimeout(() => addTerminalLog("SYSCALL: SHUTDOWN -h now", "error"), 1000);
            setTimeout(() => addTerminalLog("Connection Terminated.", "warn"), 2500);
         } else {
            addTerminalLog(`System Power Event: ${action.toUpperCase()}`, "warn");
         }
      }
    } else if (name === 'manage_windows') {
      const { action, target } = args;
      addTerminalLog(`Window Manager: ${action.toUpperCase()} ${target || 'Current View'}`, 'cmd');
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `আই আই বস! আমি ${target ? '**'+target+'**' : 'আপনার স্ক্রিন'} ${action === 'minimize' ? 'মিনিমাইজ' : action === 'maximize' ? 'ম্যাক্সিমাইজ' : 'ম্যানেজ'} করছি।`,
        timestamp: new Date()
      }]);
    } else if (name === 'file_manager') {
      const { action, path } = args;
      addTerminalLog(`FileSystem: ${action.toUpperCase()} ${path}`, 'cmd');
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `বস, আপনার হুকুম অনুযায়ী আমি **${path}** ${action === 'create' ? 'তৈরি' : action === 'delete' ? 'ডিলিট' : 'এক্সেস'} করছি।`,
        timestamp: new Date()
      }]);
    } else if (name === 'whatsapp_automation') {
      const { action, recipient, message } = args;
      addTerminalLog(`WhatsApp: ${action.toUpperCase()} to ${recipient}`, 'cmd');
      const waUrl = `https://wa.me/${recipient.replace(/\D/g, '')}?text=${encodeURIComponent(message || '')}`;
      window.open(waUrl, '_blank');
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `বস, আমি **${recipient}**-এর জন্য হোয়াটসঅ্যাপে মেসেজ ড্রাফট করে ওপেন করেছি।`,
        timestamp: new Date()
      }]);
    } else if (name === 'get_system_status') {
      addTerminalLog("Scanning System Resources...", "info");
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `বস, এখনকার সিস্টেম স্টেটাস:
🔋 ব্যাটারি: **${systemStatus.battery}%** ${systemStatus.isCharging ? '(Charging)' : ''}
🧠 CPU: **${systemStatus.cpu}%**
📼 RAM: **${systemStatus.ram}%**
🌐 ইন্টারনেট: **${systemStatus.network.toUpperCase()}**`,
        timestamp: new Date()
      }]);
    } else if (name === 'get_news') {
      const category = args.category || 'general';
      addTerminalLog(`Fetching latest ${category} news...`, 'info');
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `বস, আমি আপনার জন্য **${category.toUpperCase()}** সংক্রান্ত লেটেস্ট খবরের আপডেট নিয়ে আসছি। (গুগল সার্চ ব্যবহার করা হচ্ছে)`,
        timestamp: new Date()
      }]);
    }
  };

  const handleSearchAlternative = async (query: string) => {
    setIsLoading(true);
    // Try multiple queries to find a better version
    const alternativeQueries = [
      `${query} official music video`,
      `${query} original`,
      `${query} live`,
      `${query} full video`,
      query
    ];
    
    let foundVideoId = null;
    const currentVideoId = activeMedia?.url;

    for (const q of alternativeQueries) {
      const videoId = await searchYouTube(q);
      // If we found a video and it's different from the current one, use it
      if (videoId && videoId !== currentVideoId) {
        foundVideoId = videoId;
        break;
      }
    }
    
    setIsLoading(false);
    
    if (foundVideoId) {
      setActiveMedia({
        type: 'youtube',
        url: foundVideoId,
        title: `${query} (Alternative Version)`
      });
    } else {
      setError("বস, অন্য কোনো ভার্সন খুঁজে পাওয়া যায়নি। দয়া করে অন্য কোনো গানের নাম দিয়ে ট্রাই করুন।");
    }
  };

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!overrideInput) setInput('');
    setIsLoading(true);
    setError(null);

    const history = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: m.parts || [{ text: m.content }]
    }));

    let retryCount = 0;
    const maxRetries = 2;

    const callAI = async (): Promise<any> => {
      try {
        return await generateChatResponse(textToSend, history, userNickname);
      } catch (err: any) {
        if (retryCount < maxRetries && (err.message?.includes('quota') || err.code === 429)) {
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          return callAI();
        }
        throw err;
      }
    };

    try {
      const response = await callAI();
      
      // Extract grounding links first
      const groundingLinks: { uri: string, title: string }[] = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        chunks.forEach((chunk: any) => {
          if (chunk.web) {
            groundingLinks.push({ uri: chunk.web.uri, title: chunk.web.title });
          }
        });
      }

      // Handle actual function calls from Gemini
      if (response.functionCalls) {
        for (const call of response.functionCalls) {
          await handleFunctionCall(call.name, call.args);
        }
      }

      // Fallback: Check if the model outputted JSON tool calls as text
      if (!response.functionCalls && response.text) {
        const jsonMatch = response.text.match(/\{[\s\S]*?\}/g);
        if (jsonMatch) {
          for (const jsonStr of jsonMatch) {
            try {
              const toolData = JSON.parse(jsonStr);
              if (toolData.target_player === 'nova_internal_player' && toolData.command_action === 'PLAY_MEDIA') {
                // Map to our internal play_video logic
                await handleFunctionCall('play_video', { 
                  url: toolData.search_query,
                  query: toolData.search_query,
                  platform: toolData.source_platform
                });
              } else if (toolData.tool && toolData.query) {
                await handleFunctionCall(toolData.tool, toolData);
              } else if (toolData.tool && toolData.videoId) {
                await handleFunctionCall(toolData.tool, toolData);
              }
            } catch (e) {
              console.error("Failed to parse fallback JSON tool call:", e);
            }
          }
        }
      }

      const assistantMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: response.text || (response.functionCalls ? 'Executing system command...' : 'Action executed.'),
        groundingLinks: groundingLinks.length > 0 ? groundingLinks : undefined,
        timestamp: new Date(),
        parts: response.candidates?.[0]?.content?.parts
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      let errorMessage = err.message || 'Failed to call the Gemini API. Please try again.';
      
      if (err.message && (err.message.includes('RESOURCE_EXHAUSTED') || err.message.includes('quota'))) {
        errorMessage = 'Quota Exceeded: The free limit for Nova AI has been reached. Please wait a minute.';
      } else if (err.status === 'RESOURCE_EXHAUSTED' || err.code === 429) {
        errorMessage = 'Quota Exceeded: Too many requests. Please slow down.';
      } else if (err.message && err.message.includes('safety')) {
        errorMessage = 'Safety Block: The request was blocked by AI safety filters.';
      } else if (err.message && err.message.includes('API Key')) {
        errorMessage = 'Configuration Error: Gemini API Key is missing or invalid.';
      }

      setError(errorMessage);
      
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `⚠️ ${errorMessage}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLiveMode = async () => {
    setError(null);
    if (!isLiveMode) {
      try {
        const assistant = new NovaLiveAssistant(
          (text) => {
            setMessages(prev => [...prev, {
              id: generateId(),
              role: 'assistant',
              content: text,
              timestamp: new Date()
            }]);
          },
          () => setIsSpeaking(true),
          () => setIsSpeaking(false),
          (err) => {
            console.error('Live Error:', err);
            setError(err.message || 'Live Assistant encountered an error.');
            setIsLiveMode(false);
          },
          async (name, args) => await handleFunctionCall(name, args),
          selectedVoice
        );
        await assistant.connect();
        liveAssistantRef.current = assistant;
        setIsLiveMode(true);
      } catch (err: any) {
        setError(err.message || 'Failed to connect to Live Assistant.');
      }
    } else {
      liveAssistantRef.current?.disconnect();
      liveAssistantRef.current = null;
      setIsLiveMode(false);
      setIsSpeaking(false);
    }
  };

  const formatNicknameMsg = (text: string) => {
    if (!text) return text;
    return text.replace(/বস(?=[ ,.!;?：\n]|$)/g, userNickname).replace(/বসকে/g, userNickname + 'কে');
  };

  const handleTTS = async (text: string, messageId?: string) => {
    const formattedText = formatNicknameMsg(text);
    const currentId = messageId || `tts-${Date.now()}`;

    // If the same message is clicked, toggle play/pause
    if (speakingMessageId === currentId) {
      if (isSpeaking) {
        if (isAudioPaused) {
          // Resume
          if (audioContextRef.current) {
            await audioContextRef.current.resume();
          }
          if (window.speechSynthesis && window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
          setIsAudioPaused(false);
        } else {
          // Pause
          if (audioContextRef.current) {
            await audioContextRef.current.suspend();
          }
          if (window.speechSynthesis && window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
          }
          setIsAudioPaused(true);
        }
        return;
      }
    }

    // If another message is speaking, stop it first
    if (isSpeaking) {
      if (activeAudioSourceRef.current) {
        try {
          activeAudioSourceRef.current.stop();
        } catch (e) {}
        activeAudioSourceRef.current = null;
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      setIsSpeaking(false);
      setIsAudioPaused(false);
      setSpeakingMessageId(null);
      speakingMessageIdRef.current = null;
      // Give a brief moment for any ongoing promise/handler to settle
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!text) return;

    setIsSpeaking(true);
    setIsAudioPaused(false);
    setSpeakingMessageId(currentId);
    speakingMessageIdRef.current = currentId;
    setError(null);
    try {
      // Clean text for TTS: remove markdown bold/italic, emojis, and extra symbols
      const cleanText = formattedText
        .replace(/\*\*/g, '') // remove bold
        .replace(/__/g, '') // remove italic
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // remove emojis
        .replace(/[^\w\s\u0980-\u09FF.,?!:;]/gi, ' ') // keep only alphanumeric, Bengali, and basic punctuation
        .replace(/\s+/g, ' ') // collapse multiple spaces
        .trim()
        .slice(0, 1000); // limit length to prevent model errors

      if (!cleanText) {
        if (speakingMessageIdRef.current === currentId) {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
          speakingMessageIdRef.current = null;
        }
        return;
      }

      let base64 = null;
      let hasError = false;
      try {
        base64 = await generateSpeech(cleanText, selectedVoice);
      } catch (speechErr: any) {
        console.warn("Gemini generateSpeech failed, falling back to Web Speech Synthesis:", speechErr);
        hasError = true;
      }
      
      // If during the api call, the user cancelled or switched to another message, stop!
      if (speakingMessageIdRef.current !== currentId) {
        return;
      }

      if (base64 && !hasError) {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext({ sampleRate: 24000 });
        }
        
        // Ensure audio context is resumed
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        await playPCM(base64, audioContextRef.current, 24000, (source) => {
          activeAudioSourceRef.current = source;
        });
      } else {
        // Fallback to client-side window.speechSynthesis
        if (!window.speechSynthesis) {
          throw new Error("No speech engine available (SpeechSynthesis is not supported).");
        }
        
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        // Set language based on text content (Bengali/Bangla or English)
        const hasBengali = /[\u0980-\u09FF]/.test(cleanText);
        if (hasBengali) {
          utterance.lang = 'bn-BD';
        } else {
          utterance.lang = 'en-US';
        }
        
        // Try to match appropriate voice
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => hasBengali ? v.lang.startsWith('bn') : v.lang.startsWith('en'));
        if (voice) {
          utterance.voice = voice;
        }
        
        await new Promise<void>((resolve, reject) => {
          utterance.onend = () => {
            resolve();
          };
          utterance.onerror = (e) => {
            reject(new Error(`Web Speech API Error: ${e.error || 'Unknown error'}`));
          };
          window.speechSynthesis.speak(utterance);
        });
      }
    } catch (err: any) {
      if (speakingMessageIdRef.current === currentId) {
        console.error('TTS error:', err);
        let ttsError = 'Failed to play audio briefing.';
        if (err.message && (err.message.includes('quota') || err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED'))) {
          ttsError = 'Voice quota reached. Playing using local browser speech fallback...';
        }
        setError(ttsError);
        addTerminalLog(ttsError, 'error');
      }
    } finally {
      // ONLY reset if this is still the active message run!
      if (speakingMessageIdRef.current === currentId) {
        setIsSpeaking(false);
        setIsAudioPaused(false);
        setSpeakingMessageId(null);
        speakingMessageIdRef.current = null;
        activeAudioSourceRef.current = null;
      }
    }
  };

  const startSTT = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('আপনার ব্রাউজার ভয়েস কমান্ড সাপোর্ট করে না। দয়া করে গুগল ক্রোম ব্যবহার করুন। (Your browser does not support voice commands. Please use Google Chrome.)');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'bn-BD'; 
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setError('মাইক্রোফোন পারমিশন দেওয়া হয়নি। দয়া করে ব্রাউজার সেটিং থেকে পারমিশন দিন। (Microphone permission denied. Please enable it in browser settings.)');
        } else {
          setError(`ভয়েস কমান্ডে সমস্যা হয়েছে: ${event.error}`);
        }
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        if (event.results[0].isFinal) {
          handleSend(transcript);
        }
      };

      recognition.start();
    } catch (err) {
      console.error('STT Start Error:', err);
      setError('ভয়েস কমান্ড শুরু করা যায়নি।');
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'voice':
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-bg-dark/20">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md glass-card rounded-[2rem] border border-white/10 p-10 text-center shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent to-transparent animate-scan" />
              
              <div className="mb-10">
                <div className="w-28 h-28 bg-accent/20 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(0,242,255,0.2)] relative border border-accent/30">
                  {isListening && (
                    <motion.div 
                      animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 bg-accent rounded-full blur-xl"
                    />
                  )}
                  <Mic size={48} className="text-accent z-10" />
                </div>
                <h2 className="mt-8 text-2xl font-bold text-white font-display tracking-tight">Voice Command Center</h2>
                <p className="text-slate-500 mt-2 font-mono text-[10px] uppercase tracking-[0.3em]">
                  {isListening ? 'Nova is Listening...' : 'Tap to Speak to Nova'}
                </p>
              </div>

              <div className="space-y-4 mb-10">
                <button 
                  onClick={startSTT}
                  disabled={isListening}
                  className={cn(
                    "w-full py-5 rounded-2xl font-bold text-lg transition-all shadow-lg flex items-center justify-center gap-3 uppercase tracking-widest",
                    isListening ? "bg-white/5 text-slate-500 border border-white/5" : "bg-accent text-bg-dark hover:bg-accent/90 active:scale-95 shadow-accent/20"
                  )}
                >
                  {isListening ? 'Listening...' : 'Start Command'}
                </button>
                
                <button 
                  onClick={toggleLiveMode}
                  className={cn(
                    "w-full py-5 rounded-2xl font-bold text-lg transition-all border flex items-center justify-center gap-3 uppercase tracking-widest",
                    isLiveMode ? "bg-red-500/10 border-red-500/30 text-red-500" : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                  )}
                >
                  {isLiveMode ? <Zap size={20} className="animate-pulse" /> : <Zap size={20} />}
                  {isLiveMode ? 'Stop Live Mode' : 'Enable Live Mode'}
                </button>
              </div>

              <div className="text-left p-6 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                <p className="text-[9px] font-mono text-slate-500 uppercase mb-4 tracking-[0.2em]">Voice Samples:</p>
                <ul className="space-y-3 text-xs text-slate-400 font-mono">
                  <li className="flex items-center gap-3 group cursor-pointer hover:text-accent transition-colors">
                    <span className="w-1 h-1 rounded-full bg-accent/50 group-hover:bg-accent" />
                    "গান বাজাও" (Play music)
                  </li>
                  <li className="flex items-center gap-3 group cursor-pointer hover:text-accent transition-colors">
                    <span className="w-1 h-1 rounded-full bg-accent/50 group-hover:bg-accent" />
                    "মিলোকে কল দাও" (Call Milon)
                  </li>
                  <li className="flex items-center gap-3 group cursor-pointer hover:text-accent transition-colors">
                    <span className="w-1 h-1 rounded-full bg-accent/50 group-hover:bg-accent" />
                    "আজকের আবহাওয়া কেমন?"
                  </li>
                </ul>
              </div>
            </motion.div>
          </div>
        );
      case 'dashboard':
        return (
          <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-8 custom-scrollbar">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-accent text-2xl font-bold uppercase tracking-tighter font-display">Neural Dashboard</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] mt-1">Real-time System Telemetry</p>
              </div>
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <div className="p-2 bg-white/5 border border-white/10 rounded-xl flex items-center gap-3 font-mono">
                  <div>
                    <span className="text-[8px] text-slate-500 block uppercase tracking-widest leading-none mb-1">Your Nova ID</span>
                    <span className="text-xs font-bold text-accent tracking-wider">{myNovaId}</span>
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(myNovaId);
                      handleTTS("বস, আপনার আইডি কপি করা হয়েছে।");
                    }}
                    className="p-1.5 hover:bg-accent/10 rounded-lg text-accent transition-all"
                    title="Copy ID"
                  >
                    <Save size={12} />
                  </button>
                </div>
                <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl">
                   <Activity size={20} className="text-accent animate-pulse" />
                </div>
              </div>
            </div>
            <Dashboard status={systemStatus} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Notes />
              <Reminder />
            </div>
          </div>
        );
      case 'history':
        return (
          <div className="flex-1 p-4 md:p-6 font-mono overflow-y-auto custom-scrollbar">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-accent text-2xl font-bold uppercase tracking-tighter font-display">Call History</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] mt-1">Secure Communication Logs</p>
              </div>
              <button 
                onClick={() => {
                  if (confirm("Are you sure you want to clear call history?")) {
                    setCallHistory([]);
                  }
                }}
                className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] hover:bg-red-500/20 rounded-xl font-bold uppercase tracking-widest transition-all"
              >
                Clear All
              </button>
            </div>
            
            {callHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-600">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/5">
                  <Clock size={32} className="opacity-20" />
                </div>
                <p className="text-[10px] uppercase tracking-[0.3em] font-mono">No encrypted logs found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {callHistory.map((call, idx) => (
                  <div key={`call-${call.id}-${idx}-${call.timestamp.getTime()}`} className="p-5 glass-card border border-white/5 rounded-2xl flex items-center justify-between hover:border-accent/30 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-accent/20" />
                    <div className="flex items-center gap-5">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center border",
                        call.type === 'incoming' ? "bg-accent/10 border-accent/20 text-accent" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      )}>
                        {call.type === 'incoming' ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white capitalize tracking-tight">{call.name}</h3>
                        <p className="text-[10px] text-slate-500 tracking-[0.2em] font-mono mt-1">{call.number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                          {call.timestamp.toLocaleDateString()}
                        </p>
                        <p className="text-xs text-slate-300 font-mono font-bold mt-1">
                          {call.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <button 
                        onClick={() => handleCall(call.number)}
                        className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-accent opacity-0 group-hover:opacity-100 transition-all hover:bg-accent hover:text-bg-dark shadow-lg shadow-accent/10"
                      >
                        <Phone size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 'media':
        return (
          <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
            {activeMedia ? (
              <MediaCenter 
                media={activeMedia} 
                onClose={() => setActiveMedia(null)} 
                isMinimized={false}
                setIsMinimized={() => setActiveTab('terminal')}
                onSearchAlternative={handleSearchAlternative}
              />
            ) : (
              <div className="flex-1 flex flex-col p-4 md:p-6 overflow-y-auto custom-scrollbar">
                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-blue-500 text-3xl font-black uppercase tracking-tighter mb-1 italic">Nova Media Center</h2>
                    <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-[0.3em]">Next-Gen Entertainment Hub</p>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-800/50">
                    {[
                      { id: 'youtube', icon: Youtube, label: 'YouTube', color: 'bg-red-600' },
                      { id: 'tiktok', icon: Music, label: 'TikTok', color: 'bg-zinc-100 text-black' },
                      { id: 'facebook', icon: Facebook, label: 'Facebook', color: 'bg-blue-600' },
                      { id: 'instagram', icon: Instagram, label: 'Instagram', color: 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600' },
                      { id: 'spotify', icon: Music2, label: 'Spotify', color: 'bg-emerald-500' }
                    ].map((platform, idx) => (
                      <button 
                        key={`media-platform-${platform.id}-${idx}`}
                        onClick={() => setActivePlatform(platform.id as any)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                          activePlatform === platform.id 
                            ? `${platform.color} shadow-lg shadow-${platform.id === 'tiktok' ? 'white' : platform.id === 'youtube' ? 'red-600' : platform.id === 'facebook' ? 'blue-600' : 'emerald-500'}/20 scale-105` 
                            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                        )}
                      >
                        <platform.icon size={14} /> {platform.label}
                      </button>
                    ))}
                  </div>
                </div>

                {activePlatform === 'youtube' ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex-1 flex flex-col"
                  >
                    <form onSubmit={handleYoutubeSearch} className="relative mb-6 group max-w-3xl mx-auto w-full">
                      <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                      <div className="relative flex items-center">
                        <input 
                          type="text"
                          value={youtubeSearchQuery}
                          onChange={(e) => setYoutubeSearchQuery(e.target.value)}
                          placeholder="Search anything on YouTube..."
                          className="w-full bg-zinc-900 border border-zinc-800 text-white px-8 py-5 rounded-2xl focus:outline-none focus:border-blue-500/50 transition-all font-bold placeholder:text-zinc-700 shadow-2xl text-sm"
                        />
                        <button 
                          type="submit"
                          disabled={isSearchingYoutube}
                          className="absolute right-3 p-4 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all disabled:opacity-50 shadow-xl flex items-center justify-center"
                        >
                          {isSearchingYoutube ? (
                            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Search size={20} />
                          )}
                        </button>
                      </div>
                    </form>

                    <div className="flex justify-center mb-10">
                      <button 
                        onClick={() => {
                          setActiveMedia({
                            type: 'youtube',
                            url: 'https://m.youtube.com',
                            title: 'YouTube Feed'
                          });
                          setIsMediaMinimized(false);
                        }}
                        className="px-8 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-500 transition-all shadow-xl flex items-center gap-3 group"
                      >
                        <Play size={16} className="fill-current group-hover:scale-110 transition-transform" />
                        Play YouTube Feed Here
                      </button>
                    </div>

                    {youtubeSearchResults.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {youtubeSearchResults.map((video, idx) => (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            key={`youtube-video-${video.id || idx}-${idx}`}
                            onClick={() => {
                              setActiveMedia({
                                type: 'youtube',
                                url: video.id,
                                title: video.snippet.title
                              });
                              setIsMediaMinimized(false);
                            }}
                            className="group cursor-pointer bg-zinc-900/30 border border-zinc-800/50 rounded-3xl overflow-hidden hover:border-blue-500/30 transition-all hover:shadow-2xl hover:shadow-blue-500/10 flex flex-col"
                          >
                            <div className="relative aspect-video overflow-hidden">
                              <img 
                                src={(video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url) || null} 
                                alt={video.snippet.title}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100">
                                <div className="w-14 h-14 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center shadow-2xl">
                                  <Play size={24} className="text-white fill-current ml-1" />
                                </div>
                              </div>
                              <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/80 backdrop-blur-md text-white text-[9px] font-black rounded-lg border border-white/10 uppercase tracking-widest">
                                {video.contentDetails?.duration?.replace('PT', '').replace('H', ':').replace('M', ':').replace('S', '') || 'HD'}
                              </div>
                            </div>
                            <div className="p-5 flex-1 flex flex-col">
                              <h3 className="text-white font-bold text-sm line-clamp-2 mb-3 group-hover:text-blue-400 transition-colors leading-snug">
                                {video.snippet.title}
                              </h3>
                              <div className="mt-auto flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-500">
                                    {video.snippet.channelTitle.charAt(0)}
                                  </div>
                                  <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider truncate max-w-[100px]">
                                    {video.snippet.channelTitle}
                                  </span>
                                </div>
                                <span className="text-zinc-600 text-[9px] font-mono">
                                  {parseInt(video.statistics?.viewCount || '0').toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : !isSearchingYoutube && (
                      <div className="flex-1 flex flex-col items-center justify-center py-20">
                        <div className="relative mb-8">
                          <div className="absolute -inset-4 bg-red-600/20 rounded-full blur-2xl animate-pulse"></div>
                          <div className="relative w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 shadow-2xl">
                            <Youtube size={40} className="text-red-600" />
                          </div>
                        </div>
                        <h3 className="text-white font-black uppercase tracking-[0.3em] text-sm mb-3 italic">Nova YouTube Engine</h3>
                        <p className="text-zinc-500 text-xs max-w-[280px] text-center leading-relaxed font-medium">
                          Search and stream millions of videos in high-definition directly within the Nova ecosystem.
                        </p>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex-1 flex flex-col items-center justify-center min-h-[500px] relative"
                  >
                    {/* Background Glow */}
                    <div className={cn(
                      "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] opacity-10 pointer-events-none transition-colors duration-1000",
                      activePlatform === 'facebook' ? "bg-blue-600" :
                      activePlatform === 'tiktok' ? "bg-white" :
                      activePlatform === 'instagram' ? "bg-red-600" :
                      "bg-emerald-500"
                    )} />

                    {/* Mobile Webview Mockup */}
                    <div className="relative w-full max-w-sm aspect-[9/19] max-h-[700px] bg-zinc-900 rounded-[3.5rem] border-[10px] border-zinc-800 shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col group">
                      {/* Notch */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-zinc-800 rounded-b-3xl z-20 flex items-center justify-center gap-2">
                        <div className="w-10 h-1 bg-zinc-700 rounded-full" />
                        <div className="w-2 h-2 rounded-full bg-zinc-700" />
                      </div>

                      {/* Status Bar */}
                      <div className="h-10 bg-zinc-900 flex items-center justify-between px-8 pt-2 z-10">
                        <span className="text-[10px] text-zinc-400 font-black">9:41</span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full border-2 border-zinc-700" />
                          <div className="w-4 h-2 bg-zinc-700 rounded-sm" />
                        </div>
                      </div>

                      {/* App Content */}
                      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-950 relative">
                        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-20" />
                        
                        <motion.div 
                          key={activePlatform}
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className={cn(
                            "w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-2xl relative z-10",
                            activePlatform === 'facebook' ? "bg-blue-600 shadow-blue-600/40" :
                            activePlatform === 'tiktok' ? "bg-white text-black shadow-white/20" :
                            activePlatform === 'instagram' ? "bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 shadow-red-600/40" :
                            "bg-emerald-500 shadow-emerald-500/40"
                          )}
                        >
                          {activePlatform === 'facebook' && <Facebook size={48} />}
                          {activePlatform === 'tiktok' && <Music size={48} />}
                          {activePlatform === 'instagram' && <Instagram size={48} />}
                          {activePlatform === 'spotify' && <Music2 size={48} />}
                        </motion.div>

                        <h4 className="text-white font-black uppercase tracking-tighter text-2xl mb-2 z-10">{activePlatform}</h4>
                        <div className="flex items-center gap-2 mb-10 z-10">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-zinc-500 text-[8px] font-black uppercase tracking-[0.3em]">Nova Webview Active</span>
                        </div>

                        <div className="w-full space-y-3 z-10">
                          <button 
                            onClick={() => {
                              const url = activePlatform === 'spotify' ? 'https://open.spotify.com' : 
                                         activePlatform === 'tiktok' ? 'https://www.tiktok.com/foryou?is_from_webapp=1&sender_device=pc' :
                                         activePlatform === 'facebook' ? 'https://m.facebook.com' :
                                         activePlatform === 'instagram' ? 'https://www.instagram.com' :
                                         `https://m.${activePlatform}.com`;
                              
                              setActiveMedia({
                                type: activePlatform as any,
                                url: url,
                                title: `${activePlatform} Feed`
                              });
                              setIsMediaMinimized(false);
                            }}
                            className="w-full py-4 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all shadow-xl flex items-center justify-center gap-2 group"
                          >
                            <Play size={14} className="fill-current group-hover:scale-110 transition-transform" />
                            Play {activePlatform} Here
                          </button>
                          
                          <button 
                            onClick={() => {
                              const query = prompt(`Search ${activePlatform} for:`);
                              if (query) {
                                let url = '';
                                if (activePlatform === 'tiktok') url = `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`;
                                if (activePlatform === 'facebook') url = `https://www.facebook.com/search/top/?q=${encodeURIComponent(query)}`;
                                if (activePlatform === 'instagram') url = `https://www.instagram.com/explore/tags/${encodeURIComponent(query.replace(/\s+/g, ''))}`;
                                if (activePlatform === 'spotify') url = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
                                
                                setActiveMedia({
                                  type: activePlatform as any,
                                  url: url,
                                  title: `Search: ${query}`
                                });
                                setIsMediaMinimized(false);
                              }
                            }}
                            className="w-full py-4 bg-zinc-900 border border-zinc-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
                          >
                            <Search size={14} /> Search {activePlatform}
                          </button>
                        </div>
                      </div>

                      {/* Home Indicator */}
                      <div className="h-1.5 w-32 bg-zinc-800 rounded-full mx-auto mb-3 z-20" />
                    </div>

                    <div className="mt-10 text-center max-w-sm">
                      <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-4 flex items-center justify-center gap-3">
                        <Shield size={12} className="text-blue-500" /> Secure Sandbox Environment
                      </p>
                      <p className="text-zinc-600 text-xs leading-relaxed font-medium">
                        Boss, {activePlatform} blocks direct embedding for security. Nova launches a dedicated <span className="text-blue-500">Secure Webview Portal</span> for a full-screen, app-like experience without tracking.
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        );
      case 'scan':
        return (
          <div className="flex-1 p-4 md:p-6 font-mono overflow-y-auto custom-scrollbar">
            <div className="mb-10 flex items-center justify-between">
              <div>
                <h2 className="text-accent text-2xl font-bold uppercase tracking-tighter font-display">Vulnerability Scanner</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] mt-1">Deep System Analysis</p>
              </div>
              <button className="px-6 py-3 bg-accent text-bg-dark text-[10px] font-bold rounded-xl hover:bg-accent/90 transition-all shadow-lg shadow-accent/10 uppercase tracking-widest">Start Full Scan</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ScanCard title="SQL Injection" status="SECURE" risk="LOW" />
              <ScanCard title="Cross-Site Scripting" status="VULNERABLE" risk="HIGH" />
              <ScanCard title="Broken Auth" status="SECURE" risk="LOW" />
              <ScanCard title="Sensitive Data Exposure" status="WARNING" risk="MEDIUM" />
            </div>
            <div className="mt-10 p-6 glass-card border border-white/5 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-accent/20 animate-scan" />
              <p className="text-[9px] font-mono text-slate-500 mb-4 uppercase tracking-[0.2em]">Live Log Output:</p>
              <div className="text-[10px] text-slate-400 space-y-2 font-mono">
                <p className="flex gap-3"><span className="text-accent">[INFO]</span> Initializing Nmap scan on target...</p>
                <p className="flex gap-3"><span className="text-accent">[INFO]</span> Port 80/tcp open - HTTP</p>
                <p className="flex gap-3"><span className="text-red-500">[WARN]</span> Potential XSS detected in /api/search?q=</p>
                <p className="flex gap-3"><span className="text-accent">[INFO]</span> Analyzing response headers...</p>
                <p className="animate-pulse text-accent">_</p>
              </div>
            </div>
          </div>
        );
      case 'encryption':
        return (
          <div className="flex-1 p-4 md:p-6 font-mono overflow-y-auto custom-scrollbar">
            <div className="mb-10">
              <h2 className="text-accent text-2xl font-bold uppercase tracking-tighter font-display">Encryption Suite</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] mt-1">Military-Grade Data Protection</p>
            </div>
            <div className="space-y-8">
              <div className="p-6 glass-card border border-white/5 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-accent/20" />
                <label className="text-[9px] font-mono text-slate-500 uppercase mb-4 block tracking-[0.2em]">Plaintext Input</label>
                <textarea className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-mono text-white outline-none focus:border-accent/50 transition-all h-32 placeholder:text-slate-700" placeholder="Enter text to encrypt..." />
                <div className="mt-6 flex flex-wrap gap-3">
                  <button className="px-4 py-2 bg-accent/10 border border-accent/20 text-accent text-[10px] font-bold rounded-xl hover:bg-accent hover:text-bg-dark transition-all uppercase tracking-widest">AES-256</button>
                  <button className="px-4 py-2 bg-white/5 border border-white/10 text-slate-500 text-[10px] font-bold rounded-xl hover:bg-white/10 transition-all uppercase tracking-widest">RSA-4096</button>
                  <button className="px-4 py-2 bg-white/5 border border-white/10 text-slate-500 text-[10px] font-bold rounded-xl hover:bg-white/10 transition-all uppercase tracking-widest">SHA-512</button>
                </div>
              </div>
              <div className="p-6 glass-card border border-white/5 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/20" />
                <label className="text-[9px] font-mono text-slate-500 uppercase mb-4 block tracking-[0.2em]">Ciphertext Output</label>
                <div className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-mono text-emerald-400 break-all min-h-[80px] shadow-inner">
                  U2FsdGVkX1+vS5v8X5v8X5v8X5v8X5v8X5v8X5v8X5v8X5v8X5v8X5v8X5v8X5v8
                </div>
              </div>
            </div>
          </div>
        );
      case 'apps':
        return (
          <div className="flex-1 p-4 md:p-6 overflow-y-auto custom-scrollbar">
            <div className="mb-10">
              <h2 className="text-accent text-2xl font-bold uppercase tracking-tighter font-display">System Applications</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] mt-1">Authorized Modules Only</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
              <AppIcon icon={<LayoutDashboard className="text-accent" />} label="Dashboard" onClick={() => setActiveTab('dashboard')} />
              <AppIcon icon={<Bot className="text-accent" />} label="Nova AI" onClick={() => setActiveTab('terminal')} />
              <AppIcon icon={<Video className="text-red-500" />} label="Media Center" onClick={() => setActiveTab('media')} />
              <AppIcon icon={<Phone className="text-emerald-400" />} label="Dialer" onClick={() => setIsDialPadOpen(true)} />
              <AppIcon icon={<CheckCircle2 className="text-purple-400" />} label="Contacts" onClick={() => setIsContactsOpen(true)} />
              <AppIcon icon={<Activity className="text-red-500" />} label="Security" onClick={() => setActiveTab('scan')} />
              <AppIcon icon={<Lock className="text-amber-400" />} label="Vault" onClick={() => setActiveTab('encryption')} />
              <AppIcon icon={<Settings className="text-slate-400" />} label="Settings" onClick={() => setActiveTab('settings')} />
              <AppIcon icon={<Zap className="text-yellow-400" />} label="Live Mode" onClick={toggleLiveMode} />
              <AppIcon icon={<Cpu className="text-indigo-400" />} label="System" onClick={() => alert("Nova OS v4.0.0\nKernel: 6.1.0-nova-cyber\nStatus: Optimized")} />
            </div>
          </div>
        );
      case 'app-permissions':
        return (
          <div className="flex-1 p-4 md:p-6 overflow-y-auto custom-scrollbar">
            <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h2 className="text-accent text-2xl font-bold uppercase tracking-tighter font-display">App Access Control</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] mt-1">Manage Permissions for External Apps</p>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => toggleAllAppPermissions(true)}
                  className="px-6 py-3 bg-accent/10 border border-accent/30 rounded-2xl text-[10px] font-mono font-bold text-accent uppercase tracking-widest hover:bg-accent/20 transition-all flex items-center gap-2"
                >
                  <ShieldCheck size={14} />
                  Enable All
                </button>
                <button 
                  onClick={() => toggleAllAppPermissions(false)}
                  className="px-6 py-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-[10px] font-mono font-bold text-red-400 uppercase tracking-widest hover:bg-red-500/20 transition-all flex items-center gap-2"
                >
                  <ShieldOff size={14} />
                  Disable All
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {installedApps.map((app, appIdx) => (
                <motion.div 
                  key={`app-perm-${app.pkg || app.name || appIdx}-${appIdx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 glass-card border border-white/5 rounded-3xl relative overflow-hidden group"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-accent/20" />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10 shadow-inner group-hover:border-accent/30 transition-all">
                        {app.name === 'WhatsApp' ? <MessageSquare size={24} className="text-emerald-400" /> :
                        app.name === 'Facebook' ? <Facebook size={24} className="text-blue-500" /> :
                        app.name === 'Spotify' ? <Music2 size={24} className="text-emerald-500" /> :
                        <Youtube size={24} className="text-red-500" />}
                      </div>
                      <div>
                        <h4 className="text-white font-bold tracking-wider">{app.name}</h4>
                        <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">{app.pkg}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(app.permissions).map((perm, permIdx) => (
                        <button
                          key={`perm-btn-${app.pkg || app.name || appIdx}-${perm}-${permIdx}`}
                          onClick={() => toggleAppPermission(app.pkg, perm)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[9px] font-mono font-bold uppercase tracking-widest border transition-all flex items-center gap-2",
                            app.permissions[perm] 
                              ? "bg-accent/20 border-accent/50 text-accent" 
                              : "bg-white/5 border-white/10 text-slate-600 grayscale"
                          )}
                        >
                          {perm === 'mic' && <Mic size={12} />}
                          {perm === 'cam' && <CameraIcon size={12} />}
                          {perm === 'location' && <MapPin size={12} />}
                          {perm}
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            app.permissions[perm] ? "bg-accent animate-pulse" : "bg-slate-800"
                          )} />
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="flex-1 p-4 md:p-6 overflow-y-auto custom-scrollbar">
            <div className="max-w-2xl mx-auto">
              <div className="mb-10">
                <h2 className="text-accent text-2xl font-bold uppercase tracking-tighter font-display">Nova Settings</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] mt-1">System Configuration & Identity</p>
              </div>
              <div className="space-y-8">
                <section className="p-8 glass-card border border-white/5 rounded-3xl shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-accent/20" />
                  <h3 className="text-sm font-bold text-white mb-8 flex items-center gap-3 uppercase tracking-widest">
                    <div className="p-2 bg-accent/10 rounded-lg border border-accent/20">
                      <Smartphone size={18} className="text-accent" />
                    </div>
                    Identity & SIM
                  </h3>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase font-mono tracking-[0.2em] mb-1">Your Nova ID</p>
                        <p className="text-xl font-bold text-accent tracking-[0.3em]">{myNovaId}</p>
                      </div>
                      <button onClick={() => {
                        const newId = Math.floor(100000 + Math.random() * 900000).toString();
                        setMyNovaId(newId);
                        localStorage.setItem('nova_id', newId);
                      }} className="px-4 py-2 bg-accent/10 border border-accent/20 text-accent text-[10px] font-bold rounded-xl hover:bg-accent hover:text-bg-dark transition-all uppercase tracking-widest">Regenerate</button>
                    </div>
                    <div className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase font-mono tracking-[0.2em] mb-1">Linked Number</p>
                        <p className="text-xl font-bold text-white tracking-wider">{linkedNumber || 'Not Linked'}</p>
                      </div>
                      <button onClick={() => setIsSimModalOpen(true)} className="px-4 py-2 bg-white/5 border border-white/10 text-slate-400 text-[10px] font-bold rounded-xl hover:bg-white/10 transition-all uppercase tracking-widest">Change</button>
                    </div>
                  </div>
                </section>

                <section className="p-8 glass-card border border-white/5 rounded-3xl shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-accent/20" />
                  <h3 className="text-sm font-bold text-white mb-8 flex items-center gap-3 uppercase tracking-widest">
                    <div className="p-2 bg-accent/10 rounded-lg border border-accent/20">
                      <UserCheck size={18} className="text-accent" />
                    </div>
                    Nova Address Mode (সম্বোধন)
                  </h3>
                  <div className="space-y-6">
                    <p className="text-xs text-slate-400 leading-relaxed font-mono uppercase tracking-wider">
                      Select how Nova AI should address you. This affects both speech (TTS) and chat replies.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { id: 'বস', label: 'বস (Boss)' },
                        { id: 'বন্ধু', label: 'বন্ধু (Friend)' },
                        { id: 'জানু', label: 'জানু (Darling)' },
                        { id: 'প্রিয়', label: 'প্রিয় (Beloved)' },
                        { id: 'ওস্তাদ', label: 'ওস্তাদ (Ostad)' },
                        { id: 'স্যার', label: 'স্যার (Sir)' },
                        { id: 'ম্যাডাম', label: 'ম্যাডাম (Madam)' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setUserNickname(opt.id);
                            localStorage.setItem('user_nickname', opt.id);
                            const greetingMsg = `${opt.id}, আমি এখন থেকে আপনাকে এই নামে সম্বোধন করবো।`;
                            handleTTS(greetingMsg);
                          }}
                          className={cn(
                            "py-3 px-4 rounded-xl border text-xs font-bold transition-all font-display uppercase tracking-widest text-center",
                            userNickname === opt.id
                              ? "bg-accent/15 border-accent text-accent shadow-[0_0_15px_rgba(0,242,255,0.15)]"
                              : "bg-black/20 border-white/5 text-slate-400 hover:bg-white/5 hover:border-white/10"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    
                    <div className="flex flex-col gap-3 p-5 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-300 font-mono uppercase tracking-widest">Custom Nickname (নিজের পছন্দের নাম)</span>
                        <button
                          onClick={() => {
                            const custom = prompt("আপনার পছন্দের সম্বোধনটি লিখুন (যেমন: ভাইয়া, আপু, সুইটহার্ট):");
                            if (custom && custom.trim()) {
                              const trimmed = custom.trim();
                              setUserNickname(trimmed);
                              localStorage.setItem('user_nickname', trimmed);
                              handleTTS(`${trimmed}, আমি এখন থেকে আপনাকে এই নামে ডাকবো।`);
                            }
                          }}
                          className="px-3 py-1.5 bg-accent/10 border border-accent/20 text-accent rounded-lg text-[9px] font-mono hover:bg-accent/20 transition-all"
                        >
                          + SET CUSTOM
                        </button>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        Current Active Address: <span className="text-accent font-bold text-xs">{userNickname}</span>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="p-8 glass-card border border-white/5 rounded-3xl shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-500/20" />
                  <h3 className="text-sm font-bold text-white mb-8 flex items-center gap-3 uppercase tracking-widest">
                    <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                      <User size={18} className="text-red-400" />
                    </div>
                    Session & Account
                  </h3>
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                      <div className="flex items-center gap-4">
                        {user?.photoURL ? (
                          <img src={user.photoURL || null} alt="Profile" className="w-12 h-12 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent text-lg font-bold uppercase font-mono">
                            {user?.displayName?.[0] || user?.email?.[0] || 'U'}
                          </div>
                        )}
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase font-mono tracking-[0.2em] mb-1">Authenticated As</p>
                          <p className="text-sm font-bold text-white">{user?.displayName || 'Nova Operator'}</p>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">{user?.email || 'N/A'}</p>
                        </div>
                      </div>
                      <button 
                        onClick={async () => {
                          try {
                            await auth.signOut();
                            handleTTS("বস, আপনি সফলভাবে লগআউট হয়েছেন।");
                          } catch (err: any) {
                            setError("লগআউট করতে সমস্যা হয়েছে: " + err.message);
                          }
                        }}
                        className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold rounded-xl hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        <LogOut size={14} />
                        Logout
                      </button>
                    </div>
                  </div>
                </section>

                <section className="p-8 glass-card border border-white/5 rounded-3xl shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-accent-purple/20" />
                  <h3 className="text-sm font-bold text-white mb-8 flex items-center gap-3 uppercase tracking-widest">
                    <div className="p-2 bg-accent-purple/10 rounded-lg border border-accent-purple/20">
                      <Activity size={18} className="text-accent-purple" />
                    </div>
                    System Preferences
                  </h3>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-4 p-6 bg-white/5 rounded-2xl border border-white/5 transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-300 font-mono uppercase tracking-widest">Gemini API Key</span>
                        <button 
                          onClick={() => {
                            localStorage.setItem('gemini_api_key', geminiApiKey);
                            setError("API Key saved successfully!");
                            setTimeout(() => setError(null), 3000);
                          }}
                          className="px-4 py-2 bg-accent text-bg-dark rounded-xl text-[10px] font-bold hover:bg-accent/90 transition-all uppercase tracking-widest"
                        >
                          Save
                        </button>
                      </div>
                      <input 
                        type="password"
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        placeholder="Enter your Gemini API Key"
                        className="w-full text-xs p-4 bg-bg-dark border border-white/10 rounded-xl text-white focus:outline-none focus:border-accent/50 transition-all font-mono"
                      />
                      <p className="text-[9px] text-slate-500 font-mono uppercase tracking-widest leading-relaxed">If Nova AI fails to respond, try adding your API key here. You can get one from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-accent hover:underline">AI Studio</a>.</p>
                    </div>
                    <div className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group cursor-pointer">
                      <span className="text-sm text-slate-300 font-mono uppercase tracking-widest">Voice Feedback</span>
                      <div className="w-12 h-6 bg-accent rounded-full relative transition-all shadow-[0_0_15px_rgba(0,242,255,0.3)]">
                        <div className="absolute right-1 top-1 w-4 h-4 bg-bg-dark rounded-full" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group cursor-pointer">
                      <span className="text-sm text-slate-300 font-mono uppercase tracking-widest">Live Background Listening</span>
                      <div className="w-12 h-6 bg-accent rounded-full relative transition-all shadow-[0_0_15px_rgba(0,242,255,0.3)]">
                        <div className="absolute right-1 top-1 w-4 h-4 bg-bg-dark rounded-full" />
                      </div>
                    </div>
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-300 font-mono uppercase tracking-widest">Interface Theme</span>
                        <span className="text-[10px] font-mono text-accent uppercase tracking-wider">{theme} mode</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => {
                            setTheme('light');
                            handleTTS("লাইট মোড সক্রিয় করা হয়েছে।");
                          }}
                          className={cn(
                            "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-xs font-mono uppercase tracking-widest",
                            theme === 'light' 
                              ? "bg-accent/15 border-accent text-accent shadow-[0_0_15px_rgba(0,242,255,0.15)]" 
                              : "bg-black/20 border-white/5 text-slate-400 hover:bg-white/5 hover:border-white/10"
                          )}
                        >
                          <Sun size={16} />
                          <span>Light</span>
                        </button>
                        <button
                          onClick={() => {
                            setTheme('dark');
                            handleTTS("ডার্ক মোড সক্রিয় করা হয়েছে।");
                          }}
                          className={cn(
                            "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-xs font-mono uppercase tracking-widest",
                            theme === 'dark' 
                              ? "bg-accent/15 border-accent text-accent shadow-[0_0_15px_rgba(0,242,255,0.15)]" 
                              : "bg-black/20 border-white/5 text-slate-400 hover:bg-white/5 hover:border-white/10"
                          )}
                        >
                          <Moon size={16} />
                          <span>Dark</span>
                        </button>
                        <button
                          onClick={() => {
                            setTheme('system');
                            handleTTS("সিস্টেম মোড সক্রিয় করা হয়েছে।");
                          }}
                          className={cn(
                            "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-xs font-mono uppercase tracking-widest",
                            theme === 'system' 
                              ? "bg-accent/15 border-accent text-accent shadow-[0_0_15px_rgba(0,242,255,0.15)]" 
                              : "bg-black/20 border-white/5 text-slate-400 hover:bg-white/5 hover:border-white/10"
                          )}
                        >
                          <Monitor size={16} />
                          <span>System</span>
                        </button>
                      </div>
                    </div>
                    <button 
                      onClick={() => setActiveTab('app-permissions')}
                      className="w-full flex items-center justify-between p-6 bg-accent/5 rounded-2xl border border-accent/20 hover:bg-accent/10 transition-all group cursor-pointer shadow-[0_0_15px_rgba(0,242,255,0.05)]"
                    >
                      <div className="flex items-center gap-3">
                        <ShieldAlert size={18} className="text-accent" />
                        <span className="text-sm text-accent font-mono uppercase tracking-widest">Control Other Apps</span>
                      </div>
                      <ChevronRight size={18} className="text-accent/50 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </section>

                <section className="p-8 glass-card border border-white/5 rounded-3xl shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/20" />
                  <h3 className="text-sm font-bold text-white mb-8 flex items-center gap-3 uppercase tracking-widest">
                    <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                      <Mic2 size={18} className="text-emerald-400" />
                    </div>
                    Nova Voice Character
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { id: 'aoede', name: 'Aoede', gender: 'Female', desc: 'Warm & Musical' },
                      { id: 'kore', name: 'Kore', gender: 'Female', desc: 'Young & Bright' },
                      { id: 'leda', name: 'Leda', gender: 'Female', desc: 'Professional' },
                      { id: 'zephyr', name: 'Zephyr', gender: 'Female', desc: 'Standard' },
                      { id: 'charon', name: 'Charon', gender: 'Male', desc: 'Deep & Resonant' },
                      { id: 'fenrir', name: 'Fenrir', gender: 'Male', desc: 'Bold & Strong' },
                      { id: 'orus', name: 'Orus', gender: 'Male', desc: 'Polite' },
                      { id: 'puck', name: 'Puck', gender: 'Male', desc: 'Energetic' },
                    ].map((voice, vIdx) => (
                      <button 
                        key={`voice-${voice.id}-${vIdx}`}
                        onClick={() => {
                          setSelectedVoice(voice.id);
                          handleTTS(`বস, আমি এখন থেকে ${voice.name} ভয়েস ব্যবহার করবো।`);
                        }}
                        className={cn(
                          "p-4 rounded-2xl border text-left transition-all relative overflow-hidden group",
                          selectedVoice === voice.id 
                            ? "bg-emerald-500/10 border-emerald-500/40" 
                            : "bg-white/5 border-white/5 hover:border-white/10"
                        )}
                      >
                        {selectedVoice === voice.id && (
                          <div className="absolute top-0 right-0 p-2 text-emerald-400">
                            <CheckCircle2 size={12} />
                          </div>
                        )}
                        <p className="text-[10px] font-bold text-white group-hover:text-emerald-400 transition-colors uppercase tracking-widest">{voice.name}</p>
                        <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-tighter">{voice.gender} • {voice.desc}</p>
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-600 mt-6 font-mono uppercase tracking-widest leading-relaxed">
                    Select the neural profile for your assistant. Each voice has a unique personality and pitch.
                  </p>
                </section>

                <section className="p-8 glass-card border border-white/5 rounded-3xl shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/20" />
                  <h3 className="text-sm font-bold text-white mb-8 flex items-center gap-3 uppercase tracking-widest">
                    <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <TerminalSquare size={18} className="text-blue-400" />
                    </div>
                    System Console Logs
                  </h3>
                  <div className="bg-black/40 rounded-2xl p-4 font-mono text-[10px] h-48 overflow-y-auto custom-scrollbar border border-white/5">
                    {terminalLog.length === 0 ? (
                      <p className="text-slate-700 italic">No system events logged...</p>
                    ) : (
                      terminalLog.map((log, idx) => (
                        <div key={`terminal-log-${log.id}-${idx}`} className="mb-1 flex gap-2">
                          <span className={cn(
                            "font-bold shrink-0",
                            log.type === 'info' ? "text-blue-400" :
                            log.type === 'success' ? "text-emerald-400" :
                            log.type === 'warn' ? "text-amber-400" :
                            log.type === 'error' ? "text-red-500" :
                            "text-accent"
                          )}>
                            [{log.type.toUpperCase()}]
                          </span>
                          <span className="text-slate-300">{log.msg}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <button 
                    onClick={() => setTerminalLog([])}
                    className="mt-4 text-[9px] text-slate-500 hover:text-white uppercase tracking-widest transition-colors font-bold"
                  >
                    Flush Log Buffer
                  </button>
                </section>

                <div className="text-center pt-12 pb-8">
                  <p className="text-[10px] text-slate-600 font-mono uppercase tracking-[0.4em]">Nova AI OS v4.0.0 (Cyber-Noir Edition)</p>
                  <p className="text-[10px] text-accent/40 font-mono mt-2 uppercase tracking-[0.2em]">Encrypted End-to-End Protocol Active</p>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Media Player Mini Overlay */}
            <AnimatePresence>
              {activeMedia && (
                <motion.div 
                  key="active-media-panel"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-slate-50 border-b border-slate-200 overflow-hidden"
                >
                  <div className="p-4 max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Volume2 size={14} className="text-blue-600" />
                        <span className="text-[10px] font-mono text-blue-600 uppercase tracking-widest">Nova Background Stream: {activeMedia.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setActiveTab('media')}
                          className="p-1 hover:bg-slate-100 rounded text-blue-600 transition-colors"
                          title="Expand"
                        >
                          <ArrowUpRight size={16} />
                        </button>
                        <button 
                          onClick={() => setActiveMedia(null)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-red-500 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="aspect-video w-full bg-black rounded-xl overflow-hidden border border-slate-200 shadow-2xl">
                      <iframe
                        width="100%"
                        height="100%"
                        src={(activeMedia.type === 'youtube' && !activeMedia.url.includes('http') 
                          ? `https://www.youtube.com/embed/${activeMedia.url}?autoplay=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`
                          : activeMedia.url) || null
                        }
                        title={activeMedia.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      ></iframe>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat Area */}
            <div 
              className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent relative custom-scrollbar"
              onScroll={handleScroll}
            >
              <AnimatePresence>
                {showDashboard && (
                  <motion.div
                    key="dashboard-metric-panel"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mb-8"
                  >
                    <Dashboard status={systemStatus} />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex justify-between items-center sticky top-0 z-10 bg-bg-dark/60 backdrop-blur-md py-4 gap-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowDashboard(!showDashboard)}
                    className={cn(
                      "p-2.5 border rounded-xl transition-all shadow-lg flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em]",
                      showDashboard ? "bg-accent/10 border-accent/30 text-accent" : "bg-white/5 border-white/10 text-slate-400"
                    )}
                  >
                    <Activity size={16} />
                    <span className="hidden xs:inline">{showDashboard ? 'Hide Metrics' : 'Show Metrics'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setActiveTab('apps')}
                    className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-accent hover:border-accent/30 transition-all shadow-lg flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em]"
                  >
                    <Grid size={16} />
                    <span className="hidden xs:inline">Modules</span>
                  </button>
                  <button 
                    onClick={() => setMessages([])}
                    className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-500 hover:text-red-500 hover:border-red-500/30 transition-all shadow-lg flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em]"
                  >
                    <Trash2 size={16} />
                    <span className="hidden xs:inline">Purge</span>
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {showScrollButton && (
                  <motion.button
                    key="scroll-button"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={scrollToBottom}
                    className="fixed bottom-32 right-8 z-50 p-5 bg-accent text-bg-dark rounded-full shadow-[0_0_20px_rgba(0,242,255,0.3)] hover:bg-accent/90 transition-all flex items-center justify-center border-2 border-white/20 group"
                    title="Scroll to Bottom"
                  >
                    <ArrowDown size={28} className="group-hover:translate-y-1 transition-transform" />
                  </motion.button>
                )}
              </AnimatePresence>

              {messages.length === 0 && (
                <motion.div 
                  key="empty-messages"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex-1 flex flex-col items-center justify-center p-12 text-center"
                >
                  <div className="relative mb-10">
                    <div className="absolute -inset-6 bg-accent/20 rounded-full blur-3xl animate-pulse" />
                    <div className="relative w-24 h-24 bg-bg-dark rounded-full flex items-center justify-center border border-accent/30 shadow-[0_0_30px_rgba(0,242,255,0.1)]">
                      <Mic size={40} className="text-accent" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3 font-display tracking-tight">System Ready, Boss</h3>
                  <p className="text-slate-500 max-w-md mb-12 font-mono text-[10px] uppercase tracking-[0.4em]">
                    Nova Protocol v4.0 | Secure Interface
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
                    <div className="p-6 glass-card border border-white/5 rounded-2xl text-left hover:border-accent/30 transition-all cursor-pointer group relative overflow-hidden" onClick={() => setInput("গান বাজাও")}>
                      <div className="absolute top-0 left-0 w-1 h-full bg-accent/20" />
                      <p className="text-[9px] font-mono text-accent uppercase mb-2 tracking-[0.2em]">Media Control</p>
                      <p className="text-sm font-bold text-white group-hover:text-accent transition-colors">"গান বাজাও"</p>
                      <p className="text-[10px] text-slate-500 mt-2 font-mono">Stream encrypted audio tracks</p>
                    </div>
                    <div className="p-6 glass-card border border-white/5 rounded-2xl text-left hover:border-accent/30 transition-all cursor-pointer group relative overflow-hidden" onClick={() => setInput("মিলোকে কল দাও")}>
                      <div className="absolute top-0 left-0 w-1 h-full bg-accent/20" />
                      <p className="text-[9px] font-mono text-accent uppercase mb-2 tracking-[0.2em]">Communication</p>
                      <p className="text-sm font-bold text-white group-hover:text-accent transition-colors">"মিলোকে কল দাও"</p>
                      <p className="text-[10px] text-slate-500 mt-2 font-mono">Initiate secure voice link</p>
                    </div>
                    <div className="p-6 glass-card border border-white/5 rounded-2xl text-left hover:border-accent/30 transition-all cursor-pointer group relative overflow-hidden" onClick={() => setInput("আজকের আবহাওয়া কেমন?")}>
                      <div className="absolute top-0 left-0 w-1 h-full bg-accent/20" />
                      <p className="text-[9px] font-mono text-accent uppercase mb-2 tracking-[0.2em]">Intelligence</p>
                      <p className="text-sm font-bold text-white group-hover:text-accent transition-colors">"আজকের আবহাওয়া কেমন?"</p>
                      <p className="text-[10px] text-slate-500 mt-2 font-mono">Real-time environmental data</p>
                    </div>
                    <div className="p-6 glass-card border border-white/5 rounded-2xl text-left hover:border-accent/30 transition-all cursor-pointer group relative overflow-hidden" onClick={() => setInput("ইউটিউবে ভিডিও দেখাও")}>
                      <div className="absolute top-0 left-0 w-1 h-full bg-accent/20" />
                      <p className="text-[9px] font-mono text-accent uppercase mb-2 tracking-[0.2em]">Entertainment</p>
                      <p className="text-sm font-bold text-white group-hover:text-accent transition-colors">"ইউটিউবে ভিডিও দেখাও"</p>
                      <p className="text-[10px] text-slate-500 mt-2 font-mono">Internal secure streaming</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={startSTT}
                    className="mt-16 flex items-center gap-4 px-10 py-5 bg-accent text-bg-dark rounded-2xl font-bold hover:bg-accent/90 transition-all shadow-xl shadow-accent/20 active:scale-95 uppercase tracking-widest text-sm"
                  >
                    <Mic size={24} />
                    Initialize Voice Link
                  </button>
                </motion.div>
              )}

              {messages.map((msg, idx) => (
                <motion.div
                  key={`app-msg-${msg.id}-${idx}-${msg.timestamp.toString()}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex flex-col max-w-[90%] md:max-w-[80%]",
                    msg.role === 'user' ? "ml-auto items-end" : "items-start"
                  )}
                >
                  <div className="flex items-center gap-3 mb-2 px-3">
                    <span className={cn(
                      "text-[9px] font-mono uppercase tracking-[0.2em]",
                      msg.role === 'assistant' ? "text-accent" : "text-slate-500"
                    )}>
                      {msg.role === 'assistant' ? 'Nova AI' : 'Operator'}
                    </span>
                    <span className="text-[9px] font-mono text-slate-600">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={cn(
                    "p-5 rounded-2xl border transition-all relative overflow-hidden",
                    msg.role === 'user' 
                      ? "bg-accent/10 border-accent/20 text-slate-200 rounded-tr-none shadow-[0_0_20px_rgba(0,242,255,0.05)]" 
                      : "bg-white/5 border-white/10 text-slate-300 rounded-tl-none shadow-xl backdrop-blur-md"
                  )}>
                    {msg.role === 'assistant' && (
                      <div className="absolute top-0 left-0 w-1 h-full bg-accent/30" />
                    )}
                    <div className="markdown-body prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown>{formatNicknameMsg(msg.content)}</ReactMarkdown>
                    </div>
                    {msg.imageUrl && (
                      <div className="mt-5 rounded-xl overflow-hidden border border-white/10 shadow-2xl group relative">
                        <img src={msg.imageUrl || null} alt="Generated by Nova" className="w-full h-auto transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-gradient-to-t from-bg-dark/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )}
                    {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                      <div className="mt-5 pt-5 border-t border-white/5">
                        <p className="text-[9px] font-mono text-slate-500 uppercase mb-3 tracking-[0.2em]">Verified Sources:</p>
                        <div className="flex flex-wrap gap-2">
                          {msg.groundingLinks.map((link, idx) => (
                            <a 
                              key={`link-${idx}-${link.uri || link.title || idx}`} 
                              href={link.uri} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[10px] bg-slate-50 border border-slate-200 px-2 py-1 rounded hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all"
                            >
                              {link.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {msg.role === 'assistant' && (
                      <button 
                        onClick={() => handleTTS(msg.content, msg.id)}
                        className={cn(
                          "mt-3 p-1.5 rounded-lg transition-colors",
                          speakingMessageId === msg.id 
                            ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" 
                            : "text-slate-400 hover:bg-slate-50 hover:text-blue-600"
                        )}
                      >
                        <Volume2 size={14} className={cn(speakingMessageId === msg.id && !isAudioPaused && "animate-pulse")} />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <div className="flex flex-col items-start max-w-[70%]">
                  <div className="flex items-center gap-3 mb-2 px-3">
                    <span className="text-[9px] font-mono text-accent uppercase animate-pulse tracking-[0.2em]">Decrypting Response...</span>
                  </div>
                  <div className="p-5 rounded-2xl border border-white/10 bg-white/5 rounded-tl-none backdrop-blur-md">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:-0.3s] shadow-[0_0_10px_rgba(0,242,255,0.5)]" />
                      <div className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:-0.15s] shadow-[0_0_10px_rgba(0,242,255,0.5)]" />
                      <div className="w-2 h-2 rounded-full bg-accent animate-bounce shadow-[0_0_10px_rgba(0,242,255,0.5)]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-bg-dark/80 backdrop-blur-xl border-t border-white/5 relative">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
              <div className="max-w-4xl mx-auto relative">
                <div className="absolute top-5 left-5 flex items-start pointer-events-none z-10">
                  <Terminal size={18} className="text-accent/40" />
                </div>
                <textarea
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={1}
                  placeholder={isListening ? "Listening to Boss..." : "Ask Nova...."}
                  className={cn(
                    "w-full bg-white/5 border border-white/10 rounded-2xl p-5 pl-14 pr-32 text-sm font-mono text-white outline-none focus:border-accent/30 transition-all resize-none min-h-[60px] max-h-[200px] placeholder:text-slate-700 shadow-inner",
                    isListening && "border-red-500/50 ring-1 ring-red-500/20"
                  )}
                />
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  <button
                    onClick={startSTT}
                    className={cn(
                      "p-3 rounded-xl transition-all border",
                      isListening 
                        ? "bg-red-500/20 border-red-500/40 text-red-500 animate-pulse" 
                        : "bg-white/5 border-white/10 text-slate-500 hover:text-accent hover:border-accent/30"
                    )}
                    title="Voice Input"
                  >
                    {isListening ? <Mic size={18} className="animate-bounce" /> : <Mic size={18} />}
                  </button>
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isLoading}
                    className={cn(
                      "p-3 rounded-xl transition-all border shadow-lg font-bold text-sm flex items-center gap-2",
                      input.trim() && !isLoading 
                        ? "bg-accent border-accent/50 text-bg-dark shadow-accent/20 hover:scale-105" 
                        : "bg-white/5 border-white/10 text-slate-600"
                    )}
                  >
                    <span className="hidden sm:inline">Submit</span>
                    <Send size={18} />
                  </button>
                </div>
              </div>
              <div className="max-w-4xl mx-auto mt-4 flex items-center justify-between px-2">
                <div className="flex items-center gap-4">
                  <span className="text-[8px] font-mono text-slate-600 uppercase tracking-[0.2em]">Status: <span className="text-emerald-500">Encrypted</span></span>
                  <span className="text-[8px] font-mono text-slate-600 uppercase tracking-[0.2em]">Link: <span className="text-accent">Stable</span></span>
                </div>
                <p className="text-[8px] font-mono text-slate-700 uppercase tracking-[0.4em]">Nova Protocol v4.0.0 | Secure Interface</p>
              </div>
            </div>
          </div>
        );
    }
  };

  const [isDialPadOpen, setIsDialPadOpen] = useState(false);
  const [dialingTarget, setDialingTarget] = useState<{ name?: string, number: string } | null>(null);
  const [dialingNumber, setDialingNumber] = useState('');
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'ringing' | 'connected' | 'on-hold' | 'ended'>('idle');
  const [callTimer, setCallTimer] = useState(0);

  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }, []);

  useEffect(() => {
    if (callStatus === 'ringing') {
      const interval = setInterval(() => {
        if (audioContextRef.current) {
          playCallSound('ringing', audioContextRef.current);
        }
      }, 3000);
      return () => clearInterval(interval);
    }
    if (callStatus === 'ended') {
      if (audioContextRef.current) {
        playCallSound('ended', audioContextRef.current);
      }
    }
    if (callStatus === 'connected') {
      if (audioContextRef.current) {
        playCallSound('connected', audioContextRef.current);
      }
    }
    if (callStatus === 'on-hold') {
      if (audioContextRef.current) {
        playCallSound('on-hold', audioContextRef.current);
      }
    }
  }, [callStatus]);

  useEffect(() => {
    if (incomingCall && incomingCall.status === 'ringing') {
      const interval = setInterval(() => {
        if (audioContextRef.current) {
          playCallSound('ringing', audioContextRef.current);
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [incomingCall]);

  useEffect(() => {
    let interval: any;
    if (callStatus === 'connected' || callStatus === 'on-hold') {
      interval = setInterval(() => {
        setCallTimer(prev => prev + 1);
      }, 1000);
    } else if (callStatus === 'idle') {
      setCallTimer(0);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (isDialPadOpen && dialingTarget && callStatus === 'dialing') {
      const triggerCall = () => {
        handleTTS(`বস, আমি কলটি কানেক্ট করছি। Nova-র সিকিউর লাইন এখন সক্রিয়।`);
        setCallStatus('ringing');
        
        // Auto-connect UI after a delay to simulate staying in Nova
        setTimeout(() => {
          setCallStatus(prev => prev === 'ringing' ? 'connected' : prev);
        }, 6000);
      };

      const timer = setTimeout(triggerCall, 800);
      return () => clearTimeout(timer);
    }
  }, [isDialPadOpen, dialingTarget, callStatus]);

  const getTime = () => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Dhaka',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };
    const bdTime = new Intl.DateTimeFormat('en-US', options).format(now);
    // bdTime will be like "06:35:32 PM"
    const [timePart, ampm] = bdTime.split(' ');
    const [hour, minute, second] = timePart.split(':');
    
    const dateOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Dhaka',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    };
    const bdDate = new Intl.DateTimeFormat('en-US', dateOptions).format(now);

    return { hour, minute, second, ampm, fullDate: bdDate };
  };

  const [isContactsOpen, setIsContactsOpen] = useState(false);
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [isAndroidBuildOpen, setIsAndroidBuildOpen] = useState(false);

  const UserSearch = () => {
    if (!isSearchOpen) return null;
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] flex items-center justify-center bg-white/90 backdrop-blur-xl p-6"
      >
        <div className="w-full max-w-md bg-white border border-blue-200 rounded-[40px] p-10 shadow-2xl relative">
          <h2 className="text-2xl font-bold text-blue-600 mb-6 flex items-center gap-3">
            <Bot size={24} />
            Find Nova User
          </h2>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Enter 6-Digit Nova ID</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={searchNovaId}
                  onChange={(e) => setSearchNovaId(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="XXXXXX"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4 text-2xl font-mono text-center tracking-[0.5em] focus:border-blue-400 outline-none transition-all"
                />
                <button 
                  onClick={handleSearchUser}
                  disabled={isSearching || searchNovaId.length !== 6}
                  className="p-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  <Send size={24} />
                </button>
              </div>
            </div>

            {isSearching && (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {searchResult && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xl">
                    {searchResult.displayName?.[0]?.toUpperCase() || 'N'}
                  </div>
                  <div>
                    <h3 className="text-slate-900 font-bold">{searchResult.displayName}</h3>
                    <p className="text-[10px] text-blue-600 font-mono">ID: {searchResult.novaId}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setDialingTarget({ name: searchResult.displayName, number: searchResult.novaId });
                    setIsDialPadOpen(true);
                    setIsSearchOpen(false);
                  }}
                  className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  <Phone size={20} />
                </button>
              </motion.div>
            )}

            {!isSearching && !searchResult && searchNovaId.length === 6 && (
              <p className="text-center text-xs text-slate-400 italic">Press the arrow to search for user...</p>
            )}
          </div>

          <button 
            onClick={() => {
              setIsSearchOpen(false);
              setSearchResult(null);
              setSearchNovaId('');
            }} 
            className="mt-8 w-full py-3 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 transition-all font-mono text-xs uppercase tracking-widest"
          >
            Close Search
          </button>
        </div>
      </motion.div>
    );
  };

  const ContactList = () => {
    if (!isContactsOpen) return null;
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] flex items-center justify-center bg-white/90 backdrop-blur-xl p-6"
      >
        <div className="w-full max-w-md bg-white border border-blue-200 rounded-[40px] p-10 shadow-2xl relative">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-blue-600 flex items-center gap-3">
              <Bot size={24} />
              Secure Contacts
            </h2>
            <button
              onClick={() => setRevealContacts(!revealContacts)}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition-all"
              title={revealContacts ? "Hide Numbers" : "Show Numbers"}
            >
              {revealContacts ? <Eye size={20} /> : <EyeOff size={20} />}
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {Object.entries(contacts).sort().map(([name, num], idx) => (
              <div key={`contact-${name}-${num}-${idx}`} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-300 transition-all group">
                <div className="text-left">
                  <div className="text-slate-900 font-bold capitalize text-sm">{name}</div>
                  <div className="text-slate-500 font-mono text-[10px] tracking-wider">
                    {formatPhoneNumber(num, revealContacts)}
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setDialingTarget({ name, number: num });
                    setIsDialPadOpen(true);
                    setIsContactsOpen(false);
                  }}
                  className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                >
                  <Phone size={16} />
                </button>
              </div>
            ))}
          </div>
          <button 
            onClick={() => setIsContactsOpen(false)} 
            className="mt-8 w-full py-3 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 transition-all font-mono text-xs uppercase tracking-widest"
          >
            Close Database
          </button>
        </div>
      </motion.div>
    );
  };

  const DialPad = () => {
    if (!isDialPadOpen) return null;

    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] flex items-center justify-center bg-white/90 backdrop-blur-xl p-6"
      >
        <div className="w-full max-w-md bg-white border border-blue-200 rounded-[40px] p-10 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-600 to-transparent animate-scan" />
          
          <button 
            onClick={() => {
              setIsDialPadOpen(false);
              setDialingTarget(null);
              setDialingNumber('');
              setCallStatus('idle');
            }}
            className="absolute top-6 right-6 text-slate-400 hover:text-blue-600 transition-colors"
          >
            <X size={24} />
          </button>

          {dialingTarget ? (
            <div className="mb-12 w-full">
              <div className="w-32 h-32 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8 border border-blue-100 relative">
                <div className={cn(
                  "absolute inset-0 rounded-full border-4 border-blue-200",
                  callStatus !== 'idle' && "animate-ping"
                )} />
                {(callStatus === 'connected' || callStatus === 'on-hold' || callStatus === 'ended') ? (
                  <div className={cn(
                    "text-blue-600 font-mono text-2xl",
                    callStatus !== 'ended' && "animate-pulse"
                  )}>
                    {formatTime(callTimer)}
                  </div>
                ) : (
                  <Phone size={56} className={cn(
                    "text-blue-600",
                    callStatus === 'dialing' && "animate-pulse"
                  )} />
                )}
              </div>
              
              <h2 className="text-4xl font-bold text-slate-900 mb-3 capitalize tracking-tight">
                {dialingTarget.name || 'Unknown'}
              </h2>
              <p className="text-blue-600 font-mono text-xl tracking-[0.3em] mb-8 opacity-80">
                {dialingTarget.number}
              </p>
              
              <div className="flex flex-col items-center gap-2 mb-12">
                <div className="flex items-center gap-2 text-blue-600 font-mono text-xs uppercase tracking-[0.2em]">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    callStatus === 'connected' ? "bg-emerald-500 animate-pulse" : 
                    callStatus === 'on-hold' ? "bg-amber-500 animate-pulse" :
                    callStatus === 'ended' ? "bg-red-500" :
                    "bg-blue-600 animate-ping"
                  )} />
                  {callStatus === 'dialing' ? 'Nova Dialing System...' : 
                   callStatus === 'ringing' ? 'Ringing...' :
                   callStatus === 'on-hold' ? 'Call On Hold' :
                   callStatus === 'ended' ? 'Call Ended' :
                   'Call Connected'}
                </div>
                {callStatus === 'dialing' && (
                  <p className="text-[11px] text-slate-500 font-mono uppercase max-w-[260px] leading-relaxed">
                    {userNickname}, ফোনের সিকিউরিটির জন্য সবুজ বাটনটি চাপুন। Nova এখানেই থাকবে এবং আপনার কলটি মনিটর করবে।
                  </p>
                )}
                {callStatus === 'connected' && (
                  <p className="text-[10px] text-emerald-600 font-mono uppercase tracking-widest">
                    Secure Background Mode Active
                  </p>
                )}
              </div>

              {(callStatus === 'connected' || callStatus === 'on-hold') && (
                <div className="grid grid-cols-3 gap-8 mb-12">
                  <div className="flex flex-col items-center gap-2">
                    <button 
                      onClick={() => setIsMuted(!isMuted)}
                      className={cn(
                        "w-14 h-14 rounded-full border flex items-center justify-center transition-all",
                        isMuted 
                          ? "bg-red-50 border-red-200 text-red-500 shadow-inner" 
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                      )}
                    >
                      {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                    </button>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest">{isMuted ? 'Muted' : 'Mute'}</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <button 
                      onClick={() => setCallStatus(prev => prev === 'connected' ? 'on-hold' : 'connected')}
                      className={cn(
                        "w-14 h-14 rounded-full border flex items-center justify-center transition-all",
                        callStatus === 'on-hold'
                          ? "bg-amber-50 border-amber-200 text-amber-600 shadow-inner"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                      )}
                    >
                      {callStatus === 'on-hold' ? <Play size={24} /> : <Pause size={24} />}
                    </button>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest">{callStatus === 'on-hold' ? 'Resume' : 'Hold'}</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <button className="w-14 h-14 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-all">
                      <Grid size={24} />
                    </button>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest">Keypad</span>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-4">
                {callStatus === 'dialing' && (
                  <button 
                    onClick={() => setCallStatus('connected')}
                    className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold flex flex-col items-center justify-center gap-1 shadow-lg hover:bg-blue-700 transition-all active:scale-95"
                  >
                    <div className="flex items-center gap-2">
                      <Phone size={24} />
                      <span className="text-lg">CONNECT NOW</span>
                    </div>
                  </button>
                )}
                
                <button 
                  onClick={endCall}
                  className={cn(
                    "w-full py-5 rounded-2xl font-bold uppercase tracking-widest transition-all shadow-md",
                    (callStatus === 'connected' || callStatus === 'on-hold')
                      ? "bg-red-500 text-white hover:bg-red-600" 
                      : "bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  <div className="flex items-center justify-center gap-2">
                    {(callStatus === 'connected' || callStatus === 'on-hold') ? <PhoneOff size={20} /> : <X size={20} />}
                    {(callStatus === 'connected' || callStatus === 'on-hold') ? 'END CALL' : 'CANCEL'}
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-8">
              <div className="flex flex-col gap-2 mb-6">
                <div className="text-4xl font-mono text-blue-600 h-16 flex items-center justify-center tracking-widest bg-slate-50 rounded-2xl border border-slate-200">
                  {dialingNumber || <span className="text-slate-300">Enter Number/ID</span>}
                </div>
                <div className="flex items-center justify-between px-2">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">My Nova ID: <span className="text-blue-600 font-bold">{myNovaId}</span></span>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Enter ID or Phone Number</span>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-6 mb-12">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map((key) => (
                  <button 
                    key={`dialpad-btn-${key}`}
                    onClick={() => setDialingNumber(prev => prev.length < 15 ? prev + key : prev)}
                    className="w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-2xl font-mono text-slate-700 hover:bg-blue-50 hover:border-blue-300 transition-all active:scale-90"
                  >
                    {key}
                  </button>
                ))}
              </div>

              <div className="flex justify-center gap-4">
                <button 
                  onClick={() => handleCall(dialingNumber)}
                  disabled={!dialingNumber}
                  className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform disabled:opacity-50 disabled:scale-100"
                  title="Audio Call"
                >
                  <Phone size={24} />
                </button>
                <button 
                  onClick={() => startCall(dialingNumber, false, true)}
                  disabled={!dialingNumber}
                  className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform disabled:opacity-50 disabled:scale-100"
                  title="Video Call"
                >
                  <Video size={24} />
                </button>
                <button 
                  onClick={() => setDialingNumber(prev => prev.slice(0, -1))}
                  className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 border border-slate-200 hover:bg-slate-200 transition-all active:scale-90"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  const IncomingCallOverlay = () => {
    if (!incomingCall) return null;

    const handleScreen = () => {
      setIncomingCall(prev => prev ? { ...prev, status: 'screening' } : null);
      
      // Log incoming call as screening/completed
      const newCall: CallRecord = {
        id: generateId(),
        type: 'incoming',
        name: incomingCall.from,
        number: 'Unknown',
        timestamp: new Date(),
        status: 'completed'
      };
      setCallHistory(prev => [newCall, ...prev]);
      
      handleTTS("সালাম, আমি নোভার এআই অ্যাসিস্ট্যান্ট। আপনি কার সাথে কথা বলতে চান এবং কেন? আমি বসকে আপনার পরিচয় দিচ্ছি।");
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'assistant',
          content: `বস, **${incomingCall.from}** থেকে একটি কল এসেছে। তিনি বলছেন তিনি আপনার বন্ধু এবং জরুরি কথা আছে। আপনি কি কথা বলতে আগ্রহী?`,
          timestamp: new Date()
        }]);
      }, 3000);
    };

    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90 backdrop-blur-xl p-6"
      >
        <div className="w-full max-w-sm bg-white border border-blue-200 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-100">
            <Phone size={40} className="text-blue-600 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">{incomingCall.from}</h2>
          <p className="text-blue-600 font-mono text-sm uppercase tracking-widest mb-8">
            {incomingCall.status === 'ringing' ? (incomingCall.isVideo ? 'Incoming Video Call...' : 'Incoming Audio Call...') : 'Nova Screening...'}
          </p>

          <div className="grid grid-cols-3 gap-3">
            {incomingCall.status === 'ringing' ? (
              <>
                <button 
                  onClick={answerCall}
                  className="flex flex-col items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-2xl hover:bg-emerald-100 transition-all"
                >
                  {incomingCall.isVideo ? <Video size={20} className="text-emerald-600" /> : <Phone size={20} className="text-emerald-600" />}
                  <span className="text-[9px] font-mono text-emerald-600 uppercase">Accept</span>
                </button>
                <button 
                  onClick={handleScreen}
                  className="flex flex-col items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-2xl hover:bg-blue-100 transition-all"
                >
                  <Bot size={20} className="text-blue-600" />
                  <span className="text-[9px] font-mono text-blue-600 uppercase">Screen</span>
                </button>
                <button 
                  onClick={() => {
                    const newCall: CallRecord = {
                      id: generateId(),
                      type: 'incoming',
                      name: incomingCall.from,
                      number: 'Unknown',
                      timestamp: new Date(),
                      status: 'rejected'
                    };
                    setCallHistory(prev => [newCall, ...prev]);
                    socket?.emit('end-call', { to: incomingCall.from });
                    setIncomingCall(null);
                  }}
                  className="flex flex-col items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-2xl hover:bg-red-100 transition-all"
                >
                  <Phone size={20} className="text-red-500 rotate-[135deg]" />
                  <span className="text-[9px] font-mono text-red-500 uppercase">Decline</span>
                </button>
              </>
            ) : (
              <div className="col-span-3 space-y-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-500 text-left italic">
                  "Nova: Salam, I am Nova AI. Who is calling and why?..."
                </div>
                <div className="flex gap-4">
                   <button 
                    onClick={() => {
                      setDialingTarget({ name: incomingCall.from, number: 'Unknown' });
                      setIsDialPadOpen(true);
                      setCallStatus('connected');
                      setIncomingCall(null);
                    }}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all"
                  >
                    ACCEPT
                  </button>
                  <button 
                    onClick={() => setIncomingCall(null)}
                    className="flex-1 py-3 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
                  >
                    REJECT
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bg selection:bg-blue-100 selection:text-blue-900">
      <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />
      <AnimatePresence>
        {showAuth && <AuthModal key="auth-modal" onSuccess={handleAuthSuccess} setError={setError} />}
        {isSimModalOpen && (
          <SimLinkModal 
            key="sim-modal"
            onClose={() => setIsSimModalOpen(false)}
            onSuccess={(num) => {
              setIsSimLinked(true);
              setLinkedNumber(num);
              setIsSimModalOpen(false);
            }}
            handleTTS={handleTTS}
            setError={setError}
          />
        )}
        {isAndroidBuildOpen && (
          <AndroidBuildModal
            key="android-build-modal"
            onClose={() => setIsAndroidBuildOpen(false)}
          />
        )}
        {isSearchOpen && <UserSearch key="user-search" />}
        {isContactsOpen && <ContactList key="contact-list" />}
        {isDialPadOpen && <DialPad key="dial-pad" />}
        {incomingCall && <IncomingCallOverlay key="incoming-call" />}
      </AnimatePresence>
      
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            key="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[140] md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            key="sidebar-aside"
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 w-64 glass-card border-r border-white/5 flex flex-col z-[150] shadow-2xl md:relative md:shadow-none"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,242,255,0.1)]">
                  <Shield className="text-accent w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-white font-bold tracking-tight font-display">NOVA <span className="text-accent">AI</span></h1>
                  <p className="text-[9px] text-slate-500 font-mono uppercase tracking-[0.2em]">Cyber Protocol v4.0</p>
                </div>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-accent transition-colors">
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
              <p className="text-[10px] text-slate-500 font-mono uppercase mb-3 px-3 tracking-[0.2em]">Core Systems</p>
              <SidebarItem 
                icon={<LayoutDashboard size={18} />} 
                label="Dashboard" 
                active={activeTab === 'dashboard'} 
                onClick={() => { setActiveTab('dashboard'); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
              />
              <SidebarItem 
                icon={<Terminal size={18} />} 
                label="Control Center" 
                active={activeTab === 'terminal'} 
                onClick={() => { setActiveTab('terminal'); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
              />
              <SidebarItem 
                icon={<History size={18} />} 
                label="Call History" 
                active={activeTab === 'history'} 
                onClick={() => { setActiveTab('history'); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
              />
              <SidebarItem 
                icon={<Mic size={18} />} 
                label="Voice Assistant" 
                active={activeTab === 'voice'} 
                onClick={() => { setActiveTab('voice'); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
              />
              <SidebarItem 
                icon={<Activity size={18} />} 
                label="Vuln Scan" 
                active={activeTab === 'scan'} 
                onClick={() => { setActiveTab('scan'); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
              />
              <SidebarItem 
                icon={<Lock size={18} />} 
                label="Encryption" 
                active={activeTab === 'encryption'} 
                onClick={() => { setActiveTab('encryption'); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
              />
              <SidebarItem 
                icon={<Grid size={18} />} 
                label="App Grid" 
                active={activeTab === 'apps'} 
                onClick={() => { setActiveTab('apps'); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
              />
              <SidebarItem 
                icon={<Video size={18} />} 
                label="Media Center" 
                active={activeTab === 'media'} 
                onClick={() => { setActiveTab('media'); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
              />
              <SidebarItem 
                icon={<Settings size={18} />} 
                label="Settings" 
                active={activeTab === 'settings'} 
                onClick={() => { setActiveTab('settings'); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
              />
              <SidebarItem 
                icon={<Smartphone size={18} className="text-cyan-400" />} 
                label="Build for Android" 
                active={false} 
                onClick={() => { setIsAndroidBuildOpen(true); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
              />
              
              <div className="pt-6 border-t border-white/5 mt-6">
                <div 
                  onClick={() => setShowSidebarContacts(!showSidebarContacts)}
                  className="flex items-center justify-between px-3 mb-4 cursor-pointer hover:bg-white/5 p-1 rounded-lg transition-all"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-slate-300 font-mono uppercase tracking-[0.2em]">Contacts</p>
                    <ChevronDown size={11} className={cn("text-slate-500 transition-transform", showSidebarContacts && "rotate-180")} />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRevealContacts(!revealContacts);
                      }}
                      className="text-slate-500 hover:text-accent transition-colors ml-1"
                      title={revealContacts ? "Hide Numbers" : "Show Numbers"}
                    >
                      {revealContacts ? <Eye size={11} /> : <EyeOff size={11} />}
                    </button>
                  </div>
                  {showSidebarContacts && (
                    <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => {
                          const data = prompt("Enter contacts in 'Name:Number' format, separated by commas (e.g., Milon:017..., Home:018...):");
                          if (data) {
                            const pairs = data.split(',');
                            const newContacts: Record<string, string> = {};
                            pairs.forEach(pair => {
                              const [name, num] = pair.split(':');
                              if (name && num) newContacts[name.trim().toLowerCase()] = num.trim();
                            });
                            setContacts(prev => ({ ...prev, ...newContacts }));
                            alert(`${Object.keys(newContacts).length} contacts added!`);
                          }
                        }}
                        className="text-[9px] text-accent hover:underline font-mono"
                      >
                        BULK
                      </button>
                      <button 
                        onClick={() => {
                          const name = prompt("Enter contact name:");
                          const num = prompt("Enter phone number:");
                          if (name && num) setContacts(prev => ({ ...prev, [name.toLowerCase()]: num }));
                        }}
                        className="text-[9px] text-accent hover:underline font-mono"
                      >
                        + ADD
                      </button>
                    </div>
                  )}
                </div>
                {showSidebarContacts && (
                  <div className="max-h-40 overflow-y-auto space-y-2 px-3 custom-scrollbar">
                    {Object.entries(contacts).length === 0 ? (
                      <div className="text-[10px] font-mono text-slate-600 text-center py-2">No contacts</div>
                    ) : (
                      Object.entries(contacts).map(([name, num], idx) => (
                        <div key={`sidebar-contact-${name}-${num}-${idx}`} className="flex items-center justify-between text-[11px] font-mono text-slate-400 group cursor-pointer hover:text-slate-200 transition-colors">
                          <span className="capitalize">{name}</span>
                          <span className="text-accent/40 group-hover:text-accent transition-colors">
                            {formatPhoneNumber(num, revealContacts)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </nav>

            <div className="p-6 border-t border-white/5 bg-white/5 backdrop-blur-md">
              <div className="mb-4 p-4 bg-white/5 rounded-2xl border border-white/10 shadow-inner">
                <p className="text-[9px] text-slate-500 font-mono uppercase tracking-[0.2em] mb-2">Your Nova ID</p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-mono font-bold text-accent tracking-[0.2em]">{myNovaId}</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(myNovaId);
                      handleTTS("বস, আপনার আইডি কপি করা হয়েছে।");
                    }}
                    className="p-2 hover:bg-accent/10 rounded-xl text-accent transition-all"
                  >
                    <Save size={14} />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <div className="flex items-center gap-2">
                    <Cpu size={12} className="text-accent/50" />
                    <span>CPU LOAD</span>
                  </div>
                  <span className="text-slate-300">14%</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <div className="flex items-center gap-2">
                    <Zap size={12} className="text-accent/50" />
                    <span>LATENCY</span>
                  </div>
                  <span className="text-slate-300">42ms</span>
                </div>
              </div>
              {user && (
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    {user.photoURL ? (
                      <img src={user.photoURL || null} alt="Profile" className="w-8 h-8 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent text-xs font-bold uppercase font-mono">
                        {user.displayName?.[0] || user.email?.[0] || 'U'}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-bold text-slate-200 truncate">{user.displayName || 'User'}</span>
                      <span className="text-[9px] font-mono text-slate-500 truncate">{user.email || 'linked'}</span>
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                      try {
                        await auth.signOut();
                        handleTTS("বস, আপনি সফলভাবে লগআউট হয়েছেন।");
                      } catch (err: any) {
                        setError("লগআউট করতে সমস্যা হয়েছে: " + err.message);
                      }
                    }}
                    className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg text-slate-400 transition-all"
                    title="Logout"
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>


      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-16 border-b border-white/5 bg-bg-dark/40 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 z-10">
          <div className="flex items-center gap-2 md:gap-4">
            {activeTab !== 'terminal' ? (
              <button 
                onClick={() => setActiveTab('terminal')}
                className="p-3 bg-accent text-bg-dark rounded-xl hover:bg-accent/90 transition-all flex items-center gap-2 text-[10px] font-bold shadow-lg shadow-accent/10 uppercase tracking-widest"
              >
                <ChevronLeft size={20} />
                <span>BACK</span>
              </button>
            ) : (
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition-colors"
              >
                <Menu size={20} />
              </button>
            )}
            <div className="flex items-center gap-2 md:gap-6">
              <div className="hidden xs:flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_10px_rgba(0,242,255,0.5)]" />
                <span className="font-mono text-[9px] text-accent uppercase tracking-[0.2em] whitespace-nowrap">Secure Protocol</span>
              </div>

              {isLiveMode && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-lg"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest">Live</span>
                </motion.div>
              )}
              
              <div className="hidden md:block">
                <DhakaClock handleTTS={handleTTS} />
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 md:gap-4">
            <div className="flex items-center gap-1 bg-white/5 border border-white/5 px-2 py-1.5 rounded-lg text-[10px] font-mono">
              <span className="text-slate-500 uppercase tracking-widest text-[8px] hidden xs:inline">Your Nova ID:</span>
              <span className="text-accent font-bold tracking-wider">{myNovaId}</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(myNovaId);
                  handleTTS("বস, আপনার আইডি কপি করা হয়েছে।");
                }}
                className="hover:text-accent text-slate-400 transition-colors ml-0.5"
                title="Copy ID"
              >
                <Save size={10} />
              </button>
            </div>

            <button
              onClick={toggleLiveMode}
              className={cn(
                "px-3 py-2 rounded-xl transition-all border flex items-center gap-2 shadow-sm",
                isLiveMode 
                  ? "bg-accent border-accent/50 text-bg-dark shadow-lg shadow-accent/20 ring-2 ring-accent/30 ring-offset-2 ring-offset-bg-dark" 
                  : "bg-white/5 border-white/10 text-slate-400 hover:text-accent hover:border-accent/30"
              )}
              title={isLiveMode ? "Disable Live Mode" : "Enable Live Mode"}
            >
              <div className="relative">
                <Zap size={18} className={cn(isLiveMode ? "fill-bg-dark animate-pulse" : "text-slate-500")} />
                {isLiveMode && (
                  <motion.div 
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-white rounded-full blur-md"
                  />
                )}
              </div>
              <span className={cn(
                "text-[10px] font-mono uppercase tracking-widest font-bold",
                isLiveMode ? "inline" : "hidden sm:inline"
              )}>
                {isLiveMode ? 'LIVE ACTIVE' : 'LIVE ASSISTANT'}
              </span>
            </button>

            <button 
              onClick={() => setIsAndroidBuildOpen(true)}
              className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all border bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 shadow-[0_0_10px_rgba(0,242,255,0.1)]"
            >
              <Smartphone size={14} className="text-cyan-400" />
              <span>ANDROID APK</span>
            </button>

            <button 
              onClick={() => setIsSimModalOpen(true)}
              className={cn(
                "flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg text-[10px] font-mono transition-all border",
                isSimLinked 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                  : "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20"
              )}
            >
              <Smartphone size={14} />
              <span className="hidden sm:inline">
                {isSimLinked ? `SIM: ${linkedNumber.slice(-4)}` : 'LINK'}
              </span>
            </button>

            <button 
              onClick={() => setIncomingCall({ from: 'Unknown Number', status: 'ringing' })}
              className="hidden sm:block px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-mono text-slate-500 hover:bg-white/10 transition-all"
            >
              TEST
            </button>
          </div>
        </header>

        {renderTabContent()}

        {/* Camera Modal */}
        <AnimatePresence>
          {isCameraOpen && (
            <Camera key="camera-modal" onClose={() => setIsCameraOpen(false)} />
          )}
        </AnimatePresence>

        {/* Error Notification */}
        <AnimatePresence>
          {error && (
            <motion.div
              key="error-notification"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-50 border border-red-200 rounded-lg backdrop-blur-md flex items-center gap-3 shadow-lg"
            >
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-mono text-red-600 uppercase tracking-wider">{error}</span>
              {error.includes('Live') && (
                <button 
                  onClick={() => {
                    setError(null);
                    toggleLiveMode();
                  }}
                  className="px-2 py-0.5 bg-red-500 hover:bg-red-600 rounded text-[10px] font-bold text-white transition-colors"
                >
                  RECONNECT
                </button>
              )}
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Visualizer Overlay */}
        <AnimatePresence>
          {isLiveMode && (
            <motion.div
              key="live-visualizer"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 md:left-auto md:right-32 md:translate-x-0 w-48 h-48 md:w-56 md:h-56 rounded-full bg-bg-dark/80 border-2 border-accent/30 backdrop-blur-2xl flex items-center justify-center z-[130] overflow-hidden shadow-[0_0_50px_rgba(0,242,255,0.2)]"
            >
              <div className="absolute inset-0 flex items-center justify-center gap-1.5">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={`visualizer-bar-${i}`}
                    animate={{
                      height: isSpeaking ? [30, 80, 30] : [15, 25, 15],
                      backgroundColor: isSpeaking ? ['#00f2ff', '#7000ff', '#00f2ff'] : '#00f2ff'
                    }}
                    transition={{
                      duration: 0.4,
                      repeat: Infinity,
                      delay: i * 0.04,
                    }}
                    className="w-1.5 bg-accent rounded-full shadow-[0_0_15px_rgba(0,242,255,0.4)]"
                  />
                ))}
              </div>
              <div className="absolute inset-0 border-8 border-accent/5 rounded-full animate-spin-slow" />
              <div className="absolute inset-6 border-2 border-accent/10 rounded-full animate-reverse-spin" />
              <div className="absolute bottom-6 text-[9px] font-mono text-accent font-bold uppercase tracking-[0.3em] animate-pulse">
                Nova Protocol Active
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {activeMedia && activeTab !== 'terminal' && activeTab !== 'media' && (
        <MediaCenter 
          media={activeMedia} 
          onClose={() => setActiveMedia(null)} 
          isMinimized={true}
          setIsMinimized={() => setActiveTab('media')}
        />
      )}
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-mono text-xs transition-all border group",
        active 
          ? "nav-item-active" 
          : "text-slate-400 border-transparent hover:bg-white/5 hover:text-slate-200"
      )}
    >
      <div className={cn(
        "transition-colors",
        active ? "text-accent" : "text-slate-500 group-hover:text-accent/70"
      )}>
        {icon}
      </div>
      <span className="uppercase tracking-[0.15em] font-medium">{label}</span>
    </button>
  );
}

function ScanCard({ title, status, risk }: { title: string, status: string, risk: string }) {
  const statusColors = {
    SECURE: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    VULNERABLE: 'text-red-500 bg-red-500/10 border-red-500/20',
    WARNING: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  };

  return (
    <div className="p-6 glass-card border border-white/5 rounded-2xl relative overflow-hidden group hover:border-accent/30 transition-all">
      <div className="absolute top-0 left-0 w-1 h-full bg-white/5 group-hover:bg-accent/20 transition-colors" />
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-white tracking-tight">{title}</h4>
        <div className={cn(
          "px-3 py-1 rounded-lg text-[9px] font-bold border uppercase tracking-widest",
          statusColors[status as keyof typeof statusColors]
        )}>
          {status}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
          <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Risk Level:</span>
        </div>
        <span className={cn(
          "text-[10px] font-bold font-mono uppercase tracking-widest",
          risk === 'HIGH' ? 'text-red-500' : risk === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'
        )}>{risk}</span>
      </div>
    </div>
  );
}

function AppIcon({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col items-center gap-4 group"
    >
      <div className="w-16 h-16 md:w-20 md:h-20 glass-card rounded-3xl flex items-center justify-center border border-white/10 group-hover:border-accent/50 group-hover:shadow-[0_0_30px_rgba(0,242,255,0.15)] transition-all relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="scale-110 md:scale-125 group-hover:scale-110 transition-transform duration-500">
          {icon}
        </div>
      </div>
      <span className="text-[10px] font-mono text-slate-500 group-hover:text-white uppercase tracking-[0.2em] text-center transition-colors">
        {label}
      </span>
    </motion.button>
  );
}
