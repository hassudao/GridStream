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
  const [replyTo, setReplyTo] = useState(null); // 返信先投稿を保持
  
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const headerInputRef = useRef(null);

  // 初回ロードとユーザー状態監視
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
    const { data: postsData, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles(id, username, display_name, avatar_url),
        likes(user_id)
      `)
      .order('created_at', { ascending: false });
    
    if (postsData) {
      const formattedPosts = postsData.map(post => ({
        ...post,
        like_count: post.likes?.length || 0,
        is_liked: user ? post.likes?.some(l => l.user_id === user.id) : false
      }));
      setPosts(formattedPosts);
    }
    const { data: profData } = await supabase.from('profiles').select('*');
    if (profData) setAllProfiles(profData);
  }

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

    await supabase.from('profiles').update({ display_name, username: username.toLowerCase(), bio, avatar_url, header_url }).eq('id', user.id);
    setIsEditing(false);
    fetchData();
    setUploading(false);
  }

  async function handlePost(e) {
    e.preventDefault();
    if (!newPost.trim() || !user) return;
    setUploading(true);
    let imageUrl = null;
    if (fileInputRef.current?.files[0]) imageUrl = await uploadToCloudinary(fileInputRef.current.files[0]);
    
    const { error } = await supabase.from('posts').insert([{ 
      content: newPost, 
      user_id: user.id, 
      image_url: imageUrl,
      parent_id: replyTo ? replyTo.id : null // 返信の場合は親IDをセット
    }]);

    if (!error) {
      setNewPost('');
      setReplyTo(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchData();
    }
    setUploading(false);
  }

  async function handleDeletePost(postId) {
    if (!window.confirm("この投稿を永久に削除しますか？")) return;
    const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', user.id);
    if (!error) {
      setPosts(prev => prev.filter(p => p.id !== postId));
      if (selectedPost?.id === postId) setSelectedPost(null);
    }
  }

  const openProfile = async (userId) => {
    setActiveProfileId(userId);
    setView('profile');
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
  };

  const toggleFollow = async () => {
    if (!user || user.id === activeProfileId) return;
    if (stats.isFollowing) await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', activeProfileId);
    else await supabase.from('follows').insert([{ follower_id: user.id, following_id: activeProfileId }]);
    openProfile(activeProfileId);
  };

  const getAvatar = (name, url) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;

  if (!user) return <AuthScreen fetchData={fetchData} />;

  return (
    <div className={`max-w-md mx-auto min-h-screen pb-20 border-x font-sans relative shadow-2xl transition-colors duration-300 ${darkMode ? 'bg-black text-white border-gray-800' : 'bg-white text-black border-gray-100'}`}>
      <script src="https://cdn.tailwindcss.com"></script>

      {showFollowList && <FollowListModal type={showFollowList} userId={activeProfileId} onClose={() => setShowFollowList(null)} openProfile={openProfile} getAvatar={getAvatar} darkMode={darkMode} />}
      {selectedPost && <PostDetailModal post={selectedPost} posts={posts} onClose={() => setSelectedPost(null)} getAvatar={getAvatar} openProfile={openProfile} onDelete={handleDeletePost} onLike={toggleLike} onReply={(p) => { setReplyTo(p); setSelectedPost(null); setView('home'); }} currentUser={user} darkMode={darkMode} />}
      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} user={user} darkMode={darkMode} setDarkMode={setDarkMode} />}

      {view === 'home' && (
        <div className="animate-in fade-in">
          <header className={`sticky top-0 z-30 backdrop-blur-md border-b p-4 flex justify-between items-center ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-50'}`}>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-cyan-500 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1">
              <Zap size={24} className="text-blue-600 fill-blue-600" /> GridStream
            </h1>
            <MessageCircle size={24} className="cursor-pointer" />
          </header>

          <form onSubmit={handlePost} className={`p-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            {replyTo && (
              <div className="flex items-center justify-between bg-blue-500/10 p-2 rounded-lg mb-3">
                <p className="text-xs font-bold text-blue-500">Replying to @{replyTo.profiles?.username}</p>
                <X size={14} className="cursor-pointer text-blue-500" onClick={() => setReplyTo(null)} />
              </div>
            )}
            <div className="flex gap-3">
              <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-10 h-10 rounded-full object-cover shadow-sm cursor-pointer" onClick={() => openProfile(user.id)} />
              <textarea className={`flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none bg-transparent font-medium`} placeholder={replyTo ? "Post your reply" : "今、何を考えてる？"} value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-12 mt-2">
              <label className="cursor-pointer text-blue-500 hover:bg-blue-50/10 p-2 rounded-full transition"><ImageIcon size={22}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
              <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs shadow-lg uppercase tracking-tighter">
                {uploading ? '...' : replyTo ? 'Reply' : 'Stream'}
              </button>
            </div>
          </form>

          <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
            {posts.filter(p => !p.parent_id).map(post => (
              <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onDelete={handleDeletePost} onLike={toggleLike} onReply={() => { setReplyTo(post); window.scrollTo(0,0); }} onSelect={() => setSelectedPost(post)} currentUser={user} darkMode={darkMode} />
            ))}
          </div>
        </div>
      )}

      {view === 'profile' && profileInfo && (
        <div className="animate-in fade-in pb-10">
          {/* プロフィール画面のヘッダー・基本情報は元のベースを維持 */}
          <div className={`h-32 relative overflow-hidden bg-gray-200 ${!profileInfo.header_url && 'bg-gradient-to-br from-blue-700 via-indigo-600 to-cyan-500'}`}>
            <img src={isEditing ? editData.header_url : profileInfo.header_url} className="w-full h-full object-cover" alt="" />
            {isEditing && (
              <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer text-white">
                <Camera size={24} /><input type="file" accept="image/*" ref={headerInputRef} className="hidden" />
              </label>
            )}
            {!isEditing && <button onClick={() => setView('home')} className="absolute top-4 left-4 bg-black/30 backdrop-blur-md p-2 rounded-full text-white"><ChevronLeft size={20}/></button>}
          </div>

          <div className="px-4 relative">
            <div className="absolute -top-12 left-4">
              <img src={getAvatar(profileInfo.username, profileInfo.avatar_url)} className={`w-24 h-24 rounded-full border-4 shadow-xl object-cover ${darkMode ? 'border-black bg-black' : 'border-white bg-white'}`} />
            </div>
            <div className="flex justify-end py-3 gap-2">
              {user.id === activeProfileId ? (
                <button onClick={() => setIsEditing(!isEditing)} className={`border rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-tighter ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>{isEditing ? 'Cancel' : 'Edit Profile'}</button>
              ) : (
                <button onClick={toggleFollow} className={`rounded-full px-6 py-1.5 text-xs font-black uppercase transition shadow-md ${stats.isFollowing ? 'bg-gray-100 text-black border border-gray-200' : 'bg-blue-600 text-white'}`}>{stats.isFollowing ? 'Following' : 'Follow'}</button>
              )}
              {isEditing && <button onClick={handleSaveProfile} className="bg-blue-600 text-white rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-tighter">Save</button>}
            </div>
            <div className="mt-4">
              <h2 className="text-2xl font-black tracking-tighter">{profileInfo.display_name}</h2>
              <p className="text-gray-400 text-sm font-bold">@{profileInfo.username}</p>
              <p className="mt-2 text-[15px] font-medium leading-relaxed">{profileInfo.bio || 'GridStream member.'}</p>
              <div className="flex gap-6 mt-4">
                <button className="flex gap-1 items-center"><span className="font-black">{stats.following}</span><span className="text-gray-400 text-[10px] uppercase font-black">Following</span></button>
                <button className="flex gap-1 items-center"><span className="font-black">{stats.followers}</span><span className="text-gray-400 text-[10px] uppercase font-black">Followers</span></button>
              </div>
            </div>
          </div>
          
          <div className={`flex border-b mt-6 sticky top-0 z-40 ${darkMode ? 'bg-black border-gray-800' : 'bg-white border-gray-100'}`}>
            <button onClick={() => setProfileTab('list')} className={`flex-grow py-4 flex justify-center items-center gap-2 ${profileTab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-300'}`}><List size={20}/></button>
            <button onClick={() => setProfileTab('grid')} className={`flex-grow py-4 flex justify-center items-center gap-2 ${profileTab === 'grid' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-300'}`}><Grid size={20}/></button>
          </div>

          <div className={profileTab === 'grid' ? "grid grid-cols-3 gap-[2px]" : ""}>
            {posts.filter(p => p.user_id === activeProfileId).map(post => (
              profileTab === 'grid' && post.image_url ? (
                <img key={post.id} src={post.image_url} className="aspect-square object-cover cursor-pointer" onClick={() => setSelectedPost(post)} />
              ) : (
                profileTab === 'list' && <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onDelete={handleDeletePost} onLike={toggleLike} onReply={() => { setReplyTo(post); setView('home'); window.scrollTo(0,0); }} onSelect={() => setSelectedPost(post)} currentUser={user} darkMode={darkMode} />
              )
            ))}
          </div>
        </div>
      )}

      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSelectedPost={setSelectedPost} darkMode={darkMode} />}

      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 shadow-sm ${darkMode ? 'bg-black/95 border-gray-800 text-gray-600' : 'bg-white/95 border-gray-100 text-gray-300'}`}>
        <HomeIcon onClick={() => { setView('home'); setReplyTo(null); }} className={`cursor-pointer ${view === 'home' ? 'text-blue-600' : ''}`} />
        <Search onClick={() => setView('search')} className={`cursor-pointer ${view === 'search' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer ${view === 'profile' && activeProfileId === user.id ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
      </nav>
    </div>
  );
}

