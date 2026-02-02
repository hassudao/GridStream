import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, 
  User as UserIcon, ImageIcon, Send, ChevronLeft, Zap, LogOut, Settings, 
  Trash2, MessageSquare, Plus, Type, Check, Palette, Maximize2,
  UserPlus, UserMinus, Bell
} from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = 'dtb3jpadj'; 
const CLOUDINARY_UPLOAD_PRESET = 'alpha-sns';

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const renderContent = (text) => {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all" onClick={(e) => e.stopPropagation()}>
          {part}
        </a>
      );
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
  const [editData, setEditData] = useState({ display_name: '', username: '', bio: '', avatar_url: '', header_url: '' });
  const [myProfile, setMyProfile] = useState({ username: '', display_name: '', bio: '', avatar_url: '', header_url: '' });
  const [newPost, setNewPost] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [uploading, setUploading] = useState(false);
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
      fetchMyProfile(user.id);
      fetchData();
      fetchNotifications();
      const channel = supabase
        .channel(`public:notifications:receiver_id=eq.${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${user.id}` }, () => fetchNotifications())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
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
    } else { setGroupedStories({}); }
  }, [stories, allProfiles]);

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
      .select(`*, profiles(id, username, display_name, avatar_url), likes(user_id), comments(id)`)
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
    const { data: storiesData } = await supabase.from('stories').select('*').gt('created_at', yesterday).order('created_at', { ascending: true });
    setStories(storiesData || []);
    const { data: profData } = await supabase.from('profiles').select('*');
    if (profData) setAllProfiles(profData);
  }

  async function fetchNotifications() {
    if (!user) return;
    const { data } = await supabase.from('notifications').select('*, sender:profiles!notifications_sender_id_fkey(*)').eq('receiver_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (data) { setNotifications(data); setUnreadCount(data.filter(n => !n.is_read).length); }
  }

  async function sendNotification(receiverId, type, postId = null) {
    if (!user || user.id === receiverId) return;
    await supabase.from('notifications').insert([{ sender_id: user.id, receiver_id: receiverId, type: type, post_id: postId, is_read: false }]);
  }

  async function markNotificationsAsRead() {
    if (!user || unreadCount === 0) return;
    await supabase.from('notifications').update({ is_read: true }).eq('receiver_id', user.id);
    setUnreadCount(0);
  }

  async function notifyFollowers(type, postId = null) {
    const { data: followers } = await supabase.from('follows').select('follower_id').eq('following_id', user.id);
    if (followers?.length > 0) {
      const notes = followers.map(f => ({ sender_id: user.id, receiver_id: f.follower_id, type: type, post_id: postId }));
      await supabase.from('notifications').insert(notes);
    }
  }

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
      await notifyFollowers('story');
      fetchData(); 
    } catch (e) { alert("Upload failed"); } finally { setUploading(false); }
  };

  const handleDeleteStory = async (storyId) => {
    if(!window.confirm("Delete this story?")) return;
    await supabase.from('stories').delete().eq('id', storyId);
    setViewingStory(null); fetchData();
  };

  async function toggleLike(postId, isLiked) {
    if (!user) return;
    const post = posts.find(p => p.id === postId);
    const update = (p) => p.id === postId ? { ...p, is_liked: !isLiked, like_count: isLiked ? Math.max(0, p.like_count - 1) : p.like_count + 1 } : p;
    setPosts(prev => prev.map(update));
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
    const { data } = await supabase.from('posts').insert([{ content: newPost, user_id: user.id, image_url: imageUrl }]).select().single();
    if (data) await notifyFollowers('post', data.id);
    setNewPost(''); if (fileInputRef.current) fileInputRef.current.value = "";
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
  const [dmTarget, setDmTarget] = useState(null);

  if (!user) return <AuthScreen fetchData={fetchData} />;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-black text-white' : 'bg-white text-black'} font-sans`}>
      <div className={`max-w-md mx-auto min-h-screen border-x relative shadow-2xl flex flex-col ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
        {/* Story Overlay Components */}
        {creatingStory && <StoryCreator file={creatingStory} onClose={() => setCreatingStory(false)} onPublish={handleStoryPublish} myProfile={myProfile} getAvatar={getAvatar} />}
        {viewingStory && <StoryViewer stories={groupedStories[viewingStory.userId]} initialIndex={viewingStory.index} onClose={() => setViewingStory(null)} userProfile={allProfiles.find(p => p.id === viewingStory.userId)} getAvatar={getAvatar} currentUserId={user.id} onDelete={handleDeleteStory} />}
        
        {/* Modal Overlay Components */}
        {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} getAvatar={getAvatar} darkMode={darkMode} />}
        {showFollowList && <FollowListModal type={showFollowList} userId={activeProfileId} onClose={() => setShowFollowList(null)} openProfile={openProfile} getAvatar={getAvatar} darkMode={darkMode} />}
        {selectedPost && <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} getAvatar={getAvatar} openProfile={openProfile} onLike={toggleLike} currentUser={user} darkMode={darkMode} refreshPosts={fetchData} sendNotification={sendNotification} />}
        {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} user={user} myProfile={myProfile} darkMode={darkMode} setDarkMode={setDarkMode} />}

        {/* Main View Container */}
        <main className="flex-grow pb-20 overflow-y-auto">
          {view === 'home' && (
            <div className="animate-in fade-in duration-500">
              <header className={`sticky top-0 z-30 backdrop-blur-md border-b p-4 flex justify-between items-center ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-50'}`}>
                <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1">
                  <Zap size={24} className="text-blue-600 fill-blue-600" /> GridStream
                </h1>
                <div className="flex items-center gap-4">
                  <div className="relative cursor-pointer" onClick={() => { setView('notifications'); markNotificationsAsRead(); }}>
                    <Bell size={24} />
                    {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">{unreadCount}</span>}
                  </div>
                  <MessageCircle size={24} className="cursor-pointer" onClick={() => setView('messages')} />
                </div>
              </header>

              {/* Story Bar */}
              <div className={`p-4 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
                <div className="inline-flex flex-col items-center gap-1 cursor-pointer shrink-0">
                  <div className="relative" onClick={() => { if (groupedStories[user.id]) setViewingStory({ userId: user.id, index: 0 }); else storyInputRef.current.click(); }}>
                    <div className={`rounded-full p-[2px] ${groupedStories[user.id] ? 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500' : 'bg-transparent'}`}>
                      <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className={`w-14 h-14 rounded-full object-cover border-2 ${darkMode ? 'border-black' : 'border-white'}`} />
                    </div>
                    <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1 border-2 border-black">
                      <Plus size={10} className="text-white" />
                    </div>
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
                         <img src={getAvatar(uProfile.username, uProfile.avatar_url)} className={`w-14 h-14 rounded-full object-cover border-2 ${darkMode ? 'border-black' : 'border-white'}`} />
                       </div>
                       <span className="text-[10px] font-bold max-w-[60px] truncate">{uProfile.display_name}</span>
                     </div>
                   );
                })}
              </div>

              {/* Post Form */}
              <form onSubmit={handlePost} className={`p-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
                <div className="flex gap-3">
                  <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-10 h-10 rounded-full object-cover cursor-pointer" onClick={() => openProfile(user.id)} />
                  <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none bg-transparent font-medium" placeholder="What's happening?" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
                </div>
                <div className="flex justify-between items-center pl-12 mt-2">
                  <label className="cursor-pointer text-blue-500 p-2 hover:bg-blue-500/10 rounded-full transition"><ImageIcon size={22}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
                  <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition">
                    {uploading ? '...' : 'Stream'}
                  </button>
                </div>
              </form>

              {/* Post List */}
              <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
                {posts.map(post => <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onLike={toggleLike} currentUser={user} darkMode={darkMode} onOpenDetail={() => setSelectedPost(post)} />)}
              </div>
            </div>
          )}

          {view === 'profile' && profileInfo && (
            <ProfileView user={user} activeProfileId={activeProfileId} profileInfo={profileInfo} posts={posts} isEditing={isEditing} setIsEditing={setIsEditing} editData={editData} setEditData={setEditData} handleUpdateProfile={async () => {
              setUploading(true);
              let { avatar_url, header_url } = editData;
              if (avatarInputRef.current?.files[0]) avatar_url = await uploadToCloudinary(avatarInputRef.current.files[0]);
              if (headerInputRef.current?.files[0]) header_url = await uploadToCloudinary(headerInputRef.current.files[0]);
              await supabase.from('profiles').update({ ...editData, avatar_url, header_url }).eq('id', user.id);
              await fetchMyProfile(user.id); setIsEditing(false); setUploading(false);
            }} uploading={uploading} avatarInputRef={avatarInputRef} headerInputRef={headerInputRef} getAvatar={getAvatar} openProfile={openProfile} toggleFollow={toggleFollow} stats={stats} setShowFollowList={setShowFollowList} setShowSettings={setShowSettings} darkMode={darkMode} setView={setView} toggleLike={toggleLike} setSelectedPost={setSelectedPost} />
          )}

          {view === 'search' && <SearchView posts={posts} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSelectedPost={setSelectedPost} darkMode={darkMode} />}
          {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} setDmTarget={setDmTarget} getAvatar={getAvatar} openProfile={openProfile} darkMode={darkMode} />}
          {view === 'notifications' && <NotificationCenter notifications={notifications} getAvatar={getAvatar} openProfile={openProfile} setSelectedPost={(id) => { const p = posts.find(x => x.id === id); if(p) setSelectedPost(p); }} darkMode={darkMode} />}
        </main>

        {/* Tab Navigation */}
        <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 shadow-2xl backdrop-blur-lg ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-100'}`}>
          <HomeIcon onClick={() => setView('home')} className={`cursor-pointer transition ${view === 'home' ? 'text-blue-600 scale-110' : 'text-gray-500'}`} />
          <Search onClick={() => setView('search')} className={`cursor-pointer transition ${view === 'search' ? (darkMode ? 'text-white' : 'text-black') : 'text-gray-500'}`} />
          <Bell onClick={() => { setView('notifications'); markNotificationsAsRead(); }} className={`cursor-pointer transition ${view === 'notifications' ? (darkMode ? 'text-white' : 'text-black') : 'text-gray-500'}`} />
          <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer transition ${view === 'profile' && activeProfileId === user.id ? (darkMode ? 'text-white' : 'text-black') : 'text-gray-500'}`} />
        </nav>
      </div>
    </div>
  );
}

// --- Sub-components ---

function PostCard({ post, openProfile, getAvatar, onLike, currentUser, darkMode, onOpenDetail }) {
  return (
    <article className={`p-4 flex gap-3 transition border-b last:border-0 ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
      <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer object-cover shadow-sm" onClick={() => openProfile(post.profiles?.id)} />
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-start mb-1">
          <div className="flex flex-col cursor-pointer" onClick={() => openProfile(post.profiles?.id)}>
            <span className="font-black text-sm">{post.profiles?.display_name}</span>
            <span className="text-gray-400 text-[11px] font-bold">@{post.profiles?.username}</span>
          </div>
          <span className="text-[10px] text-gray-400 font-bold">{formatTime(post.created_at)}</span>
        </div>
        <div className="text-[15px] mt-1 font-medium leading-relaxed whitespace-pre-wrap">{renderContent(post.content)}</div>
        {post.image_url && (
          <div className="mt-3 rounded-2xl overflow-hidden border border-gray-100/10 shadow-sm" onClick={onOpenDetail}>
            <img src={post.image_url} className="w-full max-h-80 object-cover cursor-pointer hover:scale-105 transition duration-500" />
          </div>
        )}
        <div className="flex gap-6 mt-4 text-gray-500 items-center">
          <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 transition ${post.is_liked ? 'text-red-500 scale-110' : 'hover:text-red-500'}`}>
            <Heart size={18} fill={post.is_liked ? "currentColor" : "none"} />
            <span className="text-xs font-black">{post.like_count || ''}</span>
          </button>
          <button onClick={onOpenDetail} className="flex items-center gap-1.5 hover:text-blue-500 transition">
            <MessageSquare size={18} />
            <span className="text-xs font-black">{post.comment_count || ''}</span>
          </button>
          <button className="hover:text-green-500 transition"><Share2 size={18} /></button>
        </div>
      </div>
    </article>
  );
}

function NotificationCenter({ notifications, getAvatar, openProfile, setSelectedPost, darkMode }) {
  const getMessage = (n) => {
    switch (n.type) {
      case 'like': return 'liked your post';
      case 'comment': return 'commented on your post';
      case 'follow': return 'started following you';
      case 'post': return 'posted a new stream';
      case 'story': return 'updated their story';
      default: return 'sent a notification';
    }
  };
  return (
    <div className="animate-in fade-in">
      <header className="p-4 border-b font-black text-lg text-center uppercase italic sticky top-0 z-10 bg-inherit/90 backdrop-blur-md">Notifications</header>
      {notifications.length === 0 ? (
        <div className="p-20 text-center text-gray-500 font-bold text-xs uppercase tracking-widest">No notifications yet</div>
      ) : (
        <div className="divide-y divide-gray-800/10">
          {notifications.map(n => (
            <div key={n.id} className={`p-4 flex gap-4 items-center cursor-pointer transition ${!n.is_read ? (darkMode ? 'bg-blue-900/10' : 'bg-blue-50') : ''}`} onClick={() => { if (n.post_id) setSelectedPost(n.post_id); else openProfile(n.sender_id); }}>
              <img src={getAvatar(n.sender?.username, n.sender?.avatar_url)} className="w-12 h-12 rounded-full object-cover shadow-sm" />
              <div className="flex-grow">
                <p className="text-sm font-medium"><span className="font-black">@{n.sender?.username}</span> {getMessage(n)}</p>
                <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">{formatTime(n.created_at)}</p>
              </div>
              {n.type === 'like' && <Heart size={16} className="text-red-500 fill-red-500" />}
              {n.type === 'follow' && <UserPlus size={16} className="text-blue-500" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PostDetailModal({ post, onClose, getAvatar, openProfile, onLike, currentUser, darkMode, refreshPosts, sendNotification }) {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => { fetchComments(); }, [post.id]);
  async function fetchComments() {
    const { data } = await supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at', { ascending: false });
    if (data) setComments(data);
  }
  async function handlePostComment(e) {
    e.preventDefault(); if (!commentText.trim() || !currentUser) return;
    setLoading(true);
    await supabase.from('comments').insert([{ post_id: post.id, user_id: currentUser.id, content: commentText }]);
    sendNotification(post.user_id, 'comment', post.id);
    setCommentText(''); await fetchComments(); refreshPosts(); setLoading(false);
  }
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-[2.5rem] flex flex-col h-[85vh] overflow-hidden shadow-2xl ${darkMode ? 'bg-black border border-gray-800' : 'bg-white text-black'}`}>
        <div className={`p-4 border-b flex items-center justify-between ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
          <div className="flex items-center gap-3" onClick={() => { onClose(); openProfile(post.profiles?.id); }}>
            <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-8 h-8 rounded-full object-cover" />
            <span className="font-black text-xs">@{post.profiles?.username}</span>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition"><X size={24}/></button>
        </div>
        <div className="flex-grow overflow-y-auto">
          <div className="p-5 border-b border-gray-800/20">
            {post.image_url && <img src={post.image_url} className="w-full rounded-2xl mb-4 shadow-lg" />}
            <div className="text-lg font-medium leading-relaxed">{renderContent(post.content)}</div>
          </div>
          <div className="p-5 space-y-4">
            <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Comments</h4>
            {comments.map(c => (
              <div key={c.id} className="flex gap-3 animate-in slide-in-from-bottom-2">
                <img src={getAvatar(c.profiles?.username, c.profiles?.avatar_url)} className="w-8 h-8 rounded-full object-cover" />
                <div className={`flex-grow p-3 rounded-2xl ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                  <p className="font-black text-[10px] mb-1">@{c.profiles?.username}</p>
                  <p className="text-sm font-medium">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <form onSubmit={handlePostComment} className={`p-4 border-t flex gap-2 ${darkMode ? 'bg-black border-gray-800' : 'bg-white border-gray-100'}`}>
          <input type="text" placeholder="Add comment..." className={`flex-grow p-4 rounded-2xl text-sm outline-none font-medium ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50'}`} value={commentText} onChange={(e) => setCommentText(e.target.value)} />
          <button type="submit" disabled={loading} className="bg-blue-600 text-white p-4 rounded-2xl active:scale-95 transition"><Send size={18}/></button>
        </form>
      </div>
    </div>
  );
}

