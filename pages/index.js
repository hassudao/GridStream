import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User as UserIcon, Grid, List, Image as ImageIcon, Send, ChevronLeft, Zap, LogOut, Settings, Trash2, MessageSquare, Save, UserCheck, AtSign, AlignLeft, Lock, Mail, Clock, UserPlus, UserMinus, Plus } from 'lucide-react';

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

  useEffect(() => { fetchData(); }, [user]);

  useEffect(() => {
    if (stories.length > 0) {
      const grouped = stories.reduce((acc, story) => {
        if (!acc[story.user_id]) acc[story.user_id] = [];
        acc[story.user_id].push(story);
        return acc;
      }, {});
      setGroupedStories(grouped);
    } else {
      setGroupedStories({});
    }
  }, [stories]);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      fetchMyProfile(session.user.id);
    }
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
      setPosts(postsData.map(post => ({
        ...post,
        like_count: post.likes?.length || 0,
        comment_count: post.comments?.length || 0,
        is_liked: user ? post.likes?.some(l => l.user_id === user.id) : false
      })));
    }

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: storiesData } = await supabase.from('stories').select('*').gt('created_at', yesterday).order('created_at', { ascending: true });
    if (storiesData) setStories(storiesData);

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
    await supabase.from('profiles').update({ display_name: editData.display_name, username: editData.username, bio: editData.bio, avatar_url, header_url }).eq('id', user.id);
    await fetchMyProfile(user.id);
    await openProfile(user.id);
    setIsEditing(false);
    setUploading(false);
  }

  async function toggleLike(postId, isLiked) {
    if (!user) return;
    if (isLiked) await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id);
    else await supabase.from('likes').insert([{ post_id: postId, user_id: user.id }]);
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
      const { data } = await supabase.from('follows').select('*').eq('follower_id', user.id).eq('following_id', userId).single();
      isFollowing = !!data;
    }
    setStats({ followers: fers || 0, following: fing || 0, isFollowing });
    setView('profile');
    setIsEditing(false);
  };

  async function toggleFollow() {
    if (!user || !activeProfileId || user.id === activeProfileId) return;
    if (stats.isFollowing) await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', activeProfileId);
    else await supabase.from('follows').insert([{ follower_id: user.id, following_id: activeProfileId }]);
    openProfile(activeProfileId);
  }

  const getAvatar = (name, url) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
  const [dmTarget, setDmTarget] = useState(null);

  if (!user) return <AuthScreen fetchData={fetchData} />;

  return (
    <div className={`max-w-md mx-auto min-h-screen pb-20 border-x font-sans relative shadow-2xl transition-colors duration-300 ${darkMode ? 'bg-black text-white border-gray-800' : 'bg-white text-black border-gray-100'}`}>
      <script src="https://cdn.tailwindcss.com"></script>

      {viewingStory && (
        <StoryViewer 
          stories={groupedStories[viewingStory.userId]} 
          initialIndex={viewingStory.index} 
          onClose={() => setViewingStory(null)} 
          userProfile={allProfiles.find(p => p.id === viewingStory.userId)}
          getAvatar={getAvatar}
        />
      )}

      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} getAvatar={getAvatar} darkMode={darkMode} />}
      {showFollowList && <FollowListModal type={showFollowList} userId={activeProfileId} onClose={() => setShowFollowList(null)} openProfile={openProfile} getAvatar={getAvatar} darkMode={darkMode} />}
      {selectedPost && <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} getAvatar={getAvatar} openProfile={openProfile} onDelete={async (id) => { await supabase.from('posts').delete().eq('id', id); setSelectedPost(null); fetchData(); }} onLike={toggleLike} currentUser={user} darkMode={darkMode} refreshPosts={fetchData} />}
      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} user={user} darkMode={darkMode} setDarkMode={setDarkMode} />}

      {view === 'home' && (
        <div className="animate-in fade-in">
          <header className={`sticky top-0 z-30 backdrop-blur-md border-b p-4 flex justify-between items-center ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-50'}`}>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-cyan-500 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1">
              <Zap size={24} className="text-blue-600 fill-blue-600" /> GridStream
            </h1>
            <MessageCircle size={24} className="cursor-pointer" onClick={() => setView('messages')} />
          </header>

          <div className={`p-4 overflow-x-auto flex gap-4 border-b scrollbar-hide ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
            <div className="flex flex-col items-center gap-1 cursor-pointer shrink-0" onClick={() => storyInputRef.current.click()}>
              <div className="relative">
                <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 p-0.5" />
                <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1 border-2 border-white"><Plus size={12} className="text-white" /></div>
              </div>
              <span className="text-[10px] font-bold text-gray-400">Your Story</span>
              <input type="file" accept="image/*" ref={storyInputRef} className="hidden" onChange={handleStoryUpload} />
            </div>
            {Object.keys(groupedStories).filter(id => id !== user.id).map(userId => {
               const u = allProfiles.find(p => p.id === userId);
               if (!u) return null;
               return (
                 <div key={userId} className="flex flex-col items-center gap-1 cursor-pointer shrink-0" onClick={() => setViewingStory({ userId, index: 0 })}>
                   <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500">
                     <img src={getAvatar(u.username, u.avatar_url)} className="w-16 h-16 rounded-full object-cover border-2 border-white" />
                   </div>
                   <span className="text-[10px] font-bold max-w-[64px] truncate">{u.display_name}</span>
                 </div>
               );
            })}
          </div>

          <form onSubmit={async (e) => {
            e.preventDefault(); if (!newPost.trim()) return; setUploading(true);
            let img = null; if (fileInputRef.current?.files[0]) img = await uploadToCloudinary(fileInputRef.current.files[0]);
            await supabase.from('posts').insert([{ content: newPost, user_id: user.id, image_url: img }]);
            setNewPost(''); fetchData(); setUploading(false);
          }} className={`p-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            <div className="flex gap-3">
              <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-10 h-10 rounded-full object-cover cursor-pointer" onClick={() => openProfile(user.id)} />
              <textarea className="flex-grow bg-transparent outline-none resize-none h-16 font-medium" placeholder="What's happening?" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-12">
              <label className="cursor-pointer text-blue-500"><ImageIcon size={20}/><input type="file" ref={fileInputRef} className="hidden" /></label>
              <button className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs uppercase">{uploading ? '...' : 'Stream'}</button>
            </div>
          </form>

          <div className="divide-y divide-gray-100">
            {posts.map(post => (
              <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onLike={toggleLike} currentUser={user} darkMode={darkMode} onOpenDetail={() => setSelectedPost(post)} />
            ))}
          </div>
        </div>
      )}

      {view === 'profile' && profileInfo && (
        <ProfileView 
          user={user} activeProfileId={activeProfileId} profileInfo={profileInfo} posts={posts} isEditing={isEditing} setIsEditing={setIsEditing} editData={editData} setEditData={setEditData} 
          handleUpdateProfile={handleUpdateProfile} uploading={uploading} avatarInputRef={avatarInputRef} headerInputRef={headerInputRef} getAvatar={getAvatar} openProfile={openProfile} 
          toggleFollow={toggleFollow} stats={stats} setShowFollowList={setShowFollowList} setShowSettings={setShowSettings} darkMode={darkMode} setView={setView} toggleLike={toggleLike} setSelectedPost={setSelectedPost}
        />
      )}
      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSelectedPost={setSelectedPost} darkMode={darkMode} />}
      {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} setDmTarget={setDmTarget} getAvatar={getAvatar} openProfile={openProfile} darkMode={darkMode} />}

      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 ${darkMode ? 'bg-black border-gray-800 text-gray-600' : 'bg-white border-gray-100 text-gray-300'}`}>
        <HomeIcon onClick={() => setView('home')} className={`cursor-pointer ${view === 'home' ? 'text-blue-600' : ''}`} />
        <Search onClick={() => setView('search')} className={`cursor-pointer ${view === 'search' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <MessageCircle onClick={() => setView('messages')} className={`cursor-pointer ${view === 'messages' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer ${view === 'profile' && activeProfileId === user.id ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
      </nav>
    </div>
  );
}

function StoryViewer({ stories, initialIndex, onClose, userProfile, getAvatar }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const STORY_DURATION = 5000;
  const timerRef = useRef();
  const startTimeRef = useRef();

  useEffect(() => {
    setProgress(0);
    startTimeRef.current = Date.now();
    const animate = () => {
      if (isPaused) return;
      const elapsed = Date.now() - startTimeRef.current;
      const p = (elapsed / STORY_DURATION) * 100;
      setProgress(p);
      if (elapsed < STORY_DURATION) timerRef.current = requestAnimationFrame(animate);
      else if (currentIndex < stories.length - 1) setCurrentIndex(prev => prev + 1);
      else onClose();
    };
    timerRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(timerRef.current);
  }, [currentIndex, isPaused]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
      <div className="relative w-full max-w-md h-full bg-gray-900 overflow-hidden" 
           onMouseDown={() => setIsPaused(true)} onMouseUp={() => { setIsPaused(false); startTimeRef.current = Date.now() - (progress/100)*STORY_DURATION; }}>
        <div className="absolute top-0 left-0 right-0 z-20 p-2 flex gap-1">
          {stories.map((_, i) => (
            <div key={i} className="h-0.5 flex-grow bg-white/30 rounded-full overflow-hidden">
              <div className="h-full bg-white" style={{ width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%' }} />
            </div>
          ))}
        </div>
        <div className="absolute top-4 left-0 right-0 z-20 p-3 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <img src={getAvatar(userProfile.username, userProfile.avatar_url)} className="w-8 h-8 rounded-full border border-white/50" />
            <span className="text-sm font-bold">{userProfile.display_name}</span>
          </div>
          <X size={24} className="cursor-pointer" onClick={onClose} />
        </div>
        <div className="absolute inset-0 z-10 flex">
          <div className="w-1/3 h-full" onClick={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)} />
          <div className="w-2/3 h-full" onClick={() => currentIndex < stories.length - 1 ? setCurrentIndex(currentIndex + 1) : onClose()} />
        </div>
        <img src={stories[currentIndex].image_url} className="w-full h-full object-cover" />
      </div>
    </div>
  );
}

function ProfileView(props) {
  const { user, activeProfileId, profileInfo, posts, isEditing, setIsEditing, editData, setEditData, handleUpdateProfile, uploading, avatarInputRef, headerInputRef, getAvatar, openProfile, toggleFollow, stats, setShowFollowList, setShowSettings, darkMode, setView, toggleLike, setSelectedPost } = props;
  if (isEditing) return (
    <div className="space-y-6">
      <header className="p-4 flex justify-between items-center border-b">
        <X onClick={() => setIsEditing(false)} className="cursor-pointer"/>
        <h2 className="font-black uppercase">Edit Profile</h2>
        <button onClick={handleUpdateProfile} className="text-blue-600 font-black">{uploading ? '...' : 'Save'}</button>
      </header>
      <div className="px-4 space-y-4">
        <div className="relative w-24 h-24 mx-auto" onClick={() => avatarInputRef.current.click()}>
          <img src={getAvatar(editData.username, editData.avatar_url)} className="w-full h-full rounded-full object-cover border-4 border-blue-500" />
          <input type="file" ref={avatarInputRef} className="hidden" />
        </div>
        <input className={`w-full p-4 rounded-xl ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`} value={editData.display_name} onChange={e => setEditData({...editData, display_name: e.target.value})} placeholder="Display Name" />
        <textarea className={`w-full p-4 rounded-xl h-24 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`} value={editData.bio} onChange={e => setEditData({...editData, bio: e.target.value})} placeholder="Bio" />
      </div>
    </div>
  );
  return (
    <>
      <div className="relative h-44 bg-gray-200">
        <img src={profileInfo.header_url || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&q=80'} className="w-full h-full object-cover" />
        <div className="absolute top-4 inset-x-4 flex justify-between">
          <ChevronLeft onClick={() => setView('home')} className="bg-black/30 p-2 rounded-full text-white cursor-pointer" size={36}/>
          {user.id === activeProfileId && <Settings onClick={() => setShowSettings(true)} className="bg-black/30 p-2 rounded-full text-white cursor-pointer" size={36}/>}
        </div>
      </div>
      <div className="px-4 -mt-12">
        <div className="flex justify-between items-end mb-4">
          <img src={getAvatar(profileInfo.username, profileInfo.avatar_url)} className="w-24 h-24 rounded-full border-4 border-white object-cover" />
          {user.id === activeProfileId ? (
            <button onClick={() => setIsEditing(true)} className="border border-gray-300 px-6 py-2 rounded-full font-black text-xs uppercase">Edit</button>
          ) : (
            <button onClick={toggleFollow} className={`px-6 py-2 rounded-full font-black text-xs uppercase ${stats.isFollowing ? 'bg-gray-200' : 'bg-blue-600 text-white'}`}>
              {stats.isFollowing ? 'Unfollow' : 'Follow'}
            </button>
          )}
        </div>
        <h2 className="text-2xl font-black">{profileInfo.display_name}</h2>
        <p className="text-gray-400 font-bold">@{profileInfo.username}</p>
        <p className="mt-2 font-medium">{profileInfo.bio || 'GridStream member.'}</p>
        <div className="flex gap-4 mt-4 text-sm">
          <button onClick={() => setShowFollowList('following')}><span className="font-black">{stats.following}</span> Following</button>
          <button onClick={() => setShowFollowList('followers')}><span className="font-black">{stats.followers}</span> Followers</button>
        </div>
      </div>
      <div className="mt-8 border-t divide-y divide-gray-100">
        {posts.filter(p => p.user_id === activeProfileId).map(post => (
          <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onLike={toggleLike} currentUser={user} darkMode={darkMode} onOpenDetail={() => setSelectedPost(post)} />
        ))}
      </div>
    </>
  );
}

function PostCard({ post, openProfile, getAvatar, onLike, currentUser, darkMode, onOpenDetail }) {
  return (
    <div className="p-4 flex gap-3 border-b">
      <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer object-cover" onClick={() => openProfile(post.profiles.id)} />
      <div className="flex-grow">
        <div className="flex justify-between"><span className="font-black text-sm">{post.profiles?.display_name}</span><span className="text-[10px] text-gray-400">{formatTime(post.created_at)}</span></div>
        <p className="text-sm mt-1 whitespace-pre-wrap">{post.content}</p>
        {post.image_url && <img src={post.image_url} className="mt-3 rounded-2xl w-full max-h-80 object-cover cursor-pointer" onClick={onOpenDetail} />}
        <div className="flex gap-6 mt-4 text-gray-400">
          <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-1 ${post.is_liked ? 'text-red-500' : ''}`}><Heart size={18} fill={post.is_liked ? 'currentColor' : 'none'}/> {post.like_count}</button>
          <button onClick={onOpenDetail} className="flex items-center gap-1"><MessageSquare size={18}/> {post.comment_count}</button>
        </div>
      </div>
    </div>
  );
}

