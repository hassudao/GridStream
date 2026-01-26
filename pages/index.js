import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User as UserIcon, RefreshCw, Grid, List, Plus, Image as ImageIcon, Send, ChevronLeft, MapPin, Calendar, MoreHorizontal, Check } from 'lucide-react';

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
  const [profileData, setProfileData] = useState({ bio: '', header_url: '' });
  const [selectedPost, setSelectedPost] = useState(null);
  const [profileTab, setProfileTab] = useState('grid'); 
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [dmTarget, setDmTarget] = useState(null); 
  const fileInputRef = useRef(null);
  const headerInputRef = useRef(null);

  useEffect(() => {
    checkUser();
    fetchData();
  }, []);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (profile) {
        setUsername(profile.username);
        setProfileData({
          bio: profile.bio || '',
          header_url: profile.header_url || ''
        });
      }
    }
  }

  async function fetchData() {
    const { data: postsData } = await supabase.from('posts').select('*, profiles(username, avatar_url)').order('created_at', { ascending: false });
    if (postsData) setPosts(postsData);
    const { data: profData } = await supabase.from('profiles').select('*');
    if (profData) setAllProfiles(profData);
  }

  // --- プロフィール更新処理 ---
  async function handleUpdateProfile() {
    setUploading(true);
    const updates = {
      id: user.id,
      bio: profileData.bio,
      header_url: profileData.header_url,
      updated_at: new Date(),
    };

    const { error } = await supabase.from('profiles').upsert(updates);
    if (error) alert(error.message);
    setIsEditing(false);
    setUploading(false);
    fetchData();
  }

  // --- ヘッダー画像のアップロード ---
  async function handleHeaderUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      setProfileData({ ...profileData, header_url: data.secure_url });
    } catch (err) {
      alert("Header upload failed");
    }
    setUploading(false);
  }

  async function handlePost(e) {
    e.preventDefault();
    if (!newPost.trim() || !user) return;
    setUploading(true);
    let imageUrl = null;
    const file = fileInputRef.current?.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
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

  if (!user) return <LoginScreen setUsername={setUsername} setUser={setUser} fetchData={fetchData} />;

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-20 border-x border-gray-100 font-sans text-black relative shadow-2xl overflow-x-hidden">
      <script src="https://cdn.tailwindcss.com"></script>

      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} />}

      {/* --- HOME VIEW --- */}
      {view === 'home' && (
        <div className="animate-in fade-in duration-500">
          <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-50 p-4 flex justify-between items-center">
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent italic tracking-tighter uppercase">Beta</h1>
            <MessageCircle size={24} className="text-gray-700 cursor-pointer" onClick={() => setView('messages')} />
          </header>
          <div className="flex overflow-x-auto p-4 gap-4 no-scrollbar border-b border-gray-50 bg-white">
            {allProfiles.map((u) => (
              <div key={u.id} className="flex flex-col items-center flex-shrink-0 gap-1 cursor-pointer" onClick={() => setDmTarget(u)}>
                <div className="w-16 h-16 rounded-full border-2 border-pink-500 p-0.5 shadow-sm">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} className="w-full h-full rounded-full bg-gray-50 object-cover" />
                </div>
                <span className="text-[10px] text-gray-500 truncate w-16 text-center">{u.username}</span>
              </div>
            ))}
          </div>
          <form onSubmit={handlePost} className="p-4 border-b border-gray-100 bg-white">
            <div className="flex gap-3">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`} className="w-10 h-10 rounded-full bg-gray-100 shadow-sm" />
              <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none bg-transparent" placeholder="今、何してる？" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-12 mt-2">
              <label className="cursor-pointer text-blue-500 hover:bg-blue-50 p-2 rounded-full transition"><ImageIcon size={22}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
              <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs shadow-lg">{uploading ? '...' : 'POST'}</button>
            </div>
          </form>
          <div className="divide-y divide-gray-100">
            {posts.map(post => <PostCard key={post.id} post={post} setDmTarget={setDmTarget} />)}
          </div>
        </div>
      )}

      {/* --- SEARCH VIEW --- */}
      {view === 'search' && (
        <div className="animate-in fade-in">
          <div className="p-4 sticky top-0 bg-white/95 backdrop-blur-md z-10 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              <input type="text" placeholder="DISCOVER" className="w-full bg-gray-100 rounded-xl py-2 pl-10 pr-4 outline-none text-xs font-bold" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-[2px]">
            {posts.filter(p => p.image_url && (p.content.includes(searchQuery) || p.profiles?.username.includes(searchQuery))).map((post) => (
              <div key={post.id} className="aspect-square bg-gray-100 overflow-hidden cursor-pointer hover:opacity-80 transition" onClick={() => setSelectedPost(post)}>
                <img src={post.image_url} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- MESSAGES VIEW --- */}
      {view === 'messages' && (
        <div className="animate-in fade-in">
          <header className="p-4 border-b border-gray-100 font-black text-lg text-center tracking-tighter uppercase sticky top-0 bg-white/95 z-10">Messages</header>
          <div className="p-2">
            {allProfiles.filter(p => p.id !== user.id).map(u => (
              <div key={u.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-2xl cursor-pointer transition" onClick={() => setDmTarget(u)}>
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} className="w-14 h-14 rounded-full bg-gray-100 shadow-sm" />
                <div className="flex-grow border-b border-gray-50 pb-2">
                  <p className="font-bold text-sm tracking-tight">{u.username}</p>
                  <p className="text-xs text-blue-500 font-medium mt-1 italic">タップしてチャット</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- PROFILE VIEW (Edit Mode Integrated) --- */}
      {view === 'profile' && (
        <div className="animate-in fade-in duration-500 pb-10">
          {/* ヘッダー */}
          <div className={`h-32 relative shadow-inner overflow-hidden ${!profileData.header_url && 'bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700'}`}>
            {profileData.header_url && <img src={profileData.header_url} className="w-full h-full object-cover" />}
            {isEditing && (
              <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer group">
                <Camera size={32} className="text-white opacity-75 group-hover:scale-110 transition" />
                <input type="file" accept="image/*" className="hidden" onChange={handleHeaderUpload} />
              </label>
            )}
            {uploading && <div className="absolute inset-0 bg-black/20 flex items-center justify-center"><RefreshCw className="animate-spin text-white" /></div>}
          </div>
          
          <div className="px-4 relative">
            <div className="absolute -top-12 left-4">
              <div className="w-24 h-24 rounded-full border-4 border-white bg-white overflow-hidden shadow-2xl">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`} className="w-full h-full object-cover" />
              </div>
            </div>
            
            <div className="flex justify-end py-3 gap-2">
              {isEditing ? (
                <>
                  <button onClick={() => setIsEditing(false)} className="border border-gray-200 rounded-full px-5 py-1.5 text-xs font-black hover:bg-gray-50 transition">CANCEL</button>
                  <button onClick={handleUpdateProfile} className="bg-blue-600 text-white rounded-full px-5 py-1.5 text-xs font-black shadow-lg shadow-blue-100 flex items-center gap-1"><Check size={14}/> SAVE</button>
                </>
              ) : (
                <button onClick={() => setIsEditing(true)} className="border border-gray-200 rounded-full px-5 py-1.5 text-xs font-black hover:bg-gray-50 transition tracking-tight">EDIT PROFILE</button>
              )}
            </div>

            <div className="mt-2 space-y-3">
              <div>
                <h2 className="text-2xl font-black tracking-tighter">{username}</h2>
                <p className="text-gray-500 text-sm font-medium">@{username.toLowerCase()}</p>
              </div>
              
              {isEditing ? (
                <textarea 
                  className="w-full bg-gray-50 p-3 rounded-xl text-sm font-medium border border-gray-100 outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="自己紹介を書いてみよう"
                  value={profileData.bio}
                  onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                  rows={3}
                />
              ) : (
                <p className="text-[15px] leading-relaxed font-medium">{profileData.bio || 'GridStream Alpha Member 🚀'}</p>
              )}
              
              <div className="flex flex-wrap gap-y-1 gap-x-4 text-gray-500 text-[13px] font-bold">
                <span className="flex items-center gap-1"><MapPin size={14}/> Nishio, Japan</span>
                <span className="flex items-center gap-1"><Calendar size={14}/> Joined January 2026</span>
              </div>
            </div>
          </div>

          <div className="flex border-b border-gray-100 mt-6 sticky top-0 bg-white/95 z-10">
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
              {posts.filter(p => p.user_id === user.id).map(post => <PostCard key={post.id} post={post} />)}
            </div>
          )}
        </div>
      )}

      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setSelectedPost(null)}>
          <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl relative" onClick={e => e.stopPropagation()}>
             <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedPost.profiles?.username}`} className="w-8 h-8 rounded-full" />
                  <span className="font-black text-xs">{selectedPost.profiles?.username}</span>
                </div>
                <X size={20} onClick={() => setSelectedPost(null)} />
             </div>
             <img src={selectedPost.image_url} className="w-full aspect-square object-cover" />
             <div className="p-5">
               <div className="flex gap-4 mb-4"><Heart size={24} /><MessageCircle size={24} /><Send size={24} /></div>
               <p className="text-sm"><span className="font-black mr-2">{selectedPost.profiles?.username}</span>{selectedPost.content}</p>
             </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 max-w-md w-full bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-around py-4 text-gray-300 z-40 shadow-xl">
        <HomeIcon onClick={() => {setView('home'); setIsEditing(false);}} className={view === 'home' ? 'text-blue-600 scale-110' : ''} />
        <Search onClick={() => {setView('search'); setIsEditing(false);}} className={view === 'search' ? 'text-black scale-110' : ''} />
        <MessageCircle onClick={() => {setView('messages'); setIsEditing(false);}} className={view === 'messages' ? 'text-black scale-110' : ''} />
        <UserIcon onClick={() => {setView('profile'); setIsEditing(false);}} className={view === 'profile' ? 'text-black scale-110' : ''} />
      </nav>
    </div>
  );
}

function PostCard({ post, setDmTarget }) {
  return (
    <article className="p-4 flex gap-3">
      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.profiles?.username}`} className="w-11 h-11 rounded-full cursor-pointer shadow-sm border border-gray-50" onClick={() => setDmTarget && setDmTarget(post.profiles)} />
      <div className="flex-grow">
        <div className="flex items-center gap-1"><span className="font-black text-sm">{post.profiles?.username}</span><span className="text-gray-400 text-[10px] uppercase font-bold">· {new Date(post.created_at).toLocaleDateString()}</span></div>
        <p className="text-sm mt-1 text-gray-800 leading-relaxed font-medium">{post.content}</p>
        {post.image_url && <img src={post.image_url} className="mt-3 rounded-2xl border border-gray-100 max-h-96 w-full object-cover" />}
        <div className="flex justify-between mt-4 text-gray-400 max-w-[240px]"><div className="flex items-center gap-1.5"><Heart size={18} /><span className="text-[11px] font-bold">12</span></div><div className="flex items-center gap-1.5"><MessageCircle size={18} /><span className="text-[11px] font-bold">4</span></div><Share2 size={18} /></div>
      </div>
    </article>
  );
}

