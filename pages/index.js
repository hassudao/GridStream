import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User as UserIcon, RefreshCw, Grid, List, Plus, Image as ImageIcon, Send, ChevronLeft } from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = 'dtb3jpadj'; 
const CLOUDINARY_UPLOAD_PRESET = 'alpha-sns';

export default function App() {
  const [view, setView] = useState('home'); 
  const [posts, setPosts] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dmTarget, setDmTarget] = useState(null); // DM相手のプロフィール
  const fileInputRef = useRef(null);

  useEffect(() => {
    checkUser();
    fetchData();
  }, []);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      const { data: profile } = await supabase.from('profiles').select('username').eq('id', session.user.id).single();
      if (profile) setUsername(profile.username);
    }
  }

  async function fetchData() {
    setLoading(true);
    const { data: postsData } = await supabase.from('posts').select('*, profiles(username, avatar_url)').order('created_at', { ascending: false });
    if (postsData) setPosts(postsData);
    const { data: profData } = await supabase.from('profiles').select('*');
    if (profData) setAllProfiles(profData);
    setLoading(false);
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
      } catch (err) { alert("Upload failed"); }
    }
    await supabase.from('posts').insert([{ content: newPost, user_id: user.id, image_url: imageUrl }]);
    setNewPost('');
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchData();
    setUploading(false);
  }

  if (!user) return <LoginScreen username={username} setUsername={setUsername} setUser={setUser} fetchData={fetchData} />;

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-20 border-x border-gray-100 font-sans text-black relative shadow-2xl overflow-x-hidden">
      <script src="https://cdn.tailwindcss.com"></script>

      {/* --- DM画面 (最優先表示) --- */}
      {dmTarget ? (
        <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} />
      ) : (
        <>
          {/* --- HOME VIEW --- */}
          {view === 'home' && (
            <div className="animate-in fade-in duration-500">
              <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-50 p-4 flex justify-between items-center">
                <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent italic tracking-tighter">GRIDSTREAM</h1>
                <div className="flex gap-4 text-gray-700">
                  <MessageCircle size={24} className="hover:text-blue-500 cursor-pointer" onClick={() => setView('search')} />
                </div>
              </header>

              {/* ストーリーバー */}
              <div className="flex overflow-x-auto p-4 gap-4 no-scrollbar border-b border-gray-50">
                {allProfiles.map((u) => (
                  <div key={u.id} className="flex flex-col items-center flex-shrink-0 gap-1 cursor-pointer" onClick={() => setDmTarget(u)}>
                    <div className="w-14 h-14 rounded-full border-2 border-pink-500 p-0.5">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} className="w-full h-full rounded-full bg-gray-50" />
                    </div>
                    <span className="text-[10px] text-gray-500 truncate w-14 text-center">{u.username}</span>
                  </div>
                ))}
              </div>

              {/* 投稿フォーム */}
              <form onSubmit={handlePost} className="p-4 border-b border-gray-100 bg-white">
                <div className="flex gap-3">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`} className="w-10 h-10 rounded-full bg-gray-100" />
                  <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none" placeholder="What's happening?" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
                </div>
                <div className="flex justify-between items-center pl-12">
                  <label className="cursor-pointer text-blue-500 p-2 rounded-full hover:bg-blue-50 transition"><ImageIcon size={20}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
                  <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-5 py-1.5 rounded-full font-bold text-sm shadow-md">{uploading ? '...' : 'POST'}</button>
                </div>
              </form>

              {/* 投稿一覧 */}
              <div className="divide-y divide-gray-100">
                {posts.map((post) => (
                  <article key={post.id} className="p-4 flex gap-3">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.profiles?.username}`} className="w-10 h-10 rounded-full flex-shrink-0" onClick={() => setDmTarget(post.profiles)} />
                    <div className="flex-grow">
                      <div className="flex items-center gap-1"><span className="font-bold text-sm">{post.profiles?.username}</span></div>
                      <p className="text-sm mt-1 text-gray-800">{post.content}</p>
                      {post.image_url && <img src={post.image_url} className="mt-3 rounded-2xl border border-gray-100 max-h-80 w-full object-cover" />}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* --- SEARCH VIEW (ユーザーを探してDM) --- */}
          {view === 'search' && (
            <div className="animate-in fade-in">
              <div className="p-4 border-b border-gray-100 font-bold text-center">DIRECT MESSAGES</div>
              <div className="p-4 space-y-4">
                {allProfiles.filter(p => p.id !== user.id).map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100" onClick={() => setDmTarget(u)}>
                    <div className="flex items-center gap-3">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} className="w-12 h-12 rounded-full bg-white" />
                      <div>
                        <p className="font-bold text-sm">{u.username}</p>
                        <p className="text-xs text-gray-400 text-blue-500 font-medium italic">タップしてチャット</p>
                      </div>
                    </div>
                    <MessageCircle size={18} className="text-gray-300" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* --- PROFILE VIEW --- */}
          {view === 'profile' && (
            <div className="p-6 text-center animate-in slide-in-from-right-4">
              <div className="w-24 h-24 rounded-full bg-gray-100 mx-auto mb-4 p-1 border-2 border-blue-500 shadow-xl">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`} className="w-full h-full rounded-full" />
              </div>
              <h2 className="text-2xl font-black">@{username}</h2>
              <p className="text-gray-400 text-sm mt-2 font-medium">GridStream User</p>
            </div>
          )}

          <nav className="fixed bottom-0 max-w-md w-full bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-around py-4 text-gray-400 z-40">
            <HomeIcon onClick={() => setView('home')} className={view === 'home' ? 'text-blue-600' : ''} />
            <Search onClick={() => setView('search')} className={view === 'search' ? 'text-black' : ''} />
            <UserIcon onClick={() => setView('profile')} className={view === 'profile' ? 'text-black' : ''} />
          </nav>
        </>
      )}
    </div>
  );
}

// --- DMチャット画面コンポーネント ---
function DMScreen({ target, setDmTarget, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const scrollRef = useRef();

  useEffect(() => {
    fetchMessages();
    
    // Realtime: メッセージの購読
    const channel = supabase.channel('realtime:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMessage = payload.new;
        if ((newMessage.sender_id === currentUser.id && newMessage.receiver_id === target.id) ||
            (newMessage.sender_id === target.id && newMessage.receiver_id === currentUser.id)) {
          setMessages(prev => [...prev, newMessage]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [target]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function fetchMessages() {
    const { data } = await supabase.from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  }

  async function sendMsg(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const msgText = text;
    setText('');
    const { error } = await supabase.from('messages').insert([{
      text: msgText,
      sender_id: currentUser.id,
      receiver_id: target.id
    }]);
    if (error) alert(error.message);
  }

  return (
    <div className="flex flex-col h-screen bg-[#f0f2f5] animate-in slide-in-from-right-full duration-300">
      <header className="bg-white p-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <ChevronLeft className="cursor-pointer" onClick={() => setDmTarget(null)} />
        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${target.username}`} className="w-9 h-9 rounded-full bg-gray-100" />
        <span className="font-bold text-sm tracking-tight">{target.username}</span>
      </header>

      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] p-3 rounded-2xl text-sm shadow-sm leading-relaxed ${
              m.sender_id === currentUser.id 
              ? 'bg-blue-600 text-white rounded-tr-none' 
              : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={sendMsg} className="p-4 bg-white border-t border-gray-100 flex gap-2 items-center">
        <input type="text" className="flex-grow bg-gray-100 p-3 rounded-full text-sm outline-none focus:ring-1 focus:ring-blue-100" placeholder="メッセージを入力..." value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="bg-blue-600 text-white p-3 rounded-full shadow-lg active:scale-90 transition"><Send size={18}/></button>
      </form>
    </div>
  );
}

function LoginScreen({ username, setUsername, setUser, fetchData }) {
  const handleSignUp = async () => {
    if (!username.trim()) return;
    const { data } = await supabase.auth.signInAnonymously();
    if (data?.user) {
      await supabase.from('profiles').upsert([{ id: data.user.id, username, display_name: username }]);
      setUser(data.user);
      fetchData();
    }
  };
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-white text-black text-center">
      <script src="https://cdn.tailwindcss.com"></script>
      <h1 className="text-5xl font-black mb-12 text-blue-600 italic tracking-tighter uppercase">GridStream</h1>
      <input type="text" className="w-full max-w-xs bg-gray-50 p-5 rounded-2xl mb-4 outline-none text-lg font-bold" placeholder="USERNAME" value={username} onChange={(e) => setUsername(e.target.value)} />
      <button onClick={handleSignUp} className="w-full max-w-xs bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-blue-700 transition active:scale-95">START CHAT</button>
    </div>
  );
            }
