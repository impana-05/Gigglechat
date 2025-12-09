import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { GlassCard, GlassInput, NeonButton, Badge } from '../components/UI';
import { UserPlus, Check, X, Search, Users, User, AlertTriangle, RefreshCw, AlertCircle } from 'lucide-react';
import { Profile, FriendRequest, Friend } from '../types';

export const FriendsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [dbError, setDbError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Track IDs of requests currently being processed (for animation)
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());
  
  // Track sending status for specific users
  const [sendingRequests, setSendingRequests] = useState<Set<string>>(new Set());
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  // Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    requestId: string;
    senderId: string;
    action: 'accepted' | 'rejected';
    username: string;
  } | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUserId(data.user.id);
        loadData(data.user.id);
      }
    };
    init();
  }, []);

  const loadData = async (uid: string) => {
    setIsRefreshing(true);
    await Promise.all([fetchRequests(uid), fetchFriends(uid)]);
    setIsRefreshing(false);
  };

  // Real-time: Listen for incoming requests
  useEffect(() => {
    if (!userId) return;

    const requestChannel = supabase
      .channel('friend_requests_realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'friend_requests',
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          fetchRequests(userId);
        }
      )
      .subscribe();
      
    const friendChannel = supabase
      .channel('friends_realtime')
      .on(
        'postgres_changes',
        {
            event: 'INSERT',
            schema: 'public',
            table: 'friends',
            filter: `user_id=eq.${userId}`
        },
        () => {
            fetchFriends(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(requestChannel);
      supabase.removeChannel(friendChannel);
    };
  }, [userId]);

  const fetchRequests = async (uid: string) => {
    const { data, error } = await supabase
      .from('friend_requests')
      .select('*, sender:profiles!friend_requests_sender_id_fkey(*)')
      .eq('receiver_id', uid)
      .eq('status', 'pending');
    
    if (error) {
        console.error("Fetch Request Error:", error.message);
        if (error.code === 'PGRST205') setDbError(true);
    }
    if (data) setRequests(data as FriendRequest[]);
  };

  const fetchFriends = async (uid: string) => {
    const { data, error } = await supabase
      .from('friends')
      .select('friend_id, friend:profiles!friends_friend_id_fkey(*)')
      .eq('user_id', uid);
    
    if (error) {
        console.error("Fetch Friends Error:", error.message);
        if (error.code === 'PGRST205') setDbError(true);
    }
    if (data) setFriends(data as unknown as Friend[]);
  };

  const handleSearch = async () => {
    if (!searchTerm) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${searchTerm}%`)
      .neq('id', userId)
      .limit(5);
    
    if (error) {
        console.error("Search Error:", error.message);
        if (error.code === 'PGRST205') {
           setDbError(true);
        }
        return;
    }
    
    // Clear sent states on new search
    setSentRequests(new Set());
    
    if (data) setSearchResults(data as Profile[]);
  };

  const sendRequest = async (receiverId: string) => {
    setSendingRequests(prev => new Set(prev).add(receiverId));
    
    const { error } = await supabase.from('friend_requests').insert({
      sender_id: userId,
      receiver_id: receiverId,
      status: 'pending'
    });
    
    setSendingRequests(prev => {
        const next = new Set(prev);
        next.delete(receiverId);
        return next;
    });
    
    if (error) {
        alert("Error sending request: " + error.message);
    } else {
        // Mark as sent to trigger animation
        setSentRequests(prev => new Set(prev).add(receiverId));
    }
  };

  const initiateRequestAction = (req: FriendRequest, action: 'accepted' | 'rejected') => {
    setConfirmDialog({
      requestId: req.id,
      senderId: req.sender_id,
      action: action,
      username: req.sender?.username || 'Unknown Agent'
    });
  };

  const executeRequest = async () => {
    if (!confirmDialog) return;
    const { requestId, senderId, action } = confirmDialog;
    
    // Close dialog
    setConfirmDialog(null);

    // 1. Mark as processing to trigger exit animation
    setProcessingRequests(prev => new Set(prev).add(requestId));

    // 2. Perform DB operations in background
    const dbOperation = async () => {
        const { error: reqError } = await supabase
        .from('friend_requests')
        .update({ status: action })
        .eq('id', requestId);

        if (reqError) {
            console.error("Error updating request:", reqError.message);
            return false;
        }

        if (action === 'accepted') {
            const { error: friendError } = await supabase.from('friends').insert([
                { user_id: userId, friend_id: senderId },
                { user_id: senderId, friend_id: userId }
            ]);
            if (friendError) console.error("Error creating friendship:", friendError.message);
            await fetchFriends(userId);
        }
        return true;
    };

    // 3. Wait for animation (500ms) AND DB op
    const [success] = await Promise.all([
        dbOperation(),
        new Promise(resolve => setTimeout(resolve, 500))
    ]);

    // 4. Remove from UI state
    if (success) {
        setRequests(prev => prev.filter(r => r.id !== requestId));
    } else {
        // If failed, remove from processing so it stays visible
        alert("Failed to process request");
    }

    setProcessingRequests(prev => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
    });
  };

  if (dbError) {
      return (
          <div className="p-8 max-w-4xl mx-auto">
              <div className="bg-red-500/20 border border-red-500 p-6 rounded-xl text-center animate-pulse">
                  <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-white mb-2">Database Connection Failed</h2>
                  <p className="text-red-200 mb-4">The required tables do not exist in your Supabase project.</p>
                  <div className="bg-black/40 p-4 rounded text-left overflow-x-auto text-xs font-mono text-green-400">
                    -- Copy and Run this in Supabase SQL Editor --<br/>
                    1. Go to Supabase Dashboard &gt; SQL Editor<br/>
                    2. Paste the content of db_setup.sql<br/>
                    3. Click RUN
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="h-full p-6 md:p-8 max-w-6xl mx-auto overflow-y-auto relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h1 className="text-3xl font-display font-bold">Network Manager</h1>
        <button 
            onClick={() => userId && loadData(userId)}
            className={`p-2 rounded-lg bg-white/5 hover:bg-white/10 text-neon-blue transition-all ${isRefreshing ? 'animate-spin' : ''}`}
            title="Force Refresh"
        >
            <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Search & Requests */}
        <div className="space-y-8">
            {/* Search Section */}
            <GlassCard>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <UserPlus className="text-neon-purple" /> Find Agents
            </h2>
            <div className="flex gap-2 mb-4">
                <GlassInput 
                placeholder="Search by username..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
                <NeonButton onClick={handleSearch} className="px-6"><Search className="w-5 h-5" /></NeonButton>
            </div>
            
            <div className="space-y-2">
                {searchResults.map(user => {
                  const isSending = sendingRequests.has(user.id);
                  const isSent = sentRequests.has(user.id);
                  
                  return (
                    <div key={user.id} className="flex justify-between items-center p-3 bg-white/5 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center gap-3">
                        <img src={user.avatar_url} className="w-10 h-10 rounded-full" alt="av" />
                        <span>{user.username}</span>
                        </div>
                        <NeonButton 
                            variant="secondary" 
                            isLoading={isSending}
                            onClick={() => sendRequest(user.id)} 
                            disabled={isSending || isSent}
                            className={`text-xs py-2 px-3 transition-all duration-500 transform ${
                                isSent 
                                    ? '!bg-green-500/20 !text-green-400 !border-green-500/50 shadow-[0_0_15px_rgba(74,222,128,0.4)] scale-105' 
                                    : ''
                            }`}
                        >
                            {isSent ? (
                                <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Sent</span>
                            ) : 'Add Friend'}
                        </NeonButton>
                    </div>
                  );
                })}
            </div>
            </GlassCard>

            {/* Requests Section */}
            <GlassCard>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${requests.length > 0 ? 'bg-neon-pink animate-pulse' : 'bg-gray-600'}`} />
                Incoming Signals
                {requests.length > 0 && (
                <Badge color="bg-neon-pink shadow-[0_0_10px_#ff00ff] animate-pulse">{requests.length} NEW</Badge>
                )}
            </h2>
            {requests.length === 0 ? (
                <p className="text-gray-500 text-sm">No pending requests.</p>
            ) : (
                <div className="space-y-3 overflow-hidden">
                {requests.map(req => (
                    <div 
                      key={req.id} 
                      className={`
                        flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/10 
                        hover:border-white/20 transition-all duration-500 ease-out transform
                        ${processingRequests.has(req.id) ? 'opacity-0 translate-x-20 scale-95' : 'opacity-100 translate-x-0'}
                      `}
                    >
                    <div className="flex items-center gap-3">
                        <img src={req.sender?.avatar_url} className="w-12 h-12 rounded-full border border-white/10" alt="av" />
                        <div>
                        <div className="font-bold">{req.sender?.username}</div>
                        <div className="text-xs text-gray-400">Wants to connect</div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button 
                        onClick={() => initiateRequestAction(req, 'accepted')}
                        className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 border border-green-500/50 transition-colors"
                        title="Accept"
                        disabled={processingRequests.has(req.id)}
                        >
                        <Check className="w-5 h-5" />
                        </button>
                        <button 
                        onClick={() => initiateRequestAction(req, 'rejected')}
                        className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 border border-red-500/50 transition-colors"
                        title="Reject"
                        disabled={processingRequests.has(req.id)}
                        >
                        <X className="w-5 h-5" />
                        </button>
                    </div>
                    </div>
                ))}
                </div>
            )}
            </GlassCard>
        </div>

        {/* Right Column: Existing Friends */}
        <div className="h-full">
            <GlassCard className="h-full flex flex-col">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Users className="text-neon-blue" /> Your Network
                    <span className="text-xs text-gray-500 ml-2 font-normal">({friends.length} connected)</span>
                </h2>
                
                {friends.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 min-h-[200px]">
                        <User className="w-12 h-12 mb-3 opacity-20" />
                        <p>Network empty.</p>
                        <p className="text-xs">Search for agents to begin.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-min">
                        {friends.map(f => (
                            <div key={f.friend.id} className="p-4 bg-gradient-to-br from-white/5 to-transparent rounded-2xl border border-white/5 hover:border-neon-blue/30 transition-all flex items-center gap-4 group animate-in fade-in zoom-in duration-300">
                                <div className="relative">
                                    <img src={f.friend.avatar_url} className="w-12 h-12 rounded-full object-cover" alt={f.friend.username} />
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#050510]" />
                                </div>
                                <div className="overflow-hidden">
                                    <h3 className="font-bold text-white group-hover:text-neon-blue transition-colors truncate">{f.friend.username}</h3>
                                    <p className="text-xs text-gray-400 truncate">{f.friend.bio}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </GlassCard>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <GlassCard className="max-w-md w-full border-neon-purple/50 shadow-[0_0_50px_rgba(176,38,255,0.2)]" glow>
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 font-display">
                    {confirmDialog.action === 'accepted' ? (
                        <UserPlus className="text-green-400" />
                    ) : (
                        <AlertCircle className="text-red-400" />
                    )}
                    CONFIRM ACTION
                </h3>
                <p className="text-gray-300 mb-8 leading-relaxed">
                    Are you sure you want to <span className={confirmDialog.action === 'accepted' ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                        {confirmDialog.action === 'accepted' ? 'ACCEPT' : 'REJECT'}
                    </span> the connection signal from <span className="text-white font-bold">{confirmDialog.username}</span>?
                </p>
                <div className="flex justify-end gap-3">
                    <NeonButton variant="ghost" onClick={() => setConfirmDialog(null)}>Cancel</NeonButton>
                    <NeonButton 
                        variant={confirmDialog.action === 'accepted' ? 'primary' : 'danger'}
                        onClick={executeRequest}
                        glow
                    >
                        {confirmDialog.action === 'accepted' ? 'Confirm Connection' : 'Reject Signal'}
                    </NeonButton>
                </div>
            </GlassCard>
        </div>
      )}
    </div>
  );
};
