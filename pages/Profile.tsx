import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { GlassCard, GlassInput, NeonButton } from '../components/UI';
import { Profile } from '../types';
import { Camera, Save, User, X, ZoomIn, Check } from 'lucide-react';

// --- Image Cropper Component ---
const CropModal = ({ 
  imgSrc, 
  onCancel, 
  onSave 
}: { 
  imgSrc: string; 
  onCancel: () => void; 
  onSave: (base64: string) => void; 
}) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setOffset({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleCrop = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = imgRef.current;
    if (!ctx || !img) return;

    // Set output size (e.g., 300x300 for profile)
    const size = 300;
    canvas.width = size;
    canvas.height = size;

    // Draw background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);

    // Calculate source rectangle
    // The viewbox is 256x256. The image is scaled by 'zoom'.
    // We need to map the visible area of the image in the DOM to the canvas.
    // Simplification: Draw image centered with transforms.
    
    const scale = zoom;
    ctx.translate(size / 2, size / 2);
    ctx.translate(offset.x, offset.y); // Apply user pan
    ctx.scale(scale, scale);
    
    // Draw image centered
    // We maintain aspect ratio
    const aspect = img.naturalWidth / img.naturalHeight;
    let drawW = size;
    let drawH = size;
    if (aspect > 1) drawH = size / aspect;
    else drawW = size * aspect;

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

    // Export
    const base64 = canvas.toDataURL('image/jpeg', 0.8); // Compress quality 0.8
    onSave(base64);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <GlassCard className="w-full max-w-md flex flex-col items-center">
        <h3 className="text-xl font-bold text-white mb-4">Adjust Profile Photo</h3>
        
        {/* Crop Area */}
        <div 
          className="relative w-64 h-64 bg-black rounded-full overflow-hidden border-4 border-neon-purple shadow-[0_0_30px_rgba(176,38,255,0.3)] cursor-move"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        >
          <img 
            ref={imgRef}
            src={imgSrc}
            alt="Crop"
            draggable={false}
            className="absolute max-w-none origin-center transition-transform duration-75 ease-out select-none"
            style={{
              transform: `translate(-50%, -50%) translate(${128 + offset.x}px, ${128 + offset.y}px) scale(${zoom})`,
              left: '0',
              top: '0'
            }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">Drag to pan • Slider to zoom</p>

        {/* Controls */}
        <div className="w-full px-8 mt-6">
          <div className="flex items-center gap-3">
             <ZoomIn className="w-4 h-4 text-gray-400" />
             <input 
               type="range" 
               min="1" 
               max="5" 
               step="0.1" 
               value={zoom}
               onChange={(e) => setZoom(parseFloat(e.target.value))}
               className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-neon-purple"
             />
          </div>
        </div>

        <div className="flex gap-4 mt-8 w-full">
           <NeonButton variant="ghost" onClick={onCancel} className="flex-1">
             <X className="w-4 h-4" /> Cancel
           </NeonButton>
           <NeonButton onClick={handleCrop} className="flex-1" glow>
             <Check className="w-4 h-4" /> Save Photo
           </NeonButton>
        </div>
      </GlassCard>
    </div>
  );
};

export const ProfilePage = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Cropper State
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    setImageError(false);
  }, [profile?.avatar_url]);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    
    if (data) {
        setProfile(data as Profile);
    } else {
        setProfile({
            id: user.id,
            username: user.user_metadata?.username || 'User',
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
            bio: 'New to GiggleChat!',
            updated_at: new Date().toISOString()
        });
        if (error) console.warn("Could not fetch database profile, using fallback.", error);
    }
  };

  const handleUpdate = async () => {
    if (!profile) return;
    setLoading(true);
    
    const { error } = await supabase
      .from('profiles')
      .upsert({ 
          id: profile.id,
          username: profile.username, 
          bio: profile.bio, 
          avatar_url: profile.avatar_url,
          updated_at: new Date().toISOString()
      });
      
    setLoading(false);
    
    if (error) {
        alert('Error updating profile: ' + error.message);
    } else {
        alert('Profile Identity Updated');
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.onload = () => setSelectedFile(reader.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleCropSave = (base64: string) => {
    if (profile) {
        setProfile({ ...profile, avatar_url: base64 });
    }
    setSelectedFile(null); // Close modal
  };

  if (!profile) return <div className="p-8 text-neon-blue animate-pulse">Loading Identity...</div>;

  return (
    <div className="h-full flex items-center justify-center p-4 overflow-y-auto">
      {selectedFile && (
        <CropModal 
          imgSrc={selectedFile} 
          onCancel={() => setSelectedFile(null)} 
          onSave={handleCropSave} 
        />
      )}

      <GlassCard className="w-full max-w-2xl my-auto" glow>
        <div className="flex flex-col items-center mb-8">
          <div className="relative group cursor-pointer w-32 h-32">
            {imageError || !profile.avatar_url ? (
              <div className="w-full h-full rounded-full border-4 border-neon-purple bg-white/5 flex items-center justify-center shadow-[0_0_20px_rgba(176,38,255,0.4)]">
                 <User className="w-16 h-16 text-neon-purple opacity-50" />
              </div>
            ) : (
              <img 
                src={profile.avatar_url} 
                onError={() => setImageError(true)}
                alt="Profile" 
                className="w-full h-full rounded-full border-4 border-neon-purple object-cover shadow-[0_0_20px_rgba(176,38,255,0.4)] bg-black/50"
              />
            )}
            
            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm border-4 border-transparent">
               <Camera className="text-white w-8 h-8" />
               <span className="absolute bottom-6 text-[10px] text-gray-200 font-bold uppercase tracking-wider">Change</span>
            </div>
            
            <input 
              type="file" 
              accept="image/*"
              className="absolute inset-0 opacity-0 cursor-pointer z-10" 
              onChange={onFileSelect} 
            />
          </div>
          
          <h1 className="mt-4 text-2xl font-display font-bold">{profile.username}</h1>
          <p className="text-gray-400 text-sm">ID: {profile.id.slice(0, 8)}...</p>
        </div>

        <div className="space-y-6">
          <GlassInput 
            label="Codename (Username)"
            value={profile.username}
            onChange={(e) => setProfile({ ...profile, username: e.target.value })}
          />
          
          {/* We hide the URL input if the user uploaded a base64 image to avoid clutter, 
              but keep it if they want to paste a URL manually (and haven't uploaded). */}
          {(!profile.avatar_url || profile.avatar_url.startsWith('http')) && (
             <div className="w-full">
                <label className="block text-xs font-display tracking-widest text-cyan-400 mb-2 uppercase">Or Paste Avatar Link</label>
                <input 
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-neon-blue focus:outline-none"
                value={profile.avatar_url}
                onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })}
                placeholder="https://..."
                />
             </div>
          )}

          <div className="w-full">
            <label className="block text-xs font-display tracking-widest text-cyan-400 mb-2 uppercase">Bio Data</label>
            <textarea 
               className="w-full h-24 bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-neon-blue focus:outline-none resize-none"
               value={profile.bio}
               onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            />
          </div>

          <NeonButton onClick={handleUpdate} isLoading={loading} className="w-full" glow>
            <Save className="w-4 h-4" /> Save Profile
          </NeonButton>
        </div>
      </GlassCard>
    </div>
  );
};