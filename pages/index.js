import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, 
  User as UserIcon, ImageIcon, Send, ChevronLeft, Zap, LogOut, Settings, 
  Trash2, MessageSquare, Plus, Type, Bell, UserPlus, UserMinus 
} from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = 'dtb3jpadj'; 
const CLOUDINARY_UPLOAD_PRESET = 'alpha-sns';

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = (now - date) / 1000; 

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  
  return date.toLocaleString('ja-JP', { month: 'short', day: 'numeric' });
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
      if (currentUser) {
        fetchMyProfile(currentUser.id);
        setupRealtime(currentUser.id);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (user) fetchData(); }, [user]);

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

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      fetchMyProfile(session.user.id);
      setupRealtime(session.user.id);
    }
  }

  // --- 通知ロジック修正 ---
  function setupRealtime(userId) {
    const channel = supabase.channel(`notifications:${userId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications', 
        filter: `recipient_id=eq.${userId}` 
      }, 
      (payload) => {
        console.log("New notification received!", payload);
        setUnreadCount(prev => prev + 1);
        fetchNotifications(userId); 
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }

  async function fetchMyProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) { setMyProfile(data); setEditData(data); }
    fetchNotifications(userId);
  }

  async function fetchNotifications(userId) {
    const { data } = await supabase
      .from('notifications')
      .select(`*, profiles:actor_id (username, display_name, avatar_url)`)
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);
    
    if (data) {
      setNotifications(data);
      const unread = data.filter(n => !n.is_read).length;
      setUnreadCount(unread);
    }
  }

  async function markNotificationsAsRead() {
    if (!user || unreadCount === 0) return;
    await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', user.id).eq('is_read', false);
    setUnreadCount(0);
  }

  async function createNotification(recipientId, type, resourceId = null) {
    if (!user || user.id === recipientId) return; 
    const { error } = await supabase.from('notifications').insert([{
      recipient_id: recipientId,
      actor_id: user.id,
      type: type,
      resource_id: resourceId
    }]);
    if (error) console.error("Notification error:", error);
  }

  async function notifyFollowers(type, resourceId) {
    // 自分をフォローしている人＝自分をfollowing_idに設定しているレコード
    const { data: followers, error } = await supabase.from('follows').select('follower_id').eq('following_id', user.id);
    if (error) return;
    if (followers && followers.length > 0) {
      const notifs = followers.map(f => ({
        recipient_id: f.follower_id,
        actor_id: user.id,
        type: type,
        resource_id: resourceId
      }));
      await supabase.from('notifications').insert(notifs);
    }
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
    const { data: storiesData } = await supabase
      .from('stories')
      .select('*')
      .gt('created_at', yesterday)
      .order('created_at', { ascending: true });
    
    setStories(storiesData || []);

    const { data: profData } = await supabase.from('profiles').select('*');
    if (profData) setAllProfiles(profData);
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
    setUploading(true);
    setCreatingStory(false);
    try {
      const imageUrl = await uploadToCloudinary(processedImageBlob);
      const { data, error } = await supabase.from('stories').insert([{ user_id: user.id, image_url: imageUrl }]).select();
      if (data && !error) {
        notifyFollowers('new_story', data[0].id);
      }
      fetchData(); 
    } catch (error) {
      console.error("Story upload failed", error);
    } finally {
      setUploading(false);
    }
  };

  const handleStoryLike = async (story) => {
    await createNotification(story.user_id, 'story_like', story.id);
  };

  const handleDeleteStory = async (storyId) => {
    if(!window.confirm("Delete this story?")) return;
    await supabase.from('stories').delete().eq('id', storyId);
    setViewingStory(null);
    fetchData();
  };

  async function handleUpdateProfile() {
    setUploading(true);
    let { avatar_url, header_url } = editData;
    if (avatarInputRef.current?.files[0]) avatar_url = await uploadToCloudinary(avatarInputRef.current.files[0]);
    if (headerInputRef.current?.files[0]) header_url = await uploadToCloudinary(headerInputRef.current.files[0]);

    const { error } = await supabase.from('profiles').update({
      display_name: editData.display_name, username: editData.username, bio: editData.bio, avatar_url, header_url
    }).eq('id', user.id);

    if (!error) { await fetchMyProfile(user.id); await openProfile(user.id); setIsEditing(false); }
    setUploading(false);
  }

  async function toggleLike(postId, isLiked, authorId) {
    if (!user) return;
    const updateLogic = (p) => p.id === postId ? { ...p, is_liked: !isLiked, like_count: isLiked ? Math.max(0, p.like_count - 1) : p.like_count + 1 } : p;
    setPosts(prev => prev.map(updateLogic));
    
    if (isLiked) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id);
    } else {
      await supabase.from('likes').insert([{ post_id: postId, user_id: user.id }]);
      if (authorId) createNotification(authorId, 'like', postId);
    }
    fetchData();
  }

  const handleShare = async (post) => {
    try {
      if (navigator.share) await navigator.share({ title: 'GridStream', text: post.content, url: window.location.href });
      else { await navigator.clipboard.writeText(`${post.content}\n${window.location.href}`); alert('Copied!'); }
    } catch (err) { console.log('Share failed', err); }
  };

  async function handlePost(e) {
    e.preventDefault();
    if (!newPost.trim() || !user) return;
    setUploading(true);
    let imageUrl = null;
    if (fileInputRef.current?.files[0]) imageUrl = await uploadToCloudinary(fileInputRef.current.files[0]);
    const { data, error } = await supabase.from('posts').insert([{ content: newPost, user_id: user.id, image_url: imageUrl }]).select();
    
    if (data && !error) {
      notifyFollowers('new_post', data[0].id);
    }

    setNewPost(''); if (fileInputRef.current) fileInputRef.current.value = "";
    fetchData(); setUploading(false);
  }

  async function handleDeletePost(postId) {
    if (!window.confirm("Delete?")) return;
    await supabase.from('posts').delete().eq('id', postId).eq('user_id', user.id);
    setPosts(prev => prev.filter(p => p.id !== postId)); setSelectedPost(null);
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
      setStats(prev => ({ ...prev, isFollowing: true, followers: prev.followers + 1 }));
      createNotification(activeProfileId, 'follow');
    }
  }

  const handleNotificationClick = async (notif) => {
    if (notif.type === 'follow') {
      openProfile(notif.actor_id);
    } else if (notif.resource_id) {
       if (notif.type === 'new_story' || notif.type === 'story_like') {
         setViewingStory({ userId: notif.actor_id, index: 0 });
       } else {
         const { data } = await supabase.from('posts').select(`*, profiles(id, username, display_name, avatar_url), likes(user_id), comments(id)`).eq('id', notif.resource_id).single();
         if (data) {
           setSelectedPost({
              ...data,
              like_count: data.likes?.length || 0,
              comment_count: data.comments?.length || 0,
              is_liked: user ? data.likes?.some(l => l.user_id === user.id) : false
           });
         }
       }
    }
  };

  const getAvatar = (name, url) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
  const [dmTarget, setDmTarget] = useState(null);

  if (!user) return <AuthScreen fetchData={fetchData} />;

  return (
    <div className={`max-w-md mx-auto min-h-screen pb-20 border-x font-sans relative shadow-2xl transition-colors duration-300 ${darkMode ? 'bg-black text-white border-gray-800' : 'bg-white text-black border-gray-100'}`}>
      <script src="https://cdn.tailwindcss.com"></script>

      {creatingStory && (
        <StoryCreator file={creatingStory} onClose={() => setCreatingStory(false)} onPublish={handleStoryPublish} myProfile={myProfile} getAvatar={getAvatar} />
      )}

      {viewingStory && (
        <StoryViewer stories={groupedStories[viewingStory.userId]} initialIndex={viewingStory.index} onClose={() => setViewingStory(null)} userProfile={allProfiles.find(p => p.id === viewingStory.userId)} getAvatar={getAvatar} currentUserId={user.id} onDelete={handleDeleteStory} onLike={handleStoryLike} />
      )}

      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} getAvatar={getAvatar} darkMode={darkMode} />}
      {showFollowList && <FollowListModal type={showFollowList} userId={activeProfileId} onClose={() => setShowFollowList(null)} openProfile={openProfile} getAvatar={getAvatar} darkMode={darkMode} />}
      {selectedPost && <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} getAvatar={getAvatar} openProfile={openProfile} onDelete={handleDeletePost} onLike={toggleLike} onShare={handleShare} currentUser={user} darkMode={darkMode} refreshPosts={fetchData} createNotification={createNotification} />}
      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} user={user} myProfile={myProfile} darkMode={darkMode} setDarkMode={setDarkMode} />}

      {view === 'home' && (
        <div className="animate-in fade-in">
          <header className={`sticky top-0 z-30 backdrop-blur-md border-b p-4 flex justify-between items-center ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-50'}`}>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-cyan-500 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1">
              <Zap size={24} className="text-blue-600 fill-blue-600" /> GridStream
            </h1>
            <div className="relative cursor-pointer" onClick={() => setView('messages')}>
                <MessageCircle size={24} />
            </div>
          </header>

          <div className={`p-4 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
            <div className="inline-flex flex-col items-center gap-1 cursor-pointer relative shrink-0">
              <div className="relative">
                <div 
                  className={`rounded-full p-[2px] ${groupedStories[user.id] ? 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500' : 'bg-transparent'}`}
                  onClick={() => {
                    if (groupedStories[user.id]) setViewingStory({ userId: user.id, index: 0 });
                    else storyInputRef.current.click();
                  }}
                >
                  <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className={`w-16 h-16 rounded-full object-cover border-2 ${darkMode ? 'border-black' : 'border-white'}`} />
                </div>
                <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1 border-2 border-black cursor-pointer" onClick={(e) => { e.stopPropagation(); storyInputRef.current.click(); }}>
                  <Plus size={12} className="text-white" />
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
              <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none bg-transparent font-medium" placeholder="What's happening?" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-12 mt-2">
              <label className="cursor-pointer text-blue-500 p-2 rounded-full transition"><ImageIcon size={22}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
              <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs uppercase tracking-tighter">
                {uploading ? '...' : 'Stream'}
              </button>
            </div>
          </form>

          <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
            {posts.map(post => (
              <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onLike={toggleLike} onShare={handleShare} currentUser={user} darkMode={darkMode} onOpenDetail={() => setSelectedPost(post)} />
            ))}
          </div>
        </div>
      )}

      {view === 'profile' && profileInfo && (
        <ProfileView user={user} activeProfileId={activeProfileId} profileInfo={profileInfo} posts={posts} isEditing={isEditing} setIsEditing={setIsEditing} editData={editData} setEditData={setEditData} handleUpdateProfile={handleUpdateProfile} uploading={uploading} avatarInputRef={avatarInputRef} headerInputRef={headerInputRef} getAvatar={getAvatar} openProfile={openProfile} toggleFollow={toggleFollow} stats={stats} setShowFollowList={setShowFollowList} setShowSettings={setShowSettings} darkMode={darkMode} setView={setView} toggleLike={toggleLike} handleShare={handleShare} setSelectedPost={setSelectedPost} />
      )}
      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSelectedPost={setSelectedPost} darkMode={darkMode} />}
      {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} setDmTarget={setDmTarget} getAvatar={getAvatar} openProfile={openProfile} darkMode={darkMode} />}
      {view === 'notifications' && <NotificationsView notifications={notifications} getAvatar={getAvatar} onNotificationClick={handleNotificationClick} darkMode={darkMode} markRead={markNotificationsAsRead} />}

      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 shadow-sm ${darkMode ? 'bg-black/95 border-gray-800 text-gray-600' : 'bg-white/95 border-gray-100 text-gray-300'}`}>
        <HomeIcon onClick={() => setView('home')} className={`cursor-pointer ${view === 'home' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <Search onClick={() => setView('search')} className={`cursor-pointer ${view === 'search' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <div className="relative cursor-pointer" onClick={() => { setView('notifications'); markNotificationsAsRead(); }}>
           <Bell className={`${view === 'notifications' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
           {unreadCount > 0 && <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">{unreadCount}</div>}
        </div>
        <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer ${view === 'profile' && activeProfileId === user.id ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
      </nav>
    </div>
  );
}

function NotificationsView({ notifications, getAvatar, onNotificationClick, darkMode, markRead }) {
  useEffect(() => { markRead(); }, []);

  const getMessage = (type) => {
    switch (type) {
      case 'like': return 'liked your post.';
      case 'comment': return 'commented on your post.';
      case 'follow': return 'followed you.';
      case 'new_post': return 'posted a new stream.';
      case 'new_story': return 'added to their story.';
      case 'story_like': return 'liked your story.';
      default: return 'interacted with you.';
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'like': return <Heart size={14} className="fill-red-500 text-red-500" />;
      case 'story_like': return <Heart size={14} className="fill-red-500 text-red-500" />;
      case 'comment': return <MessageSquare size={14} className="fill-blue-500 text-blue-500" />;
      case 'follow': return <UserPlus size={14} className="fill-purple-500 text-purple-500" />;
      case 'new_post': return <Zap size={14} className="fill-yellow-500 text-yellow-500" />;
      case 'new_story': return <Camera size={14} className="text-pink-500" />;
      default: return <Bell size={14} />;
    }
  };

  return (
    <div className="animate-in fade-in pb-20">
      <header className="p-4 border-b font-black text-lg text-center uppercase italic sticky top-0 z-10 bg-inherit">Notifications</header>
      <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
        {notifications.length === 0 ? (
           <div className="p-10 text-center text-gray-500 text-sm font-bold">No notifications yet.</div>
        ) : notifications.map(n => (
          <div key={n.id} onClick={() => onNotificationClick(n)} className={`p-4 flex gap-3 cursor-pointer hover:bg-gray-50/10 transition ${!n.is_read ? 'bg-blue-500/10' : ''}`}>
             <div className="relative">
               <img src={getAvatar(n.profiles?.username, n.profiles?.avatar_url)} className="w-10 h-10 rounded-full object-cover" />
               <div className={`absolute -bottom-1 -right-1 p-1 rounded-full ${darkMode ? 'bg-black' : 'bg-white'}`}>
                 {getIcon(n.type)}
               </div>
             </div>
             <div className="flex-col flex justify-center">
                <p className="text-sm"><span className="font-bold">{n.profiles?.display_name || 'Someone'}</span> <span className="text-gray-400">{getMessage(n.type)}</span></p>
                <p className="text-[10px] text-gray-500 font-bold mt-1 uppercase">{formatTime(n.created_at)}</p>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Story Creator (Same as previous with bug fixes) ---
function StoryCreator({ file, onClose, onPublish, myProfile, getAvatar }) {
  const [textMode, setTextMode] = useState(false);
  const [text, setText] = useState('');
  const [textStyle, setTextStyle] = useState({ fontIndex: 0, colorIndex: 0, size: 50, x: 0, y: 0, scale: 1 });
  const imgRef = useRef(null);
  const [previewSrc, setPreviewSrc] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const initialDist = useRef(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleStart = (e) => {
    if (textMode) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    if (e.touches && e.touches.length === 2) initialDist.current = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
    else { setIsDragging(true); dragStart.current = { x: clientX - textStyle.x, y: clientY - textStyle.y }; }
  };

  const handleMove = (e) => {
    if (!text) return;
    if (e.touches && e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      const zoom = dist / initialDist.current;
      setTextStyle(prev => ({ ...prev, scale: Math.min(Math.max(prev.scale * zoom, 0.5), 5) }));
      initialDist.current = dist;
    } else if (isDragging) {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setTextStyle(prev => ({ ...prev, x: clientX - dragStart.current.x, y: clientY - dragStart.current.y }));
    }
  };

  const handlePublish = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = imgRef.current;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    if (text) {
      const baseFontSize = (img.naturalWidth / 10) * (0.5 + textStyle.size / 50);
      const fontSize = baseFontSize * textStyle.scale;
      const fontName = FONT_STYLES[textStyle.fontIndex].name;
      ctx.font = `bold ${fontSize}px sans-serif`;
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
    <div className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden touch-none" onMouseMove={handleMove} onTouchMove={handleMove} onMouseUp={() => setIsDragging(false)} onTouchEnd={() => setIsDragging(false)}>
      <img ref={imgRef} src={previewSrc} className="hidden" />
      <div className="absolute top-0 w-full p-4 flex justify-between items-center z-20"><button onClick={onClose} className="p-2 bg-black/40 rounded-full text-white"><X /></button><button onClick={() => setTextMode(true)} className="p-2 bg-black/40 rounded-full text-white"><Type /></button></div>
      <div id="story-preview-container" className="flex-grow relative flex items-center justify-center bg-gray-900 overflow-hidden">
        {previewSrc && <div className="relative w-full h-full max-w-md flex items-center justify-center"><img src={previewSrc} className="w-full h-full object-contain pointer-events-none" />{text && <div onMouseDown={handleStart} onTouchStart={handleStart} className={`absolute cursor-move select-none text-center whitespace-pre-wrap leading-tight break-words p-4 ${FONT_STYLES[textStyle.fontIndex].css}`} style={{ color: TEXT_COLORS[textStyle.colorIndex], fontSize: `${(1.5 + textStyle.size / 20) * textStyle.scale}rem`, transform: `translate(${textStyle.x}px, ${textStyle.y}px)`, textShadow: '0 2px 10px rgba(0,0,0,0.5)', width: 'max-content', maxWidth: '90%' }}>{text}</div>}</div>}
      </div>
      {textMode && (
        <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex flex-col justify-center items-center">
           <div className="absolute top-4 right-4"><button onClick={() => setTextMode(false)} className="text-white font-bold text-lg">DONE</button></div>
           <textarea autoFocus value={text} onChange={e => setText(e.target.value)} className={`bg-transparent text-center w-full max-w-xs outline-none resize-none overflow-hidden placeholder-white/50 ${FONT_STYLES[textStyle.fontIndex].css}`} style={{ color: TEXT_COLORS[textStyle.colorIndex], fontSize: `${1.5 + textStyle.size / 20}rem` }} placeholder="Type..." rows={3} />
        </div>
      )}
      {!textMode && <div className="absolute bottom-0 w-full p-4 flex justify-between items-center bg-gradient-to-t from-black/90 to-transparent pb-8"><div className="flex items-center gap-2"><div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 to-purple-500"><img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-8 h-8 rounded-full border-2 border-black" /></div><span className="text-white text-xs font-bold">Your Story</span></div><button onClick={handlePublish} className="bg-white text-black rounded-full p-3 px-6 font-bold flex items-center gap-2">SHARE <ChevronLeft className="rotate-180" size={16} /></button></div>}
    </div>
  );
}

// --- Story Viewer (With Like functionality) ---
function StoryViewer({ stories, initialIndex, onClose, userProfile, getAvatar, currentUserId, onDelete, onLike }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [liked, setLiked] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const currentStory = stories[currentIndex];

  useEffect(() => {
    if (!currentStory) return;
    setProgress(0); setLiked(false); startTimer();
    return () => cancelAnimationFrame(timerRef.current);
  }, [currentIndex, currentStory]);

  const startTimer = () => {
    startTimeRef.current = Date.now();
    const animate = () => {
      if (isPaused) return; 
      const elapsed = Date.now() - startTimeRef.current;
      const p = (elapsed / 5000) * 100;
      setProgress(p);
      if (elapsed < 5000) timerRef.current = requestAnimationFrame(animate);
      else nextStory();
    };
    timerRef.current = requestAnimationFrame(animate);
  };

  const nextStory = () => { if (currentIndex < stories.length - 1) setCurrentIndex(prev => prev + 1); else onClose(); };
  const prevStory = () => { if (currentIndex > 0) setCurrentIndex(prev => prev - 1); else { setProgress(0); startTimeRef.current = Date.now(); } };
  
  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      <div className="relative w-full max-w-md h-full bg-gray-900 flex flex-col" onMouseDown={() => setIsPaused(true)} onMouseUp={() => setIsPaused(false)} onTouchStart={() => setIsPaused(true)} onTouchEnd={() => setIsPaused(false)}>
        <div className="absolute top-0 left-0 right-0 z-20 p-2 flex gap-1 mt-2">{stories.map((_, idx) => (<div key={idx} className="h-0.5 flex-grow bg-white/30 rounded-full overflow-hidden"><div className="h-full bg-white transition-all duration-100 linear" style={{ width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%' }} /></div>))}</div>
        <div className="absolute top-4 left-0 right-0 z-20 p-3 pt-6 flex justify-between items-center"><div className="flex items-center gap-2"><img src={getAvatar(userProfile.username, userProfile.avatar_url)} className="w-8 h-8 rounded-full border border-white/50" /><span className="text-white text-sm font-bold">{userProfile.display_name}</span></div><div className="flex items-center gap-2">{currentUserId === currentStory.user_id && <button onClick={() => onDelete(currentStory.id)} className="text-white/80 p-2"><Trash2 size={20} /></button>}<button onClick={onClose} className="text-white p-2"><X size={24} /></button></div></div>
        <img src={currentStory.image_url} className="w-full h-full object-contain" />
        <div className="absolute inset-0 z-10 flex"><div className="w-1/3 h-full" onClick={prevStory} /><div className="w-2/3 h-full" onClick={nextStory} /></div>
        <div className="absolute bottom-0 right-0 z-30 p-6 pb-12"><button onClick={(e) => { e.stopPropagation(); if(!liked){ setLiked(true); onLike(currentStory); } }} className={`p-3 rounded-full bg-black/40 backdrop-blur-sm transition ${liked ? 'text-red-500' : 'text-white'}`}><Heart size={28} fill={liked ? "currentColor" : "none"} /></button></div>
      </div>
    </div>
  );
}

// --- Rest of components (Profile, Settings, PostCard, etc.) ---
function ProfileView({ user, activeProfileId, profileInfo, posts, isEditing, setIsEditing, editData, setEditData, handleUpdateProfile, uploading, avatarInputRef, headerInputRef, getAvatar, openProfile, toggleFollow, stats, setShowFollowList, setShowSettings, darkMode, setView, toggleLike, handleShare, setSelectedPost }) {
  if (isEditing) {
    return (
      <div className="space-y-6">
        <header className="p-4 flex justify-between items-center sticky top-0 z-10 bg-inherit/90 backdrop-blur-md border-b">
          <button onClick={() => setIsEditing(false)}><X size={24}/></button>
          <h2 className="font-black uppercase tracking-widest">Edit Profile</h2>
          <button onClick={handleUpdateProfile} disabled={uploading} className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-black uppercase">Save</button>
        </header>
        <div className="relative h-44 bg-gray-200">
           <img src={editData.header_url || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&q=80'} className="w-full h-full object-cover" />
           <div onClick={() => headerInputRef.current.click()} className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"><Camera className="text-white" /><input type="file" ref={headerInputRef} className="hidden" accept="image/*" /></div>
        </div>
        <div className="px-4">
           <div className="flex flex-col items-center gap-2 -mt-12 relative z-10">
             <div className="relative group" onClick={() => avatarInputRef.current.click()}><img src={getAvatar(editData.username, editData.avatar_url)} className="w-24 h-24 rounded-full object-cover border-4 border-blue-500 bg-white" /><input type="file" ref={avatarInputRef} className="hidden" accept="image/*" /></div>
           </div>
           <div className="space-y-4 pt-8">
              <input className={`w-full p-4 rounded-2xl outline-none font-bold ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`} placeholder="Display Name" value={editData.display_name} onChange={e => setEditData({...editData, display_name: e.target.value})} />
              <textarea className={`w-full p-4 rounded-2xl outline-none font-bold h-24 resize-none ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`} placeholder="Bio" value={editData.bio} onChange={e => setEditData({...editData, bio: e.target.value})} />
           </div>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="relative h-44 bg-gray-200">
        <img src={profileInfo.header_url || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&q=80'} className="w-full h-full object-cover" />
        <div className="absolute top-4 inset-x-4 flex justify-between">
          <button onClick={() => setView('home')} className="bg-black/30 p-2 rounded-full text-white"><ChevronLeft size={20}/></button>
          {user?.id === activeProfileId && <button onClick={() => setShowSettings(true)} className="bg-black/30 p-2 rounded-full text-white"><Settings size={20}/></button>}
        </div>
      </div>
      <div className="px-4 relative">
        <div className="flex justify-between items-end -mt-12 mb-4">
          <img src={getAvatar(profileInfo.username, profileInfo.avatar_url)} className={`w-24 h-24 rounded-full border-4 object-cover ${darkMode ? 'border-black bg-black' : 'border-white bg-white'}`} />
          {user?.id === activeProfileId ? (
            <button onClick={() => setIsEditing(true)} className="border rounded-full px-5 py-1.5 text-xs font-black uppercase">Edit Profile</button>
          ) : (
            <button onClick={toggleFollow} className={`rounded-full px-5 py-1.5 text-xs font-black uppercase transition ${stats.isFollowing ? 'bg-gray-800 text-white' : 'bg-blue-600 text-white'}`}>{stats.isFollowing ? 'Unfollow' : 'Follow'}</button>
          )}
        </div>
        <h2 className="text-2xl font-black">{profileInfo.display_name}</h2>
        <p className="text-gray-400 text-sm font-bold">@{profileInfo.username}</p>
        <p className="mt-3 text-[15px] font-medium">{profileInfo.bio || 'GridStream member.'}</p>
        <div className="flex gap-4 mt-4">
          <button onClick={() => setShowFollowList('following')} className="text-sm"><span className="font-black">{stats.following}</span> Following</button>
          <button onClick={() => setShowFollowList('followers')} className="text-sm"><span className="font-black">{stats.followers}</span> Followers</button>
        </div>
      </div>
      <div className={`divide-y mt-8 border-t ${darkMode ? 'border-gray-800 divide-gray-800' : 'border-gray-100 divide-gray-100'}`}>
        {posts.filter(p => p.user_id === activeProfileId).map(post => (<PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onLike={toggleLike} onShare={handleShare} currentUser={user} darkMode={darkMode} onOpenDetail={() => setSelectedPost(post)} />))}
      </div>
    </>
  );
}

function SettingsScreen({ onClose, user, myProfile, darkMode, setDarkMode }) {
  const handleLogout = () => { supabase.auth.signOut(); onClose(); };
  return (
    <div className={`fixed inset-0 z-[110] animate-in slide-in-from-bottom duration-300 ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <header className="p-4 border-b flex items-center gap-4"><ChevronLeft onClick={onClose} className="cursor-pointer" /><h2 className="font-black uppercase tracking-widest">Settings</h2></header>
      <div className="p-6 space-y-8">
        <button onClick={() => setDarkMode(!darkMode)} className={`w-full flex justify-between items-center p-4 rounded-2xl ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}><span className="text-sm font-bold">Dark Mode</span><div className={`w-10 h-6 rounded-full relative transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${darkMode ? 'right-1' : 'left-1'}`} /></div></button>
        <button onClick={handleLogout} className="w-full p-4 rounded-2xl bg-red-500/10 text-red-500 font-black uppercase text-xs tracking-widest">Logout</button>
      </div>
    </div>
  );
}

function PostCard({ post, openProfile, getAvatar, onLike, onShare, currentUser, darkMode, onOpenDetail }) {
  return (
    <article className={`p-4 flex gap-3 transition border-b last:border-0 ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
      <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer object-cover" onClick={() => openProfile(post.profiles?.id)} />
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-start mb-1"><div className="flex flex-col cursor-pointer" onClick={() => openProfile(post.profiles?.id)}><span className="font-black text-sm">{post.profiles?.display_name}</span><span className="text-gray-400 text-[11px] font-bold">@{post.profiles?.username}</span></div><span className="text-[10px] text-gray-400 font-bold">{formatTime(post.created_at)}</span></div>
        <div className="text-[15px] mt-1 font-medium leading-relaxed whitespace-pre-wrap">{renderContent(post.content)}</div>
        {post.image_url && <img src={post.image_url} onClick={onOpenDetail} className="mt-3 rounded-2xl w-full max-h-80 object-cover cursor-pointer" />}
        <div className="flex justify-between mt-4 text-gray-400 max-w-[200px]">
          <button onClick={() => onLike(post.id, post.is_liked, post.user_id)} className={`flex items-center gap-1.5 transition ${post.is_liked ? 'text-red-500 scale-110' : ''}`}><Heart size={18} fill={post.is_liked ? "currentColor" : "none"} /><span className="text-xs font-black">{post.like_count || ''}</span></button>
          <button onClick={onOpenDetail} className="flex items-center gap-1.5"><MessageSquare size={18} /><span className="text-xs font-black">{post.comment_count || ''}</span></button>
          <button onClick={() => onShare(post)}><Share2 size={18} /></button>
        </div>
      </div>
    </article>
  );
}

function PostDetailModal({ post, onClose, getAvatar, openProfile, onDelete, onLike, onShare, currentUser, darkMode, refreshPosts, createNotification }) {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => { fetchComments(); }, [post.id]);
  async function fetchComments() { const { data } = await supabase.from('comments').select('*, profiles(id, username, display_name, avatar_url)').eq('post_id', post.id).order('created_at', { ascending: false }); if (data) setComments(data); }
  async function handlePostComment(e) { e.preventDefault(); if (!commentText.trim() || !currentUser) return; setLoading(true); await supabase.from('comments').insert([{ post_id: post.id, user_id: currentUser.id, content: commentText }]); createNotification(post.user_id, 'comment', post.id); setCommentText(''); await fetchComments(); refreshPosts(); setLoading(false); }
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-[2rem] flex flex-col h-[85vh] overflow-hidden ${darkMode ? 'bg-black border border-gray-800' : 'bg-white text-black'}`}>
        <div className="p-4 border-b flex justify-between"><div className="flex items-center gap-2"><img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-8 h-8 rounded-full" /><span className="font-black text-xs">@{post.profiles?.username}</span></div><button onClick={onClose}><X size={24}/></button></div>
        <div className="flex-grow overflow-y-auto p-5">
           {post.image_url && <img src={post.image_url} className="w-full rounded-2xl mb-4" />}
           <div className="font-medium leading-relaxed mb-8">{renderContent(post.content)}</div>
           <div className="space-y-4">{comments.map(c => (<div key={c.id} className="flex gap-3"><img src={getAvatar(c.profiles?.username, c.profiles?.avatar_url)} className="w-8 h-8 rounded-full" /><div className={`p-3 rounded-2xl flex-grow ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}><p className="font-black text-[10px]">@{c.profiles?.username}</p><p className="text-sm">{c.content}</p></div></div>))}</div>
        </div>
        <form onSubmit={handlePostComment} className="p-4 border-t flex gap-2"><input type="text" placeholder="Comment..." className={`flex-grow p-4 rounded-2xl text-sm outline-none ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`} value={commentText} onChange={(e) => setCommentText(e.target.value)} /><button type="submit" className="bg-blue-600 text-white p-4 rounded-2xl"><Send size={18}/></button></form>
      </div>
    </div>
  );
}

function SearchView({ posts, openProfile, searchQuery, setSearchQuery, setSelectedPost, darkMode }) {
  return (
    <div className="animate-in fade-in">
      <div className={`p-4 sticky top-0 z-10 border-b ${darkMode ? 'bg-black border-gray-800' : 'bg-white'}`}><input type="text" placeholder="DISCOVER" className={`w-full rounded-xl py-2 px-4 outline-none text-xs font-black uppercase ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
      <div className="grid grid-cols-3 gap-[2px]">{posts.filter(p => p.image_url && (p.content?.includes(searchQuery) || p.profiles?.username?.includes(searchQuery))).map((post) => (<img key={post.id} src={post.image_url} className="aspect-square w-full h-full object-cover cursor-pointer" onClick={() => setSelectedPost(post)} />))}</div>
    </div>
  );
}

function MessagesList({ allProfiles, user, setDmTarget, getAvatar, openProfile, darkMode }) {
  return (
    <div className="animate-in fade-in">
      <header className="p-4 border-b font-black text-lg text-center uppercase italic">Messages</header>
      <div className="p-2">{allProfiles.filter(p => p.id !== user?.id).map(u => (<div key={u.id} className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setDmTarget(u)}><img src={getAvatar(u.username, u.avatar_url)} className="w-14 h-14 rounded-full" /><div className="flex-grow border-b pb-4"><p className="font-bold text-sm">{u.display_name}</p><p className="text-xs text-blue-500 font-bold uppercase mt-1">Chat Now</p></div></div>))}</div>
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
    <div className={`fixed inset-0 z-50 flex flex-col animate-in slide-in-from-right ${darkMode ? 'bg-black' : 'bg-white'}`}>
      <header className={`p-4 flex items-center gap-3 border-b ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white'}`}><ChevronLeft onClick={() => setDmTarget(null)} /><img src={getAvatar(target.username, target.avatar_url)} className="w-10 h-10 rounded-full" /><div><p className="font-black text-sm">{target.display_name}</p></div></header>
      <div className="flex-grow overflow-y-auto p-4 space-y-4">{messages.map(m => (<div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] p-4 rounded-2xl text-sm ${m.sender_id === currentUser.id ? 'bg-blue-600 text-white' : (darkMode ? 'bg-gray-800' : 'bg-gray-100 text-black')}`}>{m.text}</div></div>))}<div ref={scrollRef} /></div>
      <form onSubmit={sendMsg} className="p-4 border-t flex gap-2"><input type="text" className={`flex-grow p-4 rounded-2xl text-sm outline-none ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`} placeholder="Aa" value={text} onChange={(e) => setText(e.target.value)} /><button type="submit" className="bg-blue-600 text-white p-4 rounded-2xl"><Send size={18}/></button></form>
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
      if (followData?.length > 0) { const ids = followData.map(f => f[targetCol]); const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids); if (profiles) setList(profiles); }
    }
    fetchList();
  }, [type, userId]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center">
      <div className={`w-full max-w-md rounded-t-[2.5rem] max-h-[80vh] flex flex-col ${darkMode ? 'bg-black text-white' : 'bg-white'}`}>
        <div className="p-6 border-b flex justify-between items-center"><h3 className="font-black uppercase tracking-widest">{type}</h3><X onClick={onClose} /></div>
        <div className="overflow-y-auto p-4 space-y-2">{list.map(u => (<div key={u.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-gray-50/10 cursor-pointer" onClick={() => { onClose(); openProfile(u.id); }}><img src={getAvatar(u.username, u.avatar_url)} className="w-12 h-12 rounded-full" /><div className="flex-grow"><p className="font-black text-sm">{u.display_name}</p></div></div>))}</div>
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
          const { error: profileError } = await supabase.from('profiles').upsert([{ id: data.user.id, username: username.toLowerCase(), display_name: displayName }]);
          if (profileError) throw profileError;
        }
      }
      fetchData();
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  }

  if (isLogin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-white text-black">
        <script src="https://cdn.tailwindcss.com"></script>
        <div className="w-20 h-20 bg-gradient-to-tr from-blue-700 to-cyan-500 rounded-[2rem] flex items-center justify-center mb-6 rotate-6 animate-pulse"><Zap size={40} color="white" fill="white" /></div>
        <h1 className="text-4xl font-black mb-10 text-blue-700 italic uppercase">GridStream</h1>
        <form onSubmit={handleAuth} className="w-full max-w-xs space-y-4">
          <input type="email" placeholder="EMAIL" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="PASSWORD" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" disabled={loading} className="w-full bg-blue-700 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs">{loading ? "..." : "Login"}</button>
        </form>
        <button onClick={() => { setIsLogin(false); setStep(1); }} className="mt-8 text-xs font-black text-gray-400 uppercase tracking-widest">Create Account</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-white text-black">
      <script src="https://cdn.tailwindcss.com"></script>
      <div className="w-full max-w-xs flex items-center mb-8"><button onClick={() => step === 1 ? setIsLogin(true) : setStep(step-1)}><ChevronLeft size={24} /></button><div className="flex-grow text-center mr-6"><span className="text-[10px] font-black text-blue-500 uppercase">Step {step} of 4</span></div></div>
      <h2 className="text-2xl font-black mb-8 italic uppercase">Join Beta</h2>
      <form onSubmit={(e) => { e.preventDefault(); if(step < 4) setStep(step+1); else handleAuth(); }} className="w-full max-w-xs space-y-6">
        {step === 1 && <input type="email" placeholder="EMAIL" className="w-full bg-gray-100 p-4 rounded-2xl outline-none font-bold" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />}
        {step === 2 && <input type="password" placeholder="PASSWORD" className="w-full bg-gray-100 p-4 rounded-2xl outline-none font-bold" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoFocus />}
        {step === 3 && <input type="text" placeholder="USERNAME" className="w-full bg-gray-100 p-4 rounded-2xl outline-none font-bold" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />}
        {step === 4 && <input type="text" placeholder="DISPLAY NAME" className="w-full bg-gray-100 p-4 rounded-2xl outline-none font-bold" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required autoFocus />}
        <button type="submit" className="w-full bg-blue-700 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs">{step === 4 ? "Complete" : "Next"}</button>
      </form>
    </div>
  );
  }
