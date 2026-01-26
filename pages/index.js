import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User as UserIcon, RefreshCw, Grid, List, Plus, Image as ImageIcon, Send, ChevronLeft, MapPin, Calendar, Link as LinkIcon } from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = 'dtb3jpadj'; 
const CLOUDINARY_UPLOAD_PRESET = 'alpha-sns';

export default function App() {
  const [view, setView] = useState('home'); 
  const [posts, setPosts] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [profileData, setProfileData] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [profileTab, setProfileTab] = useState('grid'); // 'grid' or 'list'
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
    <div className="max-w-md mx-auto bg-white min-h-screen pb-20 border-x border-gray-100 font-sans text-black relative shadow-2xl">
      <script src="https://cdn.tailwindcss.com"></script>

      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} />}

      {/* --- HOME VIEW --- */}
      {view === 'home' && (
        <div className="animate-in fade-in duration-500">
          <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-50 p-4 flex justify-between items-center">
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent italic tracking-tighter uppercase">GridStream</h1>
            <MessageCircle size={24} className="text-gray-700 cursor-pointer" onClick={() => setView('messages')} />
          </header>
          {/* ...ストーリーバー & 投稿フォーム (省略せず維持) ... */}
          <form onSubmit={handlePost} className="p-4 border-b border-gray-100 bg-white">
            <div className="flex gap-3">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`} className="w-10 h-10 rounded-full" />
              <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none" placeholder="What's happening?" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-12">
              <label className="cursor-pointer text-blue-500 p-2 rounded-full hover:bg-blue-50 transition"><ImageIcon size={20}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
              <button type="submit" className="bg-blue-600 text-white px-5 py-1.5 rounded-full font-bold text-sm shadow-md">{uploading ? '...' : 'POST'}</button>
            </div>
          </form>
          <div className="divide-y divide-gray-100">
            {posts.map(post => <PostCard key={post.id} post={post} setDmTarget={setDmTarget} />)}
          </div>
        </div>
      )}

      {/* --- PROFILE VIEW (ハイブリッド設計) --- */}
      {view === 'profile' && (
        <div className="animate-in fade-in duration-500 pb-10">
          {/* ヘッダー画像 */}
          <div className="h-32 bg-gradient-to-r from-blue-400 to-indigo-500 relative">
            {profileData?.header_url && <img src={profileData.header_url} className="w-full h-full object-cover" />}
            <button className="absolute bottom-2 right-2 bg-black/50 p-2 rounded-full text-white backdrop-blur-md"><Camera size={16}/></button>
          </div>
          
          {/* プロフィール詳細 */}
          <div className="px-4 relative">
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
              <p className="mt-3 text-[15px] leading-relaxed">GridStream Alpha Developer / SNS Innovator 🚀</p>
              <div className="flex flex-wrap gap-4 mt-3 text-gray-500 text-sm">
                <span className="flex items-center gap-1"><MapPin size={14}/> Tokyo, Japan</span>
                <span className="flex items-center gap-1"><Calendar size={14}/> 2026年1月から利用中</span>
              </div>
              <div className="flex gap-4 mt-4">
                <p className="text-sm"><strong>128</strong> <span className="text-gray-500">フォロー中</span></p>
                <p className="text-sm"><strong>1.2K</strong> <span className="text-gray-500">フォロワー</span></p>
              </div>
            </div>
          </div>

          {/* 表示切り替えタブ */}
          <div className="flex border-b border-gray-100 mt-6">
            <button onClick={() => setProfileTab('grid')} className={`flex-grow py-3 flex justify-center transition ${profileTab === 'grid' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}><Grid size={22}/></button>
            <button onClick={() => setProfileTab('list')} className={`flex-grow py-3 flex justify-center transition ${profileTab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}><List size={22}/></button>
          </div>

          {/* コンテンツ表示 */}
          {profileTab === 'grid' ? (
            <div className="grid grid-cols-3 gap-[2px]">
              {posts.filter(p => p.user_id === user.id && p.image_url).map(post => (
                <div key={post.id} className="aspect-square bg-gray-100 cursor-pointer overflow-hidden group relative" onClick={() => setSelectedPost(post)}>
                  <img src={post.image_url} className="w-full h-full object-cover transition group-hover:scale-110" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition"><Heart size={14} className="mr-1 fill-white"/> 12</div>
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

      {/* ポップアップ */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in zoom-in-95" onClick={() => setSelectedPost(null)}>
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative" onClick={e => e.stopPropagation()}>
             <div className="p-4 border-b border-gray-50 flex items-center gap-2">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedPost.profiles?.username}`} className="w-8 h-8 rounded-full" />
                <span className="font-bold text-xs">{selectedPost.profiles?.username}</span>
                <X size={18} className="ml-auto text-gray-400 cursor-pointer" onClick={() => setSelectedPost(null)} />
             </div>
             <img src={selectedPost.image_url} className="w-full aspect-square object-cover" />
             <div className="p-5">
               <div className="flex gap-4 mb-3 text-gray-700"><Heart size={22} /><MessageCircle size={22} /><Send size={22} /></div>
               <p className="text-sm leading-relaxed"><span className="font-bold mr-2">{selectedPost.profiles?.username}</span>{selectedPost.content}</p>
             </div>
          </div>
        </div>
      )}

      {/* ナビゲーション */}
      <nav className="fixed bottom-0 max-w-md w-full bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-around py-4 text-gray-400 z-40">
        <HomeIcon onClick={() => setView('home')} className={view === 'home' ? 'text-blue-600' : ''} />
        <Search onClick={() => setView('search')} className={view === 'search' ? 'text-black' : ''} />
        <UserIcon onClick={() => setView('profile')} className={view === 'profile' ? 'text-black' : ''} />
      </nav>
    </div>
  );
}

function PostCard({ post, setDmTarget }) {
  return (
    <article className="p-4 flex gap-3 animate-in slide-in-from-bottom-2">
      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.profiles?.username}`} className="w-10 h-10 rounded-full flex-shrink-0 cursor-pointer" onClick={() => setDmTarget && setDmTarget(post.profiles)} />
      <div className="flex-grow">
        <div className="flex items-center gap-1 font-bold text-sm">{post.profiles?.username}</div>
        <p className="text-sm mt-1 text-gray-800 leading-relaxed whitespace-pre-wrap">{post.content}</p>
        {post.image_url && <img src={post.image_url} className="mt-3 rounded-2xl border border-gray-100 max-h-80 w-full object-cover" />}
        <div className="flex justify-between mt-4 text-gray-400 max-w-[200px]"><Heart size={18}/><MessageCircle size={18}/><Share2 size={18}/></div>
      </div>
    </article>
  );
}

// ... DMScreen & LoginScreen (前回のまま維持) ...