function PostDetailModal({ post, onClose, getAvatar, openProfile, onDelete, onLike, currentUser, darkMode, refreshPosts }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  useEffect(() => { 
    const fetchComments = async () => {
      const { data } = await supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at', { ascending: false });
      if (data) setComments(data);
    };
    fetchComments();
  }, [post.id]);
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
      <div className={`w-full max-w-md h-[80vh] rounded-[2rem] flex flex-col overflow-hidden ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
        <div className="p-4 border-b flex justify-between items-center">
          <button onClick={onClose}><X size={24}/></button>
          {currentUser.id === post.user_id && <button onClick={() => onDelete(post.id)}><Trash2 size={20}/></button>}
        </div>
        <div className="flex-grow overflow-y-auto p-4">
          {post.image_url && <img src={post.image_url} className="w-full rounded-xl mb-4" />}
          <p className="font-bold">{post.content}</p>
          <div className="mt-8 space-y-4">
            {comments.map(c => (
              <div key={c.id} className="flex gap-3 text-sm">
                <img src={getAvatar(c.profiles?.username, c.profiles?.avatar_url)} className="w-8 h-8 rounded-full" />
                <div className="flex-grow bg-gray-50 p-3 rounded-xl text-black">
                  <p className="font-black text-xs">@{c.profiles?.username}</p>
                  <p>{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <form onSubmit={async (e) => {
          e.preventDefault(); if (!text.trim()) return;
          await supabase.from('comments').insert([{ post_id: post.id, user_id: currentUser.id, content: text }]);
          setText(''); refreshPosts(); onClose();
        }} className="p-4 border-t flex gap-2">
          <input className="flex-grow bg-gray-100 p-3 rounded-xl text-black" value={text} onChange={e => setText(e.target.value)} placeholder="Add comment..." />
          <button className="bg-blue-600 text-white p-3 rounded-xl"><Send size={18}/></button>
        </form>
      </div>
    </div>
  );
}

function SearchView({ posts, openProfile, searchQuery, setSearchQuery, setSelectedPost, darkMode }) {
  return (
    <div>
      <div className="p-4 border-b"><div className="relative"><Search className="absolute left-3 top-3 text-gray-400" size={18}/><input className={`w-full p-2 pl-10 rounded-xl outline-none ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`} placeholder="Search Grid" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div></div>
      <div className="grid grid-cols-3 gap-0.5">
        {posts.filter(p => p.image_url).map(p => <img key={p.id} src={p.image_url} className="aspect-square object-cover cursor-pointer" onClick={() => setSelectedPost(p)} />)}
      </div>
    </div>
  );
}

function MessagesList({ allProfiles, user, setDmTarget, getAvatar, openProfile, darkMode }) {
  return (
    <div className="p-4">
      <h2 className="text-xl font-black mb-4">Messages</h2>
      {allProfiles.filter(p => p.id !== user.id).map(u => (
        <div key={u.id} className="flex items-center gap-4 py-3 cursor-pointer" onClick={() => setDmTarget(u)}>
          <img src={getAvatar(u.username, u.avatar_url)} className="w-14 h-14 rounded-full" />
          <div className="flex-grow border-b pb-3"><p className="font-bold">{u.display_name}</p><p className="text-xs text-gray-400">Tap to chat</p></div>
        </div>
      ))}
    </div>
  );
}

function DMScreen({ target, setDmTarget, currentUser, getAvatar, darkMode }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
      if (data) setMsgs(data);
    };
    fetch();
  }, [target.id]);
  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <header className="p-4 border-b flex items-center gap-3"><ChevronLeft onClick={() => setDmTarget(null)}/><img src={getAvatar(target.username, target.avatar_url)} className="w-8 h-8 rounded-full"/><span className="font-black">{target.display_name}</span></header>
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {msgs.map(m => <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}><div className={`p-3 rounded-2xl max-w-[80%] ${m.sender_id === currentUser.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-black'}`}>{m.text}</div></div>)}
      </div>
      <form onSubmit={async (e) => {
        e.preventDefault(); if (!text.trim()) return;
        await supabase.from('messages').insert([{ sender_id: currentUser.id, receiver_id: target.id, text }]);
        setText(''); setDmTarget(null); // Simple refresh
      }} className="p-4 border-t flex gap-2"><input className="flex-grow bg-gray-100 p-3 rounded-xl text-black" value={text} onChange={e => setText(e.target.value)} /><button className="bg-blue-600 text-white p-3 rounded-xl"><Send size={18}/></button></form>
    </div>
  );
}

function FollowListModal({ type, userId, onClose, openProfile, getAvatar, darkMode }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    const fetch = async () => {
      const col = type === 'followers' ? 'follower_id' : 'following_id';
      const filter = type === 'followers' ? 'following_id' : 'follower_id';
      const { data } = await supabase.from('follows').select(`profiles!follows_${col}_fkey(*)`).eq(filter, userId);
      if (data) setList(data.map(d => d.profiles));
    };
    fetch();
  }, [type, userId]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
      <div className={`w-full max-w-xs rounded-2xl p-4 ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
        <div className="flex justify-between mb-4"><h3 className="font-black uppercase">{type}</h3><X onClick={onClose} className="cursor-pointer"/></div>
        <div className="space-y-4">{list.map(u => <div key={u.id} className="flex items-center gap-3 cursor-pointer" onClick={() => { onClose(); openProfile(u.id); }}><img src={getAvatar(u.username, u.avatar_url)} className="w-10 h-10 rounded-full"/><span>{u.display_name}</span></div>)}</div>
      </div>
    </div>
  );
}

function SettingsScreen({ onClose, darkMode, setDarkMode }) {
  return (
    <div className={`fixed inset-0 z-[110] p-6 ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <div className="flex justify-between items-center mb-8"><h2 className="text-2xl font-black">Settings</h2><X onClick={onClose} className="cursor-pointer"/></div>
      <div className="space-y-6">
        <button onClick={() => setDarkMode(!darkMode)} className="w-full flex justify-between p-4 bg-gray-100 rounded-2xl text-black font-bold"><span>Dark Mode</span><span>{darkMode ? 'ON' : 'OFF'}</span></button>
        <button onClick={() => supabase.auth.signOut()} className="w-full p-4 bg-red-500 text-white rounded-2xl font-bold uppercase">Logout</button>
      </div>
    </div>
  );
}

