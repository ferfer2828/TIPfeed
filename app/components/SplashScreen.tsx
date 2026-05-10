'use client';
import Image from 'next/image';

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-green-800 flex flex-col items-center justify-center z-50">
      <div className="flex flex-col items-center gap-8 w-full px-6">
        <Image
          src="/logo.png"
          alt="TIPfeed"
          width={500}
          height={250}
          className="object-contain w-full max-w-sm"
          priority
        />
        <div className="flex gap-2">
          <span className="w-2.5 h-2.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2.5 h-2.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2.5 h-2.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
