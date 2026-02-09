import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, 
  User as UserIcon, ImageIcon, Send, ChevronLeft, Zap, LogOut, Settings, 
  Trash2, MessageSquare, Plus, Type, Check, Palette, Maximize2,
  UserPlus, UserMinus, Bell, MoreVertical, Image as ImageIconLucide, Users, Hash, Shield, Globe, Lock
} from 'lucide-react';

// --- 定数・ユーティリティ ---
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

  const handleShare = async (post) => {
    const shareData = { title: 'Beta', text: post.content, url: window.location.origin };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(shareData.url);
        alert('リンクをクリップボードにコピーしました！');
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
      fetchData(); 
    } catch (error) { alert("アップロードに失敗しました"); }
    finally { setUploading(false); }
  };

  async function toggleLike(postId, isLiked) {
    if (!user) return;
    const post = posts.find(p => p.id === postId);
    const updateLogic = (p) => p.id === postId ? { ...p, is_liked: !isLiked, like_count: isLiked ? Math.max(0, p.like_count - 1) : p.like_count + 1 } : p;
    setPosts(prev => prev.map(updateLogic));
    if (isLiked) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id);
    } else {
      await supabase.from('likes').insert([{ post_id: postId, user_id: user.id }]);
      if (post) sendNotification(post.user_id, 'like', postId);
    }
  }

  async function handlePost(e) {
    e.preventDefault();
    if (!newPost.trim() || !user) return;
    setUploading(true);
    let imageUrl = null;
    if (fileInputRef.current?.files[0]) imageUrl = await uploadToCloudinary(fileInputRef.current.files[0]);
    const { data } = await supabase.from('posts').insert([{ content: newPost, user_id: user.id, image_url: imageUrl }]).select().single();
    setNewPost(''); 
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchData(); setUploading(false);
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

  if (!user) return <div className="p-20 text-center font-bold">Please Login</div>;

  return (
    <div className={`max-w-md mx-auto min-h-screen pb-20 border-x transition-colors duration-300 ${darkMode ? 'bg-black text-white border-gray-800' : 'bg-white text-black border-gray-100'}`}>
      <script src="https://cdn.tailwindcss.com"></script>

      {/* モーダル群 */}
      {creatingStory && <StoryCreator file={creatingStory} onClose={() => setCreatingStory(false)} onPublish={handleStoryPublish} myProfile={myProfile} getAvatar={getAvatar} />}
      {viewingStory && <StoryViewer stories={groupedStories[viewingStory.userId]} initialIndex={viewingStory.index} onClose={() => setViewingStory(null)} userProfile={allProfiles.find(p => p.id === viewingStory.userId)} getAvatar={getAvatar} currentUserId={user.id} fetchData={fetchData} />}
      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} getAvatar={getAvatar} darkMode={darkMode} uploadToCloudinary={uploadToCloudinary} />}
      {groupTarget && <GroupChatScreen target={groupTarget} setGroupTarget={setGroupTarget} currentUser={user} getAvatar={getAvatar} darkMode={darkMode} />}
      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} currentUser={user} allProfiles={allProfiles} setGroupTarget={setGroupTarget} getAvatar={getAvatar} darkMode={darkMode} />}

      {/* メインビューの切り替え */}
      {view === 'home' && (
        <div className="animate-in fade-in">
          <header className={`sticky top-0 z-30 backdrop-blur-md border-b p-4 flex justify-between items-center ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-50'}`}>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-cyan-500 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1">
              <Zap size={24} className="text-blue-600 fill-blue-600" /> Beta
            </h1>
            <div className="flex items-center gap-4">
              <div className="relative cursor-pointer" onClick={() => { setView('notifications'); markNotificationsAsRead(); }}>
                <Bell size={24} />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">{unreadCount}</span>}
              </div>
            </div>
          </header>

          {/* ストーリーバー */}
          <div className={`p-4 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
            <div className="inline-flex flex-col items-center gap-1 cursor-pointer relative shrink-0">
              <div className="relative" onClick={() => { if (groupedStories[user.id]) setViewingStory({ userId: user.id, index: 0 }); else storyInputRef.current.click(); }}>
                <div className={`rounded-full p-[2px] ${groupedStories[user.id] ? 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500' : 'bg-transparent'}`}>
                  <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className={`w-16 h-16 rounded-full object-cover border-2 ${darkMode ? 'border-black' : 'border-white'}`} />
                </div>
                {!groupedStories[user.id] && <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1 border-2 border-black" onClick={(e) => { e.stopPropagation(); storyInputRef.current.click(); }}><Plus size={12} className="text-white" /></div>}
              </div>
              <span className="text-[10px] font-bold text-gray-400">Your Story</span>
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

          {/* 投稿フォーム */}
          <form onSubmit={handlePost} className={`p-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            <div className="flex gap-3">
              <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-10 h-10 rounded-full object-cover cursor-pointer" onClick={() => openProfile(user.id)} />
              <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none bg-transparent font-medium" placeholder="今何してる？" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-12 mt-2">
              <label className="cursor-pointer text-blue-500 p-2 rounded-full transition"><ImageIcon size={22}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
              <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs uppercase tracking-tighter">
                {uploading ? '...' : 'Beta It'}
              </button>
            </div>
          </form>

          {/* タイムライン */}
          <div className="divide-y divide-gray-800">
            {posts.map(post => (
              <div key={post.id} className="p-4 flex gap-3">
                <img src={getAvatar(post.profiles.username, post.profiles.avatar_url)} className="w-10 h-10 rounded-full object-cover cursor-pointer" onClick={() => openProfile(post.user_id)} />
                <div className="flex-grow">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="font-bold text-sm">{post.profiles.display_name}</span>
                    <span className="text-gray-500 text-xs">@{post.profiles.username}</span>
                  </div>
                  <p className="text-sm mb-3 whitespace-pre-wrap">{renderContent(post.content)}</p>
                  {post.image_url && <img src={post.image_url} className="rounded-2xl w-full mb-3 object-cover max-h-80 border border-gray-800" />}
                  <div className="flex justify-between max-w-xs text-gray-500">
                    <button className={`flex items-center gap-1 hover:text-red-500 transition ${post.is_liked ? 'text-red-500' : ''}`} onClick={() => toggleLike(post.id, post.is_liked)}>
                      <Heart size={18} fill={post.is_liked ? "currentColor" : "none"} /> <span className="text-xs">{post.like_count}</span>
                    </button>
                    <MessageCircle size={18} className="hover:text-blue-500 transition" />
                    <Share2 size={18} className="hover:text-green-500 transition" onClick={() => handleShare(post)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} setDmTarget={setDmTarget} setGroupTarget={setGroupTarget} setShowCreateGroup={setShowCreateGroup} getAvatar={getAvatar} darkMode={darkMode} />}
      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} allProfiles={allProfiles} searchQuery={searchQuery} setSearchQuery={setSearchQuery} darkMode={darkMode} />}
      {view === 'profile' && profileInfo && <ProfileView profileInfo={profileInfo} posts={posts} darkMode={darkMode} getAvatar={getAvatar} stats={stats} />}

      {/* ナビゲーションバー */}
      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 shadow-sm ${darkMode ? 'bg-black/95 border-gray-800 text-gray-600' : 'bg-white/95 border-gray-100 text-gray-300'}`}>
        <HomeIcon onClick={() => setView('home')} className={`cursor-pointer transition hover:scale-110 ${view === 'home' ? 'text-blue-600' : ''}`} />
        <Search onClick={() => setView('search')} className={`cursor-pointer transition hover:scale-110 ${view === 'search' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <MessageCircle onClick={() => setView('messages')} className={`cursor-pointer transition hover:scale-110 ${view === 'messages' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer transition hover:scale-110 ${view === 'profile' && activeProfileId === user.id ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
      </nav>
    </div>
  );
}

// --- DMコンポーネント ---
function MessagesList({ allProfiles, user, setDmTarget, setGroupTarget, setShowCreateGroup, getAvatar, darkMode }) {
  const [mutualFollows, setMutualFollows] = useState([]);
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    async function fetchList() {
      const { data: fing } = await supabase.from('follows').select('following_id').eq('follower_id', user.id);
      const { data: fers } = await supabase.from('follows').select('follower_id').eq('following_id', user.id);
      if (fing && fers) {
        const mutualIds = fing.map(f => f.following_id).filter(id => fers.map(r => r.follower_id).includes(id));
        setMutualFollows(allProfiles.filter(p => mutualIds.includes(p.id)));
      }
      const { data: gData } = await supabase.from('group_members').select('group_id, groups(*)').eq('user_id', user.id);
      if (gData) setGroups(gData.map(d => d.groups));
    }
    fetchList();
  }, [allProfiles]);

  return (
    <div className="animate-in fade-in h-full flex flex-col">
      <header className={`p-4 border-b font-black text-lg flex justify-between items-center ${darkMode ? 'bg-black' : 'bg-white'}`}>
        <span>Direct Messages</span>
        <Users size={22} className="text-blue-500 cursor-pointer" onClick={() => setShowCreateGroup(true)} />
      </header>
      <div className="overflow-y-auto">
        {groups.map(g => (
          <div key={g.id} className="p-4 flex items-center gap-4 cursor-pointer border-b border-gray-800" onClick={() => setGroupTarget(g)}>
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center font-black">{g.name[0]}</div>
            <div><p className="font-bold">{g.name}</p><p className="text-xs text-gray-500">Group Chat</p></div>
          </div>
        ))}
        {mutualFollows.map(u => (
          <div key={u.id} className="p-4 flex items-center gap-4 cursor-pointer border-b border-gray-800" onClick={() => setDmTarget(u)}>
            <div className="relative">
              <img src={getAvatar(u.username, u.avatar_url)} className="w-12 h-12 rounded-full object-cover" />
              {isOnline(u.last_seen_at) && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full" />}
            </div>
            <div><p className="font-bold">{u.display_name}</p><p className="text-xs text-gray-500">@{u.username}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DMScreen({ target, setDmTarget, currentUser, getAvatar, darkMode, uploadToCloudinary }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef();

  useEffect(() => {
    fetchMessages();
    const channel = supabase.channel(`dm:${target.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
        if ((p.new.sender_id === currentUser.id && p.new.receiver_id === target.id) || 
            (p.new.sender_id === target.id && p.new.receiver_id === currentUser.id)) {
          setMessages(prev => [...prev, p.new]);
        }
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [target]);

  async function fetchMessages() {
    const { data } = await supabase.from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  }

  async function sendMsg(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const t = text; setText('');
    await supabase.from('messages').insert([{ text: t, sender_id: currentUser.id, receiver_id: target.id }]);
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className={`fixed inset-0 z-[120] flex flex-col ${darkMode ? 'bg-black' : 'bg-white'}`}>
      <header className="p-4 border-b flex items-center gap-3">
        <ChevronLeft onClick={() => setDmTarget(null)} />
        <img src={getAvatar(target.username, target.avatar_url)} className="w-8 h-8 rounded-full" />
        <p className="font-bold">{target.display_name}</p>
      </header>
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-2xl max-w-[75%] ${m.sender_id === currentUser.id ? 'bg-blue-600' : 'bg-gray-800'}`}>
              <p className="text-sm">{m.text}</p>
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <form onSubmit={sendMsg} className="p-4 flex gap-2 border-t border-gray-800">
        <input className="flex-grow bg-gray-900 p-3 rounded-full outline-none text-sm" value={text} onChange={e => setText(e.target.value)} placeholder="メッセージを送信..." />
        <button className="bg-blue-600 p-3 rounded-full"><Send size={18}/></button>
      </form>
    </div>
  );
}

// --- 検索・ストーリー・プロフィールの簡易版コンポーネント ---
function SearchView({ posts, searchQuery, setSearchQuery, darkMode }) {
  const filtered = posts.filter(p => p.content.includes(searchQuery));
  return (
    <div className="p-4">
      <div className={`flex items-center gap-2 px-4 py-2 rounded-full mb-4 ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <Search size={18} className="text-gray-500" />
        <input className="bg-transparent outline-none w-full text-sm" placeholder="検索..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-1">
        {filtered.map(p => p.image_url && <img key={p.id} src={p.image_url} className="aspect-square object-cover" />)}
      </div>
    </div>
  );
}

function StoryCreator({ file, onClose, onPublish, getAvatar, myProfile }) {
  const [filter, setFilter] = useState('none');
  const canvasRef = useRef();

  const handleSave = () => {
    canvasRef.current.toBlob(blob => onPublish(blob));
  };

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      canvasRef.current.width = 1080;
      canvasRef.current.height = 1920;
      if (filter === 'grayscale') ctx.filter = 'grayscale(100%)';
      else if (filter === 'sepia') ctx.filter = 'sepia(100%)';
      else ctx.filter = 'none';
      ctx.drawImage(img, 0, 0, 1080, 1920);
    };
  }, [file, filter]);

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <div className="p-4 flex justify-between items-center text-white">
        <X onClick={onClose} />
        <button onClick={handleSave} className="bg-white text-black px-4 py-1 rounded-full font-bold">Share</button>
      </div>
      <canvas ref={canvasRef} className="flex-grow object-contain max-h-[80vh]" />
      <div className="p-6 flex gap-4 overflow-x-auto">
        {['none', 'grayscale', 'sepia'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl border ${filter === f ? 'border-blue-500' : 'border-white'}`}>{f}</button>
        ))}
      </div>
    </div>
  );
}

function StoryViewer({ stories, onClose, userProfile, getAvatar, currentUserId, fetchData }) {
  const [idx, setIdx] = useState(0);
  const story = stories[idx];

  const deleteStory = async () => {
    if(!window.confirm("Delete?")) return;
    await supabase.from('stories').delete().eq('id', story.id);
    onClose(); fetchData();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center">
      <div className="absolute top-4 left-0 right-0 px-4 flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
          <img src={getAvatar(userProfile.username, userProfile.avatar_url)} className="w-8 h-8 rounded-full" />
          <span className="font-bold">{userProfile.display_name}</span>
        </div>
        <div className="flex gap-4">
          {userProfile.id === currentUserId && <Trash2 onClick={deleteStory} />}
          <X onClick={onClose} />
        </div>
      </div>
      <img src={story.image_url} className="max-h-screen w-full object-contain" onClick={() => setIdx((idx + 1) % stories.length)} />
    </div>
  );
}

function ProfileView({ profileInfo, posts, stats, getAvatar, darkMode }) {
  return (
    <div className="animate-in fade-in">
      <div className="h-32 bg-gray-800 relative">
        {profileInfo.header_url && <img src={profileInfo.header_url} className="w-full h-full object-cover" />}
        <img src={getAvatar(profileInfo.username, profileInfo.avatar_url)} className="w-20 h-20 rounded-full border-4 border-black absolute -bottom-10 left-4" />
      </div>
      <div className="p-4 pt-12">
        <h2 className="text-xl font-black">{profileInfo.display_name}</h2>
        <p className="text-gray-500 mb-4">@{profileInfo.username}</p>
        <p className="text-sm mb-4">{profileInfo.bio}</p>
        <div className="flex gap-4 text-sm font-bold">
          <span>{stats.following} Following</span>
          <span>{stats.followers} Followers</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 mt-4">
        {posts.filter(p => p.user_id === profileInfo.id).map(p => p.image_url && <img key={p.id} src={p.image_url} className="aspect-square object-cover" />)}
      </div>
    </div>
  );
}

function CreateGroupModal({ onClose, currentUser, allProfiles, setGroupTarget, getAvatar, darkMode }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);
  const handleCreate = async () => {
    if (!name || selected.length === 0) return;
    const { data: group } = await supabase.from('groups').insert([{ name, created_by: currentUser.id }]).select().single();
    if (group) {
      const members = [...selected, currentUser.id].map(uid => ({ group_id: group.id, user_id: uid }));
      await supabase.from('group_members').insert(members);
      setGroupTarget(group); onClose();
    }
  };
  return (
    <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-gray-900 rounded-3xl p-6">
        <h3 className="font-bold mb-4">Create Group</h3>
        <input placeholder="Group Name" className="w-full bg-black p-3 rounded-xl mb-4 outline-none" value={name} onChange={e => setName(e.target.value)} />
        <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
          {allProfiles.filter(p => p.id !== currentUser.id).map(u => (
            <div key={u.id} className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer ${selected.includes(u.id) ? 'bg-blue-600' : ''}`} onClick={() => setSelected(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])}>
              <img src={getAvatar(u.username, u.avatar_url)} className="w-8 h-8 rounded-full" />
              <span className="text-sm font-bold">{u.display_name}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-grow py-3 bg-gray-800 rounded-xl">Cancel</button>
          <button onClick={handleCreate} className="flex-grow py-3 bg-blue-600 rounded-xl">Create</button>
        </div>
      </div>
    </div>
  );
}

function GroupChatScreen({ target, setGroupTarget, currentUser, getAvatar, darkMode }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  useEffect(() => {
    fetchGroupMessages();
    const channel = supabase.channel(`group:${target.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${target.id}` }, (p) => {
        setMessages(prev => [...prev, p.new]);
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [target]);

  async function fetchGroupMessages() {
    const { data } = await supabase.from('messages').select('*, profiles(username, avatar_url, display_name)').eq('group_id', target.id).order('created_at', { ascending: true });
    if (data) setMessages(data);
  }

  async function sendMsg(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const t = text; setText('');
    await supabase.from('messages').insert([{ text: t, sender_id: currentUser.id, group_id: target.id }]);
  }

  return (
    <div className={`fixed inset-0 z-[120] flex flex-col ${darkMode ? 'bg-black' : 'bg-white'}`}>
      <header className="p-4 border-b flex items-center gap-3">
        <ChevronLeft onClick={() => setGroupTarget(null)} />
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">{target.name[0]}</div>
        <p className="font-bold">{target.name}</p>
      </header>
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex gap-2 ${m.sender_id === currentUser.id ? 'flex-row-reverse' : 'flex-row'}`}>
            <img src={getAvatar(m.profiles?.username, m.profiles?.avatar_url)} className="w-6 h-6 rounded-full" />
            <div className={`p-3 rounded-2xl ${m.sender_id === currentUser.id ? 'bg-blue-600' : 'bg-gray-800'}`}>
               <p className="text-[9px] opacity-60">{m.profiles?.display_name}</p>
               <p className="text-sm">{m.text}</p>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={sendMsg} className="p-4 flex gap-2 border-t border-gray-800">
        <input className="flex-grow bg-gray-900 p-3 rounded-full outline-none text-sm" value={text} onChange={e => setText(e.target.value)} placeholder="Group message..." />
        <button className="bg-blue-600 p-3 rounded-full"><Send size={18}/></button>
      </form>
    </div>
  );
                }
