import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, 
  User as UserIcon, Grid, List, Image as ImageIcon, Send, ChevronLeft, 
  MapPin, Calendar, Check, AtSign, Zap, LogOut, Mail, Lock, 
  MoreHorizontal, Settings, Save, Moon, Sun, AlertCircle, Trash2 
} from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = 'dtb3jpadj'; 
const CLOUDINARY_UPLOAD_PRESET = 'alpha-sns';

export default function App() {
  // --- スタイル崩れ防止: HeadにCDNを強制注入 ---
  useEffect(() => {
    const addStyle = (id, content) => {
      if (document.getElementById(id)) return;
      const el = document.createElement(id.startsWith('js') ? 'script' : 'style');
      el.id = id;
      if (id.startsWith('js')) el.src = content; else el.textContent = content;
      document.head.appendChild(el);
    };
    // Tailwind CDN
    addStyle('js-tailwind', 'https://cdn.tailwindcss.com');
    // カスタムフォントとアニメーション
    addStyle('css-custom', `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
      body { font-family: 'Inter', sans-serif; transition: background-color 0.3s; }
      .animate-in { animation: fadeIn 0.3s ease-out; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    `);
  }, []);

  // --- 状態管理 ---
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
  const [expandedComments, setExpandedComments] = useState({});
  const [dmTarget, setDmTarget] = useState(null);

  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const headerInputRef = useRef(null);

  // --- 認証 & 初期化 ---
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
    const { data: postsData } = await supabase.from('posts').select(`*, profiles(id, username, display_name, avatar_url), likes(user_id)`).order('created_at', { ascending: false });
    if (postsData) {
      setPosts(postsData.map(post => ({
        ...post,
        like_count: post.likes?.length || 0,
        is_liked: user ? post.likes?.some(l => l.user_id === user.id) : false,
        reply_count: postsData.filter(p => p.parent_id === post.id).length
      })));
    }
    const { data: profData } = await supabase.from('profiles').select('*');
    if (profData) setAllProfiles(profData);
  }

  // --- ユーティリティ ---
  const getAvatar = (name, url) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name || 'default'}`;

  async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    return data.secure_url;
  }

  // --- アクション ---
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

  async function toggleLike(postId, isLiked) {
    if (!user) return;
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_liked: !isLiked, like_count: isLiked ? p.like_count - 1 : p.like_count + 1 } : p));
    if (isLiked) await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id);
    else await supabase.from('likes').insert([{ post_id: postId, user_id: user.id }]);
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

  if (!user) return <AuthScreen fetchData={fetchData} />;

  return (
    <div className={`max-w-md mx-auto min-h-screen pb-20 border-x font-sans relative shadow-2xl transition-colors duration-300 ${darkMode ? 'bg-black text-white border-gray-800' : 'bg-white text-black border-gray-100'}`}>
      
      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} getAvatar={getAvatar} darkMode={darkMode} />}
      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} user={user} darkMode={darkMode} setDarkMode={setDarkMode} />}

      {view === 'home' && (
        <div className="animate-in">
          <header className={`sticky top-0 z-30 backdrop-blur-md border-b p-4 flex justify-between items-center ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-50'}`}>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-cyan-500 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1">
              <Zap size={24} className="text-blue-600 fill-blue-600" /> GridStream
            </h1>
            <MessageCircle size={24} className="cursor-pointer" onClick={() => setView('messages')} />
          </header>
          
          <form onSubmit={handlePost} className={`p-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            <div className="flex gap-3">
              <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-10 h-10 rounded-full object-cover shadow-sm cursor-pointer" onClick={() => openProfile(user.id)} />
              <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none bg-transparent font-medium" placeholder="今、何を考えてる？" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-12 mt-2">
              <label className="cursor-pointer text-blue-500 hover:bg-blue-50/10 p-2 rounded-full transition"><ImageIcon size={22}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
              <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs shadow-lg uppercase">Stream</button>
            </div>
          </form>

          <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
            {posts.filter(p => !p.parent_id).map(post => (
              <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onLike={toggleLike} currentUser={user} darkMode={darkMode} />
            ))}
          </div>
        </div>
      )}

      {view === 'profile' && profileInfo && (
        <div className="animate-in pb-10">
          <div className={`h-32 relative overflow-hidden bg-gray-200 ${!profileInfo.header_url && 'bg-gradient-to-br from-blue-700 via-indigo-600 to-cyan-500'}`}>
            <img src={profileInfo.header_url} className="w-full h-full object-cover" />
            <button onClick={() => setView('home')} className="absolute top-4 left-4 bg-black/30 backdrop-blur-md p-2 rounded-full text-white"><ChevronLeft size={20}/></button>
          </div>
          <div className="px-4 relative -top-10">
            <img src={getAvatar(profileInfo.username, profileInfo.avatar_url)} className={`w-24 h-24 rounded-full border-4 shadow-xl object-cover ${darkMode ? 'border-black bg-black' : 'border-white bg-white'}`} />
            <h2 className="text-2xl font-black mt-2">{profileInfo.display_name}</h2>
            <p className="text-gray-400 font-bold">@{profileInfo.username}</p>
          </div>
          <div className="grid grid-cols-3 gap-1 mt-4">
            {posts.filter(p => p.user_id === activeProfileId && p.image_url).map(p => (
              <img key={p.id} src={p.image_url} className="aspect-square object-cover" />
            ))}
          </div>
        </div>
      )}

      {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} setDmTarget={setDmTarget} getAvatar={getAvatar} darkMode={darkMode} />}
      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} darkMode={darkMode} />}

      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 ${darkMode ? 'bg-black border-gray-800 text-gray-600' : 'bg-white border-gray-100 text-gray-300'}`}>
        <HomeIcon onClick={() => setView('home')} className={view === 'home' ? 'text-blue-600' : ''} />
        <Search onClick={() => setView('search')} className={view === 'search' ? 'text-black' : ''} />
        <MessageCircle onClick={() => setView('messages')} className={view === 'messages' ? 'text-black' : ''} />
        <UserIcon onClick={() => openProfile(user.id)} className={view === 'profile' ? 'text-black' : ''} />
      </nav>
    </div>
  );
}

