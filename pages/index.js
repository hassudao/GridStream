import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User as UserIcon, Grid, List, Image as ImageIcon, Send, ChevronLeft, Zap, LogOut, Settings, Trash2, MessageSquare, Save, UserCheck, AtSign, AlignLeft, Lock, Mail, Clock, Plus } from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = 'dtb3jpadj'; 
const CLOUDINARY_UPLOAD_PRESET = 'alpha-sns';

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('ja-JP', { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

export default function App() {
  const [view, setView] = useState('home'); 
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]); // ストーリー状態
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
  const [selectedStoryGroup, setSelectedStoryGroup] = useState(null); // ストーリー表示用
  const [uploading, setUploading] = useState(false);
  
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const headerInputRef = useRef(null);
  const storyInputRef = useRef(null);

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

  async function fetchStories() {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('stories')
      .select('*, profiles(id, username, display_name, avatar_url)')
      .gt('created_at', yesterday)
      .order('created_at', { ascending: true });

    if (data) {
      // ユーザーごとにグルーピング
      const grouped = data.reduce((acc, story) => {
        const userId = story.user_id;
        if (!acc[userId]) acc[userId] = { profile: story.profiles, items: [] };
        acc[userId].items.push(story);
        return acc;
      }, {});
      setStories(Object.values(grouped));
    }
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

  async function toggleLike(postId, isLiked) {
    if (!user) return;
    const updateLogic = (p) => {
      if (p.id === postId) {
        return { ...p, is_liked: !isLiked, like_count: isLiked ? Math.max(0, p.like_count - 1) : p.like_count + 1 };
      }
      return p;
    };
    setPosts(prev => prev.map(updateLogic));
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

  async function handleStoryUpload(e) {
    const file = e.target.files[0];
    if (!file || !user) return;
    setUploading(true);
    const imageUrl = await uploadToCloudinary(file);
    await supabase.from('stories').insert([{ user_id: user.id, image_url: imageUrl }]);
    fetchStories();
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

      {/* ストーリービューワーモーダル */}
      {selectedStoryGroup && (
        <StoryViewer group={selectedStoryGroup} onClose={() => setSelectedStoryGroup(null)} getAvatar={getAvatar} />
      )}

      {/* 他のモーダル */}
      {selectedPost && <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} getAvatar={getAvatar} openProfile={openProfile} onDelete={async (id) => { if(window.confirm("削除しますか？")){ await supabase.from('posts').delete().eq('id',id); setSelectedPost(null); fetchData(); } }} onLike={toggleLike} onShare={() => {}} currentUser={user} darkMode={darkMode} refreshPosts={fetchData} />}
      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} user={user} myProfile={myProfile} darkMode={darkMode} setDarkMode={setDarkMode} />}

      {/* ホーム画面 */}
      {view === 'home' && (
        <div className="animate-in fade-in">
          <header className={`sticky top-0 z-30 backdrop-blur-md border-b p-4 flex justify-between items-center ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-50'}`}>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-700 to-cyan-500 bg-clip-text text-transparent italic tracking-tighter uppercase flex items-center gap-1">
              <Zap size={24} className="text-blue-600 fill-blue-600" /> GridStream
            </h1>
            <MessageCircle size={24} className="cursor-pointer" onClick={() => setView('messages')} />
          </header>

          {/* ストーリーリスト */}
          <div className={`flex gap-4 p-4 overflow-x-auto no-scrollbar border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            <div className="flex flex-col items-center gap-1 min-w-[70px]">
              <div onClick={() => storyInputRef.current.click()} className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer relative">
                <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-14 h-14 rounded-full object-cover opacity-50" />
                <Plus className="absolute text-blue-600" size={24} />
                <input type="file" ref={storyInputRef} className="hidden" accept="image/*" onChange={handleStoryUpload} />
              </div>
              <span className="text-[10px] font-bold">Your Story</span>
            </div>
            {stories.map((group, i) => (
              <div key={i} onClick={() => setSelectedStoryGroup(group)} className="flex flex-col items-center gap-1 min-w-[70px] cursor-pointer">
                <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600">
                  <img src={getAvatar(group.profile.username, group.profile.avatar_url)} className={`w-full h-full rounded-full object-cover border-2 ${darkMode ? 'border-black' : 'border-white'}`} />
                </div>
                <span className="text-[10px] font-bold truncate w-16 text-center">{group.profile.display_name}</span>
              </div>
            ))}
          </div>

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
              <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onLike={toggleLike} onShare={() => {}} currentUser={user} darkMode={darkMode} onOpenDetail={() => setSelectedPost(post)} />
            ))}
          </div>
        </div>
      )}

      {/* プロフィール・検索・メッセージ等は前回のコードを維持 */}
      {view === 'profile' && profileInfo && <ProfileView profileInfo={profileInfo} user={user} activeProfileId={activeProfileId} isEditing={isEditing} setIsEditing={setIsEditing} editData={editData} setEditData={setEditData} handleUpdateProfile={handleUpdateProfile} uploading={uploading} darkMode={darkMode} stats={stats} posts={posts} openProfile={openProfile} getAvatar={getAvatar} toggleLike={toggleLike} setSelectedPost={setSelectedPost} setView={setView} setShowSettings={setShowSettings} setShowFollowList={setShowFollowList} />}
      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setSelectedPost={setSelectedPost} darkMode={darkMode} />}

      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 shadow-sm ${darkMode ? 'bg-black/95 border-gray-800 text-gray-600' : 'bg-white/95 border-gray-100 text-gray-300'}`}>
        <HomeIcon onClick={() => setView('home')} className={`cursor-pointer ${view === 'home' ? 'text-blue-600' : ''}`} />
        <Search onClick={() => setView('search')} className={`cursor-pointer ${view === 'search' ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
        <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer ${view === 'profile' && activeProfileId === user.id ? (darkMode ? 'text-white' : 'text-black') : ''}`} />
      </nav>
    </div>
  );
}

// --- ストーリービューワーコンポーネント ---
function StoryViewer({ group, onClose, getAvatar }) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const story = group.items[index];

  useEffect(() => {
    setProgress(0);
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (index < group.items.length - 1) {
            setIndex(index + 1);
            return 0;
          } else {
            onClose();
            return 100;
          }
        }
        return prev + 1;
      });
    }, 50); // 5秒で一周
    return () => clearInterval(timer);
  }, [index]);

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center animate-in fade-in duration-300">
      {/* プログレスバー */}
      <div className="absolute top-4 inset-x-4 flex gap-1 z-10">
        {group.items.map((_, i) => (
          <div key={i} className="h-1 flex-grow bg-gray-600 rounded-full overflow-hidden">
            <div className="h-full bg-white transition-all duration-100" style={{ width: i === index ? `${progress}%` : i < index ? '100%' : '0%' }} />
          </div>
        ))}
      </div>
      {/* ヘッダー */}
      <div className="absolute top-8 inset-x-4 flex justify-between items-center z-10 text-white">
        <div className="flex items-center gap-3">
          <img src={getAvatar(group.profile.username, group.profile.avatar_url)} className="w-8 h-8 rounded-full border border-white" />
          <span className="font-bold text-sm shadow-sm">{group.profile.display_name}</span>
          <span className="text-[10px] opacity-70">{formatTime(story.created_at)}</span>
        </div>
        <X onClick={onClose} className="cursor-pointer" />
      </div>
      {/* メイン画像 */}
      <img src={story.image_url} className="max-w-full max-h-full object-contain" />
      {/* 左右タップエリア */}
      <div className="absolute inset-0 flex">
        <div className="w-1/3 h-full" onClick={() => index > 0 && setIndex(index - 1)} />
        <div className="w-2/3 h-full" onClick={() => index < group.items.length - 1 ? setIndex(index + 1) : onClose()} />
      </div>
    </div>
  );
}

