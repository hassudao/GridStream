import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, Send, MessageCircle, Heart, Share2, Plus } from 'lucide-react';

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [newPost, setNewPost] = useState('');

  // データ取得
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    // 投稿の取得
    const { data: postsData } = await supabase
      .from('posts')
      .select('*, profiles(username, avatar_url)')
      .order('created_at', { ascending: false });
    if (postsData) setPosts(postsData);

    // ストーリーの取得（ダミー含め表示用）
    const { data: storiesData } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .limit(10);
    if (storiesData) setStories(storiesData);
  }

  // 投稿送信
  async function handlePost() {
    if (!newPost.trim()) return;
    const { error } = await supabase
      .from('posts')
      .insert([{ content: newPost, user_id: 'YOUR_AUTH_ID' }]); // 本来はauthからID取得
    
    if (!error) {
      setNewPost('');
      fetchData();
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen pb-20 border-x border-gray-100 font-sans">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
          GridStream
        </h1>
        <div className="flex gap-4 text-gray-700">
          <Camera size={24} />
          <MessageCircle size={24} />
        </div>
      </header>

      {/* ストーリーセクション (Instagram風) */}
      <div className="flex overflow-x-auto p-4 gap-4 no-scrollbar border-b border-gray-50">
        <div className="flex flex-col items-center flex-shrink-0 relative">
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center border-2 border-white overflow-hidden">
             <Plus size={24} className="text-gray-500" />
          </div>
          <span className="text-xs mt-1 text-gray-500">あなたのストーリー</span>
        </div>
        {stories.map((story, i) => (
          <div key={i} className="flex flex-col items-center flex-shrink-0">
            <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600">
              <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-gray-300">
                <img src={story.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`} alt="avatar" />
              </div>
            </div>
            <span className="text-xs mt-1 text-gray-600">{story.username || 'User'}</span>
          </div>
        ))}
      </div>

      {/* 投稿エリア (Twitter風) */}
      <div className="p-4 border-b border-gray-100 flex gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=me" alt="my avatar" />
        </div>
        <div className="flex-grow">
          <textarea 
            className="w-full border-none focus:ring-0 text-lg placeholder-gray-400 resize-none h-12"
            placeholder="今、何してる？"
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
          />
          <div className="flex justify-end mt-2">
            <button 
              onClick={handlePost}
              className="bg-blue-500 text-white px-4 py-1.5 rounded-full font-bold text-sm hover:bg-blue-600 transition"
            >
              ポストする
            </button>
          </div>
        </div>
      </div>

      {/* タイムライン */}
      <div className="divide-y divide-gray-100">
        {posts.length > 0 ? posts.map((post) => (
          <article key={post.id} className="p-4 flex gap-3 hover:bg-gray-50/50 transition cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
              <img src={post.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.id}`} alt="avatar" />
            </div>
            <div className="flex-grow">
              <div className="flex items-center gap-1">
                <span className="font-bold text-sm">{post.profiles?.username || 'Guest'}</span>
                <span className="text-gray-500 text-xs">@{post.profiles?.username || 'guest'} · 1h</span>
              </div>
              <p className="text-sm mt-1 leading-relaxed text-gray-800">
                {post.content}
              </p>
              {post.image_url && (
                <div className="mt-3 rounded-2xl overflow-hidden border border-gray-100">
                  <img src={post.image_url} alt="post content" className="w-full h-auto" />
                </div>
              )}
              {/* アクションボタン */}
              <div className="flex justify-between mt-3 text-gray-500 max-w-xs">
                <div className="flex items-center gap-1 hover:text-blue-500 transition">
                  <MessageCircle size={18} /> <span className="text-xs">12</span>
                </div>
                <div className="flex items-center gap-1 hover:text-red-500 transition">
                  <Heart size={18} /> <span className="text-xs">45</span>
                </div>
                <div className="flex items-center gap-1 hover:text-green-500 transition">
                  <Share2 size={18} />
                </div>
              </div>
            </div>
          </article>
        )) : (
          <div className="p-10 text-center text-gray-400">
            まだ投稿がありません。最初のつぶやきをどうぞ！
          </div>
        )}
      </div>

      {/* 下部ナビゲーション (おまけ) */}
      <nav className="fixed bottom-0 max-w-md w-full bg-white border-t border-gray-100 flex justify-around py-3 text-gray-400">
        <div className="text-blue-500">🏠</div>
        <div>🔍</div>
        <div>🔔</div>
        <div>✉️</div>
      </nav>
    </div>
  );
          }
