import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User, RefreshCw, Hash } from 'lucide-react';

export default function App() {
  const [view, setView] = useState('home'); 
  const [posts, setPosts] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [loading, setLoading] = useState(true);

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
    // SQLで外部キーを設定したので、このシンプルな書き方で「投稿＋ユーザー名」が取れます
    const { data: postsData, error } = await supabase
      .from('posts')
      .select('*, profiles(username, avatar_url)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Fetch Error:", error.message);
    } else {
      setPosts(postsData || []);
    }

    const { data: profData } = await supabase.from('profiles').select('*');
    setAllProfiles(profData || []);
    setLoading(false);
  }

  async function handlePost(imageUrl = null) {
    if (!newPost.trim() || !user) return;
    
    // 投稿前にプロフィールが存在することを保証（upsert）
    await supabase.from('profiles').upsert([{ id: user.id, username: username || 'User' }]);

    const { error } = await supabase.from('posts').insert([{ 
      content: newPost, 
      user_id: user.id,
      image_url: imageUrl 
    }]);

    if (!error) {
      setNewPost('');
      fetchData();
    } else {
      alert("投稿失敗: " + error.message);
    }
  }

  const filteredPosts = posts.filter(p => p.content?.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredUsers = allProfiles.filter(u => u.username?.toLowerCase().includes(searchQuery.toLowerCase()));

  if (!user) return <LoginScreen username={username} setUsername={setUsername} setUser={setUser} fetchData={fetchData} />;

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-20 border-x border-gray-100 font-sans text-black relative">
      <script src="https://cdn.tailwindcss.com"></script>

      {/* --- ホーム --- */}
      {view === 'home' && (
        <div className="animate-in fade-in">
          <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-100 p-4 flex justify-between items-center">
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent italic tracking-tighter">GridStream</h1>
            <div className="flex gap-4">
              <RefreshCw size={20} className={`text-gray-300 ${loading && 'animate-spin'}`} onClick={fetchData} />
              <MessageCircle size={24} className="text-gray-700" />
            </div>
          </header>
          
          <div className="p-4 border-b border-gray-100 flex gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold uppercase">{username ? username[0] : 'U'}</div>
            <div className="flex-grow">
              <textarea className="w-full border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none bg-transparent" placeholder="GridStreamに投稿しよう" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
              <div className="flex justify-end gap-2">
                <button onClick={() => handlePost(`https://picsum.photos/seed/${Date.now()}/600/600`)} className="bg-gray-50 text-gray-500 px-4 py-2 rounded-full font-bold text-xs flex items-center gap-1 active:bg-gray-200">📷 画像付き</button>
                <button onClick={() => handlePost()} className="bg-blue-600 text-white px-5 py-2 rounded-full font-bold text-sm shadow-lg shadow-blue-100 active:scale-95 transition">ポスト</button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {posts.length === 0 && !loading && <div className="p-10 text-center text-gray-400 text-sm">投稿がまだありません</div>}
            {posts.map((post) => (
              <article key={post.id} className="p-4 flex gap-3 hover:bg-gray-50/50 transition">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.profiles?.username || 'User'}`} />
                </div>
                <div className="flex-grow">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-sm">{post.profiles?.username || '名無しさん'}</span>
                    <span className="text-gray-400 text-[10px]">· Just now</span>
                  </div>
                  <p className="text-sm mt-1 leading-relaxed text-gray-800">{post.content}</p>
                  {post.image_url && <img src={post.image_url} className="mt-3 rounded-2xl border border-gray-100 max-h-80 w-full object-cover shadow-sm" />}
                  <div className="flex justify-between mt-3 text-gray-400 max-w-[200px]"><Heart size={18} /><MessageCircle size={18} /><Share2 size={18} /></div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* --- 検索 (オムニ検索) --- */}
      {view === 'search' && (
        <div className="animate-in fade-in">
          <div className="p-4 sticky top-0 bg-white z-10 border-b border-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input type="text" placeholder="ユーザー、つぶやきを検索" className="w-full bg-gray-100 rounded-xl py-2.5 pl-10 pr-4 outline-none focus:ring-2 focus:ring-blue-200 text-black bg-white shadow-inner" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>

          {searchQuery === '' ? (
            <div className="grid grid-cols-3 gap-[2px]">
              {posts.filter(p => p.image_url).map((post) => (
                <div key={post.id} className="aspect-square bg-gray-100 overflow-hidden cursor-pointer" onClick={() => setSelectedPost(post)}>
                  <img src={post.image_url} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 space-y-6">
              <div>
                <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest flex items-center gap-2"><User size={14}/> ユーザー</h3>
                {filteredUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden"><img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} /></div>
                    <span className="font-bold text-sm">{u.username}</span>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest flex items-center gap-2"><Hash size={14}/> つぶやき</h3>
                {filteredPosts.map(p => (
                  <div key={p.id} className="py-3 border-b border-gray-50 text-sm">
                    <p className="font-bold text-xs text-blue-500">@{p.profiles?.username || '名無し'}</p>
                    <p className="text-gray-800">{p.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- ポップアップ --- */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedPost(null)}>
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <img src={selectedPost.image_url} className="w-full aspect-square object-cover" />
            <div className="p-5">
              <p className="font-bold text-sm mb-1">{selectedPost.profiles?.username || '名無し'}</p>
              <p className="text-gray-800 text-sm leading-relaxed">{selectedPost.content}</p>
            </div>
          </div>
        </div>
      )}

      {/* 下部ナビゲーション */}
      <nav className="fixed bottom-0 max-w-md w-full bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-around py-4 text-gray-400 z-20">
        <HomeIcon onClick={() => setView('home')} className={view === 'home' ? 'text-blue-600' : ''} />
        <Search onClick={() => setView('search')} className={view === 'search' ? 'text-black font-bold' : ''} />
        <MessageCircle />
        <User onClick={() => setView('profile')} className={view === 'profile' ? 'text-black font-bold' : ''} />
      </nav>
    </div>
  );
}

function LoginScreen({ username, setUsername, setUser, fetchData }) {
  const handleSignUp = async () => {
    if (!username.trim()) return;
    const { data } = await supabase.auth.signInAnonymously();
    if (data?.user) {
      // ユーザー作成と同時にプロフィールを確実に保存
      await supabase.from('profiles').upsert([{ id: data.user.id, username, display_name: username }]);
      setUser(data.user);
      fetchData();
    }
  };
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50 text-black">
      <script src="https://cdn.tailwindcss.com"></script>
      <h1 className="text-4xl font-black mb-8 text-blue-600 italic tracking-tighter">GridStream</h1>
      <div className="w-full max-w-sm bg-white p-8 rounded-3xl border border-gray-100 shadow-xl text-center">
        <input type="text" className="w-full border p-4 rounded-2xl mb-4 outline-none focus:ring-2 focus:ring-blue-100 text-black bg-white" placeholder="ユーザー名" value={username} onChange={(e) => setUsername(e.target.value)} />
        <button onClick={handleSignUp} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg">GridStreamを開始</button>
      </div>
    </div>
  );
  }