function AuthScreen({ fetchData }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [displayName, setDisplayName] = useState('');
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-white">
      <div className="w-20 h-20 bg-gradient-to-tr from-blue-700 to-cyan-500 rounded-[2rem] flex items-center justify-center shadow-2xl mb-6 rotate-6 animate-pulse"><Zap size={40} color="white" fill="white" /></div>
      <h1 className="text-4xl font-black mb-10 text-blue-700 italic uppercase">GridStream</h1>
      <form onSubmit={async (e) => {
        e.preventDefault();
        if (isLogin) await supabase.auth.signInWithPassword({ email, password });
        else {
          const { data } = await supabase.auth.signUp({ email, password });
          if (data?.user) await supabase.from('profiles').upsert([{ id: data.user.id, username: displayName.toLowerCase().replace(/\s/g, ''), display_name: displayName }]);
        }
        fetchData();
      }} className="w-full max-w-xs space-y-4">
        {!isLogin && <input className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" placeholder="Display Name" value={displayName} onChange={e => setDisplayName(e.target.value)} />}
        <input className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="w-full bg-blue-700 text-white font-black py-5 rounded-2xl uppercase">{isLogin ? "Login" : "Sign Up"}</button>
      </form>
      <button onClick={() => setIsLogin(!isLogin)} className="mt-8 text-xs font-black text-gray-400 uppercase">{isLogin ? "Create Account" : "Login"}</button>
    </div>
  );
        }
