import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Plus, User, Search, Home as HomeIcon, Send, ChevronLeft } from 'lucide-react';

export default function App() {
  const [view, setView] = useState('home'); // 'home', 'search', 'profile', 'dm'
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [newPost, setNewPost] = useState('');
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    checkUser();
    fetchData();
  }, []);

  // チャットが更新されたら一番下へスクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, view]);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      const { data: profile } = await supabase.from('profiles').select('username').eq('id', session.user.id).single();
      if (profile) setUsername(profile.username);
    }
  }

  async function fetchData() {
    const { data: postsData } = await supabase.from('posts').select('*, profiles(username, avatar_url)').order('created_at', { ascending: false });
    if (postsData) setPosts(postsData);
    const { data: storiesData } = await supabase.from('profiles').select('username, avatar_url').limit(10);
    if (storiesData) setStories(storiesData);
  }

  // DMの取得
  async function fetchMessages() {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) setMessages(data);
  }

  useEffect(() => {
    if (view === 'dm') fetchMessages();
  }, [view]);

  async function handleSendMessage() {
    if (!newMessage.trim() || !user) return;
    await supabase.from('messages').insert([{ 
      content: newMessage, 
      sender_id: user.id,
      receiver_id: user.id // テスト用に自分宛て
    }]);
    setNewMessage('');
    fetchMessages();
  }

  async function handlePost() {
    if (!newPost.trim() || !user) return;
    await supabase.from('posts').insert([{ content: newPost, user_id: user.id }]);
    setNewPost('');
    fetchData();
  }

  if (!user) return <LoginScreen username={username} setUsername={setUsername} setUser={setUser} />;

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-20 border-x border-gray-100 font-sans text-black relative overflow-x-hidden">
      <script src="https://cdn.tailwindcss.com"></script>

      {/* --- ホーム / 検索 / プロフィール は前回同様 --- */}
      {view === 'home' && (
        <div className="animate-in fade-in">
          <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 p-4 flex justify-between items-center text-black">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">GridStream</h1>
            <div className="flex gap-4"><Camera size={24} /><MessageCircle size={24} onClick={() => setView('dm')} /></div>
          </header>
          {/* ストーリー */}
          <div className="flex overflow-x-auto p-4 gap-4 no-scrollbar border-b border-gray-50 bg-white">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center border border-dashed border-gray-300"><Plus size={24} className="text-gray-400" /></div>
              <span className="text-xs mt-1 text-gray-400 font-bold">追加</span>
            </div>
            {stories.map((s, i) => (
              <div key={i} className="flex flex-col items-center flex-shrink-0">
                <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-purple-600">
                  <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-gray-200">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s.username}`} alt="avatar" />
                  </div>
                </div>
                <span className="text-xs mt-1 text-gray-600 font-bold">{s.username}</span>
              </div>
            ))}
          </div>
          {/* 投稿エリア */}
          <div className="p-4 border-b border-gray-100 flex gap-3 bg-white">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 font-bold uppercase">{username ? username[0] : 'U'}</div>
            <div className="flex-grow">
              <textarea className="w-full border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-12 outline-none text-black bg-white" placeholder="今、何してる？" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
              <div className="flex justify-end mt-2"><button onClick={handlePost} className="bg-blue-500 text-white px-5 py-2 rounded-full font-bold text-sm shadow-md active:scale-95 transition">ポスト</button></div>
            </div>
          </div>
          {/* タイムライン */}
          <div className="divide-y divide-gray-100 bg-white">
            {posts.map((post) => (
              <article key={post.id} className="p-4 flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0"><img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.profiles?.username}`} alt="avatar" /></div>
                <div className="flex-grow text-black">
                  <div className="flex items-center gap-1"><span className="font-bold text-sm">{post.profiles?.username}</span><span className="text-gray-500 text-xs">· 1m</span></div>
                  <p className="text-sm mt-1 leading-relaxed">{post.content}</p>
                  <div className="flex justify-between mt-3 text-gray-400 max-w-[200px]"><Heart size={18} /><MessageCircle size={18} /><Share2 size={18} /></div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {view === 'search' && (
        <div className="animate-in fade-in bg-white min-h-screen">
          <div className="p-4"><div className="relative"><Search className="absolute left-3 top-3 text-gray-400" size={20} /><input type="text" placeholder="検索" className="w-full bg-gray-100 rounded-xl py-2.5 pl-10 pr-4 outline-none text-black" /></div></div>
          <div className="grid grid-cols-3 gap-[2px]">
            {[...Array(15)].map((_, i) => (<div key={i} className="aspect-square bg-gray-200"><img src={`https://picsum.photos/seed/${i+50}/300/300`} className="w-full h-full object-cover" /></div>))}
          </div>
        </div>
      )}

      {view === 'profile' && (
        <div className="animate-in slide-in-from-right bg-white min-h-screen">
          <div className="h-32 bg-gradient-to-r from-blue-400 to-purple-500 relative"></div>
          <div className="px-4 pb-4">
            <div className="flex justify-between items-end -mt-12 mb-4">
              <div className="w-24 h-24 rounded-full border-4 border-white bg-gray-200 overflow-hidden"><img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`} alt="profile" /></div>
              <button className="border border-gray-300 font-bold px-4 py-1.5 rounded-full text-sm text-black">編集</button>
            </div>
            <h2 className="text-xl font-bold text-black">{username}</h2>
            <p className="text-gray-500 text-sm">@{username.toLowerCase()}</p>
            <div className="flex gap-4 mt-4 px-4 overflow-x-auto no-scrollbar">
               {['思い出', '趣味'].map((l, i) => (
                 <div key={i} className="flex flex-col items-center flex-shrink-0"><div className="w-14 h-14 rounded-full border p-0.5"><div className="w-full h-full rounded-full bg-gray-100 overflow-hidden"><img src={`https://picsum.photos/seed/h${i}/100/100`} /></div></div><span className="text-[10px] mt-1 text-black font-bold">{l}</span></div>
               ))}
            </div>
          </div>
        </div>
      )}

      {/* --- DM画面 (LINE風) --- */}
      {view === 'dm' && (
        <div className="flex flex-col h-screen bg-[#7494C0] animate-in slide-in-from-bottom duration-300 overflow-hidden absolute inset-0 z-30 pb-0">
          {/* チャットヘッダー */}
          <header className="bg-[#1e1e1e]/10 backdrop-blur-md p-4 flex items-center gap-3 text-white">
            <ChevronLeft onClick={() => setView('home')} className="cursor-pointer" />
            <div className="w-8 h-8 rounded-full bg-gray-300 overflow-hidden">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" alt="Admin" />
            </div>
            <span className="font-bold">公式メッセージ (自分)</span>
          </header>

          {/* メッセージエリア */}
          <div className="flex-grow overflow-y-auto p-4 space-y-4 no-scrollbar">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] p-3 rounded-2xl text-sm relative ${
                  msg.sender_id === user.id 
                  ? 'bg-[#85E249] text-black rounded-tr-none' 
                  : 'bg-white text-black rounded-tl-none shadow-sm'
                }`}>
                  {msg.content}
                  <span className="text-[10px] text-gray-500 absolute bottom-[-18px] right-0 whitespace-nowrap">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {msg.sender_id === user.id && " 既読"}
                  </span>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* 入力エリア (LINE風) */}
          <div className="p-3 bg-white flex items-center gap-2 pb-6">
            <Plus className="text-gray-400" size={24} />
            <Camera className="text-gray-400" size={24} />
            <input 
              type="text" 
              className="flex-grow bg-gray-100 rounded-full px-4 py-2 outline-none text-black"
              placeholder="メッセージを入力"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <Send onClick={handleSendMessage} className={`text-blue-500 ${!newMessage.trim() && 'opacity-30'}`} size={24} />
          </div>
        </div>
      )}

      {/* 下部ナビゲーション */}
      <nav className="fixed bottom-0 max-w-md w-full bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-around py-4 text-gray-400 z-20">
        <HomeIcon onClick={() => setView('home')} className={`cursor-pointer ${view === 'home' ? 'text-blue-500' : ''}`} />
        <Search onClick={() => setView('search')} className={`cursor-pointer ${view === 'search' ? 'text-black font-bold' : ''}`} />
        <MessageCircle onClick={() => setView('dm')} className={`cursor-pointer ${view === 'dm' ? 'text-blue-500' : ''}`} />
        <User onClick={() => setView('profile')} className={`cursor-pointer ${view === 'profile' ? 'text-black font-bold' : ''}`} />
      </nav>
    </div>
  );
}

// LoginScreen コンポーネント (前回と同様)
function LoginScreen({ username, setUsername, setUser }) {
  const [loading, setLoading] = useState(false);
  const handleSignUp = async () => {
    if (!username.trim()) return;
    setLoading(true);
    const { data } = await supabase.auth.signInAnonymously();
    if (data?.user) {
      await supabase.from('profiles').upsert([{ id: data.user.id, username, display_name: username }]);
      setUser(data.user);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-white text-black">
      <script src="https://cdn.tailwindcss.com"></script>
      <h1 className="text-4xl font-extrabold mb-8 text-blue-500">GridStream</h1>
      <div className="w-full max-w-sm bg-white p-8 rounded-3xl border border-gray-100 shadow-xl">
        <input type="text" className="w-full border p-4 rounded-2xl mb-4 outline-none text-black bg-white" placeholder="ユーザー名" value={username} onChange={(e) => setUsername(e.target.value)} />
        <button onClick={handleSignUp} disabled={loading} className="w-full bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lg">{loading ? '...' : '新しく始める'}</button>
      </div>
    </div>
  );
            }
