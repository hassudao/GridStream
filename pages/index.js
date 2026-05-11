import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, 
  User as UserIcon, ImageIcon, Send, ChevronLeft, Zap, LogOut, Settings, 
  Trash2, MessageSquare, Plus, Type, Check, Palette, Maximize2,
  UserPlus, UserMinus, Bell, MoreVertical, Image as ImageIconLucide, Users, Hash, Shield, Globe, Lock
} from 'lucide-react';

/**
 * --- 定数・ユーティリティ ---
 */
const CLOUDINARY_CLOUD_NAME = 'dtb3jpadj'; 
const CLOUDINARY_UPLOAD_PRESET = 'alpha-sns';

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit' });
};

const isOnline = (lastSeenAt) => {
  if (!lastSeenAt) return false;
  const lastSeen = new Date(lastSeenAt);
  return (new Date() - lastSeen) < 5 * 60 * 1000;
};

const renderContent = (text) => {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const hashRegex = /(#[^\s!@#$%^&*()=+.\/,\[\]{\}]+\b)/g;
  const parts = text.split(/((?:https?:\/\/[^\s]+)|(?:#[^\s!@#$%^&*()=+.\/,\[\]{\}]+\b))/g);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all" onClick={(e) => e.stopPropagation()}>
          {part}
        </a>
      );
    }
    if (part.match(hashRegex)) {
      return <span key={i} className="text-blue-400 font-bold">{part}</span>;
    }
    return part;
  });
};

/**
 * --- メインアプリケーションコンポーネント ---
 */
