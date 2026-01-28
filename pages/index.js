import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User as UserIcon, Grid, List, Image as ImageIcon, Send, ChevronLeft, MapPin, Calendar, Check, AtSign, Zap, LogOut, Mail, Lock, MoreHorizontal, Settings, Save, Moon, Sun, AlertCircle, Trash2 } from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = 'dtb3jpadj'; 
const CLOUDINARY_UPLOAD_PRESET = 'alpha-sns';

export default function App() {
  // スタイル崩れ防止のため、CDNをここに配置
  if (typeof document !== 'undefined' && !document.getElementById('tailwind-cdn')) {
    const script = document.createElement('script');
    script.id = 'tailwind-cdn';
    script.src = 'https://cdn.tailwindcss.com';
    document.head.appendChild(script);
  }

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
  
  // コメント表示管理
  const [expandedComments, setExpandedComments] = useState({});

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
        likes(user_id)
      `)
      .order('created_at', { ascending: false });
    
    if (error) console.error("Fetch posts error:", error);
    if (postsData) {
      const formattedPosts = postsData.map(post => ({
        ...post,
        like_count: post.likes?.length || 0,
        is_liked: user ? post.likes?.some(l => l.user_id === user.id) : false,
        reply_count: postsData.filter(p => p.parent_id === post.id).length
      }));
      setPosts(formattedPosts);
    }
    
    const { data: profData } = await supabase.from('profiles').select('*');
    if (profData) setAllProfiles(profData);
  }

  async function toggleLike(postId, isLiked) {
    if (!user) return;
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return { ...p, is_liked: !isLiked, like_count: isLiked ? p.like_count - 1 : p.like_count + 1 };
      }
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

  async function handleCommentSubmit(postId, text, file) {
    if (!text.trim() && !file) return;
    setUploading(true);
    let imageUrl = null;
    if (file) imageUrl = await uploadToCloudinary(file);
    await supabase.from('posts').insert([{ content: text, user_id: user.id, image_url: imageUrl, parent_id: postId }]);
    fetchData();
    setUploading(false);
  }

  async function handleDeletePost(postId) {
    if (!window.confirm("削除しますか？")) return;
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
    if (!user || user.id === activeProfileId) return;
    if (stats.isFollowing) await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', activeProfileId);
    else await supabase.from('follows').insert([{ follower_id: user.id, following_id: activeProfileId }]);
    openProfile(activeProfileId);
  };

  const getAvatar = (name, url) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;

  if (!user) return <AuthScreen fetchData={fetchData} />;

  return (
    <div className={`max-w-md mx-auto min-h-screen pb-20 border-x font-sans relative shadow-2xl transition-colors duration-300 ${darkMode ? 'bg-black text-white border-gray-800' : 'bg-white text-black border-gray-100'}`}>
      
      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} user={user} darkMode={darkMode} setDarkMode={setDarkMode} />}

      {view === 'home' && (
        <div className="animate-in fade-in">
          <header className={`sticky top-0 z-30 backdrop-blur-md border-b p-4 flex justify-between items-center ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-100'}`}>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-cyan-500 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1">
              <Zap size={24} className="text-blue-600 fill-blue-600" /> GridStream
            </h1>
            <MessageCircle size={24} className="cursor-pointer" onClick={() => setView('messages')} />
          </header>
          
          <form onSubmit={handlePost} className={`p-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            <div className="flex gap-3">
              <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-10 h-10 rounded-full object-cover shadow-sm" />
              <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none bg-transparent font-medium" placeholder="今、何を考えてる？" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-12 mt-2">
              <label className="cursor-pointer text-blue-500 p-2 rounded-full transition hover:bg-blue-50/10">
                <ImageIcon size={22}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" />
              </label>
              <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs shadow-lg uppercase tracking-tighter">
                {uploading ? '...' : 'Stream'}
              </button>
            </div>
          </form>

          <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
            {posts.filter(p => !p.parent_id).map(post => (
              <div key={post.id}>
                <PostCard 
                  post={post} 
                  openProfile={openProfile} 
                  getAvatar={getAvatar} 
                  onDelete={handleDeletePost} 
                  onLike={toggleLike} 
                  onToggleComments={() => setExpandedComments(prev => ({...prev, [post.id]: !prev[post.id]}))}
                  isExpanded={expandedComments[post.id]}
                  currentUser={user} 
                  darkMode={darkMode} 
                />
                {expandedComments[post.id] && (
                  <CommentSection 
                    postId={post.id} 
                    allPosts={posts} 
                    currentUser={user} 
                    myProfile={myProfile}
                    onCommentSubmit={handleCommentSubmit} 
                    onDelete={handleDeletePost}
                    openProfile={openProfile}
                    getAvatar={getAvatar}
                    darkMode={darkMode}
                    uploading={uploading}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile, Search, Messages views would go here - simplified for style fix */}
      {view === 'profile' && profileInfo && (
        <div className="p-4"><button onClick={() => setView('home')}><ChevronLeft /></button><p className="font-bold text-2xl">{profileInfo.display_name}</p></div>
      )}

      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 ${darkMode ? 'bg-black/95 border-gray-800 text-gray-600' : 'bg-white/95 border-gray-100 text-gray-300'}`}>
        <HomeIcon onClick={() => setView('home')} className={`cursor-pointer ${view === 'home' ? 'text-blue-600' : ''}`} />
        <Search onClick={() => setView('search')} className="cursor-pointer" />
        <MessageCircle onClick={() => setView('messages')} className="cursor-pointer" />
        <UserIcon onClick={() => openProfile(user.id)} className="cursor-pointer" />
      </nav>
    </div>
  );
}

