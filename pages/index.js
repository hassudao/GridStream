import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User as UserIcon, Grid, List, Image as ImageIcon, Send, ChevronLeft, MapPin, Calendar, Check, AtSign, Zap, LogOut, Mail, Lock, MoreHorizontal, Settings, Save } from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = 'dtb3jpadj'; 
const CLOUDINARY_UPLOAD_PRESET = 'alpha-sns';

export default function App() {
  const [view, setView] = useState('home'); 
  const [posts, setPosts] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [user, setUser] = useState(null);
  
  const [activeProfileId, setActiveProfileId] = useState(null); 
  const [profileInfo, setProfileInfo] = useState(null); 
  const [stats, setStats] = useState({ followers: 0, following: 0, isFollowing: false });
  const [showFollowList, setShowFollowList] = useState(null); 

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ display_name: '', username: '', bio: '', avatar_url: '', header_url: '' });
  const [myProfile, setMyProfile] = useState({ username: '', display_name: '', bio: '', avatar_url: '', header_url: '' });

  const [newPost, setNewPost] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [profileTab, setProfileTab] = useState('grid'); 
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const headerInputRef = useRef(null);

  useEffect(() => {
    checkUser();
    fetchData();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchMyProfile(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      fetchMyProfile(session.user.id);
    }
  }

  async function fetchMyProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setMyProfile(data);
      setEditData(data);
    }
  }

  async function fetchData() {
    const { data: postsData } = await supabase.from('posts').select('*, profiles(id, username, display_name, avatar_url)').order('created_at', { ascending: false });
    if (postsData) setPosts(postsData);
    const { data: profData } = await supabase.from('profiles').select('*');
    if (profData) setAllProfiles(profData);
  }

  async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    return data.secure_url;
  }

  async function handleSaveProfile() {
    setUploading(true);
    let { avatar_url, header_url, display_name, username, bio } = editData;
    if (avatarInputRef.current?.files[0]) avatar_url = await uploadToCloudinary(avatarInputRef.current.files[0]);
    if (headerInputRef.current?.files[0]) header_url = await uploadToCloudinary(headerInputRef.current.files[0]);
    const { error } = await supabase.from('profiles').update({ display_name, username, bio, avatar_url, header_url }).eq('id', user.id);
    if (!error) {
      const updated = { ...editData, avatar_url, header_url };
      setMyProfile(updated);
      setProfileInfo(updated);
      setIsEditing(false);
      fetchData();
    }
    setUploading(false);
  }

  async function handlePost(e) {
    e.preventDefault();
    if (!newPost.trim() || !user) return;
    setUploading(true);
    let imageUrl = null;
    if (fileInputRef.current?.files[0]) imageUrl = await uploadToCloudinary(fileInputRef.current.files[0]);
    await supabase.from('posts').insert([{ content: newPost, user_id: user.id, image_url: imageUrl }]);
    setNewPost('');
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchData();
    setUploading(false);
  }

  const openProfile = async (userId) => {
    setActiveProfileId(userId);
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfileInfo(profile);
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
    if (stats.isFollowing) await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', activeProfileId);
    else await supabase.from('follows').insert([{ follower_id: user.id, following_id: activeProfileId }]);
    openProfile(activeProfileId);
  };

  const getAvatar = (name, url) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;

  const [dmTarget, setDmTarget] = useState(null);

  if (!user) return <AuthScreen fetchData={fetchData} />;

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-20 border-x border-gray-100 font-sans text-black relative shadow-2xl overflow-x-hidden">
      <script src="https://cdn.tailwindcss.com"></script>

      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} getAvatar={getAvatar} />}
      {showFollowList && <FollowListModal type={showFollowList} userId={activeProfileId} onClose={() => setShowFollowList(null)} openProfile={openProfile} getAvatar={getAvatar} />}

      {view === 'home' && (
        <div className="animate-in fade-in">
          <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-50 p-4 flex justify-between items-center">
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-cyan-500 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1">
              <Zap size={24} className="text-blue-600 fill-blue-600" /> GridStream
            </h1>
            <MessageCircle size={24} className="text-gray-700 cursor-pointer" onClick={() => setView('messages')} />
          </header>
          <form onSubmit={handlePost} className="p-4 border-b border-gray-100 bg-white">
            <div className="flex gap-3">
              <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-10 h-10 rounded-full object-cover shadow-sm" onClick={() => openProfile(user.id)} />
              <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none bg-transparent" placeholder="今、何を考えてる？" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-12 mt-2">
              <label className="cursor-pointer text-blue-500 hover:bg-blue-50 p-2 rounded-full transition"><ImageIcon size={22}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
              <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs shadow-lg uppercase tracking-tighter">
                {uploading ? '...' : 'Stream'}
              </button>
            </div>
          </form>
          <div className="divide-y divide-gray-100">{posts.map(post => <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} />)}</div>
        </div>
      )}

      {view === 'profile' && profileInfo && (
        <div className="animate-in fade-in pb-10">
          <div className={`h-32 relative overflow-hidden bg-gray-200 ${!profileInfo.header_url && 'bg-gradient-to-br from-blue-700 via-indigo-600 to-cyan-500'}`}>
            {(isEditing ? editData.header_url : profileInfo.header_url) && <img src={isEditing ? editData.header_url : profileInfo.header_url} className="w-full h-full object-cover" />}
            {isEditing && (
              <label className="absolute inset-0 bg-black/30 flex items-center justify-center cursor-pointer text-white">
                <Camera size={24} /><input type="file" accept="image/*" ref={headerInputRef} className="hidden" onChange={(e) => setEditData({...editData, header_url: URL.createObjectURL(e.target.files[0])})} />
              </label>
            )}
            {!isEditing && <button onClick={() => setView('home')} className="absolute top-4 left-4 bg-black/20 backdrop-blur-md p-2 rounded-full text-white"><ChevronLeft size={20}/></button>}
          </div>
          <div className="px-4 relative">
            <div className="absolute -top-12 left-4">
              <div className="relative">
                <img src={isEditing ? getAvatar(editData.username, editData.avatar_url) : getAvatar(profileInfo.username, profileInfo.avatar_url)} className="w-24 h-24 rounded-full border-4 border-white bg-white shadow-xl object-cover" />
                {isEditing && (
                  <label className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center cursor-pointer text-white border-4 border-white">
                    <Camera size={20} /><input type="file" accept="image/*" ref={avatarInputRef} className="hidden" onChange={(e) => setEditData({...editData, avatar_url: URL.createObjectURL(e.target.files[0])})} />
                  </label>
                )}
              </div>
            </div>
            <div className="flex justify-end py-3 gap-2">
              {user.id === activeProfileId ? (
                isEditing ? (
                  <div className="flex gap-2">
                    <button onClick={() => setIsEditing(false)} className="border border-gray-200 rounded-full px-5 py-1.5 text-xs font-black uppercase">Cancel</button>
                    <button onClick={handleSaveProfile} disabled={uploading} className="bg-blue-600 text-white rounded-full px-5 py-1.5 text-xs font-black uppercase">{uploading ? '...' : 'Save'}</button>
                  </div>
                ) : (
                  <button onClick={() => setIsEditing(true)} className="border border-gray-200 rounded-full px-5 py-1.5 text-xs font-black uppercase">Edit Profile</button>
                )
              ) : (
                <button onClick={toggleFollow} className={`rounded-full px-6 py-1.5 text-xs font-black uppercase transition shadow-md ${stats.isFollowing ? 'bg-gray-100 text-black border border-gray-200' : 'bg-blue-600 text-white'}`}>{stats.isFollowing ? 'Following' : 'Follow'}</button>
              )}
            </div>
            <div className="mt-4 space-y-4">
              {isEditing ? (
                <div className="space-y-3 pt-4">
                  <input className="w-full bg-gray-50 p-3 rounded-xl outline-none font-bold text-sm" value={editData.display_name} onChange={(e) => setEditData({...editData, display_name: e.target.value})} placeholder="Display Name" />
                  <input className="w-full bg-gray-50 p-3 rounded-xl outline-none font-bold text-sm" value={editData.username} onChange={(e) => setEditData({...editData, username: e.target.value.toLowerCase()})} placeholder="Username" />
                  <textarea className="w-full bg-gray-50 p-3 rounded-xl outline-none font-medium text-sm h-20 resize-none" value={editData.bio} onChange={(e) => setEditData({...editData, bio: e.target.value})} placeholder="Bio" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div><h2 className="text-2xl font-black tracking-tighter">{profileInfo.display_name}</h2><p className="text-gray-400 text-sm font-bold">@{profileInfo.username}</p></div>
                  <p className="text-[15px] font-medium leading-relaxed">{profileInfo.bio || 'GridStream member.'}</p>
                  <div className="flex gap-6 pt-1">
                    <button onClick={() => setShowFollowList('following')} className="hover:opacity-60 flex gap-1.5 items-center"><span className="font-black text-lg">{stats.following}</span><span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Following</span></button>
                    <button onClick={() => setShowFollowList('followers')} className="hover:opacity-60 flex gap-1.5 items-center"><span className="font-black text-lg">{stats.followers}</span><span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Followers</span></button>
                  </div>
                </div>
              )}
            </div>
          </div>
          {!isEditing && (
            <>
              <div className="flex border-b border-gray-100 mt-6 sticky top-0 bg-white/95 z-40">
                <button onClick={() => setProfileTab('grid')} className={`flex-grow py-4 flex justify-center ${profileTab === 'grid' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-300'}`}><Grid size={22}/></button>
                <button onClick={() => setProfileTab('list')} className={`flex-grow py-4 flex justify-center ${profileTab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-300'}`}><List size={22}/></button>
              </div>
              <div className={profileTab === 'grid' ? "grid grid-cols-3 gap-[2px]" : "divide-y divide-gray-100"}>
                {posts.filter(p => p.user_id === activeProfileId).map(post => 
                  profileTab === 'grid' ? ( post.image_url && <img key={post.id} src={post.image_url} className="aspect-square object-cover" onClick={() => setSelectedPost(post)} /> ) : ( <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} /> )
                )}
              </div>
            </>
          )}
        </div>
      )}

      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSelectedPost={setSelectedPost} />}
      {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} setDmTarget={setDmTarget} getAvatar={getAvatar} openProfile={openProfile} />}

      <nav className="fixed bottom-0 max-w-md w-full bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-around py-4 text-gray-300 z-40 shadow-sm">
        <HomeIcon onClick={() => setView('home')} className={`cursor-pointer ${view === 'home' ? 'text-blue-600' : ''}`} />
        <Search onClick={() => setView('search')} className={`cursor-pointer ${view === 'search' ? 'text-black' : ''}`} />
        <MessageCircle onClick={() => setView('messages')} className={`cursor-pointer ${view === 'messages' ? 'text-black' : ''}`} />
        <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer ${view === 'profile' && activeProfileId === user.id ? 'text-black' : ''}`} />
      </nav>
    </div>
  );
}

// --- SUB-COMPONENTS ---

function PostCard({ post, openProfile, getAvatar }) {
  return (
    <article className="p-4 flex gap-3 hover:bg-gray-50 transition">
      <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer object-cover shadow-sm" onClick={() => openProfile(post.profiles.id)} />
      <div className="flex-grow min-w-0">
        <div className="flex items-center gap-1 cursor-pointer" onClick={() => openProfile(post.profiles.id)}>
          <span className="font-black text-sm truncate">{post.profiles?.display_name}</span>
          <span className="text-gray-400 text-[11px] font-bold truncate">@{post.profiles?.username}</span>
        </div>
        <p className="text-sm mt-1 text-gray-800 font-medium leading-relaxed">{post.content}</p>
        {post.image_url && <img src={post.image_url} className="mt-3 rounded-2xl w-full max-h-80 object-cover border border-gray-100 shadow-sm" />}
        <div className="flex justify-between mt-4 text-gray-400 max-w-[200px]"><Heart size={18}/><MessageCircle size={18}/><Share2 size={18}/></div>
      </div>
    </article>
  );
}

function FollowListModal({ type, userId, onClose, openProfile, getAvatar }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    async function fetchList() {
      const targetColumn = type === 'followers' ? 'follower_id' : 'following_id';
      const column = type === 'followers' ? 'following_id' : 'follower_id';
      const { data } = await supabase.from('follows').select(`profiles:${targetColumn}(*)`).eq(column, userId);
      if (data) setList(data.map(item => item.profiles));
    }
    fetchList();
  }, [type, userId]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center">
      <div className="bg-white w-full max-w-md rounded-t-[2.5rem] max-h-[70vh] flex flex-col animate-in slide-in-from-bottom duration-300">
        <div className="p-6 border-b border-gray-50 flex justify-between items-center"><h3 className="font-black text-lg uppercase tracking-widest text-blue-600">{type}</h3><X onClick={onClose} className="cursor-pointer text-gray-300" /></div>
        <div className="overflow-y-auto p-4 space-y-4">
          {list.map(u => (
            <div key={u.id} className="flex items-center gap-4 cursor-pointer hover:bg-gray-50 p-2 rounded-2xl transition" onClick={() => { openProfile(u.id); onClose(); }}>
              <img src={getAvatar(u.username, u.avatar_url)} className="w-12 h-12 rounded-full object-cover shadow-sm" />
              <div><p className="font-black text-sm">{u.display_name}</p><p className="text-gray-400 text-xs font-bold">@{u.username}</p></div>
            </div>
          ))}
          {list.length === 0 && <p className="text-center text-gray-400 py-20 font-bold italic">Nothing here yet.</p>}
        </div>
      </div>
    </div>
  );
}

function SearchView({ posts, openProfile, searchQuery, setSearchQuery, setSelectedPost }) {
  return (
    <div className="animate-in fade-in">
      <div className="p-4 sticky top-0 bg-white/95 z-10 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input type="text" placeholder="DISCOVER" className="w-full bg-gray-100 rounded-xl py-2 pl-10 pr-4 outline-none text-xs font-bold" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-[2px]">
        {posts.filter(p => p.image_url && (p.content.includes(searchQuery) || p.profiles?.username.includes(searchQuery))).map((post) => (
          <img key={post.id} src={post.image_url} className="aspect-square w-full h-full object-cover cursor-pointer" onClick={() => setSelectedPost(post)} />
        ))}
      </div>
    </div>
  );
}

function MessagesList({ allProfiles, user, setDmTarget, getAvatar, openProfile }) {
  return (
    <div className="animate-in fade-in">
      <header className="p-4 border-b border-gray-100 font-black text-lg text-center uppercase italic">Stream Chat</header>
      <div className="p-2">
        {allProfiles.filter(p => p.id !== user.id).map(u => (
          <div key={u.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-2xl cursor-pointer" onClick={() => setDmTarget(u)}>
            <img src={getAvatar(u.username, u.avatar_url)} className="w-14 h-14 rounded-full object-cover shadow-sm" />
            <div className="flex-grow border-b border-gray-50 pb-2"><p className="font-bold text-sm">{u.display_name}</p><p className="text-xs text-blue-500 font-medium">Tap to Chat</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DMScreen({ target, setDmTarget, currentUser, getAvatar }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const scrollRef = useRef();
  useEffect(() => {
    fetchMessages();
    const channel = supabase.channel(`chat:${target.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
      if ((p.new.sender_id === currentUser.id && p.new.receiver_id === target.id) || (p.new.sender_id === target.id && p.new.receiver_id === currentUser.id)) setMessages(prev => [...prev, p.new]);
    }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [target]);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  async function fetchMessages() {
    const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
    if (data) setMessages(data);
  }
  async function sendMsg(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const t = text; setText('');
    await supabase.from('messages').insert([{ text: t, sender_id: currentUser.id, receiver_id: target.id }]);
  }
  return (
    <div className="fixed inset-0 z-50 bg-[#f8f9fa] flex flex-col animate-in slide-in-from-right duration-300">
      <header className="bg-white p-4 flex items-center gap-3 border-b border-gray-100 shadow-sm sticky top-0">
        <ChevronLeft onClick={() => setDmTarget(null)} className="cursor-pointer" />
        <img src={getAvatar(target.username, target.avatar_url)} className="w-10 h-10 rounded-full object-cover" />
        <div><p className="font-black text-sm leading-tight">{target.display_name}</p><p className="text-[10px] text-gray-400 font-bold">@{target.username}</p></div>
      </header>
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-[1.5rem] text-sm ${m.sender_id === currentUser.id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100 shadow-sm'}`}>{m.text}</div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <form onSubmit={sendMsg} className="p-4 bg-white border-t border-gray-50 flex gap-2">
        <input type="text" className="flex-grow bg-gray-50 p-4 rounded-2xl text-sm outline-none" placeholder="Aa" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg active:scale-95 transition"><Send size={18}/></button>
      </form>
    </div>
  );
}

