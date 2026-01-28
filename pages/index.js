import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User as UserIcon, Grid, List, Image as ImageIcon, Send, ChevronLeft, Zap, Mail, Lock, Settings, Moon, Sun, AlertCircle, Trash2 } from 'lucide-react';

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
  const [replyTo, setReplyTo] = useState(null);
  const [dmTarget, setDmTarget] = useState(null);
  
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
    const { data: postsData } = await supabase
      .from('posts')
      .select(`*, profiles(id, username, display_name, avatar_url), likes(user_id)`)
      .order('created_at', { ascending: false });
    
    if (postsData) {
      const formattedPosts = postsData.map(post => ({
        ...post,
        like_count: post.likes?.length || 0,
        is_liked: user ? post.likes?.some(l => l.user_id === user.id) : false
      }));
      setPosts(formattedPosts);
    }
    const { data: profData } = await supabase.from('profiles').select('*');
    if (profData) setAllProfiles(profData);
  }

  async function toggleLike(postId, isLiked) {
    if (!user) return;
    setPosts(prev => prev.map(p => {
      if (p.id === postId) return { ...p, is_liked: !isLiked, like_count: isLiked ? p.like_count - 1 : p.like_count + 1 };
      return p;
    }));
    if (isLiked) await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id);
    else await supabase.from('likes').insert([{ post_id: postId, user_id: user.id }]);
    fetchData();
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
    await supabase.from('profiles').update({ display_name, username: username.toLowerCase(), bio, avatar_url, header_url }).eq('id', user.id);
    setIsEditing(false);
    fetchData();
    setUploading(false);
  }

  async function handlePost(e) {
    e.preventDefault();
    if (!newPost.trim() || !user) return;
    setUploading(true);
    let imageUrl = null;
    if (fileInputRef.current?.files[0]) imageUrl = await uploadToCloudinary(fileInputRef.current.files[0]);
    const { error } = await supabase.from('posts').insert([{ content: newPost, user_id: user.id, image_url: imageUrl, parent_id: replyTo?.id || null }]);
    if (!error) { setNewPost(''); setReplyTo(null); fetchData(); }
    setUploading(false);
  }

  async function handleDeletePost(postId) {
    if (!window.confirm("削除しますか？")) return;
    await supabase.from('posts').delete().eq('id', postId).eq('user_id', user.id);
    if (selectedPost?.id === postId) setSelectedPost(null);
    fetchData();
  }

  const openProfile = async (userId) => {
    setActiveProfileId(userId); setView('profile');
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
  };

  const getAvatar = (name, url) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;

  if (!user) return <AuthScreen fetchData={fetchData} getAvatar={getAvatar} />;

  return (
    <div className={`max-w-md mx-auto min-h-screen pb-20 border-x font-sans relative shadow-2xl transition-colors duration-300 ${darkMode ? 'bg-black text-white border-gray-800' : 'bg-white text-black border-gray-100'}`}>
      
      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} getAvatar={getAvatar} darkMode={darkMode} />}
      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} user={user} darkMode={darkMode} setDarkMode={setDarkMode} />}
      {showFollowList && <FollowListModal type={showFollowList} userId={activeProfileId} onClose={() => setShowFollowList(null)} openProfile={openProfile} getAvatar={getAvatar} darkMode={darkMode} />}
      {selectedPost && <PostDetailModal post={selectedPost} posts={posts} onClose={() => setSelectedPost(null)} getAvatar={getAvatar} openProfile={openProfile} onDelete={handleDeletePost} onLike={toggleLike} onReply={(p) => { setReplyTo(p); setSelectedPost(null); setView('home'); window.scrollTo(0,0); }} currentUser={user} darkMode={darkMode} />}

      {view === 'home' && (
        <div className="animate-in fade-in">
          <header className={`sticky top-0 z-30 backdrop-blur-md border-b p-4 flex justify-between items-center ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-50'}`}>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-cyan-500 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1">
              <Zap size={24} className="text-blue-600 fill-blue-600" /> GridStream
            </h1>
            <MessageCircle size={24} className="cursor-pointer" onClick={() => setView('messages')} />
          </header>
          
          <form onSubmit={handlePost} className={`p-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            {replyTo && (
              <div className="flex items-center justify-between bg-blue-500/10 p-2 rounded-lg mb-3">
                <p className="text-xs font-bold text-blue-500">Replying to @{replyTo.profiles?.username}</p>
                <X size={14} className="cursor-pointer text-blue-500" onClick={() => setReplyTo(null)} />
              </div>
            )}
            <div className="flex gap-3">
              <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-10 h-10 rounded-full object-cover shadow-sm cursor-pointer" onClick={() => openProfile(user.id)} />
              <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none bg-transparent font-medium" placeholder={replyTo ? "Post your reply" : "今、何を考えてる？"} value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-12 mt-2">
              <label className="cursor-pointer text-blue-500 p-2 rounded-full transition hover:bg-blue-50/10"><ImageIcon size={22}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
              <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs shadow-lg uppercase tracking-tighter active:scale-95 transition-transform">
                {uploading ? '...' : replyTo ? 'Reply' : 'Stream'}
              </button>
            </div>
          </form>

          <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
            {posts.filter(p => !p.parent_id).map(post => (
              <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onDelete={handleDeletePost} onLike={toggleLike} onReply={() => { setReplyTo(post); window.scrollTo({top: 0, behavior: 'smooth'}); }} onSelect={() => setSelectedPost(post)} currentUser={user} darkMode={darkMode} />
            ))}
          </div>
        </div>
      )}

      {view === 'profile' && profileInfo && (
        <div className="animate-in fade-in pb-10">
          <div className={`h-32 relative overflow-hidden bg-gray-200 ${!profileInfo.header_url && 'bg-gradient-to-br from-blue-700 via-indigo-600 to-cyan-500'}`}>
            <img src={isEditing ? editData.header_url : (profileInfo.header_url || '')} className="w-full h-full object-cover" />
            {isEditing && (
              <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer text-white">
                <Camera size={24} /><input type="file" accept="image/*" ref={headerInputRef} className="hidden" onChange={(e) => {
                  if(e.target.files[0]) setEditData({...editData, header_url: URL.createObjectURL(e.target.files[0])});
                }} />
              </label>
            )}
            {!isEditing && <button onClick={() => setView('home')} className="absolute top-4 left-4 bg-black/30 backdrop-blur-md p-2 rounded-full text-white"><ChevronLeft size={20}/></button>}
          </div>
          <div className="px-4 relative">
            <div className="absolute -top-12 left-4">
              <div className="relative">
                <img src={isEditing ? getAvatar(editData.username, editData.avatar_url) : getAvatar(profileInfo.username, profileInfo.avatar_url)} className={`w-24 h-24 rounded-full border-4 shadow-xl object-cover ${darkMode ? 'border-black bg-black' : 'border-white bg-white'}`} />
                {isEditing && (
                  <label className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center cursor-pointer text-white border-4 border-transparent">
                    <Camera size={20} /><input type="file" accept="image/*" ref={avatarInputRef} className="hidden" onChange={(e) => {
                      if(e.target.files[0]) setEditData({...editData, avatar_url: URL.createObjectURL(e.target.files[0])});
                    }} />
                  </label>
                )}
              </div>
            </div>
            <div className="flex justify-end py-3 gap-2">
              {user.id === activeProfileId ? (
                <button onClick={() => setIsEditing(!isEditing)} className={`border rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-tighter ${darkMode ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}>{isEditing ? 'Cancel' : 'Edit Profile'}</button>
              ) : (
                <button onClick={async () => {
                  if (stats.isFollowing) await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', activeProfileId);
                  else await supabase.from('follows').insert([{ follower_id: user.id, following_id: activeProfileId }]);
                  openProfile(activeProfileId);
                }} className={`rounded-full px-6 py-1.5 text-xs font-black uppercase transition shadow-md ${stats.isFollowing ? 'bg-gray-100 text-black border border-gray-200' : 'bg-blue-600 text-white'}`}>{stats.isFollowing ? 'Following' : 'Follow'}</button>
              )}
              {isEditing && <button onClick={handleSaveProfile} className="bg-blue-600 text-white rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-tighter shadow-md">Save</button>}
            </div>
            <div className="mt-4">
              {isEditing ? (
                <div className="space-y-3">
                  <input className={`w-full p-3 rounded-xl outline-none font-bold text-sm ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`} value={editData.display_name} onChange={e => setEditData({...editData, display_name: e.target.value})} placeholder="Display Name" />
                  <textarea className={`w-full p-3 rounded-xl outline-none font-medium text-sm h-20 resize-none ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`} value={editData.bio} onChange={e => setEditData({...editData, bio: e.target.value})} placeholder="Bio" />
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-black tracking-tighter">{profileInfo.display_name}</h2>
                  <p className="text-gray-400 text-sm font-bold">@{profileInfo.username}</p>
                  <p className="mt-2 text-[15px] font-medium leading-relaxed">{profileInfo.bio || 'GridStream member.'}</p>
                  <div className="flex gap-6 mt-4 pt-1">
                    <button onClick={() => setShowFollowList('following')} className="flex gap-1.5 items-center hover:opacity-70"><span className="font-black text-lg">{stats.following}</span><span className="text-gray-400 text-[10px] uppercase font-black tracking-widest">Following</span></button>
                    <button onClick={() => setShowFollowList('followers')} className="flex gap-1.5 items-center hover:opacity-70"><span className="font-black text-lg">{stats.followers}</span><span className="text-gray-400 text-[10px] uppercase font-black tracking-widest">Followers</span></button>
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className={`flex border-b mt-6 sticky top-0 z-40 backdrop-blur-md ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-100'}`}>
            <button onClick={() => setProfileTab('list')} className={`flex-grow py-4 flex justify-center items-center gap-2 ${profileTab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}><List size={20}/></button>
            <button onClick={() => setProfileTab('grid')} className={`flex-grow py-4 flex justify-center items-center gap-2 ${profileTab === 'grid' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}><Grid size={20}/></button>
          </div>

          <div className={profileTab === 'grid' ? "grid grid-cols-3 gap-[2px]" : ""}>
            {posts.filter(p => p.user_id === activeProfileId).map(post => (
              profileTab === 'grid' ? (post.image_url && <img key={post.id} src={post.image_url} className="aspect-square w-full h-full object-cover cursor-pointer hover:brightness-90 transition" onClick={() => setSelectedPost(post)} />)
              : <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onDelete={handleDeletePost} onLike={toggleLike} onReply={() => { setReplyTo(post); setView('home'); window.scrollTo(0,0); }} onSelect={() => setSelectedPost(post)} currentUser={user} darkMode={darkMode} />
            ))}
          </div>
        </div>
      )}

      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSelectedPost={setSelectedPost} darkMode={darkMode} />}
      {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} setDmTarget={setDmTarget} getAvatar={getAvatar} darkMode={darkMode} />}

      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 shadow-sm backdrop-blur-md ${darkMode ? 'bg-black/95 border-gray-800 text-gray-500' : 'bg-white/95 border-gray-100 text-gray-300'}`}>
        <HomeIcon onClick={() => { setView('home'); setReplyTo(null); }} className={`cursor-pointer transition-colors ${view === 'home' ? 'text-blue-600' : ''}`} />
        <Search onClick={() => setView('search')} className={`cursor-pointer transition-colors ${view === 'search' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <MessageCircle onClick={() => setView('messages')} className={`cursor-pointer transition-colors ${view === 'messages' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer transition-colors ${view === 'profile' && activeProfileId === user.id ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
      </nav>
    </div>
  );
}

// --- Sub-components with proper Tailwind classes ---

function PostCard({ post, openProfile, getAvatar, onDelete, onLike, onReply, onSelect, currentUser, darkMode, isReply = false }) {
  const isMyPost = currentUser && post.user_id === currentUser.id;
  return (
    <article className={`p-4 flex gap-3 hover:bg-gray-50/5 transition ${!isReply ? 'border-b' : ''} ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
      <div className="flex flex-col items-center">
        <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer object-cover shadow-sm" onClick={() => openProfile(post.profiles?.id)} />
        {isReply && <div className="w-0.5 grow bg-gray-200 dark:bg-gray-800 my-1 rounded-full" />}
      </div>
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-start">
          <div className="flex flex-col cursor-pointer" onClick={() => openProfile(post.profiles?.id)}>
            <span className="font-black text-sm truncate">{post.profiles?.display_name}</span>
            <span className="text-gray-400 text-[11px] font-bold truncate">@{post.profiles?.username}</span>
          </div>
          {isMyPost && <button onClick={() => onDelete(post.id)} className="text-gray-300 hover:text-red-500 transition p-1"><Trash2 size={16} /></button>}
        </div>
        <p className="text-[15px] mt-1 font-medium leading-relaxed whitespace-pre-wrap cursor-pointer" onClick={onSelect}>{post.content}</p>
        {post.image_url && <img src={post.image_url} className="mt-3 rounded-2xl w-full max-h-80 object-cover border border-gray-100 dark:border-gray-800 shadow-sm" onClick={onSelect} />}
        <div className="flex justify-between mt-4 text-gray-400 max-w-[180px] items-center">
          <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 transition ${post.is_liked ? 'text-red-500' : 'hover:text-red-500'}`}><Heart size={18} fill={post.is_liked ? "currentColor" : "none"} /><span className="text-xs font-black">{post.like_count || ''}</span></button>
          <button onClick={onReply} className="hover:text-blue-500 transition"><MessageCircle size={18} /></button>
          <Share2 size={18} className="hover:text-green-500 transition" />
        </div>
      </div>
    </article>
  );
}

function PostDetailModal({ post, posts, onClose, getAvatar, openProfile, onDelete, onLike, onReply, currentUser, darkMode }) {
  const replies = posts.filter(p => p.parent_id === post.id);
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end justify-center animate-in slide-in-from-bottom duration-300">
      <div className={`w-full max-w-md h-[92vh] rounded-t-[2.5rem] flex flex-col shadow-2xl ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
        <div className="p-4 border-b dark:border-gray-800 flex items-center justify-between">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"><ChevronLeft /></button>
          <span className="font-black text-xs uppercase text-blue-500 tracking-widest">Thread View</span>
          <div className="w-10" />
        </div>
        <div className="overflow-y-auto flex-grow">
          <div className="p-5 border-b dark:border-gray-800">
            <div className="flex gap-3 mb-4">
              <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-12 h-12 rounded-full object-cover shadow-md" />
              <div><p className="font-black text-lg">{post.profiles?.display_name}</p><p className="text-gray-400 text-sm font-bold">@{post.profiles?.username}</p></div>
            </div>
            <p className="text-xl font-medium leading-relaxed mb-4 whitespace-pre-wrap">{post.content}</p>
            {post.image_url && <img src={post.image_url} className="w-full rounded-3xl mb-4 shadow-lg" />}
            <div className="flex gap-6 py-3 border-y dark:border-gray-800 text-gray-400">
              <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 font-black ${post.is_liked ? 'text-red-500' : ''}`}><Heart size={22} fill={post.is_liked ? "currentColor" : "none"}/><span className="text-sm">{post.like_count}</span></button>
              <button onClick={() => onReply(post)} className="flex items-center gap-1.5 font-black hover:text-blue-500 transition"><MessageCircle size={22} /><span className="text-sm">Reply</span></button>
            </div>
          </div>
          <div className="pb-20">
            {replies.length > 0 ? (
              replies.map(reply => (
                <PostCard key={reply.id} post={reply} openProfile={openProfile} getAvatar={getAvatar} onDelete={onDelete} onLike={onLike} onReply={() => onReply(reply)} onSelect={() => {}} currentUser={currentUser} darkMode={darkMode} isReply={true} />
              ))
            ) : (
              <p className="p-10 text-center text-gray-400 font-black uppercase text-[10px] tracking-widest">No replies yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthScreen({ fetchData, getAvatar }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault(); setLoading(true);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) alert(error.message);
      else if (data.user) {
        await supabase.from('profiles').insert([{ id: data.user.id, username: username.toLowerCase(), display_name: username, avatar_url: getAvatar(username) }]);
        alert("Success! Please login."); setIsLogin(true);
      }
    }
    setLoading(false); fetchData();
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white flex flex-col justify-center p-8">
      <div className="mb-12 text-center animate-in zoom-in duration-500">
        <Zap size={64} className="mx-auto text-blue-600 fill-blue-600 mb-4" />
        <h1 className="text-5xl font-black italic tracking-tighter text-blue-600 uppercase">GridStream</h1>
        <p className="text-gray-400 font-black mt-2 uppercase text-[10px] tracking-widest">Connect to Beta Network</p>
      </div>
      <form onSubmit={handleAuth} className="space-y-4">
        {!isLogin && (
          <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-3 border border-transparent focus-within:border-blue-500 transition">
            <UserIcon size={20} className="text-blue-500" /><input placeholder="Username" className="bg-transparent w-full outline-none font-bold text-black" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
        )}
        <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-3 border border-transparent focus-within:border-blue-500 transition">
          <Mail size={20} className="text-blue-500" /><input type="email" placeholder="Email" className="bg-transparent w-full outline-none font-bold text-black" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-3 border border-transparent focus-within:border-blue-500 transition">
          <Lock size={20} className="text-blue-500" /><input type="password" placeholder="Password" className="bg-transparent w-full outline-none font-bold text-black" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition-all hover:bg-blue-700">
          {loading ? '...' : (isLogin ? 'Login' : 'Sign Up')}
        </button>
      </form>
      <p onClick={() => setIsLogin(!isLogin)} className="text-center mt-8 text-xs font-black text-gray-400 cursor-pointer uppercase tracking-widest hover:text-blue-500 transition">
        {isLogin ? "Need an account? Sign Up" : "Already have an account? Login"}
      </p>
    </div>
  );
}

function SettingsScreen({ onClose, user, darkMode, setDarkMode }) {
  return (
    <div className={`fixed inset-0 z-[110] animate-in slide-in-from-right duration-300 ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <div className="p-4 border-b dark:border-gray-800 flex items-center gap-4">
        <ChevronLeft onClick={onClose} className="cursor-pointer" />
        <h2 className="font-black uppercase tracking-tighter">Settings</h2>
      </div>
      <div className="p-4 space-y-6">
        <section>
          <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-4 ml-1">Appearance</h3>
          <button onClick={() => setDarkMode(!darkMode)} className={`w-full p-4 rounded-2xl flex justify-between items-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-3">{darkMode ? <Moon size={20} className="text-blue-400"/> : <Sun size={20} className="text-orange-400"/>}<span className="font-bold text-sm">Dark Mode</span></div>
            <div className={`w-10 h-6 rounded-full relative transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${darkMode ? 'right-1' : 'left-1'}`} /></div>
          </button>
        </section>
        <button onClick={() => supabase.auth.signOut()} className="w-full p-4 bg-red-50 text-red-500 font-black rounded-2xl uppercase text-xs tracking-widest hover:bg-red-100 transition">Logout from Beta</button>
      </div>
    </div>
  );
}

function DMScreen({ target, setDmTarget, currentUser, getAvatar, darkMode }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  useEffect(() => {
    const fetchMsgs = async () => {
      const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
      if (data) setMsgs(data);
    };
    fetchMsgs();
    const sub = supabase.channel('msgs').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchMsgs).subscribe();
    return () => supabase.removeChannel(sub);
  }, [target.id]);

  const send = async (e) => {
    e.preventDefault(); if (!text.trim()) return;
    await supabase.from('messages').insert([{ sender_id: currentUser.id, receiver_id: target.id, content: text }]);
    setText('');
  };

  return (
    <div className={`fixed inset-0 z-[120] flex flex-col animate-in slide-in-from-right duration-300 ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <div className="p-4 border-b dark:border-gray-800 flex items-center gap-3 backdrop-blur-md sticky top-0">
        <ChevronLeft onClick={() => setDmTarget(null)} className="cursor-pointer" />
        <img src={getAvatar(target.username, target.avatar_url)} className="w-9 h-9 rounded-full object-cover shadow-sm" />
        <div className="flex flex-col"><span className="font-black text-sm leading-none">{target.display_name}</span><span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Online</span></div>
      </div>
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {msgs.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] p-3 px-4 rounded-2xl font-medium text-sm shadow-sm ${m.sender_id === currentUser.id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-gray-100 dark:bg-gray-800 rounded-tl-none'}`}>{m.content}</div>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="p-4 border-t dark:border-gray-800 flex gap-2 backdrop-blur-md">
        <input className={`flex-grow rounded-full px-5 py-3 outline-none font-bold text-sm ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`} value={text} onChange={e => setText(e.target.value)} placeholder="Type a message..." />
        <button type="submit" className="bg-blue-600 p-3 rounded-full text-white shadow-lg active:scale-90 transition-transform"><Send size={20}/></button>
      </form>
    </div>
  );
}

function MessagesList({ allProfiles, user, setDmTarget, getAvatar, darkMode }) {
  return (
    <div className="animate-in fade-in p-4 pb-20">
      <h2 className="text-2xl font-black mb-6 uppercase tracking-tighter flex items-center gap-2"><MessageCircle className="text-blue-600"/> Messages</h2>
      <div className="space-y-3">
        {allProfiles.filter(p => p.id !== user.id).map(p => (
          <div key={p.id} onClick={() => setDmTarget(p)} className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border ${darkMode ? 'bg-gray-900 border-gray-800 hover:border-gray-700' : 'bg-gray-50 border-gray-100 hover:bg-gray-100 shadow-sm'}`}>
            <img src={getAvatar(p.username, p.avatar_url)} className="w-12 h-12 rounded-full object-cover shadow-sm" />
            <div className="flex-grow"><p className="font-black text-sm">{p.display_name}</p><p className="text-gray-400 text-xs font-bold uppercase tracking-widest">@{p.username}</p></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchView({ posts, openProfile, searchQuery, setSearchQuery, setSelectedPost, darkMode }) {
  const media = posts.filter(p => p.image_url && (p.content.includes(searchQuery) || p.profiles?.username.includes(searchQuery)));
  return (
    <div className="animate-in fade-in">
      <div className={`p-4 sticky top-0 z-20 backdrop-blur-md ${darkMode ? 'bg-black/90' : 'bg-white/95'}`}>
        <div className="relative"><Search className="absolute left-4 top-3.5 text-gray-400" size={18} /><input className={`w-full rounded-2xl py-3 pl-12 pr-4 outline-none font-black text-xs uppercase transition-all border ${darkMode ? 'bg-gray-900 border-gray-800 focus:border-blue-500' : 'bg-gray-100 border-transparent focus:bg-white focus:border-blue-500 shadow-sm'}`} placeholder="Explore Beta Network" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-3 gap-[2px]">
        {media.map(p => <img key={p.id} src={p.image_url} className="aspect-square w-full h-full object-cover cursor-pointer hover:brightness-75 transition duration-300" onClick={() => setSelectedPost(p)} />)}
      </div>
    </div>
  );
}

function FollowListModal({ type, userId, onClose, openProfile, getAvatar, darkMode }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    const fetchList = async () => {
      const col = type === 'followers' ? 'following_id' : 'follower_id';
      const target = type === 'followers' ? 'follower_id' : 'following_id';
      const { data } = await supabase.from('follows').select(target).eq(col, userId);
      if (data) {
        const ids = data.map(f => f[target]);
        const { data: profs } = await supabase.from('profiles').select('*').in('id', ids);
        if (profs) setList(profs);
      }
    };
    fetchList();
  }, [type, userId]);
  return (
    <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-end animate-in fade-in duration-300">
      <div className={`w-full max-w-md h-[70vh] rounded-t-[3rem] p-8 shadow-2xl flex flex-col ${darkMode ? 'bg-black text-white border-t border-gray-800' : 'bg-white text-black'}`}>
        <div className="flex justify-between items-center mb-6"><h3 className="font-black uppercase text-lg text-blue-600 tracking-tighter">{type}</h3><button onClick={onClose} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full"><X size={20}/></button></div>
        <div className="space-y-4 overflow-y-auto flex-grow pb-10">
          {list.map(u => (
            <div key={u.id} className="flex items-center gap-4 p-2 hover:bg-gray-50/10 rounded-2xl transition cursor-pointer" onClick={() => { openProfile(u.id); onClose(); }}>
              <img src={getAvatar(u.username, u.avatar_url)} className="w-12 h-12 rounded-full shadow-sm object-cover" />
              <div><p className="font-black text-sm">{u.display_name}</p><p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">@{u.username}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
                                                                                                                                                                                                                                                                                                         }
