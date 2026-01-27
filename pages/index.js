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
    if (data) { setMyProfile(data); setEditData(data); }
  }

  async function fetchData() {
    console.log("Fetching latest posts...");
    const { data: postsData, error } = await supabase
      .from('posts')
      .select('*, profiles(id, username, display_name, avatar_url)')
      .order('created_at', { ascending: false });
    
    if (error) console.error("Fetch error:", error);
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

  const handleImageSelect = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setEditData(prev => ({ ...prev, [type]: url }));
    }
  };

  const validateProfile = (displayName, username) => {
    if (displayName.length > 20) {
      alert("表示名は20文字以内で入力してください。");
      return false;
    }
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      alert("ユーザー名には英数字とアンダースコアのみ使用可能です。");
      return false;
    }
    return true;
  };

  async function handleSaveProfile() {
    if (!validateProfile(editData.display_name, editData.username)) return;
    setUploading(true);
    let { avatar_url, header_url, display_name, username, bio } = editData;
    if (avatarInputRef.current?.files[0]) avatar_url = await uploadToCloudinary(avatarInputRef.current.files[0]);
    if (headerInputRef.current?.files[0]) header_url = await uploadToCloudinary(headerInputRef.current.files[0]);

    const { error } = await supabase.from('profiles').update({ 
      display_name, 
      username: username.toLowerCase(), 
      bio, 
      avatar_url, 
      header_url 
    }).eq('id', user.id);

    if (error) {
      alert("エラー: ユーザー名が既に使われている可能性があります。");
    } else {
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
    const { error } = await supabase.from('posts').insert([{ content: newPost, user_id: user.id, image_url: imageUrl }]);
    if (error) alert("投稿失敗: " + error.message);
    setNewPost('');
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchData(); // 再読み込み
    setUploading(false);
  }

  // --- 修正版：削除機能 ---
  async function handleDeletePost(postId) {
    if (!window.confirm("この投稿をDBから完全に削除します。よろしいですか？")) return;
    
    console.log("Attempting to delete post ID:", postId);
    
    // Supabaseへの削除リクエスト
    const { error, count } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', user.id); // 自分が作成者であることを確認

    if (error) {
      console.error("Supabase Delete Error:", error.message);
      alert("削除に失敗しました: " + error.message);
      return;
    }

    // 削除が成功したかどうかの確認
    console.log("Delete response error status:", error);
    
    // フロントエンドの状態を即座に更新
    setPosts(prev => prev.filter(p => p.id !== postId));
    if (selectedPost?.id === postId) setSelectedPost(null);
    
    // 念のためDBと再同期
    fetchData();
    alert("削除が完了しました。");
  }

  const openProfile = async (userId) => {
    setActiveProfileId(userId);
    setShowFollowList(null); 
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

  if (!user) return <AuthScreen fetchData={fetchData} validateProfile={validateProfile} />;

  return (
    <div className={`max-w-md mx-auto min-h-screen pb-20 border-x font-sans relative shadow-2xl overflow-x-hidden transition-colors duration-300 ${darkMode ? 'bg-black text-white border-gray-800' : 'bg-white text-black border-gray-100'}`}>
      <script src="https://cdn.tailwindcss.com"></script>

      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} getAvatar={getAvatar} darkMode={darkMode} />}
      {showFollowList && <FollowListModal type={showFollowList} userId={activeProfileId} onClose={() => setShowFollowList(null)} openProfile={openProfile} getAvatar={getAvatar} darkMode={darkMode} />}
      {selectedPost && <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} getAvatar={getAvatar} openProfile={openProfile} onDelete={handleDeletePost} currentUser={user} darkMode={darkMode} />}
      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} user={user} darkMode={darkMode} setDarkMode={setDarkMode} />}

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
              <textarea className={`flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none bg-transparent font-medium`} placeholder="今、何を考えてる？" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
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
              <PostCard 
                key={post.id} 
                post={post} 
                openProfile={openProfile} 
                getAvatar={getAvatar} 
                onDelete={handleDeletePost} 
                currentUser={user}
                darkMode={darkMode} 
              />
            ))}
          </div>
        </div>
      )}

      {view === 'profile' && profileInfo && (
        <div className="animate-in fade-in pb-10">
          <div className={`h-32 relative overflow-hidden bg-gray-200 ${!profileInfo.header_url && 'bg-gradient-to-br from-blue-700 via-indigo-600 to-cyan-500'}`}>
            <img src={isEditing ? editData.header_url : profileInfo.header_url} className="w-full h-full object-cover" alt="" />
            {isEditing && (
              <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer text-white">
                <Camera size={24} /><input type="file" accept="image/*" ref={headerInputRef} className="hidden" onChange={(e) => handleImageSelect(e, 'header_url')} />
              </label>
            )}
            {!isEditing && (
              <>
                <button onClick={() => setView('home')} className="absolute top-4 left-4 bg-black/30 backdrop-blur-md p-2 rounded-full text-white"><ChevronLeft size={20}/></button>
                {user.id === activeProfileId && (
                  <button onClick={() => setShowSettings(true)} className="absolute top-4 right-4 bg-black/30 backdrop-blur-md p-2 rounded-full text-white"><Settings size={20}/></button>
                )}
              </>
            )}
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
            <div className="flex justify-end py-3 gap-2">
              {user.id === activeProfileId ? (
                isEditing ? (
                  <div className="flex gap-2">
                    <button onClick={() => { setIsEditing(false); setEditData(myProfile); }} className={`border rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-tighter ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>Cancel</button>
                    <button onClick={handleSaveProfile} disabled={uploading} className="bg-blue-600 text-white rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-tighter shadow-md">{uploading ? '...' : 'Save'}</button>
                  </div>
                ) : ( <button onClick={() => setIsEditing(true)} className={`border rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-tighter ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>Edit Profile</button> )
              ) : (
                <button onClick={toggleFollow} className={`rounded-full px-6 py-1.5 text-xs font-black uppercase transition shadow-md ${stats.isFollowing ? 'bg-gray-100 text-black border border-gray-200' : 'bg-blue-600 text-white'}`}>{stats.isFollowing ? 'Following' : 'Follow'}</button>
              )}
            </div>
            <div className="mt-4 space-y-4">
              {isEditing ? (
                <div className="space-y-3 pt-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Display Name (Max 20)</label>
                    <input className={`w-full p-3 rounded-xl outline-none font-bold text-sm ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50'}`} value={editData.display_name} onChange={(e) => setEditData({...editData, display_name: e.target.value})} placeholder="Display Name" maxLength={20} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Username (English/Number only)</label>
                    <input className={`w-full p-3 rounded-xl outline-none font-bold text-sm ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50'}`} value={editData.username} onChange={(e) => setEditData({...editData, username: e.target.value})} placeholder="username_only" />
                  </div>
                  <textarea className={`w-full p-3 rounded-xl outline-none font-medium text-sm h-20 resize-none ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50'}`} value={editData.bio} onChange={(e) => setEditData({...editData, bio: e.target.value})} placeholder="Bio" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div><h2 className="text-2xl font-black tracking-tighter">{profileInfo.display_name}</h2><p className="text-gray-400 text-sm font-bold">@{profileInfo.username}</p></div>
                  <p className="text-[15px] font-medium leading-relaxed">{profileInfo.bio || 'GridStream member.'}</p>
                  <div className="flex gap-6 pt-1">
                    <button onClick={() => setShowFollowList('following')} className="hover:opacity-60 transition flex gap-1.5 items-center"><span className="font-black text-lg">{stats.following}</span><span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Following</span></button>
                    <button onClick={() => setShowFollowList('followers')} className="hover:opacity-60 transition flex gap-1.5 items-center"><span className="font-black text-lg">{stats.followers}</span><span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Followers</span></button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {!isEditing && (
            <>
              <div className={`flex border-b mt-6 sticky top-0 z-40 shadow-sm ${darkMode ? 'bg-black/95 border-gray-800' : 'bg-white/95 border-gray-100'}`}>
                <button onClick={() => setProfileTab('list')} className={`flex-grow py-4 flex justify-center items-center gap-2 ${profileTab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-300'}`}><List size={20}/><span className="text-[10px] font-black uppercase tracking-tighter">Threads</span></button>
                <button onClick={() => setProfileTab('grid')} className={`flex-grow py-4 flex justify-center items-center gap-2 ${profileTab === 'grid' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-300'}`}><Grid size={20}/><span className="text-[10px] font-black uppercase tracking-tighter">Media</span></button>
              </div>
              <div className={profileTab === 'grid' ? "grid grid-cols-3 gap-[2px]" : `divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
                {posts.filter(p => p.user_id === activeProfileId).filter(p => profileTab === 'grid' ? !!p.image_url : true).map(post => 
                  profileTab === 'grid' ? ( 
                    <img key={post.id} src={post.image_url} className="aspect-square w-full h-full object-cover cursor-pointer hover:brightness-90 transition" onClick={() => setSelectedPost(post)} /> 
                  ) : ( 
                    <PostCard 
                      key={post.id} 
                      post={post} 
                      openProfile={openProfile} 
                      getAvatar={getAvatar} 
                      onDelete={handleDeletePost} 
                      currentUser={user}
                      darkMode={darkMode} 
                    /> 
                  )
                )}
              </div>
            </>
          )}
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

// (以下、Sub-Componentsは変更なしですがフルコード表示の指示に従い含めています)
function SettingsScreen({ onClose, user, darkMode, setDarkMode }) {
  const [loading, setLoading] = useState(false);
  const [newEmail, setNewEmail] = useState(user.email);
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const handleUpdateAccount = async (e) => {
    e.preventDefault(); setLoading(true); setMessage({ type: '', text: '' });
    const updates = {}; if (newEmail !== user.email) updates.email = newEmail; if (newPassword) updates.password = newPassword;
    if (Object.keys(updates).length === 0) { setLoading(false); return; }
    const { error } = await supabase.auth.updateUser(updates);
    if (error) setMessage({ type: 'error', text: error.message });
    else { setMessage({ type: 'success', text: 'Account updated!' }); setNewPassword(''); }
    setLoading(false);
  };
  const handleLogout = () => { supabase.auth.signOut(); onClose(); };
  return (
    <div className={`fixed inset-0 z-[100] overflow-y-auto ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <header className="p-4 border-b flex items-center gap-4"><ChevronLeft onClick={onClose} className="cursor-pointer" /><h2 className="font-black">Settings</h2></header>
      <div className="p-4 space-y-6">
        <form onSubmit={handleUpdateAccount} className="space-y-4">
          {message.text && <div className={`p-4 rounded-xl text-xs font-bold ${message.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>{message.text}</div>}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400">Email</label>
            <input className="w-full p-4 rounded-xl bg-gray-100 dark:bg-gray-900 outline-none" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </div>
          <button className="w-full bg-blue-600 text-white font-black py-4 rounded-xl uppercase text-xs">Update</button>
        </form>
        <button onClick={() => setDarkMode(!darkMode)} className="w-full flex justify-between p-4 rounded-xl bg-gray-100 dark:bg-gray-900 font-bold">{darkMode ? 'Light Mode' : 'Dark Mode'}</button>
        <button onClick={handleLogout} className="w-full p-4 rounded-xl bg-red-50 text-red-500 font-black uppercase text-xs">Logout</button>
      </div>
    </div>
  );
}

function FollowListModal({ type, userId, onClose, openProfile, getAvatar, darkMode }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function fetchList() {
      setLoading(true);
      const sourceCol = type === 'followers' ? 'following_id' : 'follower_id';
      const targetCol = type === 'followers' ? 'follower_id' : 'following_id';
      const { data: followData } = await supabase.from('follows').select(targetCol).eq(sourceCol, userId);
      if (followData && followData.length > 0) {
        const ids = followData.map(f => f[targetCol]);
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids);
        if (profiles) setList(profiles);
      }
      setLoading(false);
    }
    if (userId) fetchList();
  }, [type, userId]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center">
      <div className={`w-full max-w-md rounded-t-[2.5rem] max-h-[80vh] flex flex-col shadow-2xl ${darkMode ? 'bg-black' : 'bg-white'}`}>
        <div className="p-6 border-b flex justify-between items-center"><h3 className="font-black text-blue-600 uppercase">{type}</h3><X onClick={onClose} className="cursor-pointer" /></div>
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

function PostCard({ post, openProfile, getAvatar, onDelete, currentUser, darkMode }) {
  const isMyPost = currentUser && post.user_id === currentUser.id;
  return (
    <article className={`p-4 flex gap-3 hover:bg-gray-50/5 transition border-b last:border-0 ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
      <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer object-cover" onClick={() => openProfile(post.profiles.id)} />
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-start">
          <div className="flex flex-col cursor-pointer mb-1" onClick={() => openProfile(post.profiles.id)}>
            <span className="font-black text-sm truncate">{post.profiles?.display_name}</span>
            <span className="text-gray-400 text-[11px] font-bold truncate">@{post.profiles?.username}</span>
          </div>
          {isMyPost && (
            <button onClick={() => onDelete(post.id)} className="text-gray-300 hover:text-red-500 transition p-1 ml-2">
              <Trash2 size={16} />
            </button>
          )}
        </div>
        <p className={`text-[15px] mt-1 font-medium leading-relaxed whitespace-pre-wrap ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{post.content}</p>
        {post.image_url && <img src={post.image_url} className="mt-3 rounded-2xl w-full max-h-80 object-cover border border-gray-100" />}
        <div className="flex justify-between mt-4 text-gray-400 max-w-[200px]"><Heart size={18} /><MessageCircle size={18} /><Share2 size={18} /></div>
      </div>
    </article>
  );
}

function PostDetailModal({ post, onClose, getAvatar, openProfile, onDelete, currentUser, darkMode }) {
  const isMyPost = currentUser && post.user_id === currentUser.id;
  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4">
      <div className="absolute top-6 right-6 flex gap-4">
        {isMyPost && <button onClick={() => { onDelete(post.id); onClose(); }} className="text-white p-2 hover:bg-red-500/20 rounded-full transition"><Trash2 size={24}/></button>}
        <button onClick={onClose} className="text-white p-2 hover:bg-white/10 rounded-full transition"><X size={28}/></button>
      </div>
      <div className={`w-full max-w-md rounded-[2.5rem] overflow-hidden ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="p-5 border-b flex items-center gap-3">
          <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-10 h-10 rounded-full object-cover" />
          <div className="flex flex-col"><p className="font-black text-sm">{post.profiles?.display_name}</p><p className="text-gray-400 text-xs font-bold">@{post.profiles?.username}</p></div>
        </div>
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {post.image_url && <img src={post.image_url} className="w-full rounded-2xl mb-4" />}
          <p className="font-medium leading-relaxed">{post.content}</p>
        </div>
      </div>
    </div>
  );
}

function SearchView({ posts, openProfile, searchQuery, setSearchQuery, setSelectedPost, darkMode }) {
  return (
    <div className="animate-in fade-in">
      <div className={`p-4 sticky top-0 z-10 border-b ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-100'}`}>
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input type="text" placeholder="DISCOVER" className={`w-full rounded-xl py-2 pl-10 pr-4 outline-none text-xs font-black uppercase ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100'}`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
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

function AuthScreen({ fetchData, validateProfile }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  async function handleAuth(e) {
    e.preventDefault();
    if (!isLogin) {
      const initialId = displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000);
      if (!validateProfile(displayName, initialId)) return;
    }
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
        {!isLogin && <input type="text" placeholder="DISPLAY NAME (MAX 20)" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={20} />}
        <input type="email" placeholder="EMAIL" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="PASSWORD" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold text-sm" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="w-full bg-blue-700 text-white font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest text-xs">{loading ? '...' : (isLogin ? 'Login' : 'Join')}</button>
      </form>
      <button onClick={() => setIsLogin(!isLogin)} className="mt-8 text-xs font-black text-gray-400 uppercase tracking-widest">{isLogin ? "Create Account" : "Back to Login"}</button>
    </div>
  );
       }
