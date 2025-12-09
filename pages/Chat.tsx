import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Send, Hash, MoreVertical, AlertCircle, ShieldAlert, Bot, Paperclip, Image as ImageIcon, Loader2, Sparkles, User, X, BadgeCheck } from 'lucide-react';
import { Message, Profile, Friend } from '../types';
import { analyzeToxicity, getGeminiChat } from '../lib/gemini';
import { Chat as GeminiChatType } from '@google/genai';
import { NeonButton, ProfileViewModal } from '../components/UI';

// AI Bot Constant
const AI_BOT_PROFILE: Profile = {
  id: 'ai-bot-giggle-2025',
  username: 'Giggle AI',
  avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=GiggleAI&backgroundColor=b026ff',
  bio: 'Always online. Always helpful. 🤖',
  is_bot: true
};

export const ChatPage = () => {
  const [friends, setFriends] = useState<Profile[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [activeFriend, setActiveFriend] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [friendIsTyping, setFriendIsTyping] = useState(false);
  
  // Profile View Modal
  const [viewProfile, setViewProfile] = useState<Profile | null>(null);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiSessionRef = useRef<GeminiChatType | null>(null);
  const realtimeChannelRef = useRef<any>(null);

  // 1. Initialize User & Global Presence
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setCurrentUser(data.user);
      fetchFriends(data.user.id);

      // Presence Channel (Track who is online)
      const presenceChannel = supabase.channel('global_presence');
      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState();
          const onlineIds = new Set<string>();
          for (const id in state) {
            // @ts-ignore
            const userId = state[id][0]?.user_id;
            if (userId) onlineIds.add(userId);
          }
          setOnlineUsers(onlineIds);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({ 
                user_id: data.user.id, 
                online_at: new Date().toISOString() 
            });
          }
        });

      return () => {
        supabase.removeChannel(presenceChannel);
      };
    };
    init();
  }, []);

  const fetchFriends = async (userId: string) => {
    const { data, error } = await supabase
      .from('friends')
      .select('friend_id, friend:profiles!friends_friend_id_fkey(*)')
      .eq('user_id', userId);
    
    if (error) {
        console.error("Error fetching friends:", error.message);
        if (error.code === 'PGRST205') setErrorMsg("Database tables missing.");
    }

    const realFriends = data ? (data as unknown as Friend[]).map(f => f.friend) : [];
    setFriends([AI_BOT_PROFILE, ...realFriends]);
  };

  // 2. Chat Logic (Messages & Typing)
  useEffect(() => {
    if (!activeFriend || !currentUser) return;
    
    // Reset state for new chat
    setMessages([]);
    setFriendIsTyping(false);

    // --- AI CHAT FLOW ---
    if (activeFriend.is_bot) {
      aiSessionRef.current = getGeminiChat();
      setMessages([{
        id: 'intro-ai',
        sender_id: activeFriend.id,
        receiver_id: currentUser.id,
        content: "Hello! I am Giggle AI. I can generate code, tell jokes, or just chat. What's on your mind?",
        created_at: new Date().toISOString()
      }]);
      return; 
    }

    // --- REALTIME SUPABASE CHAT FLOW ---
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeFriend.id}),and(sender_id.eq.${activeFriend.id},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });
      if (data) setMessages(data as Message[]);
    };
    fetchMessages();

    // Channel for this specific pair
    // We sort IDs to ensure both users join the same room name (e.g. room_userA_userB)
    const channelName = `room_${[currentUser.id, activeFriend.id].sort().join('_')}`;
    const channel = supabase.channel(channelName);
    realtimeChannelRef.current = channel;

    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = payload.new as Message;
        // Only append if it belongs to this conversation AND we don't already have it (optimistic update check)
        // Also ignore our own messages sent via realtime to prevent duplication/lag
        if (newMsg.sender_id === currentUser.id) return;

        const isRelevant = 
            (newMsg.sender_id === activeFriend.id && newMsg.receiver_id === currentUser.id);
            
        if (isRelevant) {
            setMessages((prev) => {
                if (prev.some(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
            });
            // Stop typing indicator if they sent a message
            if (newMsg.sender_id === activeFriend.id) setFriendIsTyping(false);
        }
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
         if (payload.payload.sender_id === activeFriend.id) {
             setFriendIsTyping(true);
             // Auto-hide typing after 3 seconds of silence
             setTimeout(() => setFriendIsTyping(false), 3000);
         }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      realtimeChannelRef.current = null;
    };
  }, [activeFriend, currentUser]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, friendIsTyping]);

  // --- Handlers ---

  const handleTyping = () => {
    if (!activeFriend || activeFriend.is_bot || !realtimeChannelRef.current || !currentUser) return;
    
    if (!isTyping) {
        setIsTyping(true);
        realtimeChannelRef.current.send({
            type: 'broadcast',
            event: 'typing',
            payload: { sender_id: currentUser.id }
        });
        
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 2000);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 500) { 
        alert("File too large. Please select an image under 500KB.");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        await processSendMessage(base64, true);
    };
    reader.readAsDataURL(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processSendMessage = async (content: string, isImage = false) => {
    if ((!content.trim() && !isImage) || !currentUser || !activeFriend || isSending) return;
    setIsSending(true);

    const messageContent = isImage ? `[IMAGE]${content}` : content;
    const tempId = `temp-${Date.now()}`;

    // 1. Optimistic Update (Add to UI immediately)
    // We assume it's NOT toxic initially for speed, but the toxicity analysis will update it.
    const optimisiticMessage: Message = {
        id: tempId,
        content: messageContent,
        sender_id: currentUser.id,
        receiver_id: activeFriend.id,
        created_at: new Date().toISOString(),
        is_toxic: false
    };
    setMessages(prev => [...prev, optimisiticMessage]);
    setNewMessage(''); // Clear input immediately

    // --- CASE A: AI BOT ---
    if (activeFriend.is_bot) {
        try {
            setFriendIsTyping(true);
            setIsSending(false); // Unlock input for bot immediately
            
            // Generate Response
            let responseText = "Thinking...";
            if (aiSessionRef.current) {
                const prompt = isImage ? "I sent you an image." : content;
                const result = await aiSessionRef.current.sendMessage({ message: prompt });
                responseText = result.text || "I cannot reply right now.";
            }

            const aiMsgObj: Message = {
                id: `ai-${Date.now()}`,
                content: responseText,
                sender_id: activeFriend.id,
                receiver_id: currentUser.id,
                created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, aiMsgObj]);
        } catch (err) {
            console.error("AI Error", err);
        } finally {
            setFriendIsTyping(false);
        }
        return;
    }

    // --- CASE B: REAL USER (Supabase) ---
    // Perform async analysis and send
    (async () => {
        let isToxic = false;
        
        // Analyze text messages
        if (!isImage) {
           try {
              const analysis = await analyzeToxicity(messageContent);
              if (analysis.score > 50) isToxic = true;
           } catch (e) {
              console.warn("Toxicity check failed, proceeding safely.");
           }
        }

        // Update local state if identified as toxic
        if (isToxic) {
             setMessages(prev => prev.map(m => m.id === tempId ? { ...m, is_toxic: true } : m));
        }

        const insertPayload: any = {
          content: messageContent,
          sender_id: currentUser.id,
          receiver_id: activeFriend.id,
          is_toxic: isToxic
        };

        let { data, error } = await supabase.from('messages').insert(insertPayload).select().single();
        
        // --- RETRY LOGIC FOR SCHEMA MISMATCH ---
        // If error is related to missing 'is_toxic' column
        if (error && (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('is_toxic'))) {
            
            // SECURITY BLOCK: If content is toxic, we CANNOT retry without the flag.
            if (isToxic) {
                console.error("Blocked toxic message due to missing schema support.");
                alert("Message Blocked: Content identified as toxic. \n\n(System Note: Database schema update required to log this event properly. Please run db_setup.sql)");
                // Remove failed message from UI
                setMessages(prev => prev.filter(m => m.id !== tempId));
                setIsSending(false);
                return; 
            }

            // If content is SAFE, retry without the flag so chat keeps working
            console.warn("Retrying safe message without 'is_toxic' column...");
            delete insertPayload.is_toxic;
            const retry = await supabase.from('messages').insert(insertPayload).select().single();
            data = retry.data;
            error = retry.error;
        }

        setIsSending(false);

        if (error) {
            console.error("Send failed:", error);
            // Revert optimistic update on failure
            setMessages(prev => prev.filter(m => m.id !== tempId));
            
            if (error.code === 'PGRST204') {
                alert("Schema Error: Please run db_setup.sql in Supabase to fix the missing 'is_toxic' column.");
            }
        } else if (data) {
            // Replace optimistic ID with real ID
            setMessages(prev => prev.map(m => m.id === tempId ? data : m));
        }
    })();
  };

  // UI Helper: Render Message Bubble
  const renderMessageContent = (content: string, isToxic: boolean | undefined) => {
    if (isToxic) {
        return (
            <div className="flex items-center gap-2 text-red-300 italic opacity-70">
                <ShieldAlert className="w-4 h-4" />
                <span className="blur-[2px] select-none text-xs font-bold tracking-widest">[CONTENT HIDDEN]</span>
            </div>
        );
    }
    if (content.startsWith('[IMAGE]')) {
        const imgSrc = content.replace('[IMAGE]', '');
        return (
            <div className="mt-1 mb-1 group relative">
                <img 
                    src={imgSrc} 
                    alt="Shared" 
                    onLoad={() => messagesEndRef.current?.scrollIntoView()}
                    className="max-w-full rounded-lg max-h-64 object-cover border border-white/10 shadow-lg cursor-pointer transition-transform hover:scale-[1.02]" 
                />
            </div>
        );
    }
    return <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{content}</p>;
  };

  if (errorMsg) {
      return (
          <div className="flex items-center justify-center h-full">
              <div className="text-center p-6 border border-red-500/50 bg-red-500/10 rounded-xl">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                  <p className="text-red-200">{errorMsg}</p>
              </div>
          </div>
      );
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#050510] relative">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
         <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-neon-purple/5 rounded-full blur-[100px]" />
         <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-neon-blue/5 rounded-full blur-[100px]" />
      </div>

      {/* --- Sidebar (Friends List) --- */}
      <div className={`w-80 glass-panel border-r border-white/5 flex flex-col z-10 ${activeFriend ? 'hidden md:flex' : 'flex w-full'}`}>
        <div className="p-5 border-b border-white/5 bg-black/20 backdrop-blur-md">
          <h2 className="text-lg font-display font-bold text-white tracking-wide flex items-center gap-2">
            <Hash className="w-4 h-4 text-neon-blue" />
            Active Channels
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {friends.length === 0 ? (
            <div className="text-gray-500 text-center mt-10 p-4 animate-pulse">
              <Loader2 className="w-8 h-8 mx-auto mb-2 opacity-50 animate-spin" />
              <p className="text-xs tracking-widest uppercase">Syncing Network...</p>
            </div>
          ) : (
            friends.map((friend) => {
              // Determine Online Status
              const isOnline = friend.is_bot || onlineUsers.has(friend.id);

              return (
                <button
                  key={friend.id}
                  onClick={() => setActiveFriend(friend)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                    activeFriend?.id === friend.id
                      ? 'bg-gradient-to-r from-neon-purple/20 to-transparent border border-neon-purple/40'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="relative">
                    <img 
                        src={friend.avatar_url || 'https://picsum.photos/50'} 
                        alt={friend.username} 
                        className={`w-12 h-12 rounded-full border-2 object-cover transition-transform group-hover:scale-105 ${
                            friend.is_bot ? 'border-neon-purple' : isOnline ? 'border-green-400' : 'border-gray-600'
                        }`} 
                    />
                    {/* Status Dot */}
                    {friend.is_bot ? (
                      <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-0.5 z-10">
                         <Bot className="w-4 h-4 text-neon-purple" />
                      </div>
                    ) : (
                      <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#050510] ${
                          isOnline ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-gray-500'
                      }`} />
                    )}
                  </div>

                  <div className="text-left flex-1 min-w-0 z-10">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className={`font-bold text-sm truncate ${friend.is_bot ? 'text-neon-purple drop-shadow-[0_0_5px_rgba(176,38,255,0.5)]' : 'text-white'}`}>
                          {friend.username}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] uppercase tracking-wider font-medium ${isOnline ? 'text-green-400' : 'text-gray-600'}`}>
                            {isOnline ? 'Online' : 'Offline'}
                        </span>
                        {activeFriend?.id === friend.id && friendIsTyping && (
                            <span className="text-[10px] text-neon-blue animate-pulse ml-auto">typing...</span>
                        )}
                    </div>
                  </div>
                  
                  {/* Hover Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* --- Main Chat Area --- */}
      {activeFriend ? (
        <div className="flex-1 flex flex-col relative z-10 bg-black/40 backdrop-blur-sm">
          {/* Header */}
          <div 
             className="glass-panel p-4 flex justify-between items-center border-b border-white/5 shadow-lg z-20 cursor-pointer hover:bg-white/5 transition-colors"
             onClick={() => setViewProfile(activeFriend)}
          >
            <div className="flex items-center gap-4">
              <button onClick={(e) => { e.stopPropagation(); setActiveFriend(null); }} className="md:hidden p-2 hover:bg-white/10 rounded-full text-gray-400">
                ←
              </button>
              <div className="relative">
                 <img src={activeFriend.avatar_url} className="w-10 h-10 rounded-full border border-white/10" alt="av" />
                 {(activeFriend.is_bot || onlineUsers.has(activeFriend.id)) && (
                     <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full animate-pulse" />
                 )}
              </div>
              <div>
                <h3 className="font-bold flex items-center gap-2 text-white">
                    {activeFriend.username}
                    {activeFriend.is_bot && <Sparkles className="w-3 h-3 text-neon-purple" />}
                </h3>
                <span className={`text-xs flex items-center gap-1.5 ${
                    activeFriend.is_bot || onlineUsers.has(activeFriend.id) ? 'text-neon-blue' : 'text-gray-500'
                }`}>
                    {activeFriend.is_bot || onlineUsers.has(activeFriend.id) ? (
                        <>● Signal Strong</>
                    ) : (
                        <>○ Signal Lost</>
                    )}
                </span>
              </div>
            </div>
            <MoreVertical className="text-gray-500 cursor-pointer hover:text-white transition-colors" />
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar">
            {messages.map((msg, index) => {
              const isMe = msg.sender_id === currentUser?.id;
              // @ts-ignore
              const isToxic = msg.is_toxic;
              const showTime = index === 0 || (new Date(msg.created_at).getTime() - new Date(messages[index - 1].created_at).getTime() > 300000);

              return (
                <div key={msg.id || index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {showTime && (
                      <div className="w-full text-center my-4">
                          <span className="text-[10px] text-gray-600 bg-black/20 px-2 py-1 rounded-full border border-white/5">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </span>
                      </div>
                  )}
                  
                  <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} group max-w-[85%] md:max-w-[70%]`}>
                    <div
                      className={`px-5 py-3 rounded-2xl relative shadow-lg transition-all duration-300 animate-message-in ${
                        isMe
                          ? 'bg-gradient-to-br from-neon-purple to-violet-700 text-white rounded-tr-sm shadow-[0_4px_15px_rgba(176,38,255,0.3)]'
                          : 'bg-[#1a1a2e] text-gray-100 rounded-tl-sm border border-white/10 hover:border-white/20'
                      }`}
                    >
                      {renderMessageContent(msg.content, isToxic)}
                    </div>
                  </div>
                  
                  {/* Status / Timestamp on hover */}
                  <span className={`text-[10px] text-gray-500 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                    {isMe ? 'Delivered' : ''}
                  </span>
                </div>
              );
            })}
            
            {/* Typing Indicator */}
            {friendIsTyping && (
                <div className="flex justify-start animate-message-in">
                    <div className="bg-[#1a1a2e] border border-white/10 px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1.5 items-center shadow-lg">
                        <div className="w-1.5 h-1.5 bg-neon-blue rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-neon-blue rounded-full animate-bounce delay-100" />
                        <div className="w-1.5 h-1.5 bg-neon-blue rounded-full animate-bounce delay-200" />
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 glass-panel border-t border-white/5 relative z-20">
            <div className="flex gap-3 items-end max-w-5xl mx-auto">
              
              {/* File Upload */}
              <input 
                 type="file" 
                 accept="image/*" 
                 className="hidden" 
                 ref={fileInputRef}
                 onChange={handleImageUpload}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending}
                className="p-3 mb-1 rounded-full bg-white/5 text-gray-400 hover:text-neon-blue hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <ImageIcon className="w-5 h-5" />
              </button>

              {/* Text Input */}
              <div className="flex-1 relative">
                <textarea
                    value={newMessage}
                    onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            processSendMessage(newMessage);
                        }
                    }}
                    placeholder={isSending ? "Transmitting..." : activeFriend.is_bot ? "Ask Giggle AI..." : "Message..."}
                    disabled={isSending}
                    rows={1}
                    className="w-full bg-slate-800/80 border border-white/10 rounded-2xl pl-5 pr-12 py-3.5 text-white focus:outline-none focus:border-neon-purple focus:shadow-[0_0_15px_rgba(176,38,255,0.2)] transition-all placeholder-gray-500 disabled:opacity-50 resize-none min-h-[50px] custom-scrollbar"
                />
              </div>

              {/* Send Button */}
              <button
                onClick={() => processSendMessage(newMessage)}
                disabled={(!newMessage.trim() && !isSending) || isSending}
                className={`mb-1 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-[0_0_20px_rgba(176,38,255,0.4)] ${
                    (!newMessage.trim() && !isSending)
                    ? 'bg-gray-700 opacity-50 cursor-not-allowed shadow-none' 
                    : 'bg-gradient-to-tr from-neon-purple to-neon-blue hover:scale-105 active:scale-95'
                }`}
              >
                {isSending ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <Send className="w-5 h-5 text-white ml-0.5" />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="hidden md:flex flex-1 flex-col items-center justify-center text-gray-500 opacity-60 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
          <div className="w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full flex items-center justify-center mb-6 border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] animate-pulse-slow">
            <Hash className="w-12 h-12 text-neon-blue" />
          </div>
          <h2 className="text-3xl font-display font-bold text-white mb-2">GiggleChat // Hub</h2>
          <p className="max-w-md text-center text-sm">Select a user from the neural network to establish a secure connection.</p>
        </div>
      )}

      {/* Profile Viewer Modal */}
      {viewProfile && (
        <ProfileViewModal 
            user={viewProfile} 
            isOnline={viewProfile.is_bot || onlineUsers.has(viewProfile.id)}
            onClose={() => setViewProfile(null)} 
        />
      )}
    </div>
  );
};