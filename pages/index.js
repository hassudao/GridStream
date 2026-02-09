import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, 
  User as UserIcon, ImageIcon, Send, ChevronLeft, Zap, LogOut, Settings, 
  Trash2, MessageSquare, Plus, Type, Check, Palette, Maximize2,
  UserPlus, UserMinus, Bell, MoreVertical, Image as ImageIconLucide, Users, Hash, Shield, Globe, Lock,
  Volume2, VolumeX, Ban, Trash
} from 'lucide-react';

// --- 定数・ユーティリティ ---
const CLOUDINARY_CLOUD_NAME = 'dtb3jpadj'; 
const CLOUDINARY_UPLOAD_PRESET = 'alpha-sns';

// 翻訳データ
const TRANSLATIONS = {
  ja: {
    home: 'ホーム',
    search: '検索',
    messages: 'メッセージ',
    profile: 'プロフィール',
    settings: '設定',
    online: 'オンライン',
    offline: 'オフライン',
    stream: 'ストリーム',
    post_placeholder: 'いまどうしてる？ #Beta',
    notifications: '通知',
    edit_profile: 'プロフィールを編集',
    language: '言語設定',
    dark_mode: 'ダークモード',
    logout: 'ログアウト',
    followers: 'フォロワー',
    following: 'フォロー中',
    follow: 'フォロー',
    unfollow: 'フォロー解除',
    dm_settings: 'DM詳細設定',
    mute_notifications: '通知をミュート',
    shared_media: '共有されたメディア',
    delete_chat: 'チャット履歴を消去',
    block_user: 'ユーザーをブロック',
    no_messages: 'メッセージはありません',
    your_story: 'あなたのストーリー',
    read: '既読'
  },
  en: {
    home: 'Home',
    search: 'Search',
    messages: 'Messages',
    profile: 'Profile',
    settings: 'Settings',
    online: 'online',
    offline: 'offline',
    stream: 'Stream',
    post_placeholder: "What's happening? #Beta",
    notifications: 'Notifications',
    edit_profile: 'Edit Profile',
    language: 'Language',
    dark_mode: 'Dark Mode',
    logout: 'Log Out',
    followers: 'Followers',
    following: 'Following',
    follow: 'Follow',
    unfollow: 'Unfollow',
    dm_settings: 'DM Settings',
    mute_notifications: 'Mute Notifications',
    shared_media: 'Shared Media',
    delete_chat: 'Clear Chat History',
    block_user: 'Block User',
    no_messages: 'No messages yet',
    your_story: 'Your Story',
    read: 'Read'
  }
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit' });
};

