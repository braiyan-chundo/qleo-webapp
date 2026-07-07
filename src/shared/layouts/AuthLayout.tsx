import { Outlet } from 'react-router-dom';

export const AuthLayout = () => {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      {/* Background Image Layer */}
      <div
        className="absolute inset-0 bg-cover bg-center z-0 scale-105 transform transition-transform duration-[20s] hover:scale-110"
        style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuA_GKg1nN7W6KbZFx_Md0cFifFzZvcdpvoUxnAD8Mf6j1r7maE_D-o97ZgBEjzlbTdXZWl1-BHur8bcNMmojfN6LuS1BULjDff4DRrmPSDZ2hb0ZakaNH8rSnoaXPZBnHDtD6F0GMFiT4aBPTz5gBdl1fpMaye4bvQ8BfyzEnIf1gVk7lSwv7qUeImu9Lc8spYIto0Uxac6BSIn6iLTnaGj3u_ifJeai4moMqZILxJlGeAenssqbdjw")' }}
      />
      {/* Premium Glass/Frost Overlay */}
      <div className="absolute inset-0 bg-surface/85 backdrop-blur-md z-0 dark:bg-background/80" />

      {/* Main Content Container */}
      <main className="w-full max-w-[420px] px-4 sm:px-6 relative z-10 flex flex-col justify-center">
        <Outlet />
      </main>
    </div>
  );
};
