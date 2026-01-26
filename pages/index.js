import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Plus, User, Search, Home as HomeIcon, X, Send, ChevronLeft, Hash } from 'lucide-react';

export default function App() {
  const [view, setView] = useState('home'); 
  const [posts, setPosts] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]); // 検索用の全ユーザー
  const [stories, setStories] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [searchQuery, setSearchQuery] = useState(''); // 検索ワード
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);

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
    // 投稿の取得
    const { data: postsData, error: pError } = await supabase
      .from('posts')
      .select('*, profiles(username, avatar_url)')
      .order('created_at', { ascending: false });
    if (postsData) setPosts(postsData);

    // ユーザー一覧の取得 (検索用)
    const { data: profData } = await supabase.from('profiles').select('*');
    if (profData) setAllProfiles(profData);

    // ストーリー用
    const { data: storiesData } = await supabase.from('profiles').select('username, avatar_url').limit(10);
    if (storiesData) setStories(storiesData);
  }

  async function handlePost(imageUrl = null) {
    if (!newPost.trim() || !user) return;
    const { error } = await supabase.from('posts').insert([{ 
      content: newPost, 
      user_id: user.id,
      image_url: imageUrl 
    }]);
    if (error) alert("投稿に失敗しました: " + error.message);
    setNewPost('');
    fetchData();
  }

  // 検索フィルタリング
  const filteredPosts = posts.filter(p => p.content?.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredUsers = allProfiles.filter(u => u.username?.toLowerCase().includes(searchQuery.toLowerCase()));

  if (!user) return <LoginScreen username={username} setUsername={setUsername} setUser={setUser} />;

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-20 border-x border-gray-100 font-sans text-black relative">
      <script src="https://cdn.tailwindcss.com"></script>

      {/* --- ホーム画面 (Twitter形式) --- */}
      {view === 'home' && (
        <div className="animate-in fade-in">
          <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 p-4 flex justify-between items-center">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent italic tracking-tighter">Beta</h1>
            <div className="flex gap-4"><Camera size={24} /><MessageCircle size={24} /></div>
          </header>
          
          <div className="p-4 border-b border-gray-100 flex gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold uppercase">{username ? username[0] : 'U'}</div>
            <div className="flex-grow">
              <textarea className="w-full border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none" placeholder="今、何してる？" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
              <div className="flex justify-end gap-2">
                <button onClick={() => handlePost(`https://picsum.photos/seed/${Date.now()}/600/600`)} className="bg-gray-50 text-gray-500 px-4 py-2 rounded-full font-bold text-xs flex items-center gap-1 active:bg-gray-200">📷 画像付き</button>
                <button onClick={() => handlePost()} className="bg-indigo-600 text-white px-5 py-2 rounded-full font-bold text-sm shadow-lg shadow-indigo-100 active:scale-95 transition">ポスト</button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {posts.length === 0 && <div className="p-10 text-center text-gray-400">投稿がありません</div>}
            {posts.map((post) => (
              <article key={post.id} className="p-4 flex gap-3 hover:bg-gray-50 transition">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0"><img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.profiles?.username}`} /></div>
                <div className="flex-grow">
                  <div className="flex items-center gap-1"><span className="font-bold text-sm">{post.profiles?.username}</span><span className="text-gray-400 text-xs">· 1m</span></div>
                  <p className="text-sm mt-1 leading-relaxed">{post.content}</p>
                  {post.image_url && <img src={post.image_url} className="mt-3 rounded-2xl border border-gray-100 max-h-80 w-full object-cover" />}
                  <div className="flex justify-between mt-3 text-gray-400 max-w-[200px]"><Heart size={18} /><MessageCircle size={18} /><Share2 size={18} /></div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* --- 検索画面 (オムニ検索) --- */}
      {view === 'search' && (
        <div className="animate-in fade-in">
          <div className="p-4 sticky top-0 bg-white z-10 border-b border-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input 
                type="text" 
                placeholder="ユーザー、キーワードを検索" 
                className="w-full bg-gray-100 rounded-xl py-2.5 pl-10 pr-4 outline-none focus:ring-2 focus:ring-indigo-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {searchQuery === '' ? (
            // 何も入力していない時は「画像グリッド」
            <div className="grid grid-cols-3 gap-[2px]">
              {posts.filter(p => p.image_url).map((post) => (
                <div key={post.id} className="aspect-square bg-gray-100 overflow-hidden cursor-pointer" onClick={() => setSelectedPost(post)}>
                  <img src={post.image_url} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            // 入力がある時は「ユーザー」と「つぶやき」を検索
            <div className="p-4 space-y-6">
              {filteredUsers.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">ユーザー</h3>
                  {filteredUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden"><img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} /></div>
                      <div>
                        <p className="font-bold text-sm">{u.username}</p>
                        <p className="text-xs text-gray-500">@{u.username?.toLowerCase()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">つぶやき</h3>
                {filteredPosts.map(p => (
                  <div key={p.id} className="py-3 border-b border-gray-50 text-sm">
                    <p className="font-bold text-xs text-indigo-500 mb-1">@{p.profiles?.username}</p>
                    <p className="text-gray-800">{p.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- ポップアップモーダル (グリッドクリック時) --- */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedPost(null)}>
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 bg-black/50 text-white p-1 rounded-full z-10" onClick={() => setSelectedPost(null)}><X size={20}/></button>
            <img src={selectedPost.image_url} className="w-full aspect-square object-cover shadow-inner" />
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-100"><img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedPost.profiles?.username}`} /></div>
                <span className="font-bold text-sm">{selectedPost.profiles?.username}</span>
              </div>
              <p className="text-gray-800 text-sm leading-relaxed">{selectedPost.content}</p>
              <div className="mt-4 pt-4 border-t border-gray-50 flex justify-around text-gray-400">
                <Heart size={20} /> <MessageCircle size={20} /> <Share2 size={20} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ナビゲーション */}
      <nav className="fixed bottom-0 max-w-md w-full bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-around py-4 text-gray-400 z-20">
        <HomeIcon onClick={() => setView('home')} className={view === 'home' ? 'text-indigo-600' : ''} />
        <Search onClick={() => setView('search')} className={view === 'search' ? 'text-black font-bold' : ''} />
        <MessageCircle />
        <User onClick={() => setView('profile')} className={view === 'profile' ? 'text-black font-bold' : ''} />
      </nav>
    </div>
  );
}

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
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50 text-black">
      <script src="https://cdn.tailwindcss.com"></script>
      <h1 className="text-4xl font-extrabold mb-8 text-indigo-600 italic tracking-tighter">Beta</h1>
      <div className="w-full max-w-sm bg-white p-8 rounded-3xl border border-gray-100 shadow-xl">
        <input type="text" className="w-full border p-4 rounded-2xl mb-4 outline-none focus:ring-2 focus:ring-indigo-100" placeholder="ユーザー名" value={username} onChange={(e) => setUsername(e.target.value)} />
        <button onClick={handleSignUp} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100">新しく始める</button>
      </div>
    </div>
  );
        }