function AuthScreen({ fetchData }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  async function handleAuth(e) {
    e.preventDefault();
    setLoading(true);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) alert(error.message);
      else if (data?.user) {
        const initialId = displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000);
        await supabase.from('profiles').upsert([{ id: data.user.id, username: initialId, display_name: displayName }]);
        alert("Welcome to GridStream!");
      }
    }
    setLoading(false);
    fetchData();
  }
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-white">
      <script src="https://cdn.tailwindcss.com"></script>
      <div className="w-20 h-20 bg-gradient-to-tr from-blue-700 to-cyan-500 rounded-[2rem] flex items-center justify-center shadow-2xl mb-6 rotate-6 animate-pulse"><Zap size={40} color="white" fill="white" /></div>
      <h1 className="text-4xl font-black mb-10 text-blue-700 italic tracking-tighter uppercase">GridStream</h1>
      <form onSubmit={handleAuth} className="w-full max-w-xs space-y-4">
        {!isLogin && <input type="text" placeholder="DISPLAY NAME" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />}
        <input type="email" placeholder="EMAIL" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="PASSWORD" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="w-full bg-blue-700 text-white font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest text-xs">{loading ? '...' : (isLogin ? 'Login' : 'Join')}</button>
      </form>
      <button onClick={() => setIsLogin(!isLogin)} className="mt-8 text-xs font-black text-gray-400 uppercase tracking-widest">{isLogin ? "Create Account" : "Back to Login"}</button>
    </div>
  );
                                              }
