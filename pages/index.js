import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User as UserIcon, Grid, List, Image as ImageIcon, Send, ChevronLeft, MapPin, Calendar, Check, AtSign, Zap, LogOut, Mail, Lock, MoreHorizontal, Settings, Save, Moon, Sun, AlertCircle, Trash2, MessageSquare, Plus } from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = 'dtb3jpadj'; 
const CLOUDINARY_UPLOAD_PRESET = 'alpha-sns';

export default function App() {
  const [view, setView] = useState('home'); 
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  
  const [activeProfileId, setActiveProfileId] = useState(null); 
  const [profileInfo, setProfileInfo] = useState(null); 
  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeStory, setActiveStory] = useState(null);

  const [editData, setEditData] = useState({ display_name: '', username: '', bio: '', avatar_url: '', header_url: '' });
  const [myProfile, setMyProfile] = useState({ username: '', display_name: '', bio: '', avatar_url: '', header_url: '' });

  const [newPost, setNewPost] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const fileInputRef = useRef(null);
  const storyInputRef = useRef(null);
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
    fetchStories();
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
    }
    const { data: profData } = await supabase.from('profiles').select('*');
    if (profData) setAllProfiles(profData);
  }

  async function fetchStories() {
    // 簡易的に全ストーリー取得（本来は24時間以内などでフィルタ）
    const { data } = await supabase.from('stories').select('*, profiles(username, avatar_url)').order('created_at', { ascending: false });
    if (data) setStories(data);
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

  async function handleStoryUpload(e) {
    const file = e.target.files[0];
    if (!file || !user) return;
    setUploading(true);
    const imageUrl = await uploadToCloudinary(file);
    await supabase.from('stories').insert([{ user_id: user.id, image_url: imageUrl }]);
    fetchStories();
    setUploading(false);
  }

  const handleShare = async (post) => {
    try {
      if (navigator.share) await navigator.share({ title: 'GridStream', text: post.content, url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); alert('Copied!'); }
    } catch (err) { console.log(err); }
  };

  const openProfile = async (userId) => {
    setActiveProfileId(userId);
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfileInfo(profile);
    setView('profile');
    setIsEditing(false);
  };

  const getAvatar = (name, url) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;

  if (!user) return <AuthScreen fetchData={fetchData} />;

  return (
    <div className={`max-w-md mx-auto min-h-screen pb-20 border-x font-sans relative shadow-2xl transition-colors duration-300 ${darkMode ? 'bg-black text-white border-gray-800' : 'bg-white text-black border-gray-100'}`}>
      <script src="https://cdn.tailwindcss.com"></script>

      {/* ストーリー閲覧モーダル */}
      {activeStory && <StoryViewer story={activeStory} onClose={() => setActiveStory(null)} getAvatar={getAvatar} />}
      
      {/* 投稿詳細モーダル */}
      {selectedPost && <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} getAvatar={getAvatar} openProfile={openProfile} onShare={handleShare} currentUser={user} darkMode={darkMode} refreshPosts={fetchData} />}
      
      {/* 設定画面 */}
      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} user={user} darkMode={darkMode} setDarkMode={setDarkMode} />}

      {view === 'home' && (
        <div className="animate-in fade-in">
          <header className={`sticky top-0 z-30 backdrop-blur-md border-b p-4 flex justify-between items-center ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-50'}`}>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-cyan-500 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1">
              <Zap size={24} className="text-blue-600 fill-blue-600" /> GridStream
            </h1>
            <div className="flex gap-4">
              <button onClick={() => storyInputRef.current.click()} className="text-blue-500"><Plus size={24}/></button>
              <input type="file" ref={storyInputRef} hidden accept="image/*" onChange={handleStoryUpload} />
              <MessageCircle size={24} className="cursor-pointer" onClick={() => setView('messages')} />
            </div>
          </header>

          {/* ストーリーバー */}
          <div className={`flex gap-4 p-4 overflow-x-auto no-scrollbar border-b ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
             <div className="flex flex-col items-center gap-1 flex-shrink-0" onClick={() => storyInputRef.current.click()}>
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                   <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-14 h-14 rounded-full grayscale opacity-50" />
                   <Plus size={20} className="absolute text-blue-500 bg-white rounded-full border" />
                </div>
                <span className="text-[10px] font-bold">Your Story</span>
             </div>
             {stories.map(s => (
               <div key={s.id} className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer" onClick={() => setActiveStory(s)}>
                  <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600">
                    <img src={getAvatar(s.profiles?.username, s.profiles?.avatar_url)} className={`w-full h-full rounded-full border-2 object-cover ${darkMode ? 'border-black' : 'border-white'}`} />
                  </div>
                  <span className="text-[10px] font-bold truncate w-16 text-center">@{s.profiles?.username}</span>
               </div>
             ))}
          </div>

          <form onSubmit={handlePost} className={`p-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            <div className="flex gap-3">
              <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-10 h-10 rounded-full object-cover shadow-sm cursor-pointer" onClick={() => openProfile(user.id)} />
              <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none bg-transparent font-medium" placeholder="What's happening?" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-12 mt-2">
              <label className="cursor-pointer text-blue-500 hover:bg-blue-50/10 p-2 rounded-full transition"><ImageIcon size={22}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
              <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs shadow-lg uppercase tracking-tighter">{uploading ? '...' : 'Stream'}</button>
            </div>
          </form>

          <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
            {posts.map(post => <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onShare={handleShare} currentUser={user} darkMode={darkMode} onOpenDetail={() => setSelectedPost(post)} />)}
          </div>
        </div>
      )}

      {view === 'profile' && profileInfo && (
        <div className="animate-in fade-in pb-10">
          <div className={`h-36 relative overflow-hidden bg-gray-200 ${!profileInfo.header_url && 'bg-gradient-to-br from-blue-700 via-indigo-600 to-cyan-500'}`}>
            <img src={profileInfo.header_url} className="w-full h-full object-cover" />
            <button onClick={() => setView('home')} className="absolute top-4 left-4 bg-black/30 backdrop-blur-md p-2 rounded-full text-white"><ChevronLeft size={20}/></button>
            {user.id === activeProfileId && (
              <button onClick={() => setShowSettings(true)} className="absolute top-4 right-4 bg-black/30 backdrop-blur-md p-2 rounded-full text-white"><Settings size={20}/></button>
            )}
          </div>
          <div className="px-4 relative mb-6">
            <div className="absolute -top-10 left-4">
              <img src={getAvatar(profileInfo.username, profileInfo.avatar_url)} className={`w-24 h-24 rounded-full border-4 shadow-xl object-cover ${darkMode ? 'border-black bg-black' : 'border-white bg-white'}`} />
            </div>
            <div className="flex justify-end py-3 h-14">
              {user.id === activeProfileId && (
                <button onClick={() => setIsEditing(true)} className={`border rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-tighter ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>Edit Profile</button>
              )}
            </div>
            <div className="mt-2">
              <h2 className="text-2xl font-black tracking-tighter">{profileInfo.display_name}</h2>
              <p className="text-gray-400 text-sm font-bold">@{profileInfo.username}</p>
              <p className="mt-3 text-[15px] font-medium leading-relaxed">{profileInfo.bio || 'GridStream member.'}</p>
            </div>
          </div>
          <div className={`divide-y border-t ${darkMode ? 'divide-gray-800 border-gray-800' : 'divide-gray-100 border-gray-100'}`}>
            {posts.filter(p => p.user_id === activeProfileId).map(post => <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onShare={handleShare} currentUser={user} darkMode={darkMode} onOpenDetail={() => setSelectedPost(post)} />)}
          </div>
        </div>
      )}

      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSelectedPost={setSelectedPost} darkMode={darkMode} />}
      {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} getAvatar={getAvatar} openProfile={openProfile} darkMode={darkMode} />}

      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 shadow-sm ${darkMode ? 'bg-black/95 border-gray-800 text-gray-600' : 'bg-white/95 border-gray-100 text-gray-300'}`}>
        <HomeIcon onClick={() => setView('home')} className={`cursor-pointer ${view === 'home' ? 'text-blue-600' : ''}`} />
        <Search onClick={() => setView('search')} className={`cursor-pointer ${view === 'search' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer ${view === 'profile' && activeProfileId === user.id ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
      </nav>
    </div>
  );
}

// --- サブコンポーネント ---

function StoryViewer({ story, onClose, getAvatar }) {
  useEffect(() => { const timer = setTimeout(onClose, 5000); return () => clearTimeout(timer); }, []);
  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center">
      <div className="absolute top-0 left-0 w-full p-4 z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={getAvatar(story.profiles?.username, story.profiles?.avatar_url)} className="w-8 h-8 rounded-full border border-white" />
          <span className="text-white text-xs font-bold">@{story.profiles?.username}</span>
        </div>
        <button onClick={onClose} className="text-white"><X size={30}/></button>
      </div>
      <div className="w-full h-1 bg-gray-700 absolute top-0 left-0 z-20">
        <div className="h-full bg-white animate-[story-progress_5s_linear]" />
      </div>
      <img src={story.image_url} className="max-w-full max-h-full object-contain" />
      <style>{`@keyframes story-progress { from { width: 0%; } to { width: 100%; } }`}</style>
    </div>
  );
}

function PostCard({ post, openProfile, getAvatar, onShare, currentUser, darkMode, onOpenDetail }) {
  return (
    <article className={`p-4 flex gap-3 transition border-b last:border-0 ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
      <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer object-cover" onClick={() => openProfile(post.profiles.id)} />
      <div className="flex-grow min-w-0">
        <div className="flex flex-col cursor-pointer mb-1" onClick={() => openProfile(post.profiles.id)}>
          <span className="font-black text-sm truncate">{post.profiles?.display_name}</span>
          <span className="text-gray-400 text-[11px] font-bold truncate">@{post.profiles?.username}</span>
        </div>
        <p className="text-[15px] mt-1 font-medium leading-relaxed whitespace-pre-wrap">{post.content}</p>
        {post.image_url && <img src={post.image_url} onClick={onOpenDetail} className="mt-3 rounded-2xl w-full max-h-80 object-cover border border-gray-100 cursor-pointer" />}
        <div className="flex justify-between mt-4 text-gray-400 max-w-[200px]">
          <button className="flex items-center gap-1.5"><Heart size={18} /><span className="text-xs font-black">{post.like_count || ''}</span></button>
          <button onClick={onOpenDetail} className="flex items-center gap-1.5"><MessageSquare size={18} /><span className="text-xs font-black">{post.comment_count || ''}</span></button>
          <button onClick={() => onShare(post)}><Share2 size={18} /></button>
        </div>
      </div>
    </article>
  );
}

function PostDetailModal({ post, onClose, getAvatar, darkMode, currentUser, refreshPosts }) {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  useEffect(() => { fetchComments(); }, [post.id]);
  async function fetchComments() {
    const { data } = await supabase.from('comments').select('*, profiles(username, avatar_url)').eq('post_id', post.id).order('created_at', { ascending: true });
    if (data) setComments(data);
  }
  async function handleSend(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    await supabase.from('comments').insert([{ post_id: post.id, user_id: currentUser.id, content: commentText }]);
    setCommentText(''); fetchComments(); refreshPosts();
  }
  async function delComment(id) {
    if (!confirm('Delete?')) return;
    await supabase.from('comments').delete().eq('id', id);
    fetchComments(); refreshPosts();
  }
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-[2.5rem] flex flex-col h-[80vh] overflow-hidden ${darkMode ? 'bg-black border border-gray-800' : 'bg-white'}`}>
        <div className="p-4 border-b flex justify-between items-center">
          <span className="font-black text-xs uppercase tracking-widest">Comments</span>
          <X onClick={onClose} className="cursor-pointer" />
        </div>
        <div className="flex-grow overflow-y-auto p-4 space-y-4">
          {comments.map(c => (
            <div key={c.id} className="flex gap-3">
              <img src={getAvatar(c.profiles?.username, c.profiles?.avatar_url)} className="w-8 h-8 rounded-full object-cover" />
              <div className={`flex-grow p-3 rounded-2xl relative ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
                <div className="flex justify-between">
                  <span className="font-black text-[10px]">@{c.profiles?.username}</span>
                  {currentUser.id === c.user_id && <Trash2 size={12} className="text-red-500" onClick={() => delComment(c.id)} />}
                </div>
                <p className="text-sm">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
          <input type="text" className={`flex-grow p-3 rounded-xl text-sm outline-none ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`} placeholder="Add a comment..." value={commentText} onChange={(e) => setCommentText(e.target.value)} />
          <button type="submit" className="bg-blue-600 text-white p-3 rounded-xl"><Send size={18}/></button>
        </form>
      </div>
    </div>
  );
}

function SearchView({ posts, searchQuery, setSearchQuery, setSelectedPost, darkMode }) {
  return (
    <div className="animate-in fade-in">
      <div className={`p-4 sticky top-0 z-10 border-b ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-100'}`}>
        <div className="relative"><Search className="absolute left-3 top-3 text-gray-400" size={18} /><input type="text" placeholder="EXPLORE" className={`w-full rounded-xl py-2 pl-10 pr-4 outline-none text-xs font-black uppercase ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100'}`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-3 gap-1 p-1">
        {posts.filter(p => p.image_url).map(post => (
          <img key={post.id} src={post.image_url} className="aspect-square w-full object-cover cursor-pointer" onClick={() => setSelectedPost(post)} />
        ))}
      </div>
    </div>
  );
}

function MessagesList({ allProfiles, user, getAvatar, openProfile, darkMode }) {
  return (
    <div className="animate-in fade-in">
      <header className="p-4 border-b font-black text-center uppercase italic">Messages</header>
      <div className="p-2">
        {allProfiles.filter(p => p.id !== user.id).map(u => (
          <div key={u.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50/10 cursor-pointer" onClick={() => alert('DM implementation in progress...')}>
            <img src={getAvatar(u.username, u.avatar_url)} className="w-12 h-12 rounded-full object-cover" />
            <div><p className="font-bold text-sm">{u.display_name}</p><p className="text-xs text-blue-500 uppercase">Tap to chat</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsScreen({ onClose, darkMode, setDarkMode }) {
  return (
    <div className={`fixed inset-0 z-[150] ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <header className="p-4 border-b flex items-center gap-4">
        <ChevronLeft onClick={onClose} className="cursor-pointer" /><h2 className="font-black uppercase">Settings</h2>
      </header>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center p-4 rounded-2xl bg-gray-50/10">
          <span className="font-bold">Dark Mode</span>
          <button onClick={() => setDarkMode(!darkMode)} className={`w-12 h-6 rounded-full relative ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}>
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${darkMode ? 'right-1' : 'left-1'}`} />
          </button>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="w-full p-4 rounded-2xl bg-red-50 text-red-500 font-black uppercase text-xs">Logout</button>
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
    if (isLogin) { await supabase.auth.signInWithPassword({ email, password }); }
    else {
      const { data } = await supabase.auth.signUp({ email, password });
      if (data?.user) {
        const id = displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000);
        await supabase.from('profiles').upsert([{ id: data.user.id, username: id, display_name: displayName }]);
      }
    }
    fetchData();
  }
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-white text-black">
      <script src="https://cdn.tailwindcss.com"></script>
      <div className="w-20 h-20 bg-blue-700 rounded-[2rem] flex items-center justify-center shadow-2xl mb-6 rotate-6"><Zap size={40} color="white" fill="white" /></div>
      <h1 className="text-4xl font-black mb-10 text-blue-700 italic uppercase">GridStream</h1>
      <form onSubmit={handleAuth} className="w-full max-w-xs space-y-4">
        {!isLogin && <input type="text" placeholder="DISPLAY NAME" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />}
        <input type="email" placeholder="EMAIL" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="PASSWORD" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="w-full bg-blue-700 text-white font-black py-5 rounded-2xl uppercase text-xs">{isLogin ? 'Login' : 'Join'}</button>
      </form>
      <button onClick={() => setIsLogin(!isLogin)} className="mt-8 text-xs font-black text-gray-400 uppercase">{isLogin ? "Create Account" : "Back to Login"}</button>
    </div>
  );
        }
