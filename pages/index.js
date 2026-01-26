import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User as UserIcon, RefreshCw, Grid, List, Plus, Image as ImageIcon, Send } from 'lucide-react';

// --- Cloudinary 設定適用済み ---
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
  const [selectedPost, setSelectedPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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
    const { data: postsData } = await supabase
      .from('posts')
      .select('*, profiles(username, avatar_url)')
      .order('created_at', { ascending: false });
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
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.secure_url) {
          imageUrl = data.secure_url;
        } else {
          throw new Error(data.error?.message || "Upload failed");
        }
      } catch (err) {
        alert("画像アップロード失敗: " + err.message);
        setUploading(false);
        return;
      }
    }

    const { error } = await supabase.from('posts').insert([{ 
      content: newPost, 
      user_id: user.id, 
      image_url: imageUrl 
    }]);

    if (!error) {
      setNewPost('');
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchData();
    } else {
      alert("DB保存失敗: " + error.message);
    }
    setUploading(false);
  }

  if (!user) return <LoginScreen username={username} setUsername={setUsername} setUser={setUser} fetchData={fetchData} />;

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-20 border-x border-gray-100 font-sans text-black relative shadow-2xl overflow-x-hidden">
      <script src="https://cdn.tailwindcss.com"></script>

      {/* --- HOME VIEW --- */}
      {view === 'home' && (
        <div className="animate-in fade-in duration-500">
          <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-50 p-4 flex justify-between items-center">
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent italic tracking-tighter uppercase">GridStream</h1>
            <div className="flex gap-4 text-gray-700">
              <Camera size={24} className="hover:text-blue-500 cursor-pointer transition active:scale-90" />
              <MessageCircle size={24} className="hover:text-blue-500 cursor-pointer transition active:scale-90" />
            </div>
          </header>

          {/* ストーリーバー (Instagram風) */}
          <div className="flex overflow-x-auto p-4 gap-4 no-scrollbar border-b border-gray-50 bg-white">
            <div className="flex flex-col items-center flex-shrink-0 gap-1 cursor-pointer group">
              <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center border-2 border-dashed border-gray-200 text-gray-400 group-hover:border-blue-400 transition">
                <Plus size={24}/>
              </div>
              <span className="text-[10px] text-gray-400 font-bold">追加</span>
            </div>
            {allProfiles.map((u) => (
              <div key={u.id} className="flex flex-col items-center flex-shrink-0 gap-1 animate-in zoom-in-75">
                <div className="w-16 h-16 rounded-full border-2 border-pink-500 p-0.5 shadow-sm">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} className="w-full h-full rounded-full bg-gray-50 object-cover" />
                </div>
                <span className="text-[10px] text-gray-500 truncate w-16 text-center">{u.username}</span>
              </div>
            ))}
          </div>
          
          {/* 投稿フォーム (Twitter風) */}
          <form onSubmit={handlePost} className="p-4 border-b border-gray-100 bg-white">
            <div className="flex gap-3">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`} className="w-10 h-10 rounded-full bg-gray-100 shadow-sm border border-gray-50" />
              <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-20 outline-none bg-transparent" placeholder="今、なにしてる？" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-12 mt-2">
              <label className="cursor-pointer text-blue-500 hover:bg-blue-50 px-3 py-1.5 rounded-full transition flex items-center gap-2 border border-blue-50">
                <ImageIcon size={18}/>
                <span className="text-xs font-black uppercase">Media</span>
                <input type="file" accept="image/*" ref={fileInputRef} className="hidden" />
              </label>
              <button type="submit" disabled={uploading || !newPost.trim()} className={`bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs shadow-lg shadow-blue-100 active:scale-95 transition flex items-center gap-2 ${uploading && 'opacity-50'}`}>
                {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14}/>}
                {uploading ? 'UPLOADING...' : 'POST'}
              </button>
            </div>
          </form>

          {/* スレッドフィード */}
          <div className="divide-y divide-gray-100">
            {posts.map((post) => (
              <article key={post.id} className="p-4 flex gap-3 hover:bg-gray-50/30 transition duration-300">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden shadow-sm border border-gray-100">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.profiles?.username}`} alt="avatar" />
                </div>
                <div className="flex-grow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-sm tracking-tight">{post.profiles?.username}</span>
                      <span className="text-gray-400 text-[10px]">· {new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <p className="text-sm mt-1 text-gray-800 leading-relaxed whitespace-pre-wrap">{post.content}</p>
                  {post.image_url && (
                    <div className="mt-3 rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50">
                      <img src={post.image_url} className="w-full h-auto max-h-[500px] object-cover transition hover:scale-[1.02] duration-500" loading="lazy" />
                    </div>
                  )}
                  <div className="flex justify-between mt-4 text-gray-400 max-w-[240px]">
                    <div className="flex items-center gap-1 hover:text-pink-500 cursor-pointer transition"><Heart size={18}/><span className="text-xs font-bold">0</span></div>
                    <div className="flex items-center gap-1 hover:text-blue-500 cursor-pointer transition"><MessageCircle size={18}/><span className="text-xs font-bold">0</span></div>
                    <Share2 size={18} className="hover:text-green-500 cursor-pointer transition" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* --- SEARCH VIEW (Instagram Grid) --- */}
      {view === 'search' && (
        <div className="animate-in fade-in">
          <div className="p-4 sticky top-0 bg-white/95 backdrop-blur-md z-10 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              <input type="text" placeholder="DISCOVER IN GRIDSTREAM" className="w-full bg-gray-100 rounded-xl py-2 pl-10 pr-4 outline-none text-xs font-bold focus:ring-1 focus:ring-blue-200" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-[2px]">
            {posts.filter(p => p.image_url).map((post) => (
              <div key={post.id} className="aspect-square bg-gray-100 overflow-hidden cursor-pointer hover:opacity-80 transition relative group" onClick={() => setSelectedPost(post)}>
                <img src={post.image_url} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white gap-4">
                  <div className="flex items-center gap-1 text-xs font-bold"><Heart size={14} fill="white"/> 0</div>
                  <div className="flex items-center gap-1 text-xs font-bold"><MessageCircle size={14} fill="white"/> 0</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- PROFILE VIEW --- */}
      {view === 'profile' && (
        <div className="animate-in slide-in-from-right-4 duration-300">
          <header className="p-4 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-10">
            <h2 className="font-black text-xl tracking-tighter lowercase">@{username}</h2>
            <RefreshCw size={18} className="text-gray-400 cursor-pointer hover:rotate-180 transition duration-500" onClick={fetchData} />
          </header>
          <div className="p-6 flex items-center gap-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-1 shadow-lg">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`} className="w-full h-full rounded-full bg-white p-1" />
            </div>
            <div className="flex-grow grid grid-cols-3 text-center">
              <div><p className="font-black text-lg">{posts.filter(p => p.user_id === user.id).length}</p><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Posts</p></div>
              <div><p className="font-black text-lg">0</p><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Fans</p></div>
              <div><p className="font-black text-lg">0</p><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Next</p></div>
            </div>
          </div>
          <div className="px-6 mb-6">
            <p className="font-bold text-sm tracking-tight">{username}</p>
            <p className="text-xs text-gray-500 mt-1 italic">Building Alpha SNS on GridStream 🚀</p>
          </div>
          <div className="flex border-t border-gray-100">
            <div className="flex-grow py-3 flex justify-center text-blue-600 border-b-2 border-blue-600 transition"><Grid size={22}/></div>
            <div className="flex-grow py-3 flex justify-center text-gray-300 transition"><List size={22}/></div>
          </div>
          <div className="grid grid-cols-3 gap-[2px]">
            {posts.filter(p => p.user_id === user.id && p.image_url).map((post) => (
              <div key={post.id} className="aspect-square bg-gray-100 overflow-hidden">
                <img src={post.image_url} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- SELECTED POST POPUP (Instagram Like) --- */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in zoom-in-95" onClick={() => setSelectedPost(null)}>
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative" onClick={e => e.stopPropagation()}>
             <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedPost.profiles?.username}`} className="w-8 h-8 rounded-full bg-gray-100 border border-gray-50" />
                  <span className="font-black text-xs">{selectedPost.profiles?.username}</span>
                </div>
                <X size={20} className="text-gray-400 cursor-pointer" onClick={() => setSelectedPost(null)} />
             </div>
             <img src={selectedPost.image_url} className="w-full aspect-square object-cover" />
             <div className="p-5 bg-white">
               <div className="flex gap-4 mb-3 text-gray-700">
                 <Heart size={22} className="hover:text-pink-500 transition" />
                 <MessageCircle size={22} className="hover:text-blue-500 transition" />
                 <Send size={22} className="hover:text-green-500 transition" />
               </div>
               <p className="text-sm text-gray-800 leading-relaxed font-medium">
                 <span className="font-black mr-2 tracking-tighter">{selectedPost.profiles?.username}</span>
                 {selectedPost.content}
               </p>
             </div>
          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 max-w-md w-full bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-around py-4 text-gray-400 z-40 shadow-[0_-5px_20px_rgba(0,0,0,0.02)]">
        <HomeIcon onClick={() => setView('home')} className={view === 'home' ? 'text-blue-600 scale-110' : 'hover:text-gray-600 transition active:scale-90'} />
        <Search onClick={() => setView('search')} className={view === 'search' ? 'text-black scale-110' : 'hover:text-gray-600 transition active:scale-90'} />
        <UserIcon onClick={() => setView('profile')} className={view === 'profile' ? 'text-black scale-110' : 'hover:text-gray-600 transition active:scale-90'} />
      </nav>
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
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-white text-black text-center animate-in fade-in zoom-in-95">
      <script src="https://cdn.tailwindcss.com"></script>
      <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-200 mb-8 rotate-12">
        <GridStreamLogo size={48} color="white" />
      </div>
      <h1 className="text-5xl font-black mb-4 text-blue-600 italic tracking-tighter uppercase">GridStream</h1>
      <p className="text-gray-400 font-bold text-xs uppercase tracking-[0.3em] mb-12 italic">The Next Alpha Dimension</p>
      <div className="w-full max-w-xs space-y-4">
        <input type="text" className="w-full bg-gray-50 border-none p-5 rounded-2xl outline-none text-lg shadow-inner focus:ring-2 focus:ring-blue-100 transition text-center font-bold" placeholder="USERNAME" value={username} onChange={(e) => setUsername(e.target.value)} />
        <button onClick={handleSignUp} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition active:scale-95 tracking-widest uppercase text-sm">Join the stream</button>
      </div>
    </div>
  );
}

function GridStreamLogo({size, color}) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>; }
