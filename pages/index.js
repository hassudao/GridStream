import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, 
  X, User as UserIcon, Grid, List, Image as ImageIcon, Send, 
  ChevronLeft, Zap, Mail, Lock, Settings, Moon, Sun, Trash2 
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
  const [replyTo, setReplyTo] = useState(null);
  const [dmTarget, setDmTarget] = useState(null);
  
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const headerInputRef = useRef(null);

  // --- Logic Functions ---
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
      
      {/* Modals & Screens */}
      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} getAvatar={getAvatar} darkMode={darkMode} />}
      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} user={user} darkMode={darkMode} setDarkMode={setDarkMode} />}
      {showFollowList && <FollowListModal type={showFollowList} userId={activeProfileId} onClose={() => setShowFollowList(null)} openProfile={openProfile} getAvatar={getAvatar} darkMode={darkMode} />}
      {selectedPost && <PostDetailModal post={selectedPost} posts={posts} onClose={() => setSelectedPost(null)} getAvatar={getAvatar} openProfile={openProfile} onDelete={handleDeletePost} onLike={toggleLike} onReply={(p) => { setReplyTo(p); setSelectedPost(null); setView('home'); window.scrollTo(0,0); }} currentUser={user} darkMode={darkMode} />}

      {/* Main Views */}
      {view === 'home' && (
        <div className="animate-in fade-in">
          <header className={`sticky top-0 z-30 backdrop-blur-xl border-b p-5 flex justify-between items-center ${darkMode ? 'bg-black/80 border-gray-800' : 'bg-white/80 border-gray-50'}`}>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-cyan-500 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1.5">
              <Zap size={24} className="text-blue-600 fill-blue-600" /> GridStream
            </h1>
            <div className="flex gap-4 items-center">
               <button onClick={() => setShowSettings(true)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"><Settings size={20}/></button>
            </div>
          </header>
          
          <form onSubmit={handlePost} className={`p-5 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            {replyTo && (
              <div className="flex items-center justify-between bg-blue-500/10 p-3 rounded-2xl mb-4 border border-blue-500/20">
                <p className="text-xs font-black text-blue-500 uppercase tracking-widest">Replying to @{replyTo.profiles?.username}</p>
                <X size={16} className="cursor-pointer text-blue-500" onClick={() => setReplyTo(null)} />
              </div>
            )}
            <div className="flex gap-4">
              <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-12 h-12 rounded-full object-cover shadow-lg ring-2 ring-gray-50 dark:ring-gray-900 cursor-pointer" onClick={() => openProfile(user.id)} />
              <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-24 outline-none bg-transparent font-medium py-2" placeholder={replyTo ? "Post your reply" : "今、何を考えてる？"} value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-16 mt-2">
              <label className="cursor-pointer text-blue-500 p-2.5 rounded-full transition hover:bg-blue-50/10"><ImageIcon size={24}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
              <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-8 py-2.5 rounded-full font-black text-xs shadow-xl shadow-blue-500/20 uppercase tracking-widest active:scale-95 transition-all">
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
          <div className={`h-40 relative overflow-hidden bg-gray-200 ${!profileInfo.header_url && 'bg-gradient-to-br from-blue-700 via-indigo-600 to-cyan-500'}`}>
            <img src={isEditing ? editData.header_url : (profileInfo.header_url || '')} className="w-full h-full object-cover" />
            {isEditing && (
              <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer text-white">
                <Camera size={28} /><input type="file" accept="image/*" ref={headerInputRef} className="hidden" />
              </label>
            )}
            {!isEditing && <button onClick={() => setView('home')} className="absolute top-4 left-4 bg-black/30 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/50 transition"><ChevronLeft size={24}/></button>}
          </div>
          <div className="px-5 relative">
            <div className="absolute -top-14 left-5">
              <div className="relative">
                <img src={getAvatar(profileInfo.username, profileInfo.avatar_url)} className={`w-28 h-28 rounded-[2rem] border-4 shadow-2xl object-cover ${darkMode ? 'border-black bg-black' : 'border-white bg-white'}`} />
                {isEditing && (
                  <label className="absolute inset-0 bg-black/40 rounded-[2rem] flex items-center justify-center cursor-pointer text-white">
                    <Camera size={24} /><input type="file" accept="image/*" ref={avatarInputRef} className="hidden" />
                  </label>
                )}
              </div>
            </div>
            <div className="flex justify-end py-4 gap-3">
              {user.id === activeProfileId ? (
                <button onClick={() => setIsEditing(!isEditing)} className={`border rounded-full px-6 py-2 text-xs font-black uppercase tracking-widest ${darkMode ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600 shadow-sm'}`}>{isEditing ? 'Cancel' : 'Edit Profile'}</button>
              ) : (
                <>
                  <button onClick={() => setDmTarget(profileInfo)} className="p-2 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-50 transition"><Mail size={20}/></button>
                  <button onClick={async () => {
                    if (stats.isFollowing) await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', activeProfileId);
                    else await supabase.from('follows').insert([{ follower_id: user.id, following_id: activeProfileId }]);
                    openProfile(activeProfileId);
                  }} className={`rounded-full px-8 py-2 text-xs font-black uppercase transition shadow-lg ${stats.isFollowing ? 'bg-gray-100 text-black border border-gray-200' : 'bg-blue-600 text-white shadow-blue-500/20'}`}>{stats.isFollowing ? 'Following' : 'Follow'}</button>
                </>
              )}
              {isEditing && <button onClick={handleSaveProfile} className="bg-blue-600 text-white rounded-full px-6 py-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">Save</button>}
            </div>
            <div className="mt-6">
              <h2 className="text-3xl font-black tracking-tighter">{profileInfo.display_name}</h2>
              <p className="text-gray-400 font-bold text-sm">@{profileInfo.username}</p>
              <p className="mt-4 text-[16px] font-medium leading-relaxed">{profileInfo.bio || 'GridStream Beta Member.'}</p>
              <div className="flex gap-8 mt-6">
                <button onClick={() => setShowFollowList('following')} className="flex gap-2 items-center hover:opacity-70 transition group"><span className="font-black text-xl">{stats.following}</span><span className="text-gray-400 text-[11px] uppercase font-black tracking-widest group-hover:text-blue-500">Following</span></button>
                <button onClick={() => setShowFollowList('followers')} className="flex gap-2 items-center hover:opacity-70 transition group"><span className="font-black text-xl">{stats.followers}</span><span className="text-gray-400 text-[11px] uppercase font-black tracking-widest group-hover:text-blue-500">Followers</span></button>
              </div>
            </div>
          </div>
          
          <div className={`flex border-b mt-8 sticky top-0 z-40 backdrop-blur-xl ${darkMode ? 'bg-black/80 border-gray-800' : 'bg-white/80 border-gray-100'}`}>
            <button onClick={() => setProfileTab('list')} className={`flex-grow py-5 flex justify-center items-center gap-2 ${profileTab === 'list' ? 'border-b-4 border-blue-600 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}><List size={22}/></button>
            <button onClick={() => setProfileTab('grid')} className={`flex-grow py-5 flex justify-center items-center gap-2 ${profileTab === 'grid' ? 'border-b-4 border-blue-600 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}><Grid size={22}/></button>
          </div>

          <div className={profileTab === 'grid' ? "grid grid-cols-3 gap-0.5" : ""}>
            {posts.filter(p => p.user_id === activeProfileId).map(post => (
              profileTab === 'grid' ? (post.image_url && <img key={post.id} src={post.image_url} className="aspect-square w-full h-full object-cover cursor-pointer hover:brightness-90 transition duration-300 shadow-inner" onClick={() => setSelectedPost(post)} />)
              : <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onDelete={handleDeletePost} onLike={toggleLike} onReply={() => { setReplyTo(post); setView('home'); window.scrollTo(0,0); }} onSelect={() => setSelectedPost(post)} currentUser={user} darkMode={darkMode} />
            ))}
          </div>
        </div>
      )}

      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSelectedPost={setSelectedPost} darkMode={darkMode} />}
      {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} setDmTarget={setDmTarget} getAvatar={getAvatar} darkMode={darkMode} />}

      {/* Navigation */}
      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-5 z-40 shadow-2xl backdrop-blur-xl ${darkMode ? 'bg-black/90 border-gray-800 text-gray-600' : 'bg-white/95 border-gray-50 text-gray-300'}`}>
        <button onClick={() => { setView('home'); setReplyTo(null); }} className={`transition-all active:scale-90 ${view === 'home' ? 'text-blue-600 scale-110' : ''}`}><HomeIcon size={26} /></button>
        <button onClick={() => setView('search')} className={`transition-all active:scale-90 ${view === 'search' ? (darkMode ? 'text-white' : 'text-black') + ' scale-110' : ''}`}><Search size={26} /></button>
        <button onClick={() => setView('messages')} className={`transition-all active:scale-90 ${view === 'messages' ? (darkMode ? 'text-white' : 'text-black') + ' scale-110' : ''}`}><MessageCircle size={26} /></button>
        <button onClick={() => openProfile(user.id)} className={`transition-all active:scale-90 ${view === 'profile' && activeProfileId === user.id ? (darkMode ? 'text-white' : 'text-black') + ' scale-110' : ''}`}><UserIcon size={26} /></button>
      </nav>
    </div>
  );
}

// --- Detailed Components ---

function PostCard({ post, openProfile, getAvatar, onDelete, onLike, onReply, onSelect, currentUser, darkMode, isReply = false }) {
  const isMyPost = currentUser && post.user_id === currentUser.id;
  return (
    <article className={`p-5 flex gap-4 hover:bg-gray-50/5 transition ${!isReply ? 'border-b' : ''} ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
      <div className="flex flex-col items-center">
        <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-12 h-12 rounded-full cursor-pointer object-cover shadow-md ring-2 ring-gray-50 dark:ring-gray-900" onClick={() => openProfile(post.profiles?.id)} />
        {isReply && <div className="w-1 grow bg-gray-100 dark:bg-gray-800 my-2 rounded-full" />}
      </div>
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-start">
          <div className="flex flex-col cursor-pointer" onClick={() => openProfile(post.profiles?.id)}>
            <span className="font-black text-sm leading-tight truncate">{post.profiles?.display_name}</span>
            <span className="text-gray-400 text-[11px] font-black uppercase tracking-widest truncate">@{post.profiles?.username}</span>
          </div>
          {isMyPost && <button onClick={() => onDelete(post.id)} className="text-gray-300 hover:text-red-500 transition p-1"><Trash2 size={18} /></button>}
        </div>
        <p className="text-[16px] mt-2 font-medium leading-relaxed whitespace-pre-wrap cursor-pointer" onClick={onSelect}>{post.content}</p>
        {post.image_url && <img src={post.image_url} className="mt-4 rounded-3xl w-full max-h-[400px] object-cover border border-gray-100 dark:border-gray-800 shadow-xl" onClick={onSelect} />}
        <div className="flex justify-between mt-5 text-gray-400 max-w-[200px] items-center">
          <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-2 transition hover:scale-110 ${post.is_liked ? 'text-red-500' : 'hover:text-red-500'}`}><Heart size={20} fill={post.is_liked ? "currentColor" : "none"} /><span className="text-xs font-black">{post.like_count || ''}</span></button>
          <button onClick={onReply} className="hover:text-blue-500 hover:scale-110 transition p-1"><MessageCircle size={20} /></button>
          <Share2 size={20} className="hover:text-green-500 hover:scale-110 transition p-1" />
        </div>
      </div>
    </article>
  );
}

function PostDetailModal({ post, posts, onClose, getAvatar, openProfile, onDelete, onLike, onReply, currentUser, darkMode }) {
  const replies = posts.filter(p => p.parent_id === post.id);
  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-end justify-center animate-in slide-in-from-bottom duration-300">
      <div className={`w-full max-w-md h-[94vh] rounded-t-[3rem] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.3)] ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
        <div className="h-1.5 w-12 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto my-3" onClick={onClose} />
        <div className="p-4 border-b dark:border-gray-800 flex items-center justify-between">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"><ChevronLeft size={24}/></button>
          <span className="font-black text-xs uppercase text-blue-600 tracking-[0.2em]">Thread Detail</span>
          <div className="w-10" />
        </div>
        <div className="overflow-y-auto flex-grow pb-24">
          <div className="p-6 border-b-8 dark:border-gray-900 border-gray-50">
            <div className="flex gap-4 mb-5">
              <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-14 h-14 rounded-full object-cover shadow-xl ring-2 ring-blue-500/20" />
              <div className="flex flex-col justify-center">
                <p className="font-black text-xl tracking-tight">{post.profiles?.display_name}</p>
                <p className="text-gray-400 text-sm font-black uppercase tracking-widest">@{post.profiles?.username}</p>
              </div>
            </div>
            <p className="text-[20px] font-medium leading-relaxed mb-6 whitespace-pre-wrap">{post.content}</p>
            {post.image_url && <img src={post.image_url} className="w-full rounded-[2.5rem] mb-6 shadow-2xl border dark:border-gray-800" />}
            <div className="flex gap-8 py-5 border-t dark:border-gray-800 text-gray-400">
              <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-2.5 font-black ${post.is_liked ? 'text-red-500' : ''}`}><Heart size={24} fill={post.is_liked ? "currentColor" : "none"}/><span className="text-sm font-black">{post.like_count}</span></button>
              <button onClick={() => onReply(post)} className="flex items-center gap-2.5 font-black hover:text-blue-500 transition"><MessageCircle size={24} /><span className="text-sm font-black uppercase tracking-tighter">Reply</span></button>
            </div>
          </div>
          <div>
            {replies.length > 0 ? (
              replies.map(reply => (
                <PostCard key={reply.id} post={reply} openProfile={openProfile} getAvatar={getAvatar} onDelete={onDelete} onLike={onLike} onReply={() => onReply(reply)} onSelect={() => {}} currentUser={currentUser} darkMode={darkMode} isReply={true} />
              ))
            ) : (
              <div className="py-20 text-center flex flex-col items-center gap-3">
                <MessageCircle size={40} className="text-gray-200" />
                <p className="text-gray-400 font-black uppercase text-[10px] tracking-[0.3em]">Be the first to reply</p>
              </div>
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
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          await supabase.from('profiles').insert([{ id: data.user.id, username: username.toLowerCase(), display_name: username, avatar_url: getAvatar(username) }]);
          alert("Success! Welcome to Beta."); setIsLogin(true);
        }
      }
    } catch (err) { alert(err.message); }
    finally { setLoading(false); fetchData(); }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white flex flex-col justify-center p-10 font-sans">
      <div className="mb-16 text-center animate-in zoom-in duration-700">
        <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl rotate-3">
          <Zap size={44} className="text-white fill-white" />
        </div>
        <h1 className="text-6xl font-black italic tracking-tighter text-blue-600 uppercase leading-none">GridStream</h1>
        <div className="mt-4 flex justify-center gap-2">
           <span className="bg-black text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full">Beta</span>
           <span className="bg-blue-100 text-blue-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full font-mono">2026</span>
        </div>
      </div>
      <form onSubmit={handleAuth} className="space-y-5">
        {!isLogin && (
          <div className="bg-gray-50 p-5 rounded-[1.5rem] flex items-center gap-4 border-2 border-transparent focus-within:border-blue-600 focus-within:bg-white transition-all">
            <UserIcon size={20} className="text-blue-500" /><input placeholder="Username" className="bg-transparent w-full outline-none font-black text-black uppercase text-sm" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
        )}
        <div className="bg-gray-50 p-5 rounded-[1.5rem] flex items-center gap-4 border-2 border-transparent focus-within:border-blue-600 focus-within:bg-white transition-all">
          <Mail size={20} className="text-blue-500" /><input type="email" placeholder="Email" className="bg-transparent w-full outline-none font-bold text-black" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="bg-gray-50 p-5 rounded-[1.5rem] flex items-center gap-4 border-2 border-transparent focus-within:border-blue-600 focus-within:bg-white transition-all">
          <Lock size={20} className="text-blue-500" /><input type="password" placeholder="Password" className="bg-transparent w-full outline-none font-bold text-black" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black py-5 rounded-[1.5rem] shadow-[0_15px_30px_rgba(37,99,235,0.3)] uppercase tracking-[0.2em] text-xs active:scale-95 transition-all hover:bg-blue-700">
          {loading ? 'Processing...' : (isLogin ? 'Enter Beta' : 'Join Network')}
        </button>
      </form>
      <p onClick={() => setIsLogin(!isLogin)} className="text-center mt-10 text-[11px] font-black text-gray-400 cursor-pointer uppercase tracking-[0.2em] hover:text-blue-600 transition">
        {isLogin ? "No account? Create profile" : "Member? Sign in here"}
      </p>
    </div>
  );
}

function SettingsScreen({ onClose, user, darkMode, setDarkMode }) {
  return (
    <div className={`fixed inset-0 z-[150] animate-in slide-in-from-right duration-300 ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <div className="p-6 border-b dark:border-gray-800 flex items-center gap-4">
        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"><ChevronLeft size={24} /></button>
        <h2 className="text-xl font-black uppercase tracking-tighter">Settings</h2>
      </div>
      <div className="p-8 space-y-10">
        <section>
          <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] mb-6 ml-1">Interface</h3>
          <button onClick={() => setDarkMode(!darkMode)} className={`w-full p-6 rounded-[2rem] flex justify-between items-center transition-all ${darkMode ? 'bg-gray-900 shadow-xl shadow-blue-500/5' : 'bg-gray-50 shadow-sm'}`}>
            <div className="flex items-center gap-4">{darkMode ? <Moon size={24} className="text-blue-400"/> : <Sun size={24} className="text-orange-400"/>}<span className="font-black text-sm uppercase tracking-widest">Dark Mode</span></div>
            <div className={`w-12 h-7 rounded-full relative transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${darkMode ? 'right-1' : 'left-1'}`} /></div>
          </button>
        </section>
        <div className="pt-10">
           <button onClick={() => supabase.auth.signOut()} className="w-full p-6 bg-red-50 text-red-500 font-black rounded-[2rem] uppercase text-xs tracking-[0.3em] hover:bg-red-100 transition shadow-sm border border-red-100">Sign out Beta</button>
           <p className="text-center text-[10px] text-gray-400 mt-6 font-black uppercase tracking-widest">GridStream App v2.0.26</p>
        </div>
      </div>
    </div>
  );
}

