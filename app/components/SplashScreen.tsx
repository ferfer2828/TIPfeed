'use client';
import Image from 'next/image';

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-green-800 flex flex-col items-center justify-center z-50">
      <div className="flex flex-col items-center gap-8">
        <div className="bg-white rounded-2xl px-8 py-5 shadow-xl">
          <Image
            src="/logo.png"
            alt="TIPfeed"
            width={220}
            height={110}
            className="object-contain"
            priority
          />
        </div>
        <div className="flex gap-2">
          <span className="w-2.5 h-2.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2.5 h-2.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2.5 h-2.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
