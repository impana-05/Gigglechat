export interface Profile {
  id: string;
  username: string;
  avatar_url: string;
  bio: string;
  updated_at?: string;
  is_bot?: boolean; // New field to distinguish AI
  is_online?: boolean; // UI state
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  sender?: Profile; // Joined data
}

export interface Friend {
  friend_id: string;
  friend: Profile;
}

export interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  is_toxic?: boolean;
}

export interface ChatSession {
  user: Profile;
  lastMessage?: string;
}

export enum ToxicityLabel {
  SAFE = 'Safe',
  LOW_TOXICITY = 'Low Toxicity',
  TOXIC = 'Toxic',
  HIGHLY_TOXIC = 'Highly Toxic'
}

export interface ToxicityResult {
  score: number;
  label: ToxicityLabel;
  reason: string;
}