// --- 既存のコンポーネント（簡略化版を適宜統合） ---
function PostCard({ post, openProfile, getAvatar, onLike, currentUser, darkMode, onOpenDetail }) {
  return (
    <article className={`p-4 flex gap-3 transition border-b last:border-0 ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
      <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer object-cover" onClick={() => openProfile(post.profiles.id)} />
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-start mb-1">
          <div className="flex flex-col cursor-pointer max-w-[70%]" onClick={() => openProfile(post.profiles.id)}>
            <span className="font-black text-sm truncate">{post.profiles?.display_name}</span>
            <span className="text-gray-400 text-[11px] font-bold truncate">@{post.profiles?.username}</span>
          </div>
          <span className="text-[10px] text-gray-400 font-bold pt-1">{formatTime(post.created_at)}</span>
        </div>
        <p className="text-[15px] mt-1 font-medium leading-relaxed whitespace-pre-wrap">{post.content}</p>
        {post.image_url && <img src={post.image_url} onClick={onOpenDetail} className="mt-3 rounded-2xl w-full max-h-80 object-cover border border-gray-100/10 cursor-pointer hover:brightness-95 transition" />}
        <div className="flex gap-6 mt-4 text-gray-400 items-center">
          <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 transition ${post.is_liked ? 'text-red-500 scale-110' : 'hover:text-red-500'}`}><Heart size={18} fill={post.is_liked ? "currentColor" : "none"} /><span className="text-xs font-black">{post.like_count || ''}</span></button>
          <button onClick={onOpenDetail} className="flex items-center gap-1.5 hover:text-blue-500 transition"><MessageSquare size={18} /><span className="text-xs font-black">{post.comment_count || ''}</span></button>
        </div>
      </div>
    </article>
  );
}

