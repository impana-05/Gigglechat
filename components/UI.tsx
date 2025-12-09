import React from 'react';
import { Loader2, X, User, Calendar } from 'lucide-react';
import { Profile } from '../types';

// --- Types ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  isLoading?: boolean;
  glow?: boolean;
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

// --- Components ---

export const NeonButton: React.FC<ButtonProps> = ({ 
  children, variant = 'primary', isLoading, glow = false, className, ...props 
}) => {
  const baseStyles = "relative px-6 py-3 rounded-xl font-bold font-sans transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden group";
  
  const variants = {
    primary: "bg-gradient-to-r from-neon-purple to-neon-blue text-white hover:shadow-[0_0_20px_rgba(176,38,255,0.6)] border border-transparent hover:border-white/20",
    secondary: "bg-white/5 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 hover:border-white/30",
    danger: "bg-red-500/20 text-red-200 border border-red-500/50 hover:bg-red-500/30 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]",
    ghost: "bg-transparent text-gray-400 hover:text-white hover:bg-white/5"
  };

  const glowEffect = glow ? "animate-pulse-slow shadow-[0_0_15px_rgba(0,243,255,0.3)]" : "";

  return (
    <button className={`${baseStyles} ${variants[variant]} ${glowEffect} ${className || ''}`} {...props}>
      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : children}
      {/* Glossy sheen effect */}
      <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </button>
  );
};

export const GlassInput: React.FC<InputProps> = ({ label, className, ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-xs font-display tracking-widest text-cyan-400 mb-2 uppercase">{label}</label>}
      <input 
        className={`w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue focus:shadow-[0_0_10px_rgba(0,243,255,0.2)] transition-all duration-300 ${className || ''}`}
        {...props}
      />
    </div>
  );
};

export const GlassCard: React.FC<CardProps> = ({ children, className, glow }) => {
  return (
    <div className={`glass-panel rounded-2xl p-6 ${glow ? 'shadow-[0_0_30px_rgba(176,38,255,0.15)] border-neon-purple/30' : ''} ${className || ''}`}>
      {children}
    </div>
  );
};

export const Badge: React.FC<{ children: React.ReactNode, color?: string }> = ({ children, color = "bg-neon-purple" }) => (
  <span className={`${color} text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-lg`}>
    {children}
  </span>
);

export const ProfileViewModal: React.FC<{ user: Profile, isOnline: boolean, onClose: () => void }> = ({ user, isOnline, onClose }) => {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
        <div className="relative w-full max-w-sm glass-panel rounded-2xl p-6 border border-white/10 shadow-[0_0_50px_rgba(176,38,255,0.2)]" onClick={e => e.stopPropagation()}>
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex flex-col items-center">
            <div className="relative mb-4 group">
              <img 
                src={user.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${user.username}`} 
                alt={user.username} 
                className="w-24 h-24 rounded-full border-4 border-neon-purple/30 object-cover bg-black/50 shadow-lg"
              />
              <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-4 border-[#0a0a16] ${isOnline ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-gray-500'}`} />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-1 font-display tracking-wide">{user.username}</h2>
            {user.is_bot && <span className="bg-neon-purple/20 text-neon-purple text-[10px] px-2 py-0.5 rounded border border-neon-purple/30 uppercase tracking-widest mb-3">AI Bot</span>}
            
            <p className="text-gray-400 text-sm text-center mb-6 line-clamp-3 leading-relaxed">
              {user.bio || "No bio available."}
            </p>
            
            <div className="w-full space-y-3">
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                <div className="p-2 bg-neon-blue/10 rounded-lg text-neon-blue">
                  <User className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">User Identity</div>
                  <div className="text-xs font-mono text-gray-300 truncate" title={user.id}>{user.id}</div>
                </div>
              </div>
              
              {user.updated_at && (
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                  <div className="p-2 bg-neon-purple/10 rounded-lg text-neon-purple">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Last Sync</div>
                    <div className="text-sm text-gray-300">{new Date(user.updated_at).toLocaleDateString()}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
};