export default function App() {
  const [view, setView] = useState('home'); 
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]); 
  const [groupedStories, setGroupedStories] = useState({}); 
  const [viewingStory, setViewingStory] = useState(null); 
  const [creatingStory, setCreatingStory] = useState(false);
  const [allProfiles, setAllProfiles] = useState([]);
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [activeProfileId, setActiveProfileId] = useState(null); 
  const [profileInfo, setProfileInfo] = useState(null); 
  const [stats, setStats] = useState({ followers: 0, following: 0, isFollowing: false });
  const [showFollowList, setShowFollowList] = useState(null); 
  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editData, setEditData] = useState({ display_name: '', username: '', bio: '', avatar_url: '', header_url: '' });
  const [myProfile, setMyProfile] = useState({ username: '', display_name: '', bio: '', avatar_url: '', header_url: '' });
  const [newPost, setNewPost] = useState('');
  const [postPreview, setPostPreview] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dmTarget, setDmTarget] = useState(null);
  const [groupTarget, setGroupTarget] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fileInputRef = useRef(null);
  const storyInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const headerInputRef = useRef(null);

  // Auth 監視
  useEffect(() => {
    checkUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) fetchMyProfile(currentUser.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  // 初期データ取得とリアルタイム通知の設定
  useEffect(() => {
    if (user) {
      updateLastSeen();
      fetchMyProfile(user.id);
      fetchData();
      fetchNotifications();
      const interval = setInterval(updateLastSeen, 60000);

      const channel = supabase
        .channel(`public:notifications:receiver_id=eq.${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${user.id}` }, () => fetchNotifications())
        .subscribe();
      return () => { 
        supabase.removeChannel(channel);
        clearInterval(interval);
      };
    }
  }, [user]);

  // ストーリーのグループ化
  useEffect(() => {
    if (stories.length > 0 && allProfiles.length > 0) {
      const grouped = stories.reduce((acc, story) => {
        if (!acc[story.user_id]) acc[story.user_id] = [];
        acc[story.user_id].push(story);
        return acc;
      }, {});
      setGroupedStories(grouped);
    } else {
      setGroupedStories({});
    }
  }, [stories, allProfiles]);

  async function updateLastSeen() {
    if (!user) return;
    await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id);
  }

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) { setUser(session.user); fetchMyProfile(session.user.id); }
  }

  async function fetchMyProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) { setMyProfile(data); setEditData(data); }
  }

  async function fetchData() {
    const { data: postsData } = await supabase
      .from('posts')
      .select(`*, profiles(id, username, display_name, avatar_url, last_seen_at), likes(user_id), comments(id)`)
      .order('created_at', { ascending: false });
    
    if (postsData) {
      const formattedPosts = postsData.map(post => ({
        ...post,
        like_count: post.likes?.length || 0,
        comment_count: post.comments?.length || 0,
        is_liked: user ? post.likes?.some(l => l.user_id === user.id) : false
      }));
      setPosts(formattedPosts);
    }

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: storiesData } = await supabase
      .from('stories')
      .select('*')
      .gt('created_at', yesterday)
      .order('created_at', { ascending: true });
    setStories(storiesData || []);

    const { data: profData } = await supabase.from('profiles').select('*');
    if (profData) setAllProfiles(profData);
  }

  async function fetchNotifications() {
    if (!user) return;
    const { data } = await supabase.from('notifications')
      .select('*, sender:profiles!notifications_sender_id_fkey(*)')
      .eq('receiver_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) { setNotifications(data); setUnreadCount(data.filter(n => !n.is_read).length); }
  }

  async function sendNotification(receiverId, type, postId = null, storyId = null) {
    if (!user || user.id === receiverId) return;
    await supabase.from('notifications').insert([{ sender_id: user.id, receiver_id: receiverId, type: type, post_id: postId, story_id: storyId, is_read: false }]);
  }

  const handleShare = async (post) => {
    const shareData = { title: 'GridStream', text: post.content, url: window.location.origin };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(shareData.url);
        alert('リンクをコピーしました！');
      }
    } catch (err) { console.error('Share error:', err); }
  };

  async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    return data.secure_url;
  }

  const handlePostFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) setPostPreview(URL.createObjectURL(file));
  };

  async function handlePost(e) {
    e.preventDefault();
    if (!newPost.trim() || !user) return;
    setUploading(true);
    let imageUrl = null;
    if (fileInputRef.current?.files[0]) imageUrl = await uploadToCloudinary(fileInputRef.current.files[0]);
    
    const { data } = await supabase.from('posts').insert([{ content: newPost, user_id: user.id, image_url: imageUrl }]).select().single();
    
    if (data) {
      const tags = newPost.match(/#[^\s!@#$%^&*()=+.\/,\[\]{\}]+\b/g);
      if (tags) {
        for (const t of tags) {
          const tagName = t.substring(1);
          const { data: tagObj } = await supabase.from('hashtags').upsert({ tag: tagName }, { onConflict: 'tag' }).select().single();
          if (tagObj) await supabase.from('post_hashtags').insert({ post_id: data.id, hashtag_id: tagObj.id });
        }
      }
      const { data: followers } = await supabase.from('follows').select('follower_id').eq('following_id', user.id);
      if (followers?.length > 0) {
        const notices = followers.map(f => ({ sender_id: user.id, receiver_id: f.follower_id, type: 'post', post_id: data.id }));
        await supabase.from('notifications').insert(notices);
      }
    }
    
    setNewPost(''); 
    setPostPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchData(); 
    setUploading(false);
  }

  async function toggleLike(postId, isLiked) {
    if (!user) return;
    const post = posts.find(p => p.id === postId);
    const updateLogic = (p) => p.id === postId ? { ...p, is_liked: !isLiked, like_count: isLiked ? Math.max(0, p.like_count - 1) : p.like_count + 1 } : p;
    setPosts(prev => prev.map(updateLogic));
    if (selectedPost?.id === postId) setSelectedPost(prev => updateLogic(prev));

    if (isLiked) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id);
    } else {
      await supabase.from('likes').insert([{ post_id: postId, user_id: user.id }]);
      if (post) sendNotification(post.user_id, 'like', postId);
    }
    fetchData();
  }

  const openProfile = async (userId) => {
    setActiveProfileId(userId);
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfileInfo(profile);
    const { count: fers } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId);
    const { count: fing } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId);
    let isFollowing = false;
    if (user && user.id !== userId) {
      const { data } = await supabase.from('follows').select('*').eq('follower_id', user.id).eq('following_id', userId).maybeSingle();
      isFollowing = !!data;
    }
    setStats({ followers: fers || 0, following: fing || 0, isFollowing });
    setView('profile');
  };

  const getAvatar = (name, url) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;

  if (!user) return <div className="flex items-center justify-center min-h-screen bg-black text-white">Loading Auth...</div>;

  return (
    <div className={`max-w-md mx-auto min-h-screen pb-20 font-sans relative shadow-2xl transition-all duration-500 ${darkMode ? 'bg-black text-white' : 'bg-gray-50 text-black'}`}>
      <script src="https://cdn.tailwindcss.com"></script>

      {/* --- Header --- */}
      {view === 'home' && (
        <header className={`sticky top-0 z-40 backdrop-blur-xl border-b p-4 flex justify-between items-center ${darkMode ? 'bg-black/80 border-gray-800' : 'bg-white/80 border-gray-100'}`}>
          <h1 className="text-2xl font-black bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1">
            <Zap size={24} className="text-blue-500 fill-blue-500" /> GridStream
          </h1>
          <div className="flex items-center gap-4">
            <div className="relative cursor-pointer hover:scale-110 transition" onClick={() => { setView('notifications'); }}>
              <Bell size={24} />
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold animate-pulse">{unreadCount}</span>}
            </div>
          </div>
        </header>
      )}

      {/* --- View Content --- */}
      {view === 'home' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Stories */}
          <div className={`p-4 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            <div className="inline-flex flex-col items-center gap-1 cursor-pointer shrink-0" onClick={() => storyInputRef.current.click()}>
              <div className="relative group">
                <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-16 h-16 rounded-full object-cover border-2 border-blue-500 p-0.5 group-hover:scale-105 transition" />
                <div className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-1 border-2 border-black">
                  <Plus size={10} className="text-white" />
                </div>
              </div>
              <span className="text-[10px] font-bold text-gray-500">Your Story</span>
              <input type="file" accept="image/*" ref={storyInputRef} className="hidden" onChange={(e) => setCreatingStory(e.target.files[0])} />
            </div>
            {/* Other stories... */}
          </div>

          {/* New Post Form */}
          <form onSubmit={handlePost} className={`p-4 border-b ${darkMode ? 'border-gray-800' : 'border-white'}`}>
            <div className="flex gap-3">
              <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-10 h-10 rounded-full object-cover" />
              <div className="flex-grow">
                <textarea 
                  className="w-full border-none focus:ring-0 text-lg placeholder-gray-500 resize-none h-auto min-h-[60px] outline-none bg-transparent font-medium" 
                  placeholder="今何してる？" 
                  value={newPost} 
                  onChange={(e) => setNewPost(e.target.value)} 
                />
                {postPreview && (
                  <div className="relative mt-2 rounded-2xl overflow-hidden border border-gray-700">
                    <img src={postPreview} className="w-full h-48 object-cover" />
                    <button onClick={() => setPostPreview(null)} className="absolute top-2 right-2 bg-black/50 p-1 rounded-full"><X size={16}/></button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center pl-12 mt-3">
              <label className="cursor-pointer text-blue-500 hover:bg-blue-500/10 p-2 rounded-full transition">
                <ImageIcon size={22}/>
                <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handlePostFileSelect} />
              </label>
              <button 
                type="submit" 
                disabled={uploading || !newPost.trim()} 
                className={`bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition ${uploading ? 'opacity-50' : ''}`}
              >
                {uploading ? '送信中...' : 'STREAM'}
              </button>
            </div>
          </form>

          {/* Post Feed */}
          <div className="divide-y divide-gray-800">
            {posts.map(post => (
              <div key={post.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => openProfile(post.user_id)}>
                    <img src={getAvatar(post.profiles.username, post.profiles.avatar_url)} className="w-10 h-10 rounded-full object-cover" />
                    <div>
                      <p className="font-bold text-sm leading-none">{post.profiles.display_name}</p>
                      <p className="text-[10px] text-gray-500 mt-1">@{post.profiles.username} • {formatTime(post.created_at)}</p>
                    </div>
                  </div>
                  <MoreVertical size={18} className="text-gray-500" />
                </div>
                <div className="pl-13 text-[15px] leading-relaxed">
                  {renderContent(post.content)}
                </div>
                {post.image_url && (
                  <div className="rounded-2xl overflow-hidden border border-gray-800" onDoubleClick={() => toggleLike(post.id, post.is_liked)}>
                    <img src={post.image_url} className="w-full h-auto max-h-96 object-cover" />
                  </div>
                )}
                <div className="flex items-center gap-6 pt-2">
                  <button onClick={() => toggleLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 transition ${post.is_liked ? 'text-pink-500' : 'text-gray-500 hover:text-pink-500'}`}>
                    <Heart size={20} className={post.is_liked ? 'fill-current' : ''} />
                    <span className="text-xs font-bold">{post.like_count}</span>
                  </button>
                  <button className="flex items-center gap-1.5 text-gray-500 hover:text-blue-500 transition">
                    <MessageCircle size={20} />
                    <span className="text-xs font-bold">{post.comment_count}</span>
                  </button>
                  <button onClick={() => handleShare(post)} className="text-gray-500 hover:text-green-500 transition ml-auto">
                    <Share2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- Navigation --- */}
      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 shadow-2xl backdrop-blur-xl ${darkMode ? 'bg-black/90 border-gray-800 text-gray-500' : 'bg-white/90 border-gray-100 text-gray-400'}`}>
        <HomeIcon onClick={() => setView('home')} className={`cursor-pointer transition hover:scale-125 ${view === 'home' ? 'text-blue-500' : ''}`} />
        <Search onClick={() => setView('search')} className={`cursor-pointer transition hover:scale-125 ${view === 'search' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <MessageCircle onClick={() => setView('messages')} className={`cursor-pointer transition hover:scale-125 ${view === 'messages' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer transition hover:scale-125 ${view === 'profile' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
      </nav>
    </div>
  );
}
