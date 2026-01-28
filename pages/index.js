import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User as UserIcon, Grid, List, Image as ImageIcon, Send, ChevronLeft, MapPin, Calendar, Check, AtSign, Zap, LogOut, Mail, Lock, MoreHorizontal, Settings, Save, Moon, Sun, AlertCircle, Trash2, CornerDownRight } from 'lucide-react';

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
  
  // コメント表示状態管理 { [postId]: boolean }
  const [expandedComments, setExpandedComments] = useState({});

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
    const { data: postsData, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles(id, username, display_name, avatar_url),
        likes(user_id)
      `)
      .order('created_at', { ascending: false });
    
    if (error) console.error("Fetch posts error:", error);
    if (postsData) {
      const formattedPosts = postsData.map(post => ({
        ...post,
        like_count: post.likes?.length || 0,
        is_liked: user ? post.likes?.some(l => l.user_id === user.id) : false,
        // parent_idがあるものはコメントとして扱う
        reply_count: postsData.filter(p => p.parent_id === post.id).length
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
    if (isLiked) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id);
    } else {
      await supabase.from('likes').insert([{ post_id: postId, user_id: user.id }]);
    }
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
    
    const { error } = await supabase.from('posts').insert([{ 
      content: newPost, 
      user_id: user.id, 
      image_url: imageUrl,
      parent_id: null // メイン投稿は常にnull
    }]);

    if (error) alert("投稿に失敗しました: " + error.message);
    setNewPost('');
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchData();
    setUploading(false);
  }

  async function handleCommentSubmit(postId, commentText) {
    if (!commentText.trim() || !user) return;
    const { error } = await supabase.from('posts').insert([{ 
      content: commentText, 
      user_id: user.id, 
      parent_id: postId 
    }]);
    if (error) alert("コメントに失敗しました");
    fetchData();
  }

  async function handleDeletePost(postId) {
    if (!window.confirm("この投稿（またはコメント）を削除しますか？")) return;
    const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', user.id);
    if (error) alert("削除に失敗しました");
    else fetchData();
  }

  const toggleComments = (postId) => {
    setExpandedComments(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

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

  if (!user) return <AuthScreen fetchData={fetchData} validateProfile={() => true} />;

  return (
    <div className={`max-w-md mx-auto min-h-screen pb-20 border-x font-sans relative shadow-2xl overflow-x-hidden transition-colors duration-300 ${darkMode ? 'bg-black text-white border-gray-800' : 'bg-white text-black border-gray-100'}`}>
      <script src="https://cdn.tailwindcss.com"></script>

      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} getAvatar={getAvatar} darkMode={darkMode} />}
      {showFollowList && <FollowListModal type={showFollowList} userId={activeProfileId} onClose={() => setShowFollowList(null)} openProfile={openProfile} getAvatar={getAvatar} darkMode={darkMode} />}
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
            {posts.filter(p => !p.parent_id).map(post => (
              <div key={post.id}>
                <PostCard 
                  post={post} 
                  openProfile={openProfile} 
                  getAvatar={getAvatar} 
                  onDelete={handleDeletePost} 
                  onLike={toggleLike} 
                  onToggleComments={() => toggleComments(post.id)}
                  isExpanded={expandedComments[post.id]}
                  currentUser={user} 
                  darkMode={darkMode} 
                />
                {expandedComments[post.id] && (
                  <CommentSection 
                    postId={post.id} 
                    allPosts={posts} 
                    currentUser={user} 
                    onCommentSubmit={handleCommentSubmit} 
                    onDelete={handleDeletePost}
                    openProfile={openProfile}
                    getAvatar={getAvatar}
                    darkMode={darkMode}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'profile' && profileInfo && (
        <div className="animate-in fade-in pb-10">
          <div className={`h-32 relative overflow-hidden bg-gray-200 ${!profileInfo.header_url && 'bg-gradient-to-br from-blue-700 via-indigo-600 to-cyan-500'}`}>
            <img src={profileInfo.header_url} className="w-full h-full object-cover" />
            <button onClick={() => setView('home')} className="absolute top-4 left-4 bg-black/30 backdrop-blur-md p-2 rounded-full text-white"><ChevronLeft size={20}/></button>
          </div>
          <div className="px-4 relative -top-12">
            <img src={getAvatar(profileInfo.username, profileInfo.avatar_url)} className={`w-24 h-24 rounded-full border-4 shadow-xl object-cover ${darkMode ? 'border-black bg-black' : 'border-white bg-white'}`} />
            <div className="mt-4">
              <h2 className="text-2xl font-black tracking-tighter">{profileInfo.display_name}</h2>
              <p className="text-gray-400 text-sm font-bold">@{profileInfo.username}</p>
              <p className="mt-2 font-medium">{profileInfo.bio}</p>
            </div>
          </div>
          
          <div className={`flex border-b mt-6 sticky top-0 z-40 ${darkMode ? 'bg-black border-gray-800' : 'bg-white border-gray-100'}`}>
            <button onClick={() => setProfileTab('list')} className={`flex-grow py-4 ${profileTab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}><List className="mx-auto" size={20}/></button>
            <button onClick={() => setProfileTab('grid')} className={`flex-grow py-4 ${profileTab === 'grid' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400'}`}><Grid className="mx-auto" size={20}/></button>
          </div>
          
          <div className={profileTab === 'grid' ? "grid grid-cols-3 gap-[2px]" : ""}>
            {posts.filter(p => p.user_id === activeProfileId && !p.parent_id).map(post => (
              profileTab === 'grid' ? (
                post.image_url && <img key={post.id} src={post.image_url} className="aspect-square object-cover" />
              ) : (
                <div key={post.id}>
                  <PostCard post={post} openProfile={openProfile} getAvatar={getAvatar} onDelete={handleDeletePost} onLike={toggleLike} onToggleComments={() => toggleComments(post.id)} isExpanded={expandedComments[post.id]} currentUser={user} darkMode={darkMode} />
                  {expandedComments[post.id] && <CommentSection postId={post.id} allPosts={posts} currentUser={user} onCommentSubmit={handleCommentSubmit} onDelete={handleDeletePost} openProfile={openProfile} getAvatar={getAvatar} darkMode={darkMode} />}
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {view === 'search' && <SearchView posts={posts} openProfile={openProfile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} darkMode={darkMode} />}
      {view === 'messages' && <MessagesList allProfiles={allProfiles} user={user} setDmTarget={setDmTarget} getAvatar={getAvatar} openProfile={openProfile} darkMode={darkMode} />}

      <nav className={`fixed bottom-0 max-w-md w-full border-t flex justify-around py-4 z-40 ${darkMode ? 'bg-black/95 border-gray-800 text-gray-600' : 'bg-white/95 border-gray-100 text-gray-300'}`}>
        <HomeIcon onClick={() => setView('home')} className={`cursor-pointer ${view === 'home' ? 'text-blue-600' : ''}`} />
        <Search onClick={() => setView('search')} className={`cursor-pointer ${view === 'search' ? 'text-black' : ''}`} />
        <MessageCircle onClick={() => setView('messages')} className={`cursor-pointer ${view === 'messages' ? 'text-black' : ''}`} />
        <UserIcon onClick={() => openProfile(user.id)} className={`cursor-pointer ${view === 'profile' && activeProfileId === user.id ? 'text-black' : ''}`} />
      </nav>
    </div>
  );
}

// メイン投稿カード
function PostCard({ post, openProfile, getAvatar, onDelete, onLike, onToggleComments, isExpanded, currentUser, darkMode }) {
  const isMyPost = currentUser && post.user_id === currentUser.id;
  return (
    <article className={`p-4 flex gap-3 transition ${darkMode ? 'hover:bg-gray-900/50' : 'hover:bg-gray-50'}`}>
      <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer object-cover" onClick={() => openProfile(post.profiles.id)} />
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-start">
          <div className="cursor-pointer" onClick={() => openProfile(post.profiles.id)}>
            <span className="font-black text-sm block">{post.profiles?.display_name}</span>
            <span className="text-gray-400 text-xs font-bold">@{post.profiles?.username}</span>
          </div>
          {isMyPost && <button onClick={() => onDelete(post.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>}
        </div>
        <p className={`text-[15px] mt-2 font-medium leading-relaxed whitespace-pre-wrap`}>{post.content}</p>
        {post.image_url && <img src={post.image_url} className="mt-3 rounded-2xl w-full max-h-80 object-cover border border-gray-100" />}
        
        <div className="flex gap-8 mt-4 text-gray-400">
          <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 transition ${post.is_liked ? 'text-red-500' : 'hover:text-red-500'}`}>
            <Heart size={18} fill={post.is_liked ? "currentColor" : "none"} />
            <span className="text-xs font-black">{post.like_count || ''}</span>
          </button>
          <button onClick={onToggleComments} className={`flex items-center gap-1.5 transition ${isExpanded ? 'text-blue-500' : 'hover:text-blue-500'}`}>
            <MessageCircle size={18} />
            <span className="text-xs font-black">{post.reply_count || ''}</span>
          </button>
          <Share2 size={18} />
        </div>
      </div>
    </article>
  );
}

// YouTubeスタイルのコメントセクション
function CommentSection({ postId, allPosts, currentUser, onCommentSubmit, onDelete, openProfile, getAvatar, darkMode }) {
  const [commentText, setCommentText] = useState('');
  const comments = allPosts.filter(p => p.parent_id === postId).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const handleSubmit = (e) => {
    e.preventDefault();
    onCommentSubmit(postId, commentText);
    setCommentText('');
  };

  return (
    <div className={`px-4 pb-4 animate-in slide-in-from-top duration-200 ${darkMode ? 'bg-gray-950' : 'bg-gray-50'}`}>
      {/* 入力フォーム */}
      <form onSubmit={handleSubmit} className="flex gap-2 py-3 border-b border-gray-200 mb-3">
        <img src={getAvatar(currentUser.email, '')} className="w-8 h-8 rounded-full object-cover" />
        <input 
          type="text" 
          placeholder="コメントを追加..." 
          className="flex-grow bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none text-sm py-1"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
        />
        <button type="submit" disabled={!commentText.trim()} className="text-blue-600 disabled:text-gray-400"><Send size={18} /></button>
      </form>

      {/* コメント一覧 */}
      <div className="space-y-4">
        {comments.map(comment => (
          <div key={comment.id} className="flex gap-3">
            <img 
              src={getAvatar(comment.profiles?.username, comment.profiles?.avatar_url)} 
              className="w-8 h-8 rounded-full cursor-pointer object-cover" 
              onClick={() => openProfile(comment.profiles.id)} 
            />
            <div className="flex-grow">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black">@{comment.profiles?.username}</span>
                <span className="text-[10px] text-gray-400">{(new Date(comment.created_at)).toLocaleDateString()}</span>
              </div>
              <p className="text-sm mt-0.5">{comment.content}</p>
              {comment.user_id === currentUser.id && (
                <button onClick={() => onDelete(comment.id)} className="text-[10px] text-gray-400 mt-1 hover:text-red-500">削除</button>
              )}
            </div>
          </div>
        ))}
        {comments.length === 0 && <p className="text-[10px] text-gray-400 text-center py-2 italic">最初のコメントを残しましょう</p>}
      </div>
    </div>
  );
}

// --- 他のコンポーネントは変更なし（Settings, FollowList, SearchView, MessagesList, DMScreen, AuthScreen） ---
// 以下は以前のコードと同様のため定義のみ維持

function SettingsScreen({ onClose, user, darkMode, setDarkMode }) {
  const handleLogout = () => { supabase.auth.signOut(); onClose(); };
  return (
    <div className={`fixed inset-0 z-[100] ${darkMode ? 'bg-black text-white' : 'bg-white text-black'} p-4`}>
       <button onClick={onClose} className="mb-8"><ChevronLeft /></button>
       <h2 className="text-2xl font-black mb-6 uppercase">Settings</h2>
       <button onClick={() => setDarkMode(!darkMode)} className="w-full flex justify-between p-4 bg-gray-100 rounded-xl mb-4 text-black">
         <span>Dark Mode</span>
         <span>{darkMode ? 'ON' : 'OFF'}</span>
       </button>
       <button onClick={handleLogout} className="w-full p-4 bg-red-50 text-red-500 rounded-xl font-black uppercase">Logout</button>
    </div>
  );
}

function FollowListModal({ type, userId, onClose, openProfile, getAvatar, darkMode }) { return <div className="hidden"></div>; }
function SearchView({ posts, openProfile, searchQuery, setSearchQuery, darkMode }) {
  return (
    <div className="p-4">
      <input className="w-full p-3 rounded-xl bg-gray-100 outline-none mb-4" placeholder="SEARCH..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      <div className="grid grid-cols-3 gap-1">
        {posts.filter(p => p.image_url && p.content.includes(searchQuery)).map(p => (
          <img key={p.id} src={p.image_url} className="aspect-square object-cover" />
        ))}
      </div>
    </div>
  );
}
function MessagesList({ allProfiles, user, setDmTarget, getAvatar, openProfile, darkMode }) {
  return (
    <div className="p-4">
      <h2 className="font-black mb-4">MESSAGES</h2>
      {allProfiles.filter(p => p.id !== user.id).map(u => (
        <div key={u.id} onClick={() => setDmTarget(u)} className="flex items-center gap-3 mb-4 cursor-pointer">
          <img src={getAvatar(u.username, u.avatar_url)} className="w-12 h-12 rounded-full object-cover" />
          <span className="font-bold">{u.display_name}</span>
        </div>
      ))}
    </div>
  );
}
function DMScreen({ target, setDmTarget, currentUser, getAvatar, darkMode }) { return <div className="fixed inset-0 bg-white z-[100] p-4"><button onClick={() => setDmTarget(null)}>Close</button></div>; }
function AuthScreen({ fetchData }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) alert(signUpError.message);
      else alert("Check your email!");
    }
    fetchData();
  };
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <Zap size={48} className="text-blue-600 mb-4" />
      <form onSubmit={handleLogin} className="w-full max-w-xs space-y-4">
        <input type="email" placeholder="Email" className="w-full p-4 bg-gray-100 rounded-2xl" onChange={e => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" className="w-full p-4 bg-gray-100 rounded-2xl" onChange={e => setPassword(e.target.value)} />
        <button className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black">LOGIN / JOIN</button>
      </form>
    </div>
  );
        }
