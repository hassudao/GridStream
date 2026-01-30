import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User as UserIcon, Grid, List, Image as ImageIcon, Send, ChevronLeft, Zap, LogOut, Settings, Trash2, MessageSquare, Save, UserCheck, AtSign, AlignLeft, Lock, Mail, Clock, UserPlus, UserMinus, Plus, Bell } from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = 'dtb3jpadj'; 
const CLOUDINARY_UPLOAD_PRESET = 'alpha-sns';

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function App() {
  const [view, setView] = useState('home'); 
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [groupedStories, setGroupedStories] = useState({});
  const [viewingStory, setViewingStory] = useState(null);
  const [allProfiles, setAllProfiles] = useState([]);
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState(null); 
  const [profileInfo, setProfileInfo] = useState(null); 
  const [stats, setStats] = useState({ followers: 0, following: 0, isFollowing: false });
  const [showFollowList, setShowFollowList] = useState(null); 
  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [toast, setToast] = useState(null); 
  const [editData, setEditData] = useState({ display_name: '', username: '', bio: '', avatar_url: '', header_url: '' });
  const [myProfile, setMyProfile] = useState({ username: '', display_name: '', bio: '', avatar_url: '', header_url: '' });
  const [newPost, setNewPost] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dmTarget, setDmTarget] = useState(null);
  
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
      fetchData();
      fetchNotifications();
      subscribeToNotifications();
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
    }
  }, [stories, allProfiles]);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      fetchMyProfile(session.user.id);
    }
  }

  // --- 通知ロジック ---
  async function fetchNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:profiles!actor_id(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setNotifications(data);
  }

  function subscribeToNotifications() {
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, 
        async (payload) => {
          const { data: actor } = await supabase.from('profiles').select('*').eq('id', payload.new.actor_id).single();
          const fullNotif = { ...payload.new, actor };
          setNotifications(prev => [fullNotif, ...prev]);
          setToast(fullNotif);
          setTimeout(() => setToast(null), 4000);
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }

  async function createNotification(targetUserId, type, postId = null, storyId = null) {
    if (targetUserId === user.id) return;
    await supabase.from('notifications').insert([{
      user_id: targetUserId, actor_id: user.id, type, post_id: postId, story_id: storyId
    }]);
  }

  // --- データ取得 ---
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
      setPosts(postsData.map(post => ({
        ...post,
        like_count: post.likes?.length || 0,
        comment_count: post.comments?.length || 0,
        is_liked: user ? post.likes?.some(l => l.user_id === user.id) : false
      })));
    }

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: storiesData } = await supabase
      .from('stories')
      .select('*, story_likes(user_id)')
      .gt('created_at', yesterday)
      .order('created_at', { ascending: true });
    
    if (storiesData) {
        setStories(storiesData.map(s => ({
            ...s, is_liked: user ? s.story_likes?.some(l => l.user_id === user.id) : false
        })));
    }

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

  async function handleStoryUpload(e) {
    const file = e.target.files[0];
    if (!file || !user) return;
    setUploading(true);
    const imageUrl = await uploadToCloudinary(file);
    await supabase.from('stories').insert([{ user_id: user.id, image_url: imageUrl }]);
    setUploading(false);
    fetchData();
  }

  async function handleUpdateProfile() {
    setUploading(true);
    let { avatar_url, header_url } = editData;
    if (avatarInputRef.current?.files[0]) avatar_url = await uploadToCloudinary(avatarInputRef.current.files[0]);
    if (headerInputRef.current?.files[0]) header_url = await uploadToCloudinary(headerInputRef.current.files[0]);
    await supabase.from('profiles').update({
      display_name: editData.display_name, username: editData.username, bio: editData.bio, avatar_url, header_url
    }).eq('id', user.id);
    await fetchMyProfile(user.id); await openProfile(user.id); setIsEditing(false); setUploading(false);
  }

  async function toggleLike(postId, isLiked, postOwnerId) {
    if (!user) return;
    if (isLiked) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id);
    } else {
      await supabase.from('likes').insert([{ post_id: postId, user_id: user.id }]);
      createNotification(postOwnerId, 'like', postId);
    }
    fetchData();
  }

  async function toggleStoryLike(storyId, isLiked, storyOwnerId) {
    if (!user) return;
    if (isLiked) {
        await supabase.from('story_likes').delete().eq('story_id', storyId).eq('user_id', user.id);
    } else {
        await supabase.from('story_likes').insert([{ story_id: storyId, user_id: user.id }]);
        createNotification(storyOwnerId, 'story_like', null, storyId);
    }
    fetchData();
  }

  const handleShare = async (post) => {
    try {
      if (navigator.share) await navigator.share({ title: 'GridStream', text: post.content, url: window.location.href });
      else { await navigator.clipboard.writeText(`${post.content}\n${window.location.href}`); alert('リンクをコピーしました！'); }
    } catch (err) { console.log(err); }
  };

  async function handlePost(e) {
    e.preventDefault();
    if (!newPost.trim() || !user) return;
    setUploading(true);
    let imageUrl = null;
    if (fileInputRef.current?.files[0]) imageUrl = await uploadToCloudinary(fileInputRef.current.files[0]);
    await supabase.from('posts').insert([{ content: newPost, user_id: user.id, image_url: imageUrl }]);
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
      const { data } = await supabase.from('follows').select('*').eq('follower_id', user.id).eq('following_id', userId).single();
      isFollowing = !!data;
    }
    setStats({ followers: fers || 0, following: fing || 0, isFollowing });
    setView('profile'); setIsEditing(false); setShowNotifications(false);
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

  const getAvatar = (name, url) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;

  if (!user) return <AuthScreen fetchData={fetchData} />;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className={`max-w-md mx-auto min-h-screen pb-20 border-x font-sans relative shadow-2xl transition-colors duration-300 ${darkMode ? 'bg-black text-white border-gray-800' : 'bg-white text-black border-gray-100'}`}>
      <script src="https://cdn.tailwindcss.com"></script>

      {/* ポップアップ通知 (Toast) */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-sm animate-in slide-in-from-top duration-500">
          <div className="bg-white text-black rounded-2xl p-4 shadow-2xl border flex items-center gap-3">
             <img src={getAvatar(toast.actor?.username, toast.actor?.avatar_url)} className="w-10 h-10 rounded-full object-cover" />
             <div className="flex-grow">
               <p className="text-xs font-bold leading-tight">
                 <span className="font-black">{toast.actor?.display_name}</span> 
                 {toast.type === 'like' && 'さんがいいねしました'}
                 {toast.type === 'follow' && 'さんがフォローしました'}
                 {toast.type === 'comment' && 'さんがコメントしました'}
                 {toast.type === 'story_like' && 'さんがストーリーにいいねしました'}
               </p>
             </div>
             <Heart size={16} className="text-red-500 fill-red-500" />
          </div>
        </div>
      )}

      {viewingStory && (
        <StoryViewer 
          stories={groupedStories[viewingStory.userId]} initialIndex={viewingStory.index} 
          onClose={() => setViewingStory(null)} userProfile={allProfiles.find(p => p.id === viewingStory.userId)}
          getAvatar={getAvatar} onLike={toggleStoryLike} currentUser={user}
        />
      )}

      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} getAvatar={getAvatar} darkMode={darkMode} />}
      {showFollowList && <FollowListModal type={showFollowList} userId={activeProfileId} onClose={() => setShowFollowList(null)} openProfile={openProfile} getAvatar={getAvatar} darkMode={darkMode} />}
      {selectedPost && <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} getAvatar={getAvatar} openProfile={openProfile} onDelete={(id) => { supabase.from('posts').delete().eq('id', id); setSelectedPost(null); fetchData(); }} onLike={toggleLike} onShare={handleShare} currentUser={user} darkMode={darkMode} refreshPosts={fetchData} createNotification={createNotification} />}
      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} user={user} myProfile={myProfile} darkMode={darkMode} setDarkMode={setDarkMode} />}
      {showNotifications && <NotificationCenter notifications={notifications} onClose={() => setShowNotifications(false)} openProfile={openProfile} getAvatar={getAvatar} darkMode={darkMode} />}

      {view === 'home' && (
        <div className="animate-in fade-in">
          <header className={`sticky top-0 z-30 backdrop-blur-md border-b p-4 flex justify-between items-center ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-50'}`}>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-cyan-500 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1">
              <Zap size={24} className="text-blue-600 fill-blue-600" /> GridStream
            </h1>
            <div className="flex gap-4 items-center">
              <div className="relative cursor-pointer" onClick={() => setShowNotifications(true)}>
                <Heart size={24} className={unreadCount > 0 ? "text-red-500" : ""} />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">{unreadCount}</span>}
              </div>
              <MessageCircle size={24} className="cursor-pointer" onClick={() => setView('messages')} />
            </div>
          </header>

          <div className={`p-4 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
            <div className="inline-flex flex-col items-center gap-1 cursor-pointer relative" onClick={() => !uploading && storyInputRef.current.click()}>
              <div className="relative">
                <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className={`w-16 h-16 rounded-full object-cover border-2 p-0.5 ${groupedStories[user.id] ? 'border-blue-500' : 'border-transparent'}`} />
                {!groupedStories[user.id] && <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1 border-2 border-white"><Plus size={12} className="text-white" /></div>}
              </div>
              <span className="text-[10px] font-bold text-gray-400">Your Story</span>
              <input type="file" accept="image/*" ref={storyInputRef} className="hidden" onChange={handleStoryUpload} />
            </div>
            {Object.keys(groupedStories).filter(id => id !== user.id).map(userId => {
               const uProfile = allProfiles.find(p => p.id === userId);
               if (!uProfile) return null;
               return (
                 <div key={userId} className="inline-flex flex-col items-center gap-1 cursor-pointer" onClick={() => setViewingStory({ userId, index: 0 })}>
                   <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500">
                     <img src={getAvatar(uProfile.username, uProfile.avatar_url)} className="w-16 h-16 rounded-full object-cover border-2 border-white" />
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
              <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs shadow-lg uppercase">
                {uploading ? '...' : 'Stream'}
              </button>
            </div>
          </form>

          <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
            {posts.map(post => <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onLike={(id, liked) => toggleLike(id, liked, post.user_id)} onShare={handleShare} currentUser={user} darkMode={darkMode} onOpenDetail={() => setSelectedPost(post)} />)}
          </div>
        </div>
      )}

      {view === 'profile' && profileInfo && <ProfileView user={user} activeProfileId={activeProfileId} profileInfo={profileInfo} posts={posts} isEditing={isEditing} setIsEditing={setIsEditing} editData={editData} setEditData={setEditData} handleUpdateProfile={handleUpdateProfile} uploading={uploading} avatarInputRef={avatarInputRef} headerInputRef={headerInputRef} getAvatar={getAvatar} openProfile={openProfile} toggleFollow={toggleFollow} stats={stats} setShowFollowList={setShowFollowList} setShowSettings={setShowSettings} darkMode={darkMode} setView={setView} toggleLike={toggleLike} handleShare={handleShare} setSelectedPost={setSelectedPost} />}
      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSelectedPost={setSelectedPost} darkMode={darkMode} />}
      {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} setDmTarget={setDmTarget} getAvatar={getAvatar} openProfile={openProfile} darkMode={darkMode} />}

      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 ${darkMode ? 'bg-black/95 border-gray-800 text-gray-600' : 'bg-white/95 border-gray-100 text-gray-300'}`}>
        <HomeIcon onClick={() => {setView('home'); setShowNotifications(false);}} className={`cursor-pointer ${view === 'home' && !showNotifications ? 'text-blue-600' : ''}`} />
        <Search onClick={() => {setView('search'); setShowNotifications(false);}} className={`cursor-pointer ${view === 'search' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <MessageCircle onClick={() => {setView('messages'); setShowNotifications(false);}} className={`cursor-pointer ${view === 'messages' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer ${view === 'profile' && activeProfileId === user.id ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
      </nav>
    </div>
  );
}

// --- サブコンポーネント群 ---

function NotificationCenter({ notifications, onClose, openProfile, getAvatar, darkMode }) {
  useEffect(() => {
    supabase.from('notifications').update({ is_read: true }).eq('is_read', false).then(() => {});
  }, []);
  return (
    <div className={`fixed inset-0 z-[110] ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <header className="p-4 border-b flex items-center gap-4 sticky top-0 bg-inherit z-10">
        <ChevronLeft onClick={onClose} className="cursor-pointer" />
        <h2 className="font-black uppercase tracking-widest">Activity</h2>
      </header>
      <div className="overflow-y-auto h-full pb-20">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 font-bold">No activity yet</div>
        ) : (
          notifications.map(n => (
            <div key={n.id} className="p-4 flex items-center gap-3 hover:bg-gray-50/5 cursor-pointer" onClick={() => {onClose(); openProfile(n.actor_id);}}>
              <img src={getAvatar(n.actor?.username, n.actor?.avatar_url)} className="w-12 h-12 rounded-full object-cover" />
              <div className="flex-grow">
                <p className="text-sm">
                  <span className="font-black mr-1">{n.actor?.display_name}</span>
                  <span className="text-gray-400">{n.type === 'like' ? 'liked your post.' : n.type === 'follow' ? 'started following you.' : n.type === 'comment' ? 'commented on your post.' : 'liked your story.'}</span>
                </p>
                <p className="text-[10px] text-gray-500 font-bold mt-1">{formatTime(n.created_at)}</p>
              </div>
              {n.type === 'follow' ? <UserPlus size={16} className="text-blue-500" /> : <Heart size={16} className="text-red-500 fill-red-500" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PostCard({ post, openProfile, getAvatar, onLike, onShare, currentUser, darkMode, onOpenDetail }) {
  return (
    <article className="p-4 flex gap-3 border-b border-inherit last:border-0">
      <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer object-cover" onClick={() => openProfile(post.profiles.id)} />
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-start mb-1">
          <div className="flex flex-col cursor-pointer" onClick={() => openProfile(post.profiles.id)}>
            <span className="font-black text-sm truncate">{post.profiles?.display_name}</span>
            <span className="text-gray-400 text-[11px] font-bold">@{post.profiles?.username}</span>
          </div>
          <span className="text-[10px] text-gray-400 font-bold">{formatTime(post.created_at)}</span>
        </div>
        <p className="text-[15px] font-medium leading-relaxed mb-2">{post.content}</p>
        {post.image_url && <img src={post.image_url} onClick={onOpenDetail} className="rounded-2xl w-full max-h-80 object-cover cursor-pointer mb-3" />}
        <div className="flex gap-6 text-gray-400">
          <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-1 ${post.is_liked ? 'text-red-500' : ''}`}><Heart size={18} fill={post.is_liked ? "currentColor" : "none"} /><span className="text-xs font-black">{post.like_count || ''}</span></button>
          <button onClick={onOpenDetail} className="flex items-center gap-1"><MessageSquare size={18} /><span className="text-xs font-black">{post.comment_count || ''}</span></button>
          <button onClick={() => onShare(post)}><Share2 size={18} /></button>
        </div>
      </div>
    </article>
  );
}

function StoryViewer({ stories, initialIndex, onClose, userProfile, getAvatar, onLike, currentUser }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const STORY_DURATION = 5000;

  useEffect(() => {
    setProgress(0); startTimer();
    return () => cancelAnimationFrame(timerRef.current);
  }, [currentIndex]);

  const startTimer = () => {
    startTimeRef.current = Date.now();
    const animate = () => {
      if (isPaused) return;
      const elapsed = Date.now() - startTimeRef.current;
      const p = (elapsed / STORY_DURATION) * 100;
      setProgress(p);
      if (elapsed < STORY_DURATION) timerRef.current = requestAnimationFrame(animate);
      else nextStory();
    };
    timerRef.current = requestAnimationFrame(animate);
  };

  const nextStory = () => currentIndex < stories.length - 1 ? setCurrentIndex(prev => prev + 1) : onClose();
  const prevStory = () => currentIndex > 0 ? setCurrentIndex(prev => prev - 1) : setProgress(0);

  const currentStory = stories[currentIndex];

  return (
    <div className="fixed inset-0 z-[150] bg-black flex items-center justify-center">
      <div className="relative w-full max-w-md h-full bg-gray-900 flex flex-col" onMouseDown={() => setIsPaused(true)} onMouseUp={() => {setIsPaused(false); startTimeRef.current = Date.now() - (progress / 100) * STORY_DURATION; startTimer();}}>
        <div className="absolute top-0 left-0 right-0 z-20 p-2 flex gap-1">
          {stories.map((_, idx) => (
            <div key={idx} className="h-0.5 flex-grow bg-white/30 rounded-full overflow-hidden">
              <div className="h-full bg-white" style={{ width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%' }} />
            </div>
          ))}
        </div>
        <div className="absolute top-4 left-0 right-0 z-20 p-3 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <img src={getAvatar(userProfile.username, userProfile.avatar_url)} className="w-8 h-8 rounded-full border border-white/50" />
            <span className="text-sm font-bold">{userProfile.display_name}</span>
          </div>
          <button onClick={onClose}><X size={24} /></button>
        </div>
        <img src={currentStory.image_url} className="w-full h-full object-cover" />
        <div className="absolute bottom-6 left-0 right-0 z-30 px-4 flex items-center gap-4">
            <div className="flex-grow bg-black/20 backdrop-blur-md rounded-full border border-white/30 px-4 py-2 text-white text-sm">Send a message...</div>
            <button onClick={(e) => { e.stopPropagation(); onLike(currentStory.id, currentStory.is_liked, userProfile.id); }} className={`${currentStory.is_liked ? 'text-red-500' : 'text-white'}`}>
                <Heart size={28} fill={currentStory.is_liked ? "currentColor" : "none"} />
            </button>
        </div>
      </div>
    </div>
  );
}

function PostDetailModal({ post, onClose, getAvatar, openProfile, onDelete, onLike, onShare, currentUser, darkMode, refreshPosts, createNotification }) {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  useEffect(() => {
    supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at', { ascending: false }).then(({data}) => data && setComments(data));
  }, [post.id]);
  async function handlePostComment(e) {
    e.preventDefault(); if (!commentText.trim()) return;
    await supabase.from('comments').insert([{ post_id: post.id, user_id: currentUser.id, content: commentText }]);
    createNotification(post.user_id, 'comment', post.id);
    setCommentText(''); refreshPosts();
    const { data } = await supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at', { ascending: false });
    if (data) setComments(data);
  }
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-3xl flex flex-col h-[85vh] overflow-hidden ${darkMode ? 'bg-black border border-gray-800' : 'bg-white'}`}>
        <div className="p-4 border-b flex justify-between items-center">
          <button onClick={onClose}><ChevronLeft size={24}/></button>
          <span className="font-black text-sm uppercase">Post</span>
          <div className="w-6" />
        </div>
        <div className="flex-grow overflow-y-auto p-4">
          <div className="flex gap-3 mb-4">
            <img src={getAvatar(post.profiles.username, post.profiles.avatar_url)} className="w-10 h-10 rounded-full" />
            <div><p className="font-black text-sm">{post.profiles.display_name}</p><p className="text-xs text-gray-400">{post.content}</p></div>
          </div>
          <div className="space-y-4 border-t pt-4">
            {comments.map(c => (
              <div key={c.id} className="flex gap-3 text-sm">
                <img src={getAvatar(c.profiles?.username, c.profiles?.avatar_url)} className="w-8 h-8 rounded-full" />
                <div className={`p-3 rounded-2xl flex-grow ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}><p className="font-bold text-xs">@{c.profiles?.username}</p><p>{c.content}</p></div>
              </div>
            ))}
          </div>
        </div>
        <form onSubmit={handlePostComment} className="p-4 border-t flex gap-2">
          <input type="text" placeholder="Add a comment..." className={`flex-grow p-3 rounded-xl outline-none text-sm ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`} value={commentText} onChange={(e) => setCommentText(e.target.value)} />
          <button type="submit" className="text-blue-500 font-bold">Post</button>
        </form>
      </div>
    </div>
  );
}

