import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // ここを修正しました
import { Camera, MessageCircle, Heart, Share2, Plus, User } from 'lucide-react';

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');

  useEffect(() => {
    // ログイン状態のチェック
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        // プロフィール情報の取得
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', session.user.id)
          .single();
        if (profile) setUsername(profile.username);
      }
    };
    checkUser();
    fetchData();
  }, []);

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
    if (!username) return;
    const { data, error } = await supabase.auth.signInAnonymously();
    if (data?.user) {
      await supabase.from('profiles').upsert([
        { id: data.user.id, username: username, display_name: username }
      ]);
      setUser(data.user);
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

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50">
        <h1 className="text-3xl font-bold mb-8 text-blue-500">GridStream</h1>
        <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-gray-600 mb-4 text-center">ユーザー名を入力して開始</p>
          <input 
            type="text" 
            className="w-full border border-gray-200 p-3 rounded-xl mb-4 focus:ring-2 focus:ring-blue-500 outline-none text-black"
            placeholder="ユーザー名（例: taro_grid）"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button 
            onClick={handleSignUp}
            className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition"
          >
            新しく始める
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-20 border-x border-gray-100 font-sans text-black">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">GridStream</h1>
        <div className="flex gap-4 text-gray-700">
          <Camera size={24} />
          <MessageCircle size={24} />
        </div>
      </header>

      {/* ストーリーエリア */}
      <div className="flex overflow-x-auto p-4 gap-4 no-scrollbar border-b border-gray-50">
        <div className="flex flex-col items-center flex-shrink-0">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center border border-dashed border-gray-300">
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

      {/* 投稿入力 */}
      <div className="p-4 border-b border-gray-100 flex gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 overflow-hidden flex-shrink-0 flex items-center justify-center text-blue-500 font-bold uppercase">
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
            <button onClick={handlePost} className="bg-blue-500 text-white px-4 py-1.5 rounded-full font-bold text-sm">ポスト</button>
          </div>
        </div>
      </div>

      {/* タイムライン */}
      <div className="divide-y divide-gray-100">
        {posts.map((post) => (
          <article key={post.id} className="p-4 flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.profiles?.username}`} alt="avatar" />
            </div>
            <div className="flex-grow">
              <div className="flex items-center gap-1">
                <span className="font-bold text-sm">{post.profiles?.username}</span>
                <span className="text-gray-500 text-xs">· 1分前</span>
              </div>
              <p className="text-sm mt-1 leading-relaxed text-gray-800">{post.content}</p>
              <div className="flex justify-between mt-3 text-gray-400 max-w-[200px]">
                <Heart size={18} />
                <MessageCircle size={18} />
                <Share2 size={18} />
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* ナビゲーション */}
      <nav className="fixed bottom-0 max-w-md w-full bg-white/90 backdrop-blur-md border-t border-gray-100 flex justify-around py-3 text-gray-400">
        <span className="text-blue-500 cursor-pointer">🏠</span>
        <span className="cursor-pointer">🔍</span>
        <span className="cursor-pointer">✉️</span>
        <span className="cursor-pointer">👤</span>
      </nav>
    </div>
  );
          }
