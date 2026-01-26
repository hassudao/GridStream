import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User as UserIcon, RefreshCw, Hash, MoreHorizontal, Grid, List } from 'lucide-react';

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
    const { data: postsData } = await supabase
      .from('posts')
      .select('*, profiles(username, avatar_url)')
      .order('created_at', { ascending: false });
    if (postsData) setPosts(postsData);

    const { data: profData } = await supabase.from('profiles').select('*');
    if (profData) setAllProfiles(profData);
    setLoading(false);
  }

  async function handlePost(imageUrl = null) {
    if (!newPost.trim() || !user) return;
    await supabase.from('profiles').upsert([{ id: user.id, username: username || 'User' }]);
    const { error } = await supabase.from('posts').insert([{ content: newPost, user_id: user.id, image_url: imageUrl }]);
    if (!error) { setNewPost(''); fetchData(); }
  }

  const filteredPosts = posts.filter(p => p.content?.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredUsers = allProfiles.filter(u => u.username?.toLowerCase().includes(searchQuery.toLowerCase()));

  if (!user) return <LoginScreen username={username} setUsername={setUsername} setUser={setUser} fetchData={fetchData} />;

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-20 border-x border-gray-100 font-sans text-black relative shadow-2xl">
      <script src="https://cdn.tailwindcss.com"></script>

      {/* --- HOME VIEW (Twitter + Instagram Stories) --- */}
      {view === 'home' && (
        <div className="animate-in fade-in duration-500">
          <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-50 p-4 flex justify-between items-center">
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent italic tracking-tighter">GridStream</h1>
            <div className="flex gap-4 text-gray-700">
              <Camera size={24} className="hover:text-blue-500 cursor-pointer" />
              <MessageCircle size={24} className="hover:text-blue-500 cursor-pointer" />
            </div>
          </header>

          {/* ストーリーバー (Instagram風) */}
          <div className="flex overflow-x-auto p-4 gap-4 no-scrollbar border-b border-gray-50 bg-white">
            <div className="flex flex-col items-center flex-shrink-0 gap-1">
              <div className="w-16 h-16 rounded-full border-2 border-gray-200 p-0.5 relative">
                <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center text-gray-400"><Plus size={20}/></div>
                <div className="absolute bottom-0 right-0 bg-blue-500 text-white rounded-full p-0.5 border-2 border-white"><Plus size={10}/></div>
              </div>
              <span className="text-[10px] text-gray-500">あなたの番</span>
            </div>
            {allProfiles.slice(0, 6).map((u) => (
              <div key={u.id} className="flex flex-col items-center flex-shrink-0 gap-1">
                <div className="w-16 h-16 rounded-full border-2 border-pink-500 p-0.5">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} className="w-full h-full rounded-full bg-gray-50 object-cover" />
                </div>
                <span className="text-[10px] text-gray-500 truncate w-16 text-center">{u.username}</span>
              </div>
            ))}
          </div>
          
          <div className="p-4 border-b border-gray-100 flex gap-3 bg-white">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">{username ? username[0] : 'U'}</div>
            <div className="flex-grow">
              <textarea className="w-full border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none bg-transparent" placeholder="何が起きてる？" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
              <div className="flex justify-end gap-2">
                <button onClick={() => handlePost(`https://picsum.photos/seed/${Date.now()}/600/600`)} className="text-blue-500 p-2 hover:bg-blue-50 rounded-full transition"><Camera size={20}/></button>
                <button onClick={() => handlePost()} className="bg-blue-600 text-white px-5 py-1.5 rounded-full font-bold text-sm shadow-lg shadow-blue-100 active:scale-95 transition">投稿</button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {posts.map((post) => (
              <article key={post.id} className="p-4 flex gap-3 hover:bg-gray-50/50 transition duration-300">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.profiles?.username || 'User'}`} className="rounded-full" />
                </div>
                <div className="flex-grow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-sm">{post.profiles?.username || 'Guest'}</span>
                      <span className="text-gray-400 text-xs">· Just now</span>
                    </div>
                    <MoreHorizontal size={16} className="text-gray-400" />
                  </div>
                  <p className="text-sm mt-1 text-gray-800 leading-relaxed">{post.content}</p>
                  {post.image_url && <img src={post.image_url} className="mt-3 rounded-2xl border border-gray-100 max-h-80 w-full object-cover shadow-sm" />}
                  <div className="flex justify-between mt-4 text-gray-400 max-w-[240px]">
                    <div className="flex items-center gap-1.5 hover:text-pink-500 transition"><Heart size={18} /><span className="text-xs">24</span></div>
                    <div className="flex items-center gap-1.5 hover:text-blue-500 transition"><MessageCircle size={18} /><span className="text-xs">3</span></div>
                    <Share2 size={18} className="hover:text-green-500 transition" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* --- SEARCH VIEW --- */}
      {view === 'search' && (
        <div className="animate-in fade-in">
          <div className="p-4 sticky top-0 bg-white/95 backdrop-blur-md z-10 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input type="text" placeholder="ユーザー、トピックを検索" className="w-full bg-gray-100 rounded-xl py-2.5 pl-10 pr-4 outline-none focus:ring-2 focus:ring-blue-100 text-black" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>

          {searchQuery === '' ? (
            <div className="grid grid-cols-3 gap-[2px]">
              {posts.filter(p => p.image_url).map((post) => (
                <div key={post.id} className="aspect-square bg-gray-100 overflow-hidden cursor-pointer hover:opacity-90" onClick={() => setSelectedPost(post)}>
                  <img src={post.image_url} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 space-y-6">
              <div>
                <h3 className="text-[10px] font-black text-gray-400 mb-4 uppercase tracking-[0.2em]">ユーザー</h3>
                {filteredUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between mb-4 bg-gray-50 p-3 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} className="w-10 h-10 rounded-full bg-white shadow-sm" />
                      <span className="font-bold text-sm">{u.username}</span>
                    </div>
                    <button className="bg-black text-white text-xs font-bold px-4 py-1.5 rounded-full">フォロー</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- PROFILE VIEW --- */}
      {view === 'profile' && (
        <div className="animate-in slide-in-from-right-4 duration-300">
          <header className="p-4 flex items-center gap-4">
            <h2 className="font-black text-xl">{username}</h2>
          </header>
          <div className="px-4 py-2 flex items-center justify-between">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-yellow-400 to-fuchsia-600 p-0.5">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`} className="w-full h-full rounded-full bg-white p-0.5" />
            </div>
            <div className="flex gap-6 text-center">
              <div><p className="font-black text-lg">{posts.filter(p => p.user_id === user.id).length}</p><p className="text-[10px] text-gray-500 uppercase">投稿</p></div>
              <div><p className="font-black text-lg">128</p><p className="text-[10px] text-gray-500 uppercase">フォロワー</p></div>
              <div><p className="font-black text-lg">256</p><p className="text-[10px] text-gray-500 uppercase">フォロー中</p></div>
            </div>
          </div>
          <div className="px-4 mt-2">
            <p className="text-sm font-bold">{username}</p>
            <p className="text-sm text-gray-600 leading-relaxed">GridStreamで新しい体験を。🎨✨</p>
          </div>
          <div className="flex gap-2 p-4 border-b border-gray-100">
            <button className="flex-grow bg-gray-100 text-sm font-bold py-2 rounded-lg">プロフィールを編集</button>
            <button className="bg-gray-100 px-3 py-2 rounded-lg font-bold">アーカイブ</button>
          </div>
          
          <div className="flex border-b border-gray-100">
            <div className="flex-grow py-3 flex justify-center text-blue-600 border-b-2 border-blue-600"><Grid size={20}/></div>
            <div className="flex-grow py-3 flex justify-center text-gray-400"><List size={20}/></div>
          </div>
          
          <div className="grid grid-cols-3 gap-[2px]">
            {posts.filter(p => p.user_id === user.id).map((post) => (
              <div key={post.id} className="aspect-square bg-gray-100">
                {post.image_url ? <img src={post.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 p-2">{post.content}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- POPUP (Instagram風) --- */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedPost(null)}>
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <div className="p-4 flex items-center gap-2 border-b border-gray-50">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedPost.profiles?.username}`} className="w-8 h-8 rounded-full bg-gray-100" />
              <span className="font-bold text-sm">{selectedPost.profiles?.username}</span>
            </div>
            <img src={selectedPost.image_url} className="w-full aspect-square object-cover" />
            <div className="p-5">
              <p className="text-sm leading-relaxed"><span className="font-bold mr-2">{selectedPost.profiles?.username}</span>{selectedPost.content}</p>
            </div>
          </div>
        </div>
      )}

      {/* NAV BAR */}
      <nav className="fixed bottom-0 max-w-md w-full bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-around py-4 text-gray-400 z-20">
        <HomeIcon onClick={() => setView('home')} className={view === 'home' ? 'text-blue-600' : ''} />
        <Search onClick={() => setView('search')} className={view === 'search' ? 'text-black' : ''} />
        <MessageCircle className="hover:text-blue-500 transition" />
        <UserIcon onClick={() => setView('profile')} className={view === 'profile' ? 'text-black' : ''} />
      </nav>
    </div>
  );
}

function Plus({size}) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>; }

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
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-white text-black">
      <script src="https://cdn.tailwindcss.com"></script>
      <h1 className="text-5xl font-black mb-12 text-blue-600 italic tracking-tighter">GridStream</h1>
      <div className="w-full max-w-sm space-y-4">
        <input type="text" className="w-full bg-gray-50 border-none p-5 rounded-2xl outline-none focus:ring-2 focus:ring-blue-100 transition text-lg" placeholder="ユーザーネーム" value={username} onChange={(e) => setUsername(e.target.value)} />
        <button onClick={handleSignUp} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition active:scale-95">はじめる</button>
      </div>
    </div>
  );
            }