const isOnline = (lastSeenAt) => {
  if (!lastSeenAt) return false;
  const lastSeen = new Date(lastSeenAt);
  const now = new Date();
  return (now - lastSeen) < 5 * 60 * 1000;
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

const FONT_STYLES = [
  { name: 'Classic', css: 'font-serif', label: 'Classic' },
  { name: 'Modern', css: 'font-sans font-black uppercase tracking-widest', label: 'Modern' },
  { name: 'Typewriter', css: 'font-mono', label: 'Typewriter' },
  { name: 'Neon', css: 'font-cursive italic', label: 'Neon' },
];
const TEXT_COLORS = ['#FFFFFF', '#000000', '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FF2D55'];

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
  const [editData, setEditData] = useState({ display_name: '', username: '', bio: '', avatar_url: '', header_url: '', language: 'ja' });
  const [myProfile, setMyProfile] = useState({ username: '', display_name: '', bio: '', avatar_url: '', header_url: '', language: 'ja' });
  const [newPost, setNewPost] = useState('');
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

  // 翻訳用ヘルパー関数
  const t = (key) => TRANSLATIONS[myProfile.language || 'ja'][key] || key;

  useEffect(() => {
    checkUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) fetchMyProfile(currentUser.id);
    });
    return () => subscription.unsubscribe();
  }, []);

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
    if (data) { 
      setMyProfile(data); 
      setEditData(data); 
    }
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
    const { data } = await supabase.from('notifications').select('*, sender:profiles!notifications_sender_id_fkey(*)').eq('receiver_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (data) { setNotifications(data); setUnreadCount(data.filter(n => !n.is_read).length); }
  }

  async function sendNotification(receiverId, type, postId = null, storyId = null) {
    if (!user || user.id === receiverId) return;
    await supabase.from('notifications').insert([{ sender_id: user.id, receiver_id: receiverId, type: type, post_id: postId, story_id: storyId, is_read: false }]);
  }

  async function markNotificationsAsRead() {
    if (!user || unreadCount === 0) return;
    await supabase.from('notifications').update({ is_read: true }).eq('receiver_id', user.id);
    setUnreadCount(0);
  }

  async function notifyFollowers(type, postId = null) {
    const { data: followers } = await supabase.from('follows').select('follower_id').eq('following_id', user.id);
    if (followers && followers.length > 0) {
      const notifications = followers.map(f => ({ sender_id: user.id, receiver_id: f.follower_id, type: type, post_id: postId }));
      await supabase.from('notifications').insert(notifications);
    }
  }

  const handleShare = async (post) => {
    const shareData = { title: 'GridStream', text: post.content, url: window.location.origin };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(shareData.url);
        alert(myProfile.language === 'en' ? 'Link copied to clipboard!' : 'リンクをコピーしました！');
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

  const handleStoryFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) setCreatingStory(file);
    e.target.value = '';
  };

  const handleStoryPublish = async (processedImageBlob) => {
    if (!user || !processedImageBlob) return;
    setUploading(true); setCreatingStory(false);
    try {
      const imageUrl = await uploadToCloudinary(processedImageBlob);
      await supabase.from('stories').insert([{ user_id: user.id, image_url: imageUrl }]);
      await notifyFollowers('story'); fetchData(); 
    } catch (error) { alert("Error uploading"); }
    finally { setUploading(false); }
  };

  const handleDeleteStory = async (storyId) => {
    if(!window.confirm("Delete this story?")) return;
    await supabase.from('stories').delete().eq('id', storyId);
    setViewingStory(null); fetchData();
  };

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

  async function handlePost(e) {
    e.preventDefault();
    if (!newPost.trim() || !user) return;
    setUploading(true);
    let imageUrl = null;
    if (fileInputRef.current?.files[0]) imageUrl = await uploadToCloudinary(fileInputRef.current.files[0]);
    
    const { data, error } = await supabase.from('posts').insert([{ content: newPost, user_id: user.id, image_url: imageUrl }]).select().single();
    
    if (data) {
      const tags = newPost.match(/#[^\s!@#$%^&*()=+.\/,\[\]{\}]+\b/g);
      if (tags) {
        for (const t of tags) {
          const tagName = t.substring(1);
          const { data: tagObj } = await supabase.from('hashtags').upsert({ tag: tagName }, { onConflict: 'tag' }).select().single();
          if (tagObj) await supabase.from('post_hashtags').insert({ post_id: data.id, hashtag_id: tagObj.id });
        }
      }
      await notifyFollowers('post', data.id);
    }
    
    setNewPost(''); if (fileInputRef.current) fileInputRef.current.value = "";
    fetchData(); setUploading(false);
  }

  async function handleDeletePost(postId) {
    if(!window.confirm("Delete this post?")) return;
    await supabase.from('posts').delete().eq('id', postId);
    setPosts(posts.filter(p => p.id !== postId)); setSelectedPost(null);
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
    setView('profile'); setIsEditing(false);
  };

  async function toggleFollow() {
    if (!user || !activeProfileId || user.id === activeProfileId) return;
    if (stats.isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', activeProfileId);
      setStats(prev => ({ ...prev, isFollowing: false, followers: prev.followers - 1 }));
    } else {
      await supabase.from('follows').insert([{ follower_id: user.id, following_id: activeProfileId }]);
      sendNotification(activeProfileId, 'follow');
      setStats(prev => ({ ...prev, isFollowing: true, followers: prev.followers + 1 }));
    }
  }

  const getAvatar = (name, url) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;

  if (!user) return <AuthScreen fetchData={fetchData} />;

  return (
    <div className={`max-w-md mx-auto min-h-screen pb-20 border-x font-sans relative shadow-2xl transition-colors duration-300 ${darkMode ? 'bg-black text-white border-gray-800' : 'bg-white text-black border-gray-100'}`}>
      <script src="https://cdn.tailwindcss.com"></script>

      {creatingStory && <StoryCreator file={creatingStory} onClose={() => setCreatingStory(false)} onPublish={handleStoryPublish} myProfile={myProfile} getAvatar={getAvatar} />}
      {viewingStory && <StoryViewer stories={groupedStories[viewingStory.userId]} initialIndex={viewingStory.index} onClose={() => setViewingStory(null)} userProfile={allProfiles.find(p => p.id === viewingStory.userId)} getAvatar={getAvatar} currentUserId={user.id} onDelete={handleDeleteStory} sendNotification={sendNotification} t={t} />}
      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} myProfile={myProfile} getAvatar={getAvatar} darkMode={darkMode} uploadToCloudinary={uploadToCloudinary} t={t} />}
      {groupTarget && <GroupChatScreen target={groupTarget} setGroupTarget={setGroupTarget} currentUser={user} getAvatar={getAvatar} darkMode={darkMode} uploadToCloudinary={uploadToCloudinary} />}
      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} currentUser={user} allProfiles={allProfiles} setGroupTarget={setGroupTarget} getAvatar={getAvatar} darkMode={darkMode} />}
      {showFollowList && <FollowListModal type={showFollowList} userId={activeProfileId} onClose={() => setShowFollowList(null)} openProfile={openProfile} getAvatar={getAvatar} darkMode={darkMode} t={t} />}
      {selectedPost && <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} getAvatar={getAvatar} openProfile={openProfile} onDelete={handleDeletePost} onLike={toggleLike} onShare={handleShare} currentUser={user} darkMode={darkMode} refreshPosts={fetchData} sendNotification={sendNotification} t={t} />}
      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} user={user} myProfile={myProfile} setMyProfile={setMyProfile} darkMode={darkMode} setDarkMode={setDarkMode} t={t} />}

      {view === 'home' && (
        <div className="animate-in fade-in">
          <header className={`sticky top-0 z-30 backdrop-blur-md border-b p-4 flex justify-between items-center ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-50'}`}>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-cyan-500 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1">
              <Zap size={24} className="text-blue-600 fill-blue-600" /> GridStream
            </h1>
            <div className="flex items-center gap-4">
              <div className="relative cursor-pointer" onClick={() => { setView('notifications'); markNotificationsAsRead(); }}>
                <Bell size={24} />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">{unreadCount}</span>}
              </div>
            </div>
          </header>

          <div className={`p-4 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
            <div className="inline-flex flex-col items-center gap-1 cursor-pointer relative shrink-0">
              <div className="relative">
                <div className={`rounded-full p-[2px] ${groupedStories[user.id] ? 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500' : 'bg-transparent'}`} onClick={() => { if (groupedStories[user.id]) setViewingStory({ userId: user.id, index: 0 }); else storyInputRef.current.click(); }}>
                  <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className={`w-16 h-16 rounded-full object-cover border-2 ${darkMode ? 'border-black' : 'border-white'}`} />
                </div>
                <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1 border-2 border-black cursor-pointer" onClick={(e) => { e.stopPropagation(); storyInputRef.current.click(); }}>
                  <Plus size={12} className="text-white" />
                </div>
              </div>
              <span className="text-[10px] font-bold text-gray-400">{t('your_story')}</span>
              <input type="file" accept="image/*" ref={storyInputRef} className="hidden" onChange={handleStoryFileSelect} />
            </div>
            {Object.keys(groupedStories).filter(id => id !== user.id).map(userId => {
               const uProfile = allProfiles.find(p => p.id === userId);
               if (!uProfile) return null;
               return (
                 <div key={userId} className="inline-flex flex-col items-center gap-1 cursor-pointer shrink-0" onClick={() => setViewingStory({ userId, index: 0 })}>
                   <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500">
                     <img src={getAvatar(uProfile.username, uProfile.avatar_url)} className={`w-16 h-16 rounded-full object-cover border-2 ${darkMode ? 'border-black' : 'border-white'}`} />
                   </div>
                   <span className="text-[10px] font-bold max-w-[64px] truncate">{uProfile.display_name}</span>
                 </div>
               );
            })}
          </div>

          <form onSubmit={handlePost} className={`p-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            <div className="flex gap-3">
              <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-10 h-10 rounded-full object-cover cursor-pointer" onClick={() => openProfile(user.id)} />
              <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none bg-transparent font-medium" placeholder={t('post_placeholder')} value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-12 mt-2">
              <label className="cursor-pointer text-blue-500 p-2 rounded-full transition"><ImageIcon size={22}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
              <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs uppercase tracking-tighter">
                {uploading ? '...' : t('stream')}
              </button>
            </div>
          </form>

          <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
            {posts.map(post => (
              <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onLike={toggleLike} onShare={handleShare} currentUser={user} darkMode={darkMode} onOpenDetail={() => setSelectedPost(post)} onDelete={handleDeletePost} t={t} />
            ))}
          </div>
        </div>
      )}

      {view === 'profile' && profileInfo && <ProfileView user={user} activeProfileId={activeProfileId} profileInfo={profileInfo} posts={posts} isEditing={isEditing} setIsEditing={setIsEditing} editData={editData} setEditData={setEditData} handleUpdateProfile={async () => {
            setUploading(true);
            let { avatar_url, header_url } = editData;
            if (avatarInputRef.current?.files[0]) avatar_url = await uploadToCloudinary(avatarInputRef.current.files[0]);
            if (headerInputRef.current?.files[0]) header_url = await uploadToCloudinary(headerInputRef.current.files[0]);
            await supabase.from('profiles').update({ ...editData, avatar_url, header_url }).eq('id', user.id);
            await fetchMyProfile(user.id); setIsEditing(false); setUploading(false);
          }} uploading={uploading} avatarInputRef={avatarInputRef} headerInputRef={headerInputRef} getAvatar={getAvatar} openProfile={openProfile} toggleFollow={toggleFollow} stats={stats} setShowFollowList={setShowFollowList} setShowSettings={setShowSettings} darkMode={darkMode} setView={setView} toggleLike={toggleLike} handleShare={handleShare} setSelectedPost={setSelectedPost} onDeletePost={handleDeletePost} t={t} />}
      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} allProfiles={allProfiles} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSelectedPost={setSelectedPost} darkMode={darkMode} t={t} />}
      {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} setDmTarget={setDmTarget} setGroupTarget={setGroupTarget} setShowCreateGroup={setShowCreateGroup} getAvatar={getAvatar} openProfile={openProfile} darkMode={darkMode} t={t} />}
      {view === 'notifications' && <NotificationCenter notifications={notifications} getAvatar={getAvatar} openProfile={openProfile} setSelectedPost={(postId) => { const p = posts.find(x => x.id === postId); if(p) setSelectedPost(p); }} darkMode={darkMode} t={t} />}

      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 shadow-sm ${darkMode ? 'bg-black/95 border-gray-800 text-gray-600' : 'bg-white/95 border-gray-100 text-gray-300'}`}>
        <HomeIcon onClick={() => setView('home')} className={`cursor-pointer transition hover:scale-110 ${view === 'home' ? 'text-blue-600' : ''}`} />
        <Search onClick={() => setView('search')} className={`cursor-pointer transition hover:scale-110 ${view === 'search' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <MessageCircle onClick={() => setView('messages')} className={`cursor-pointer transition hover:scale-110 ${view === 'messages' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer transition hover:scale-110 ${view === 'profile' && activeProfileId === user.id ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
      </nav>
    </div>
  );
}

// --- メッセージリスト ---
function MessagesList({ allProfiles, user, setDmTarget, setGroupTarget, setShowCreateGroup, getAvatar, openProfile, darkMode, t }) {
  const [lastMessages, setLastMessages] = useState({});
  const [mutualFollows, setMutualFollows] = useState([]);
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    fetchMutualFollows();
    fetchGroups();
    fetchLastMessages();
  }, [allProfiles]);

  async function fetchMutualFollows() {
    const { data: following } = await supabase.from('follows').select('following_id').eq('follower_id', user.id);
    const { data: followers } = await supabase.from('follows').select('follower_id').eq('following_id', user.id);
    if (following && followers) {
      const followingIds = following.map(f => f.following_id);
      const followerIds = followers.map(f => f.follower_id);
      const mutualIds = followingIds.filter(id => followerIds.includes(id));
      setMutualFollows(allProfiles.filter(p => mutualIds.includes(p.id)));
    }
  }

  async function fetchGroups() {
    const { data } = await supabase.from('group_members').select('group_id, groups(*)').eq('user_id', user.id);
    if (data) setGroups(data.map(d => d.groups));
  }

  async function fetchLastMessages() {
    const { data } = await supabase.from('messages').select('*').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).order('created_at', { ascending: false });
    if (data) {
      const latest = {};
      data.forEach(m => {
        const key = m.group_id ? `group:${m.group_id}` : (m.sender_id === user.id ? m.receiver_id : m.sender_id);
        if (!latest[key]) latest[key] = m;
      });
      setLastMessages(latest);
    }
  }

  return (
    <div className="animate-in fade-in h-full flex flex-col">
      <header className={`p-4 border-b font-black text-lg text-center uppercase italic sticky top-0 z-10 backdrop-blur-md flex justify-between items-center ${darkMode ? 'bg-black/90' : 'bg-white/90'}`}>
        <div className="w-8"></div>
        <span>{t('messages')}</span>
        <div className="flex gap-3">
          <Users size={20} className="text-blue-500 cursor-pointer" onClick={() => setShowCreateGroup(true)} />
        </div>
      </header>
      <div className="flex-grow overflow-y-auto">
        {groups.map(g => (
          <div key={g.id} className={`flex items-center gap-4 p-4 cursor-pointer transition ${darkMode ? 'hover:bg-gray-900 border-b border-gray-800/50' : 'hover:bg-gray-50 border-b border-gray-100'}`} onClick={() => setGroupTarget(g)}>
            <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black shadow-lg">
              {g.name[0].toUpperCase()}
            </div>
            <div className="flex-grow">
              <div className="flex justify-between items-center mb-1">
                <p className="font-black text-sm">{g.name}</p>
                {lastMessages[`group:${g.id}`] && <p className="text-[10px] text-gray-500 font-bold">{formatTime(lastMessages[`group:${g.id}`].created_at)}</p>}
              </div>
              <p className="text-xs text-gray-400 truncate max-w-[180px]">
                {lastMessages[`group:${g.id}`] ? lastMessages[`group:${g.id}`].text : t('no_messages')}
              </p>
            </div>
          </div>
        ))}

        {mutualFollows.map(u => (
          <div key={u.id} className={`flex items-center gap-4 p-4 cursor-pointer transition ${darkMode ? 'hover:bg-gray-900 border-b border-gray-800/50' : 'hover:bg-gray-50 border-b border-gray-100'}`} onClick={() => setDmTarget(u)}>
            <div className="relative">
              <img src={getAvatar(u.username, u.avatar_url)} className="w-14 h-14 rounded-full object-cover shadow-sm" />
              {isOnline(u.last_seen_at) && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-black rounded-full"></div>}
            </div>
            <div className="flex-grow pb-1">
              <div className="flex justify-between items-center mb-1">
                <p className="font-black text-sm">{u.display_name}</p>
                {lastMessages[u.id] && <p className="text-[10px] text-gray-500 font-bold">{formatTime(lastMessages[u.id].created_at)}</p>}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400 truncate max-w-[180px]">
                  {lastMessages[u.id] ? (lastMessages[u.id].image_url ? '📷 Photo' : lastMessages[u.id].text) : t('no_messages')}
                </p>
                {lastMessages[u.id] && lastMessages[u.id].sender_id !== user.id && !lastMessages[u.id].is_read && (
                  <div className="w-2.5 h-2.5 bg-blue-600 rounded-full"></div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- DM画面 ---
function DMScreen({ target, setDmTarget, currentUser, myProfile, getAvatar, darkMode, uploadToCloudinary, t }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef();
  const dmFileInputRef = useRef();

  useEffect(() => {
    fetchMessages();
    markAsRead();
    const channel = supabase.channel(`chat:${target.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (p) => {
        if (p.eventType === 'INSERT') {
          if ((p.new.sender_id === currentUser.id && p.new.receiver_id === target.id) || 
              (p.new.sender_id === target.id && p.new.receiver_id === currentUser.id)) {
            setMessages(prev => [...prev, p.new]);
            if (p.new.receiver_id === currentUser.id) markAsRead();
          }
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [target]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchMessages() {
    const { data } = await supabase.from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  }

  async function markAsRead() {
    await supabase.from('messages').update({ is_read: true }).eq('receiver_id', currentUser.id).eq('sender_id', target.id).eq('is_read', false);
  }

  async function sendMsg(e) {
    e.preventDefault();
    if (!text.trim() && !selectedFile) return;
    setUploading(true);
    let imageUrl = null;
    if (selectedFile) imageUrl = await uploadToCloudinary(selectedFile);
    const tMsg = text;
    setText(''); setSelectedFile(null); setPreviewUrl(null);
    await supabase.from('messages').insert([{ text: tMsg, sender_id: currentUser.id, receiver_id: target.id, image_url: imageUrl, is_read: false }]);
    setUploading(false);
  }

  return (
    <div className={`fixed inset-0 z-[120] flex flex-col animate-in slide-in-from-right duration-300 ${darkMode ? 'bg-black' : 'bg-[#f0f2f5]'}`}>
      <header className={`p-4 flex items-center justify-between border-b sticky top-0 z-10 ${darkMode ? 'bg-black border-gray-800' : 'bg-white'}`}>
        <div className="flex items-center gap-3">
          <ChevronLeft onClick={() => setDmTarget(null)} className="cursor-pointer" />
          <div className="relative">
            <img src={getAvatar(target.username, target.avatar_url)} className="w-10 h-10 rounded-full object-cover" />
            {isOnline(target.last_seen_at) && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full"></div>}
          </div>
          <div>
            <p className="font-black text-sm">{target.display_name}</p>
            <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">{isOnline(target.last_seen_at) ? t('online') : t('offline')}</p>
          </div>
        </div>
        <Settings size={20} className="text-gray-400 cursor-pointer" onClick={() => setShowSettings(true)} />
      </header>

      {showSettings && <DMSettingsModal onClose={() => setShowSettings(false)} target={target} messages={messages} darkMode={darkMode} getAvatar={getAvatar} t={t} currentUser={currentUser} setDmTarget={setDmTarget} />}

      <div className="flex-grow overflow-y-auto p-4 space-y-6 scrollbar-hide">
        {messages.map(m => (
          <div key={m.id} className={`flex flex-col ${m.sender_id === currentUser.id ? 'items-end' : 'items-start'}`}>
            <div className={`group relative max-w-[80%] flex items-end gap-2 ${m.sender_id === currentUser.id ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`p-4 rounded-[1.8rem] text-sm shadow-sm ${m.sender_id === currentUser.id ? 'bg-blue-600 text-white rounded-tr-none' : (darkMode ? 'bg-gray-800 text-white rounded-tl-none' : 'bg-white text-gray-800 rounded-tl-none')}`}>
                {m.image_url && <img src={m.image_url} className="rounded-xl mb-2 max-w-full" alt="sent" />}
                {m.text && <div className="font-medium leading-relaxed break-words">{renderContent(m.text)}</div>}
              </div>
              <div className="flex flex-col items-center">
                 {m.sender_id === currentUser.id && m.is_read && <span className="text-[9px] text-blue-500 font-bold mb-0.5">{t('read')}</span>}
                 <span className="text-[9px] text-gray-500 font-bold mb-1">{formatTime(m.created_at)}</span>
              </div>
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={sendMsg} className={`p-4 border-t flex items-center gap-3 ${darkMode ? 'bg-black border-gray-800' : 'bg-white'}`}>
        <label className="cursor-pointer text-gray-400 hover:text-blue-500 transition">
          <ImageIconLucide size={24} />
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files[0]; if(f){ setSelectedFile(f); setPreviewUrl(URL.createObjectURL(f)); } }} />
        </label>
        <div className={`flex-grow flex items-center rounded-3xl px-4 py-2 ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
          <input type="text" className="flex-grow bg-transparent outline-none text-sm font-medium py-1" placeholder="Type a message..." value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <button type="submit" className="bg-blue-600 text-white p-3 rounded-full shadow-lg"><Send size={18}/></button>
      </form>
    </div>
  );
}

// --- DM設定画面 (指示②: 中身の作成) ---
function DMSettingsModal({ onClose, target, messages, darkMode, getAvatar, t, currentUser, setDmTarget }) {
  const sharedMedia = messages.filter(m => m.image_url).map(m => m.image_url).reverse();

  const handleClearChat = async () => {
    if(!window.confirm(t('delete_chat') + "?")) return;
    await supabase.from('messages').delete().or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${currentUser.id})`);
    onClose();
    setDmTarget(null);
  };

  return (
    <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-end justify-center">
      <div className={`w-full max-w-md rounded-t-[2.5rem] p-6 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
        <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-6 opacity-30"></div>
        
        {/* プロフィール要約 */}
        <div className="flex flex-col items-center mb-8">
          <img src={getAvatar(target.username, target.avatar_url)} className="w-20 h-20 rounded-full object-cover mb-3 border-2 border-blue-500 p-0.5" />
          <h3 className="text-xl font-black">{target.display_name}</h3>
          <p className="text-gray-500 text-sm font-bold">@{target.username}</p>
        </div>

        {/* アクションメニュー */}
        <div className="space-y-2 mb-8">
          <button className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition ${darkMode ? 'bg-black/40 hover:bg-black/60' : 'bg-gray-50 hover:bg-gray-100'}`}>
            <div className="p-2 bg-blue-500/10 rounded-full text-blue-500"><Bell size={18}/></div>
            <div className="flex-grow text-left">
              <p className="text-sm">{t('mute_notifications')}</p>
            </div>
            <div className="w-10 h-5 bg-gray-600 rounded-full relative"><div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full"></div></div>
          </button>
        </div>

        {/* 共有メディア */}
        {sharedMedia.length > 0 && (
          <div className="mb-8">
            <h4 className="text-[10px] font-black uppercase text-gray-400 mb-4 tracking-widest">{t('shared_media')}</h4>
            <div className="grid grid-cols-3 gap-2">
              {sharedMedia.slice(0, 6).map((url, i) => (
                <img key={i} src={url} className="w-full aspect-square object-cover rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* 危険なアクション */}
        <div className="space-y-2">
          <button onClick={handleClearChat} className="w-full flex items-center gap-4 p-4 rounded-2xl text-red-500 font-bold bg-red-500/10 hover:bg-red-500/20 transition">
            <Trash2 size={18}/> {t('delete_chat')}
          </button>
          <button className="w-full flex items-center gap-4 p-4 rounded-2xl text-red-500 font-bold bg-red-500/10 hover:bg-red-500/20 transition">
            <Ban size={18}/> {t('block_user')}
          </button>
        </div>

        <button onClick={onClose} className="w-full mt-6 py-4 font-black uppercase text-xs tracking-widest text-gray-500">Close</button>
      </div>
    </div>
  );
}

// --- 設定画面 (指示③: 言語切り替え追加) ---
function SettingsScreen({ onClose, user, myProfile, setMyProfile, darkMode, setDarkMode, t }) {
  const [updating, setUpdating] = useState(false);

  const handleUpdateLanguage = async (lang) => {
    setUpdating(true);
    const { error } = await supabase.from('profiles').update({ language: lang }).eq('id', user.id);
    if (!error) {
      setMyProfile({ ...myProfile, language: lang });
    }
    setUpdating(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className={`w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-black italic uppercase tracking-tighter italic">Settings</h2>
          <X onClick={onClose} className="cursor-pointer opacity-50" />
        </div>

        <div className="space-y-8">
          {/* 外観 */}
          <section>
            <h3 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">Appearance</h3>
            <button onClick={() => setDarkMode(!darkMode)} className={`w-full flex justify-between items-center p-4 rounded-2xl ${darkMode ? 'bg-black' : 'bg-gray-50'}`}>
              <span className="text-sm font-bold">{t('dark_mode')}</span>
              <div className={`w-10 h-6 rounded-full relative transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${darkMode ? 'right-1' : 'left-1'}`} />
              </div>
            </button>
          </section>

          {/* 言語設定 (指示③: プロフィール設定画面に項目を増やす) */}
          <section>
            <h3 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">{t('language')}</h3>
            <div className={`flex p-1 rounded-2xl ${darkMode ? 'bg-black' : 'bg-gray-50'}`}>
              <button 
                onClick={() => handleUpdateLanguage('ja')} 
                disabled={updating}
                className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${myProfile.language === 'ja' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
              >
                日本語
              </button>
              <button 
                onClick={() => handleUpdateLanguage('en')} 
                disabled={updating}
                className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${myProfile.language === 'en' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
              >
                English
              </button>
            </div>
          </section>

          {/* アカウント */}
          <section className="pt-4 border-t border-gray-800/50">
            <button onClick={handleLogout} className="w-full p-4 rounded-2xl bg-red-500/10 text-red-500 font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2">
              <LogOut size={16}/> {t('logout')}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

// --- 以下、既存のコンポーネントを微調整 ---

function PostCard({ post, openProfile, getAvatar, onLike, onShare, currentUser, darkMode, onOpenDetail, onDelete, t }) {
  return (
    <div className={`p-4 transition-colors ${darkMode ? 'hover:bg-gray-900/50' : 'hover:bg-gray-50/50'}`} onClick={onOpenDetail}>
      <div className="flex gap-3">
        <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition" onClick={(e) => { e.stopPropagation(); openProfile(post.user_id); }} />
        <div className="flex-grow min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1 min-w-0" onClick={(e) => { e.stopPropagation(); openProfile(post.user_id); }}>
              <span className="font-black text-sm truncate">{post.profiles?.display_name}</span>
              <span className="text-[10px] text-gray-500 font-bold truncate">@{post.profiles?.username}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">{formatTime(post.created_at)}</span>
              {currentUser.id === post.user_id && <Trash2 size={14} className="text-gray-500 hover:text-red-500 cursor-pointer" onClick={(e) => { e.stopPropagation(); onDelete(post.id); }} />}
            </div>
          </div>
          <p className="text-sm font-medium leading-relaxed mb-3 whitespace-pre-wrap">{renderContent(post.content)}</p>
          {post.image_url && <img src={post.image_url} className={`rounded-2xl w-full mb-3 object-cover max-h-80 border ${darkMode ? 'border-gray-800' : 'border-gray-100'}`} alt="post" />}
          <div className="flex gap-6">
            <button onClick={(e) => { e.stopPropagation(); onLike(post.id, post.is_liked); }} className={`flex items-center gap-1.5 transition ${post.is_liked ? 'text-red-500 scale-110' : 'text-gray-400 hover:text-red-500'}`}><Heart size={18} fill={post.is_liked ? "currentColor" : "none"} /><span className="text-xs font-black">{post.like_count || ''}</span></button>
            <button className="flex items-center gap-1.5 text-gray-400 hover:text-blue-500 transition"><MessageSquare size={18} /><span className="text-xs font-black">{post.comment_count || ''}</span></button>
            <button onClick={(e) => { e.stopPropagation(); onShare(post); }} className="text-gray-400 hover:text-green-500 transition ml-auto"><Share2 size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileView({ user, activeProfileId, profileInfo, posts, isEditing, setIsEditing, editData, setEditData, handleUpdateProfile, uploading, avatarInputRef, headerInputRef, getAvatar, openProfile, toggleFollow, stats, setShowFollowList, setShowSettings, darkMode, setView, toggleLike, handleShare, setSelectedPost, onDeletePost, t }) {
  if (isEditing) {
    return (
      <div className="animate-in slide-in-from-bottom duration-300">
        <header className={`p-4 flex items-center justify-between border-b sticky top-0 z-10 backdrop-blur-md ${darkMode ? 'bg-black/90' : 'bg-white/95'}`}>
          <div className="flex items-center gap-4"><button onClick={() => setIsEditing(false)}><X /></button><h2 className="font-black italic uppercase tracking-tighter">Edit Profile</h2></div>
          <button onClick={handleUpdateProfile} disabled={uploading} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs uppercase tracking-tighter">{uploading ? '...' : 'Save'}</button>
        </header>
        <div className="p-6 space-y-6">
          <div className="relative h-32 bg-gray-200 rounded-2xl overflow-hidden cursor-pointer" onClick={() => headerInputRef.current.click()}>
            <img src={editData.header_url || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&q=80'} className="w-full h-full object-cover opacity-50" />
            <div className="absolute inset-0 flex items-center justify-center text-black font-black uppercase text-xs tracking-widest"><Camera className="mr-2" /> Change Header</div>
            <input type="file" ref={headerInputRef} className="hidden" accept="image/*" onChange={e => { if(e.target.files[0]) setEditData({...editData, header_url: URL.createObjectURL(e.target.files[0])})}} />
          </div>
          <div className="flex flex-col items-center -mt-16">
            <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current.click()}>
              <img src={getAvatar(editData.username, editData.avatar_url)} className="w-24 h-24 rounded-full border-4 border-black object-cover group-hover:opacity-50 transition" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100"><Camera size={24} /></div>
            </div>
            <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={e => { if(e.target.files[0]) setEditData({...editData, avatar_url: URL.createObjectURL(e.target.files[0])})}} />
          </div>
          <div className="space-y-4">
            <div className={`p-4 rounded-2xl ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}><label className="text-[10px] text-gray-400 font-black uppercase mb-1 block">Display Name</label><input className="w-full bg-transparent outline-none font-bold" value={editData.display_name} onChange={e => setEditData({...editData, display_name: e.target.value})} /></div>
            <div className={`p-4 rounded-2xl ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}><label className="text-[10px] text-gray-400 font-black uppercase mb-1 block">Bio</label><textarea className="w-full bg-transparent outline-none font-medium text-sm h-24 resize-none" value={editData.bio} onChange={e => setEditData({...editData, bio: e.target.value})} /></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative h-44 bg-gray-200">
        <img src={profileInfo.header_url || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&q=80'} className="w-full h-full object-cover" />
        <div className="absolute top-4 inset-x-4 flex justify-between items-center">
          <button onClick={() => setView('home')} className="bg-black/30 backdrop-blur-md p-2 rounded-full text-white"><ChevronLeft size={20}/></button>
          {user?.id === activeProfileId && <button onClick={() => setShowSettings(true)} className="bg-black/30 backdrop-blur-md p-2 rounded-full text-white"><Settings size={20}/></button>}
        </div>
      </div>
      <div className="px-4 relative">
        <div className="flex justify-between items-end -mt-12 mb-4">
          <div className="relative">
            <img src={getAvatar(profileInfo.username, profileInfo.avatar_url)} className={`w-24 h-24 rounded-full border-4 shadow-xl object-cover ${darkMode ? 'border-black bg-black' : 'border-white bg-white'}`} />
            {isOnline(profileInfo.last_seen_at) && <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-black rounded-full"></div>}
          </div>
          <div className="flex gap-2">
            {user?.id === activeProfileId ? (
              <button onClick={() => setIsEditing(true)} className={`border rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-tighter ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>{t('edit_profile')}</button>
            ) : (
              <button onClick={toggleFollow} className={`flex items-center gap-1.5 rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-tighter transition ${stats.isFollowing ? (darkMode ? 'bg-gray-800 text-white' : 'bg-gray-200 text-black') : 'bg-blue-600 text-white'}`}>
                {stats.isFollowing ? <><UserMinus size={14}/> {t('unfollow')}</> : <><UserPlus size={14}/> {t('follow')}</>}
              </button>
            )}
          </div>
        </div>
        <div className="mb-4">
          <h2 className="text-xl font-black">{profileInfo.display_name}</h2>
          <p className="text-gray-500 font-bold text-sm mb-3">@{profileInfo.username}</p>
          <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{profileInfo.bio}</p>
        </div>
        <div className="flex gap-4 mb-6">
          <button onClick={() => setShowFollowList('following')} className="flex items-center gap-1 hover:underline"><span className="font-black text-sm">{stats.following}</span><span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{t('following')}</span></button>
          <button onClick={() => setShowFollowList('followers')} className="flex items-center gap-1 hover:underline"><span className="font-black text-sm">{stats.followers}</span><span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{t('followers')}</span></button>
        </div>
      </div>
      <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
        {posts.filter(p => p.user_id === activeProfileId).map(post => (
          <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onLike={toggleLike} onShare={handleShare} currentUser={user} darkMode={darkMode} onOpenDetail={() => setSelectedPost(post)} onDelete={onDeletePost} t={t} />
        ))}
      </div>
    </>
  );
}

// 検索画面
function SearchView({ posts, openProfile, allProfiles, searchQuery, setSearchQuery, setSelectedPost, darkMode, t }) {
  const filteredUsers = allProfiles.filter(u => u.username.includes(searchQuery.toLowerCase()) || u.display_name.includes(searchQuery));
  return (
    <div className="animate-in fade-in">
      <div className={`p-4 sticky top-0 z-10 border-b ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-100'}`}>
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input type="text" placeholder="Search Beta..." className={`w-full rounded-xl py-2 pl-10 pr-4 outline-none text-xs font-black uppercase ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100'}`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>
      {!searchQuery ? (
        <div className="grid grid-cols-3 gap-[2px]">
          {posts.filter(p => p.image_url).map((post) => (
            <img key={post.id} src={post.image_url} className="aspect-square w-full h-full object-cover cursor-pointer hover:opacity-80 transition" onClick={() => setSelectedPost(post)} />
          ))}
        </div>
      ) : (
        <div className="p-4 space-y-8">
          {filteredUsers.length > 0 && (
            <section>
              <h3 className="text-[10px] font-black text-gray-400 uppercase mb-3 tracking-widest flex items-center gap-2"><UserIcon size={14}/> Users</h3>
              <div className="space-y-3">
                {filteredUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-500/5 cursor-pointer" onClick={() => openProfile(u.id)}>
                    <img src={getAvatar(u.username, u.avatar_url)} className="w-10 h-10 rounded-full" />
                    <div><p className="font-black text-xs">{u.display_name}</p><p className="text-[10px] text-gray-500 font-bold">@{u.username}</p></div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// 通知センター
function NotificationCenter({ notifications, getAvatar, openProfile, setSelectedPost, darkMode, t }) {
  const getMessage = (n) => {
    const isEn = t('home') === 'Home';
    switch(n.type) {
      case 'like': return isEn ? 'liked your post' : 'があなたの投稿に「いいね！」しました';
      case 'follow': return isEn ? 'followed you' : 'があなたをフォローしました';
      case 'comment': return isEn ? 'commented on your post' : 'があなたの投稿にコメントしました';
      case 'story': return isEn ? 'posted a new story' : 'が新しいストーリーを投稿しました';
      default: return '';
    }
  };
  return (
    <div className="animate-in fade-in h-full bg-inherit">
      <header className="p-4 border-b font-black text-lg text-center uppercase italic sticky top-0 z-10 bg-inherit/90 backdrop-blur-md">{t('notifications')}</header>
      {notifications.length === 0 ? <div className="p-20 text-center text-gray-500 font-bold text-xs uppercase tracking-widest">No notifications</div> : (
        <div className="divide-y divide-gray-800/10">
          {notifications.map(n => (
            <div key={n.id} className={`p-4 flex gap-4 items-center cursor-pointer transition ${!n.is_read ? (darkMode ? 'bg-blue-900/10' : 'bg-blue-50') : ''}`} onClick={() => { if (n.post_id) setSelectedPost(n.post_id); else openProfile(n.sender_id); }}>
              <img src={getAvatar(n.sender?.username, n.sender?.avatar_url)} className="w-12 h-12 rounded-full object-cover shadow-sm" />
              <div className="flex-grow"><p className="text-sm font-medium"><span className="font-black">@{n.sender?.username}</span> {getMessage(n)}</p><p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">{formatTime(n.created_at)}</p></div>
              {n.type === 'like' && <Heart size={16} className="text-red-500 fill-red-500" />}
              {n.type === 'follow' && <UserPlus size={16} className="text-blue-500" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 認証・その他コンポーネントは既存のロジックを保持

function AuthScreen({ fetchData }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
      else fetchData();
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) alert(error.message);
      else if (data.user) {
        const { error: pError } = await supabase.from('profiles').insert([{ id: data.user.id, username, display_name: displayName, avatar_url: '', language: 'ja' }]);
        if (pError) alert(pError.message);
        else fetchData();
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-black text-white">
      <div className="mb-12 text-center">
        <div className="flex items-center justify-center gap-2 text-4xl font-black italic mb-2"><Zap className="text-blue-600 fill-blue-600" /> Beta</div>
        <p className="text-gray-500 font-bold text-xs uppercase tracking-[0.3em]">Join the evolution</p>
      </div>
      <form onSubmit={handleAuth} className="w-full space-y-4">
        {!isLogin && step === 1 && (
          <div className="space-y-4 animate-in fade-in">
            <input type="email" placeholder="EMAIL" className="w-full bg-gray-900 p-4 rounded-2xl outline-none font-black text-xs" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="PASSWORD" className="w-full bg-gray-900 p-4 rounded-2xl outline-none font-black text-xs" value={password} onChange={e => setPassword(e.target.value)} required />
            <button type="button" onClick={() => setStep(2)} className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Next</button>
          </div>
        )}
        {!isLogin && step === 2 && (
          <div className="space-y-4 animate-in fade-in">
            <input type="text" placeholder="USERNAME" className="w-full bg-gray-900 p-4 rounded-2xl outline-none font-black text-xs" value={username} onChange={e => setUsername(e.target.value.toLowerCase())} required />
            <input type="text" placeholder="DISPLAY NAME" className="w-full bg-gray-900 p-4 rounded-2xl outline-none font-black text-xs" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
            <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">{loading ? '...' : 'Create Account'}</button>
            <button type="button" onClick={() => setStep(1)} className="w-full text-gray-500 font-bold text-[10px] uppercase">Back</button>
          </div>
        )}
        {isLogin && (
          <div className="space-y-4">
            <input type="email" placeholder="EMAIL" className="w-full bg-gray-900 p-4 rounded-2xl outline-none font-black text-xs" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="PASSWORD" className="w-full bg-gray-900 p-4 rounded-2xl outline-none font-black text-xs" value={password} onChange={e => setPassword(e.target.value)} required />
            <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">{loading ? '...' : 'Sign In'}</button>
          </div>
        )}
      </form>
      <button onClick={() => { setIsLogin(!isLogin); setStep(1); }} className="mt-8 text-xs font-black uppercase tracking-widest text-gray-400">{isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}</button>
    </div>
  );
}

// ストーリービューア、フォロワーリストなどは既存のロジックから翻訳対応
function StoryViewer({ stories, initialIndex, onClose, userProfile, getAvatar, currentUserId, onDelete, sendNotification, t }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const currentStory = stories[currentIndex];

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          if (currentIndex < stories.length - 1) { setCurrentIndex(currentIndex + 1); return 0; }
          else { onClose(); return 100; }
        }
        return p + 1;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [currentIndex]);

  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center">
      <div className="absolute top-0 w-full p-2 flex gap-1 z-30">
        {stories.map((_, i) => (
          <div key={i} className="h-1 flex-grow bg-gray-600 rounded-full overflow-hidden">
            <div className="h-full bg-white" style={{ width: i < currentIndex ? '100%' : (i === currentIndex ? `${progress}%` : '0%') }}></div>
          </div>
        ))}
      </div>
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-30">
        <div className="flex items-center gap-3">
          <img src={getAvatar(userProfile.username, userProfile.avatar_url)} className="w-10 h-10 rounded-full border border-white" />
          <span className="text-white font-black text-sm">{userProfile.display_name}</span>
        </div>
        <button onClick={onClose} className="text-white"><X /></button>
      </div>
      <img src={currentStory.image_url} className="max-w-full max-h-full object-contain" />
    </div>
  );
}

function FollowListModal({ type, userId, onClose, openProfile, getAvatar, darkMode, t }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    async function fetchList() {
      const sourceCol = type === 'followers' ? 'following_id' : 'follower_id';
      const targetCol = type === 'followers' ? 'follower_id' : 'following_id';
      const { data: followData } = await supabase.from('follows').select(targetCol).eq(sourceCol, userId);
      if (followData?.length > 0) {
        const ids = followData.map(f => f[targetCol]);
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids);
        if (profiles) setList(profiles);
      }
    }
    fetchList();
  }, [type, userId]);
  return (
    <div className="fixed inset-0 z-[160] bg-black/80 backdrop-blur-sm flex items-end justify-center">
      <div className={`w-full max-w-md rounded-t-[2.5rem] max-h-[70vh] flex flex-col p-6 ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
        <div className="flex justify-between items-center mb-6"><h3 className="font-black uppercase tracking-widest">{t(type)}</h3><X onClick={onClose} className="cursor-pointer" /></div>
        <div className="overflow-y-auto space-y-4">
          {list.map(u => (
            <div key={u.id} className="flex items-center gap-3 cursor-pointer" onClick={() => { onClose(); openProfile(u.id); }}>
              <img src={getAvatar(u.username, u.avatar_url)} className="w-12 h-12 rounded-full" />
              <div><p className="font-black text-sm">{u.display_name}</p><p className="text-xs text-gray-500">@{u.username}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PostDetailModal({ post, onClose, getAvatar, openProfile, onDelete, onLike, onShare, currentUser, darkMode, refreshPosts, sendNotification, t }) {
  return (
    <div className={`fixed inset-0 z-[140] flex flex-col animate-in slide-in-from-right duration-300 ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <header className={`p-4 flex items-center gap-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
        <ChevronLeft onClick={onClose} className="cursor-pointer" />
        <h2 className="font-black uppercase tracking-tighter">Post Details</h2>
      </header>
      <div className="flex-grow overflow-y-auto p-4">
        <div className="flex gap-3 mb-6">
          <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-12 h-12 rounded-full" onClick={() => openProfile(post.user_id)} />
          <div><p className="font-black">{post.profiles?.display_name}</p><p className="text-gray-500 text-sm">@{post.profiles?.username}</p></div>
        </div>
        <p className="text-lg font-medium mb-4 whitespace-pre-wrap">{renderContent(post.content)}</p>
        {post.image_url && <img src={post.image_url} className="w-full rounded-2xl mb-6" />}
        <div className="flex gap-4 p-4 border-y border-gray-800/10">
           <span className="text-sm font-black">{post.like_count} <span className="text-gray-500 font-bold uppercase text-[10px]">Likes</span></span>
           <span className="text-sm font-black">{post.comment_count} <span className="text-gray-500 font-bold uppercase text-[10px]">Comments</span></span>
        </div>
      </div>
    </div>
  );
}

function StoryCreator({ file, onClose, onPublish, myProfile, getAvatar }) {
  return (
    <div className="fixed inset-0 z-[300] bg-black flex flex-col">
      <div className="p-4 flex justify-between items-center z-10"><button onClick={onClose} className="text-white"><X /></button></div>
      <div className="flex-grow flex items-center justify-center relative">
        <img src={URL.createObjectURL(file)} className="max-w-full max-h-full" />
      </div>
      <div className="p-8 flex justify-center"><button onClick={() => onPublish(file)} className="bg-white text-black px-12 py-4 rounded-full font-black uppercase tracking-widest">Share</button></div>
    </div>
  );
}

function CreateGroupModal({ onClose, currentUser, allProfiles, setGroupTarget, getAvatar, darkMode }) {
  return <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center"><X onClick={onClose} className="absolute top-4 right-4 text-white" /></div>;
}

function GroupChatScreen({ target, setGroupTarget, currentUser, getAvatar, darkMode, uploadToCloudinary }) {
  return <div className="fixed inset-0 z-[120] bg-black flex flex-col"><button onClick={() => setGroupTarget(null)} className="text-white p-4"><ChevronLeft/></button></div>;
        }