// サブコンポーネント
function PostCard({ post, openProfile, getAvatar, onLike, currentUser, darkMode }) {
  return (
    <article className="p-4 flex gap-3 transition">
      <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer object-cover" onClick={() => openProfile(post.profiles.id)} />
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-start">
          <span className="font-black text-sm">{post.profiles?.display_name} <span className="text-gray-400 font-normal">@{post.profiles?.username}</span></span>
        </div>
        <p className="text-[15px] mt-1 font-medium">{post.content}</p>
        {post.image_url && <img src={post.image_url} className="mt-3 rounded-2xl w-full max-h-80 object-cover border border-gray-100" />}
        <div className="flex gap-8 mt-4 text-gray-400">
          <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 ${post.is_liked ? 'text-red-500' : ''}`}><Heart size={18} fill={post.is_liked ? "currentColor" : "none"} /><span className="text-xs font-black">{post.like_count || ''}</span></button>
          <MessageCircle size={18} />
          <Share2 size={18} />
        </div>
      </div>
    </article>
  );
}

function MessagesList({ allProfiles, user, setDmTarget, getAvatar, darkMode }) {
  return (
    <div className="p-4 animate-in">
      <h2 className="text-xl font-black mb-6 italic uppercase tracking-tighter">Messages</h2>
      {allProfiles.filter(p => p.id !== user.id).map(u => (
        <div key={u.id} onClick={() => setDmTarget(u)} className="flex items-center gap-4 p-3 rounded-2xl cursor-pointer hover:bg-gray-50/10 transition">
          <img src={getAvatar(u.username, u.avatar_url)} className="w-14 h-14 rounded-full object-cover shadow-sm" />
          <div><p className="font-black text-[15px]">{u.display_name}</p><p className="text-xs text-blue-500 font-bold uppercase tracking-tighter italic">Tap to Chat</p></div>
        </div>
      ))}
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
      if ((p.new.sender_id === currentUser.id && p.new.receiver_id === target.id) || (p.new.sender_id === target.id && p.new.receiver_id === currentUser.id)) {
        setMessages(prev => [...prev, p.new]);
      }
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
    <div className={`fixed inset-0 z-50 flex flex-col animate-in ${darkMode ? 'bg-black text-white' : 'bg-[#f8f9fa] text-black'}`}>
      <header className={`p-4 border-b flex items-center gap-4 ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white'}`}>
        <ChevronLeft onClick={() => setDmTarget(null)} className="cursor-pointer" />
        <img src={getAvatar(target.username, target.avatar_url)} className="w-10 h-10 rounded-full object-cover" />
        <p className="font-black italic uppercase tracking-tighter">{target.display_name}</p>
      </header>
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] p-3 rounded-2xl text-sm font-medium ${m.sender_id === currentUser.id ? 'bg-blue-600 text-white rounded-tr-none' : (darkMode ? 'bg-gray-800 text-white rounded-tl-none' : 'bg-white text-gray-800 rounded-tl-none')}`}>{m.text}</div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <form onSubmit={sendMsg} className="p-4 border-t flex gap-2">
        <input className={`flex-grow p-3 rounded-xl outline-none text-sm ${darkMode ? 'bg-gray-900' : 'bg-white shadow-inner'}`} placeholder="メッセージを送信..." value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="bg-blue-600 text-white p-3 rounded-xl"><Send size={18}/></button>
      </form>
    </div>
  );
}

function SettingsScreen({ onClose, user, darkMode, setDarkMode }) {
  return (
    <div className={`fixed inset-0 z-[100] p-4 animate-in ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <div className="flex items-center gap-4 mb-8">
        <ChevronLeft onClick={onClose} className="cursor-pointer" />
        <h2 className="text-xl font-black uppercase italic tracking-tighter">Settings</h2>
      </div>
      <button onClick={() => setDarkMode(!darkMode)} className="w-full flex justify-between items-center p-4 rounded-2xl bg-gray-50/10 border">
        <span className="font-bold flex items-center gap-2">{darkMode ? <Moon size={18}/> : <Sun size={18}/>} Dark Mode</span>
      </button>
      <button onClick={() => supabase.auth.signOut()} className="w-full p-4 bg-red-50 text-red-500 rounded-2xl font-black uppercase mt-10">Logout</button>
    </div>
  );
}