function DMScreen({ target, setDmTarget, currentUser, getAvatar, darkMode }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const scrollRef = useRef();

  useEffect(() => {
    const fetchMsgs = async () => {
      const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
      if (data) setMsgs(data);
    };
    fetchMsgs();
    const sub = supabase.channel('msgs').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchMsgs).subscribe();
    return () => supabase.removeChannel(sub);
  }, [target.id]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const send = async (e) => {
    e.preventDefault(); if (!text.trim()) return;
    await supabase.from('messages').insert([{ sender_id: currentUser.id, receiver_id: target.id, content: text }]);
    setText('');
  };

  return (
    <div className={`fixed inset-0 z-[120] flex flex-col animate-in slide-in-from-right duration-300 ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <div className="p-5 border-b dark:border-gray-800 flex items-center gap-4 backdrop-blur-xl sticky top-0 z-10">
        <ChevronLeft onClick={() => setDmTarget(null)} className="cursor-pointer" />
        <img src={getAvatar(target.username, target.avatar_url)} className="w-10 h-10 rounded-full object-cover shadow-lg border-2 border-blue-500/20" />
        <div className="flex flex-col"><span className="font-black text-md leading-none">{target.display_name}</span><span className="text-[10px] text-green-500 font-black uppercase tracking-widest mt-1 italic">Secure Stream</span></div>
      </div>
      <div className="flex-grow overflow-y-auto p-6 space-y-6">
        {msgs.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 px-5 rounded-[1.5rem] font-medium text-sm shadow-xl ${m.sender_id === currentUser.id ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-500/10' : 'bg-gray-100 dark:bg-gray-800 rounded-tl-none'}`}>{m.content}</div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <form onSubmit={send} className="p-5 pb-8 border-t dark:border-gray-800 flex gap-3 backdrop-blur-xl">
        <input className={`flex-grow rounded-[1.5rem] px-6 py-4 outline-none font-bold text-sm shadow-inner transition-all ${darkMode ? 'bg-gray-900 focus:bg-gray-800' : 'bg-gray-50 focus:bg-white border focus:border-blue-500'}`} value={text} onChange={e => setText(e.target.value)} placeholder="Type securely..." />
        <button type="submit" className="bg-blue-600 p-4 rounded-full text-white shadow-2xl active:scale-90 transition-transform"><Send size={22}/></button>
      </form>
    </div>
  );
}

