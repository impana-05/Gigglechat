import React, { useState } from 'react';
import { analyzeToxicity } from '../lib/gemini';
import { ToxicityResult, ToxicityLabel } from '../types';
import { GlassCard, NeonButton } from '../components/UI';
import { ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react';

export const AnalyzerPage = () => {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ToxicityResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    const data = await analyzeToxicity(text);
    setResult(data);
    setLoading(false);
  };

  const getScoreColor = (score: number) => {
    if (score < 20) return 'text-green-400';
    if (score < 50) return 'text-yellow-400';
    return 'text-red-500';
  };

  const getRingColor = (score: number) => {
    if (score < 20) return 'stroke-green-500';
    if (score < 50) return 'stroke-yellow-500';
    return 'stroke-red-500';
  };

  return (
    <div className="h-full p-6 md:p-12 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-display font-black mb-2 text-white">TOXICITY SCANNER</h1>
          <p className="text-gray-400">Powered by Gemini AI Semantic Analysis</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Input Section */}
          <GlassCard className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="text-neon-blue" />
              Content Input
            </h2>
            <textarea
              className="w-full h-48 bg-black/20 border border-white/10 rounded-xl p-4 text-white resize-none focus:border-neon-purple focus:outline-none transition-colors"
              placeholder="Paste text here to analyze for toxicity, hate speech, or harassment..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex justify-end">
              <NeonButton onClick={handleAnalyze} isLoading={loading} glow className="w-full md:w-auto">
                Run Analysis
              </NeonButton>
            </div>
          </GlassCard>

          {/* Result Section */}
          <GlassCard className="flex flex-col items-center justify-center relative min-h-[300px]">
            {!result ? (
              <div className="text-center text-gray-500">
                <ShieldAlert className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>Awaiting data stream...</p>
              </div>
            ) : (
              <div className="w-full text-center animate-in fade-in zoom-in duration-500">
                {/* Progress Ring */}
                <div className="relative w-40 h-40 mx-auto mb-6">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="80" cy="80" r="70"
                      stroke="currentColor" strokeWidth="10"
                      fill="transparent"
                      className="text-gray-800"
                    />
                    <circle
                      cx="80" cy="80" r="70"
                      stroke="currentColor" strokeWidth="10"
                      fill="transparent"
                      strokeDasharray={440}
                      strokeDashoffset={440 - (440 * result.score) / 100}
                      className={`${getRingColor(result.score)} transition-all duration-1000 ease-out`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className={`text-3xl font-bold ${getScoreColor(result.score)}`}>{result.score}%</span>
                    <span className="text-xs text-gray-400 uppercase">Toxicity</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className={`text-2xl font-bold ${getScoreColor(result.score)}`}>
                    {result.label.toUpperCase()}
                  </h3>
                  <p className="text-sm text-gray-300 px-4">{result.reason}</p>
                </div>
              </div>
            )}
            
            {loading && (
               <div className="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
                 <div className="text-neon-blue animate-pulse font-display tracking-widest">ANALYZING...</div>
               </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
