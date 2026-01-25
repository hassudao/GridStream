import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Plus, User, Search, Home as HomeIcon, Grid, Settings } from 'lucide-react';

export default function App() {
  const [view, setView] = useState('home'); // 'home', 'search', 'profile'
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');

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

  async function handlePost() {
    if (!newPost.trim() || !user) return;
    await supabase.from('posts').insert([{ content: newPost, user_id: user.id }]);
    setNewPost('');
    fetchData();
  }

  if (!user) return <LoginScreen username={username} setUsername={setUsername} setUser={setUser} />;

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-20 border-x border-gray-100 font-sans text-black relative">
      <script src="https://cdn.tailwindcss.com"></script>

      {/* --- ホーム画面 --- */}
      {view === 'home' && (
        <div className="animate-in fade-in">
          <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 p-4 flex justify-between items-center">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">GridStream</h1>
            <div className="flex gap-4"><Camera size={24} /><MessageCircle size={24} /></div>
          </header>
          {/* ストーリー */}
          <div className="flex overflow-x-auto p-4 gap-4 no-scrollbar border-b border-gray-50">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center border border-dashed border-gray-300"><Plus size={24} className="text-gray-400" /></div>
              <span className="text-xs mt-1 text-gray-400">追加</span>
            </div>
            {stories.map((s, i) => (
              <div key={i} className="flex flex-col items-center flex-shrink-0">
                <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-purple-600">
                  <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-gray-200">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s.username}`} alt="avatar" />
                  </div>
                </div>
                <span className="text-xs mt-1 text-gray-600">{s.username}</span>
              </div>
            ))}
          </div>
          {/* 投稿 */}
          <div className="p-4 border-b border-gray-100 flex gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 font-bold uppercase">{username ? username[0] : 'U'}</div>
            <div className="flex-grow">
              <textarea className="w-full border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-12 outline-none" placeholder="今、何してる？" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
              <div className="flex justify-end mt-2"><button onClick={handlePost} className="bg-blue-500 text-white px-5 py-2 rounded-full font-bold text-sm">ポスト</button></div>
            </div>
          </div>
          {/* タイムライン */}
          <div className="divide-y divide-gray-100">
            {posts.map((post) => (
              <article key={post.id} className="p-4 flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0"><img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.profiles?.username}`} alt="avatar" /></div>
                <div className="flex-grow">
                  <div className="flex items-center gap-1"><span className="font-bold text-sm">{post.profiles?.username}</span><span className="text-gray-500 text-xs">· 1m</span></div>
                  <p className="text-sm mt-1 leading-relaxed">{post.content}</p>
                  <div className="flex justify-between mt-3 text-gray-400 max-w-[200px]"><Heart size={18} /><MessageCircle size={18} /><Share2 size={18} /></div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* --- 検索画面 --- */}
      {view === 'search' && (
        <div className="animate-in fade-in">
          <div className="p-4"><div className="relative"><Search className="absolute left-3 top-3 text-gray-400" size={20} /><input type="text" placeholder="検索" className="w-full bg-gray-100 rounded-xl py-2.5 pl-10 pr-4 outline-none" /></div></div>
          <div className="grid grid-cols-3 gap-[2px]">
            {[...Array(12)].map((_, i) => (<div key={i} className="aspect-square bg-gray-200"><img src={`https://picsum.photos/seed/${i+50}/300/300`} className="w-full h-full object-cover" /></div>))}
          </div>
        </div>
      )}

      {/* --- プロフィール画面 (Twitter × Instagram ハイブリッド) --- */}
      {view === 'profile' && (
        <div className="animate-in slide-in-from-right duration-300">
          {/* ヘッダー画像 (Twitter風) */}
          <div className="h-32 bg-gradient-to-r from-blue-400 to-purple-500 relative">
            <button className="absolute top-4 left-4 bg-black/20 p-2 rounded-full text-white"><HomeIcon size={20} onClick={() => setView('home')}/></button>
          </div>
          
          {/* プロフィール詳細 */}
          <div className="px-4 pb-4">
            <div className="flex justify-between items-end -mt-12 mb-4">
              <div className="w-24 h-24 rounded-full border-4 border-white bg-gray-200 overflow-hidden">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`} alt="profile" />
              </div>
              <button className="border border-gray-300 font-bold px-4 py-1.5 rounded-full text-sm">プロフィールを編集</button>
            </div>
            <h2 className="text-xl font-bold">{username}</h2>
            <p className="text-gray-500 text-sm">@{username.toLowerCase()}</p>
            <p className="mt-3 text-sm">GridStreamで新しい体験を。🚀</p>
            <div className="flex gap-4 mt-3 text-sm text-gray-500">
              <span><b>128</b> フォロー</span>
              <span><b>256</b> フォロワー</span>
            </div>
          </div>

          {/* ストーリーハイライト (Instagram風) */}
          <div className="flex gap-4 px-4 py-4 overflow-x-auto no-scrollbar border-y border-gray-50">
            {['思い出', '旅行', '飯テロ', '趣味'].map((label, i) => (
              <div key={i} className="flex flex-col items-center flex-shrink-0">
                <div className="w-14 h-14 rounded-full border border-gray-200 p-0.5 bg-white">
                  <div className="w-full h-full rounded-full bg-gray-100 overflow-hidden">
                    <img src={`https://picsum.photos/seed/high${i}/100/100`} alt="highlight" />
                  </div>
                </div>
                <span className="text-[10px] mt-1 font-medium">{label}</span>
              </div>
            ))}
          </div>

          {/* 投稿一覧タブ */}
          <div className="flex border-b border-gray-100">
            <div className="flex-grow py-3 text-center border-b-2 border-blue-500 font-bold text-sm text-black">投稿</div>
            <div className="flex-grow py-3 text-center text-gray-500 font-bold text-sm">返信</div>
            <div className="flex-grow py-3 text-center text-gray-500 font-bold text-sm">メディア</div>
          </div>

          {/* 自分の投稿一覧 */}
          <div className="divide-y divide-gray-100">
            {posts.filter(p => p.profiles?.username === username).map((post) => (
              <article key={post.id} className="p-4 flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0"><img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`} alt="avatar" /></div>
                <div className="flex-grow text-black">
                  <div className="flex items-center gap-1"><span className="font-bold text-sm">{username}</span><span className="text-gray-500 text-xs">· 2h</span></div>
                  <p className="text-sm mt-1">{post.content}</p>
                </div>
              </article>
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
        <input type="text" className="w-full border p-4 rounded-2xl mb-4 outline-none" placeholder="ユーザー名" value={username} onChange={(e) => setUsername(e.target.value)} />
        <button onClick={handleSignUp} disabled={loading} className="w-full bg-blue-500 text-white font-bold py-4 rounded-2xl">{loading ? '...' : '新しく始める'}</button>
      </div>
    </div>
  );
                                                                                                                                                                                                 }
