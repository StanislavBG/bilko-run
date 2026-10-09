import { useState } from 'react';

const SAFE_VIDEO_URL = /^\/blog-videos\/[a-z0-9-]+\/$/;

export function isSafeBlogVideoUrl(src: string): boolean {
  return SAFE_VIDEO_URL.test(src);
}

export function BlogVideoPlayer({ src, title }: { src: string; title: string }) {
  const [playing, setPlaying] = useState(false);

  if (!isSafeBlogVideoUrl(src)) return null;

  return (
    <figure className="my-8">
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-warm-900 shadow">
        {playing ? (
          <iframe
            src={src}
            sandbox="allow-scripts"
            allow="autoplay; fullscreen"
            title={`Video: ${title}`}
            className="absolute inset-0 w-full h-full border-0"
          />
        ) : (
          <button
            type="button"
            aria-label={`Play video: ${title}`}
            onClick={() => setPlaying(true)}
            className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-4 px-6 text-center cursor-pointer"
          >
            <span className="text-white text-lg md:text-2xl font-black leading-tight">{title}</span>
            <span className="flex items-center justify-center h-16 w-16 rounded-full bg-fire-500 hover:bg-fire-600 transition-colors">
              <svg viewBox="0 0 24 24" className="h-7 w-7 ml-1 fill-white" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <span className="text-warm-200 text-sm font-semibold">Watch the 30-second version</span>
          </button>
        )}
      </div>
      <figcaption className="mt-2 flex items-center justify-between text-xs text-warm-400">
        <span>30-second video version of this post</span>
        <a href={src} target="_blank" rel="noopener" className="hover:text-fire-500 transition-colors">
          Open in new tab
        </a>
      </figcaption>
    </figure>
  );
}
