import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User as UserIcon, RefreshCw, Grid, List, Image as ImageIcon, Send, ChevronLeft, MapPin, Calendar, MoreHorizontal, Check, AtSign, Zap, LogOut, Mail, Lock } from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = 'dtb3jpadj'; 
const CLOUDINARY_UPLOAD_PRESET = 'alpha-sns';

export default function App() {
  const [view, setView] = useState('home'); 
  const [posts, setPosts] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState(null);
  
  const [username, setUsername] = useState(''); 
  const [displayName, setDisplayName] = useState(''); 
  const [profileData, setProfileData] = useState({ bio: '', header_url: '', avatar_url: '' });
  
  const [selectedPost, setSelectedPost] = useState(null);
  const [profileTab, setProfileTab] = useState('grid'); 
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [dmTarget, setDmTarget] = useState(null); 
  const fileInputRef = useRef(null);

  useEffect(() => {
    checkUser();
    fetchData();

    // ログイン状態の変化を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      loadUserProfile(session.user.id);
    }
  }

  async function loadUserProfile(userId) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profile) {
      setUsername(profile.username);
      setDisplayName(profile.display_name || profile.username);
      setProfileData({
        bio: profile.bio || '',
        header_url: profile.header_url || '',
        avatar_url: profile.avatar_url || ''
      });
    }
  }

  async function fetchData() {
    const { data: postsData } = await supabase.from('posts').select('*, profiles(username, display_name, avatar_url)').order('created_at', { ascending: false });
    if (postsData) setPosts(postsData);
    const { data: profData } = await supabase.from('profiles').select('*');
    if (profData) setAllProfiles(profData);
  }

  // ログアウト処理
  async function handleLogout() {
    if (confirm("Logout from GridStream?")) {
      await supabase.auth.signOut();
      setUser(null);
      setView('home');
    }
  }

  // --- プロフィール更新 ---
  async function handleUpdateProfile() {
    if (!username.trim() || !displayName.trim()) return alert("Required fields missing");
    setUploading(true);
    const updates = {
      id: user.id,
      username: username.replace(/\s+/g, '').toLowerCase(), 
      display_name: displayName,
      bio: profileData.bio,
      header_url: profileData.header_url,
      avatar_url: profileData.avatar_url,
      updated_at: new Date(),
    };
    const { error } = await supabase.from('profiles').upsert(updates);
    if (error) alert(error.message);
    else { setIsEditing(false); fetchData(); }
    setUploading(false);
  }

  async function uploadToCloudinary(file, type) {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (type === 'header') setProfileData(prev => ({ ...prev, header_url: data.secure_url }));
      if (type === 'avatar') setProfileData(prev => ({ ...prev, avatar_url: data.secure_url }));
    } catch (err) { alert("Upload failed"); }
    setUploading(false);
  }

  async function handlePost(e) {
    e.preventDefault();
    if (!newPost.trim() || !user) return;
    setUploading(true);
    let imageUrl = null;
    if (fileInputRef.current?.files[0]) {
      const formData = new FormData();
      formData.append('file', fileInputRef.current.files[0]);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      imageUrl = data.secure_url;
    }
    await supabase.from('posts').insert([{ content: newPost, user_id: user.id, image_url: imageUrl }]);
    setNewPost('');
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchData();
    setUploading(false);
  }

  const getAvatar = (name, url) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;

  if (!user) return <AuthScreen fetchData={fetchData} />;

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-20 border-x border-gray-100 font-sans text-black relative shadow-2xl overflow-x-hidden">
      <script src="https://cdn.tailwindcss.com"></script>

      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} getAvatar={getAvatar} />}

      {/* --- HOME VIEW --- */}
      {view === 'home' && (
        <div className="animate-in fade-in">
          <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-50 p-4 flex justify-between items-center">
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 via-indigo-600 to-cyan-500 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1">
              <Zap size={24} className="text-blue-600 fill-blue-600" /> GridStream
            </h1>
            <MessageCircle size={24} className="text-gray-700 cursor-pointer" onClick={() => setView('messages')} />
          </header>
          
          <div className="flex overflow-x-auto p-4 gap-4 no-scrollbar border-b border-gray-50 bg-white">
            {allProfiles.map((u) => (
              <div key={u.id} className="flex flex-col items-center flex-shrink-0 gap-1 cursor-pointer" onClick={() => setDmTarget(u)}>
                <div className="w-16 h-16 rounded-full border-2 border-cyan-500 p-0.5 shadow-sm">
                  <img src={getAvatar(u.username, u.avatar_url)} className="w-full h-full rounded-full bg-gray-50 object-cover" />
                </div>
                <span className="text-[10px] text-gray-500 truncate w-16 text-center">{u.display_name || u.username}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handlePost} className="p-4 border-b border-gray-100 bg-white">
            <div className="flex gap-3">
              <img src={getAvatar(username, profileData.avatar_url)} className="w-10 h-10 rounded-full shadow-sm" />
              <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none bg-transparent" placeholder="今、何を考えてる？" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-12 mt-2">
              <label className="cursor-pointer text-blue-500 hover:bg-blue-50 p-2 rounded-full transition"><ImageIcon size={22}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
              <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs shadow-lg shadow-blue-100 uppercase tracking-tighter">Stream</button>
            </div>
          </form>

          <div className="divide-y divide-gray-100">
            {posts.map(post => <PostCard key={post.id} post={post} setDmTarget={setDmTarget} getAvatar={getAvatar} />)}
          </div>
        </div>
      )}

      {/* --- PROFILE VIEW --- */}
      {view === 'profile' && (
        <div className="animate-in fade-in pb-10">
          <div className={`h-32 relative shadow-inner overflow-hidden ${!profileData.header_url && 'bg-gradient-to-br from-blue-700 via-indigo-600 to-cyan-500'}`}>
            {profileData.header_url && <img src={profileData.header_url} className="w-full h-full object-cover" />}
            {isEditing && (
              <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer">
                <Camera size={24} className="text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadToCloudinary(e.target.files[0], 'header')} />
              </label>
            )}
            <button onClick={handleLogout} className="absolute top-4 right-4 bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-red-500 transition shadow-lg">
              <LogOut size={20} />
            </button>
          </div>
          
          <div className="px-4 relative">
            <div className="absolute -top-12 left-4">
              <div className="w-24 h-24 rounded-full border-4 border-white bg-white overflow-hidden shadow-2xl relative">
                <img src={getAvatar(username, profileData.avatar_url)} className="w-full h-full object-cover" />
                {isEditing && (
                  <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer">
                    <Camera size={20} className="text-white" />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadToCloudinary(e.target.files[0], 'avatar')} />
                  </label>
                )}
              </div>
            </div>
            
            <div className="flex justify-end py-3 gap-2">
              {isEditing ? (
                <>
                  <button onClick={() => setIsEditing(false)} className="border border-gray-200 rounded-full px-5 py-1.5 text-xs font-black tracking-tighter">CANCEL</button>
                  <button onClick={handleUpdateProfile} className="bg-blue-600 text-white rounded-full px-5 py-1.5 text-xs font-black shadow-lg flex items-center gap-1 uppercase tracking-tighter"><Check size={14}/> SAVE</button>
                </>
              ) : (
                <button onClick={() => setIsEditing(true)} className="border border-gray-200 rounded-full px-5 py-1.5 text-xs font-black tracking-tight uppercase">Edit Profile</button>
              )}
            </div>

            <div className="mt-2 space-y-3">
              {isEditing ? (
                <div className="space-y-3 pt-2 animate-in slide-in-from-top duration-300">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Display Name</label>
                    <input className="w-full bg-gray-50 p-3 rounded-xl text-sm font-black border border-gray-100 outline-none focus:ring-2 focus:ring-blue-100" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Username (@ID)</label>
                    <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100 focus-within:ring-2 focus-within:ring-blue-100">
                      <AtSign size={14} className="text-gray-400" />
                      <input className="bg-transparent w-full text-sm font-bold outline-none" value={username} onChange={(e) => setUsername(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Bio</label>
                    <textarea className="w-full bg-gray-50 p-3 rounded-xl text-sm font-medium border border-gray-100 outline-none" value={profileData.bio} onChange={(e) => setProfileData({...profileData, bio: e.target.value})} rows={3} />
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-black tracking-tighter">{displayName}</h2>
                  <p className="text-gray-400 text-sm font-bold flex items-center gap-0.5">@{username.toLowerCase()}</p>
                  <p className="text-[15px] leading-relaxed font-medium mt-3 whitespace-pre-wrap">{profileData.bio || 'GridStream Alpha Member 🚀'}</p>
                </div>
              )}
              
              <div className="flex flex-wrap gap-y-1 gap-x-4 text-gray-500 text-[13px] font-bold">
                <span className="flex items-center gap-1"><MapPin size={14}/> Nishio, Japan</span>
                <span className="flex items-center gap-1"><Calendar size={14}/> Joined January 2026</span>
              </div>
            </div>
          </div>

          <div className="flex border-b border-gray-100 mt-6 sticky top-0 bg-white/95 z-40">
            <button onClick={() => setProfileTab('grid')} className={`flex-grow py-4 flex justify-center transition-all ${profileTab === 'grid' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-300'}`}><Grid size={22}/></button>
            <button onClick={() => setProfileTab('list')} className={`flex-grow py-4 flex justify-center transition-all ${profileTab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-300'}`}><List size={22}/></button>
          </div>

          {profileTab === 'grid' ? (
            <div className="grid grid-cols-3 gap-[2px]">
              {posts.filter(p => p.user_id === user.id && p.image_url).map(post => (
                <div key={post.id} className="aspect-square bg-gray-50 cursor-pointer overflow-hidden relative group" onClick={() => setSelectedPost(post)}>
                  <img src={post.image_url} className="w-full h-full object-cover transition group-hover:brightness-75" />
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {posts.filter(p => p.user_id === user.id).map(post => <PostCard key={post.id} post={post} getAvatar={getAvatar} />)}
            </div>
          )}
        </div>
      )}

      {/* --- SEARCH / MESSAGES --- */}
      {view === 'search' && <SearchView posts={posts} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSelectedPost={setSelectedPost} />}
      {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} setDmTarget={setDmTarget} getAvatar={getAvatar} />}

      {/* 詳細ポップアップ */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setSelectedPost(null)}>
          <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl relative" onClick={e => e.stopPropagation()}>
             <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={getAvatar(selectedPost.profiles?.username, selectedPost.profiles?.avatar_url)} className="w-8 h-8 rounded-full" />
                  <span className="font-black text-xs">{selectedPost.profiles?.display_name || selectedPost.profiles?.username}</span>
                </div>
                <X size={20} className="text-gray-400 cursor-pointer" onClick={() => setSelectedPost(null)} />
             </div>
             <img src={selectedPost.image_url} className="w-full aspect-square object-cover" />
             <div className="p-5">
               <div className="flex gap-4 mb-4"><Heart size={24} /><MessageCircle size={24} /><Send size={24} /></div>
               <p className="text-sm font-bold text-blue-600">{selectedPost.profiles?.display_name}</p>
               <p className="text-sm mt-1">{selectedPost.content}</p>
             </div>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 max-w-md w-full bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-around py-4 text-gray-300 z-40">
        <HomeIcon onClick={() => {setView('home'); setIsEditing(false);}} className={view === 'home' ? 'text-blue-600 scale-110' : ''} />
        <Search onClick={() => {setView('search'); setIsEditing(false);}} className={view === 'search' ? 'text-black scale-110' : ''} />
        <MessageCircle onClick={() => {setView('messages'); setIsEditing(false);}} className={view === 'messages' ? 'text-black scale-110' : ''} />
        <UserIcon onClick={() => {setView('profile'); setIsEditing(false);}} className={view === 'profile' ? 'text-black scale-110' : ''} />
      </nav>
    </div>
  );
}

// サブコンポーネント
function AuthScreen({ fetchData }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAuth(e) {
    e.preventDefault();
    setLoading(true);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) alert(error.message);
      else if (data?.user) {
        const initialId = displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000);
        await supabase.from('profiles').upsert([{ id: data.user.id, username: initialId, display_name: displayName }]);
        alert("Account created! Welcome to GridStream.");
      }
    }
    setLoading(false);
    fetchData();
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-white">
      <script src="https://cdn.tailwindcss.com"></script>
      <div className="w-20 h-20 bg-gradient-to-tr from-blue-700 via-indigo-600 to-cyan-500 rounded-[2rem] flex items-center justify-center shadow-2xl mb-6 rotate-6 animate-bounce">
        <Zap size={40} color="white" fill="white" />
      </div>
      <h1 className="text-4xl font-black mb-2 text-blue-700 italic tracking-tighter uppercase">GridStream</h1>
      <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.3em] mb-10">Authentication</p>
      
      <form onSubmit={handleAuth} className="w-full max-w-xs space-y-4 animate-in fade-in zoom-in-95 duration-500">
        {!isLogin && (
          <div className="relative">
            <UserIcon className="absolute left-4 top-4 text-gray-400" size={18} />
            <input type="text" placeholder="DISPLAY NAME" className="w-full bg-gray-50 p-4 pl-12 rounded-2xl outline-none font-bold text-sm shadow-inner" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>
        )}
        <div className="relative">
          <Mail className="absolute left-4 top-4 text-gray-400" size={18} />
          <input type="email" placeholder="EMAIL ADDRESS" className="w-full bg-gray-50 p-4 pl-12 rounded-2xl outline-none font-bold text-sm shadow-inner" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="relative">
          <Lock className="absolute left-4 top-4 text-gray-400" size={18} />
          <input type="password" placeholder="PASSWORD" className="w-full bg-gray-50 p-4 pl-12 rounded-2xl outline-none font-bold text-sm shadow-inner" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-blue-700 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-blue-800 active:scale-95 transition-all text-sm uppercase tracking-widest">
          {loading ? 'Processing...' : (isLogin ? 'Login' : 'Join Stream')}
        </button>
      </form>
      
      <button onClick={() => setIsLogin(!isLogin)} className="mt-8 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-blue-600 transition">
        {isLogin ? "Need an account? Sign Up" : "Already have an account? Login"}
      </button>
    </div>
  );
}

