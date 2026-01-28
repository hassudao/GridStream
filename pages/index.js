import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User as UserIcon, Grid, List, Image as ImageIcon, Send, ChevronLeft, MapPin, Calendar, Check, AtSign, Zap, LogOut, Mail, Lock, MoreHorizontal, Settings, Save, Moon, Sun, AlertCircle, Trash2, MessageSquare } from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = 'dtb3jpadj'; 
const CLOUDINARY_UPLOAD_PRESET = 'alpha-sns';

export default function App() {
  // --- 状態管理 ---
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
  const [uploading, setUploading] = useState(false);
  
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const headerInputRef = useRef(null);

  // --- 初期化 & 認証 ---
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
      .select(`*, profiles(id, username, display_name, avatar_url), likes(user_id), comments(id)`)
      .order('created_at', { ascending: false });
    
    if (postsData) {
      const formattedPosts = postsData.map(post => ({
        ...post,
        like_count: post.likes?.length || 0,
        comment_count: post.comments?.length || 0,
        is_liked: user ? post.likes?.some(l => l.user_id === user.id) : false
      }));
      setPosts(formattedPosts);
      if (selectedPost) {
        const updatedSelected = formattedPosts.find(p => p.id === selectedPost.id);
        if (updatedSelected) setSelectedPost(updatedSelected);
      }
    }
    const { data: profData } = await supabase.from('profiles').select('*');
    if (profData) setAllProfiles(profData);
  }

  // --- 機能系 ---
  async function toggleLike(postId, isLiked) {
    if (!user) return;
    const updateLogic = (p) => {
      if (p.id === postId) {
        return { ...p, is_liked: !isLiked, like_count: isLiked ? Math.max(0, p.like_count - 1) : p.like_count + 1 };
      }
      return p;
    };
    setPosts(prev => prev.map(updateLogic));
    if (selectedPost?.id === postId) setSelectedPost(prev => updateLogic(prev));

    if (isLiked) await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id);
    else await supabase.from('likes').insert([{ post_id: postId, user_id: user.id }]);
    fetchData();
  }

  const handleShare = async (post) => {
    const shareData = { title: 'GridStream (Beta)', text: post.content, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(`${post.content}\n${window.location.href}`);
        alert('リンクをコピーしました！');
      }
    } catch (err) { console.log('Share failed', err); }
  };

  async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    return data.secure_url;
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

  async function handleDeletePost(postId) {
    if (!window.confirm("この投稿を削除しますか？")) return;
    await supabase.from('posts').delete().eq('id', postId).eq('user_id', user.id);
    setPosts(prev => prev.filter(p => p.id !== postId));
    setSelectedPost(null);
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

  const [dmTarget, setDmTarget] = useState(null);

  if (!user) return <AuthScreen fetchData={fetchData} />;

  return (
    <div className={`max-w-md mx-auto min-h-screen pb-20 border-x font-sans relative shadow-2xl transition-colors duration-300 ${darkMode ? 'bg-black text-white border-gray-800' : 'bg-white text-black border-gray-100'}`}>
      {/* Tailwindを直接記述 */}
      <script src="https://cdn.tailwindcss.com"></script>

      {/* モーダル群 */}
      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} getAvatar={getAvatar} darkMode={darkMode} />}
      {showFollowList && <FollowListModal type={showFollowList} userId={activeProfileId} onClose={() => setShowFollowList(null)} openProfile={openProfile} getAvatar={getAvatar} darkMode={darkMode} />}
      {selectedPost && <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} getAvatar={getAvatar} openProfile={openProfile} onDelete={handleDeletePost} onLike={toggleLike} onShare={handleShare} currentUser={user} darkMode={darkMode} refreshPosts={fetchData} />}
      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} user={user} darkMode={darkMode} setDarkMode={setDarkMode} />}

      {/* ホーム画面 */}
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
              <label className="cursor-pointer text-blue-500 hover:bg-blue-50/10 p-2 rounded-full transition"><ImageIcon size={22}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
              <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs shadow-lg uppercase tracking-tighter">
                {uploading ? '...' : 'Stream'}
              </button>
            </div>
          </form>
          <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
            {posts.map(post => (
              <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onLike={toggleLike} onShare={handleShare} currentUser={user} darkMode={darkMode} onOpenDetail={() => setSelectedPost(post)} />
            ))}
          </div>
        </div>
      )}

      {/* プロフィール画面 */}
      {view === 'profile' && profileInfo && (
        <div className="animate-in fade-in pb-10">
          <div className={`h-32 relative overflow-hidden bg-gray-200 ${!profileInfo.header_url && 'bg-gradient-to-br from-blue-700 via-indigo-600 to-cyan-500'}`}>
            <img src={isEditing ? editData.header_url : profileInfo.header_url} className="w-full h-full object-cover" alt="" />
            {!isEditing && <button onClick={() => setView('home')} className="absolute top-4 left-4 bg-black/30 backdrop-blur-md p-2 rounded-full text-white"><ChevronLeft size={20}/></button>}
          </div>
          <div className="px-4 relative">
            <div className="absolute -top-12 left-4">
              <img src={isEditing ? getAvatar(editData.username, editData.avatar_url) : getAvatar(profileInfo.username, profileInfo.avatar_url)} className={`w-24 h-24 rounded-full border-4 shadow-xl object-cover ${darkMode ? 'border-black bg-black' : 'border-white bg-white'}`} />
            </div>
            <div className="flex justify-end py-3">
              {user.id === activeProfileId && !isEditing && (
                <button onClick={() => setIsEditing(true)} className={`border rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-tighter ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>Edit Profile</button>
              )}
            </div>
            <div className="mt-4">
              <h2 className="text-2xl font-black tracking-tighter">{profileInfo.display_name}</h2>
              <p className="text-gray-400 text-sm font-bold">@{profileInfo.username}</p>
              <p className="mt-2 text-[15px] font-medium leading-relaxed">{profileInfo.bio || 'GridStream member.'}</p>
            </div>
          </div>
          <div className={`divide-y mt-6 ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
            {posts.filter(p => p.user_id === activeProfileId).map(post => (
              <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onLike={toggleLike} onShare={handleShare} currentUser={user} darkMode={darkMode} onOpenDetail={() => setSelectedPost(post)} />
            ))}
          </div>
        </div>
      )}

      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSelectedPost={setSelectedPost} darkMode={darkMode} />}
      {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} setDmTarget={setDmTarget} getAvatar={getAvatar} openProfile={openProfile} darkMode={darkMode} />}

      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 shadow-sm ${darkMode ? 'bg-black/95 border-gray-800 text-gray-600' : 'bg-white/95 border-gray-100 text-gray-300'}`}>
        <HomeIcon onClick={() => setView('home')} className={`cursor-pointer ${view === 'home' ? 'text-blue-600' : ''}`} />
        <Search onClick={() => setView('search')} className={`cursor-pointer ${view === 'search' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <MessageCircle onClick={() => setView('messages')} className={`cursor-pointer ${view === 'messages' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer ${view === 'profile' && activeProfileId === user.id ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
      </nav>
    </div>
  );
}

// --- コンポーネント群 ---

function PostCard({ post, openProfile, getAvatar, onLike, onShare, currentUser, darkMode, onOpenDetail }) {
  return (
    <article className={`p-4 flex gap-3 hover:bg-gray-50/5 transition border-b last:border-0 ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
      <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer object-cover" onClick={() => openProfile(post.profiles.id)} />
      <div className="flex-grow min-w-0">
        <div className="flex flex-col cursor-pointer mb-1" onClick={() => openProfile(post.profiles.id)}>
          <span className="font-black text-sm truncate">{post.profiles?.display_name}</span>
          <span className="text-gray-400 text-[11px] font-bold truncate">@{post.profiles?.username}</span>
        </div>
        <p className="text-[15px] mt-1 font-medium leading-relaxed whitespace-pre-wrap">{post.content}</p>
        {post.image_url && <img src={post.image_url} onClick={onOpenDetail} className="mt-3 rounded-2xl w-full max-h-80 object-cover border border-gray-100 cursor-pointer hover:brightness-95 transition" />}
        <div className="flex justify-between mt-4 text-gray-400 max-w-[200px] items-center">
          <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 transition ${post.is_liked ? 'text-red-500 scale-110' : 'hover:text-red-500'}`}>
            <Heart size={18} fill={post.is_liked ? "currentColor" : "none"} /><span className="text-xs font-black">{post.like_count || ''}</span>
          </button>
          <button onClick={onOpenDetail} className="flex items-center gap-1.5 hover:text-blue-500 transition">
            <MessageSquare size={18} /><span className="text-xs font-black">{post.comment_count || ''}</span>
          </button>
          <button onClick={() => onShare(post)} className="hover:text-green-500 transition"><Share2 size={18} /></button>
        </div>
      </div>
    </article>
  );
}

function PostDetailModal({ post, onClose, getAvatar, openProfile, onDelete, onLike, onShare, currentUser, darkMode, refreshPosts }) {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(false);
  const isMyPost = currentUser && post.user_id === currentUser.id;

  useEffect(() => { fetchComments(); }, [post.id]);

  async function fetchComments() {
    const { data } = await supabase.from('comments').select('*, profiles(id, username, display_name, avatar_url)').eq('post_id', post.id).order('created_at', { ascending: true });
    if (data) setComments(data);
  }

  async function handlePostComment(e) {
    e.preventDefault();
    if (!commentText.trim() || !currentUser) return;
    setLoading(true);
    await supabase.from('comments').insert([{ post_id: post.id, user_id: currentUser.id, content: commentText }]);
    setCommentText('');
    await fetchComments();
    refreshPosts();
    setLoading(false);
  }

  async function handleDeleteComment(commentId) {
    if (!window.confirm("このコメントを削除しますか？")) return;
    await supabase.from('comments').delete().eq('id', commentId).eq('user_id', currentUser.id);
    setComments(prev => prev.filter(c => c.id !== commentId));
    refreshPosts();
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-[2.5rem] flex flex-col h-[85vh] overflow-hidden shadow-2xl ${darkMode ? 'bg-black border border-gray-800' : 'bg-white text-black'}`}>
        {/* ヘッダー */}
        <div className={`p-4 border-b flex items-center justify-between ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
          <div className="flex items-center gap-3">
            <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-8 h-8 rounded-full object-cover" />
            <span className="font-black text-xs">@{post.profiles?.username}</span>
          </div>
          <div className="flex items-center gap-2">
            {isMyPost && <button onClick={() => onDelete(post.id)} className="p-2 text-gray-400 hover:text-red-500 transition"><Trash2 size={20}/></button>}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 transition"><X size={24}/></button>
          </div>
        </div>
        
        <div className="flex-grow overflow-y-auto">
          <div className="p-5 border-b">
            {post.image_url && <img src={post.image_url} className="w-full rounded-2xl mb-4 border" />}
            <p className="font-medium leading-relaxed mb-4 whitespace-pre-wrap">{post.content}</p>
            <div className="flex items-center gap-6 text-gray-400 border-t pt-4">
               <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 transition ${post.is_liked ? 'text-red-500 scale-110' : 'hover:text-red-500'}`}>
                 <Heart size={20} fill={post.is_liked ? "currentColor" : "none"} /><span className="font-black text-sm">{post.like_count || 0}</span>
               </button>
               <div className="flex items-center gap-1.5"><MessageSquare size={20} /><span className="font-black text-sm">{post.comment_count || 0}</span></div>
               <button onClick={() => onShare(post)} className="hover:text-green-500 transition"><Share2 size={20}/></button>
            </div>
          </div>

          {/* コメントセクション */}
          <div className="p-5 space-y-4 pb-10">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Comments</h4>
            {comments.map(c => (
              <div key={c.id} className="flex gap-3">
                <img src={getAvatar(c.profiles?.username, c.profiles?.avatar_url)} className="w-8 h-8 rounded-full object-cover" />
                <div className={`flex-grow p-3 rounded-2xl relative ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                  <div className="flex justify-between items-start">
                    <span className="font-black text-[11px] block mb-1">@{c.profiles?.username}</span>
                    {currentUser.id === c.user_id && (
                      <button onClick={() => handleDeleteComment(c.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                    )}
                  </div>
                  <p className="text-sm font-medium leading-relaxed">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* コメント入力 */}
        <form onSubmit={handlePostComment} className={`p-4 border-t flex gap-2 ${darkMode ? 'bg-black border-gray-800' : 'bg-white'}`}>
          <input type="text" placeholder="コメントを入力..." className={`flex-grow p-4 rounded-2xl text-sm outline-none font-medium ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50'}`} value={commentText} onChange={(e) => setCommentText(e.target.value)} />
          <button type="submit" disabled={loading || !commentText.trim()} className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg active:scale-95 transition"><Send size={18}/></button>
        </form>
      </div>
    </div>
  );
}

function SearchView({ posts, openProfile, searchQuery, setSearchQuery, setSelectedPost, darkMode }) {
  return (
    <div className="animate-in fade-in">
      <div className={`p-4 sticky top-0 z-10 border-b ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-100'}`}>
        <div className="relative"><Search className="absolute left-3 top-3 text-gray-400" size={18} /><input type="text" placeholder="DISCOVER" className={`w-full rounded-xl py-2 pl-10 pr-4 outline-none text-xs font-black uppercase ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100'}`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-3 gap-[2px]">
        {posts.filter(p => p.image_url && (p.content.includes(searchQuery) || p.profiles?.username.includes(searchQuery))).map((post) => (
          <img key={post.id} src={post.image_url} className="aspect-square w-full h-full object-cover cursor-pointer hover:opacity-80 transition" onClick={() => setSelectedPost(post)} />
        ))}
      </div>
    </div>
  );
}

function MessagesList({ allProfiles, user, setDmTarget, getAvatar, openProfile, darkMode }) {
  return (
    <div className="animate-in fade-in">
      <header className="p-4 border-b font-black text-lg text-center uppercase italic sticky top-0 z-10">GridStream Chat</header>
      <div className="p-2">
        {allProfiles.filter(p => p.id !== user.id).map(u => (
          <div key={u.id} className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer hover:bg-gray-50/10" onClick={() => setDmTarget(u)}>
            <img src={getAvatar(u.username, u.avatar_url)} className="w-14 h-14 rounded-full object-cover" onClick={(e) => { e.stopPropagation(); openProfile(u.id); }} />
            <div className="flex-grow border-b pb-2"><p className="font-bold text-sm">{u.display_name}</p><p className="text-xs text-blue-500 font-medium mt-1 italic uppercase">Tap to Stream</p></div>
          </div>
        ))}
      </div>
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
    <div className={`fixed inset-0 z-50 flex flex-col animate-in slide-in-from-right duration-300 ${darkMode ? 'bg-black' : 'bg-[#f8f9fa]'}`}>
      <header className={`p-4 flex items-center gap-3 border-b sticky top-0 ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white'}`}>
        <ChevronLeft onClick={() => setDmTarget(null)} className="cursor-pointer" />
        <img src={getAvatar(target.username, target.avatar_url)} className="w-10 h-10 rounded-full object-cover" />
        <div><p className="font-black text-sm">{target.display_name}</p><p className="text-[10px] text-gray-400 font-bold">@{target.username}</p></div>
      </header>
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-[1.5rem] text-sm ${m.sender_id === currentUser.id ? 'bg-blue-600 text-white rounded-tr-none' : (darkMode ? 'bg-gray-800 text-white rounded-tl-none' : 'bg-white text-gray-800 rounded-tl-none')}`}>{m.text}</div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <form onSubmit={sendMsg} className="p-4 border-t flex gap-2">
        <input type="text" className={`flex-grow p-4 rounded-2xl text-sm outline-none ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50'}`} placeholder="Aa" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg active:scale-95 transition"><Send size={18}/></button>
      </form>
    </div>
  );
}

function SettingsScreen({ onClose, user, darkMode, setDarkMode }) {
  const handleLogout = () => { supabase.auth.signOut(); onClose(); };
  return (
    <div className={`fixed inset-0 z-[100] overflow-y-auto ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <header className="p-4 border-b flex items-center gap-4 sticky top-0 z-10">
        <ChevronLeft onClick={onClose} className="cursor-pointer" /><h2 className="font-black uppercase">Settings</h2>
      </header>
      <div className="p-6 space-y-8">
        <section>
          <h3 className="text-gray-400 text-[10px] font-black uppercase mb-4">Appearance</h3>
          <button onClick={() => setDarkMode(!darkMode)} className={`w-full flex justify-between items-center p-4 rounded-2xl ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
            <span className="text-sm font-bold">Dark Mode</span>
            <div className={`w-10 h-6 rounded-full relative ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${darkMode ? 'right-1' : 'left-1'}`} /></div>
          </button>
        </section>
        <section><button onClick={handleLogout} className="w-full p-4 rounded-2xl bg-red-50 text-red-500 font-black uppercase text-xs tracking-widest">Logout</button></section>
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
      const { data: followData } = await supabase.from('follows').select(targetCol).eq(sourceCol, userId);
      if (followData?.length > 0) {
        const ids = followData.map(f => f[targetCol]);
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids);
        if (profiles) setList(profiles);
      }
    }
    fetchList();
  }, [type, userId]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center">
      <div className={`w-full max-w-md rounded-t-[2.5rem] max-h-[80vh] flex flex-col ${darkMode ? 'bg-black text-white' : 'bg-white'}`}>
        <div className="p-6 border-b flex justify-between items-center"><h3 className="font-black uppercase">{type}</h3><X onClick={onClose} className="cursor-pointer" /></div>
        <div className="overflow-y-auto p-4 space-y-2">
          {list.map(u => (
            <div key={u.id} className="flex items-center gap-4 cursor-pointer p-3 rounded-2xl hover:bg-gray-50/10" onClick={() => openProfile(u.id)}>
              <img src={getAvatar(u.username, u.avatar_url)} className="w-12 h-12 rounded-full object-cover" />
              <div className="flex-grow"><p className="font-black text-sm">{u.display_name}</p><p className="text-gray-400 text-xs font-bold">@{u.username}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuthScreen({ fetchData }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [displayName, setDisplayName] = useState('');
  async function handleAuth(e) {
    e.preventDefault();
    if (isLogin) {
      await supabase.auth.signInWithPassword({ email, password });
    } else {
      const { data } = await supabase.auth.signUp({ email, password });
      if (data?.user) {
        const id = displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000);
        await supabase.from('profiles').upsert([{ id: data.user.id, username: id, display_name: displayName }]);
      }
    }
    fetchData();
  }
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-white">
      <script src="https://cdn.tailwindcss.com"></script>
      <div className="w-20 h-20 bg-gradient-to-tr from-blue-700 to-cyan-500 rounded-[2rem] flex items-center justify-center shadow-2xl mb-6 rotate-6 animate-pulse"><Zap size={40} color="white" fill="white" /></div>
      <h1 className="text-4xl font-black mb-10 text-blue-700 italic uppercase">GridStream</h1>
      <form onSubmit={handleAuth} className="w-full max-w-xs space-y-4">
        {!isLogin && <input type="text" placeholder="DISPLAY NAME" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />}
        <input type="email" placeholder="EMAIL" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="PASSWORD" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="w-full bg-blue-700 text-white font-black py-5 rounded-2xl uppercase text-xs">Login</button>
      </form>
      <button onClick={() => setIsLogin(!isLogin)} className="mt-8 text-xs font-black text-gray-400 uppercase">{isLogin ? "Create Account" : "Login"}</button>
    </div>
  );
                                                                                                                  }
