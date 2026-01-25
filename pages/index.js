import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, MessageCircle, Heart, Share2, Plus, User, AlertCircle } from 'lucide-react';

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    checkUser();
    fetchData();
  }, []);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .single();
      if (profile) setUsername(profile.username);
    }
  }

  async function fetchData() {
    const { data: postsData } = await supabase
      .from('posts')
      .select('*, profiles(username, avatar_url)')
      .order('created_at', { ascending: false });
    if (postsData) setPosts(postsData);

    const { data: storiesData } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .limit(10);
    if (storiesData) setStories(storiesData);
  }

  async function handleSignUp() {
    if (!username.trim()) return setErrorMsg('ユーザー名を入力してください');
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. 匿名ログインを試行
      const { data, error: authError } = await supabase.auth.signInAnonymously();
      
      if (authError) {
        throw new Error(`認証エラー: ${authError.message} (SupabaseのAuthenticationでAnonymousをオンにしてください)`);
      }

      if (data?.user) {
        // 2. プロフィール作成
        const { error: profileError } = await supabase.from('profiles').upsert([
          { id: data.user.id, username: username, display_name: username }
        ]);
        
        if (profileError) throw profileError;
        setUser(data.user);
      }
    } catch (err) {
      setErrorMsg(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePost() {
    if (!newPost.trim() || !user) return;
    const { error } = await supabase
      .from('posts')
      .insert([{ content: newPost, user_id: user.id }]);
    
    if (!error) {
      setNewPost('');
      fetchData();
    }
  }

  // ログイン画面
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50 text-black font-sans">
        <h1 className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">GridStream</h1>
        <p className="text-gray-500 mb-8">Next Generation SNS</p>
        
        <div className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
          <input 
            type="text" 
            className="w-full border-2 border-gray-100 p-4 rounded-2xl mb-4 focus:border-blue-500 outline-none transition-all"
            placeholder="ユーザー名を入力"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          
          {errorMsg && (
            <div className="flex items-center gap-2 text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-xl">
              <AlertCircle size={16} /> {errorMsg}
            </div>
          )}

          <button 
            onClick={handleSignUp}
            disabled={loading}
            className="w-full bg-blue-500 text-white font-bold py-4 rounded-2xl hover:bg-blue-600 transition shadow-lg shadow-blue-200 disabled:opacity-50"
          >
            {loading ? '準備中...' : '新しく始める'}
          </button>
        </div>
      </div>
    );
  }

  // メイン画面（前回と同じ）
  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-20 border-x border-gray-100 font-sans text-black">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">GridStream</h1>
        <div className="flex gap-4">
          <Camera size={24} className="text-gray-700" />
          <MessageCircle size={24} className="text-gray-700" />
        </div>
      </header>

      {/* ストーリー */}
      <div className="flex overflow-x-auto p-4 gap-4 no-scrollbar border-b border-gray-50">
        <div className="flex flex-col items-center flex-shrink-0">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center border border-dashed border-gray-300">
             <Plus size={24} className="text-gray-400" />
          </div>
          <span className="text-xs mt-1 text-gray-400">追加</span>
        </div>
        {stories.map((s, i) => (
          <div key={i} className="flex flex-col items-center flex-shrink-0">
            <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-purple-600">
              <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-gray-200">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s.username}`} alt="avatar" />
              </div>
            </div>
            <span className="text-xs mt-1 text-gray-600">{s.username}</span>
          </div>
        ))}
      </div>

      {/* 投稿エリア */}
      <div className="p-4 border-b border-gray-100 flex gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 font-bold uppercase overflow-hidden">
          {username ? username[0] : <User size={20}/>}
        </div>
        <div className="flex-grow">
          <textarea 
            className="w-full border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-12 outline-none"
            placeholder="今、何してる？"
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
          />
          <div className="flex justify-end mt-2">
            <button onClick={handlePost} className="bg-blue-500 text-white px-5 py-2 rounded-full font-bold text-sm shadow-md">ポスト</button>
          </div>
        </div>
      </div>

      {/* タイムライン */}
      <div className="divide-y divide-gray-100 pb-20">
        {posts.map((post) => (
          <article key={post.id} className="p-4 flex gap-3 animate-in fade-in duration-500">
            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.profiles?.username}`} alt="avatar" />
            </div>
            <div className="flex-grow text-black">
              <div className="flex items-center gap-1">
                <span className="font-bold text-sm text-black">{post.profiles?.username}</span>
                <span className="text-gray-500 text-xs">· ちょうど今</span>
              </div>
              <p className="text-sm mt-1 leading-relaxed">{post.content}</p>
              <div className="flex justify-between mt-3 text-gray-400 max-w-[200px]">
                <Heart size={18} className="hover:text-red-500 transition-colors" />
                <MessageCircle size={18} className="hover:text-blue-500 transition-colors" />
                <Share2 size={18} className="hover:text-green-500 transition-colors" />
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* 下部ナビ */}
      <nav className="fixed bottom-0 max-w-md w-full bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-around py-4 text-gray-400 z-20">
        <span className="text-blue-500">🏠</span>
        <span>🔍</span>
        <span>✉️</span>
        <span>👤</span>
      </nav>
    </div>
  );
        }