function StoryCreator({ file, onClose, onPublish, myProfile, getAvatar }) {
  const [textMode, setTextMode] = useState(false);
  const [text, setText] = useState('');
  const [textStyle, setTextStyle] = useState({ fontIndex: 0, colorIndex: 0, size: 50, x: 0, y: 0, scale: 1 });
  const imgRef = useRef(null);
  const [previewSrc, setPreviewSrc] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const handleStart = (e) => {
    if (textMode) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setIsDragging(true);
    dragStart.current = { x: clientX - textStyle.x, y: clientY - textStyle.y };
  };
  const handleMove = (e) => {
    if (!isDragging || !text) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setTextStyle(prev => ({ ...prev, x: clientX - dragStart.current.x, y: clientY - dragStart.current.y }));
  };
  const handleEnd = () => setIsDragging(false);
  const handlePublish = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = imgRef.current;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    if (text) {
      const fontSize = (img.naturalWidth / 10) * (0.5 + textStyle.size / 50) * textStyle.scale;
      const fontMap = { 'Classic': 'serif', 'Modern': 'sans-serif', 'Typewriter': 'monospace', 'Neon': 'cursive' };
      ctx.font = `bold ${fontSize}px ${fontMap[FONT_STYLES[textStyle.fontIndex].name]}`;
      ctx.fillStyle = TEXT_COLORS[textStyle.colorIndex];
      ctx.textAlign = 'center';
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 15;
      const container = document.getElementById('story-preview-container');
      const rect = container.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      ctx.fillText(text, canvas.width / 2 + (textStyle.x * scaleX), canvas.height / 2 + (textStyle.y * scaleY));
    }
    canvas.toBlob((blob) => onPublish(blob), 'image/jpeg', 0.9);
  };
  return (
    <div className="fixed inset-0 z-[110] bg-black flex flex-col overflow-hidden touch-none" onMouseMove={handleMove} onTouchMove={handleMove} onMouseUp={handleEnd} onTouchEnd={handleEnd}>
      <img ref={imgRef} src={previewSrc} className="hidden" />
      <div className="absolute top-0 w-full p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/50 to-transparent">
        <button onClick={onClose} className="p-2 bg-black/40 rounded-full text-white"><X /></button>
        <button onClick={() => setTextMode(true)} className="p-2 bg-black/40 rounded-full text-white"><Type /></button>
      </div>
      <div id="story-preview-container" className="flex-grow relative flex items-center justify-center overflow-hidden">
        {previewSrc && <img src={previewSrc} className="w-full h-full object-contain pointer-events-none" />}
        {text && (
          <div onMouseDown={handleStart} onTouchStart={handleStart} className={`absolute cursor-move select-none text-center whitespace-pre-wrap leading-tight p-4 ${FONT_STYLES[textStyle.fontIndex].css}`} style={{ color: TEXT_COLORS[textStyle.colorIndex], fontSize: `${(1.5 + textStyle.size / 20) * textStyle.scale}rem`, transform: `translate(${textStyle.x}px, ${textStyle.y}px)`, textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
            {text}
          </div>
        )}
      </div>
      {textMode && (
        <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex flex-col justify-center items-center">
           <button onClick={() => setTextMode(false)} className="absolute top-4 right-4 text-white font-bold">Done</button>
           <textarea autoFocus value={text} onChange={e => setText(e.target.value)} className={`bg-transparent text-center w-full outline-none resize-none placeholder-white/50 ${FONT_STYLES[textStyle.fontIndex].css}`} style={{ color: TEXT_COLORS[textStyle.colorIndex], fontSize: `${1.5 + textStyle.size / 20}rem` }} placeholder="Type..." rows={3} />
        </div>
      )}
      {!textMode && (
        <div className="p-6 bg-gradient-to-t from-black to-transparent flex justify-between items-center">
          <div className="flex items-center gap-2"><img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-8 h-8 rounded-full border-2 border-white" /><span className="text-white text-xs font-bold">Your Story</span></div>
          <button onClick={handlePublish} className="bg-white text-black rounded-full px-6 py-3 font-black uppercase text-xs shadow-xl active:scale-95 transition">Share Now</button>
        </div>
      )}
    </div>
  );
}

function StoryViewer({ stories, initialIndex, onClose, userProfile, getAvatar, currentUserId, onDelete }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const STORY_DURATION = 5000;
  useEffect(() => {
    if (!stories?.[currentIndex]) return;
    setProgress(0);
    startTimeRef.current = Date.now();
    const animate = () => {
      if (isPaused) return;
      const elapsed = Date.now() - startTimeRef.current;
      const p = (elapsed / STORY_DURATION) * 100;
      setProgress(p);
      if (elapsed < STORY_DURATION) timerRef.current = requestAnimationFrame(animate);
      else { if (currentIndex < stories.length - 1) setCurrentIndex(prev => prev + 1); else onClose(); }
    };
    timerRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(timerRef.current);
  }, [currentIndex, isPaused]);
  return (
    <div className="fixed inset-0 z-[110] bg-black flex items-center justify-center">
      <div className="relative w-full max-w-md h-full bg-gray-900 flex flex-col" onMouseDown={() => setIsPaused(true)} onMouseUp={() => setIsPaused(false)} onTouchStart={() => setIsPaused(true)} onTouchEnd={() => setIsPaused(false)}>
        <div className="absolute top-0 left-0 right-0 z-20 p-2 flex gap-1">
          {stories.map((_, idx) => (
            <div key={idx} className="h-1 flex-grow bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all duration-100" style={{ width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%' }} />
            </div>
          ))}
        </div>
        <div className="absolute top-6 left-0 right-0 z-20 p-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src={getAvatar(userProfile.username, userProfile.avatar_url)} className="w-8 h-8 rounded-full border border-white/50" />
            <span className="text-white text-sm font-bold shadow-sm">{userProfile.display_name}</span>
          </div>
          <div className="flex items-center gap-2">
            {currentUserId === stories[currentIndex].user_id && <button onClick={() => onDelete(stories[currentIndex].id)} className="text-white/80 p-2"><Trash2 size={20} /></button>}
            <button onClick={onClose} className="text-white p-2"><X size={24} /></button>
          </div>
        </div>
        <img src={stories[currentIndex].image_url} className="w-full h-full object-contain bg-black" />
      </div>
    </div>
  );
}

function ProfileView({ user, activeProfileId, profileInfo, posts, isEditing, setIsEditing, editData, setEditData, handleUpdateProfile, uploading, avatarInputRef, headerInputRef, getAvatar, openProfile, toggleFollow, stats, setShowFollowList, setShowSettings, darkMode, setView, toggleLike, setSelectedPost }) {
  if (isEditing) {
    return (
      <div className="animate-in slide-in-from-bottom">
        <header className="p-4 flex justify-between items-center sticky top-0 z-10 bg-inherit/90 backdrop-blur-md border-b">
          <button onClick={() => setIsEditing(false)}><X size={24}/></button>
          <h2 className="font-black uppercase tracking-widest text-sm">Edit Profile</h2>
          <button onClick={handleUpdateProfile} disabled={uploading} className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase">Save</button>
        </header>
        <div className="relative h-40 bg-gray-200">
           <img src={editData.header_url || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&q=80'} className="w-full h-full object-cover" />
           <div onClick={() => headerInputRef.current.click()} className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"><Camera className="text-white" /><input type="file" ref={headerInputRef} className="hidden" accept="image/*" /></div>
        </div>
        <div className="px-4 -mt-10 relative z-10 flex flex-col items-center">
           <div className="relative group" onClick={() => avatarInputRef.current.click()}>
             <img src={getAvatar(editData.username, editData.avatar_url)} className="w-24 h-24 rounded-full border-4 border-blue-600 object-cover bg-white" />
             <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="text-white"/></div>
             <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" />
           </div>
        </div>
        <div className="p-6 space-y-4">
           <div className={`p-4 rounded-2xl ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}><label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Display Name</label><input className="w-full bg-transparent outline-none font-bold" value={editData.display_name} onChange={e => setEditData({...editData, display_name: e.target.value})} /></div>
           <div className={`p-4 rounded-2xl ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}><label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Bio</label><textarea className="w-full bg-transparent outline-none font-bold h-20 resize-none" value={editData.bio} onChange={e => setEditData({...editData, bio: e.target.value})} /></div>
        </div>
      </div>
    );
  }
  return (
    <div className="animate-in fade-in">
      <div className="relative h-44 bg-gray-200">
        <img src={profileInfo.header_url || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&q=80'} className="w-full h-full object-cover" />
        <div className="absolute top-4 inset-x-4 flex justify-between">
          <button onClick={() => setView('home')} className="bg-black/40 backdrop-blur-md p-2 rounded-full text-white"><ChevronLeft size={20}/></button>
          {user?.id === activeProfileId && <button onClick={() => setShowSettings(true)} className="bg-black/40 backdrop-blur-md p-2 rounded-full text-white"><Settings size={20}/></button>}
        </div>
      </div>
      <div className="px-4 relative">
        <div className="flex justify-between items-end -mt-12 mb-4">
          <img src={getAvatar(profileInfo.username, profileInfo.avatar_url)} className={`w-24 h-24 rounded-full border-4 shadow-xl object-cover ${darkMode ? 'border-black' : 'border-white'}`} />
          <div className="flex gap-2">
            {user?.id === activeProfileId ? (
              <button onClick={() => setIsEditing(true)} className={`border rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-tighter ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>Edit Profile</button>
            ) : (
              <button onClick={toggleFollow} className={`flex items-center gap-1.5 rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-tighter transition ${stats.isFollowing ? (darkMode ? 'bg-gray-800 text-white' : 'bg-gray-200 text-black') : 'bg-blue-600 text-white'}`}>
                {stats.isFollowing ? <><UserMinus size={14}/> Unfollow</> : <><UserPlus size={14}/> Follow</>}
              </button>
            )}
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tighter">{profileInfo.display_name}</h2>
          <p className="text-gray-400 text-sm font-bold">@{profileInfo.username}</p>
          <p className="mt-3 text-[15px] font-medium leading-relaxed">{profileInfo.bio || 'New GridStream member.'}</p>
          <div className="flex gap-4 mt-4">
            <button onClick={() => setShowFollowList('following')} className="text-sm"><span className="font-black">{stats.following}</span> <span className="text-gray-400">Following</span></button>
            <button onClick={() => setShowFollowList('followers')} className="text-sm"><span className="font-black">{stats.followers}</span> <span className="text-gray-400">Followers</span></button>
          </div>
        </div>
      </div>
      <div className={`divide-y mt-8 border-t ${darkMode ? 'border-gray-800 divide-gray-800' : 'border-gray-100 divide-gray-100'}`}>
        {posts.filter(p => p.user_id === activeProfileId).map(post => <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onLike={toggleLike} currentUser={user} darkMode={darkMode} onOpenDetail={() => setSelectedPost(post)} />)}
      </div>
    </div>
  );
}

function SettingsScreen({ onClose, user, darkMode, setDarkMode }) {
  const [updating, setUpdating] = useState(false);
  const handleLogout = () => { supabase.auth.signOut(); onClose(); };
  return (
    <div className={`fixed inset-0 z-[110] animate-in slide-in-from-bottom duration-300 ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <header className="p-4 border-b flex items-center gap-4 sticky top-0 z-10 bg-inherit"><ChevronLeft onClick={onClose} className="cursor-pointer" /><h2 className="font-black uppercase tracking-widest text-sm">Settings</h2></header>
      <div className="p-6 space-y-8">
        <section>
          <h3 className="text-gray-400 text-[10px] font-black uppercase mb-4 tracking-widest">Appearance</h3>
          <button onClick={() => setDarkMode(!darkMode)} className={`w-full flex justify-between items-center p-4 rounded-2xl ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
            <span className="text-sm font-bold">Dark Mode</span>
            <div className={`w-10 h-6 rounded-full relative transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${darkMode ? 'right-1' : 'left-1'}`} />
            </div>
          </button>
        </section>
        <section className="pt-4 border-t border-gray-800/10">
          <button onClick={handleLogout} className="w-full p-4 rounded-2xl bg-red-500/10 text-red-500 font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2"><LogOut size={16}/> Logout</button>
        </section>
      </div>
    </div>
  );
}

function SearchView({ posts, searchQuery, setSearchQuery, setSelectedPost, darkMode }) {
  const filteredPosts = posts.filter(p => p.image_url && (p.content?.toLowerCase().includes(searchQuery.toLowerCase()) || p.profiles?.username?.toLowerCase().includes(searchQuery.toLowerCase())));
  return (
    <div className="animate-in fade-in">
      <div className={`p-4 sticky top-0 z-10 border-b ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-100'}`}>
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input type="text" placeholder="DISCOVER" className={`w-full rounded-xl py-2 pl-10 pr-4 outline-none text-xs font-black uppercase ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100'}`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-[2px]">
        {filteredPosts.map((post) => (
          <img key={post.id} src={post.image_url} className="aspect-square w-full h-full object-cover cursor-pointer hover:opacity-80 transition" onClick={() => setSelectedPost(post)} />
        ))}
      </div>
      {filteredPosts.length === 0 && (
        <div className="p-20 text-center text-gray-500 text-xs font-black uppercase tracking-widest">No results found</div>
      )}
    </div>
  );
}

function MessagesList({ allProfiles, user, setDmTarget, getAvatar, openProfile, darkMode }) {
  return (
    <div className="animate-in fade-in">
      <header className="p-4 border-b font-black text-lg text-center uppercase italic sticky top-0 z-10 bg-inherit/90">Messages</header>
      <div className="p-2">
        {allProfiles.filter(p => p.id !== user?.id).map(u => (
          <div key={u.id} className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer hover:bg-blue-500/5 transition" onClick={() => setDmTarget(u)}>
            <img src={getAvatar(u.username, u.avatar_url)} className="w-14 h-14 rounded-full object-cover shadow-sm" onClick={(e) => { e.stopPropagation(); openProfile(u.id); }} />
            <div className="flex-grow border-b border-gray-800/10 pb-2">
              <p className="font-bold text-sm">{u.display_name}</p>
              <p className="text-xs text-blue-500 font-medium mt-1 italic uppercase tracking-tighter">Open Direct Message</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DMScreen({ target, setDmTarget, currentUser, getAvatar, darkMode }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const scrollRef = useRef();
  useEffect(() => {
    fetchMessages();
    const channel = supabase.channel(`chat:${target.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
      if ((p.new.sender_id === currentUser.id && p.new.receiver_id === target.id) || (p.new.sender_id === target.id && p.new.receiver_id === currentUser.id)) setMessages(prev => [...prev, p.new]);
    }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [target]);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  async function fetchMessages() { const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true }); if (data) setMessages(data); }
  async function sendMsg(e) { e.preventDefault(); if (!text.trim()) return; const t = text; setText(''); await supabase.from('messages').insert([{ text: t, sender_id: currentUser.id, receiver_id: target.id }]); }
  return (
    <div className={`fixed inset-0 z-[120] flex flex-col animate-in slide-in-from-right duration-300 ${darkMode ? 'bg-black' : 'bg-[#f8f9fa]'}`}>
      <header className={`p-4 flex items-center gap-3 border-b sticky top-0 z-10 ${darkMode ? 'bg-gray-900/90 border-gray-800' : 'bg-white/90 border-gray-100'} backdrop-blur-md`}>
        <ChevronLeft onClick={() => setDmTarget(null)} className="cursor-pointer" />
        <img src={getAvatar(target.username, target.avatar_url)} className="w-10 h-10 rounded-full object-cover" />
        <div><p className="font-black text-sm">{target.display_name}</p><p className="text-[10px] text-gray-400 font-bold uppercase">@{target.username}</p></div>
      </header>
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] p-4 rounded-[1.8rem] text-sm shadow-sm ${m.sender_id === currentUser.id ? 'bg-blue-600 text-white rounded-tr-none' : (darkMode ? 'bg-gray-800 text-white rounded-tl-none' : 'bg-white text-gray-800 rounded-tl-none')}`}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <form onSubmit={sendMsg} className="p-4 border-t flex gap-2 bg-inherit">
        <input type="text" className={`flex-grow p-4 rounded-2xl text-sm outline-none font-medium ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50'}`} placeholder="Type message..." value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg active:scale-95 transition"><Send size={18}/></button>
      </form>
    </div>
  );
}

function FollowListModal({ type, userId, onClose, openProfile, getAvatar, darkMode }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    async function fetchList() {
      const sourceCol = type === 'followers' ? 'following_id' : 'follower_id';
      const targetCol = type === 'followers' ? 'follower_id' : 'following_id';
      const { data: followData } = await supabase.from('follows').select(targetCol).eq(sourceCol, userId);
      if (followData?.length > 0) { const ids = followData.map(f => f[targetCol]); const { data: profs } = await supabase.from('profiles').select('*').in('id', ids); if (profs) setList(profs); }
    }
    fetchList();
  }, [type, userId]);
  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-end justify-center">
      <div className={`w-full max-w-md rounded-t-[2.5rem] max-h-[70vh] flex flex-col animate-in slide-in-from-bottom duration-300 ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
        <div className="p-6 border-b border-gray-800/10 flex justify-between items-center"><h3 className="font-black uppercase tracking-widest text-sm">{type}</h3><X onClick={onClose} className="cursor-pointer" /></div>
        <div className="overflow-y-auto p-4 space-y-2">
          {list.map(u => (
            <div key={u.id} className="flex items-center gap-4 cursor-pointer p-3 rounded-2xl hover:bg-gray-500/5 transition" onClick={() => { onClose(); openProfile(u.id); }}>
              <img src={getAvatar(u.username, u.avatar_url)} className="w-12 h-12 rounded-full object-cover" />
              <div><p className="font-black text-sm">{u.display_name}</p><p className="text-gray-400 text-xs font-bold uppercase">@{u.username}</p></div>
            </div>
          ))}
          {list.length === 0 && <div className="p-10 text-center text-gray-500 text-xs font-black uppercase tracking-widest">Empty list</div>}
        </div>
      </div>
    </div>
  );
}

function AuthScreen({ fetchData }) {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAuth(e) {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data?.user) {
          await supabase.from('profiles').upsert([{ id: data.user.id, username: username.toLowerCase(), display_name: displayName }]);
        }
      }
      fetchData();
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-white text-black font-sans">
      <div className="w-20 h-20 bg-gradient-to-tr from-blue-700 to-cyan-500 rounded-[2.2rem] flex items-center justify-center shadow-2xl mb-6 rotate-3">
        <Zap size={40} color="white" fill="white" />
      </div>
      <h1 className="text-4xl font-black mb-10 text-blue-700 italic uppercase tracking-tighter">GridStream</h1>
      
      {isLogin ? (
        <form onSubmit={handleAuth} className="w-full max-w-xs space-y-4 animate-in fade-in duration-500">
          <input type="email" placeholder="EMAIL" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold border border-transparent focus:border-blue-500 transition" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="PASSWORD" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold border border-transparent focus:border-blue-500 transition" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" disabled={loading} className="w-full bg-blue-700 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs shadow-xl active:scale-95 transition">
            {loading ? "..." : "Login"}
          </button>
          <button type="button" onClick={() => { setIsLogin(false); setStep(1); }} className="w-full text-center mt-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Create New Account</button>
        </form>
      ) : (
        <div className="w-full max-w-xs animate-in slide-in-from-right duration-500">
           <div className="mb-6 flex justify-between items-center px-1">
             <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Step {step} of 3</span>
             <button onClick={() => setIsLogin(true)} className="text-[10px] font-black uppercase text-gray-400">Cancel</button>
           </div>
           {step === 1 && (
             <div className="space-y-4">
               <input type="email" placeholder="EMAIL" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold border-2 border-blue-100" value={email} onChange={(e) => setEmail(e.target.value)} />
               <input type="password" placeholder="PASSWORD" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold border-2 border-blue-100" value={password} onChange={(e) => setPassword(e.target.value)} />
               <button onClick={() => setStep(2)} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl uppercase text-xs tracking-widest">Continue</button>
             </div>
           )}
           {step === 2 && (
             <div className="space-y-4">
               <input type="text" placeholder="USERNAME" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold border-2 border-blue-100" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} />
               <button onClick={() => setStep(3)} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl uppercase text-xs tracking-widest">Continue</button>
             </div>
           )}
           {step === 3 && (
             <div className="space-y-4">
               <input type="text" placeholder="DISPLAY NAME" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold border-2 border-blue-100" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
               <button onClick={handleAuth} disabled={loading} className="w-full bg-blue-700 text-white font-black py-5 rounded-2xl uppercase text-xs tracking-widest">{loading ? "..." : "Join Beta"}</button>
             </div>
           )}
        </div>
      )}
    </div>
  );
          }
