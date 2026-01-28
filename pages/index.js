import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User as UserIcon, Grid, List, Image as ImageIcon, Send, ChevronLeft, Zap, Mail, Lock, Settings, Moon, Sun, AlertCircle, Trash2 } from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = 'dtb3jpadj'; 
const CLOUDINARY_UPLOAD_PRESET = 'alpha-sns';

export default function App() {
  const [view, setView] = useState('home'); 
  const [posts, setPosts] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  
  const [activeProfileId, setActiveProfileId] = useState(null); 
  const [profileInfo, setProfileInfo] = useState(null); 
  const [stats, setStats] = useState({ followers: 0, following: 0, isFollowing: false });
  const [showFollowList, setShowFollowList] = useState(null); 

  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editData, setEditData] = useState({ display_name: '', username: '', bio: '', avatar_url: '', header_url: '' });
  const [myProfile, setMyProfile] = useState({ username: '', display_name: '', bio: '', avatar_url: '', header_url: '' });

  const [newPost, setNewPost] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [profileTab, setProfileTab] = useState('list'); 
  const [uploading, setUploading] = useState(false);
  const [dmTarget, setDmTarget] = useState(null);
  
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const headerInputRef = useRef(null);

  useEffect(() => {
    checkUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) fetchMyProfile(currentUser.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchData();
  }, [user]);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      fetchMyProfile(session.user.id);
    }
  }

  async function fetchMyProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) { setMyProfile(data); setEditData(data); }
  }

  async function fetchData() {
    const { data: postsData } = await supabase
      .from('posts')
      .select(`
        *,
        profiles(id, username, display_name, avatar_url),
        likes(user_id),
        comments(*, profiles(username, display_name, avatar_url))
      `)
      .order('created_at', { ascending: false });
    
    if (postsData) {
      const formattedPosts = postsData.map(post => ({
        ...post,
        like_count: post.likes?.length || 0,
        is_liked: user ? post.likes?.some(l => l.user_id === user.id) : false,
        comment_list: (post.comments || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      }));
      setPosts(formattedPosts);
    }
    
    const { data: profData } = await supabase.from('profiles').select('*');
    if (profData) setAllProfiles(profData);
  }

  async function toggleLike(postId, isLiked) {
    if (!user) return;
    setPosts(prev => prev.map(p => {
      if (p.id === postId) return { ...p, is_liked: !isLiked, like_count: isLiked ? p.like_count - 1 : p.like_count + 1 };
      return p;
    }));
    if (isLiked) await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id);
    else await supabase.from('likes').insert([{ post_id: postId, user_id: user.id }]);
    fetchData();
  }

  async function handleSendComment(postId, content) {
    if (!content.trim() || !user) return;
    await supabase.from('comments').insert([{ post_id: postId, user_id: user.id, content: content.trim() }]);
    fetchData();
  }

  async function handleDeleteComment(commentId) {
    if (!window.confirm("この返信を削除しますか？")) return;
    await supabase.from('comments').delete().eq('id', commentId).eq('user_id', user.id);
    fetchData();
  }

  async function toggleFollow() {
    if (!user || user.id === activeProfileId) return;
    if (stats.isFollowing) await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', activeProfileId);
    else await supabase.from('follows').insert([{ follower_id: user.id, following_id: activeProfileId }]);
    openProfile(activeProfileId);
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
    const { error } = await supabase.from('profiles').update({ display_name, username: username.toLowerCase(), bio, avatar_url, header_url }).eq('id', user.id);
    if (!error) { setMyProfile({ ...editData, avatar_url, header_url }); setIsEditing(false); fetchData(); }
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

  const getAvatar = (name, url) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;

  if (!user) return <AuthScreen fetchData={fetchData} />;

  return (
    <div className={`max-w-md mx-auto min-h-screen pb-20 border-x font-sans relative shadow-2xl transition-colors duration-300 ${darkMode ? 'bg-black text-white border-gray-800' : 'bg-white text-black border-gray-100'}`}>
      <script src="https://cdn.tailwindcss.com"></script>

      {/* --- モーダル・全画面レイヤー --- */}
      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} getAvatar={getAvatar} darkMode={darkMode} />}
      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} user={user} darkMode={darkMode} setDarkMode={setDarkMode} />}
      {showFollowList && <FollowListModal type={showFollowList} userId={activeProfileId} onClose={() => setShowFollowList(null)} openProfile={openProfile} getAvatar={getAvatar} darkMode={darkMode} />}
      {selectedPost && <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} getAvatar={getAvatar} openProfile={openProfile} darkMode={darkMode} />}

      {/* --- メインコンテンツ --- */}
      {view === 'home' && (
        <div className="animate-in fade-in">
          <header className={`sticky top-0 z-30 backdrop-blur-md border-b p-4 flex justify-between items-center ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-50'}`}>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-cyan-500 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1">
              <Zap size={24} className="text-blue-600 fill-blue-600" /> GridStream
            </h1>
            <MessageCircle size={24} className="cursor-pointer" onClick={() => setView('messages')} />
          </header>
          
          <form onSubmit={handlePost} className={`p-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            <div className="flex gap-3">
              <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-10 h-10 rounded-full object-cover shadow-sm cursor-pointer" onClick={() => openProfile(user.id)} />
              <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none bg-transparent font-medium" placeholder="今、何を考えてる？" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-12 mt-2">
              <label className="cursor-pointer text-blue-500 p-2 hover:bg-blue-50/10 rounded-full transition"><ImageIcon size={22}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
              <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs uppercase tracking-tighter shadow-lg">
                {uploading ? '...' : 'Stream'}
              </button>
            </div>
          </form>

          <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
            {posts.map(post => (
              <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onDelete={(id) => { supabase.from('posts').delete().eq('id', id).then(() => fetchData()); }} onLike={toggleLike} onSendComment={handleSendComment} onDeleteComment={handleDeleteComment} currentUser={user} darkMode={darkMode} />
            ))}
          </div>
        </div>
      )}

      {view === 'profile' && profileInfo && (
        <div className="animate-in fade-in pb-10">
          <div className={`h-32 relative bg-gray-200 ${!profileInfo.header_url && 'bg-gradient-to-br from-blue-700 to-cyan-500'}`}>
            <img src={isEditing ? editData.header_url : profileInfo.header_url} className="w-full h-full object-cover" />
            {isEditing && <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer text-white transition hover:bg-black/50"><Camera size={24} /><input type="file" ref={headerInputRef} className="hidden" onChange={(e) => setEditData({...editData, header_url: URL.createObjectURL(e.target.files[0])})} /></label>}
            {!isEditing && <button onClick={() => setView('home')} className="absolute top-4 left-4 bg-black/30 backdrop-blur-md p-2 rounded-full text-white transition hover:bg-black/50"><ChevronLeft size={20}/></button>}
            {!isEditing && user.id === activeProfileId && <button onClick={() => setShowSettings(true)} className="absolute top-4 right-4 bg-black/30 backdrop-blur-md p-2 rounded-full text-white transition hover:bg-black/50"><Settings size={20}/></button>}
          </div>
          
          <div className="px-4 relative">
            <div className="absolute -top-12 left-4">
              <div className="relative group">
                <img src={isEditing ? getAvatar(editData.username, editData.avatar_url) : getAvatar(profileInfo.username, profileInfo.avatar_url)} className={`w-24 h-24 rounded-full border-4 object-cover shadow-xl ${darkMode ? 'border-black bg-black' : 'border-white bg-white'}`} />
                {isEditing && <label className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center cursor-pointer text-white transition hover:bg-black/50 border-4 border-transparent"><Camera size={20} /><input type="file" ref={avatarInputRef} className="hidden" onChange={(e) => setEditData({...editData, avatar_url: URL.createObjectURL(e.target.files[0])})} /></label>}
              </div>
            </div>
            <div className="flex justify-end py-3">
              {user.id === activeProfileId ? (
                <button onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)} className="border rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-tighter hover:bg-gray-50/10 transition">
                  {isEditing ? (uploading ? '...' : 'Save') : 'Edit Profile'}
                </button>
              ) : (
                <button onClick={toggleFollow} className={`rounded-full px-6 py-1.5 text-xs font-black uppercase transition shadow-md ${stats.isFollowing ? 'bg-gray-100 text-black border' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>{stats.isFollowing ? 'Following' : 'Follow'}</button>
              )}
            </div>
            <div className="mt-4 space-y-2">
              <h2 className="text-2xl font-black tracking-tighter">{profileInfo.display_name}</h2>
              <p className="text-gray-400 text-sm font-bold">@{profileInfo.username}</p>
              <p className="text-[15px] font-medium leading-relaxed">{profileInfo.bio || 'GridStream member.'}</p>
              <div className="flex gap-4 pt-2">
                <button onClick={() => setShowFollowList('following')} className="text-sm font-black hover:underline">{stats.following} <span className="text-gray-400 font-bold uppercase text-[10px]">Following</span></button>
                <button onClick={() => setShowFollowList('followers')} className="text-sm font-black hover:underline">{stats.followers} <span className="text-gray-400 font-bold uppercase text-[10px]">Followers</span></button>
              </div>
            </div>
          </div>
          
          <div className={`flex border-b mt-6 ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            <button onClick={() => setProfileTab('list')} className={`flex-grow py-4 text-[10px] font-black uppercase tracking-widest transition ${profileTab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}>Threads</button>
            <button onClick={() => setProfileTab('grid')} className={`flex-grow py-4 text-[10px] font-black uppercase tracking-widest transition ${profileTab === 'grid' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}>Media</button>
          </div>

          <div className={profileTab === 'grid' ? "grid grid-cols-3 gap-[2px] animate-in slide-up" : `divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
            {posts.filter(p => p.user_id === activeProfileId).filter(p => profileTab === 'grid' ? !!p.image_url : true).map(post => (
              profileTab === 'grid' ? <img key={post.id} src={post.image_url} className="aspect-square w-full h-full object-cover cursor-pointer hover:brightness-75 transition" onClick={() => setSelectedPost(post)} /> : <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onDelete={(id) => {}} onLike={toggleLike} onSendComment={handleSendComment} onDeleteComment={handleDeleteComment} currentUser={user} darkMode={darkMode} />
            ))}
          </div>
        </div>
      )}

      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSelectedPost={setSelectedPost} darkMode={darkMode} />}
      {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} setDmTarget={setDmTarget} getAvatar={getAvatar} openProfile={openProfile} darkMode={darkMode} />}

      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 backdrop-blur-md ${darkMode ? 'bg-black/90 border-gray-800 text-gray-600' : 'bg-white/90 border-gray-100 text-gray-300'}`}>
        <HomeIcon onClick={() => setView('home')} className={`cursor-pointer transition hover:scale-110 ${view === 'home' ? 'text-blue-600' : ''}`} />
        <Search onClick={() => setView('search')} className={`cursor-pointer transition hover:scale-110 ${view === 'search' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <MessageCircle onClick={() => setView('messages')} className={`cursor-pointer transition hover:scale-110 ${view === 'messages' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer transition hover:scale-110 ${view === 'profile' && activeProfileId === user.id ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
      </nav>
    </div>
  );
}

// --- コンポーネント定義 ---

function PostCard({ post, openProfile, getAvatar, onDelete, onLike, onSendComment, onDeleteComment, currentUser, darkMode }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  return (
    <div className={`p-4 flex flex-col gap-3 border-b last:border-0 transition ${darkMode ? 'border-gray-800 hover:bg-gray-900/40' : 'border-gray-50 hover:bg-gray-50/40'}`}>
      <div className="flex gap-3">
        <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer object-cover shadow-sm transition hover:opacity-80" onClick={() => openProfile(post.profiles.id)} />
        <div className="flex-grow min-w-0">
          <div className="flex justify-between items-start">
            <div className="flex flex-col cursor-pointer mb-1" onClick={() => openProfile(post.profiles.id)}>
              <span className="font-black text-sm">{post.profiles?.display_name}</span>
              <span className="text-gray-400 text-[11px] font-bold">@{post.profiles?.username}</span>
            </div>
            {currentUser && post.user_id === currentUser.id && <button onClick={() => onDelete(post.id)} className="text-gray-300 hover:text-red-500 transition p-1"><Trash2 size={16} /></button>}
          </div>
          <p className="text-[15px] mt-1 font-medium leading-relaxed whitespace-pre-wrap">{post.content}</p>
          {post.image_url && <img src={post.image_url} className="mt-3 rounded-2xl w-full max-h-80 object-cover border border-gray-100 shadow-sm transition hover:scale-[1.01]" />}
          <div className="flex justify-between mt-4 text-gray-400 max-w-[180px] items-center">
            <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 transition ${post.is_liked ? 'text-red-500 scale-110' : 'hover:text-red-500'}`}><Heart size={18} fill={post.is_liked ? "currentColor" : "none"} /><span className="text-xs font-black">{post.like_count || ''}</span></button>
            <button onClick={() => setShowComments(!showComments)} className={`flex items-center gap-1.5 transition ${showComments ? 'text-blue-500' : 'hover:text-blue-500'}`}><MessageCircle size={18} /><span className="text-xs font-black">{post.comment_list?.length || ''}</span></button>
            <Share2 size={18} className="hover:text-green-500 transition" />
          </div>
        </div>
      </div>
      {showComments && (
        <div className={`mt-2 ml-11 pl-4 border-l-2 ${darkMode ? 'border-gray-800' : 'border-gray-100'} animate-in slide-in-from-top duration-200`}>
          <div className="space-y-4 mb-4 pt-2">
            {post.comment_list.map(comment => (
              <div key={comment.id} className="flex gap-2 text-sm group animate-in fade-in">
                <img src={getAvatar(comment.profiles?.username, comment.profiles?.avatar_url)} className="w-7 h-7 rounded-full object-cover shadow-sm" />
                <div className="flex-grow"><div className="flex items-center gap-2"><span className="font-black text-[12px]">@{comment.profiles?.username}</span>{currentUser.id === comment.user_id && <button onClick={() => onDeleteComment(comment.id)} className="opacity-0 group-hover:opacity-100 text-red-400 transition"><Trash2 size={12} /></button>}</div><p className="font-medium text-[13px] opacity-90">{comment.content}</p></div>
              </div>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); onSendComment(post.id, commentText); setCommentText(''); }} className="flex gap-2 items-center">
            <input type="text" placeholder="Stream your reply..." className={`flex-grow text-xs font-bold p-3 rounded-xl outline-none transition focus:ring-1 focus:ring-blue-500 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50'}`} value={commentText} onChange={(e) => setCommentText(e.target.value)} />
            <button type="submit" disabled={!commentText.trim()} className="text-blue-500 disabled:opacity-20 active:scale-90 transition p-2"><Send size={18} /></button>
          </form>
        </div>
      )}
    </div>
  );
}

