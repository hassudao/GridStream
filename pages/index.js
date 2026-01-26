import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User as UserIcon, Grid, List, Image as ImageIcon, Send, ChevronLeft, MapPin, Calendar, Check, AtSign, Zap, LogOut, Mail, Lock } from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = 'dtb3jpadj'; 
const CLOUDINARY_UPLOAD_PRESET = 'alpha-sns';

export default function App() {
  const [view, setView] = useState('home'); 
  const [posts, setPosts] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [user, setUser] = useState(null);
  
  // プロフィール表示
  const [activeProfileId, setActiveProfileId] = useState(null); 
  const [profileInfo, setProfileInfo] = useState(null); 
  const [stats, setStats] = useState({ followers: 0, following: 0, isFollowing: false });
  const [showFollowList, setShowFollowList] = useState(null); 

  const [newPost, setNewPost] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [profileTab, setProfileTab] = useState('grid'); 
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [dmTarget, setDmTarget] = useState(null); 
  const fileInputRef = useRef(null);

  useEffect(() => {
    checkUser();
    fetchData();
  }, []);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) setUser(session.user);
  }

  async function fetchData() {
    const { data: postsData } = await supabase.from('posts').select('*, profiles(id, username, display_name, avatar_url)').order('created_at', { ascending: false });
    if (postsData) setPosts(postsData);
    const { data: profData } = await supabase.from('profiles').select('*');
    if (profData) setAllProfiles(profData);
  }

  // プロフィールを開く（ガードレール付き）
  const openProfile = async (userId) => {
    if (!userId) return;
    setActiveProfileId(userId);
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profile) setProfileInfo(profile);
    
    // フォロー情報の取得
    const { count: fers } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId);
    const { count: fing } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId);
    
    let isFollowing = false;
    if (user && user.id !== userId) {
      const { data } = await supabase.from('follows').select('*').eq('follower_id', user.id).eq('following_id', userId).single();
      isFollowing = !!data;
    }

    setStats({ followers: fers || 0, following: fing || 0, isFollowing });
    setView('profile');
    setIsEditing(false);
  };

  const toggleFollow = async () => {
    if (!user || user.id === activeProfileId) return;
    if (stats.isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', activeProfileId);
    } else {
      await supabase.from('follows').insert([{ follower_id: user.id, following_id: activeProfileId }]);
    }
    openProfile(activeProfileId);
  };

  const getAvatar = (name, url) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name || 'default'}`;

  if (!user) return <AuthScreen setUser={setUser} fetchData={fetchData} />;

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-20 border-x border-gray-100 font-sans text-black relative shadow-2xl overflow-x-hidden">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      <script src="https://cdn.tailwindcss.com"></script>

      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} getAvatar={getAvatar} />}
      {showFollowList && <FollowListModal type={showFollowList} userId={activeProfileId} onClose={() => setShowFollowList(null)} openProfile={openProfile} getAvatar={getAvatar} />}

      {/* --- HOME VIEW --- */}
      {view === 'home' && (
        <div className="animate-in fade-in duration-500">
          <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-50 p-4 flex justify-between items-center">
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-cyan-500 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1">
              <Zap size={24} className="text-blue-600 fill-blue-600" /> GridStream
            </h1>
            <MessageCircle size={24} className="text-gray-700 cursor-pointer" onClick={() => setView('messages')} />
          </header>
          
          <div className="divide-y divide-gray-100">
            {posts.map(post => <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} />)}
          </div>
        </div>
      )}

      {/* --- PROFILE VIEW --- */}
      {view === 'profile' && profileInfo && (
        <div className="animate-in fade-in duration-500 pb-10">
          <div className={`h-32 relative ${!profileInfo.header_url && 'bg-gradient-to-br from-blue-700 to-cyan-500'}`}>
            {profileInfo.header_url && <img src={profileInfo.header_url} className="w-full h-full object-cover" />}
            <button onClick={() => setView('home')} className="absolute top-4 left-4 bg-black/20 p-2 rounded-full text-white"><ChevronLeft size={20}/></button>
          </div>
          
          <div className="px-4 relative">
            <div className="absolute -top-12 left-4">
              <img src={getAvatar(profileInfo.username, profileInfo.avatar_url)} className="w-24 h-24 rounded-full border-4 border-white bg-white shadow-lg object-cover" />
            </div>
            <div className="flex justify-end py-3 gap-2">
              {user.id === activeProfileId ? (
                <button className="border border-gray-200 rounded-full px-5 py-1.5 text-xs font-black uppercase">Edit</button>
              ) : (
                <button onClick={toggleFollow} className={`rounded-full px-6 py-1.5 text-xs font-black uppercase transition ${stats.isFollowing ? 'bg-gray-100 text-black border border-gray-200' : 'bg-blue-600 text-white'}`}>
                  {stats.isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
            <div className="mt-2 space-y-1">
              <h2 className="text-2xl font-black tracking-tighter">{profileInfo.display_name}</h2>
              <p className="text-gray-400 text-sm font-bold">@{profileInfo.username}</p>
              <p className="text-sm font-medium pt-2">{profileInfo.bio || 'GridStream member'}</p>
              <div className="flex gap-4 pt-3">
                <button onClick={() => setShowFollowList('following')} className="flex gap-1 items-center"><span className="font-black">{stats.following}</span><span className="text-gray-400 text-[10px] font-black uppercase">Following</span></button>
                <button onClick={() => setShowFollowList('followers')} className="flex gap-1 items-center"><span className="font-black">{stats.followers}</span><span className="text-gray-400 text-[10px] font-black uppercase">Followers</span></button>
              </div>
            </div>
          </div>

          <div className="flex border-b border-gray-100 mt-6 sticky top-0 bg-white/95 z-20">
            <button onClick={() => setProfileTab('grid')} className={`flex-grow py-4 flex justify-center ${profileTab === 'grid' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-300'}`}><Grid size={22}/></button>
            <button onClick={() => setProfileTab('list')} className={`flex-grow py-4 flex justify-center ${profileTab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-300'}`}><List size={22}/></button>
          </div>

          <div className={profileTab === 'grid' ? "grid grid-cols-3 gap-[2px]" : "divide-y divide-gray-100"}>
            {posts.filter(p => p.user_id === activeProfileId).map(post => 
              profileTab === 'grid' ? (
                post.image_url && <img key={post.id} src={post.image_url} className="aspect-square object-cover cursor-pointer hover:opacity-80 transition" onClick={() => setSelectedPost(post)} />
              ) : (
                <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} />
              )
            )}
          </div>
        </div>
      )}

      {/* --- SEARCH / MESSAGES / POPUP (略) --- */}
      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSelectedPost={setSelectedPost} />}
      {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} setDmTarget={setDmTarget} getAvatar={getAvatar} openProfile={openProfile} />}

      {/* 詳細モーダル */}
      {selectedPost && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setSelectedPost(null)}>
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
             <img src={selectedPost.image_url} className="w-full aspect-square object-cover" />
             <div className="p-4"><p className="text-sm font-medium">{selectedPost.content}</p></div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 max-w-md w-full bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-around py-4 text-gray-300 z-40">
        <HomeIcon onClick={() => setView('home')} className={`cursor-pointer ${view === 'home' ? 'text-blue-600' : ''}`} />
        <Search onClick={() => setView('search')} className={`cursor-pointer ${view === 'search' ? 'text-black' : ''}`} />
        <MessageCircle onClick={() => setView('messages')} className={`cursor-pointer ${view === 'messages' ? 'text-black' : ''}`} />
        <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer ${view === 'profile' && activeProfileId === user.id ? 'text-black' : ''}`} />
      </nav>
    </div>
  );
}

// --- 以下、サブコンポーネント (修正版) ---

function PostCard({ post, openProfile, getAvatar }) {
  if (!post.profiles) return null;
  return (
    <article className="p-4 flex gap-3">
      <img src={getAvatar(post.profiles.username, post.profiles.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer flex-shrink-0 object-cover" onClick={() => openProfile(post.profiles.id)} />
      <div className="flex-grow min-w-0">
        <div className="flex items-center gap-1 cursor-pointer" onClick={() => openProfile(post.profiles.id)}>
          <span className="font-black text-sm truncate">{post.profiles.display_name}</span>
          <span className="text-gray-400 text-[11px] font-bold truncate">@{post.profiles.username}</span>
        </div>
        <p className="text-sm mt-1 text-gray-800 leading-relaxed">{post.content}</p>
        {post.image_url && <img src={post.image_url} className="mt-3 rounded-2xl w-full border border-gray-100 shadow-sm" />}
        <div className="flex justify-between mt-4 text-gray-400 max-w-[200px]"><Heart size={18}/><MessageCircle size={18}/><Share2 size={18}/></div>
      </div>
    </article>
  );
}

function FollowListModal({ type, userId, onClose, openProfile, getAvatar }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    async function fetchList() {
      const col = type === 'followers' ? 'following_id' : 'follower_id';
      const targetCol = type === 'followers' ? 'follower_id' : 'following_id';
      const { data } = await supabase.from('follows').select(`profiles:${targetCol}(*)`).eq(col, userId);
      if (data) setList(data.map(item => item.profiles).filter(p => p !== null));
    }
    fetchList();
  }, [type, userId]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end justify-center">
      <div className="bg-white w-full max-w-md rounded-t-[2rem] max-h-[60vh] overflow-y-auto p-4 animate-in slide-in-from-bottom">
        <div className="flex justify-between items-center pb-4 border-b">
          <h3 className="font-black uppercase tracking-tighter">{type}</h3>
          <X onClick={onClose} className="cursor-pointer" />
        </div>
        {list.map(u => (
          <div key={u.id} className="flex items-center gap-3 py-3 cursor-pointer" onClick={() => { openProfile(u.id); onClose(); }}>
            <img src={getAvatar(u.username, u.avatar_url)} className="w-10 h-10 rounded-full" />
            <div><p className="font-bold text-sm">{u.display_name}</p><p className="text-xs text-gray-400">@{u.username}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthScreen({ setUser, fetchData }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [displayName, setDisplayName] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    if (isLogin) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
      else if (data.user) { setUser(data.user); fetchData(); }
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) alert(error.message);
      else if (data.user) {
        const uid = displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random()*100);
        await supabase.from('profiles').upsert([{ id: data.user.id, username: uid, display_name: displayName }]);
        setUser(data.user); fetchData();
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-10 bg-white">
      <Zap size={50} className="text-blue-600 mb-4" />
      <h1 className="text-3xl font-black italic uppercase tracking-tighter mb-8 text-blue-700">GridStream</h1>
      <form onSubmit={handleAuth} className="w-full space-y-4">
        {!isLogin && <input type="text" placeholder="DISPLAY NAME" className="w-full bg-gray-50 p-4 rounded-2xl font-bold" value={displayName} onChange={e => setDisplayName(e.target.value)} required />}
        <input type="email" placeholder="EMAIL" className="w-full bg-gray-50 p-4 rounded-2xl font-bold" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="PASSWORD" className="w-full bg-gray-50 p-4 rounded-2xl font-bold" value={password} onChange={e => setPassword(e.target.value)} required />
        <button className="w-full bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl">{isLogin ? 'LOGIN' : 'JOIN'}</button>
      </form>
      <button onClick={() => setIsLogin(!isLogin)} className="mt-8 text-xs font-black text-gray-400 uppercase tracking-widest">{isLogin ? 'Create Account' : 'Back to Login'}</button>
    </div>
  );
}

function SearchView({ posts, openProfile, searchQuery, setSearchQuery, setSelectedPost }) {
  return (
    <div className="animate-in fade-in">
      <div className="p-4 border-b border-gray-100">
        <input type="text" placeholder="DISCOVER" className="w-full bg-gray-100 rounded-xl py-2 px-4 font-bold text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-[2px]">
        {posts.filter(p => p.image_url && p.content.includes(searchQuery)).map((post) => (
          <img key={post.id} src={post.image_url} className="aspect-square object-cover" onClick={() => setSelectedPost(post)} />
        ))}
      </div>
    </div>
  );
}

function MessagesList({ allProfiles, user, setDmTarget, getAvatar, openProfile }) {
  return (
    <div className="animate-in fade-in">
      <header className="p-4 border-b font-black text-center uppercase tracking-tighter italic">Messages</header>
      {allProfiles.filter(p => p.id !== user.id).map(u => (
        <div key={u.id} className="flex items-center gap-4 p-4 border-b border-gray-50 cursor-pointer" onClick={() => setDmTarget(u)}>
          <img src={getAvatar(u.username, u.avatar_url)} className="w-12 h-12 rounded-full" onClick={(e) => { e.stopPropagation(); openProfile(u.id); }} />
          <div><p className="font-bold text-sm">{u.display_name}</p><p className="text-xs text-blue-500 font-bold italic">Tap to chat</p></div>
        </div>
      ))}
    </div>
  );
}

function DMScreen({ target, setDmTarget, currentUser, getAvatar }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  useEffect(() => {
    const fetchMsgs = async () => {
      const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
      if (data) setMessages(data);
    };
    fetchMsgs();
  }, [target]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await supabase.from('messages').insert([{ text, sender_id: currentUser.id, receiver_id: target.id }]);
    setText('');
    const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
    setMessages(data);
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <header className="p-4 flex items-center gap-4 border-b">
        <ChevronLeft onClick={() => setDmTarget(null)} />
        <img src={getAvatar(target.username, target.avatar_url)} className="w-8 h-8 rounded-full" />
        <span className="font-black text-sm">{target.display_name}</span>
      </header>
      <div className="flex-grow p-4 overflow-y-auto space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-2xl max-w-[80%] text-sm ${m.sender_id === currentUser.id ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>{m.text}</div>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="p-4 border-t flex gap-2">
        <input className="flex-grow bg-gray-50 p-3 rounded-xl outline-none" value={text} onChange={e => setText(e.target.value)} />
        <button className="bg-blue-600 text-white px-4 rounded-xl"><Send size={18}/></button>
      </form>
    </div>
  );
        }
