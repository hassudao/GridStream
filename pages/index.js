import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User as UserIcon, RefreshCw, Grid, List, Plus, Image as ImageIcon, Send, ChevronLeft, MapPin, Calendar } from 'lucide-react';

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
  const [profileData, setProfileData] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [profileTab, setProfileTab] = useState('grid'); 
  const [uploading, setUploading] = useState(false);
  const [dmTarget, setDmTarget] = useState(null); 
  const fileInputRef = useRef(null);

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
        setProfileData(profile);
      }
    }
  }

  async function fetchData() {
    const { data: postsData } = await supabase.from('posts').select('*, profiles(username, avatar_url)').order('created_at', { ascending: false });
    if (postsData) setPosts(postsData);
    const { data: profData } = await supabase.from('profiles').select('*');
    if (profData) setAllProfiles(profData);
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
      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        imageUrl = data.secure_url;
      } catch (err) { console.error("Upload failed", err); }
    }
    await supabase.from('posts').insert([{ content: newPost, user_id: user.id, image_url: imageUrl }]);
    setNewPost('');
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchData();
    setUploading(false);
  }

  if (!user) return <LoginScreen setUsername={setUsername} setUser={setUser} fetchData={fetchData} />;

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-20 border-x border-gray-100 font-sans text-black relative shadow-2xl">
      <script src="https://cdn.tailwindcss.com"></script>

      {/* --- DMモーダル --- */}
      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} />}

      {/* --- HOME VIEW --- */}
      {view === 'home' && (
        <div className="animate-in fade-in duration-500">
          <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-50 p-4 flex justify-between items-center">
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent italic tracking-tighter uppercase">GridStream</h1>
            <MessageCircle size={24} className="text-gray-700 cursor-pointer" onClick={() => setView('messages')} />
          </header>

          <div className="flex overflow-x-auto p-4 gap-4 no-scrollbar border-b border-gray-50 bg-white">
            {allProfiles.map((u) => (
              <div key={u.id} className="flex flex-col items-center flex-shrink-0 gap-1 cursor-pointer" onClick={() => setDmTarget(u)}>
                <div className="w-14 h-14 rounded-full border-2 border-pink-500 p-0.5"><img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} className="w-full h-full rounded-full bg-gray-50" /></div>
                <span className="text-[10px] text-gray-500 truncate w-14 text-center">{u.username}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handlePost} className="p-4 border-b border-gray-100 bg-white">
            <div className="flex gap-3">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`} className="w-10 h-10 rounded-full" />
              <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none" placeholder="今、何してる？" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-12 mt-2">
              <label className="cursor-pointer text-blue-500 p-2 rounded-full hover:bg-blue-50 transition"><ImageIcon size={22}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs shadow-lg">{uploading ? '...' : 'POST'}</button>
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
            <div className="relative flex items-center gap-2">
               <div className="relative flex-grow">
                 <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                 <input type="text" placeholder="DISCOVER" className="w-full bg-gray-100 rounded-xl py-2 pl-10 pr-4 outline-none text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
               </div>
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
          <header className="p-4 border-b border-gray-100 font-black text-lg text-center uppercase tracking-tighter">Messages</header>
          {allProfiles.filter(p => p.id !== user.id).map(u => (
            <div key={u.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer" onClick={() => setDmTarget(u)}>
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} className="w-12 h-12 rounded-full" />
              <div>
                <p className="font-bold text-sm">{u.username}</p>
                <p className="text-xs text-blue-500 font-medium italic">タップしてチャット</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- PROFILE VIEW (Hybrid) --- */}
      {view === 'profile' && (
        <div className="animate-in fade-in duration-500">
          <div className="h-32 bg-gradient-to-r from-blue-400 to-indigo-500 relative">
            {profileData?.header_url && <img src={profileData.header_url} className="w-full h-full object-cover" />}
          </div>
          <div className="px-4 relative pb-4">
            <div className="absolute -top-12 left-4">
              <div className="w-24 h-24 rounded-full border-4 border-white bg-white overflow-hidden shadow-lg">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`} className="w-full h-full" />
              </div>
            </div>
            <div className="flex justify-end py-3">
              <button className="border border-gray-300 rounded-full px-4 py-1.5 text-sm font-bold hover:bg-gray-50 transition">編集</button>
            </div>
            <div className="mt-2">
              <h2 className="text-xl font-black tracking-tight">{username}</h2>
              <p className="text-gray-500 text-sm">@{username.toLowerCase()}</p>
              <p className="mt-3 text-[15px]">GridStream Alpha Developer / SNS Innovator 🚀</p>
              <div className="flex gap-4 mt-3 text-gray-500 text-xs font-bold uppercase tracking-widest">
                <span className="flex items-center gap-1"><MapPin size={12}/> Tokyo</span>
                <span className="flex items-center gap-1"><Calendar size={12}/> Joined 2026</span>
              </div>
            </div>
          </div>
          <div className="flex border-b border-gray-100 mt-2">
            <button onClick={() => setProfileTab('grid')} className={`flex-grow py-3 flex justify-center ${profileTab === 'grid' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}><Grid size={22}/></button>
            <button onClick={() => setProfileTab('list')} className={`flex-grow py-3 flex justify-center ${profileTab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}><List size={22}/></button>
          </div>
          {profileTab === 'grid' ? (
            <div className="grid grid-cols-3 gap-[2px]">
              {posts.filter(p => p.user_id === user.id && p.image_url).map(post => (
                <div key={post.id} className="aspect-square bg-gray-100 cursor-pointer overflow-hidden" onClick={() => setSelectedPost(post)}>
                  <img src={post.image_url} className="w-full h-full object-cover" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setSelectedPost(null)}>
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative" onClick={e => e.stopPropagation()}>
             <img src={selectedPost.image_url} className="w-full aspect-square object-cover" />
             <div className="p-4"><p className="text-sm font-bold">{selectedPost.profiles?.username} <span className="font-normal ml-2">{selectedPost.content}</span></p></div>
          </div>
        </div>
      )}

      {/* --- BOTTOM NAV --- */}
      <nav className="fixed bottom-0 max-w-md w-full bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-around py-4 text-gray-400 z-40">
        <HomeIcon onClick={() => setView('home')} className={view === 'home' ? 'text-blue-600' : ''} />
        <Search onClick={() => setView('search')} className={view === 'search' ? 'text-black' : ''} />
        <MessageCircle onClick={() => setView('messages')} className={view === 'messages' ? 'text-black' : ''} />
        <UserIcon onClick={() => setView('profile')} className={view === 'profile' ? 'text-black' : ''} />
      </nav>
    </div>
  );
}

// --- SUB COMPONENTS ---

function PostCard({ post, setDmTarget }) {
  return (
    <article className="p-4 flex gap-3 animate-in slide-in-from-bottom-2">
      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.profiles?.username}`} className="w-10 h-10 rounded-full flex-shrink-0 cursor-pointer" onClick={() => setDmTarget && setDmTarget(post.profiles)} />
      <div className="flex-grow">
        <div className="flex items-center gap-1 font-bold text-sm">{post.profiles?.username}</div>
        <p className="text-sm mt-1 text-gray-800 leading-relaxed whitespace-pre-wrap">{post.content}</p>
        {post.image_url && <img src={post.image_url} className="mt-3 rounded-2xl border border-gray-100 max-h-80 w-full object-cover" />}
        <div className="flex gap-6 mt-4 text-gray-400"><Heart size={18}/><MessageCircle size={18}/><Share2 size={18}/></div>
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
    <div className="fixed inset-0 z-50 bg-[#f0f2f5] flex flex-col animate-in slide-in-from-bottom duration-300">
      <header className="bg-white p-4 flex items-center gap-3 border-b border-gray-100 shadow-sm">
        <ChevronLeft className="cursor-pointer" onClick={() => setDmTarget(null)} />
        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${target.username}`} className="w-10 h-10 rounded-full bg-gray-100 shadow-sm" />
        <span className="font-bold text-sm tracking-tight">{target.username}</span>
      </header>
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] p-3 rounded-2xl text-sm shadow-sm ${m.sender_id === currentUser.id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}>{m.text}</div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <form onSubmit={sendMsg} className="p-4 bg-white border-t border-gray-100 flex gap-2">
        <input type="text" className="flex-grow bg-gray-100 p-4 rounded-full text-sm outline-none" placeholder="メッセージを入力..." value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="bg-blue-600 text-white p-4 rounded-full shadow-lg active:scale-90 transition"><Send size={18}/></button>
      </form>
    </div>
  );
}

function LoginScreen({ setUsername, setUser, fetchData }) {
  const [input, setInput] = useState('');
  const handleSignUp = async () => {
    if (!input.trim()) return;
    const { data } = await supabase.auth.signInAnonymously();
    if (data?.user) {
      await supabase.from('profiles').upsert([{ id: data.user.id, username: input, display_name: input }]);
      setUser(data.user);
      setUsername(input);
      fetchData();
    }
  };
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-white text-black text-center">
      <h1 className="text-5xl font-black mb-12 text-blue-600 italic tracking-tighter uppercase">GridStream</h1>
      <input type="text" className="w-full max-w-xs bg-gray-50 p-5 rounded-2xl mb-4 outline-none text-lg font-bold shadow-inner" placeholder="USERNAME" value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={handleSignUp} className="w-full max-w-xs bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-blue-700 transition active:scale-95">ENTER ALPHA</button>
    </div>
  );
  }