function PostDetailModal({ post, onClose, getAvatar, openProfile, onDelete, onLike, currentUser, darkMode, refreshPosts }) {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  useEffect(() => { fetchComments(); }, [post.id]);
  async function fetchComments() {
    const { data } = await supabase.from('comments').select('*, profiles(id, username, display_name, avatar_url)').eq('post_id', post.id).order('created_at', { ascending: false });
    if (data) setComments(data);
  }
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-[2.5rem] flex flex-col h-[85vh] overflow-hidden shadow-2xl ${darkMode ? 'bg-black border border-gray-800' : 'bg-white text-black'}`}>
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-8 h-8 rounded-full object-cover" />
            <span className="font-black text-xs">@{post.profiles?.username}</span>
          </div>
          <button onClick={onClose}><X size={24}/></button>
        </div>
        <div className="flex-grow overflow-y-auto p-5">
           {post.image_url && <img src={post.image_url} className="w-full rounded-2xl mb-4" />}
           <p className="font-medium mb-4">{post.content}</p>
           <div className="space-y-4">
             {comments.map(c => (
               <div key={c.id} className="flex gap-3">
                 <img src={getAvatar(c.profiles?.username, c.profiles?.avatar_url)} className="w-8 h-8 rounded-full object-cover" />
                 <div className={`p-3 rounded-2xl flex-grow ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                   <p className="text-[10px] font-black">@{c.profiles?.username}</p>
                   <p className="text-sm">{c.content}</p>
                 </div>
               </div>
             ))}
           </div>
        </div>
        <form onSubmit={async (e)=>{
          e.preventDefault();
          if(!commentText.trim()) return;
          await supabase.from('comments').insert([{post_id:post.id, user_id:currentUser.id, content:commentText}]);
          setCommentText('');
          fetchComments();
          refreshPosts();
        }} className="p-4 border-t flex gap-2">
          <input type="text" className="flex-grow p-4 rounded-2xl bg-gray-50 outline-none" placeholder="Comment..." value={commentText} onChange={e=>setCommentText(e.target.value)} />
          <button type="submit" className="bg-blue-600 text-white p-4 rounded-2xl"><Send size={18}/></button>
        </form>
      </div>
    </div>
  );
}

