import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * 外部読み込みが必要なライブラリ:
 * - Tailwind CSS (CDN: https://cdn.tailwindcss.com)
 * - Lucide Icons (React用パッケージ)
 */
import { 
  Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, 
  User as UserIcon, Grid, List, Image as ImageIcon, Send, ChevronLeft, 
  Zap, Settings, Trash2, Moon, Sun, AlertCircle, Mail, Lock, Check, AtSign
} from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = 'dtb3jpadj'; 
const CLOUDINARY_UPLOAD_PRESET = 'alpha-sns';

export default function App() {
  // --- 状態管理 ---
  const [view, setView] = useState('home'); 
  const [posts, setPosts] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [activeProfileId, setActiveProfileId] = useState(null); 
  const [profileInfo, setProfileInfo] = useState(null); 
  const [myProfile, setMyProfile] = useState({ username: '', display_name: '', bio: '', avatar_url: '', header_url: '' });
  const [stats, setStats] = useState({ followers: 0, following: 0, isFollowing: false });
  const [profileTab, setProfileTab] = useState('list');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});

  const [expandedComments, setExpandedComments] = useState({});
  const [dmTarget, setDmTarget] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const headerInputRef = useRef(null);

  // --- 認証 & 初期ロード ---
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

  // --- アクション系 ---
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
    fetchData();
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
    if (!window.confirm("この投稿を削除しますか？")) return;
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

  if (!user) return <AuthScreen fetchData={fetchData} />;

  return (
    <div className={`max-w-md mx-auto min-h-screen pb-20 border-x font-sans relative shadow-2xl transition-colors duration-300 ${darkMode ? 'bg-black text-white border-gray-800' : 'bg-white text-black border-gray-100'}`}>
      
      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} getAvatar={getAvatar} darkMode={darkMode} />}
      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} user={user} darkMode={darkMode} setDarkMode={setDarkMode} />}

      {/* --- HOME VIEW --- */}
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
              <label className="cursor-pointer text-blue-500 hover:bg-blue-50/10 p-2 rounded-full transition">
                <ImageIcon size={22}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" />
              </label>
              <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs shadow-lg uppercase">
                {uploading ? '...' : 'Stream'}
              </button>
            </div>
          </form>

          <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
            {posts.filter(p => !p.parent_id).map(post => (
              <div key={post.id}>
                <PostCard post={post} openProfile={openProfile} getAvatar={getAvatar} onDelete={handleDeletePost} onLike={toggleLike} onToggleComments={() => setExpandedComments(prev => ({...prev, [post.id]: !prev[post.id]}))} isExpanded={expandedComments[post.id]} currentUser={user} darkMode={darkMode} />
                {expandedComments[post.id] && (
                  <CommentSection postId={post.id} allPosts={posts} currentUser={user} myProfile={myProfile} onCommentSubmit={handleCommentSubmit} getAvatar={getAvatar} darkMode={darkMode} uploading={uploading} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- PROFILE VIEW --- */}
      {view === 'profile' && profileInfo && (
        <div className="animate-in pb-10">
          <div className={`h-32 relative overflow-hidden bg-gray-200 ${!profileInfo.header_url && 'bg-gradient-to-br from-blue-700 via-indigo-600 to-cyan-500'}`}>
            <img src={profileInfo.header_url} className="w-full h-full object-cover" />
            <button onClick={() => setView('home')} className="absolute top-4 left-4 bg-black/30 backdrop-blur-md p-2 rounded-full text-white"><ChevronLeft size={20}/></button>
            {user.id === activeProfileId && <button onClick={() => setShowSettings(true)} className="absolute top-4 right-4 bg-black/30 backdrop-blur-md p-2 rounded-full text-white"><Settings size={20}/></button>}
          </div>
          <div className="px-4 relative -top-10">
            <img src={getAvatar(profileInfo.username, profileInfo.avatar_url)} className={`w-24 h-24 rounded-full border-4 shadow-xl object-cover ${darkMode ? 'border-black bg-black' : 'border-white bg-white'}`} />
            <div className="mt-4 flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-black tracking-tighter">{profileInfo.display_name}</h2>
                <p className="text-gray-400 text-sm font-bold">@{profileInfo.username}</p>
              </div>
              {user.id !== activeProfileId && (
                <button onClick={toggleFollow} className={`rounded-full px-6 py-2 text-xs font-black uppercase transition ${stats.isFollowing ? 'bg-gray-100 text-black' : 'bg-blue-600 text-white'}`}>
                  {stats.isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
            <p className="mt-3 font-medium">{profileInfo.bio || 'GridStream member.'}</p>
            <div className="flex gap-4 mt-4 text-sm font-bold">
              <span>{stats.following} <span className="text-gray-400 uppercase text-[10px]">Following</span></span>
              <span>{stats.followers} <span className="text-gray-400 uppercase text-[10px]">Followers</span></span>
            </div>
          </div>
          
          <div className={`flex border-b mt-2 sticky top-0 z-40 ${darkMode ? 'bg-black border-gray-800' : 'bg-white border-gray-100'}`}>
            <button onClick={() => setProfileTab('list')} className={`flex-grow py-4 ${profileTab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}><List className="mx-auto" size={20}/></button>
            <button onClick={() => setProfileTab('grid')} className={`flex-grow py-4 ${profileTab === 'grid' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}><Grid className="mx-auto" size={20}/></button>
          </div>
          <div className={profileTab === 'grid' ? "grid grid-cols-3 gap-[2px]" : ""}>
            {posts.filter(p => p.user_id === activeProfileId && !p.parent_id).map(post => (
              profileTab === 'grid' ? (
                post.image_url && <img key={post.id} src={post.image_url} className="aspect-square object-cover" />
              ) : (
                <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onDelete={handleDeletePost} onLike={toggleLike} onToggleComments={() => setExpandedComments(prev => ({...prev, [post.id]: !prev[post.id]}))} isExpanded={expandedComments[post.id]} currentUser={user} darkMode={darkMode} />
              )
            ))}
          </div>
        </div>
      )}

      {/* --- SEARCH / MESSAGES --- */}
      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} darkMode={darkMode} />}
      {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} setDmTarget={setDmTarget} getAvatar={getAvatar} darkMode={darkMode} />}

      {/* --- GLOBAL NAV --- */}
      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 ${darkMode ? 'bg-black/95 border-gray-800 text-gray-600' : 'bg-white/95 border-gray-100 text-gray-300'}`}>
        <HomeIcon onClick={() => setView('home')} className={`cursor-pointer ${view === 'home' ? 'text-blue-600' : ''}`} />
        <Search onClick={() => setView('search')} className={`cursor-pointer ${view === 'search' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <MessageCircle onClick={() => setView('messages')} className={`cursor-pointer ${view === 'messages' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer ${view === 'profile' && activeProfileId === user.id ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
      </nav>
    </div>
  );
}

// --- サブコンポーネント群 ---

function PostCard({ post, openProfile, getAvatar, onDelete, onLike, onToggleComments, isExpanded, currentUser, darkMode }) {
  return (
    <article className={`p-4 flex gap-3 transition ${darkMode ? 'hover:bg-gray-900/50' : 'hover:bg-gray-50'}`}>
      <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer object-cover" onClick={() => openProfile(post.profiles.id)} />
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-start">
          <div className="cursor-pointer" onClick={() => openProfile(post.profiles.id)}>
            <span className="font-black text-sm block leading-tight">{post.profiles?.display_name}</span>
            <span className="text-gray-400 text-xs font-bold uppercase tracking-tighter">@{post.profiles?.username}</span>
          </div>
          {currentUser?.id === post.user_id && <button onClick={() => onDelete(post.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>}
        </div>
        <p className="text-[15px] mt-2 font-medium leading-relaxed whitespace-pre-wrap">{post.content}</p>
        {post.image_url && <img src={post.image_url} className="mt-3 rounded-2xl w-full max-h-80 object-cover border border-gray-100" />}
        <div className="flex gap-8 mt-4 text-gray-400">
          <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 ${post.is_liked ? 'text-red-500' : ''}`}>
            <Heart size={18} fill={post.is_liked ? "currentColor" : "none"} /><span className="text-xs font-black">{post.like_count || ''}</span>
          </button>
          <button onClick={onToggleComments} className={`flex items-center gap-1.5 ${isExpanded ? 'text-blue-500' : ''}`}>
            <MessageCircle size={18} /><span className="text-xs font-black">{post.reply_count || ''}</span>
          </button>
          <Share2 size={18} />
        </div>
      </div>
    </article>
  );
}

function CommentSection({ postId, allPosts, currentUser, myProfile, onCommentSubmit, getAvatar, darkMode, uploading }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const comments = allPosts.filter(p => p.parent_id === postId).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return (
    <div className={`border-b animate-in duration-200 ${darkMode ? 'bg-gray-950 border-gray-800' : 'bg-[#fcfcfc] border-gray-100'}`}>
      <div className="p-4 flex gap-3">
        <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-8 h-8 rounded-full object-cover" />
        <div className="flex-grow flex flex-col gap-2">
          <textarea className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-blue-400 h-16 resize-none shadow-sm text-black" placeholder="コメントを入力..." value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex justify-between items-center">
            <label className="cursor-pointer text-blue-500 bg-blue-50 p-1.5 rounded-lg"><ImageIcon size={18}/><input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} /></label>
            <button onClick={() => { onCommentSubmit(postId, text, file); setText(''); setFile(null); }} disabled={uploading || (!text.trim() && !file)} className="bg-blue-600 text-white px-5 py-1.5 rounded-lg font-black text-xs">送信</button>
          </div>
          {file && <p className="text-[10px] text-blue-500 font-bold italic">✓ Image selected</p>}
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {comments.map((c, i) => (
          <div key={c.id} className="p-4 flex gap-3 hover:bg-white/5 transition">
            <span className="text-blue-300 font-bold text-[10px] pt-1">{i + 1}</span>
            <div className="flex-grow">
              <span className="text-blue-600 font-bold text-xs">@{c.profiles?.username}</span>
              <p className="text-sm mt-0.5 leading-relaxed">{c.content}</p>
              {c.image_url && <img src={c.image_url} className="mt-2 rounded-lg max-h-48 border border-gray-50 shadow-sm" />}
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
    <div className={`fixed inset-0 z-50 flex flex-col animate-in ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <header className={`p-4 border-b flex items-center gap-4 ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
        <ChevronLeft onClick={() => setDmTarget(null)} className="cursor-pointer" />
        <img src={getAvatar(target.username, target.avatar_url)} className="w-8 h-8 rounded-full object-cover" />
        <p className="font-black italic uppercase tracking-tighter">{target.display_name}</p>
      </header>
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] p-3 rounded-2xl text-sm font-medium ${m.sender_id === currentUser.id ? 'bg-blue-600 text-white rounded-tr-none' : (darkMode ? 'bg-gray-800 rounded-tl-none' : 'bg-gray-100 rounded-tl-none')}`}>{m.text}</div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <form onSubmit={sendMsg} className="p-4 border-t flex gap-2">
        <input className={`flex-grow p-3 rounded-xl outline-none text-sm ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`} placeholder="メッセージを送信..." value={text} onChange={(e) => setText(e.target.value)} />
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
      <div className={`p-4 rounded-2xl flex justify-between items-center mb-4 ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`} onClick={() => setDarkMode(!darkMode)}>
        <span className="font-bold flex items-center gap-2">{darkMode ? <Moon size={18}/> : <Sun size={18}/>} Dark Mode</span>
        <div className={`w-12 h-6 rounded-full relative transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}>
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${darkMode ? 'right-1' : 'left-1'}`} />
        </div>
      </div>
      <button onClick={() => supabase.auth.signOut()} className="w-full p-4 bg-red-50 text-red-500 rounded-2xl font-black uppercase tracking-widest text-xs mt-10">Logout</button>
    </div>
  );
}

function SearchView({ posts, openProfile, searchQuery, setSearchQuery, darkMode }) {
  return (
    <div className="p-4 animate-in">
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input className={`w-full pl-12 pr-4 py-3 rounded-2xl outline-none transition ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100'}`} placeholder="DISCOVER CONTENT" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-1">
        {posts.filter(p => p.image_url && !p.parent_id && p.content.toLowerCase().includes(searchQuery.toLowerCase())).map(p => (
          <img key={p.id} src={p.image_url} className="aspect-square object-cover cursor-pointer hover:opacity-90" onClick={() => openProfile(p.user_id)} />
        ))}
      </div>
    </div>
  );
}

function MessagesList({ allProfiles, user, setDmTarget, getAvatar, darkMode }) {
  return (
    <div className="p-4 animate-in">
      <h2 className="text-xl font-black mb-6 italic uppercase tracking-tighter">Direct Messages</h2>
      <div className="space-y-4">
        {allProfiles.filter(p => p.id !== user.id).map(u => (
          <div key={u.id} onClick={() => setDmTarget(u)} className={`flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition ${darkMode ? 'hover:bg-gray-900' : 'hover:bg-gray-50'}`}>
            <img src={getAvatar(u.username, u.avatar_url)} className="w-14 h-14 rounded-full object-cover shadow-sm" />
            <div>
              <p className="font-black text-[15px]">{u.display_name}</p>
              <p className="text-xs text-blue-500 font-bold uppercase tracking-tighter">Tap to Chat</p>
            </div>
          </div>
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
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-white text-black">
      <div className="w-20 h-20 bg-blue-700 rounded-3xl flex items-center justify-center shadow-2xl mb-6 rotate-6 animate-pulse"><Zap size={40} color="white" fill="white" /></div>
      <h1 className="text-3xl font-black mb-10 italic uppercase tracking-tighter text-blue-700">GridStream</h1>
      <form onSubmit={handleAuth} className="w-full max-w-xs space-y-4">
        <input type="email" placeholder="EMAIL" className="w-full p-4 bg-gray-100 rounded-2xl outline-none font-bold text-sm" onChange={e => setEmail(e.target.value)} />
        <input type="password" placeholder="PASSWORD" className="w-full p-4 bg-gray-100 rounded-2xl outline-none font-bold text-sm" onChange={e => setPassword(e.target.value)} />
        <button className="w-full bg-blue-700 text-white p-4 rounded-2xl font-black shadow-xl uppercase tracking-widest text-xs">{isLogin ? 'Login' : 'Join'}</button>
      </form>
      <p className="mt-6 text-xs font-black text-gray-400 cursor-pointer uppercase tracking-widest" onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? "New here? Create account" : "Have account? Login"}
      </p>
    </div>
  );
        }
