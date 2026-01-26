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
  
  // プロフィール表示・編集ステート
  const [activeProfileId, setActiveProfileId] = useState(null); 
  const [profileInfo, setProfileInfo] = useState(null); 
  const [stats, setStats] = useState({ followers: 0, following: 0, isFollowing: false });
  const [showFollowList, setShowFollowList] = useState(null); 

  // 編集用の一時ステート
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ display_name: '', username: '', bio: '', avatar_url: '', header_url: '' });

  // 自分の情報
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
      setEditData(data); // 編集用ステートの初期化
    }
  }

  async function fetchData() {
    const { data: postsData } = await supabase.from('posts').select('*, profiles(id, username, display_name, avatar_url)').order('created_at', { ascending: false });
    if (postsData) setPosts(postsData);
    const { data: profData } = await supabase.from('profiles').select('*');
    if (profData) setAllProfiles(profData);
  }

  // Cloudinaryへのアップロード共通関数
  async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    return data.secure_url;
  }

  // --- プロフィール保存処理 ---
  async function handleSaveProfile() {
    setUploading(true);
    let { avatar_url, header_url } = editData;

    if (avatarInputRef.current?.files[0]) {
      avatar_url = await uploadToCloudinary(avatarInputRef.current.files[0]);
    }
    if (headerInputRef.current?.files[0]) {
      header_url = await uploadToCloudinary(headerInputRef.current.files[0]);
    }

    const updated = { ...editData, avatar_url, header_url };
    const { error } = await supabase.from('profiles').update(updated).eq('id', user.id);
    
    if (error) {
      alert("Error updating profile: " + error.message);
    } else {
      setMyProfile(updated);
      setProfileInfo(updated);
      setIsEditing(false);
      fetchData(); // 投稿一覧のアイコンも更新するため
    }
    setUploading(false);
  }

  async function handlePost(e) {
    e.preventDefault();
    if (!newPost.trim() || !user) return;
    setUploading(true);
    let imageUrl = null;
    if (fileInputRef.current?.files[0]) {
      imageUrl = await uploadToCloudinary(fileInputRef.current.files[0]);
    }
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
    setEditData(profile); // 自分のプロフィールの場合は編集用にセット
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

  const handleLogout = async () => {
    if (confirm("Logout from GridStream?")) {
      await supabase.auth.signOut();
      setUser(null);
    }
  };

  const getAvatar = (name, url) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;

  if (!user) return <AuthScreen fetchData={fetchData} />;

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-20 border-x border-gray-100 font-sans text-black relative shadow-2xl overflow-x-hidden">
      <script src="https://cdn.tailwindcss.com"></script>

      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} getAvatar={getAvatar} />}
      {showFollowList && <FollowListModal type={showFollowList} userId={activeProfileId} onClose={() => setShowFollowList(null)} openProfile={openProfile} getAvatar={getAvatar} />}

      {/* --- HOME VIEW --- */}
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
              <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-10 h-10 rounded-full shadow-sm object-cover" onClick={() => openProfile(user.id)} />
              <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none bg-transparent" placeholder="今、何を考えてる？" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-12 mt-2">
              <label className="cursor-pointer text-blue-500 hover:bg-blue-50 p-2 rounded-full transition"><ImageIcon size={22}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
              <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs shadow-lg shadow-blue-100 uppercase tracking-tighter">
                {uploading ? '...' : 'Stream'}
              </button>
            </div>
          </form>
          <div className="divide-y divide-gray-100">{posts.map(post => <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} />)}</div>
        </div>
      )}

      {/* --- PROFILE VIEW (Normal & Edit) --- */}
      {view === 'profile' && profileInfo && (
        <div className="animate-in fade-in pb-10">
          {/* Header Section */}
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
            {/* Avatar Section */}
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

            {/* Action Buttons */}
            <div className="flex justify-end py-3 gap-2">
              {user.id === activeProfileId ? (
                isEditing ? (
                  <div className="flex gap-2">
                    <button onClick={() => setIsEditing(false)} className="border border-gray-200 rounded-full px-5 py-1.5 text-xs font-black uppercase">Cancel</button>
                    <button onClick={handleSaveProfile} disabled={uploading} className="bg-blue-600 text-white rounded-full px-5 py-1.5 text-xs font-black uppercase">{uploading ? '...' : 'Save'}</button>
                  </div>
                ) : (
                  <button onClick={() => setIsEditing(true)} className="border border-gray-200 rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-tight">Edit Profile</button>
                )
              ) : (
                <button onClick={toggleFollow} className={`rounded-full px-6 py-1.5 text-xs font-black uppercase tracking-tight transition shadow-md ${stats.isFollowing ? 'bg-gray-100 text-black border border-gray-200' : 'bg-blue-600 text-white'}`}>
                  {stats.isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>

            {/* Profile Info Form */}
            <div className="mt-4 space-y-4">
              {isEditing ? (
                <div className="space-y-3 pt-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Display Name</label>
                    <input className="w-full bg-gray-50 p-3 rounded-xl outline-none font-bold text-sm" value={editData.display_name} onChange={(e) => setEditData({...editData, display_name: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Username</label>
                    <div className="relative">
                      <AtSign className="absolute left-3 top-3.5 text-gray-300" size={14}/>
                      <input className="w-full bg-gray-50 p-3 pl-8 rounded-xl outline-none font-bold text-sm" value={editData.username} onChange={(e) => setEditData({...editData, username: e.target.value.toLowerCase().replace(/\s/g, '')})} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Bio</label>
                    <textarea className="w-full bg-gray-50 p-3 rounded-xl outline-none font-medium text-sm h-20 resize-none" value={editData.bio} onChange={(e) => setEditData({...editData, bio: e.target.value})} />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <h2 className="text-2xl font-black tracking-tighter">{profileInfo.display_name}</h2>
                    <p className="text-gray-400 text-sm font-bold">@{profileInfo.username}</p>
                  </div>
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
                  profileTab === 'grid' ? (
                    post.image_url && <img key={post.id} src={post.image_url} className="aspect-square object-cover" onClick={() => setSelectedPost(post)} />
                  ) : (
                    <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} />
                  )
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* --- OTHER VIEWS --- */}
      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSelectedPost={setSelectedPost} />}
      {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} setDmTarget={setDmTarget} getAvatar={getAvatar} openProfile={openProfile} />}

      <nav className="fixed bottom-0 max-w-md w-full bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-around py-4 text-gray-300 z-40">
        <HomeIcon onClick={() => setView('home')} className={view === 'home' ? 'text-blue-600' : ''} />
        <Search onClick={() => setView('search')} className={view === 'search' ? 'text-black' : ''} />
        <MessageCircle onClick={() => setView('messages')} className={view === 'messages' ? 'text-black' : ''} />
        <UserIcon onClick={() => openProfile(user.id)} className={view === 'profile' && activeProfileId === user.id ? 'text-black' : ''} />
      </nav>
    </div>
  );
}

// (PostCard, FollowListModal, SearchView, MessagesList, AuthScreen, DMScreen は前のコードと同じ)
// ...（省略すると動かないため、前回の完成形を維持して統合してください）