// --- サブコンポーネント ---

function PostCard({ post, openProfile, getAvatar, onDelete, onLike, onReply, onSelect, currentUser, darkMode, isReply = false }) {
  const isMyPost = currentUser && post.user_id === currentUser.id;
  return (
    <article className={`p-4 flex gap-3 hover:bg-gray-50/5 transition ${!isReply ? 'border-b' : ''} ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
      <div className="flex flex-col items-center gap-1">
        <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer object-cover" onClick={() => openProfile(post.profiles.id)} />
        {isReply && <div className="w-0.5 grow bg-gray-200 dark:bg-gray-800 rounded-full" />}
      </div>
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-start">
          <div className="flex flex-col cursor-pointer mb-1" onClick={() => openProfile(post.profiles.id)}>
            <span className="font-black text-sm truncate">{post.profiles?.display_name}</span>
            <span className="text-gray-400 text-[11px] font-bold truncate">@{post.profiles?.username}</span>
          </div>
          {isMyPost && <button onClick={() => onDelete(post.id)} className="text-gray-300 hover:text-red-500 transition p-1"><Trash2 size={16} /></button>}
        </div>
        <p className={`text-[15px] mt-1 font-medium leading-relaxed whitespace-pre-wrap cursor-pointer`} onClick={onSelect}>{post.content}</p>
        {post.image_url && <img src={post.image_url} className="mt-3 rounded-2xl w-full max-h-80 object-cover border border-gray-100" onClick={onSelect} />}
        
        <div className="flex justify-between mt-4 text-gray-400 max-w-[200px] items-center">
          <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 transition ${post.is_liked ? 'text-red-500 scale-110' : 'hover:text-red-500'}`}>
            <Heart size={18} fill={post.is_liked ? "currentColor" : "none"} />
            <span className="text-xs font-black">{post.like_count || ''}</span>
          </button>
          <button onClick={onReply} className="hover:text-blue-500 transition flex items-center gap-1.5">
            <MessageCircle size={18} />
          </button>
          <Share2 size={18} className="hover:text-green-500 transition" />
        </div>
      </div>
    </article>
  );
}