function PostCard({ post, openProfile, getAvatar, onDelete, onLike, onToggleComments, isExpanded, currentUser, darkMode }) {
  return (
    <article className={`p-4 flex gap-3 transition border-b ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
      <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer object-cover" onClick={() => openProfile(post.profiles.id)} />
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-start">
          <div className="cursor-pointer" onClick={() => openProfile(post.profiles.id)}>
            <span className="font-black text-sm block">{post.profiles?.display_name}</span>
            <span className="text-gray-400 text-xs font-bold">@{post.profiles?.username}</span>
          </div>
          {currentUser?.id === post.user_id && <button onClick={() => onDelete(post.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>}
        </div>
        <p className="text-[15px] mt-1 font-medium leading-relaxed whitespace-pre-wrap">{post.content}</p>
        {post.image_url && <img src={post.image_url} className="mt-3 rounded-2xl w-full max-h-80 object-cover" />}
        <div className="flex gap-8 mt-4 text-gray-400">
          <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 ${post.is_liked ? 'text-red-500' : ''}`}>
            <Heart size={18} fill={post.is_liked ? "currentColor" : "none"} />
            <span className="text-xs font-black">{post.like_count || ''}</span>
          </button>
          <button onClick={onToggleComments} className={`flex items-center gap-1.5 ${isExpanded ? 'text-blue-500' : ''}`}>
            <MessageCircle size={18} fill={isExpanded ? "currentColor" : "none"} />
            <span className="text-xs font-black">{post.reply_count || ''}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function CommentSection({ postId, allPosts, currentUser, myProfile, onCommentSubmit, onDelete, openProfile, getAvatar, darkMode, uploading }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const comments = allPosts.filter(p => p.parent_id === postId).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return (
    <div className={`border-b animate-in slide-in-from-top duration-200 ${darkMode ? 'bg-gray-950 border-gray-800' : 'bg-gray-50'}`}>
      <div className="p-4 flex gap-3 border-b border-blue-100/30">
        <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-9 h-9 rounded-full object-cover" />
        <div className="flex-grow flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 font-bold rounded">KB</span>
            <span className="text-blue-600 font-bold text-xs">{myProfile.display_name}</span>
          </div>
          <textarea className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-blue-400 h-20 resize-none" placeholder="コメントを書く..." value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex justify-end gap-2 items-center">
            <label className="cursor-pointer text-blue-500"><ImageIcon size={20}/><input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} /></label>
            <button onClick={() => { onCommentSubmit(postId, text, file); setText(''); setFile(null); }} disabled={uploading || (!text.trim() && !file)} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg font-black text-xs">書き込み</button>
          </div>
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {comments.map((c, i) => (
          <div key={c.id} className="p-4 flex gap-3">
            <span className="text-blue-400 font-bold text-xs">{i + 1}:</span>
            <div className="flex-grow">
              <div className="flex items-center gap-2">
                <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 font-bold rounded">OB</span>
                <span className="text-blue-600 font-bold text-xs">{c.profiles?.display_name}</span>
              </div>
              <p className="text-sm mt-1">{c.content}</p>
              {c.image_url && <img src={c.image_url} className="mt-2 rounded-lg max-h-40" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsScreen({ onClose, darkMode, setDarkMode }) {
  return (
    <div className={`fixed inset-0 z-[100] p-4 ${darkMode ? 'bg-black text-white' : 'bg-white'}`}>
      <button onClick={onClose}><ChevronLeft /></button>
      <div className="mt-8 flex justify-between items-center p-4 bg-gray-100 rounded-xl" onClick={() => setDarkMode(!darkMode)}>
        <span className="font-bold">Dark Mode</span>
        <div className={`w-10 h-6 rounded-full relative ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full ${darkMode ? 'right-1' : 'left-1'}`} /></div>
      </div>
      <button onClick={() => supabase.auth.signOut()} className="w-full mt-4 p-4 bg-red-50 text-red-500 rounded-xl font-bold">Logout</button>
    </div>
  );
}

function AuthScreen({ fetchData }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const { error: signError } = await supabase.auth.signUp({ email, password });
      if (signError) alert(signError.message);
    }
    fetchData();
  };
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-white">
      <Zap size={48} className="text-blue-600 mb-6" />
      <form onSubmit={handleLogin} className="w-full max-w-xs space-y-4 text-black">
        <input type="email" placeholder="Email" className="w-full p-4 bg-gray-100 rounded-2xl outline-none" onChange={e => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" className="w-full p-4 bg-gray-100 rounded-2xl outline-none" onChange={e => setPassword(e.target.value)} />
        <button className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black shadow-lg">LOGIN / JOIN</button>
      </form>
    </div>
  );
}
