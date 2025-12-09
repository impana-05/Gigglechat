import React from 'react';
import { Link } from 'react-router-dom';
import { NeonButton } from '../components/UI';
import { Zap, Shield, MessageCircle } from 'lucide-react';

export const LandingPage = () => {
  return (
    <div className="min-h-screen bg-[#050510] text-white relative overflow-hidden flex flex-col items-center justify-center">
      
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-purple/30 rounded-full blur-[150px] animate-blob" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-blue/20 rounded-full blur-[150px] animate-blob" style={{ animationDelay: '2s' }} />
      </div>

      <nav className="absolute top-0 w-full p-6 flex justify-between items-center z-20 max-w-7xl">
        <div className="font-display font-bold text-2xl tracking-tighter">GIGGLE<span className="text-neon-blue">CHAT</span></div>
        <Link to="/auth">
          <NeonButton variant="secondary" className="px-6">Login</NeonButton>
        </Link>
      </nav>

      <div className="relative z-10 text-center max-w-4xl px-4">
        <div className="inline-block mb-4 px-4 py-1 rounded-full border border-neon-purple/50 bg-neon-purple/10 backdrop-blur-md">
          <span className="text-neon-purple text-sm font-bold tracking-widest uppercase">The Future of Social is Here</span>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-display font-black leading-tight mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
          CONNECT BEYOND <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple via-neon-pink to-neon-blue">LIMITS</span>
        </h1>

        <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto font-light">
          Experience real-time connection powered by Gemini AI. Safe, smart, and stunningly beautiful.
        </p>

        <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
          <Link to="/auth?mode=signup">
            <NeonButton glow className="w-48 h-14 text-lg">Get Started</NeonButton>
          </Link>
          <a href="#features" className="text-gray-400 hover:text-white transition-colors">Learn More</a>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mt-24 px-4 z-10">
        <div className="glass-panel p-8 rounded-2xl border border-white/5 hover:border-neon-blue/50 transition-colors group">
          <div className="w-12 h-12 rounded-lg bg-neon-blue/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <MessageCircle className="text-neon-blue" />
          </div>
          <h3 className="font-display font-bold text-xl mb-2">Holographic Chat</h3>
          <p className="text-gray-400 text-sm">Real-time messaging with a glassmorphic interface that feels like 2050.</p>
        </div>
        <div className="glass-panel p-8 rounded-2xl border border-white/5 hover:border-neon-purple/50 transition-colors group">
          <div className="w-12 h-12 rounded-lg bg-neon-purple/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Zap className="text-neon-purple" />
          </div>
          <h3 className="font-display font-bold text-xl mb-2">Giggle AI Core</h3>
          <p className="text-gray-400 text-sm">Powered by Gemini 2.5 Flash. Your smart assistant for conversation and creativity.</p>
        </div>
        <div className="glass-panel p-8 rounded-2xl border border-white/5 hover:border-red-500/50 transition-colors group">
          <div className="w-12 h-12 rounded-lg bg-red-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Shield className="text-red-400" />
          </div>
          <h3 className="font-display font-bold text-xl mb-2">Anti-Toxicity Shield</h3>
          <p className="text-gray-400 text-sm">Keep your vibes clean. Our AI analyzes and flags toxic content instantly.</p>
        </div>
      </div>
    </div>
  );
};
