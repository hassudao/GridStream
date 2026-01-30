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
  const [toast, setToast] = useState(null); // リアルタイム通知ポップアップ用
  const [editData, setEditData] = useState({ display_name: '', username: '', bio: '', avatar_url: '', header_url: '' });
  const [myProfile, setMyProfile] = useState({ username: '', display_name: '', bio: '', avatar_url: '', header_url: '' });
  const [newPost, setNewPost] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [uploading, setUploading] = useState(false);
  
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

  // --- 通知関連ロジック ---
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
      .channel('realtime_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, 
        async (payload) => {
          const { data: actor } = await supabase.from('profiles').select('*').eq('id', payload.new.actor_id).single();
          const fullNotification = { ...payload.new, actor };
          setNotifications(prev => [fullNotification, ...prev]);
          setToast(fullNotification); // ポップアップを表示
          setTimeout(() => setToast(null), 4000); // 4秒で消す
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }

  async function createNotification(targetUserId, type, postId = null, storyId = null) {
    if (targetUserId === user.id) return; // 自分自身の行動は通知しない
    await supabase.from('notifications').insert([{
      user_id: targetUserId,
      actor_id: user.id,
      type,
      post_id: postId,
      story_id: storyId
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
  const [dmTarget, setDmTarget] = useState(null);

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

          {/* ストーリーズトレイ */}
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
               const hasUnread = true; // 簡易化のため全て未読風
               return (
                 <div key={userId} className="inline-flex flex-col items-center gap-1 cursor-pointer" onClick={() => setViewingStory({ userId, index: 0 })}>
                   <div className={`p-[2px] rounded-full ${hasUnread ? 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500' : 'bg-gray-200'}`}>
                     <img src={getAvatar(uProfile.username, uProfile.avatar_url)} className="w-16 h-16 rounded-full object-cover border-2 border-white" />
                   </div>
                   <span className="text-[10px] font-bold max-w-[64px] truncate">{uProfile.display_name}</span>
                 </div>
               );
            })}
          </div>

          {/* 投稿フォーム */}
          <form onSubmit={handlePost} className={`p-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            <div className="flex gap-3">
              <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-10 h-10 rounded-full object-cover shadow-sm cursor-pointer" onClick={() => openProfile(user.id)} />
              <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none bg-transparent font-medium" placeholder="What's happening?" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-12 mt-2">
              <label className="cursor-pointer text-blue-500 hover:bg-blue-50/10 p-2 rounded-full transition"><ImageIcon size={22}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
              <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs shadow-lg uppercase tracking-tighter">
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
        <ProfileView 
           user={user} activeProfileId={activeProfileId} profileInfo={profileInfo} posts={posts} isEditing={isEditing} setIsEditing={setIsEditing} editData={editData} setEditData={setEditData} 
           handleUpdateProfile={handleUpdateProfile} uploading={uploading} avatarInputRef={avatarInputRef} headerInputRef={headerInputRef} getAvatar={getAvatar} openProfile={openProfile} 
           toggleFollow={toggleFollow} stats={stats} setShowFollowList={setShowFollowList} setShowSettings={setShowSettings} darkMode={darkMode} setView={setView} toggleLike={toggleLike} handleShare={handleShare} setSelectedPost={setSelectedPost}
        />
      )}
      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSelectedPost={setSelectedPost} darkMode={darkMode} />}
      {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} setDmTarget={setDmTarget} getAvatar={getAvatar} openProfile={openProfile} darkMode={darkMode} />}

      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 shadow-sm ${darkMode ? 'bg-black/95 border-gray-800 text-gray-600' : 'bg-white/95 border-gray-100 text-gray-300'}`}>
        <HomeIcon onClick={() => {setView('home'); setShowNotifications(false);}} className={`cursor-pointer ${view === 'home' && !showNotifications ? 'text-blue-600' : ''}`} />
        <Search onClick={() => {setView('search'); setShowNotifications(false);}} className={`cursor-pointer ${view === 'search' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <MessageCircle onClick={() => {setView('messages'); setShowNotifications(false);}} className={`cursor-pointer ${view === 'messages' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer ${view === 'profile' && activeProfileId === user.id ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
      </nav>
    </div>
  );
}

// --- 通知センターコンポーネント ---
function NotificationCenter({ notifications, onClose, openProfile, getAvatar, darkMode, setNotifications }) {
  useEffect(() => {
    // 開いたら既読にする
    const markAsRead = async () => {
        await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    };
    markAsRead();
  }, []);

  return (
    <div className={`fixed inset-0 z-[110] animate-in slide-in-from-right duration-300 ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <header className="p-4 border-b flex items-center gap-4 sticky top-0 z-10 bg-inherit">
        <ChevronLeft onClick={onClose} className="cursor-pointer" />
        <h2 className="font-black uppercase tracking-widest text-lg">Activity</h2>
      </header>
      <div className="overflow-y-auto h-full pb-20">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Bell size={48} className="mb-2 opacity-20" />
            <p className="font-bold">No activity yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100/10">
            {notifications.map(n => (
              <div key={n.id} className={`p-4 flex items-center gap-3 hover:bg-gray-50/5 transition cursor-pointer`} onClick={() => {onClose(); openProfile(n.actor_id);}}>
                <img src={getAvatar(n.actor?.username, n.actor?.avatar_url)} className="w-12 h-12 rounded-full object-cover" />
                <div className="flex-grow">
                  <p className="text-sm">
                    <span className="font-black mr-1">{n.actor?.display_name}</span>
                    <span className="font-medium text-gray-400">
                        {n.type === 'like' && 'liked your post.'}
                        {n.type === 'follow' && 'started following you.'}
                        {n.type === 'comment' && 'commented on your post.'}
                        {n.type === 'story_like' && 'liked your story.'}
                    </span>
                  </p>
                  <p className="text-[10px] text-gray-500 font-bold mt-1 uppercase">{formatTime(n.created_at)}</p>
                </div>
                {n.type === 'follow' ? (
                   <UserPlus size={16} className="text-blue-500" />
                ) : (
                   <Heart size={16} className="text-red-500 fill-red-500" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- ストーリービューアー (Like機能追加) ---
function StoryViewer({ stories, initialIndex, onClose, userProfile, getAvatar, onLike, currentUser }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const STORY_DURATION = 5000;
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    setProgress(0);
    startTimer();
    return () => cancelAnimationFrame(timerRef.current);
  }, [currentIndex]);

  const startTimer = () => {
    startTimeRef.current = Date.now();
    const animate = () => {
      if (isPaused) return;
      const elapsed = Date.now() - startTimeRef.current;
      const p = (elapsed / STORY_DURATION) * 100;
      setProgress(p);

      if (elapsed < STORY_DURATION) {
        timerRef.current = requestAnimationFrame(animate);
      } else {
        nextStory();
      }
    };
    timerRef.current = requestAnimationFrame(animate);
  };

  const nextStory = () => {
    if (currentIndex < stories.length - 1) setCurrentIndex(prev => prev + 1);
    else onClose();
  };

  const prevStory = () => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
    else { setProgress(0); startTimeRef.current = Date.now(); }
  };

  const handlePointerDown = () => { setIsPaused(true); cancelAnimationFrame(timerRef.current); };
  const handlePointerUp = () => { setIsPaused(false); startTimeRef.current = Date.now() - (progress / 100) * STORY_DURATION; startTimer(); };

  const currentStory = stories[currentIndex];

  return (
    <div className="fixed inset-0 z-[150] bg-black flex items-center justify-center">
      <div className="absolute inset-0 bg-cover bg-center blur-2xl opacity-30" style={{ backgroundImage: `url(${currentStory.image_url})` }} />
      <div 
        className="relative w-full max-w-md h-full sm:h-[90vh] sm:rounded-2xl overflow-hidden bg-gray-900 flex flex-col"
        onMouseDown={handlePointerDown} onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown} onTouchEnd={handlePointerUp}
      >
        <div className="absolute top-0 left-0 right-0 z-20 p-2 flex gap-1">
          {stories.map((_, idx) => (
            <div key={idx} className="h-0.5 flex-grow bg-white/30 rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all duration-100 ease-linear" style={{ width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%' }} />
            </div>
          ))}
        </div>

        <div className="absolute top-4 left-0 right-0 z-20 p-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src={getAvatar(userProfile.username, userProfile.avatar_url)} className="w-8 h-8 rounded-full border border-white/50" />
            <span className="text-white text-sm font-bold shadow-black drop-shadow-md">{userProfile.display_name}</span>
            <span className="text-white/60 text-xs font-medium">{formatTime(currentStory.created_at)}</span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-white p-2"><X size={24} /></button>
        </div>

        <div className="absolute inset-0 z-10 flex">
          <div className="w-1/3 h-full" onClick={prevStory} />
          <div className="w-2/3 h-full" onClick={nextStory} />
        </div>

        <img src={currentStory.image_url} className="w-full h-full object-cover" />

        {/* ストーリーのいいねボタン */}
        <div className="absolute bottom-6 left-0 right-0 z-30 px-4 flex items-center gap-4">
            <div className="flex-grow bg-black/20 backdrop-blur-md rounded-full border border-white/30 px-4 py-2 text-white text-sm font-medium">
                Send a message...
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); onLike(currentStory.id, currentStory.is_liked, userProfile.id); }} 
                className={`transition-transform active:scale-150 ${currentStory.is_liked ? 'text-red-500' : 'text-white'}`}
            >
                <Heart size={28} fill={currentStory.is_liked ? "currentColor" : "none"} />
            </button>
            <Send size={24} className="text-white" />
        </div>
      </div>
    </div>
  );
}

// --- 他のコンポーネント (PostCard, ProfileView, etc.) は基本維持、一部調整 ---

function PostCard({ post, openProfile, getAvatar, onLike, onShare, currentUser, darkMode, onOpenDetail }) {
  return (
    <article className={`p-4 flex gap-3 transition border-b last:border-0 ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
      <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer object-cover" onClick={() => openProfile(post.profiles.id)} />
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-start mb-1">
          <div className="flex flex-col cursor-pointer max-w-[70%]" onClick={() => openProfile(post.profiles.id)}>
            <span className="font-black text-sm truncate">{post.profiles?.display_name}</span>
            <span className="text-gray-400 text-[11px] font-bold truncate">@{post.profiles?.username}</span>
          </div>
          <span className="text-[10px] text-gray-400 font-bold whitespace-nowrap pt-1">{formatTime(post.created_at)}</span>
        </div>
        <p className="text-[15px] mt-1 font-medium leading-relaxed whitespace-pre-wrap">{post.content}</p>
        {post.image_url && <img src={post.image_url} onClick={onOpenDetail} className="mt-3 rounded-2xl w-full max-h-80 object-cover border border-gray-100/10 cursor-pointer hover:brightness-95 transition" />}
        <div className="flex justify-between mt-4 text-gray-400 max-w-[200px] items-center">
          <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 transition ${post.is_liked ? 'text-red-500 scale-110' : 'hover:text-red-500'}`}><Heart size={18} fill={post.is_liked ? "currentColor" : "none"} /><span className="text-xs font-black">{post.like_count || ''}</span></button>
          <button onClick={onOpenDetail} className="flex items-center gap-1.5 hover:text-blue-500 transition"><MessageSquare size={18} /><span className="text-xs font-black">{post.comment_count || ''}</span></button>
          <button onClick={() => onShare(post)} className="hover:text-green-500 transition"><Share2 size={18} /></button>
        </div>
      </div>
    </article>
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

// 既存の ProfileView, SettingsScreen, SearchView, MessagesList, DMScreen, FollowListModal, AuthScreen は index(3).js と同様ですが、
// App コンポーネント内で通知の unreadCount を監視しているため、ヘッダーに♡アイコンが表示されます。
// ※ 長さの関係で ProfileView 以下の詳細ロジックは index(3).js を踏襲してください。