function DMScreen({ target, setDmTarget, currentUser, getAvatar, darkMode }) {
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
    e.preventDefault(); if (!text.trim()) return;
    const t = text; setText('');
    await supabase.from('messages').insert([{ text: t, sender_id: currentUser.id, receiver_id: target.id }]);
  }
  return (
    <div className={`fixed inset-0 z-[100] flex flex-col animate-in slide-in-from-right duration-300 ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <script src="https://cdn.tailwindcss.com"></script>
      <header className="p-4 flex items-center gap-3 border-b sticky top-0 bg-inherit z-10 backdrop-blur-md">
        <ChevronLeft onClick={() => setDmTarget(null)} className="cursor-pointer transition hover:scale-110" />
        <img src={getAvatar(target.username, target.avatar_url)} className="w-10 h-10 rounded-full object-cover shadow-sm" />
        <div><p className="font-black text-sm">{target.display_name}</p><p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">@{target.username}</p></div>
      </header>
      <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-opacity-10">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'} animate-in slide-up`}>
            <div className={`max-w-[80%] p-4 rounded-[1.5rem] text-sm shadow-sm ${m.sender_id === currentUser.id ? 'bg-blue-600 text-white rounded-tr-none' : (darkMode ? 'bg-gray-800 text-white rounded-tl-none' : 'bg-gray-100 text-black rounded-tl-none')}`}>{m.text}</div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <form onSubmit={sendMsg} className="p-4 border-t flex gap-2 backdrop-blur-md">
        <input type="text" className={`flex-grow p-4 rounded-2xl text-sm outline-none transition focus:ring-1 focus:ring-blue-500 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`} placeholder="Type a message..." value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="bg-blue-600 text-white p-4 rounded-2xl shadow-xl active:scale-95 transition hover:bg-blue-700"><Send size={18}/></button>
      </form>
    </div>
  );
}