function ProfileView({ user, activeProfileId, profileInfo, posts, isEditing, setIsEditing, editData, setEditData, handleUpdateProfile, uploading, avatarInputRef, headerInputRef, getAvatar, openProfile, toggleFollow, stats, setShowFollowList, setShowSettings, darkMode, setView, toggleLike, handleShare, setSelectedPost }) {
  const userPosts = posts.filter(p => p.user_id === activeProfileId);
  const isMe = user.id === activeProfileId;
  const [tab, setTab] = useState('grid');
  return (
    <div className="animate-in slide-in-from-right duration-300">
      <header className={`sticky top-0 z-30 backdrop-blur-md border-b p-4 flex items-center justify-between ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-50'}`}>
        <div className="flex items-center gap-4">
          <ChevronLeft className="cursor-pointer" onClick={() => setView('home')} />
          <h2 className="font-black text-lg truncate w-32 uppercase tracking-tighter">{profileInfo.display_name}</h2>
        </div>
        {isMe ? <Settings className="cursor-pointer" onClick={() => setShowSettings(true)} /> : <div className="w-6" />}
      </header>
      <div className="relative">
        <div className="h-32 bg-gray-200 overflow-hidden relative">
          {profileInfo.header_url && <img src={profileInfo.header_url} className="w-full h-full object-cover" />}
          {isEditing && <div className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer" onClick={() => headerInputRef.current.click()}><Camera className="text-white" /></div>}
          <input type="file" ref={headerInputRef} className="hidden" accept="image/*" />
        </div>
        <div className="px-4 pb-4">
          <div className="relative flex justify-between items-end -mt-10 mb-3">
            <div className="relative">
              <img src={getAvatar(profileInfo.username, profileInfo.avatar_url)} className={`w-24 h-24 rounded-full border-4 object-cover ${darkMode ? 'border-black' : 'border-white'}`} />
              {isEditing && <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center cursor-pointer" onClick={() => avatarInputRef.current.click()}><Camera className="text-white" /></div>}
              <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" />
            </div>
            {isMe ? (
              <button onClick={() => isEditing ? handleUpdateProfile() : setIsEditing(true)} className={`px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest border-2 transition ${isEditing ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200'}`}>
                {uploading ? '...' : isEditing ? 'Save' : 'Edit Profile'}
              </button>
            ) : (
              <button onClick={toggleFollow} className={`px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest transition ${stats.isFollowing ? (darkMode ? 'bg-gray-800' : 'bg-gray-100') : 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'}`}>
                {stats.isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
          {isEditing ? (
            <div className="space-y-3">
              <input className={`w-full p-2 rounded-lg font-bold ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`} value={editData.display_name} onChange={e => setEditData({...editData, display_name: e.target.value})} placeholder="Display Name" />
              <input className={`w-full p-2 rounded-lg text-sm ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`} value={editData.bio} onChange={e => setEditData({...editData, bio: e.target.value})} placeholder="Bio" />
            </div>
          ) : (
            <>
              <h3 className="text-xl font-black">{profileInfo.display_name}</h3>
              <p className="text-gray-400 font-bold text-sm mb-2 uppercase tracking-tighter">@{profileInfo.username}</p>
              <p className="text-sm font-medium mb-4 leading-relaxed">{profileInfo.bio || 'No bio yet.'}</p>
            </>
          )}
          <div className="flex gap-6 border-y py-4 border-inherit">
            <div className="cursor-pointer" onClick={() => setShowFollowList('followers')}><span className="font-black text-lg">{stats.followers}</span> <span className="text-gray-400 text-xs font-bold uppercase ml-1">Followers</span></div>
            <div className="cursor-pointer" onClick={() => setShowFollowList('following')}><span className="font-black text-lg">{stats.following}</span> <span className="text-gray-400 text-xs font-bold uppercase ml-1">Following</span></div>
          </div>
        </div>
      </div>
      <div className="flex border-b border-inherit">
        <button onClick={() => setTab('grid')} className={`flex-1 py-4 flex justify-center ${tab === 'grid' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-400'}`}><Grid size={20}/></button>
        <button onClick={() => setTab('list')} className={`flex-1 py-4 flex justify-center ${tab === 'list' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-400'}`}><List size={20}/></button>
      </div>
      {tab === 'grid' ? (
        <div className="grid grid-cols-3 gap-0.5">
          {userPosts.map(post => post.image_url && (
            <div key={post.id} onClick={() => setSelectedPost(post)} className="aspect-square relative group cursor-pointer">
              <img src={post.image_url} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white font-bold"><Heart size={16} className="mr-1 fill-white" /> {post.like_count}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-inherit">
          {userPosts.map(post => <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onLike={(id, liked) => toggleLike(id, liked, post.user_id)} onShare={handleShare} currentUser={user} darkMode={darkMode} onOpenDetail={() => setSelectedPost(post)} />)}
        </div>
      )}
    </div>
  );
}

function SearchView({ posts, openProfile, searchQuery, setSearchQuery, setSelectedPost, darkMode }) {
  const filteredPosts = posts.filter(p => p.content.toLowerCase().includes(searchQuery.toLowerCase()));
  return (
    <div className="p-4 animate-in fade-in">
      <div className={`flex items-center gap-2 p-3 rounded-2xl mb-6 ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <Search size={20} className="text-gray-400" />
        <input className="bg-transparent border-none focus:ring-0 w-full font-bold outline-none" placeholder="Search posts..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-1">
        {filteredPosts.map(post => post.image_url && (
          <img key={post.id} src={post.image_url} onClick={() => setSelectedPost(post)} className="aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80 transition" />
        ))}
      </div>
    </div>
  );
}

function MessagesList({ allProfiles, user, setDmTarget, getAvatar, openProfile, darkMode }) {
  return (
    <div className="animate-in slide-in-from-right duration-300">
      <header className="p-4 border-b flex justify-between items-center"><h2 className="font-black text-lg uppercase tracking-widest">Messages</h2><MessageSquare /></header>
      <div className="divide-y divide-inherit">
        {allProfiles.filter(p => p.id !== user.id).map(profile => (
          <div key={profile.id} className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50/5" onClick={() => setDmTarget(profile)}>
            <img src={getAvatar(profile.username, profile.avatar_url)} className="w-14 h-14 rounded-full object-cover" />
            <div><p className="font-black">{profile.display_name}</p><p className="text-xs text-gray-400 font-bold uppercase">Click to chat</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DMScreen({ target, setDmTarget, currentUser, getAvatar, darkMode }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  useEffect(() => {
    fetchMessages();
    const channel = supabase.channel(`dm-${target.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchMessages).subscribe();
    return () => supabase.removeChannel(channel);
  }, [target.id]);
  async function fetchMessages() {
    const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
    if (data) setMessages(data);
  }
  async function handleSend(e) {
    e.preventDefault(); if (!text.trim()) return;
    await supabase.from('messages').insert([{ sender_id: currentUser.id, receiver_id: target.id, content: text }]);
    setText(''); fetchMessages();
  }
  return (
    <div className={`fixed inset-0 z-[120] flex flex-col ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <header className="p-4 border-b flex items-center gap-4">
        <ChevronLeft onClick={() => setDmTarget(null)} className="cursor-pointer" />
        <img src={getAvatar(target.username, target.avatar_url)} className="w-8 h-8 rounded-full" />
        <span className="font-black">{target.display_name}</span>
      </header>
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] p-3 rounded-2xl text-sm font-medium ${m.sender_id === currentUser.id ? 'bg-blue-600 text-white' : (darkMode ? 'bg-gray-900' : 'bg-gray-100')}`}>{m.content}</div>
          </div>
        ))}
      </div>
      <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
        <input className={`flex-grow p-3 rounded-xl outline-none ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`} placeholder="Message..." value={text} onChange={e => setText(e.target.value)} />
        <button type="submit" className="text-blue-500 font-bold">Send</button>
      </form>
    </div>
  );
}

function SettingsScreen({ onClose, user, myProfile, darkMode, setDarkMode }) {
  return (
    <div className={`fixed inset-0 z-[150] p-6 animate-in slide-in-from-bottom duration-300 ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <div className="flex justify-between items-center mb-10"><h2 className="text-2xl font-black uppercase">Settings</h2><X onClick={onClose} className="cursor-pointer" /></div>
      <div className="space-y-6">
        <div className="flex justify-between items-center p-4 rounded-2xl bg-gray-50/5 border">
          <div className="flex items-center gap-3"><Zap size={20} /> <span className="font-bold">Dark Mode</span></div>
          <button onClick={() => setDarkMode(!darkMode)} className={`w-12 h-6 rounded-full transition-colors relative ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${darkMode ? 'left-7' : 'left-1'}`} /></button>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center gap-3 p-4 rounded-2xl bg-red-50 text-red-600 font-black uppercase tracking-widest transition active:scale-95"><LogOut size={20} /> Sign Out</button>
      </div>
    </div>
  );
}

function FollowListModal({ type, userId, onClose, openProfile, getAvatar, darkMode }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    async function fetchList() {
      const { data } = await supabase.from('follows').select(type === 'followers' ? 'profiles!follower_id(*)' : 'profiles!following_id(*)').eq(type === 'followers' ? 'following_id' : 'follower_id', userId);
      if (data) setList(data.map(d => d.profiles));
    }
    fetchList();
  }, [type, userId]);
  return (
    <div className="fixed inset-0 z-[140] bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className={`w-full max-w-sm rounded-[2rem] overflow-hidden animate-in slide-in-from-bottom duration-300 ${darkMode ? 'bg-black border border-gray-800' : 'bg-white'}`}>
        <div className="p-4 border-b flex justify-between items-center"><span className="font-black uppercase">{type}</span><X onClick={onClose} className="cursor-pointer" /></div>
        <div className="max-h-96 overflow-y-auto p-4 space-y-4">
          {list.map(p => (
            <div key={p.id} className="flex items-center gap-3 cursor-pointer" onClick={() => { onClose(); openProfile(p.id); }}><img src={getAvatar(p.username, p.avatar_url)} className="w-10 h-10 rounded-full object-cover" /><div><p className="font-black text-sm">{p.display_name}</p><p className="text-xs text-gray-400 font-bold">@{p.username}</p></div></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuthScreen({ fetchData }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  async function handleAuth(e) {
    e.preventDefault();
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message); else fetchData();
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { alert(error.message); return; }
      if (data?.user) {
        await supabase.from('profiles').insert([{ id: data.user.id, username: email.split('@')[0], display_name: displayName }]);
        alert('Welcome! Please sign in.'); setIsLogin(true);
      }
    }
  }
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-white text-black">
      <script src="https://cdn.tailwindcss.com"></script>
      <div className="w-20 h-20 bg-gradient-to-tr from-blue-700 to-cyan-500 rounded-[2rem] flex items-center justify-center shadow-2xl mb-6 rotate-6 animate-pulse"><Zap size={40} color="white" fill="white" /></div>
      <h1 className="text-4xl font-black mb-10 text-blue-700 italic uppercase">GridStream</h1>
      <form onSubmit={handleAuth} className="w-full max-w-xs space-y-4">
        {!isLogin && <input type="text" placeholder="DISPLAY NAME" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />}
        <input type="email" placeholder="EMAIL" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="PASSWORD" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="w-full bg-blue-700 text-white font-black py-5 rounded-2xl uppercase tracking-widest shadow-xl active:scale-95 transition">{isLogin ? 'Sign In' : 'Join Now'}</button>
      </form>
      <button onClick={() => setIsLogin(!isLogin)} className="mt-8 text-xs font-black text-gray-400 uppercase tracking-widest">{isLogin ? "New here? Create Account" : "Have an account? Sign In"}</button>
    </div>
  );
    }