// 共通パーツ
function PostCard({ post, setDmTarget, getAvatar }) {
  return (
    <article className="p-4 flex gap-3 hover:bg-gray-50 transition duration-200">
      <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer shadow-sm border border-gray-50 flex-shrink-0" onClick={() => setDmTarget && setDmTarget(post.profiles)} />
      <div className="flex-grow min-w-0">
        <div className="flex items-center gap-1 overflow-hidden">
          <span className="font-black text-sm truncate">{post.profiles?.display_name || post.profiles?.username}</span>
          <span className="text-gray-400 text-[11px] font-bold truncate">@{post.profiles?.username}</span>
        </div>
        <p className="text-sm mt-1 text-gray-800 font-medium leading-relaxed">{post.content}</p>
        {post.image_url && <img src={post.image_url} className="mt-3 rounded-2xl border border-gray-100 max-h-96 w-full object-cover shadow-sm" />}
        <div className="flex justify-between mt-4 text-gray-400 max-w-[240px]"><Heart size={18}/><MessageCircle size={18}/><Share2 size={18}/></div>
      </div>
    </article>
  );
}

function SearchView({ posts, searchQuery, setSearchQuery, setSelectedPost }) {
  return (
    <div className="animate-in fade-in">
      <div className="p-4 sticky top-0 bg-white/95 z-10 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input type="text" placeholder="DISCOVER IN STREAM" className="w-full bg-gray-100 rounded-xl py-2 pl-10 pr-4 outline-none text-xs font-bold" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-[2px]">
        {posts.filter(p => p.image_url && (p.content.includes(searchQuery) || p.profiles?.username.includes(searchQuery) || p.profiles?.display_name.includes(searchQuery))).map((post) => (
          <div key={post.id} className="aspect-square bg-gray-100 overflow-hidden cursor-pointer" onClick={() => setSelectedPost(post)}>
            <img src={post.image_url} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}

function MessagesList({ allProfiles, user, setDmTarget, getAvatar }) {
  return (
    <div className="animate-in fade-in">
      <header className="p-4 border-b border-gray-100 font-black text-lg text-center tracking-tighter uppercase sticky top-0 bg-white/95 z-10">Stream Chat</header>
      <div className="p-2">
        {allProfiles.filter(p => p.id !== user.id).map(u => (
          <div key={u.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-2xl cursor-pointer transition" onClick={() => setDmTarget(u)}>
            <img src={getAvatar(u.username, u.avatar_url)} className="w-14 h-14 rounded-full bg-gray-100 shadow-sm" />
            <div className="flex-grow border-b border-gray-50 pb-2">
              <p className="font-bold text-sm">{u.display_name || u.username} <span className="text-gray-400 font-bold text-xs">@{u.username}</span></p>
              <p className="text-xs text-blue-500 font-medium italic mt-1 uppercase tracking-tighter">Start Conversation</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DMScreen({ target, setDmTarget, currentUser, getAvatar }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const scrollRef = useRef();

  useEffect(() => {
    fetchMessages();
    const channel = supabase.channel(`chat:${target.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const nm = payload.new;
        if ((nm.sender_id === currentUser.id && nm.receiver_id === target.id) || (nm.sender_id === target.id && nm.receiver_id === currentUser.id)) {
          setMessages(prev => [...prev, nm]);
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [target]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function fetchMessages() {
    const { data } = await supabase.from('profiles').select('id').eq('id', target.id).single();
    if (!data) return;
    const { data: msgs } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
    if (msgs) setMessages(msgs);
  }

  async function sendMsg(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const t = text; setText('');
    await supabase.from('messages').insert([{ text: t, sender_id: currentUser.id, receiver_id: target.id }]);
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#f8f9fa] flex flex-col animate-in slide-in-from-right duration-300">
      <header className="bg-white p-4 flex items-center gap-3 border-b border-gray-100 shadow-sm sticky top-0">
        <ChevronLeft onClick={() => setDmTarget(null)} className="cursor-pointer" />
        <img src={getAvatar(target.username, target.avatar_url)} className="w-10 h-10 rounded-full" />
        <div className="flex flex-col">
          <span className="font-black text-sm leading-tight">{target.display_name || target.username}</span>
          <span className="text-[10px] text-gray-400 font-bold">@{target.username}</span>
        </div>
      </header>
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3.5 rounded-[1.25rem] text-[14px] shadow-sm ${m.sender_id === currentUser.id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}>{m.text}</div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <form onSubmit={sendMsg} className="p-4 bg-white border-t border-gray-100 flex gap-2">
        <input type="text" className="flex-grow bg-gray-50 p-4 rounded-2xl text-sm outline-none border border-gray-100" placeholder="メッセージを入力..." value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg active:scale-90 transition"><Send size={18}/></button>
      </form>
    </div>
  );
        }
