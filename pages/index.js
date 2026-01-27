import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User as UserIcon, Grid, List, Image as ImageIcon, Send, ChevronLeft, MapPin, Calendar, Check, AtSign, Zap, LogOut, Mail, Lock, MoreHorizontal, Settings, Save, Moon, Sun, AlertCircle, Trash2 } from 'lucide-react';

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
  
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const headerInputRef = useRef(null);

  // 1. 初期化と認証監視
  useEffect(() => {
    checkUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) fetchMyProfile(currentUser.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  // 2. ユーザー状態が変わった時にデータを再取得（いいねの同期用）
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

  // 3. メインデータ取得（投稿・いいね・コメント）
  async function fetchData() {
    const { data: postsData, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles(id, username, display_name, avatar_url),
        likes(user_id),
        comments(*, profiles(username, display_name, avatar_url))
      `)
      .order('created_at', { ascending: false });
    
    if (error) console.error("Fetch posts error:", error);
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

  // 4. いいね機能（楽観的アップデート対応）
  async function toggleLike(postId, isLiked) {
    if (!user) return;
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return { ...p, is_liked: !isLiked, like_count: isLiked ? p.like_count - 1 : p.like_count + 1 };
      }
      return p;
    }));
    if (isLiked) await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id);
    else await supabase.from('likes').insert([{ post_id: postId, user_id: user.id }]);
    fetchData();
  }

  // 5. 返信機能
  async function handleSendComment(postId, content) {
    if (!content.trim() || !user) return;
    const { error } = await supabase.from('comments').insert([
      { post_id: postId, user_id: user.id, content: content.trim() }
    ]);
    if (error) alert("返信に失敗しました");
    fetchData();
  }

  async function handleDeleteComment(commentId) {
    if (!window.confirm("この返信を削除しますか？")) return;
    await supabase.from('comments').delete().eq('id', commentId).eq('user_id', user.id);
    fetchData();
  }

  // 6. 画像アップロード (Cloudinary)
  async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    return data.secure_url;
  }

  const handleImageSelect = (e, type) => {
    const file = e.target.files[0];
    if (file) setEditData(prev => ({ ...prev, [type]: URL.createObjectURL(file) }));
  };

  const validateProfile = (displayName, username) => {
    if (displayName.length > 20) { alert("表示名は20文字以内です"); return false; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { alert("ユーザー名は英数字と_のみです"); return false; }
    return true;
  };

  async function handleSaveProfile() {
    if (!validateProfile(editData.display_name, editData.username)) return;
    setUploading(true);
    let { avatar_url, header_url, display_name, username, bio } = editData;
    if (avatarInputRef.current?.files[0]) avatar_url = await uploadToCloudinary(avatarInputRef.current.files[0]);
    if (headerInputRef.current?.files[0]) header_url = await uploadToCloudinary(headerInputRef.current.files[0]);
    const { error } = await supabase.from('profiles').update({ display_name, username: username.toLowerCase(), bio, avatar_url, header_url }).eq('id', user.id);
    if (!error) {
      setMyProfile({ ...editData, avatar_url, header_url });
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

  async function handleDeletePost(postId) {
    if (!window.confirm("削除しますか？")) return;
    await supabase.from('posts').delete().eq('id', postId).eq('user_id', user.id);
    fetchData();
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

  if (!user) return <AuthScreen fetchData={fetchData} validateProfile={validateProfile} />;

  return (
    <div className={`max-w-md mx-auto min-h-screen pb-20 border-x font-sans relative shadow-2xl transition-colors duration-300 ${darkMode ? 'bg-black text-white border-gray-800' : 'bg-white text-black border-gray-100'}`}>
      <script src="https://cdn.tailwindcss.com"></script>

      {view === 'home' && (
        <div className="animate-in fade-in">
          <header className={`sticky top-0 z-30 backdrop-blur-md border-b p-4 flex justify-between items-center ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-50'}`}>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-cyan-500 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1">
              <Zap size={24} className="text-blue-600 fill-blue-600" /> GridStream
            </h1>
            <div className="flex gap-4">
               <button onClick={() => setDarkMode(!darkMode)} className="text-gray-400">{darkMode ? <Sun size={22}/> : <Moon size={22}/>}</button>
               <MessageCircle size={24} className="cursor-pointer" onClick={() => setView('messages')} />
            </div>
          </header>
          
          {/* 投稿フォーム */}
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

          {/* タイムライン */}
          <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
            {posts.map(post => (
              <PostCard 
                key={post.id} 
                post={post} 
                openProfile={openProfile} 
                getAvatar={getAvatar} 
                onDelete={handleDeletePost} 
                onLike={toggleLike} 
                onSendComment={handleSendComment} 
                onDeleteComment={handleDeleteComment} 
                currentUser={user} 
                darkMode={darkMode} 
              />
            ))}
          </div>
        </div>
      )}

      {view === 'profile' && profileInfo && (
        <div className="animate-in fade-in pb-10">
          <div className={`h-32 relative bg-gray-200 ${!profileInfo.header_url && 'bg-gradient-to-br from-blue-700 to-cyan-500'}`}>
            <img src={isEditing ? editData.header_url : profileInfo.header_url} className="w-full h-full object-cover" alt="" />
            {isEditing && (
              <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer text-white">
                <Camera size={24} /><input type="file" accept="image/*" ref={headerInputRef} className="hidden" onChange={(e) => handleImageSelect(e, 'header_url')} />
              </label>
            )}
            {!isEditing && <button onClick={() => setView('home')} className="absolute top-4 left-4 bg-black/30 backdrop-blur-md p-2 rounded-full text-white"><ChevronLeft size={20}/></button>}
          </div>
          <div className="px-4 relative">
            <div className="absolute -top-12 left-4">
               <div className="relative">
                 <img src={isEditing ? getAvatar(editData.username, editData.avatar_url) : getAvatar(profileInfo.username, profileInfo.avatar_url)} className={`w-24 h-24 rounded-full border-4 shadow-xl object-cover ${darkMode ? 'border-black bg-black' : 'border-white bg-white'}`} />
                 {isEditing && (
                  <label className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center cursor-pointer text-white border-4 border-transparent">
                    <Camera size={20} /><input type="file" accept="image/*" ref={avatarInputRef} className="hidden" onChange={(e) => handleImageSelect(e, 'avatar_url')} />
                  </label>
                )}
               </div>
            </div>
            <div className="flex justify-end py-3">
              {user.id === activeProfileId && (
                <button onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)} className="border rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-tighter">
                  {isEditing ? (uploading ? '...' : 'Save') : 'Edit Profile'}
                </button>
              )}
            </div>
            <div className="mt-4 space-y-2">
              <h2 className="text-2xl font-black tracking-tighter">{profileInfo.display_name}</h2>
              <p className="text-gray-400 text-sm font-bold">@{profileInfo.username}</p>
              <p className="text-[15px] font-medium leading-relaxed">{profileInfo.bio || 'GridStream member.'}</p>
            </div>
          </div>
          
          <div className={`flex border-b mt-6 ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            <button className="flex-grow py-4 border-b-2 border-blue-600 text-[10px] font-black uppercase tracking-tighter text-blue-600">Threads</button>
            <button className="flex-grow py-4 text-[10px] font-black uppercase tracking-tighter text-gray-400">Media</button>
          </div>
          
          <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
            {posts.filter(p => p.user_id === activeProfileId).map(post => (
              <PostCard 
                key={post.id} 
                post={post} 
                openProfile={openProfile} 
                getAvatar={getAvatar} 
                onDelete={handleDeletePost} 
                onLike={toggleLike} 
                onSendComment={handleSendComment} 
                onDeleteComment={handleDeleteComment} 
                currentUser={user} 
                darkMode={darkMode} 
              />
            ))}
          </div>
        </div>
      )}

      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} darkMode={darkMode} />}

      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 shadow-sm ${darkMode ? 'bg-black/95 border-gray-800 text-gray-600' : 'bg-white/95 border-gray-100 text-gray-300'}`}>
        <HomeIcon onClick={() => setView('home')} className={`cursor-pointer ${view === 'home' ? 'text-blue-600' : ''}`} />
        <Search onClick={() => setView('search')} className={`cursor-pointer ${view === 'search' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer ${view === 'profile' && activeProfileId === user.id ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
      </nav>
    </div>
  );
}

// --- 投稿コンポーネント (リプライ機能込み) ---
function PostCard({ post, openProfile, getAvatar, onDelete, onLike, onSendComment, onDeleteComment, currentUser, darkMode }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const isMyPost = currentUser && post.user_id === currentUser.id;

  return (
    <div className={`p-4 flex flex-col gap-3 transition ${darkMode ? 'hover:bg-gray-900/40' : 'hover:bg-gray-50/40'}`}>
      <div className="flex gap-3">
        <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer object-cover shadow-sm" onClick={() => openProfile(post.profiles.id)} />
        <div className="flex-grow min-w-0">
          <div className="flex justify-between items-start">
            <div className="flex flex-col cursor-pointer mb-1" onClick={() => openProfile(post.profiles.id)}>
              <span className="font-black text-sm truncate">{post.profiles?.display_name}</span>
              <span className="text-gray-400 text-[11px] font-bold truncate">@{post.profiles?.username}</span>
            </div>
            {isMyPost && <button onClick={() => onDelete(post.id)} className="text-gray-300 hover:text-red-500 transition p-1"><Trash2 size={16} /></button>}
          </div>
          <p className={`text-[15px] mt-1 font-medium leading-relaxed whitespace-pre-wrap ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{post.content}</p>
          {post.image_url && <img src={post.image_url} className="mt-3 rounded-2xl w-full max-h-80 object-cover border border-gray-100 shadow-sm" />}
          
          {/* アクションバー */}
          <div className="flex justify-between mt-4 text-gray-400 max-w-[180px] items-center">
            <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 transition ${post.is_liked ? 'text-red-500 scale-110' : 'hover:text-red-500'}`}>
              <Heart size={18} fill={post.is_liked ? "currentColor" : "none"} />
              <span className="text-xs font-black">{post.like_count || ''}</span>
            </button>
            <button onClick={() => setShowComments(!showComments)} className={`flex items-center gap-1.5 transition ${showComments ? 'text-blue-500' : 'hover:text-blue-500'}`}>
              <MessageCircle size={18} />
              <span className="text-xs font-black">{post.comment_list?.length || ''}</span>
            </button>
            <Share2 size={18} className="hover:text-green-500 transition" />
          </div>
        </div>
      </div>

      {/* --- 返信（コメント）セクション：ツリー形式 --- */}
      {showComments && (
        <div className={`mt-2 ml-11 pl-4 border-l-2 ${darkMode ? 'border-gray-800' : 'border-gray-100'} animate-in slide-in-from-top duration-200`}>
          <div className="space-y-4 mb-4 pt-2">
            {post.comment_list.length === 0 && <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">No streams yet...</p>}
            {post.comment_list.map(comment => (
              <div key={comment.id} className="flex gap-2 text-sm group animate-in fade-in">
                <img src={getAvatar(comment.profiles?.username, comment.profiles?.avatar_url)} className="w-7 h-7 rounded-full object-cover shadow-sm" />
                <div className="flex-grow">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-[12px]">@{comment.profiles?.username}</span>
                    {currentUser.id === comment.user_id && (
                      <button onClick={() => onDeleteComment(comment.id)} className="opacity-0 group-hover:opacity-100 text-red-400 transition">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <p className={`font-medium text-[13px] ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
          
          {/* 返信入力欄 */}
          <form onSubmit={(e) => { e.preventDefault(); onSendComment(post.id, commentText); setCommentText(''); }} className="flex gap-2 items-center">
            <input 
              type="text" 
              placeholder="Stream your reply..." 
              className={`flex-grow text-xs font-bold p-3 rounded-xl outline-none transition-all focus:ring-1 focus:ring-blue-500/50 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-black'}`}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <button type="submit" disabled={!commentText.trim()} className="text-blue-500 disabled:opacity-20 active:scale-90 transition p-2">
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function SearchView({ posts, openProfile, searchQuery, setSearchQuery, darkMode }) {
  return (
    <div className="animate-in fade-in">
      <div className={`p-4 sticky top-0 z-10 border-b ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-100'}`}>
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input type="text" placeholder="DISCOVER" className={`w-full rounded-xl py-2 pl-10 pr-4 outline-none text-xs font-black uppercase tracking-widest ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100'}`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-[2px]">
        {posts.filter(p => p.image_url && (p.content.includes(searchQuery) || p.profiles?.username.includes(searchQuery))).map(post => (
          <img key={post.id} src={post.image_url} className="aspect-square w-full h-full object-cover cursor-pointer hover:brightness-75 transition" alt="" />
        ))}
      </div>
    </div>
  );
}

function AuthScreen({ fetchData, validateProfile }) {
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
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-white font-sans text-black">
      <script src="https://cdn.tailwindcss.com"></script>
      <div className="w-20 h-20 bg-gradient-to-tr from-blue-700 to-cyan-500 rounded-[2rem] flex items-center justify-center shadow-2xl mb-6 rotate-6 animate-pulse"><Zap size={40} color="white" fill="white" /></div>
      <h1 className="text-4xl font-black mb-10 text-blue-700 italic tracking-tighter uppercase">GridStream</h1>
      <form onSubmit={handleAuth} className="w-full max-w-xs space-y-4">
        {!isLogin && <input type="text" placeholder="DISPLAY NAME" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={20} />}
        <input type="email" placeholder="EMAIL" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="PASSWORD" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="w-full bg-blue-700 text-white font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest text-xs active:scale-95 transition">{loading ? '...' : (isLogin ? 'Login' : 'Join')}</button>
      </form>
      <button onClick={() => setIsLogin(!isLogin)} className="mt-8 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-blue-600 transition">{isLogin ? "Create Account" : "Back to Login"}</button>
    </div>
  );
    }