function MessagesList({ allProfiles, user, setDmTarget, getAvatar, darkMode }) {
  return (
    <div className="animate-in fade-in p-6 pb-24">
      <h2 className="text-3xl font-black mb-8 uppercase tracking-tighter flex items-center gap-3"><MessageCircle size={32} className="text-blue-600 fill-blue-600"/> Direct</h2>
      <div className="space-y-4">
        {allProfiles.filter(p => p.id !== user.id).map(p => (
          <div key={p.id} onClick={() => setDmTarget(p)} className={`flex items-center gap-5 p-5 rounded-[2rem] cursor-pointer transition-all border group ${darkMode ? 'bg-gray-900 border-gray-800 hover:border-blue-900' : 'bg-white border-gray-100 hover:bg-gray-50 shadow-lg shadow-gray-200/20'}`}>
            <div className="relative">
              <img src={getAvatar(p.username, p.avatar_url)} className="w-14 h-14 rounded-full object-cover shadow-md transition group-hover:scale-105" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-4 border-white dark:border-gray-900" />
            </div>
            <div className="flex-grow"><p className="font-black text-md">{p.display_name}</p><p className="text-gray-400 text-xs font-black uppercase tracking-widest mt-0.5">@{p.username}</p></div>
            <ChevronLeft size={20} className="rotate-180 text-gray-300" />
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
      <div className={`p-5 sticky top-0 z-20 backdrop-blur-xl ${darkMode ? 'bg-black/80 border-b border-gray-800' : 'bg-white/95 border-b border-gray-50'}`}>
        <div className="relative"><Search className="absolute left-5 top-4.5 text-gray-400" size={20} /><input className={`w-full rounded-2xl py-4 pl-14 pr-6 outline-none font-black text-xs uppercase transition-all border-2 ${darkMode ? 'bg-gray-900 border-gray-800 focus:border-blue-600' : 'bg-gray-50 border-transparent focus:bg-white focus:border-blue-600 shadow-sm focus:shadow-xl'}`} placeholder="Explore Beta Network" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-3 gap-0.5">
        {media.map(p => <img key={p.id} src={p.image_url} className="aspect-square w-full h-full object-cover cursor-pointer hover:opacity-80 transition duration-300 shadow-inner" onClick={() => setSelectedPost(p)} />)}
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
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xl flex items-end animate-in fade-in duration-300">
      <div className={`w-full max-w-md h-[75vh] rounded-t-[4rem] p-10 shadow-2xl flex flex-col ${darkMode ? 'bg-black text-white border-t border-gray-800' : 'bg-white text-black'}`}>
        <div className="flex justify-between items-center mb-10"><h3 className="font-black uppercase text-xl text-blue-600 tracking-tighter">{type}</h3><button onClick={onClose} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full hover:rotate-90 transition-transform duration-300"><X size={24}/></button></div>
        <div className="space-y-6 overflow-y-auto flex-grow pb-10">
          {list.length > 0 ? list.map(u => (
            <div key={u.id} className="flex items-center gap-5 p-3 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-[1.5rem] transition cursor-pointer" onClick={() => { openProfile(u.id); onClose(); }}>
              <img src={getAvatar(u.username, u.avatar_url)} className="w-14 h-14 rounded-full shadow-lg object-cover" />
              <div><p className="font-black text-md">{u.display_name}</p><p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">@{u.username}</p></div>
            </div>
          )) : <p className="text-center py-20 text-gray-400 font-black uppercase text-xs tracking-widest">No connections found</p>}
        </div>
      </div>
    </div>
  );
                                                                                                                                                                                                    }
