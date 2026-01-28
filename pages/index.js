import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User as UserIcon, Image as ImageIcon, Send, ChevronLeft, Zap, LogOut, Settings, Trash2, MessageSquare, UserCheck, AtSign, AlignLeft, Mail, Lock, CheckCircle2 } from 'lucide-react';

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
  const [uploading, setUploading] = useState(false);
  
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
    if (data) { 
      setMyProfile(data); 
      setEditData(data); 
    }
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
    }
    const { data: profData } = await supabase.from('profiles').select('*');
    if (profData) setAllProfiles(profData);
  }

  async function handleUpdateProfile() {
    setUploading(true);
    let { avatar_url, header_url } = editData;
    if (avatarInputRef.current?.files[0]) avatar_url = await uploadToCloudinary(avatarInputRef.current.files[0]);
    if (headerInputRef.current?.files[0]) header_url = await uploadToCloudinary(headerInputRef.current.files[0]);

    const { error } = await supabase.from('profiles').update({
      display_name: editData.display_name,
      username: editData.username,
      bio: editData.bio,
      avatar_url,
      header_url
    }).eq('id', user.id);

    if (!error) {
      await fetchMyProfile(user.id);
      await openProfile(user.id);
      setIsEditing(false);
    }
    setUploading(false);
  }

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

  const [dmTarget, setDmTarget] = useState(null);

  if (!user) return <AuthScreen fetchData={fetchData} />;

  return (
    <div className={`max-w-md mx-auto min-h-screen pb-20 border-x font-sans relative shadow-2xl transition-colors duration-300 ${darkMode ? 'bg-black text-white border-gray-800' : 'bg-white text-black border-gray-100'}`}>
      
      {/* Modals */}
      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} getAvatar={getAvatar} darkMode={darkMode} />}
      {showFollowList && <FollowListModal type={showFollowList} userId={activeProfileId} onClose={() => setShowFollowList(null)} openProfile={openProfile} getAvatar={getAvatar} darkMode={darkMode} />}
      {selectedPost && <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} getAvatar={getAvatar} openProfile={openProfile} onDelete={async (id) => { await supabase.from('posts').delete().eq('id', id); setSelectedPost(null); fetchData(); }} currentUser={user} darkMode={darkMode} refreshPosts={fetchData} />}
      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} user={user} myProfile={myProfile} darkMode={darkMode} setDarkMode={setDarkMode} />}

      {/* Main Views */}
      {view === 'home' && (
        <div className="flex flex-col">
          <header className={`sticky top-0 z-30 backdrop-blur-md border-b p-4 flex justify-between items-center ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-50'}`}>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-cyan-500 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1">
              <Zap size={24} className="text-blue-600 fill-blue-600" /> GridStream
            </h1>
            <MessageCircle size={24} className="cursor-pointer" onClick={() => setView('messages')} />
          </header>
          
          <form onSubmit={handlePost} className="p-4 border-b border-gray-100/10">
            <div className="flex gap-3">
              <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-10 h-10 rounded-full object-cover shadow-sm cursor-pointer" onClick={() => openProfile(user.id)} />
              <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none bg-transparent font-medium" placeholder="今、何を考えてる？" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-12 mt-2">
              <label className="cursor-pointer text-blue-500 hover:bg-blue-50/10 p-2 rounded-full transition"><ImageIcon size={22}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
              <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs shadow-lg uppercase tracking-tighter">{uploading ? '...' : 'Stream'}</button>
            </div>
          </form>

          <div className="divide-y divide-gray-100/10">
            {posts.map(post => (
              <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} currentUser={user} darkMode={darkMode} onOpenDetail={() => setSelectedPost(post)} />
            ))}
          </div>
        </div>
      )}

      {view === 'profile' && profileInfo && (
        <div className="pb-10">
          {isEditing ? (
            <div className="p-4 space-y-6">
              <header className="flex justify-between items-center mb-6">
                <button onClick={() => setIsEditing(false)} className="p-2"><X size={24}/></button>
                <h2 className="font-black uppercase tracking-widest text-sm">Edit Profile</h2>
                <button onClick={handleUpdateProfile} disabled={uploading} className="bg-blue-600 text-white px-5 py-2 rounded-full text-xs font-black uppercase shadow-lg active:scale-95 transition-transform">{uploading ? '...' : 'Save'}</button>
              </header>

              <div className="space-y-6 overflow-y-auto max-h-[75vh] pr-1">
                {/* Header Edit */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Header Image</p>
                  <div className="relative h-32 rounded-3xl overflow-hidden group cursor-pointer border border-gray-100/10 shadow-inner" onClick={() => headerInputRef.current.click()}>
                    <img src={editData.header_url || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&q=80'} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="text-white" size={32}/></div>
                    <input type="file" ref={headerInputRef} className="hidden" accept="image/*" />
                  </div>
                </div>

                {/* Avatar Edit */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current.click()}>
                    <img src={getAvatar(editData.username, editData.avatar_url)} className="w-28 h-28 rounded-full object-cover border-4 border-blue-600 shadow-2xl" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="text-white" size={28}/></div>
                    <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Profile Photo</p>
                </div>

                {/* Fields */}
                <div className="space-y-4">
                  <div className={`p-4 rounded-3xl transition-colors ${darkMode ? 'bg-gray-900 shadow-inner' : 'bg-gray-50'}`}>
                    <label className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-2 mb-1"><UserCheck size={12}/> Display Name</label>
                    <input className="w-full bg-transparent outline-none font-bold text-sm" value={editData.display_name} onChange={e => setEditData({...editData, display_name: e.target.value})} />
                  </div>
                  <div className={`p-4 rounded-3xl transition-colors ${darkMode ? 'bg-gray-900 shadow-inner' : 'bg-gray-50'}`}>
                    <label className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-2 mb-1"><AtSign size={12}/> Username</label>
                    <input className="w-full bg-transparent outline-none font-bold text-sm text-blue-500" value={editData.username} onChange={e => setEditData({...editData, username: e.target.value})} />
                  </div>
                  <div className={`p-4 rounded-3xl transition-colors ${darkMode ? 'bg-gray-900 shadow-inner' : 'bg-gray-50'}`}>
                    <label className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-2 mb-1"><AlignLeft size={12}/> Bio</label>
                    <textarea className="w-full bg-transparent outline-none font-bold text-sm h-24 resize-none leading-relaxed" value={editData.bio} onChange={e => setEditData({...editData, bio: e.target.value})} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="relative h-48 bg-gray-200">
                <img src={profileInfo.header_url || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&q=80'} className="w-full h-full object-cover" />
                <div className="absolute top-4 inset-x-4 flex justify-between">
                  <button onClick={() => setView('home')} className="bg-black/30 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/50 transition"><ChevronLeft size={20}/></button>
                  <button onClick={() => setShowSettings(true)} className="bg-black/30 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/50 transition"><Settings size={20}/></button>
                </div>
              </div>
              <div className="px-4 relative">
                <div className="flex justify-between items-end -mt-14 mb-4">
                  <img src={getAvatar(profileInfo.username, profileInfo.avatar_url)} className={`w-28 h-28 rounded-full border-4 shadow-2xl object-cover ${darkMode ? 'border-black bg-black' : 'border-white bg-white'}`} />
                  {user.id === activeProfileId && (
                    <button onClick={() => setIsEditing(true)} className={`border rounded-full px-6 py-2 text-xs font-black uppercase tracking-tighter shadow-sm hover:scale-95 transition-transform ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>Edit Profile</button>
                  )}
                </div>
                <div className="mt-2">
                  <h2 className="text-2xl font-black tracking-tighter">{profileInfo.display_name}</h2>
                  <p className="text-gray-400 text-sm font-bold">@{profileInfo.username}</p>
                  <p className="mt-4 text-[15px] font-medium leading-relaxed max-w-[90%]">{profileInfo.bio || 'GridStream member.'}</p>
                  <div className="flex gap-6 mt-6">
                    <button onClick={() => setShowFollowList('following')} className="text-sm hover:opacity-70"><span className="font-black">{stats.following}</span> <span className="text-gray-400">Following</span></button>
                    <button onClick={() => setShowFollowList('followers')} className="text-sm hover:opacity-70"><span className="font-black">{stats.followers}</span> <span className="text-gray-400">Followers</span></button>
                  </div>
                </div>
              </div>
              <div className="divide-y mt-10 border-t border-gray-100/10">
                {posts.filter(p => p.user_id === activeProfileId).map(post => (
                  <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} currentUser={user} darkMode={darkMode} onOpenDetail={() => setSelectedPost(post)} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSelectedPost={setSelectedPost} darkMode={darkMode} />}
      {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} setDmTarget={setDmTarget} getAvatar={getAvatar} openProfile={openProfile} darkMode={darkMode} />}

      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 shadow-2xl backdrop-blur-lg ${darkMode ? 'bg-black/95 border-gray-800 text-gray-600' : 'bg-white/95 border-gray-100 text-gray-300'}`}>
        <HomeIcon onClick={() => setView('home')} className={`cursor-pointer transition-colors ${view === 'home' ? 'text-blue-600' : ''}`} />
        <Search onClick={() => setView('search')} className={`cursor-pointer transition-colors ${view === 'search' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <MessageCircle onClick={() => setView('messages')} className={`cursor-pointer transition-colors ${view === 'messages' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer transition-colors ${view === 'profile' && activeProfileId === user.id ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
      </nav>
    </div>
  );
}

// --- Settings Screen ---
function SettingsScreen({ onClose, user, myProfile, darkMode, setDarkMode }) {
  const [newEmail, setNewEmail] = useState(user.email);
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState('');

  const updateEmail = async () => {
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setStatus(error ? error.message : 'Confirmation email sent.');
  };

  const updatePassword = async () => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setStatus(error ? error.message : 'Password updated.');
    setNewPassword('');
  };

  return (
    <div className={`fixed inset-0 z-[110] overflow-y-auto transition-colors duration-300 ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <header className="p-4 border-b flex items-center gap-4 sticky top-0 z-10 bg-inherit">
        <ChevronLeft onClick={onClose} className="cursor-pointer hover:scale-110 transition-transform" />
        <h2 className="font-black uppercase tracking-widest text-sm">Settings</h2>
      </header>
      <div className="p-6 space-y-8 max-w-sm mx-auto">
        {status && (
          <div className="p-4 bg-blue-500/10 text-blue-500 rounded-3xl text-xs font-bold flex items-center gap-3 animate-bounce">
            <CheckCircle2 size={16}/> {status}
          </div>
        )}

        <section className="space-y-4">
          <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">Security</h3>
          <div className={`p-5 rounded-[2rem] space-y-6 shadow-sm border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-100'}`}>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-2"><Mail size={12}/> Email</label>
              <div className="flex flex-col gap-2">
                <input className="w-full bg-transparent border-b border-gray-100/20 outline-none text-sm font-bold pb-2" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                <button onClick={updateEmail} className="self-end text-[10px] font-black text-blue-500 uppercase hover:underline">Update Email</button>
              </div>
            </div>
            <div className="space-y-3 pt-4 border-t border-gray-100/10">
              <label className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-2"><Lock size={12}/> New Password</label>
              <div className="flex flex-col gap-2">
                <input type="password" placeholder="••••••••" className="w-full bg-transparent border-b border-gray-100/20 outline-none text-sm font-bold pb-2" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                <button onClick={updatePassword} className="self-end text-[10px] font-black text-blue-500 uppercase hover:underline">Update Password</button>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">Preferences</h3>
          <button onClick={() => setDarkMode(!darkMode)} className={`w-full flex justify-between items-center p-5 rounded-[2rem] border transition-all ${darkMode ? 'bg-gray-900 border-gray-800 shadow-inner' : 'bg-gray-50 border-gray-100 shadow-sm'}`}>
            <span className="text-sm font-bold uppercase tracking-tighter">Dark Mode</span>
            <div className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${darkMode ? 'translate-x-7' : 'translate-x-1'}`} />
            </div>
          </button>
        </section>

        <section className="pt-8 border-t border-gray-100/10">
          <button onClick={() => supabase.auth.signOut()} className="w-full p-5 rounded-[2rem] bg-red-500/10 text-red-500 font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-red-500 hover:text-white transition-all shadow-lg active:scale-95">
            <LogOut size={16}/> Logout
          </button>
        </section>
      </div>
    </div>
  );
}

// --- Card & List Components ---
function PostCard({ post, openProfile, getAvatar, currentUser, darkMode, onOpenDetail }) {
  return (
    <article className="p-4 flex gap-4 transition-colors border-b border-gray-100/5 hover:bg-gray-50/5">
      <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-12 h-12 rounded-full cursor-pointer object-cover shadow-lg active:scale-90 transition-transform" onClick={() => openProfile(post.profiles.id)} />
      <div className="flex-grow min-w-0">
        <div className="flex flex-col cursor-pointer mb-2" onClick={() => openProfile(post.profiles.id)}>
          <span className="font-black text-sm tracking-tight truncate">{post.profiles?.display_name}</span>
          <span className="text-gray-400 text-[11px] font-bold">@{post.profiles?.username}</span>
        </div>
        <p className="text-[15px] mt-1 font-medium leading-relaxed whitespace-pre-wrap">{post.content}</p>
        {post.image_url && <img src={post.image_url} onClick={onOpenDetail} className="mt-4 rounded-[2rem] w-full max-h-80 object-cover border border-gray-100/10 cursor-pointer shadow-md hover:brightness-90 transition" />}
        <div className="flex gap-8 mt-5 text-gray-400 items-center">
          <button className="flex items-center gap-2 hover:text-red-500 transition-colors"><Heart size={20} /><span className="text-xs font-black">{post.like_count || ''}</span></button>
          <button onClick={onOpenDetail} className="flex items-center gap-2 hover:text-blue-500 transition-colors"><MessageSquare size={20} /><span className="text-xs font-black">{post.comment_count || ''}</span></button>
          <button className="hover:text-green-500 transition-colors"><Share2 size={18} /></button>
        </div>
      </div>
    </article>
  );
}

function PostDetailModal({ post, onClose, getAvatar, openProfile, onDelete, currentUser, darkMode, refreshPosts }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => {
    const fetchC = async () => {
      const { data } = await supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at', { ascending: true });
      if (data) setComments(data);
    };
    fetchC();
  }, [post.id]);

  const sendC = async (e) => {
    e.preventDefault(); if (!text.trim()) return;
    await supabase.from('comments').insert([{ post_id: post.id, user_id: currentUser.id, content: text }]);
    setText(''); refreshPosts();
    const { data } = await supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at', { ascending: true });
    setComments(data);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-[3rem] flex flex-col h-[90vh] overflow-hidden shadow-2xl border ${darkMode ? 'bg-black border-gray-800' : 'bg-white border-gray-100'}`}>
        <div className="p-6 border-b flex justify-between items-center bg-inherit">
          <button onClick={onClose} className="p-2 bg-gray-500/10 rounded-full"><X size={20}/></button>
          <span className="font-black text-[10px] uppercase tracking-[0.3em]">Thread</span>
          {currentUser.id === post.user_id ? <button onClick={() => onDelete(post.id)} className="text-red-500"><Trash2 size={20}/></button> : <div className="w-8" />}
        </div>
        <div className="flex-grow overflow-y-auto p-6">
           <div className="flex gap-4 mb-6">
             <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-12 h-12 rounded-full object-cover shadow-md" />
             <div><p className="font-black text-sm tracking-tight">{post.profiles?.display_name}</p><p className="text-xs text-gray-400 font-bold">@{post.profiles?.username}</p></div>
           </div>
           <p className="text-xl font-semibold leading-relaxed mb-6">{post.content}</p>
           {post.image_url && <img src={post.image_url} className="rounded-[2.5rem] w-full border border-gray-100/10 mb-8 shadow-lg" />}
           
           <div className="space-y-6 border-t border-gray-100/10 pt-8">
             {comments.map(c => (
               <div key={c.id} className="flex gap-4">
                 <img src={getAvatar(c.profiles?.username, c.profiles?.avatar_url)} className="w-9 h-9 rounded-full object-cover" />
                 <div className={`p-4 rounded-[1.5rem] flex-grow shadow-sm ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                   <p className="text-[10px] font-black mb-1 opacity-50 uppercase tracking-wider">@{c.profiles?.username}</p>
                   <p className="text-sm font-medium leading-relaxed">{c.content}</p>
                 </div>
               </div>
             ))}
           </div>
        </div>
        <form onSubmit={sendC} className="p-6 border-t flex gap-3 bg-inherit">
          <input className={`flex-grow p-5 rounded-[2rem] text-sm outline-none font-bold transition-all ${darkMode ? 'bg-gray-900 focus:bg-gray-800' : 'bg-gray-50 focus:bg-white focus:shadow-inner'}`} placeholder="Drop a reply..." value={text} onChange={e => setText(e.target.value)} />
          <button type="submit" className="bg-blue-600 text-white p-5 rounded-full shadow-xl active:scale-90 transition-transform"><Send size={20}/></button>
        </form>
      </div>
    </div>
  );
}

function SearchView({ posts, openProfile, searchQuery, setSearchQuery, setSelectedPost, darkMode }) {
  return (
    <div className="flex flex-col h-full">
      <div className={`p-4 sticky top-0 z-20 border-b backdrop-blur-md ${darkMode ? 'bg-black/80 border-gray-800' : 'bg-white/80 border-gray-100'}`}>
        <div className="relative flex items-center">
          <Search className="absolute left-4 text-gray-400" size={18} />
          <input type="text" placeholder="DISCOVER NEW STREAMS" className={`w-full rounded-[1.5rem] py-3 pl-12 pr-4 outline-none text-[10px] font-black uppercase tracking-widest transition-all ${darkMode ? 'bg-gray-900 focus:bg-gray-800' : 'bg-gray-100 focus:bg-white focus:shadow-md'}`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-0.5 overflow-y-auto">
        {posts.filter(p => p.image_url && (p.content.includes(searchQuery) || p.profiles?.username.includes(searchQuery))).map((post) => (
          <div key={post.id} className="relative group aspect-square cursor-pointer overflow-hidden" onClick={() => setSelectedPost(post)}>
            <img src={post.image_url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Heart className="text-white fill-white" size={24} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessagesList({ allProfiles, user, setDmTarget, getAvatar, openProfile, darkMode }) {
  return (
    <div className="flex flex-col">
      <header className="p-6 border-b font-black text-xl text-center uppercase italic tracking-tighter sticky top-0 z-10 bg-inherit shadow-sm">GridStream Chat</header>
      <div className="p-3 space-y-1">
        {allProfiles.filter(p => p.id !== user.id).map(u => (
          <div key={u.id} className="flex items-center gap-5 p-4 rounded-[2rem] cursor-pointer hover:bg-blue-600/5 transition-colors group" onClick={() => setDmTarget(u)}>
            <img src={getAvatar(u.username, u.avatar_url)} className="w-16 h-16 rounded-full object-cover shadow-xl group-hover:rotate-3 transition-transform" onClick={(e) => { e.stopPropagation(); openProfile(u.id); }} />
            <div className="flex-grow border-b border-gray-100/10 pb-4">
              <p className="font-black text-[15px]">{u.display_name}</p>
              <p className="text-[10px] text-blue-500 font-black mt-1 italic uppercase tracking-widest group-hover:translate-x-1 transition-transform">Start Streaming</p>
            </div>
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
    const fetchM = async () => {
      const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
      if (data) setMessages(data);
    };
    fetchM();
    const ch = supabase.channel(`chat:${target.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
      if ((p.new.sender_id === currentUser.id && p.new.receiver_id === target.id) || (p.new.sender_id === target.id && p.new.receiver_id === currentUser.id)) setMessages(prev => [...prev, p.new]);
    }).subscribe();
    return () => supabase.removeChannel(ch);
  }, [target]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (e) => {
    e.preventDefault(); if (!text.trim()) return;
    const t = text; setText('');
    await supabase.from('messages').insert([{ text: t, sender_id: currentUser.id, receiver_id: target.id }]);
  };

  return (
    <div className={`fixed inset-0 z-[120] flex flex-col transition-colors duration-300 ${darkMode ? 'bg-black' : 'bg-[#fcfcfc]'}`}>
      <header className={`p-4 flex items-center gap-4 border-b sticky top-0 z-10 backdrop-blur-md ${darkMode ? 'bg-black/80 border-gray-800' : 'bg-white/80 border-gray-50'}`}>
        <ChevronLeft onClick={() => setDmTarget(null)} className="cursor-pointer p-1 hover:bg-gray-500/10 rounded-full" />
        <img src={getAvatar(target.username, target.avatar_url)} className="w-10 h-10 rounded-full object-cover shadow-md" />
        <div><p className="font-black text-sm tracking-tight">{target.display_name}</p><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">@{target.username}</p></div>
      </header>
      <div className="flex-grow overflow-y-auto p-6 space-y-6">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] p-5 rounded-[2rem] text-sm font-medium shadow-sm ${m.sender_id === currentUser.id ? 'bg-blue-600 text-white rounded-tr-none' : (darkMode ? 'bg-gray-800 text-white rounded-tl-none border border-gray-700' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100')}`}>{m.text}</div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <form onSubmit={send} className="p-6 border-t flex gap-3 bg-inherit">
        <input className={`flex-grow p-5 rounded-[2rem] text-sm outline-none font-bold transition-all shadow-inner ${darkMode ? 'bg-gray-900' : 'bg-gray-100 focus:bg-white'}`} placeholder="Aa" value={text} onChange={e => setText(e.target.value)} />
        <button type="submit" className="bg-blue-600 text-white p-5 rounded-full shadow-2xl active:scale-90 transition-transform"><Send size={20}/></button>
      </form>
    </div>
  );
}

function FollowListModal({ type, userId, onClose, openProfile, getAvatar, darkMode }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    const fetchF = async () => {
      const source = type === 'followers' ? 'following_id' : 'follower_id';
      const target = type === 'followers' ? 'follower_id' : 'following_id';
      const { data: followData } = await supabase.from('follows').select(target).eq(source, userId);
      if (followData?.length > 0) {
        const ids = followData.map(f => f[target]);
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids);
        if (profiles) setList(profiles);
      }
    };
    fetchF();
  }, [type, userId]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end justify-center">
      <div className={`w-full max-w-md rounded-t-[3.5rem] max-h-[85vh] flex flex-col shadow-2xl border-t ${darkMode ? 'bg-black text-white border-gray-800' : 'bg-white border-gray-50'}`}>
        <div className="p-8 border-b border-gray-100/10 flex justify-between items-center">
          <h3 className="font-black uppercase tracking-[0.4em] text-xs">{type}</h3>
          <button onClick={onClose} className="p-2 bg-gray-500/10 rounded-full"><X size={20}/></button>
        </div>
        <div className="overflow-y-auto p-6 space-y-4">
          {list.length === 0 && <p className="text-center text-gray-400 py-10 font-bold uppercase text-[10px] tracking-widest">Nothing here yet.</p>}
          {list.map(u => (
            <div key={u.id} className="flex items-center gap-5 cursor-pointer p-4 rounded-3xl hover:bg-blue-600/5 transition-all" onClick={() => { onClose(); openProfile(u.id); }}>
              <img src={getAvatar(u.username, u.avatar_url)} className="w-14 h-14 rounded-full object-cover shadow-lg" />
              <div className="flex-grow"><p className="font-black text-[15px] tracking-tight">{u.display_name}</p><p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">@{u.username}</p></div>
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

  const handleAuth = async (e) => {
    e.preventDefault();
    if (isLogin) await supabase.auth.signInWithPassword({ email, password });
    else {
      const { data } = await supabase.auth.signUp({ email, password });
      if (data?.user) {
        const id = displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000);
        await supabase.from('profiles').upsert([{ id: data.user.id, username: id, display_name: displayName }]);
      }
    }
    fetchData();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-10 bg-white">
      <div className="w-24 h-24 bg-gradient-to-br from-blue-700 to-cyan-400 rounded-[2.5rem] flex items-center justify-center shadow-[0_20px_50px_rgba(29,78,216,0.3)] mb-8 rotate-12 animate-pulse"><Zap size={48} color="white" fill="white" /></div>
      <h1 className="text-4xl font-black mb-12 text-blue-700 italic tracking-tighter uppercase">GridStream</h1>
      <form onSubmit={handleAuth} className="w-full max-w-xs space-y-5">
        {!isLogin && <input type="text" placeholder="DISPLAY NAME" className="w-full bg-gray-50 p-5 rounded-3xl outline-none font-bold text-sm shadow-inner border border-gray-100" value={displayName} onChange={e => setDisplayName(e.target.value)} required />}
        <input type="email" placeholder="EMAIL" className="w-full bg-gray-50 p-5 rounded-3xl outline-none font-bold text-sm shadow-inner border border-gray-100" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="PASSWORD" className="w-full bg-gray-50 p-5 rounded-3xl outline-none font-bold text-sm shadow-inner border border-gray-100" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit" className="w-full bg-blue-700 text-white font-black py-6 rounded-[2rem] uppercase tracking-widest text-xs shadow-2xl active:scale-95 transition-transform">Get Started</button>
      </form>
      <button onClick={() => setIsLogin(!isLogin)} className="mt-10 text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] hover:text-blue-500 transition-colors">{isLogin ? "Join the Stream" : "Login to Stream"}</button>
    </div>
  );
                                                                                                                  }
