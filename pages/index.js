import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, 
  User as UserIcon, Grid, List, Image as ImageIcon, Send, ChevronLeft, 
  MapPin, Calendar, Check, AtSign, Zap, LogOut, Mail, Lock, 
  MoreHorizontal, Settings, Save, Moon, Sun, AlertCircle, Trash2, Bookmark, BookmarkCheck
} from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = 'dtb3jpadj'; 
const CLOUDINARY_UPLOAD_PRESET = 'alpha-sns';

export default function App() {
  const [view, setView] = useState('home'); 
  const [posts, setPosts] = useState([]);
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
  const [profileTab, setProfileTab] = useState('list'); 
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const fileInputRef = useRef(null);
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
    fetchData();
  }, [user]);

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
    const { data: postsData, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles(id, username, display_name, avatar_url),
        likes(user_id),
        bookmarks(user_id)
      `)
      .order('created_at', { ascending: false });
    
    if (postsData) {
      const formattedPosts = postsData.map(post => ({
        ...post,
        like_count: post.likes?.length || 0,
        is_liked: user ? post.likes?.some(l => l.user_id === user.id) : false,
        is_bookmarked: user ? post.bookmarks?.some(b => b.user_id === user.id) : false
      }));
      setPosts(formattedPosts);
    }
    
    const { data: profData } = await supabase.from('profiles').select('*');
    if (profData) setAllProfiles(profData);
  }

  async function toggleLike(postId, isLiked) {
    if (!user) return;
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_liked: !isLiked, like_count: isLiked ? p.like_count - 1 : p.like_count + 1 } : p));
    if (isLiked) await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id);
    else await supabase.from('likes').insert([{ post_id: postId, user_id: user.id }]);
  }

  async function toggleBookmark(postId, isBookmarked) {
    if (!user) return;
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_bookmarked: !isBookmarked } : p));
    if (isBookmarked) await supabase.from('bookmarks').delete().eq('post_id', postId).eq('user_id', user.id);
    else await supabase.from('bookmarks').insert([{ post_id: postId, user_id: user.id }]);
  }

  async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    return data.secure_url;
  }

  async function handleSaveProfile() {
    setUploading(true);
    let { avatar_url, header_url, display_name, username, bio } = editData;
    if (avatarInputRef.current?.files[0]) avatar_url = await uploadToCloudinary(avatarInputRef.current.files[0]);
    if (headerInputRef.current?.files[0]) header_url = await uploadToCloudinary(headerInputRef.current.files[0]);

    const { error } = await supabase.from('profiles').update({ 
      display_name, username: username.toLowerCase(), bio, avatar_url, header_url 
    }).eq('id', user.id);

    if (!error) {
      const updated = { ...editData, avatar_url, header_url };
      setMyProfile(updated);
      setProfileInfo(updated);
      setIsEditing(false);
      fetchData();
    }
    setUploading(false);
  }

  async function handlePost(e) {
    e.preventDefault();
    if (!newPost.trim() || !user) return;
    setUploading(true);
    let imageUrl = null;
    if (fileInputRef.current?.files[0]) imageUrl = await uploadToCloudinary(fileInputRef.current.files[0]);
    await supabase.from('posts').insert([{ content: newPost, user_id: user.id, image_url: imageUrl }]);
    setNewPost('');
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchData();
    setUploading(false);
  }

  async function handleDeletePost(postId) {
    if (!window.confirm("Delete this post?")) return;
    await supabase.from('posts').delete().eq('id', postId).eq('user_id', user.id);
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

  const toggleFollow = async () => {
    if (stats.isFollowing) await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', activeProfileId);
    else await supabase.from('follows').insert([{ follower_id: user.id, following_id: activeProfileId }]);
    openProfile(activeProfileId);
  };

  const getAvatar = (name, url) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;

  const [dmTarget, setDmTarget] = useState(null);

  if (!user) return <AuthScreen fetchData={fetchData} loading={loading} setLoading={setLoading} />;

  return (
    <div className={`max-w-md mx-auto min-h-screen pb-20 border-x font-sans relative shadow-2xl overflow-x-hidden transition-colors duration-300 ${darkMode ? 'bg-black text-white border-gray-800' : 'bg-white text-black border-gray-100'}`}>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-in { animation: fadeIn 0.3s ease-out; }
      `}</style>
      <script src="https://cdn.tailwindcss.com"></script>

      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} getAvatar={getAvatar} darkMode={darkMode} />}
      {showFollowList && <FollowListModal type={showFollowList} userId={activeProfileId} onClose={() => setShowFollowList(null)} openProfile={openProfile} getAvatar={getAvatar} darkMode={darkMode} />}
      {selectedPost && <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} getAvatar={getAvatar} openProfile={openProfile} onDelete={handleDeletePost} onLike={toggleLike} onBookmark={toggleBookmark} currentUser={user} darkMode={darkMode} />}
      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} user={user} darkMode={darkMode} setDarkMode={setDarkMode} />}

      {view === 'home' && (
        <div className="animate-in">
          <header className={`sticky top-0 z-30 backdrop-blur-md border-b p-4 flex justify-between items-center ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-50'}`}>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-cyan-500 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1">
              <Zap size={24} className="text-blue-600 fill-blue-600" /> GridStream
            </h1>
            <div className="flex gap-4">
              <Settings size={22} className="cursor-pointer text-gray-400" onClick={() => setShowSettings(true)} />
              <MessageCircle size={24} className="cursor-pointer" onClick={() => setView('messages')} />
            </div>
          </header>

          <div className={`flex gap-4 p-4 overflow-x-auto no-scrollbar border-b ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 to-fuchsia-600">
                <div className={`w-full h-full rounded-full p-0.5 ${darkMode ? 'bg-black' : 'bg-white'}`}>
                  <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-full h-full rounded-full object-cover" />
                </div>
              </div>
              <span className="text-[10px] font-bold">Your Story</span>
            </div>
            {allProfiles.filter(p => p.id !== user.id).slice(0, 10).map(p => (
              <div key={p.id} className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer" onClick={() => openProfile(p.id)}>
                <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 to-fuchsia-600">
                   <div className={`w-full h-full rounded-full p-0.5 ${darkMode ? 'bg-black' : 'bg-white'}`}>
                    <img src={getAvatar(p.username, p.avatar_url)} className="w-full h-full rounded-full object-cover" />
                  </div>
                </div>
                <span className="text-[10px] font-bold truncate w-16 text-center">{p.username}</span>
              </div>
            ))}
          </div>

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
              <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onDelete={handleDeletePost} onLike={toggleLike} onBookmark={toggleBookmark} currentUser={user} darkMode={darkMode} />
            ))}
          </div>
        </div>
      )}

      {view === 'profile' && profileInfo && (
        <div className="animate-in pb-10">
          <div className={`h-32 relative overflow-hidden bg-gray-200 ${!profileInfo.header_url && 'bg-gradient-to-br from-blue-700 via-indigo-600 to-cyan-500'}`}>
            <img src={isEditing ? editData.header_url : profileInfo.header_url} className="w-full h-full object-cover" alt="" />
            {isEditing && (
              <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer text-white"><Camera size={24} /><input type="file" accept="image/*" ref={headerInputRef} className="hidden" onChange={(e) => setEditData({...editData, header_url: URL.createObjectURL(e.target.files[0])})} /></label>
            )}
            <button onClick={() => setView('home')} className="absolute top-4 left-4 bg-black/30 backdrop-blur-md p-2 rounded-full text-white"><ChevronLeft size={20}/></button>
          </div>

          <div className="px-4 relative">
            <div className="absolute -top-12 left-4">
              <div className="relative">
                <img src={isEditing ? getAvatar(editData.username, editData.avatar_url) : getAvatar(profileInfo.username, profileInfo.avatar_url)} className={`w-24 h-24 rounded-full border-4 shadow-xl object-cover ${darkMode ? 'border-black bg-black' : 'border-white bg-white'}`} />
                {isEditing && (
                  <label className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center cursor-pointer text-white border-4 border-transparent"><Camera size={20} /><input type="file" accept="image/*" ref={avatarInputRef} className="hidden" onChange={(e) => setEditData({...editData, avatar_url: URL.createObjectURL(e.target.files[0])})} /></label>
                )}
              </div>
            </div>
            <div className="flex justify-end py-3 gap-2">
              {user.id === activeProfileId ? (
                isEditing ? (
                  <div className="flex gap-2">
                    <button onClick={() => setIsEditing(false)} className={`border rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-tighter ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>Cancel</button>
                    <button onClick={handleSaveProfile} disabled={uploading} className="bg-blue-600 text-white rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-tighter shadow-md">{uploading ? '...' : 'Save'}</button>
                  </div>
                ) : ( <button onClick={() => setIsEditing(true)} className={`border rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-tighter ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>Edit Profile</button> )
              ) : (
                <button onClick={toggleFollow} className={`rounded-full px-6 py-1.5 text-xs font-black uppercase transition shadow-md ${stats.isFollowing ? 'bg-gray-100 text-black border border-gray-200' : 'bg-blue-600 text-white'}`}>{stats.isFollowing ? 'Following' : 'Follow'}</button>
              )}
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-1">
                <h2 className="text-2xl font-black tracking-tighter">{profileInfo.display_name}</h2>
                <Check size={16} className="text-blue-500 fill-blue-500" />
              </div>
              <p className="text-gray-400 text-sm font-bold">@{profileInfo.username}</p>
              <p className="text-[15px] font-medium leading-relaxed whitespace-pre-wrap">
                {isEditing ? (
                  <textarea className={`w-full bg-transparent border-b outline-none ${darkMode ? 'border-gray-800' : 'border-gray-100'}`} value={editData.bio} onChange={(e) => setEditData({...editData, bio: e.target.value})} placeholder="Edit bio..." />
                ) : (profileInfo.bio || 'GridStream Explorer.')}
              </p>
              <div className="flex flex-wrap gap-4 text-gray-500 text-[10px] font-black uppercase tracking-widest">
                <span className="flex items-center gap-1"><MapPin size={12}/> Global</span>
                <span className="flex items-center gap-1"><Calendar size={12}/> Joined 2026</span>
              </div>
              <div className="flex gap-6 pt-1">
                <button onClick={() => setShowFollowList('following')} className="flex gap-1.5 items-center"><span className="font-black text-lg">{stats.following}</span><span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Following</span></button>
                <button onClick={() => setShowFollowList('followers')} className="flex gap-1.5 items-center"><span className="font-black text-lg">{stats.followers}</span><span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Followers</span></button>
              </div>
            </div>
          </div>
          
          <div className={`flex border-b mt-6 sticky top-0 z-40 ${darkMode ? 'bg-black/95 border-gray-800' : 'bg-white/95 border-gray-100'}`}>
            <button onClick={() => setProfileTab('list')} className={`flex-grow py-4 flex justify-center items-center gap-2 ${profileTab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}><List size={20}/></button>
            <button onClick={() => setProfileTab('grid')} className={`flex-grow py-4 flex justify-center items-center gap-2 ${profileTab === 'grid' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}><Grid size={20}/></button>
          </div>
          <div className={profileTab === 'grid' ? "grid grid-cols-3 gap-[2px]" : `divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
            {posts.filter(p => p.user_id === activeProfileId).map(post => (
              profileTab === 'grid' ? ( 
                post.image_url ? <img key={post.id} src={post.image_url} className="aspect-square w-full h-full object-cover cursor-pointer hover:brightness-90 transition" onClick={() => setSelectedPost(post)} /> : null
              ) : ( 
                <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onDelete={handleDeletePost} onLike={toggleLike} onBookmark={toggleBookmark} currentUser={user} darkMode={darkMode} /> 
              )
            ))}
          </div>
        </div>
      )}

      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSelectedPost={setSelectedPost} darkMode={darkMode} />}
      {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} setDmTarget={setDmTarget} getAvatar={getAvatar} openProfile={openProfile} darkMode={darkMode} />}

      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 shadow-sm ${darkMode ? 'bg-black/95 border-gray-800 text-gray-600' : 'bg-white/95 border-gray-100 text-gray-300'}`}>
        <HomeIcon onClick={() => setView('home')} className={`cursor-pointer transition-colors ${view === 'home' ? 'text-blue-600' : ''}`} />
        <Search onClick={() => setView('search')} className={`cursor-pointer transition-colors ${view === 'search' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <Bookmark className="cursor-pointer hover:text-blue-600 transition-colors" onClick={() => {}} />
        <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer transition-colors ${view === 'profile' && activeProfileId === user.id ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
      </nav>
    </div>
  );
}

function PostCard({ post, openProfile, getAvatar, onDelete, onLike, onBookmark, currentUser, darkMode }) {
  const isMyPost = currentUser && post.user_id === currentUser.id;
  return (
    <article className={`p-4 flex gap-3 hover:bg-gray-50/5 transition border-b last:border-0 ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
      <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer object-cover flex-shrink-0" onClick={() => openProfile(post.profiles.id)} />
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-start">
          <div className="flex flex-col cursor-pointer mb-1" onClick={() => openProfile(post.profiles.id)}>
            <div className="flex items-center gap-1">
              <span className="font-black text-sm truncate">{post.profiles?.display_name}</span>
              <Check size={12} className="text-blue-500 fill-blue-500" />
            </div>
            <span className="text-gray-400 text-[11px] font-bold truncate">@{post.profiles?.username}</span>
          </div>
          {isMyPost && <button onClick={() => onDelete(post.id)} className="text-gray-300 hover:text-red-500 transition p-1 ml-2"><Trash2 size={16} /></button>}
        </div>
        <p className={`text-[15px] mt-1 font-medium leading-relaxed whitespace-pre-wrap ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{post.content}</p>
        {post.image_url && <img src={post.image_url} className="mt-3 rounded-2xl w-full max-h-80 object-cover border border-gray-100" />}
        <div className="flex justify-between mt-4 text-gray-400 max-w-[240px] items-center">
          <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 transition ${post.is_liked ? 'text-red-500' : 'hover:text-red-500'}`}><Heart size={18} fill={post.is_liked ? "currentColor" : "none"} /><span className="text-xs font-black">{post.like_count || ''}</span></button>
          <MessageCircle size={18} className="hover:text-blue-500 transition cursor-pointer" />
          <button onClick={() => onBookmark(post.id, post.is_bookmarked)} className={`transition ${post.is_bookmarked ? 'text-blue-500' : 'hover:text-blue-500'}`}>{post.is_bookmarked ? <BookmarkCheck size={18} fill="currentColor" /> : <Bookmark size={18} />}</button>
          <Share2 size={18} className="hover:text-green-500 transition cursor-pointer" />
        </div>
      </div>
    </article>
  );
}

function PostDetailModal({ post, onClose, getAvatar, openProfile, onDelete, onLike, onBookmark, currentUser, darkMode }) {
  const isMyPost = currentUser && post.user_id === currentUser.id;
  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4">
      <div className="absolute top-6 right-6 flex gap-4">
        {isMyPost && <button onClick={() => { onDelete(post.id); onClose(); }} className="text-white p-2 hover:bg-red-500/20 rounded-full transition"><Trash2 size={24}/></button>}
        <button onClick={onClose} className="text-white p-2 hover:bg-white/10 rounded-full transition"><X size={28}/></button>
      </div>
      <div className={`w-full max-w-md rounded-[2.5rem] overflow-hidden ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
        <div className="p-5 border-b flex items-center gap-3">
          <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-10 h-10 rounded-full object-cover" />
          <div className="flex flex-col"><p className="font-black text-sm">{post.profiles?.display_name}</p><p className="text-gray-400 text-xs font-bold">@{post.profiles?.username}</p></div>
        </div>
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {post.image_url && <img src={post.image_url} className="w-full rounded-2xl mb-4" />}
          <p className="font-medium leading-relaxed mb-6 whitespace-pre-wrap">{post.content}</p>
          <div className="flex justify-around py-4 border-t border-gray-800/20">
            <button onClick={() => onLike(post.id, post.is_liked)} className={`flex flex-col items-center gap-1 ${post.is_liked ? 'text-red-500' : 'text-gray-400'}`}><Heart size={24} fill={post.is_liked ? "currentColor" : "none"} /><span className="text-[10px] font-black uppercase tracking-widest">Like</span></button>
            <button onClick={() => onBookmark(post.id, post.is_bookmarked)} className={`flex flex-col items-center gap-1 ${post.is_bookmarked ? 'text-blue-500' : 'text-gray-400'}`}>{post.is_bookmarked ? <BookmarkCheck size={24} fill="currentColor" /> : <Bookmark size={24} />}<span className="text-[10px] font-black uppercase tracking-widest">Save</span></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsScreen({ onClose, user, darkMode, setDarkMode }) {
  const handleLogout = () => { supabase.auth.signOut(); onClose(); };
  return (
    <div className={`fixed inset-0 z-[100] animate-in overflow-y-auto ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <header className="p-4 border-b flex items-center gap-4 sticky top-0 z-10 bg-inherit"><ChevronLeft onClick={onClose} className="cursor-pointer" /><h2 className="font-black uppercase tracking-tighter">Settings</h2></header>
      <div className="p-4 space-y-8">
        <section>
          <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-4">Appearance</h3>
          <button onClick={() => setDarkMode(!darkMode)} className={`w-full flex justify-between items-center p-5 rounded-[2rem] transition ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-3">{darkMode ? <Moon size={20} className="text-blue-400"/> : <Sun size={20} className="text-orange-400"/>}<span className="font-bold">Dark Mode</span></div>
            <div className={`w-12 h-6 rounded-full relative transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${darkMode ? 'right-1' : 'left-1'}`} /></div>
          </button>
        </section>
        <section>
          <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-4">Account</h3>
          <button onClick={handleLogout} className="w-full p-5 rounded-[2rem] bg-red-50 text-red-500 font-black uppercase text-xs tracking-widest border border-red-100">Logout from Beta</button>
        </section>
      </div>
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
      if (followData?.length > 0) {
        const ids = followData.map(f => f[targetCol]);
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids);
        if (profiles) setList(profiles);
      }
    }
    fetchList();
  }, [type, userId]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={onClose}>
      <div className={`w-full max-w-md rounded-t-[2.5rem] h-[70vh] flex flex-col animate-in ${darkMode ? 'bg-black' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b flex justify-between items-center"><h3 className="font-black text-lg uppercase text-blue-600 tracking-tighter">{type}</h3><X onClick={onClose} className="cursor-pointer" /></div>
        <div className="overflow-y-auto p-4 space-y-2">
          {list.length === 0 && <p className="text-center text-gray-400 py-10 font-bold uppercase text-xs italic">No {type} yet</p>}
          {list.map(u => (
            <div key={u.id} className="flex items-center gap-4 cursor-pointer p-4 rounded-3xl hover:bg-gray-500/5 transition" onClick={() => { openProfile(u.id); onClose(); }}>
              <img src={getAvatar(u.username, u.avatar_url)} className="w-12 h-12 rounded-full object-cover shadow-sm" />
              <div className="flex-grow"><p className="font-black text-sm">{u.display_name}</p><p className="text-gray-400 text-xs font-bold">@{u.username}</p></div>
              <ChevronLeft size={16} className="rotate-180 text-gray-300" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SearchView({ posts, openProfile, searchQuery, setSearchQuery, setSelectedPost, darkMode }) {
  return (
    <div className="animate-in">
      <div className={`p-4 sticky top-0 z-10 border-b ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-100'}`}>
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input type="text" placeholder="DISCOVER NEW STREAMS" className={`w-full rounded-2xl py-3 pl-10 pr-4 outline-none text-[10px] font-black uppercase tracking-widest ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100'}`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-[2px]">
        {posts.filter(p => p.image_url && (p.content.toLowerCase().includes(searchQuery.toLowerCase()) || p.profiles?.username.toLowerCase().includes(searchQuery.toLowerCase()))).map(post => (
          <div key={post.id} className="aspect-square relative group overflow-hidden cursor-pointer" onClick={() => setSelectedPost(post)}>
            <img src={post.image_url} className="w-full h-full object-cover transition duration-500 group-hover:scale-110" />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white font-black text-xs">
              <span className="flex items-center gap-1"><Heart size={14} fill="white" /> {post.like_count}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessagesList({ allProfiles, user, setDmTarget, getAvatar, openProfile, darkMode }) {
  return (
    <div className="animate-in">
      <header className="p-4 border-b font-black text-xl text-center uppercase italic tracking-tighter flex items-center justify-between">
        <ChevronLeft size={24} className="opacity-0" /> {/* Spacer */}
        <span>Streams Chat</span>
        <Zap size={20} className="text-blue-600 fill-blue-600" />
      </header>
      <div className="p-2">
        {allProfiles.filter(p => p.id !== user.id).map(u => (
          <div key={u.id} className="flex items-center gap-4 p-4 rounded-[2rem] cursor-pointer hover:bg-gray-500/5 transition" onClick={() => setDmTarget(u)}>
            <img src={getAvatar(u.username, u.avatar_url)} className="w-14 h-14 rounded-full object-cover border-2 border-transparent" onClick={(e) => { e.stopPropagation(); openProfile(u.id); }} />
            <div className="flex-grow pb-1 border-b border-gray-500/10">
              <p className="font-black text-sm tracking-tight">{u.display_name}</p>
              <p className="text-[10px] text-blue-500 font-black mt-1 uppercase tracking-widest italic">Live Stream</p>
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
  async function fetchMessages() {
    const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
    if (data) setMessages(data);
  }
  async function sendMsg(e) {
    e.preventDefault(); if (!text.trim()) return;
    const t = text; setText('');
    await supabase.from('messages').insert([{ text: t, sender_id: currentUser.id, receiver_id: target.id }]);
  }
  return (
    <div className={`fixed inset-0 z-[100] flex flex-col animate-in ${darkMode ? 'bg-black text-white' : 'bg-gray-50 text-black'}`}>
      <header className={`p-4 flex items-center gap-3 border-b ${darkMode ? 'bg-black border-gray-800' : 'bg-white'}`}>
        <ChevronLeft onClick={() => setDmTarget(null)} className="cursor-pointer" />
        <img src={getAvatar(target.username, target.avatar_url)} className="w-10 h-10 rounded-full object-cover" />
        <div>
          <p className="font-black text-sm tracking-tight">{target.display_name}</p>
          <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">@{target.username}</p>
        </div>
      </header>
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-[1.8rem] text-[14px] font-medium leading-relaxed shadow-sm ${m.sender_id === currentUser.id ? 'bg-blue-600 text-white rounded-tr-none' : (darkMode ? 'bg-gray-800 text-white rounded-tl-none' : 'bg-white text-gray-800 rounded-tl-none')}`}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <form onSubmit={sendMsg} className="p-4 border-t flex gap-2">
        <input type="text" className={`flex-grow p-4 rounded-2xl text-sm outline-none font-medium ${darkMode ? 'bg-gray-900' : 'bg-white shadow-inner'}`} placeholder="Send a message..." value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="bg-blue-600 text-white p-4 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition"><Send size={18}/></button>
      </form>
    </div>
  );
}

function AuthScreen({ fetchData, loading, setLoading }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [displayName, setDisplayName] = useState('');
  async function handleAuth(e) {
    e.preventDefault();
    setLoading(true);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (data?.user) {
        const initialId = displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000);
        await supabase.from('profiles').upsert([{ id: data.user.id, username: initialId, display_name: displayName }]);
        alert("Account Created! Please check your email if verification is required.");
      } else if (error) alert(error.message);
    }
    setLoading(false);
    fetchData();
  }
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-white font-sans text-black animate-in">
      <div className="w-20 h-20 bg-gradient-to-tr from-blue-700 to-cyan-500 rounded-[2rem] flex items-center justify-center shadow-2xl mb-6 rotate-6 animate-pulse"><Zap size={40} color="white" fill="white" /></div>
      <h1 className="text-4xl font-black mb-10 text-blue-700 italic tracking-tighter uppercase">GridStream</h1>
      <form onSubmit={handleAuth} className="w-full max-w-xs space-y-4">
        {!isLogin && <input type="text" placeholder="DISPLAY NAME (MAX 20)" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={20} />}
        <input type="email" placeholder="EMAIL" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="PASSWORD" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" disabled={loading} className="w-full bg-blue-700 text-white font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest text-xs">
          {loading ? 'Processing...' : (isLogin ? 'Login to Beta' : 'Join GridStream')}
        </button>
      </form>
      <button onClick={() => setIsLogin(!isLogin)} className="mt-8 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-blue-600 transition">
        {isLogin ? "Create New Account" : "Back to Login"}
      </button>
    </div>
  );
       }