function DMScreen({ target, setDmTarget, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const scrollRef = useRef();

  useEffect(() => {
    fetchMessages();
    const channel = supabase.channel(`chat:${target.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const nm = payload.new;
        if ((nm.sender_id === currentUser.id && nm.receiver_id === target.id) || (nm.sender_id === target.id && nm.receiver_id === currentUser.id)) {
          setMessages(prev => [...prev, nm]);
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [target]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function fetchMessages() {
    const { data } = await supabase.from('messages').select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  }

  async function sendMsg(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const t = text; setText('');
    await supabase.from('messages').insert([{ text: t, sender_id: currentUser.id, receiver_id: target.id }]);
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#f8f9fa] flex flex-col animate-in slide-in-from-right">
      <header className="bg-white p-4 flex items-center gap-3 border-b border-gray-100 shadow-sm sticky top-0">
        <ChevronLeft onClick={() => setDmTarget(null)} />
        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${target.username}`} className="w-10 h-10 rounded-full" />
        <span className="font-black text-sm">{target.username}</span>
      </header>
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3.5 rounded-[1.25rem] text-[14px] shadow-sm ${m.sender_id === currentUser.id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}>{m.text}</div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <form onSubmit={sendMsg} className="p-4 bg-white border-t border-gray-50 flex gap-2">
        <input type="text" className="flex-grow bg-gray-50 p-4 rounded-2xl text-sm outline-none border border-gray-100" placeholder="メッセージを入力..." value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg active:scale-90 transition"><Send size={18}/></button>
      </form>
    </div>
  );
}

function LoginScreen({ setUsername, setUser, fetchData }) {
  const [name, setName] = useState('');
  const handleSignUp = async () => {
    if (!name.trim()) return;
    const { data } = await supabase.auth.signInAnonymously();
    if (data?.user) {
      await supabase.from('profiles').upsert([{ id: data.user.id, username: name, display_name: name }]);
      setUser(data.user);
      setUsername(name);
      fetchData();
    }
  };
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-white text-center animate-in zoom-in-95">
      <script src="https://cdn.tailwindcss.com"></script>
      <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-indigo-700 rounded-[2.5rem] flex items-center justify-center shadow-2xl mb-8 rotate-6 animate-pulse">
        <Grid size={48} color="white" />
      </div>
      <h1 className="text-6xl font-black mb-4 text-blue-600 italic tracking-tighter uppercase">Beta</h1>
      <input type="text" className="w-full max-w-xs bg-gray-50 p-6 rounded-2xl mb-4 outline-none text-lg font-black text-center" placeholder="USERNAME" value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={handleSignUp} className="w-full max-w-xs bg-blue-600 text-white font-black py-6 rounded-2xl shadow-2xl hover:bg-blue-700 active:scale-95 uppercase tracking-widest text-sm">Enter the Grid</button>
    </div>
  );
        }