function SettingsScreen({ onClose, user, darkMode, setDarkMode }) {
  const handleLogout = () => { supabase.auth.signOut(); onClose(); };
  return (
    <div className={`fixed inset-0 z-[100] animate-in slide-in-from-bottom duration-300 ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <script src="https://cdn.tailwindcss.com"></script>
      <header className="p-4 border-b flex items-center gap-4 sticky top-0 bg-inherit z-10">
        <ChevronLeft onClick={onClose} className="cursor-pointer" />
        <h2 className="font-black uppercase tracking-widest text-sm">Settings</h2>
      </header>
      <div className="p-4 space-y-6">
        <button onClick={() => setDarkMode(!darkMode)} className={`w-full flex justify-between items-center p-5 rounded-3xl transition ${darkMode ? 'bg-gray-900 hover:bg-gray-800' : 'bg-gray-50 hover:bg-gray-100'}`}>
          <div className="flex items-center gap-3">{darkMode ? <Moon size={18}/> : <Sun size={18}/>}<span className="text-sm font-bold uppercase tracking-tight">Dark Mode</span></div>
          <div className={`w-12 h-7 rounded-full relative transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${darkMode ? 'right-1' : 'left-1'}`} /></div>
        </button>
        <button onClick={handleLogout} className="w-full p-5 rounded-3xl bg-red-50 text-red-500 font-black uppercase text-[10px] tracking-[0.2em] shadow-sm hover:bg-red-100 transition">Logout Account</button>
      </div>
    </div>
  );
}

function FollowListModal({ type, userId, onClose, openProfile, getAvatar, darkMode }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    async function fetchList() {
      const sourceCol = type === 'followers' ? 'following_id' : 'follower_id';
      const targetCol = type === 'followers' ? 'follower_id' : 'following_id';
      const { data } = await supabase.from('follows').select(targetCol).eq(sourceCol, userId);
      if (data?.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', data.map(f => f[targetCol]));
        if (profiles) setList(profiles);
      }
    }
    fetchList();
  }, [type, userId]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md flex items-end justify-center animate-in fade-in">
      <div className={`w-full max-w-md rounded-t-[3rem] max-h-[85vh] flex flex-col shadow-2xl ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
        <div className="p-8 border-b flex justify-between items-center"><h3 className="font-black text-xl uppercase italic tracking-tighter text-blue-600">{type}</h3><X onClick={onClose} className="cursor-pointer hover:rotate-90 transition-transform" /></div>
        <div className="overflow-y-auto p-4 space-y-1">
          {list.length === 0 && <p className="text-center p-10 text-gray-400 font-bold uppercase text-xs tracking-widest">No users found</p>}
          {list.map(u => (
            <div key={u.id} className={`flex items-center gap-4 cursor-pointer p-4 rounded-2xl transition ${darkMode ? 'hover:bg-gray-900' : 'hover:bg-gray-50'}`} onClick={() => { openProfile(u.id); onClose(); }}>
              <img src={getAvatar(u.username, u.avatar_url)} className="w-12 h-12 rounded-full object-cover shadow-sm" />
              <div className="flex-grow"><p className="font-black text-sm">{u.display_name}</p><p className="text-gray-400 text-xs font-bold uppercase tracking-tighter">@{u.username}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PostDetailModal({ post, onClose, getAvatar, openProfile, darkMode }) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
      <button onClick={onClose} className="absolute top-6 right-6 text-white p-3 bg-white/10 hover:bg-white/20 rounded-full transition"><X size={28}/></button>
      <div className={`w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
        <div className="p-6 border-b flex items-center gap-3">
          <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-12 h-12 rounded-full object-cover cursor-pointer shadow-sm" onClick={() => { openProfile(post.profiles.id); onClose(); }} />
          <div className="flex flex-col"><p className="font-black text-sm">{post.profiles?.display_name}</p><p className="text-gray-400 text-xs font-bold uppercase tracking-tighter">@{post.profiles?.username}</p></div>
        </div>
        <div className="p-8 max-h-[65vh] overflow-y-auto space-y-6">
          {post.image_url && <img src={post.image_url} className="w-full rounded-3xl shadow-lg border border-gray-100" />}
          <p className="text-lg font-medium leading-relaxed italic">{post.content}</p>
        </div>
      </div>
    </div>
  );
}

function SearchView({ posts, openProfile, searchQuery, setSearchQuery, setSelectedPost, darkMode }) {
  return (
    <div className="animate-in fade-in">
      <div className={`p-4 sticky top-0 z-10 border-b backdrop-blur-md ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-100'}`}>
        <div className="relative"><Search className="absolute left-4 top-3.5 text-gray-400" size={18} /><input type="text" placeholder="DISCOVER NEW STREAMS" className={`w-full rounded-2xl py-3 pl-12 pr-4 outline-none text-[10px] font-black uppercase tracking-[0.1em] transition focus:ring-1 focus:ring-blue-600 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100'}`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-3 gap-[2px] animate-in slide-up">
        {posts.filter(p => p.image_url && (p.content.includes(searchQuery) || p.profiles?.username.includes(searchQuery))).map(post => (
          <img key={post.id} src={post.image_url} className="aspect-square w-full h-full object-cover cursor-pointer hover:opacity-75 transition-all active:scale-95" onClick={() => setSelectedPost(post)} />
        ))}
      </div>
    </div>
  );
}

function MessagesList({ allProfiles, user, setDmTarget, getAvatar, openProfile, darkMode }) {
  return (
    <div className="animate-in fade-in">
      <header className={`p-6 border-b font-black text-xl text-center uppercase italic tracking-tighter sticky top-0 z-10 backdrop-blur-md ${darkMode ? 'bg-black/90 text-white' : 'bg-white/95 text-black'}`}>GridStream Direct</header>
      <div className="p-3 space-y-1">
        {allProfiles.filter(p => p.id !== user.id).map(u => (
          <div key={u.id} className={`flex items-center gap-4 p-5 rounded-[2rem] cursor-pointer transition ${darkMode ? 'hover:bg-gray-900' : 'hover:bg-gray-50'}`} onClick={() => setDmTarget(u)}>
            <img src={getAvatar(u.username, u.avatar_url)} className="w-14 h-14 rounded-full object-cover shadow-md transition hover:scale-110" onClick={(e) => { e.stopPropagation(); openProfile(u.id); }} />
            <div className="flex-grow pb-1"><p className="font-black text-sm">{u.display_name}</p><p className="text-[10px] text-blue-500 font-black mt-1 italic uppercase tracking-widest">Start Streaming</p></div>
          </div>
        ))}
      </div>
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
      }
    }
    setLoading(false);
    fetchData();
  }
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-10 bg-white font-sans text-black animate-in fade-in">
      <script src="https://cdn.tailwindcss.com"></script>
      <div className="w-24 h-24 bg-gradient-to-tr from-blue-700 to-cyan-500 rounded-[2.5rem] flex items-center justify-center shadow-2xl mb-8 rotate-12 animate-pulse"><Zap size={48} color="white" fill="white" /></div>
      <h1 className="text-5xl font-black mb-12 text-blue-700 italic tracking-tighter uppercase leading-none">GridStream</h1>
      <form onSubmit={handleAuth} className="w-full max-w-xs space-y-4">
        {!isLogin && <input type="text" placeholder="DISPLAY NAME" className="w-full bg-gray-50 p-5 rounded-[2rem] outline-none font-black text-xs uppercase tracking-widest focus:ring-1 focus:ring-blue-700 transition" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />}
        <input type="email" placeholder="EMAIL" className="w-full bg-gray-50 p-5 rounded-[2rem] outline-none font-black text-xs uppercase tracking-widest focus:ring-1 focus:ring-blue-700 transition" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="PASSWORD" className="w-full bg-gray-50 p-5 rounded-[2rem] outline-none font-black text-xs uppercase tracking-widest focus:ring-1 focus:ring-blue-700 transition" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="w-full bg-blue-700 text-white font-black py-6 rounded-[2rem] shadow-2xl uppercase tracking-[0.3em] text-[10px] active:scale-95 transition hover:bg-blue-800">{loading ? '...' : (isLogin ? 'Login' : 'Join Beta')}</button>
      </form>
      <button onClick={() => setIsLogin(!isLogin)} className="mt-10 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] hover:text-blue-700 transition">{isLogin ? "Create Account" : "Back to Login"}</button>
    </div>
  );
        }