// プロフィール表示用サブコンポーネント
function ProfileView({ profileInfo, user, activeProfileId, isEditing, setIsEditing, editData, setEditData, handleUpdateProfile, uploading, darkMode, stats, posts, openProfile, getAvatar, toggleLike, setSelectedPost, setView, setShowSettings, setShowFollowList }) {
  return (
    <div className="animate-in fade-in pb-10">
      {isEditing ? (
        <div className="space-y-6">
          <header className="p-4 flex justify-between items-center sticky top-0 z-10 bg-inherit/90 backdrop-blur-md border-b">
            <button onClick={() => setIsEditing(false)}><X size={24}/></button>
            <h2 className="font-black uppercase tracking-widest">Edit Profile</h2>
            <button onClick={handleUpdateProfile} disabled={uploading} className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-black uppercase">{uploading ? '...' : 'Save'}</button>
          </header>
          <div className="px-4 space-y-4">
            <div className={`p-4 rounded-2xl ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
              <label className="text-[10px] font-black text-gray-400 uppercase">Display Name</label>
              <input className="w-full bg-transparent outline-none font-bold" value={editData.display_name} onChange={e => setEditData({...editData, display_name: e.target.value})} />
            </div>
            <div className={`p-4 rounded-2xl ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
              <label className="text-[10px] font-black text-gray-400 uppercase">Bio</label>
              <textarea className="w-full bg-transparent outline-none font-bold h-24" value={editData.bio} onChange={e => setEditData({...editData, bio: e.target.value})} />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="relative h-44 bg-gray-200">
            <img src={profileInfo.header_url || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&q=80'} className="w-full h-full object-cover" />
            <div className="absolute top-4 inset-x-4 flex justify-between">
              <button onClick={() => setView('home')} className="bg-black/30 backdrop-blur-md p-2 rounded-full text-white"><ChevronLeft size={20}/></button>
              <button onClick={() => setShowSettings(true)} className="bg-black/30 backdrop-blur-md p-2 rounded-full text-white"><Settings size={20}/></button>
            </div>
          </div>
          <div className="px-4 relative">
            <div className="flex justify-between items-end -mt-12 mb-4">
              <img src={getAvatar(profileInfo.username, profileInfo.avatar_url)} className={`w-24 h-24 rounded-full border-4 shadow-xl object-cover ${darkMode ? 'border-black bg-black' : 'border-white bg-white'}`} />
              {user.id === activeProfileId && <button onClick={() => setIsEditing(true)} className="border rounded-full px-5 py-1.5 text-xs font-black uppercase">Edit</button>}
            </div>
            <h2 className="text-2xl font-black">{profileInfo.display_name}</h2>
            <p className="text-gray-400 text-sm">@{profileInfo.username}</p>
            <p className="mt-3 text-[15px] font-medium">{profileInfo.bio}</p>
            <div className="flex gap-4 mt-4">
              <button className="text-sm"><span className="font-black">{stats.following}</span> Following</button>
              <button className="text-sm"><span className="font-black">{stats.followers}</span> Followers</button>
            </div>
          </div>
          <div className="divide-y mt-8 border-t">
            {posts.filter(p => p.user_id === activeProfileId).map(post => (
              <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onLike={toggleLike} currentUser={user} darkMode={darkMode} onOpenDetail={() => setSelectedPost(post)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SearchView({ posts, openProfile, searchQuery, setSearchQuery, setSelectedPost, darkMode }) {
  return (
    <div className="animate-in fade-in">
      <div className="p-4 border-b">
        <input type="text" placeholder="DISCOVER" className="w-full rounded-xl py-2 px-4 bg-gray-100 outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-[2px]">
        {posts.filter(p => p.image_url && p.content.includes(searchQuery)).map((post) => (
          <img key={post.id} src={post.image_url} className="aspect-square w-full object-cover cursor-pointer" onClick={() => setSelectedPost(post)} />
        ))}
      </div>
    </div>
  );
}

function SettingsScreen({ onClose, user, myProfile, darkMode, setDarkMode }) {
  const [newEmail, setNewEmail] = useState(user.email);
  const [newPassword, setNewPassword] = useState('');
  const [updating, setUpdating] = useState(false);
  const handleUpdateAuth = async () => {
    setUpdating(true);
    const updates = {};
    if (newEmail !== user.email) updates.email = newEmail;
    if (newPassword) updates.password = newPassword;
    const { error } = await supabase.auth.updateUser(updates);
    if (error) alert(error.message); else alert('Updated!');
    setUpdating(false);
  };
  return (
    <div className={`fixed inset-0 z-[110] p-6 ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <header className="flex items-center gap-4 mb-8">
        <ChevronLeft onClick={onClose} className="cursor-pointer" />
        <h2 className="font-black uppercase">Settings</h2>
      </header>
      <div className="space-y-6">
        <div className={`p-4 rounded-2xl ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
          <label className="text-[10px] font-black text-gray-400 block mb-2">Email</label>
          <input className="w-full bg-transparent outline-none font-bold" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
        </div>
        <div className={`p-4 rounded-2xl ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
          <label className="text-[10px] font-black text-gray-400 block mb-2">New Password</label>
          <input type="password" placeholder="********" className="w-full bg-transparent outline-none font-bold" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
        </div>
        <button onClick={handleUpdateAuth} disabled={updating} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs">{updating ? '...' : 'Save Changes'}</button>
        <button onClick={() => setDarkMode(!darkMode)} className="w-full py-4 text-xs font-black uppercase border border-gray-200 rounded-2xl">Toggle Dark Mode</button>
        <button onClick={() => supabase.auth.signOut()} className="w-full py-4 text-xs font-black uppercase text-red-500">Logout</button>
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
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-white text-black">
      <div className="w-20 h-20 bg-gradient-to-tr from-blue-700 to-cyan-500 rounded-[2rem] flex items-center justify-center shadow-2xl mb-6 rotate-6 animate-pulse"><Zap size={40} color="white" fill="white" /></div>
      <h1 className="text-4xl font-black mb-10 text-blue-700 italic uppercase italic">GridStream</h1>
      <form onSubmit={handleAuth} className="w-full max-w-xs space-y-4">
        {!isLogin && <input type="text" placeholder="DISPLAY NAME" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />}
        <input type="email" placeholder="EMAIL" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="PASSWORD" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="w-full bg-blue-700 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs">{isLogin ? 'Login' : 'Sign Up'}</button>
      </form>
      <button onClick={() => setIsLogin(!isLogin)} className="mt-8 text-xs font-black text-gray-400 uppercase tracking-widest">{isLogin ? "Create Account" : "Login"}</button>
    </div>
  );
                               }
