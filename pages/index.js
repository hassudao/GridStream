import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Plus, User, Search, Home as HomeIcon, X, Send, ChevronLeft } from 'lucide-react';

export default function App() {
  const [view, setView] = useState('home'); 
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [selectedPost, setSelectedPost] = useState(null); // ポップアップ用

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
    const { data: postsData } = await supabase.from('posts').select('*, profiles(username, avatar_url)').order('created_at', { ascending: false });
    if (postsData) setPosts(postsData);
    const { data: storiesData } = await supabase.from('profiles').select('username, avatar_url').limit(10);
    if (storiesData) setStories(storiesData);
  }

  // 投稿機能 (画像URLがある場合も対応)
  async function handlePost(imageUrl = null) {
    if (!newPost.trim() || !user) return;
    await supabase.from('posts').insert([{ 
      content: newPost, 
      user_id: user.id,
      image_url: imageUrl 
    }]);
    setNewPost('');
    fetchData();
  }

  if (!user) return <LoginScreen username={username} setUsername={setUsername} setUser={setUser} />;

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-20 border-x border-gray-100 font-sans text-black relative">
      <script src="https://cdn.tailwindcss.com"></script>

      {/* --- ホーム画面 (Twitter形式) --- */}
      {view === 'home' && (
        <div className="animate-in fade-in">
          <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 p-4 flex justify-between items-center">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent italic">Beta</h1>
            <div className="flex gap-4"><Camera size={24} /><MessageCircle size={24} onClick={() => setView('dm')} /></div>
          </header>
          
          {/* 投稿エリア */}
          <div className="p-4 border-b border-gray-100 flex gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 font-bold uppercase">{username ? username[0] : 'U'}</div>
            <div className="flex-grow">
              <textarea className="w-full border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none" placeholder="今、何してる？" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
              <div className="flex justify-end gap-2">
                <button onClick={() => handlePost(`https://picsum.photos/seed/${Date.now()}/600/600`)} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-full font-bold text-xs flex items-center gap-1"><Camera size={14}/> 画像付き</button>
                <button onClick={() => handlePost()} className="bg-blue-500 text-white px-5 py-2 rounded-full font-bold text-sm">ポスト</button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {posts.map((post) => (
              <article key={post.id} className="p-4 flex gap-3 animate-in fade-in">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0"><img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.profiles?.username}`} alt="avatar" /></div>
                <div className="flex-grow">
                  <div className="flex items-center gap-1"><span className="font-bold text-sm">{post.profiles?.username}</span><span className="text-gray-500 text-xs">· 1m</span></div>
                  <p className="text-sm mt-1 leading-relaxed">{post.content}</p>
                  {post.image_url && (
                    <div className="mt-3 rounded-2xl overflow-hidden border border-gray-100">
                      <img src={post.image_url} className="w-full h-auto object-cover max-h-80" />
                    </div>
                  )}
                  <div className="flex justify-between mt-3 text-gray-400 max-w-[200px]"><Heart size={18} /><MessageCircle size={18} /><Share2 size={18} /></div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* --- 検索画面 (Instagram風グリッド) --- */}
      {view === 'search' && (
        <div className="animate-in fade-in min-h-screen">
          <div className="p-4 sticky top-0 bg-white z-10">
            <div className="relative"><Search className="absolute left-3 top-3 text-gray-400" size={20} /><input type="text" placeholder="画像付き投稿を検索" className="w-full bg-gray-100 rounded-xl py-2.5 pl-10 pr-4 outline-none" /></div>
          </div>
          <div className="grid grid-cols-3 gap-[2px]">
            {/* 画像がある投稿だけを表示 */}
            {posts.filter(p => p.image_url).map((post) => (
              <div 
                key={post.id} 
                className="aspect-square bg-gray-100 cursor-pointer active:opacity-70 transition overflow-hidden"
                onClick={() => setSelectedPost(post)}
              >
                <img src={post.image_url} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          {posts.filter(p => p.image_url).length === 0 && (
            <div className="p-20 text-center text-gray-400 text-sm">画像付きの投稿がまだありません</div>
          )}
        </div>
      )}

      {/* --- ポップアップモーダル --- */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedPost(null)}>
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 bg-black/50 text-white p-1 rounded-full z-10" onClick={() => setSelectedPost(null)}><X size={20}/></button>
            <img src={selectedPost.image_url} className="w-full aspect-square object-cover" />
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-100">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedPost.profiles?.username}`} />
                </div>
                <span className="font-bold text-sm">{selectedPost.profiles?.username}</span>
              </div>
              <p className="text-gray-800 text-sm leading-relaxed">{selectedPost.content}</p>
            </div>
          </div>
        </div>
      )}

      {/* --- プロフィール画面 (前回同様) --- */}
      {view === 'profile' && (
        <div className="animate-in slide-in-from-right min-h-screen bg-white">
          <div className="h-32 bg-gradient-to-r from-blue-400 to-purple-500 relative"></div>
          <div className="px-4 pb-4">
            <div className="flex justify-between items-end -mt-12 mb-4">
              <div className="w-24 h-24 rounded-full border-4 border-white bg-gray-200 overflow-hidden"><img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`} /></div>
              <button className="border border-gray-300 font-bold px-4 py-1.5 rounded-full text-sm">編集</button>
            </div>
            <h2 className="text-xl font-bold">{username}</h2>
            <p className="text-gray-500 text-sm">@{username.toLowerCase()}</p>
          </div>
          <div className="border-t border-gray-100 grid grid-cols-3 gap-[2px] mt-4">
            {posts.filter(p => p.profiles?.username === username && p.image_url).map(p => (
               <div key={p.id} className="aspect-square bg-gray-100" onClick={() => setSelectedPost(p)}>
                 <img src={p.image_url} className="w-full h-full object-cover" />
               </div>
            ))}
          </div>
        </div>
      )}

      {/* 下部ナビゲーション */}
      <nav className="fixed bottom-0 max-w-md w-full bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-around py-4 text-gray-400 z-20">
        <HomeIcon onClick={() => setView('home')} className={`cursor-pointer ${view === 'home' ? 'text-blue-500' : ''}`} />
        <Search onClick={() => setView('search')} className={`cursor-pointer ${view === 'search' ? 'text-black' : ''}`} />
        <MessageCircle className="cursor-pointer" />
        <User onClick={() => setView('profile')} className={`cursor-pointer ${view === 'profile' ? 'text-black' : ''}`} />
      </nav>
    </div>
  );
}

// ログイン画面 (前回同様)
function LoginScreen({ username, setUsername, setUser }) {
  const handleSignUp = async () => {
    if (!username.trim()) return;
    const { data } = await supabase.auth.signInAnonymously();
    if (data?.user) {
      await supabase.from('profiles').upsert([{ id: data.user.id, username, display_name: username }]);
      setUser(data.user);
    }
  };
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-white text-black">
      <script src="https://cdn.tailwindcss.com"></script>
      <h1 className="text-4xl font-extrabold mb-8 text-blue-500 italic">Beta</h1>
      <div className="w-full max-w-sm bg-white p-8 rounded-3xl border border-gray-100 shadow-xl">
        <input type="text" className="w-full border p-4 rounded-2xl mb-4 outline-none" placeholder="ユーザー名" value={username} onChange={(e) => setUsername(e.target.value)} />
        <button onClick={handleSignUp} className="w-full bg-blue-500 text-white font-bold py-4 rounded-2xl">新しく始める</button>
      </div>
    </div>
  );
        }