function PostDetailModal({ post, posts, onClose, getAvatar, openProfile, onDelete, onLike, onReply, currentUser, darkMode }) {
  const replies = posts.filter(p => p.parent_id === post.id);
  
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end justify-center">
      <div className={`w-full max-w-md h-[90vh] rounded-t-[2.5rem] overflow-hidden flex flex-col ${darkMode ? 'bg-black' : 'bg-white'}`}>
        <div className="p-4 flex justify-between items-center border-b dark:border-gray-800">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"><ChevronLeft /></button>
          <span className="font-black uppercase tracking-widest text-xs text-blue-500">Thread</span>
          <div className="w-10" />
        </div>
        
        <div className="overflow-y-auto flex-grow">
          {/* メイン投稿 */}
          <div className="p-4 border-b dark:border-gray-800">
            <div className="flex gap-3 mb-4">
              <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-12 h-12 rounded-full object-cover" />
              <div>
                <p className="font-black">{post.profiles?.display_name}</p>
                <p className="text-gray-400 text-sm">@{post.profiles?.username}</p>
              </div>
            </div>
            <p className="text-lg font-medium leading-relaxed mb-4">{post.content}</p>
            {post.image_url && <img src={post.image_url} className="w-full rounded-2xl mb-4" />}
            <div className="flex gap-4 py-2 border-y dark:border-gray-800 text-gray-400">
              <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-1 ${post.is_liked ? 'text-red-500' : ''}`}><Heart size={20} fill={post.is_liked ? "currentColor" : "none"}/><span className="font-black">{post.like_count}</span></button>
              <button onClick={() => onReply(post)} className="flex items-center gap-1"><MessageCircle size={20} /><span>Reply</span></button>
            </div>
          </div>

          {/* 返信一覧 */}
          <div className="pb-10">
            {replies.length > 0 ? (
              replies.map(reply => (
                <PostCard key={reply.id} post={reply} openProfile={openProfile} getAvatar={getAvatar} onDelete={onDelete} onLike={onLike} onReply={() => onReply(reply)} onSelect={() => {}} currentUser={currentUser} darkMode={darkMode} isReply={true} />
              ))
            ) : (
              <p className="p-10 text-center text-gray-400 font-bold uppercase text-xs tracking-widest">No replies yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchView({ posts, openProfile, searchQuery, setSearchQuery, setSelectedPost, darkMode }) {
  const mediaPosts = posts.filter(p => p.image_url && (p.content.includes(searchQuery) || p.profiles?.username.includes(searchQuery)));
  return (
    <div className="animate-in fade-in">
      <div className={`p-4 sticky top-0 z-10 border-b ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-100'}`}>
        <div className="relative"><Search className="absolute left-3 top-3 text-gray-400" size={18} /><input type="text" placeholder="DISCOVER" className={`w-full rounded-xl py-2 pl-10 pr-4 outline-none text-xs font-black uppercase ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100'}`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-3 gap-[2px]">
        {mediaPosts.map((post) => (
          <img key={post.id} src={post.image_url} className="aspect-square w-full h-full object-cover cursor-pointer hover:opacity-80 transition" onClick={() => setSelectedPost(post)} />
        ))}
      </div>
    </div>
  );
}

// ※AuthScreen, SettingsScreen, FollowListModal は元のベースコードを継承
