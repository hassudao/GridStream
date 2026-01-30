import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Search, Home as HomeIcon, X, User as UserIcon, ImageIcon, Send, ChevronLeft, Zap, LogOut, Settings, Trash2, MessageSquare, UserPlus, UserMinus, Plus, Type, Check, Palette } from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = 'dtb3jpadj'; 
const CLOUDINARY_UPLOAD_PRESET = 'alpha-sns';

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// フォントスタイルの定義
const FONT_STYLES = [
  { name: 'Classic', css: 'font-serif', label: 'Classic' },
  { name: 'Modern', css: 'font-sans font-black uppercase tracking-widest', label: 'Modern' },
  { name: 'Typewriter', css: 'font-mono', label: 'Typewriter' },
  { name: 'Neon', css: 'font-cursive italic', label: 'Neon' },
];

const TEXT_COLORS = ['#FFFFFF', '#000000', '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FF2D55'];

export default function App() {
  const [view, setView] = useState('home'); 
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]); 
  const [groupedStories, setGroupedStories] = useState({}); 
  const [viewingStory, setViewingStory] = useState(null); 
  const [creatingStory, setCreatingStory] = useState(false); // ストーリー作成モード
  const [allProfiles, setAllProfiles] = useState([]);
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(true); // デフォルトをダークモード寄りに
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

  useEffect(() => { fetchData(); }, [user]);

  useEffect(() => {
    if (stories.length > 0 && allProfiles.length > 0) {
      const grouped = stories.reduce((acc, story) => {
        if (!acc[story.user_id]) acc[story.user_id] = [];
        acc[story.user_id].push(story);
        return acc;
      }, {});
      setGroupedStories(grouped);
    } else {
      setGroupedStories({});
    }
  }, [stories, allProfiles]);

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

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: storiesData } = await supabase
      .from('stories')
      .select('*')
      .gt('created_at', yesterday)
      .order('created_at', { ascending: true });
    
    setStories(storiesData || []);

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

  // ストーリー画像の準備（エディタを開く）
  const handleStoryFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCreatingStory(file);
    }
    e.target.value = ''; // リセット
  };

  // 編集完了・アップロード処理
  const handleStoryPublish = async (processedImageBlob) => {
    if (!user || !processedImageBlob) return;
    setUploading(true);
    setCreatingStory(false); // エディタを閉じる
    
    try {
      const imageUrl = await uploadToCloudinary(processedImageBlob);
      await supabase.from('stories').insert([{ user_id: user.id, image_url: imageUrl }]);
      fetchData(); 
    } catch (error) {
      console.error("Story upload failed", error);
      alert("アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  };

  // ストーリー削除
  const handleDeleteStory = async (storyId) => {
    if(!window.confirm("このストーリーを削除しますか？")) return;
    await supabase.from('stories').delete().eq('id', storyId);
    setViewingStory(null); // 一旦閉じる
    fetchData();
  };

  // ... (プロフィール更新等は既存通り)
  async function handleUpdateProfile() {
    setUploading(true);
    let { avatar_url, header_url } = editData;
    if (avatarInputRef.current?.files[0]) avatar_url = await uploadToCloudinary(avatarInputRef.current.files[0]);
    if (headerInputRef.current?.files[0]) header_url = await uploadToCloudinary(headerInputRef.current.files[0]);

    const { error } = await supabase.from('profiles').update({
      display_name: editData.display_name, username: editData.username, bio: editData.bio, avatar_url, header_url
    }).eq('id', user.id);

    if (!error) { await fetchMyProfile(user.id); await openProfile(user.id); setIsEditing(false); }
    setUploading(false);
  }

  async function toggleLike(postId, isLiked) {
    if (!user) return;
    const updateLogic = (p) => p.id === postId ? { ...p, is_liked: !isLiked, like_count: isLiked ? Math.max(0, p.like_count - 1) : p.like_count + 1 } : p;
    setPosts(prev => prev.map(updateLogic));
    if (selectedPost?.id === postId) setSelectedPost(prev => updateLogic(prev));
    if (isLiked) await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id);
    else await supabase.from('likes').insert([{ post_id: postId, user_id: user.id }]);
    fetchData();
  }

  const handleShare = async (post) => {
    try {
      if (navigator.share) await navigator.share({ title: 'GridStream', text: post.content, url: window.location.href });
      else { await navigator.clipboard.writeText(`${post.content}\n${window.location.href}`); alert('リンクをコピーしました！'); }
    } catch (err) { console.log('Share failed', err); }
  };

  async function handlePost(e) {
    e.preventDefault();
    if (!newPost.trim() || !user) return;
    setUploading(true);
    let imageUrl = null;
    if (fileInputRef.current?.files[0]) imageUrl = await uploadToCloudinary(fileInputRef.current.files[0]);
    await supabase.from('posts').insert([{ content: newPost, user_id: user.id, image_url: imageUrl }]);
    setNewPost(''); if (fileInputRef.current) fileInputRef.current.value = "";
    fetchData(); setUploading(false);
  }

  async function handleDeletePost(postId) {
    if (!window.confirm("削除しますか？")) return;
    await supabase.from('posts').delete().eq('id', postId).eq('user_id', user.id);
    setPosts(prev => prev.filter(p => p.id !== postId)); setSelectedPost(null);
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
    setView('profile'); setIsEditing(false);
  };

  async function toggleFollow() {
    if (!user || !activeProfileId || user.id === activeProfileId) return;
    if (stats.isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', activeProfileId);
      setStats(prev => ({ ...prev, isFollowing: false, followers: prev.followers - 1 }));
    } else {
      await supabase.from('follows').insert([{ follower_id: user.id, following_id: activeProfileId }]);
      setStats(prev => ({ ...prev, isFollowing: true, followers: prev.followers + 1 }));
    }
  }

  const getAvatar = (name, url) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
  const [dmTarget, setDmTarget] = useState(null);

  if (!user) return <AuthScreen fetchData={fetchData} />;

  return (
    <div className={`max-w-md mx-auto min-h-screen pb-20 border-x font-sans relative shadow-2xl transition-colors duration-300 ${darkMode ? 'bg-black text-white border-gray-800' : 'bg-white text-black border-gray-100'}`}>
      <script src="https://cdn.tailwindcss.com"></script>

      {/* ストーリー作成画面 (エディタ) */}
      {creatingStory && (
        <StoryCreator 
          file={creatingStory} 
          onClose={() => setCreatingStory(false)} 
          onPublish={handleStoryPublish}
          myProfile={myProfile}
          getAvatar={getAvatar}
        />
      )}

      {/* ストーリービューアー */}
      {viewingStory && (
        <StoryViewer 
          stories={groupedStories[viewingStory.userId]} 
          initialIndex={viewingStory.index} 
          onClose={() => setViewingStory(null)} 
          userProfile={allProfiles.find(p => p.id === viewingStory.userId)}
          getAvatar={getAvatar}
          currentUserId={user.id}
          onDelete={handleDeleteStory}
        />
      )}

      {dmTarget && <DMScreen target={dmTarget} setDmTarget={setDmTarget} currentUser={user} getAvatar={getAvatar} darkMode={darkMode} />}
      {showFollowList && <FollowListModal type={showFollowList} userId={activeProfileId} onClose={() => setShowFollowList(null)} openProfile={openProfile} getAvatar={getAvatar} darkMode={darkMode} />}
      {selectedPost && <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} getAvatar={getAvatar} openProfile={openProfile} onDelete={handleDeletePost} onLike={toggleLike} onShare={handleShare} currentUser={user} darkMode={darkMode} refreshPosts={fetchData} />}
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

          {/* ストーリーズトレイ */}
          <div className={`p-4 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
            
            {/* 自分のストーリー (閲覧 or 追加) */}
            <div className="inline-flex flex-col items-center gap-1 cursor-pointer relative shrink-0">
              <div className="relative">
                {/* リング: ストーリーがあればグラデーション、なければ透明 */}
                <div 
                  className={`rounded-full p-[2px] ${groupedStories[user.id] ? 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500' : 'bg-transparent'}`}
                  onClick={() => {
                    if (groupedStories[user.id]) {
                      setViewingStory({ userId: user.id, index: 0 });
                    } else {
                      storyInputRef.current.click();
                    }
                  }}
                >
                  <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className={`w-16 h-16 rounded-full object-cover border-2 ${darkMode ? 'border-black' : 'border-white'}`} />
                </div>
                
                {/* プラスボタン (常に追加可能にする) */}
                <div 
                  className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1 border-2 border-black cursor-pointer hover:bg-blue-600 transition"
                  onClick={(e) => {
                    e.stopPropagation(); // 親のクリックイベント(閲覧)を防止
                    storyInputRef.current.click();
                  }}
                >
                  <Plus size={12} className="text-white" />
                </div>
              </div>
              <span className="text-[10px] font-bold text-gray-400">Your Story</span>
              <input type="file" accept="image/*" ref={storyInputRef} className="hidden" onChange={handleStoryFileSelect} />
            </div>

            {/* 他ユーザーのストーリー */}
            {Object.keys(groupedStories).filter(id => id !== user.id).map(userId => {
               const uProfile = allProfiles.find(p => p.id === userId);
               if (!uProfile) return null;
               return (
                 <div key={userId} className="inline-flex flex-col items-center gap-1 cursor-pointer shrink-0" onClick={() => setViewingStory({ userId, index: 0 })}>
                   <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500">
                     <img src={getAvatar(uProfile.username, uProfile.avatar_url)} className={`w-16 h-16 rounded-full object-cover border-2 ${darkMode ? 'border-black' : 'border-white'}`} />
                   </div>
                   <span className="text-[10px] font-bold max-w-[64px] truncate">{uProfile.display_name}</span>
                 </div>
               );
            })}
          </div>

          {/* 投稿フォーム */}
          <form onSubmit={handlePost} className={`p-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            <div className="flex gap-3">
              <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-10 h-10 rounded-full object-cover shadow-sm cursor-pointer" onClick={() => openProfile(user.id)} />
              <textarea className="flex-grow border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-16 outline-none bg-transparent font-medium" placeholder="What's happening?" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
            </div>
            <div className="flex justify-between items-center pl-12 mt-2">
              <label className="cursor-pointer text-blue-500 hover:bg-blue-50/10 p-2 rounded-full transition"><ImageIcon size={22}/><input type="file" accept="image/*" ref={fileInputRef} className="hidden" /></label>
              <button type="submit" disabled={uploading || !newPost.trim()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-black text-xs shadow-lg uppercase tracking-tighter">
                {uploading ? '...' : 'Stream'}
              </button>
            </div>
          </form>

          {/* フィード */}
          <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-100'}`}>
            {posts.map(post => (
              <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onLike={toggleLike} onShare={handleShare} currentUser={user} darkMode={darkMode} onOpenDetail={() => setSelectedPost(post)} />
            ))}
          </div>
        </div>
      )}

      {/* プロフィール画面などは維持 */}
      {view === 'profile' && profileInfo && (
        <ProfileView 
           user={user} activeProfileId={activeProfileId} profileInfo={profileInfo} posts={posts} isEditing={isEditing} setIsEditing={setIsEditing} editData={editData} setEditData={setEditData} 
           handleUpdateProfile={handleUpdateProfile} uploading={uploading} avatarInputRef={avatarInputRef} headerInputRef={headerInputRef} getAvatar={getAvatar} openProfile={openProfile} 
           toggleFollow={toggleFollow} stats={stats} setShowFollowList={setShowFollowList} setShowSettings={setShowSettings} darkMode={darkMode} setView={setView} toggleLike={toggleLike} handleShare={handleShare} setSelectedPost={setSelectedPost}
        />
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

// --- 新機能: ストーリー作成 (画像＋文字入れ) ---
function StoryCreator({ file, onClose, onPublish, myProfile, getAvatar }) {
  const [textMode, setTextMode] = useState(false);
  const [text, setText] = useState('');
  const [textStyle, setTextStyle] = useState({ 
    fontIndex: 0, 
    colorIndex: 0, 
    size: 50, // 0-100 scale
    y: 50     // vertical position %
  });
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [previewSrc, setPreviewSrc] = useState(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handlePublish = () => {
    // 1. キャンバスを作成して画像とテキストを合成する
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = imgRef.current;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // 画像を描画
    ctx.drawImage(img, 0, 0);

    // テキストがあれば描画
    if (text) {
      const fontSize = (img.naturalWidth / 10) * (0.5 + textStyle.size / 50); // サイズ計算
      const fontName = FONT_STYLES[textStyle.fontIndex].name;
      const fontMap = { 'Classic': 'serif', 'Modern': 'sans-serif', 'Typewriter': 'monospace', 'Neon': 'cursive' };
      
      ctx.font = `bold ${fontSize}px ${fontMap[fontName] || 'sans-serif'}`;
      ctx.fillStyle = TEXT_COLORS[textStyle.colorIndex];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // 影をつけて視認性を上げる
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 10;
      
      const x = canvas.width / 2;
      const y = canvas.height * 0.5; // 中央配置 (シンプル化のため)

      ctx.fillText(text, x, y);
    }

    canvas.toBlob((blob) => {
      onPublish(blob);
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* プレビュー画像 (非表示の参照用) */}
      <img ref={imgRef} src={previewSrc} className="hidden" onLoad={() => {}} />

      {/* ヘッダー */}
      <div className="absolute top-0 w-full p-4 flex justify-between items-center z-20">
        <button onClick={onClose} className="p-2 bg-black/40 rounded-full text-white"><X /></button>
        <div className="flex gap-4">
          <button onClick={() => setTextMode(true)} className="p-2 bg-black/40 rounded-full text-white"><Type /></button>
        </div>
      </div>

      {/* メインキャンバスエリア */}
      <div className="flex-grow relative flex items-center justify-center bg-gray-900 overflow-hidden">
        {previewSrc && (
          <div className="relative w-full h-full max-w-md">
             <img src={previewSrc} className="w-full h-full object-contain" />
             {/* テキストオーバーレイ表示 */}
             {text && (
               <div 
                 className={`absolute inset-0 flex items-center justify-center pointer-events-none break-words text-center whitespace-pre-wrap p-4 leading-tight ${FONT_STYLES[textStyle.fontIndex].css}`}
                 style={{ 
                   color: TEXT_COLORS[textStyle.colorIndex], 
                   fontSize: `${1.5 + textStyle.size / 20}rem`,
                   textShadow: '0 2px 10px rgba(0,0,0,0.5)'
                 }}
               >
                 {text}
               </div>
             )}
          </div>
        )}
      </div>

      {/* テキスト入力モード */}
      {textMode && (
        <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex flex-col justify-center items-center animate-in fade-in">
           <div className="absolute top-4 right-4">
             <button onClick={() => setTextMode(false)} className="text-white font-bold text-lg">完了</button>
           </div>
           
           <textarea 
             autoFocus
             value={text}
             onChange={e => setText(e.target.value)}
             className={`bg-transparent text-center w-full max-w-xs outline-none resize-none overflow-hidden placeholder-white/50 ${FONT_STYLES[textStyle.fontIndex].css}`}
             style={{ color: TEXT_COLORS[textStyle.colorIndex], fontSize: `${1.5 + textStyle.size / 20}rem` }}
             placeholder="タップして入力..."
             rows={3}
           />

           {/* ツールバー */}
           <div className="absolute bottom-0 w-full p-4 space-y-4 pb-10 bg-gradient-to-t from-black to-transparent">
             {/* フォント選択 */}
             <div className="flex justify-center gap-4 overflow-x-auto pb-2">
               {FONT_STYLES.map((f, i) => (
                 <button 
                   key={f.name} 
                   onClick={() => setTextStyle({...textStyle, fontIndex: i})}
                   className={`px-4 py-1 rounded-full text-xs font-bold border ${textStyle.fontIndex === i ? 'bg-white text-black border-white' : 'bg-black/50 text-white border-white/30'}`}
                 >
                   {f.name}
                 </button>
               ))}
             </div>
             
             {/* サイズスライダー */}
             <div className="flex items-center justify-center px-8">
               <span className="text-xs text-white mr-2">A</span>
               <input 
                 type="range" min="0" max="100" 
                 value={textStyle.size} 
                 onChange={e => setTextStyle({...textStyle, size: parseInt(e.target.value)})}
                 className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
               />
               <span className="text-lg text-white ml-2">A</span>
             </div>

             {/* カラーパレット */}
             <div className="flex justify-center gap-3 overflow-x-auto px-4">
               {TEXT_COLORS.map((c, i) => (
                 <button 
                   key={c}
                   onClick={() => setTextStyle({...textStyle, colorIndex: i})}
                   className={`w-8 h-8 rounded-full border-2 ${textStyle.colorIndex === i ? 'border-white scale-110' : 'border-transparent'}`}
                   style={{ backgroundColor: c }}
                 />
               ))}
             </div>
           </div>
        </div>
      )}

      {/* フッター (投稿ボタン) - テキストモードでない時のみ */}
      {!textMode && (
        <div className="absolute bottom-0 w-full p-4 flex justify-between items-center bg-gradient-to-t from-black/90 to-transparent pb-8">
           <div className="flex items-center gap-2">
             <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 to-purple-500">
               <img src={getAvatar(myProfile.username, myProfile.avatar_url)} className="w-8 h-8 rounded-full border-2 border-black" />
             </div>
             <span className="text-white text-xs font-bold">あなたのストーリー</span>
           </div>
           
           <button 
             onClick={handlePublish}
             className="bg-white text-black rounded-full p-3 px-6 font-bold flex items-center gap-2 shadow-lg active:scale-95 transition"
           >
             シェア <ChevronLeft className="rotate-180" size={16} />
           </button>
        </div>
      )}
    </div>
  );
}

// --- ストーリービューアー (機能強化版) ---
function StoryViewer({ stories, initialIndex, onClose, userProfile, getAvatar, currentUserId, onDelete }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const STORY_DURATION = 5000; 
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  
  // ストーリーがない場合(削除などで)閉じる
  useEffect(() => {
    if (!stories || stories.length === 0) {
      onClose();
    } else if (currentIndex >= stories.length) {
        setCurrentIndex(stories.length - 1);
    }
  }, [stories, currentIndex]);

  const currentStory = stories[currentIndex];

  useEffect(() => {
    if (!currentStory) return;
    setProgress(0);
    startTimer();
    return () => cancelAnimationFrame(timerRef.current);
  }, [currentIndex, currentStory]);

  const startTimer = () => {
    startTimeRef.current = Date.now();
    const animate = () => {
      if (isPaused) return; 
      const elapsed = Date.now() - startTimeRef.current;
      const p = (elapsed / STORY_DURATION) * 100;
      setProgress(p);

      if (elapsed < STORY_DURATION) {
        timerRef.current = requestAnimationFrame(animate);
      } else {
        nextStory();
      }
    };
    timerRef.current = requestAnimationFrame(animate);
  };

  const nextStory = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose(); 
    }
  };

  const prevStory = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else {
      setProgress(0); 
      startTimeRef.current = Date.now();
    }
  };

  const handlePointerDown = () => { setIsPaused(true); cancelAnimationFrame(timerRef.current); };
  const handlePointerUp = () => { setIsPaused(false); startTimeRef.current = Date.now() - (progress / 100) * STORY_DURATION; startTimer(); };

  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      <div className="absolute inset-0 bg-cover bg-center blur-2xl opacity-30" style={{ backgroundImage: `url(${currentStory.image_url})` }} />
      
      <div 
        className="relative w-full max-w-md h-full sm:h-[90vh] sm:rounded-2xl overflow-hidden bg-gray-900 flex flex-col"
        onMouseDown={handlePointerDown} onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown} onTouchEnd={handlePointerUp}
      >
        {/* 上部のグラデーション (視認性向上) */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/70 to-transparent z-10 pointer-events-none" />

        {/* プログレスバー */}
        <div className="absolute top-0 left-0 right-0 z-20 p-2 flex gap-1 mt-2">
          {stories.map((_, idx) => (
            <div key={idx} className="h-0.5 flex-grow bg-white/30 rounded-full overflow-hidden backdrop-blur-sm">
              <div 
                className="h-full bg-white transition-all duration-100 ease-linear shadow-[0_0_5px_rgba(255,255,255,0.8)]"
                style={{ width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%' }} 
              />
            </div>
          ))}
        </div>

        {/* ヘッダー情報 */}
        <div className="absolute top-4 left-0 right-0 z-20 p-3 pt-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src={getAvatar(userProfile.username, userProfile.avatar_url)} className="w-8 h-8 rounded-full border border-white/50" />
            <span className="text-white text-sm font-bold shadow-black drop-shadow-md">{userProfile.display_name}</span>
            <span className="text-white/80 text-xs font-medium">{formatTime(currentStory.created_at)}</span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* 自分のストーリーなら削除ボタンを表示 */}
            {currentUserId === currentStory.user_id && (
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(currentStory.id); }} 
                className="text-white/80 hover:text-red-500 p-2 transition"
              >
                <Trash2 size={20} />
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-white p-2"><X size={24} /></button>
          </div>
        </div>

        {/* タップエリア */}
        <div className="absolute inset-0 z-10 flex">
          <div className="w-1/3 h-full" onClick={prevStory} />
          <div className="w-2/3 h-full" onClick={nextStory} />
        </div>

        {/* 画像メイン */}
        <img src={currentStory.image_url} className="w-full h-full object-contain bg-black animate-in fade-in duration-300" />
      </div>
    </div>
  );
}

// ... (以下、ProfileView, SettingsScreen, PostCard, PostDetailModal, SearchView, MessagesList, DMScreen, FollowListModal, AuthScreen は変更なし)
// コード長削減のため省略していませんが、以前のコードブロックにある他のコンポーネントはそのまま維持してください。
// ここでは主要な変更があった App, StoryCreator, StoryViewer 以外は
// 直前の回答のコードのままで動作します。
// 念のため、ProfileView以下も以前のコードと連結して使用してください。

function ProfileView({ user, activeProfileId, profileInfo, posts, isEditing, setIsEditing, editData, setEditData, handleUpdateProfile, uploading, avatarInputRef, headerInputRef, getAvatar, openProfile, toggleFollow, stats, setShowFollowList, setShowSettings, darkMode, setView, toggleLike, handleShare, setSelectedPost }) {
  if (isEditing) {
    return (
      <div className="space-y-6">
        <header className="p-4 flex justify-between items-center sticky top-0 z-10 bg-inherit/90 backdrop-blur-md border-b">
          <button onClick={() => setIsEditing(false)}><X size={24}/></button>
          <h2 className="font-black uppercase tracking-widest">Edit Profile</h2>
          <button onClick={handleUpdateProfile} disabled={uploading} className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-black uppercase">{uploading ? '...' : 'Save'}</button>
        </header>
        <div className="relative h-44 bg-gray-200">
           <img src={editData.header_url || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&q=80'} className="w-full h-full object-cover" />
           <div onClick={() => headerInputRef.current.click()} className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer opacity-80 hover:opacity-100 transition"><Camera className="text-white" /><input type="file" ref={headerInputRef} className="hidden" accept="image/*" /></div>
        </div>
        <div className="px-4 space-y-4">
           <div className="flex flex-col items-center gap-2 -mt-12 relative z-10">
             <div className="relative group" onClick={() => avatarInputRef.current.click()}><img src={getAvatar(editData.username, editData.avatar_url)} className="w-24 h-24 rounded-full object-cover border-4 border-blue-500 cursor-pointer bg-white" /><div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="text-white"/></div><input type="file" ref={avatarInputRef} className="hidden" accept="image/*" /></div>
           </div>
           <div className="space-y-4 pt-4">
              <div className={`p-4 rounded-2xl ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}><label className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-2 mb-1">Display Name</label><input className="w-full bg-transparent outline-none font-bold" value={editData.display_name} onChange={e => setEditData({...editData, display_name: e.target.value})} /></div>
              <div className={`p-4 rounded-2xl ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}><label className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-2 mb-1">Username</label><input className="w-full bg-transparent outline-none font-bold text-blue-500" value={editData.username} onChange={e => setEditData({...editData, username: e.target.value})} /></div>
              <div className={`p-4 rounded-2xl ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}><label className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-2 mb-1">Bio</label><textarea className="w-full bg-transparent outline-none font-bold h-24 resize-none" value={editData.bio} onChange={e => setEditData({...editData, bio: e.target.value})} /></div>
           </div>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="relative h-44 bg-gray-200">
        <img src={profileInfo.header_url || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&q=80'} className="w-full h-full object-cover" />
        <div className="absolute top-4 inset-x-4 flex justify-between">
          <button onClick={() => setView('home')} className="bg-black/30 backdrop-blur-md p-2 rounded-full text-white"><ChevronLeft size={20}/></button>
          {user.id === activeProfileId && <button onClick={() => setShowSettings(true)} className="bg-black/30 backdrop-blur-md p-2 rounded-full text-white"><Settings size={20}/></button>}
        </div>
      </div>
      <div className="px-4 relative">
        <div className="flex justify-between items-end -mt-12 mb-4">
          <img src={getAvatar(profileInfo.username, profileInfo.avatar_url)} className={`w-24 h-24 rounded-full border-4 shadow-xl object-cover ${darkMode ? 'border-black bg-black' : 'border-white bg-white'}`} />
          <div className="flex gap-2">
            {user.id === activeProfileId ? (
              <button onClick={() => setIsEditing(true)} className={`border rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-tighter ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>Edit Profile</button>
            ) : (
              <button onClick={toggleFollow} className={`flex items-center gap-1.5 rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-tighter transition ${stats.isFollowing ? (darkMode ? 'bg-gray-800 text-white' : 'bg-gray-200 text-black') : 'bg-blue-600 text-white'}`}>
                {stats.isFollowing ? <><UserMinus size={14}/> Unfollow</> : <><UserPlus size={14}/> Follow</>}
              </button>
            )}
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tighter">{profileInfo.display_name}</h2>
          <p className="text-gray-400 text-sm font-bold">@{profileInfo.username}</p>
          <p className="mt-3 text-[15px] font-medium leading-relaxed">{profileInfo.bio || 'GridStream member.'}</p>
          <div className="flex gap-4 mt-4">
            <button onClick={() => setShowFollowList('following')} className="text-sm"><span className="font-black">{stats.following}</span> <span className="text-gray-400">Following</span></button>
            <button onClick={() => setShowFollowList('followers')} className="text-sm"><span className="font-black">{stats.followers}</span> <span className="text-gray-400">Followers</span></button>
          </div>
        </div>
      </div>
      <div className={`divide-y mt-8 border-t ${darkMode ? 'border-gray-800 divide-gray-800' : 'border-gray-100 divide-gray-100'}`}>
        {posts.filter(p => p.user_id === activeProfileId).map(post => (
          <PostCard key={post.id} post={post} openProfile={openProfile} getAvatar={getAvatar} onLike={toggleLike} onShare={handleShare} currentUser={user} darkMode={darkMode} onOpenDetail={() => setSelectedPost(post)} />
        ))}
      </div>
    </>
  );
}

function SettingsScreen({ onClose, user, myProfile, darkMode, setDarkMode }) {
  const [newEmail, setNewEmail] = useState(user.email);
  const [newPassword, setNewPassword] = useState('');
  const [updating, setUpdating] = useState(false);
  const handleLogout = () => { supabase.auth.signOut(); onClose(); };
  const handleUpdateAuth = async () => {
    setUpdating(true);
    const updates = {};
    if (newEmail !== user.email) updates.email = newEmail;
    if (newPassword) updates.password = newPassword;
    const { error } = await supabase.auth.updateUser(updates);
    if (error) alert(error.message); else alert('Updated.');
    setUpdating(false);
  };
  return (
    <div className={`fixed inset-0 z-[110] animate-in slide-in-from-bottom duration-300 overflow-y-auto pb-10 ${darkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <header className="p-4 border-b flex items-center gap-4 sticky top-0 z-10 bg-inherit"><ChevronLeft onClick={onClose} className="cursor-pointer" /><h2 className="font-black uppercase tracking-widest">Settings</h2></header>
      <div className="p-6 space-y-8">
        <section><h3 className="text-gray-400 text-[10px] font-black uppercase mb-4 tracking-widest">Appearance</h3><button onClick={() => setDarkMode(!darkMode)} className={`w-full flex justify-between items-center p-4 rounded-2xl ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}><span className="text-sm font-bold">Dark Mode</span><div className={`w-10 h-6 rounded-full relative transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${darkMode ? 'right-1' : 'left-1'}`} /></div></button></section>
        <section className="pt-4 border-t border-gray-100/10"><button onClick={handleLogout} className="w-full p-4 rounded-2xl bg-red-500/10 text-red-500 font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2"><LogOut size={16}/> Logout</button></section>
      </div>
    </div>
  );
}

function PostCard({ post, openProfile, getAvatar, onLike, onShare, currentUser, darkMode, onOpenDetail }) {
  return (
    <article className={`p-4 flex gap-3 transition border-b last:border-0 ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
      <img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-11 h-11 rounded-full cursor-pointer object-cover" onClick={() => openProfile(post.profiles.id)} />
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-start mb-1">
          <div className="flex flex-col cursor-pointer max-w-[70%]" onClick={() => openProfile(post.profiles.id)}>
            <span className="font-black text-sm truncate">{post.profiles?.display_name}</span>
            <span className="text-gray-400 text-[11px] font-bold truncate">@{post.profiles?.username}</span>
          </div>
          <span className="text-[10px] text-gray-400 font-bold whitespace-nowrap pt-1">{formatTime(post.created_at)}</span>
        </div>
        <p className="text-[15px] mt-1 font-medium leading-relaxed whitespace-pre-wrap">{post.content}</p>
        {post.image_url && <img src={post.image_url} onClick={onOpenDetail} className="mt-3 rounded-2xl w-full max-h-80 object-cover border border-gray-100/10 cursor-pointer hover:brightness-95 transition" />}
        <div className="flex justify-between mt-4 text-gray-400 max-w-[200px] items-center">
          <button onClick={() => onLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 transition ${post.is_liked ? 'text-red-500 scale-110' : 'hover:text-red-500'}`}><Heart size={18} fill={post.is_liked ? "currentColor" : "none"} /><span className="text-xs font-black">{post.like_count || ''}</span></button>
          <button onClick={onOpenDetail} className="flex items-center gap-1.5 hover:text-blue-500 transition"><MessageSquare size={18} /><span className="text-xs font-black">{post.comment_count || ''}</span></button>
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
    const { data } = await supabase.from('comments').select('*, profiles(id, username, display_name, avatar_url)').eq('post_id', post.id).order('created_at', { ascending: false });
    if (data) setComments(data);
  }
  async function handlePostComment(e) {
    e.preventDefault(); if (!commentText.trim() || !currentUser) return;
    setLoading(true); await supabase.from('comments').insert([{ post_id: post.id, user_id: currentUser.id, content: commentText }]);
    setCommentText(''); await fetchComments(); refreshPosts(); setLoading(false);
  }
  async function handleDeleteComment(commentId) {
    if (!window.confirm("削除しますか？")) return;
    await supabase.from('comments').delete().eq('id', commentId).eq('user_id', currentUser.id);
    setComments(prev => prev.filter(c => c.id !== commentId)); refreshPosts();
  }
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-[2.5rem] flex flex-col h-[85vh] overflow-hidden shadow-2xl ${darkMode ? 'bg-black border border-gray-800' : 'bg-white text-black'}`}>
        <div className={`p-4 border-b flex items-center justify-between ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
          <div className="flex items-center gap-3" onClick={() => { onClose(); openProfile(post.profiles.id); }}><img src={getAvatar(post.profiles?.username, post.profiles?.avatar_url)} className="w-8 h-8 rounded-full object-cover" /><div className="flex flex-col"><span className="font-black text-[10px]">@{post.profiles?.username}</span><span className="text-[8px] text-gray-400 font-bold uppercase">{formatTime(post.created_at)}</span></div></div>
          <div className="flex items-center gap-2">{isMyPost && <button onClick={() => onDelete(post.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={20}/></button>}<button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600"><X size={24}/></button></div>
        </div>
        <div className="flex-grow overflow-y-auto"><div className="p-5 border-b">{post.image_url && <img src={post.image_url} className="w-full rounded-2xl mb-4 border border-gray-100/10" />}<p className="font-medium leading-relaxed mb-4 whitespace-pre-wrap">{post.content}</p></div><div className="p-5 space-y-4 pb-10">{comments.map(c => (<div key={c.id} className="flex gap-3 animate-in fade-in slide-in-from-top-2 duration-300"><img src={getAvatar(c.profiles?.username, c.profiles?.avatar_url)} className="w-8 h-8 rounded-full object-cover" /><div className={`flex-grow p-3 rounded-2xl relative ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}><div className="flex justify-between items-start"><div className="flex flex-col mb-1"><span className="font-black text-[10px]">@{c.profiles?.username}</span><span className="text-[8px] text-gray-400 font-bold uppercase">{formatTime(c.created_at)}</span></div>{currentUser.id === c.user_id && <button onClick={() => handleDeleteComment(c.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>}</div><p className="text-sm font-medium leading-relaxed">{c.content}</p></div></div>))}</div></div>
        <form onSubmit={handlePostComment} className={`p-4 border-t flex gap-2 ${darkMode ? 'bg-black border-gray-800' : 'bg-white'}`}><input type="text" placeholder="コメントを入力..." className={`flex-grow p-4 rounded-2xl text-sm outline-none font-medium ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50'}`} value={commentText} onChange={(e) => setCommentText(e.target.value)} /><button type="submit" disabled={loading || !commentText.trim()} className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg active:scale-95 transition"><Send size={18}/></button></form>
      </div>
    </div>
  );
}

function SearchView({ posts, openProfile, searchQuery, setSearchQuery, setSelectedPost, darkMode }) {
  return (
    <div className="animate-in fade-in">
      <div className={`p-4 sticky top-0 z-10 border-b ${darkMode ? 'bg-black/90 border-gray-800' : 'bg-white/95 border-gray-100'}`}><div className="relative"><Search className="absolute left-3 top-3 text-gray-400" size={18} /><input type="text" placeholder="DISCOVER" className={`w-full rounded-xl py-2 pl-10 pr-4 outline-none text-xs font-black uppercase ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100'}`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div></div>
      <div className="grid grid-cols-3 gap-[2px]">{posts.filter(p => p.image_url && (p.content.includes(searchQuery) || p.profiles?.username.includes(searchQuery))).map((post) => (<img key={post.id} src={post.image_url} className="aspect-square w-full h-full object-cover cursor-pointer hover:opacity-80 transition" onClick={() => setSelectedPost(post)} />))}</div>
    </div>
  );
}

function MessagesList({ allProfiles, user, setDmTarget, getAvatar, openProfile, darkMode }) {
  return (
    <div className="animate-in fade-in">
      <header className="p-4 border-b font-black text-lg text-center uppercase italic sticky top-0 z-10">Messages</header>
      <div className="p-2">{allProfiles.filter(p => p.id !== user.id).map(u => (<div key={u.id} className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer hover:bg-gray-50/10" onClick={() => setDmTarget(u)}><img src={getAvatar(u.username, u.avatar_url)} className="w-14 h-14 rounded-full object-cover shadow-md" onClick={(e) => { e.stopPropagation(); openProfile(u.id); }} /><div className="flex-grow border-b pb-2"><p className="font-bold text-sm">{u.display_name}</p><p className="text-xs text-blue-500 font-medium mt-1 italic uppercase tracking-tighter">Open Chat</p></div></div>))}</div>
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
  async function fetchMessages() { const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true }); if (data) setMessages(data); }
  async function sendMsg(e) { e.preventDefault(); if (!text.trim()) return; const t = text; setText(''); await supabase.from('messages').insert([{ text: t, sender_id: currentUser.id, receiver_id: target.id }]); }
  return (
    <div className={`fixed inset-0 z-50 flex flex-col animate-in slide-in-from-right duration-300 ${darkMode ? 'bg-black' : 'bg-[#f8f9fa]'}`}>
      <header className={`p-4 flex items-center gap-3 border-b sticky top-0 ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white'}`}><ChevronLeft onClick={() => setDmTarget(null)} className="cursor-pointer" /><img src={getAvatar(target.username, target.avatar_url)} className="w-10 h-10 rounded-full object-cover" /><div><p className="font-black text-sm">{target.display_name}</p><p className="text-[10px] text-gray-400 font-bold">@{target.username}</p></div></header>
      <div className="flex-grow overflow-y-auto p-4 space-y-4">{messages.map(m => (<div key={m.id} className={`flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] p-4 rounded-[1.5rem] text-sm ${m.sender_id === currentUser.id ? 'bg-blue-600 text-white rounded-tr-none' : (darkMode ? 'bg-gray-800 text-white rounded-tl-none' : 'bg-white text-gray-800 rounded-tl-none shadow-sm')}`}>{m.text}</div></div>))}<div ref={scrollRef} /></div>
      <form onSubmit={sendMsg} className="p-4 border-t flex gap-2"><input type="text" className={`flex-grow p-4 rounded-2xl text-sm outline-none font-medium ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50'}`} placeholder="Aa" value={text} onChange={(e) => setText(e.target.value)} /><button type="submit" className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg active:scale-95 transition"><Send size={18}/></button></form>
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
      if (followData?.length > 0) { const ids = followData.map(f => f[targetCol]); const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids); if (profiles) setList(profiles); }
    }
    fetchList();
  }, [type, userId]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center">
      <div className={`w-full max-w-md rounded-t-[2.5rem] max-h-[80vh] flex flex-col ${darkMode ? 'bg-black text-white' : 'bg-white'}`}>
        <div className="p-6 border-b flex justify-between items-center"><h3 className="font-black uppercase tracking-widest">{type}</h3><X onClick={onClose} className="cursor-pointer" /></div>
        <div className="overflow-y-auto p-4 space-y-2">{list.map(u => (<div key={u.id} className="flex items-center gap-4 cursor-pointer p-3 rounded-2xl hover:bg-gray-50/10" onClick={() => { onClose(); openProfile(u.id); }}><img src={getAvatar(u.username, u.avatar_url)} className="w-12 h-12 rounded-full object-cover" /><div className="flex-grow"><p className="font-black text-sm">{u.display_name}</p><p className="text-gray-400 text-xs font-bold">@{u.username}</p></div></div>))}</div>
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
    else { const { data } = await supabase.auth.signUp({ email, password }); if (data?.user) { const id = displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000); await supabase.from('profiles').upsert([{ id: data.user.id, username: id, display_name: displayName }]); } }
    fetchData();
  }
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-white text-black">
      <script src="https://cdn.tailwindcss.com"></script>
      <div className="w-20 h-20 bg-gradient-to-tr from-blue-700 to-cyan-500 rounded-[2rem] flex items-center justify-center shadow-2xl mb-6 rotate-6 animate-pulse"><Zap size={40} color="white" fill="white" /></div>
      <h1 className="text-4xl font-black mb-10 text-blue-700 italic uppercase">GridStream</h1>
      <form onSubmit={handleAuth} className="w-full max-w-xs space-y-4">
        {!isLogin && <input type="text" placeholder="DISPLAY NAME" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />}
        <input type="email" placeholder="EMAIL" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="PASSWORD" className="w-full bg-gray-50 p-4 rounded-2xl outline-none font-bold" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="w-full bg-blue-700 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs">{isLogin ? "Login" : "Sign Up"}</button>
      </form>
      <button onClick={() => setIsLogin(!isLogin)} className="mt-8 text-xs font-black text-gray-400 uppercase tracking-widest">{isLogin ? "Create Account" : "Login"}</button>
    </div>
  );
       }
