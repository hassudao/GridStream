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

  async function fetchNotifications() {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:profiles!actor_id(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) setNotifications(data);
  }

  function subscribeToNotifications() {
    const channel = supabase
      .channel('realtime_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, 
        async (payload) => {
          const { data: actor } = await supabase.from('profiles').select('*').eq('id', payload.new.actor_id).single();
          const fullNotification = { ...payload.new, actor };
          setNotifications(prev => [fullNotification, ...prev]);
          setToast(fullNotification);
          setTimeout(() => setToast(null), 4000);
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }

  async function createNotification(targetUserId, type, postId = null, storyId = null) {
    if (!user || targetUserId === user.id) return;
    await supabase.from('notifications').insert([{
      user_id: targetUserId,
      actor_id: user.id,
      type,
      post_id: postId,
      story_id: storyId
    }]);
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
    const { data: storiesData } = await supabase
      .from('stories')
      .select('*, story_likes(user_id)')
      .gt('created_at', yesterday)
      .order('created_at', { ascending: true });
    
    if (storiesData) {
        const formattedStories = storiesData.map(s => ({
            ...s,
            is_liked: user ? s.story_likes?.some(l => l.user_id === user.id) : false
        }));
        setStories(formattedStories);
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

    const { error } = await supabase.from('profiles').update({
      display_name: editData.display_name, username: editData.username, bio: editData.bio, avatar_url, header_url
    }).eq('id', user.id);

    if (!error) { await fetchMyProfile(user.id); await openProfile(user.id); setIsEditing(false); }
    setUploading(false);
  }

  async function toggleLike(postId, isLiked, postOwnerId) {
    if (!user) return;
    const updateLogic = (p) => p.id === postId ? { ...p, is_liked: !isLiked, like_count: isLiked ? Math.max(0, p.like_count - 1) : p.like_count + 1 } : p;
    setPosts(prev => prev.map(updateLogic));
    if (selectedPost?.id === postId) setSelectedPost(prev => updateLogic(prev));
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
    } catch (err) { console.log('Share failed', err); }
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

      {/* インアプリ通知ポップアップ (Toast) */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-sm animate-in slide-in-from-top duration-500">
          <div className="bg-white text-black rounded-2xl p-4 shadow-2xl border flex items-center gap-3">
             <img src={getAvatar(toast.actor?.username, toast.actor?.avatar_url)} className="w-10 h-10 rounded-full object-cover" />
             <div className="flex-grow">
               <p className="text-xs font-bold">
                 <span className="font-black">{toast.actor?.display_name}</span> 
                 {toast.type === 'like' && 'さんがあなたの投稿にいいねしました'}
                 {toast.type === 'follow' && 'さんがあなたをフォローしました'}
                 {toast.type === 'comment' && 'さんがあなたの投稿にコメントしました'}
                 {toast.type === 'story_like' && 'さんがあなたのストーリーにいいねしました'}
               </p>
             </div>
             <Heart size={16} className="text-red-500 fill-red-500" />
          </div>
        </div>
      )}

      {/* ストーリービューアー */}
      {viewingStory && (
        <StoryViewer 
          stories={groupedStories[viewingStory.userId]} 
          initialIndex={viewingStory.index} 
          onClose={() => setViewingStory(null)} 
          userProfile={allProfiles.find(p => p.id === viewingStory.userId)}
          getAvatar={getAvatar}
          onLike={toggleStoryLike}
          currentUser={user}
        />
      )}

      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} getAvatar={getAvatar} darkMode={darkMode} />}
      {showFollowList && <FollowListModal type={showFollowList} userId={activeProfileId} onClose={() => setShowFollowList(null)} openProfile={openProfile} getAvatar={getAvatar} darkMode={darkMode} />}
      {selectedPost && <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} getAvatar={getAvatar} openProfile={openProfile} onDelete={(id) => { supabase.from('posts').delete().eq('id', id); setSelectedPost(null); fetchData(); }} onLike={toggleLike} onShare={handleShare} currentUser={user} darkMode={darkMode} refreshPosts={fetchData} createNotification={createNotification} />}
      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} user={user} myProfile={myProfile} darkMode={darkMode} setDarkMode={setDarkMode} />}
      {showNotifications && <NotificationCenter notifications={notifications} onClose={() => setShowNotifications(false)} openProfile={openProfile} getAvatar={getAvatar} darkMode={darkMode} setNotifications={setNotifications} />}

      {/* ホーム画面 */}
      {view === 'home' && (
        <div className="animate-in fade-in">
          <header className={`sticky top-0 z-30 backdrop-blur-md border-b p-4 flex justify-between items-center ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-50'}`}>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-cyan-500 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1">
              <Zap size={24} className="text-blue-600 fill-blue-600" /> GridStream
            </h1>
            <div className="flex gap-4 items-center">
              <div className="relative cursor-pointer" onClick={() => setShowNotifications(true)}>
                <Heart size={24} className={unreadCount > 0 ? "text-red-500" : ""} />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white animate-bounce">{unreadCount}</span>}
              </div>
              <MessageCircle size={24} className="cursor-pointer" onClick={() => setView('messages')} />
            </div>
          </header>

          <div className={`p-4 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
            <div className="inline-flex flex-col items-center gap-1 cursor-pointer relative" onClick={() => !uploading && storyInputRef.current.click()}>
              <div className="relative">
                <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className={`w-16 h-16 rounded-full object-cover border-2 p-0.5 ${groupedStories[user.id] ? 'border-blue-500' : 'border-transparent'}`} />
                {!groupedStories[user.id] && (
                   <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1 border-2 border-white"><Plus size={12} className="text-white" /></div>
                )}
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
              <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none bg-transparent" placeholder="What's happening?" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-12 mt-2">
              <label className="cursor-pointer text-blue-500 hover:bg-blue-50/10 p-2 rounded-full transition"><ImageIcon size={22}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
              <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs uppercase">
                {uploading ? '...' : 'Stream'}
              </button>
            </div>
          </form>

          <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
            {posts.map(post => (
              <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onLike={(id, liked) => toggleLike(id, liked, post.user_id)} onShare={handleShare} currentUser={user} darkMode={darkMode} onOpenDetail={() => setSelectedPost(post)} />
            ))}
          </div>
        </div>
      )}

      {view === 'profile' && profileInfo && (
        <ProfileView user={user} activeProfileId={activeProfileId} profileInfo={profileInfo} posts={posts} isEditing={isEditing} setIsEditing={setIsEditing} editData={editData} setEditData={setEditData} handleUpdateProfile={handleUpdateProfile} uploading={uploading} avatarInputRef={avatarInputRef} headerInputRef={headerInputRef} getAvatar={getAvatar} openProfile={openProfile} toggleFollow={toggleFollow} stats={stats} setShowFollowList={setShowFollowList} setShowSettings={setShowSettings} darkMode={darkMode} setView={setView} toggleLike={toggleLike} handleShare={handleShare} setSelectedPost={setSelectedPost} />
      )}
      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSelectedPost={setSelectedPost} darkMode={darkMode} />}
      {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} setDmTarget={setDmTarget} getAvatar={getAvatar} openProfile={openProfile} darkMode={darkMode} />}

      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 ${darkMode ? 'bg-black/95 border-gray-800 text-gray-400' : 'bg-white/95 border-gray-100 text-gray-300'}`}>
        <HomeIcon onClick={() => {setView('home'); setShowNotifications(false);}} className={`cursor-pointer ${view === 'home' && !showNotifications ? 'text-blue-600' : ''}`} />
        <Search onClick={() => {setView('search'); setShowNotifications(false);}} className={`cursor-pointer ${view === 'search' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <MessageCircle onClick={() => {setView('messages'); setShowNotifications(false);}} className={`cursor-pointer ${view === 'messages' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer ${view === 'profile' && activeProfileId === user.id ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
      </nav>
    </div>
  );
}

// --- サブコンポーネント群 ---

function AuthScreen({ fetchData }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  async function handleAuth(e) {
    e.preventDefault();
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) alert(error.message);
      else if (data.user) {
        await supabase.from('profiles').insert([{ id: data.user.id, username: email.split('@')[0], display_name: displayName }]);
        alert('登録完了！ログインしてください。');
        setIsLogin(true);
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-white text-black">
      <div className="w-20 h-20 bg-gradient-to-tr from-blue-700 to-cyan-500 rounded-[2rem] flex items-center justify-center shadow-2xl mb-6 rotate-6 animate-pulse"><Zap size={40} color="white" fill="white" /></div>
      <h1 className="text-4xl font-black mb-10 text-blue-700 italic uppercase">GridStream</h1>
      <form onSubmit={handleAuth} className="w-full max-w-xs space-y-4">
        {!isLogin && <input type="text" placeholder="DISPLAY NAME" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />}
        <input type="email" placeholder="EMAIL" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="PASSWORD" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="w-full bg-blue-700 text-white font-black py-5 rounded-2xl uppercase tracking-widest">{isLogin ? 'Login' : 'Join'}</button>
      </form>
      <button onClick={() => setIsLogin(!isLogin)} className="mt-8 text-xs font-black text-gray-400 uppercase tracking-widest">{isLogin ? "Need an account? Sign Up" : "Have an account? Login"}</button>
    </div>
  );
}

function NotificationCenter({ notifications, onClose, openProfile, getAvatar, darkMode }) {
  useEffect(() => {
    supabase.from('notifications').update({ is_read: true }).eq('is_read', false).then();
  }, []);

  return (
    <div className={`fixed inset-0 z-[110] animate-in slide-in-from-right duration-300 ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <header className="p-4 border-b flex items-center gap-4 sticky top-0 bg-inherit">
        <ChevronLeft onClick={onClose} className="cursor-pointer" />
        <h2 className="font-black uppercase tracking-widest text-lg">Activity</h2>
      </header>
      <div className="overflow-y-auto h-full pb-20">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400"><Bell size={48} className="mb-2 opacity-20" /><p className="font-bold">No activity yet</p></div>
        ) : (
          <div className="divide-y divide-gray-100/10">
            {notifications.map(n => (
              <div key={n.id} className="p-4 flex items-center gap-3 hover:bg-gray-50/5 cursor-pointer" onClick={() => {onClose(); openProfile(n.actor_id);}}>
                <img src={getAvatar(n.actor?.username, n.actor?.avatar_url)} className="w-12 h-12 rounded-full object-cover" />
                <div className="flex-grow">
                  <p className="text-sm"><span className="font-black mr-1">{n.actor?.display_name}</span>
                    <span className="font-medium text-gray-400">
                      {n.type === 'like' && 'liked your post.'}
                      {n.type === 'follow' && 'started following you.'}
                      {n.type === 'comment' && 'commented on your post.'}
                      {n.type === 'story_like' && 'liked your story.'}
                    </span>
                  </p>
                  <p className="text-[10px] text-gray-500 font-bold mt-1">{formatTime(n.created_at)}</p>
                </div>
                {n.type === 'follow' ? <UserPlus size={16} className="text-blue-500" /> : <Heart size={16} className="text-red-500 fill-red-500" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StoryViewer({ stories, initialIndex, onClose, userProfile, getAvatar, onLike }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const STORY_DURATION = 5000;
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => { setProgress(0); startTimer(); return () => cancelAnimationFrame(timerRef.current); }, [currentIndex]);

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

  const nextStory = () => { if (currentIndex < stories.length - 1) setCurrentIndex(prev => prev + 1); else onClose(); };
  const prevStory = () => { if (currentIndex > 0) setCurrentIndex(prev => prev - 1); else { setProgress(0); startTimeRef.current = Date.now(); } };
  const currentStory = stories[currentIndex];

  return (
    <div className="fixed inset-0 z-[150] bg-black flex items-center justify-center">
      <div className="relative w-full max-w-md h-full bg-gray-900 flex flex-col" onMouseDown={() => setIsPaused(true)} onMouseUp={() => {setIsPaused(false); startTimeRef.current = Date.now() - (progress / 100) * STORY_DURATION; startTimer();}}>
        <div className="absolute top-0 left-0 right-0 z-20 p-2 flex gap-1">
          {stories.map((_, idx) => (
            <div key={idx} className="h-0.5 flex-grow bg-white/30 rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all duration-100 ease-linear" style={{ width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%' }} />
            </div>
          ))}
        </div>
        <div className="absolute top-4 left-0 right-0 z-20 p-3 flex justify-between items-center">
          <div className="flex items-center gap-2"><img src={getAvatar(userProfile.username, userProfile.avatar_url)} className="w-8 h-8 rounded-full" /><span className="text-white text-sm font-bold">{userProfile.display_name}</span></div>
          <button onClick={onClose} className="text-white p-2"><X size={24} /></button>
        </div>
        <div className="absolute inset-0 z-10 flex"><div className="w-1/3 h-full" onClick={prevStory} /><div className="w-2/3 h-full" onClick={nextStory} /></div>
        <img src={currentStory.image_url} className="w-full h-full object-cover" />
        <div className="absolute bottom-6 left-0 right-0 z-30 px-4 flex items-center gap-4">
            <div className="flex-grow bg-black/20 backdrop-blur-md rounded-full border border-white/30 px-4 py-2 text-white text-sm">Send a message...</div>
            <button onClick={(e) => { e.stopPropagation(); onLike(currentStory.id, currentStory.is_liked, userProfile.id); }} className={`transition-transform active:scale-150 ${currentStory.is_liked ? 'text-red-500' : 'text-white'}`}><Heart size={28} fill={currentStory.is_liked ? "currentColor" : "none"} /></button>
            <Send size={24} className="text-white" />
        </div>
      </div>
    </div>
  );
}

function PostCard({ post, openProfile, getAvatar, onLike, onShare, darkMode, onOpenDetail }) {
  return (
    <article className={`p-4 flex gap-3 transition border-b last:border-0 ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
      <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer object-cover" onClick={() => openProfile(post.profiles.id)} />
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-start mb-1">
          <div className="flex flex-col cursor-pointer max-w-[70%]" onClick={() => openProfile(post.profiles.id)}>
            <span className="font-black text-sm truncate">{post.profiles?.display_name}</span>
            <span className="text-gray-400 text-[11px] font-bold truncate">@{post.profiles?.username}</span>
          </div>
          <span className="text-[10px] text-gray-400 font-bold">{formatTime(post.created_at)}</span>
        </div>
        <p className="text-[15px] mt-1 font-medium whitespace-pre-wrap">{post.content}</p>
        {post.image_url && <img src={post.image_url} onClick={onOpenDetail} className="mt-3 rounded-2xl w-full max-h-80 object-cover border cursor-pointer hover:brightness-95 transition" />}
        <div className="flex justify-between mt-4 text-gray-400 max-w-[200px] items-center">
          <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 transition ${post.is_liked ? 'text-red-500 scale-110' : 'hover:text-red-500'}`}><Heart size={18} fill={post.is_liked ? "currentColor" : "none"} /><span className="text-xs font-black">{post.like_count || ''}</span></button>
          <button onClick={onOpenDetail} className="flex items-center gap-1.5 hover:text-blue-500 transition"><MessageSquare size={18} /><span className="text-xs font-black">{post.comment_count || ''}</span></button>
          <button onClick={() => onShare(post)} className="hover:text-green-500 transition"><Share2 size={18} /></button>
        </div>
      </div>
    </article>
  );
}

function ProfileView({ user, activeProfileId, profileInfo, posts, isEditing, setIsEditing, editData, setEditData, handleUpdateProfile, uploading, avatarInputRef, headerInputRef, getAvatar, openProfile, toggleFollow, stats, setShowFollowList, setShowSettings, darkMode, toggleLike, handleShare, setSelectedPost }) {
  const userPosts = posts.filter(p => p.user_id === activeProfileId);
  const isOwnProfile = user && user.id === activeProfileId;
  return (
    <div className="animate-in fade-in pb-20">
      <header className={`sticky top-0 z-30 backdrop-blur-md p-4 flex items-center justify-between ${darkMode ? 'bg-black/80' : 'bg-white/80'}`}>
        <div className="flex items-center gap-4"><ChevronLeft className="cursor-pointer" onClick={() => window.history.back()} /><div className="flex flex-col"><span className="font-black text-lg uppercase tracking-tighter">{profileInfo.display_name}</span><span className="text-xs text-gray-400 font-bold">{userPosts.length} Streams</span></div></div>
        {isOwnProfile && <Settings className="cursor-pointer text-gray-400" onClick={() => setShowSettings(true)} />}
      </header>
      <div className="relative">
        <div className={`h-32 w-full ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>{profileInfo.header_url && <img src={profileInfo.header_url} className="w-full h-full object-cover" />}</div>
        <div className="absolute -bottom-12 left-4 p-1 bg-white rounded-full"><img src={getAvatar(profileInfo.username, profileInfo.avatar_url)} className="w-24 h-24 rounded-full border-4 border-white object-cover" /></div>
      </div>
      <div className="mt-14 px-4">
        <div className="flex justify-end gap-2 mb-4">
          {isOwnProfile ? (
            <button onClick={() => setIsEditing(!isEditing)} className="px-6 py-2 rounded-full border-2 border-gray-100 font-black text-xs uppercase">{isEditing ? 'Cancel' : 'Edit Profile'}</button>
          ) : (
            <button onClick={toggleFollow} className={`px-6 py-2 rounded-full font-black text-xs uppercase ${stats.isFollowing ? 'border-2 border-gray-100' : 'bg-blue-600 text-white'}`}>{stats.isFollowing ? 'Following' : 'Follow'}</button>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-4 p-4 bg-gray-50 rounded-[2rem]">
            <input type="text" placeholder="Display Name" className="w-full p-4 rounded-xl outline-none" value={editData.display_name} onChange={(e) => setEditData({...editData, display_name: e.target.value})} />
            <textarea placeholder="Bio" className="w-full p-4 rounded-xl outline-none h-24" value={editData.bio} onChange={(e) => setEditData({...editData, bio: e.target.value})} />
            <div className="flex gap-2"><label className="flex-1 p-3 bg-white rounded-xl text-center text-xs font-bold cursor-pointer"><ImageIcon size={16} className="mx-auto mb-1" /> Avatar<input type="file" ref={avatarInputRef} className="hidden" /></label><label className="flex-1 p-3 bg-white rounded-xl text-center text-xs font-bold cursor-pointer"><ImageIcon size={16} className="mx-auto mb-1" /> Header<input type="file" ref={headerInputRef} className="hidden" /></label></div>
            <button onClick={handleUpdateProfile} disabled={uploading} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase">{uploading ? 'Uploading...' : 'Save Changes'}</button>
          </div>
        ) : (
          <div><h2 className="text-xl font-black">{profileInfo.display_name}</h2><p className="text-gray-400 font-bold text-sm mb-4">@{profileInfo.username}</p><p className="text-sm font-medium leading-relaxed mb-4">{profileInfo.bio}</p><div className="flex gap-6 mb-6"><div className="cursor-pointer" onClick={() => setShowFollowList('following')}><span className="font-black">{stats.following}</span> <span className="text-gray-400 text-xs font-bold uppercase">Following</span></div><div className="cursor-pointer" onClick={() => setShowFollowList('followers')}><span className="font-black">{stats.followers}</span> <span className="text-gray-400 text-xs font-bold uppercase">Followers</span></div></div></div>
        )}
      </div>
      <div className={`grid grid-cols-3 gap-0.5 border-t mt-4 ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
        {userPosts.map(post => (
          <div key={post.id} onClick={() => setSelectedPost(post)} className="aspect-square bg-gray-100 overflow-hidden cursor-pointer hover:opacity-90">
            {post.image_url ? <img src={post.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center p-2 text-[10px] font-bold text-gray-400">{post.content}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PostDetailModal({ post, onClose, getAvatar, openProfile, onDelete, onLike, onShare, currentUser, darkMode, refreshPosts, createNotification }) {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(false);
  const isMyPost = currentUser && post.user_id === currentUser.id;
  useEffect(() => { fetchComments(); }, [post.id]);
  async function fetchComments() {
    const { data } = await supabase.from('comments').select('*, profiles(id, username, display_name, avatar_url)').eq('post_id', post.id).order('created_at', { ascending: false });
    if (data) setComments(data);
  }
  async function handlePostComment(e) {
    e.preventDefault(); if (!commentText.trim() || !currentUser) return;
    setLoading(true); 
    await supabase.from('comments').insert([{ post_id: post.id, user_id: currentUser.id, content: commentText }]);
    createNotification(post.user_id, 'comment', post.id);
    setCommentText(''); await fetchComments(); refreshPosts(); setLoading(false);
  }
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-[2.5rem] flex flex-col h-[85vh] overflow-hidden shadow-2xl ${darkMode ? 'bg-black border border-gray-800' : 'bg-white text-black'}`}>
        <div className={`p-4 border-b flex items-center justify-between ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
          <div className="flex items-center gap-3" onClick={() => { onClose(); openProfile(post.profiles.id); }}><img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-8 h-8 rounded-full object-cover" /><div className="flex flex-col"><span className="font-black text-[10px]">@{post.profiles?.username}</span><span className="text-[8px] text-gray-400 font-bold uppercase">{formatTime(post.created_at)}</span></div></div>
          <div className="flex items-center gap-2">{isMyPost && <button onClick={() => onDelete(post.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={20}/></button>}<button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600"><X size={24}/></button></div>
        </div>
        <div className="flex-grow overflow-y-auto">
          <div className="p-5 border-b">{post.image_url && <img src={post.image_url} className="w-full rounded-2xl mb-4 border border-gray-100/10" />}<p className="font-medium leading-relaxed mb-4 whitespace-pre-wrap">{post.content}</p></div>
          <div className="p-5 space-y-4 pb-10">
            {comments.map(c => (<div key={c.id} className="flex gap-3"><img src={getAvatar(c.profiles?.username, c.profiles?.avatar_url)} className="w-8 h-8 rounded-full object-cover" /><div className={`flex-grow p-3 rounded-2xl ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}><div className="flex justify-between items-start"><span className="font-black text-[10px]">@{c.profiles?.username}</span></div><p className="text-sm font-medium">{c.content}</p></div></div>))}
          </div>
        </div>
        <form onSubmit={handlePostComment} className={`p-4 border-t flex gap-2 ${darkMode ? 'bg-black border-gray-800' : 'bg-white'}`}><input type="text" placeholder="コメントを入力..." className={`flex-grow p-4 rounded-2xl text-sm outline-none font-medium ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50'}`} value={commentText} onChange={(e) => setCommentText(e.target.value)} /><button type="submit" disabled={loading || !commentText.trim()} className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg active:scale-95 transition"><Send size={18}/></button></form>
      </div>
    </div>
  );
}

function SettingsScreen({ onClose, user, myProfile, darkMode, setDarkMode }) {
  return (
    <div className={`fixed inset-0 z-[120] animate-in slide-in-from-bottom duration-300 ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <header className="p-4 border-b flex items-center gap-4"><ChevronLeft onClick={onClose} className="cursor-pointer" /><h2 className="font-black uppercase tracking-widest text-lg">Settings</h2></header>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between p-4 bg-gray-50/5 rounded-2xl"><div className="flex items-center gap-3"><Settings size={20} /><span>Dark Mode</span></div><button onClick={() => setDarkMode(!darkMode)} className={`w-12 h-6 rounded-full transition relative ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${darkMode ? 'left-7' : 'left-1'}`} /></button></div>
        <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center gap-3 p-4 bg-red-500/10 text-red-500 rounded-2xl font-black uppercase text-sm"><LogOut size={20} /> Logout</button>
      </div>
    </div>
  );
}

function SearchView({ posts, openProfile, searchQuery, setSearchQuery, setSelectedPost, darkMode }) {
  const filteredPosts = posts.filter(p => p.content.toLowerCase().includes(searchQuery.toLowerCase()));
  return (
    <div className="animate-in fade-in">
      <div className="p-4 sticky top-0 z-20 bg-inherit"><div className={`flex items-center gap-2 p-3 rounded-2xl ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}><Search size={20} className="text-gray-400" /><input type="text" placeholder="Explore GridStream..." className="bg-transparent outline-none w-full font-bold" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div></div>
      <div className="grid grid-cols-3 gap-0.5">
        {filteredPosts.map(post => (
          <div key={post.id} onClick={() => setSelectedPost(post)} className="aspect-square bg-gray-100 overflow-hidden cursor-pointer relative group">
            {post.image_url ? <img src={post.image_url} className="w-full h-full object-cover transition group-hover:scale-110" /> : <div className="w-full h-full flex items-center justify-center p-2 text-[10px] font-bold text-gray-400">{post.content}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function MessagesList({ allProfiles, user, setDmTarget, getAvatar, openProfile, darkMode }) {
  return (
    <div className="animate-in fade-in">
      <header className="p-6 border-b"><h2 className="text-2xl font-black uppercase tracking-tighter">Messages</h2></header>
      <div className="divide-y divide-gray-100/10">
        {allProfiles.filter(p => p.id !== user.id).map(profile => (
          <div key={profile.id} className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50/5 transition" onClick={() => setDmTarget(profile)}>
            <img src={getAvatar(profile.username, profile.avatar_url)} className="w-14 h-14 rounded-full object-cover" />
            <div className="flex-grow">
              <h3 className="font-black text-sm">{profile.display_name}</h3>
              <p className="text-gray-400 text-xs font-medium">Click to chat</p>
            </div>
            <ChevronLeft className="rotate-180 text-gray-300" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DMScreen({ target, setDmTarget, currentUser, getAvatar, darkMode }) {
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    const channel = supabase.channel(`dm:${target.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchMessages).subscribe();
    return () => supabase.removeChannel(channel);
  }, [target.id]);

  async function fetchMessages() {
    const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
    if (data) setMessages(data);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  async function sendMessage(e) {
    e.preventDefault(); if (!newMsg.trim()) return;
    await supabase.from('messages').insert([{ sender_id: currentUser.id, receiver_id: target.id, content: newMsg }]);
    setNewMsg(''); fetchMessages();
  }

  return (
    <div className={`fixed inset-0 z-[200] flex flex-col ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <header className="p-4 border-b flex items-center gap-3 sticky top-0 bg-inherit z-10"><ChevronLeft onClick={() => setDmTarget(null)} className="cursor-pointer" /><img src={getAvatar(target.username, target.avatar_url)} className="w-10 h-10 rounded-full object-cover" /><h2 className="font-black">{target.display_name}</h2></header>
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] p-4 rounded-[2rem] text-sm font-medium ${m.sender_id === currentUser.id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-gray-100 text-black rounded-tl-none'}`}>{m.content}</div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <form onSubmit={sendMessage} className="p-4 border-t flex gap-2"><input type="text" placeholder="Message..." className="flex-grow p-4 rounded-2xl bg-gray-50 text-black outline-none font-medium" value={newMsg} onChange={(e) => setNewMsg(e.target.value)} /><button type="submit" className="bg-blue-600 text-white p-4 rounded-2xl active:scale-95 transition"><Send size={20}/></button></form>
    </div>
  );
}

function FollowListModal({ type, userId, onClose, openProfile, getAvatar, darkMode }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    async function fetchList() {
      const { data } = await supabase.from('follows').select(type === 'followers' ? 'profiles!follower_id(*)' : 'profiles!following_id(*)').eq(type === 'followers' ? 'following_id' : 'follower_id', userId);
      if (data) setList(data.map(item => item.profiles));
    }
    fetchList();
  }, [type, userId]);
  return (
    <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className={`w-full max-w-sm rounded-[2.5rem] p-6 animate-in slide-in-from-bottom ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
        <div className="flex justify-between items-center mb-6"><h3 className="font-black uppercase tracking-widest">{type}</h3><X className="cursor-pointer" onClick={onClose} /></div>
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {list.map(p => (<div key={p.id} className="flex items-center gap-3 cursor-pointer" onClick={() => { onClose(); openProfile(p.id); }}><img src={getAvatar(p.username, p.avatar_url)} className="w-10 h-10 rounded-full object-cover" /><div><p className="font-black text-sm">{p.display_name}</p><p className="text-xs text-gray-400 font-bold">@{p.username}</p></div></div>))}
        </div>
      </div>
    </div>
  );
            }