function SearchView({ posts, openProfile, searchQuery, setSearchQuery, darkMode }) {
  return (
    <div className="p-4 animate-in">
      <input className={`w-full p-3 rounded-2xl outline-none mb-4 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100'}`} placeholder="DISCOVER CONTENT" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      <div className="grid grid-cols-3 gap-1">
        {posts.filter(p => p.image_url).map(p => (
          <img key={p.id} src={p.image_url} className="aspect-square object-cover cursor-pointer" onClick={() => openProfile(p.user_id)} />
        ))}
      </div>
    </div>
  );
}

function AuthScreen({ fetchData }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  
  const handleAuth = async (e) => {
    e.preventDefault();
    const { error } = isLogin ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else fetchData();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-white">
      <div className="w-20 h-20 bg-blue-700 rounded-3xl flex items-center justify-center shadow-2xl mb-6 rotate-6 animate-pulse"><Zap size={40} color="white" fill="white" /></div>
      <h1 className="text-3xl font-black mb-10 text-blue-700 italic tracking-tighter uppercase">GridStream</h1>
      <form onSubmit={handleAuth} className="w-full max-w-xs space-y-4">
        <input type="email" placeholder="EMAIL" className="w-full p-4 bg-gray-100 rounded-2xl outline-none font-bold text-sm" onChange={e => setEmail(e.target.value)} />
        <input type="password" placeholder="PASSWORD" className="w-full p-4 bg-gray-100 rounded-2xl outline-none font-bold text-sm" onChange={e => setPassword(e.target.value)} />
        <button className="w-full bg-blue-700 text-white p-4 rounded-2xl font-black shadow-xl uppercase tracking-widest text-xs">{isLogin ? 'Login' : 'Join'}</button>
      </form>
    </div>
  );
      }
