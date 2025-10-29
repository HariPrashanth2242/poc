"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls, { HlsConfig } from 'hls.js';

// =================== API CONFIGURATION ===================
const API_BASE_URL = 'https://dev-api.wedzat.com';
const MASTER_PLAYLISTS_ENDPOINT = '/hub/master-playlists';

// =================== TYPES ===================
interface Video {
  id: string;
  url: string;
}

interface VideoPositions {
  [key: string]: number;
}

interface NetworkSpeed {
  networkQuality: string;
  bandwidth: number;
  effectiveType: string;
}

interface VideoPlayerProps {
  src: string;
  isActive: boolean;
  shouldLoad: boolean;
  shouldPreload: boolean;
  onLoadedMetadata?: () => void;
  isPaused: boolean;
  onTogglePlay: () => void;
  networkQuality: string;
  videoId: string;
  videoIndex: number;
  currentIndex: number;
  savedPosition: number;
  onPositionUpdate?: (videoId: string, position: number) => void;
  onVideoReady?: (videoId: string, videoIndex: number) => void;
  direction: string;
}

interface APILoadingScreenProps {
  error: string | null;
}

interface IconProps {
  size?: number;
}

// =================== API UTILITIES ===================
const fetchVideosFromAPI = async (): Promise<Video[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}${MASTER_PLAYLISTS_ENDPOINT}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const videoUrls = await response.json();
    
    // Transform the API response to match our video structure
    const transformedVideos = videoUrls.map((url: string, index: number) => ({
      id: String(index + 1),
      url: url.trim(),
    }));

    console.log(`✅ Fetched ${transformedVideos.length} videos from API`);
    return transformedVideos;
  } catch (error) {
    console.error('❌ Failed to fetch videos from API:', error);
    throw error;
  }
};

// =================== URL PARAMETER UTILITIES ===================
const getUrlParams = (): { [key: string]: string } => {
  if (typeof window === 'undefined') return {};
  const urlParams = new URLSearchParams(window.location.search);
  return Object.fromEntries(urlParams.entries());
};

  const updateUrl = (videoId: string): void => {
    if (typeof window === 'undefined') return;
    const newUrl = `${window.location.pathname}?id=${videoId}`;
    // Use replaceState to avoid browser history entries and prevent reloads
    window.history.replaceState({ videoId }, '', newUrl);
  };const getCurrentVideoIdFromUrl = (videos: Video[]): string => {
  const params = getUrlParams();
  const urlId = params.id;
  
  if (urlId && videos.some(v => v.id === urlId)) {
    return urlId;
  }
  
  return videos.length > 0 ? videos[0].id : '1';
};

// =================== NETWORK SPEED DETECTOR ===================
const useNetworkSpeed = (): NetworkSpeed => {
  const [networkQuality, setNetworkQuality] = useState('high');
  const [bandwidth, setBandwidth] = useState(0);
  const [effectiveType, setEffectiveType] = useState('4g');

  useEffect(() => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    if (connection) {
      const updateConnectionStatus = () => {
        const downlink = connection.downlink || 10;
        const effectiveType = connection.effectiveType || '4g';
        
        setBandwidth(downlink);
        setEffectiveType(effectiveType);
        
        if (effectiveType === 'slow-2g' || effectiveType === '2g') {
          setNetworkQuality('low');
        } else if (effectiveType === '3g' || downlink < 1.5) {
          setNetworkQuality('medium');
        } else {
          setNetworkQuality('high');
        }
      };

      updateConnectionStatus();
      connection.addEventListener('change', updateConnectionStatus);
      
      return () => connection.removeEventListener('change', updateConnectionStatus);
    }
  }, []);

  return { networkQuality, bandwidth, effectiveType };
};

// =================== ICONS ===================
const ChevronUp: React.FC<IconProps> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"></polyline>
  </svg>
);

const ChevronDown: React.FC<IconProps> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

const PlayIcon: React.FC<IconProps> = ({ size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="white" opacity="0.9">
    <path d="M8 5v14l11-7z"/>
  </svg>
);

const PauseIcon: React.FC<IconProps> = ({ size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="white" opacity="0.9">
    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
  </svg>
);

const VolumeIcon: React.FC<IconProps> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
  </svg>
);

const VolumeMutedIcon: React.FC<IconProps> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
  </svg>
);

const LoadingSpinner: React.FC = () => (
  <div style={{
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 10
  }}>
    <div style={{
      width: '50px',
      height: '50px',
      border: '4px solid rgba(255, 255, 255, 0.3)',
      borderTop: '4px solid white',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
  </div>
);

// =================== API LOADING COMPONENT ===================
const APILoadingScreen: React.FC<APILoadingScreenProps> = ({ error }) => (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: '20px',
    zIndex: 100
  }}>
    {error ? (
      <>
        <div style={{ color: '#ef4444', fontSize: '18px', fontWeight: 'bold' }}>
          ❌ Failed to load videos
        </div>
        <div style={{ color: '#999', fontSize: '14px', textAlign: 'center', maxWidth: '400px' }}>
          {error}
        </div>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 24px',
            backgroundColor: '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </>
    ) : (
      <>
        <LoadingSpinner />
      </>
    )}
  </div>
);

// =================== VIDEO PLAYER COMPONENT ===================
const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  src, 
  isActive, 
  shouldLoad,
  shouldPreload,
  onLoadedMetadata, 
  isPaused, 
  onTogglePlay,
  networkQuality,
  videoId,
  videoIndex,
  currentIndex,
  savedPosition,
  onPositionUpdate,
  onVideoReady,
  direction
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showIcon, setShowIcon] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [currentQuality, setCurrentQuality] = useState<number | null>(null);
    const [bufferProgress, setBufferProgress] = useState(0);
    const [isPreloaded, setIsPreloaded] = useState(false);
    const [manifestLoaded, setManifestLoaded] = useState(false);
    const [segmentsReady, setSegmentsReady] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [hasResumed, setHasResumed] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(!isActive); // Start muted only if not active
    const [volume, setVolume] = useState(0.7);
    const [showVolumeControl, setShowVolumeControl] = useState(false);  // Play promise management to prevent interruption errors
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const lastSavedTimeRef = useRef(0);
  
  const initializationStateRef = useRef({
    hlsInitialized: false,
    segmentsLoaded: 0,
    isPreloadComplete: false,
    loadStarted: false
  });

  const getLoadingMode = (): string => {
    if (!shouldLoad && !shouldPreload) return 'none';
    if (shouldPreload) return 'preload';
    return 'full';
  };

  const loadingMode = getLoadingMode();

  const formatTime = (timeInSeconds: number): string => {
    if (!timeInSeconds || isNaN(timeInSeconds)) return '0:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Enhanced play function with promise management
  const attemptPlay = useCallback(async (): Promise<void> => {
    const video = videoRef.current;
    if (!video || !isActive || isPaused) {
      // If attempting to play while paused, ensure we're properly paused
      if (isPaused && video) {
        video.pause();
        setIsPlaying(false);
        setIsMuted(true);
        video.muted = true;
      }
      return;
    }

    try {
      // Clear any existing play promise
      if (playPromiseRef.current) {
        try { 
          await playPromiseRef.current; 
        } catch { 
          // Ignore errors from previous promise
        }
        playPromiseRef.current = null;
      }

      // Double-check pause state before attempting to play
      if (isPaused) {
        video.pause();
        setIsPlaying(false);
        setIsMuted(true);
        video.muted = true;
        return;
      }

      console.log(`[${videoId}] 🚀 Starting playback`);
      
      const playPromise = video.play();
      playPromiseRef.current = playPromise;

      await playPromise;
      
      // Only continue if still active and not paused
      if (isActive && !isPaused) {
        setIsPlaying(true);
        setIsMuted(false);
        video.muted = false;
        playPromiseRef.current = null;
        console.log(`[${videoId}] ✅ Playing successfully`);
      } else {
        // If conditions changed during play, pause immediately
        video.pause();
        setIsPlaying(false);
        setIsMuted(true);
        video.muted = true;
        console.log(`[${videoId}] ⏸️ Paused (state changed during play)`);
      }

    } catch (error: any) {
      playPromiseRef.current = null;
      setIsPlaying(false);
      setIsMuted(false);
      video.muted = false;
      
      if (error.name === 'AbortError') {
        console.log(`[${videoId}] Play was aborted, retrying...`);
        setTimeout(() => attemptPlay(), 200);
        return;
      }
      
      console.log(`[${videoId}] Play failed:`, error.message);
      
      // If autoplay is blocked, wait for user interaction
      if (error.name === 'NotAllowedError') {
        console.log(`[${videoId}] Autoplay blocked, waiting for user interaction`);
        // Don't retry automatically - wait for user click
      }
    }
  }, [videoId]);

  // Safe pause function
  const attemptPause = useCallback(async (): Promise<void> => {
    const video = videoRef.current;
    if (!video) return;

    try {
      // Wait for any pending play promise to resolve
      if (playPromiseRef.current) {
        video.pause();
        setIsPlaying(false);
        setIsMuted(true);
        video.muted = true; // Mute when not playing
        console.log(`[${videoId}] ⏸️ Paused`);
        playPromiseRef.current = null;
      }

      try {
        await video.pause();
        setIsPlaying(false);
        setIsMuted(true);
        video.muted = true;
        console.log(`[${videoId}] ⏸️ Paused`);
        
        // Save position when pausing
        if (video.currentTime > 0) {
          onPositionUpdate?.(videoId, video.currentTime);
        }
      } catch (err) {
        console.error(`[${videoId}] Error pausing:`, err);
      }
    } catch (error: any) {
      console.log(`[${videoId}] Pause error:`, error.message);
    }
  }, [videoId, onPositionUpdate]);

  // Fixed HLS config without problematic properties
  const getHlsConfig = useCallback((quality: string, mode: string): Partial<HlsConfig> => {
    const baseConfig: Partial<HlsConfig> = {
      debug: false,
      enableWorker: true,
      autoStartLoad: mode === 'full',
      
      maxBufferLength: mode === 'preload' ? 3 : 6,
      maxMaxBufferLength: mode === 'preload' ? 5 : 10,
      maxBufferSize: mode === 'preload' ? 2 * 1000 * 1000 : 4 * 1000 * 1000,
      maxBufferHole: 0.3,
      
      liveBackBufferLength: 5,

      startLevel: -1,
      
      abrEwmaDefaultEstimate: mode === 'preload' ? 300000 : 500000,
      abrEwmaFastLive: 3.0,
      abrEwmaSlowLive: 9.0,
      abrBandWidthFactor: 0.95,
      abrBandWidthUpFactor: 0.7,
      abrMaxWithRealBitrate: true,
      
      manifestLoadingTimeOut: 10000,
      manifestLoadingMaxRetry: 3,
      manifestLoadingRetryDelay: 1000,
      
      levelLoadingTimeOut: 10000,
      levelLoadingMaxRetry: 4,
      levelLoadingRetryDelay: 1000,
      
      fragLoadingTimeOut: 20000,
      fragLoadingMaxRetry: 6,
      fragLoadingRetryDelay: 1000,
      
      highBufferWatchdogPeriod: 2,
      nudgeMaxRetry: 3,
      
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 10,
    };

    if (quality === 'low') {
      return {
        ...baseConfig,
        maxBufferLength: mode === 'preload' ? 2 : 4,
        maxMaxBufferLength: mode === 'preload' ? 3 : 6,
        maxBufferSize: mode === 'preload' ? 1 * 1000 * 1000 : 2 * 1000 * 1000,
        abrEwmaDefaultEstimate: 300000,
      };
    } else if (quality === 'medium') {
      return {
        ...baseConfig,
        maxBufferLength: mode === 'preload' ? 3 : 5,
        maxMaxBufferLength: mode === 'preload' ? 4 : 8,
        maxBufferSize: mode === 'preload' ? 1.5 * 1000 * 1000 : 3 * 1000 * 1000,
        abrEwmaDefaultEstimate: 800000,
      };
    }
    
    return baseConfig;
  }, []);

  const handleVideoReady = useCallback((): void => {
    const video = videoRef.current;
    if (!video) return;

    console.log(`[${videoId}] Video ready - direction: ${direction}, savedPosition: ${savedPosition}`);

    // Always reset hasResumed when video becomes ready
    setHasResumed(false);
    
    // Only resume if going forward and has meaningful saved position
    const RESUME_THRESHOLD = 3;
    if (savedPosition && savedPosition > RESUME_THRESHOLD && isActive && direction === 'forward') {
      console.log(`[${videoId}] 💾 Resuming from ${formatTime(savedPosition)}`);
      
      const seekToPosition = (): void => {
        try {
          video.currentTime = savedPosition;
          setCurrentTime(savedPosition);
          setHasResumed(true);
          console.log(`[${videoId}] ✅ Successfully resumed from saved position`);
        } catch (err: any) {
          console.log(`[${videoId}] Resume failed:`, err.message);
          setHasResumed(true);
        }
      };

      if (video.readyState >= 2) {
        seekToPosition();
      } else {
        video.addEventListener('canplay', seekToPosition, { once: true });
      }
    } else {
      // Start from beginning
      if (video.readyState >= 2) {
        video.currentTime = 0;
        setCurrentTime(0);
      }
      setHasResumed(true);
      console.log(`[${videoId}] 🎬 Starting from beginning`);
    }
    
    onVideoReady?.(videoId, videoIndex);
  }, [savedPosition, videoId, videoIndex, hasResumed, isActive, onVideoReady, direction]);

  // Handle volume changes
  const handleVolumeChange = useCallback((newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
    video.volume = clampedVolume;
    
    if (clampedVolume > 0 && isMuted) {
      setIsMuted(false);
      video.muted = false;
    } else if (clampedVolume === 0 && !isMuted) {
      setIsMuted(true);
      video.muted = true;
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isMuted) {
      // Unmute and set to last volume
      setIsMuted(false);
      video.muted = false;
      video.volume = volume > 0 ? volume : 0.7;
      setVolume(video.volume);
    } else {
      // Mute
      setIsMuted(true);
      video.muted = true;
    }
    setShowVolumeControl(true);
    setTimeout(() => setShowVolumeControl(false), 2000);
  }, [isMuted, volume]);

  // Cleanup HLS on src change or unmount
  useEffect(() => {
    return () => {
      if (playPromiseRef.current) {
        playPromiseRef.current.catch(() => {});
        playPromiseRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      initializationStateRef.current = {
        hlsInitialized: false,
        segmentsLoaded: 0,
        isPreloadComplete: false,
        loadStarted: false
      };
    };
  }, [src]); // Added src dependency to cleanup on source change

  // Initialize HLS player
  useEffect(() => {
    const video = videoRef.current;
    if (!video || loadingMode === 'none') return;

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
      initializationStateRef.current = {
        hlsInitialized: false,
        segmentsLoaded: 0,
        isPreloadComplete: false,
        loadStarted: false
      };
    }

    const isHLS = src.includes('.m3u8');
    const isPreloadMode = loadingMode === 'preload';

    if (loadingMode === 'full' && !isPreloaded) {
      setIsLoading(true);
    }

    console.log(`[${videoId}] Initializing (${loadingMode})`);

    // Set video attributes for autoplay
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.crossOrigin = 'anonymous'; // Important for CORS
      video.volume = volume;
      
      // Only mute if not active or explicitly muted
      if (!isActive || isPaused) {
        video.muted = true;
        setIsMuted(true);
      } else {
        video.muted = false;
        setIsMuted(false);
      }    if (isHLS) {
      if (Hls.isSupported()) {
        const hls = new Hls(getHlsConfig(networkQuality, loadingMode));

        hls.loadSource(src);
        hls.attachMedia(video);

        let segmentCount = 0;

        const handleTimeUpdate = (): void => {
          const newTime = video.currentTime || 0;
          setCurrentTime(newTime);
          
          // Throttled position saving
          const currentTimeFloor = Math.floor(newTime);
          if (isActive && currentTimeFloor - lastSavedTimeRef.current >= 2) {
            lastSavedTimeRef.current = currentTimeFloor;
            onPositionUpdate?.(videoId, newTime);
          }
        };

        const handlePlay = (): void => {
          setIsPlaying(true);
          console.log(`[${videoId}] ▶️ HLS Started playing`);
        };

        const handlePause = (): void => {
          setIsPlaying(false);
          setIsPlaying(false);
         setIsMuted(true);
    video.muted = true;
          console.log(`[${videoId}] ⏸️ HLS Paused`);
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);

        hls.on(Hls.Events.FRAG_LOADING, (event, data) => {
          console.log(`[${videoId}] Loading segment ${data.frag.sn} (${loadingMode})`);
        });

        hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
          segmentCount++;
          initializationStateRef.current.segmentsLoaded = segmentCount;
          
          console.log(`[${videoId}] ✅ Segment ${data.frag.sn} loaded (total: ${segmentCount})`);
          
          if (isPreloadMode && segmentCount >= 1 && !initializationStateRef.current.isPreloadComplete) {
            setIsPreloaded(true);
            setSegmentsReady(true);
            initializationStateRef.current.isPreloadComplete = true;
            console.log(`[${videoId}] ✅ Preload complete`);
          }
          
          if (video.buffered.length > 0) {
            const buffered = video.buffered.end(0);
            const duration = video.duration || 1;
            setBufferProgress((buffered / duration) * 100);
          }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          console.log(`[${videoId}] ✅ Manifest parsed - ${data.levels.length} quality levels`);
          setManifestLoaded(true);
          setIsLoading(false);
          setDuration(video.duration || 0);
          onLoadedMetadata?.();
          
          if (isPreloadMode && data.levels.length > 0) {
            hls.currentLevel = 0;
            console.log(`[${videoId}] Using lowest quality for preload`);
          } else if (networkQuality === 'low' && data.levels.length > 0) {
            hls.currentLevel = 0;
          }
          
          if (isPreloadMode && !initializationStateRef.current.loadStarted) {
            console.log(`[${videoId}] Starting preload segments...`);
            hls.startLoad(0);
            initializationStateRef.current.loadStarted = true;
          }
          
          setSegmentsReady(true);
          handleVideoReady();
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
          const level = hls.levels[data.level];
          setCurrentQuality(level.height);
          console.log(`[${videoId}] Quality: ${level.height}p`);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.warn(`[${videoId}] HLS ERROR`, data);
          
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log(`[${videoId}] Network error, retrying...`);
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log(`[${videoId}] Media error, recovering...`);
                hls.recoverMediaError();
                break;
              default:
                console.error(`[${videoId}] Fatal error`);
                setError('Unable to load video');
                setIsLoading(false);
                hls.destroy();
                break;
            }
          }
        });

        hlsRef.current = hls;
        initializationStateRef.current.hlsInitialized = true;

        return () => {
          video.removeEventListener('timeupdate', handleTimeUpdate);
          video.removeEventListener('play', handlePlay);
          video.removeEventListener('pause', handlePause);
        };
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS support
        video.src = src;
        video.preload = isPreloadMode ? 'metadata' : 'auto';
        
        if (!isPreloadMode) {
          video.load();
        }
        
        const handleLoadedData = (): void => {
          setIsLoading(false);
          setSegmentsReady(true);
          if (isPreloadMode) {
            setIsPreloaded(true);
            console.log(`[${videoId}] ✅ Safari preload complete`);
          }
          handleVideoReady();
        };

        const handleLoadedMetadata = (): void => {
          setManifestLoaded(true);
          setDuration(video.duration || 0);
          onLoadedMetadata?.();
        };

        const handleTimeUpdate = (): void => {
          const newTime = video.currentTime || 0;
          setCurrentTime(newTime);
          
          // Throttled position saving
          const currentTimeFloor = Math.floor(newTime);
          if (isActive && currentTimeFloor - lastSavedTimeRef.current >= 2) {
            lastSavedTimeRef.current = currentTimeFloor;
            onPositionUpdate?.(videoId, newTime);
          }
        };

        const handlePlay = (): void => {
          setIsPlaying(true);
          console.log(`[${videoId}] ▶️ Started playing`);
        };

        const handlePause = (): void => {
          setIsPlaying(false);
          setIsPlaying(false);
         setIsMuted(true);
    video.muted = true;
          console.log(`[${videoId}] ⏸️ Paused`);
        };
        
        video.addEventListener('loadeddata', handleLoadedData);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        
        return () => {
          video.removeEventListener('loadeddata', handleLoadedData);
          video.removeEventListener('loadedmetadata', handleLoadedMetadata);
          video.removeEventListener('timeupdate', handleTimeUpdate);
          video.removeEventListener('play', handlePlay);
          video.removeEventListener('pause', handlePause);
        };
      } else {
        setError('HLS not supported');
        setIsLoading(false);
      }
    } else {
      // Regular video file
      video.src = src;
      video.preload = isPreloadMode ? 'metadata' : 'auto';
      if (!isPreloadMode) video.load();
      
      const handleLoadedData = (): void => {
        setIsLoading(false);
        setSegmentsReady(true);
        handleVideoReady();
      };

      const handleLoadedMetadata = (): void => {
        setManifestLoaded(true);
        setDuration(video.duration || 0);
        onLoadedMetadata?.();
      };

      const handleTimeUpdate = (): void => {
        const newTime = video.currentTime || 0;
        setCurrentTime(newTime);
        
        // Throttled position saving
        const currentTimeFloor = Math.floor(newTime);
        if (isActive && currentTimeFloor - lastSavedTimeRef.current >= 2) {
          lastSavedTimeRef.current = currentTimeFloor;
          onPositionUpdate?.(videoId, newTime);
        }
      };
      
      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('timeupdate', handleTimeUpdate);
      initializationStateRef.current.hlsInitialized = true;
      
      return () => {
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('timeupdate', handleTimeUpdate);
      };
    }
  }, [src, loadingMode, networkQuality, videoId, getHlsConfig, onLoadedMetadata, handleVideoReady, isActive, onPositionUpdate, isMuted, volume]);

  // Reset video state on navigation
  useEffect(() => {
    if (!isActive || !segmentsReady) return;
    
    setShowIcon(false);
    setIsPlaying(!isPaused);

    const video = videoRef.current;
    if (!video) return;

    // Pause video when not active
    if (!isActive) {
      attemptPause();
    }
    
    // Reset HLS loading if needed
    if (hlsRef.current && !initializationStateRef.current.loadStarted) {
      hlsRef.current.startLoad(0);
      initializationStateRef.current.loadStarted = true;
    }

    // Ensure video state matches isPaused
    if (isPaused && !video.paused) {
      attemptPause();
    } else if (!isPaused && video.paused && isActive) {
      attemptPlay();
    }
  }, [isActive, segmentsReady, isPaused, attemptPlay, attemptPause]);

  // Enhanced play/pause handling with promise management
  useEffect(() => {
    const video = videoRef.current;
    if (!video || loadingMode === 'none' || !manifestLoaded || !segmentsReady) return;

    const handlePlayPause = async (): Promise<void> => {
      // Force pause immediately if paused
      if (isPaused) {
        setIsPlaying(false);
        setIsMuted(true);
        video.muted = true;
        await video.pause();
        return;
      }

      // Only play if active, not paused, and has resumed
      if (isActive && !isPaused && hasResumed) {
        if (video.readyState >= 2) {
          if (!video.paused) {
            await video.pause();
          }
          await attemptPlay();
        } else {
          video.addEventListener('canplay', attemptPlay, { once: true });
        }
      } else {
        // Ensure pause in all other cases
        await attemptPause();
      }
    };

    // Immediate play/pause handling
    handlePlayPause();

    // Watch for video playing when it shouldn't be
    const handlePlay = async () => {
      if (isPaused || !isActive) {
        await video.pause();
        video.muted = true;
        setIsPlaying(false);
        setIsMuted(true);
      }
    };

    video.addEventListener('play', handlePlay);

    return () => {
      video.removeEventListener('play', handlePlay);
      // Ensure video is paused when unmounting or changing videos
      if (video) {
        video.pause();
        video.muted = true;
        setIsPlaying(false);
        setIsMuted(true);
      }
    };
  }, [isActive, isPaused, manifestLoaded, segmentsReady, hasResumed, attemptPlay, attemptPause]);

  // Buffer monitoring
  useEffect(() => {
    const video = videoRef.current;
    if (!video || loadingMode === 'none') return;

    const updateBuffer = (): void => {
      if (video.buffered.length > 0) {
        const buffered = video.buffered.end(0);
        const duration = video.duration || 1;
        const newProgress = (buffered / duration) * 100;
        
        if (Math.abs(newProgress - bufferProgress) > 1) {
          setBufferProgress(newProgress);
        }
      }
    };

    const interval = setInterval(updateBuffer, 2000);
    return () => clearInterval(interval);
  }, [videoId, loadingMode, bufferProgress]);

  const handleClick = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    onTogglePlay();
    setShowIcon(true);
    setTimeout(() => setShowIcon(false), 500);
  };

  if (error) {
    return (
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '12px',
        backgroundColor: '#000',
        color: '#ef4444',
        padding: '20px',
        textAlign: 'center'
      }}>
        <p style={{ fontSize: '16px' }}>{error}</p>
        <p style={{ fontSize: '12px', color: '#999' }}>Please check your connection</p>
      </div>
    );
  }
  return (
    <div 
      onClick={handleClick}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        cursor: 'pointer',
        backgroundColor: '#000'
      }}
    >
      <video
        ref={videoRef}
        playsInline
        loop
        muted={isMuted}
        autoPlay
        preload={loadingMode === 'preload' ? 'metadata' : 'auto'}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          backgroundColor: '#000'
        }}
      />
      
      {isLoading && !segmentsReady && <LoadingSpinner />}
      
      {loadingMode === 'preload' && isPreloaded && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          backgroundColor: 'rgba(34, 197, 94, 0.9)',
          color: 'white',
          padding: '6px 12px',
          borderRadius: '8px',
          fontSize: '11px',
          fontWeight: '700',
          zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          border: '1px solid rgba(34, 197, 94, 0.5)'
        }}>
          ⚡ Ready {savedPosition > 0 && direction === 'forward' && `@ ${formatTime(savedPosition)}`}
        </div>
      )}
      
      {showIcon && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          animation: 'fadeOut 0.5s ease-out',
          zIndex: 10
        }}>
          {isPaused || !isPlaying ? <PlayIcon /> : <PauseIcon />}
        </div>
      )}

      {/* Fixed play icon display - only show when paused AND not during temporary icon display */}
      {(isPaused || !isPlaying) && !showIcon && isActive && segmentsReady && !isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          opacity: 0.8,
          zIndex: 10
        }}>
          <PlayIcon />
        </div>
      )}

      {/* Volume Control */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        {showVolumeControl && (
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            style={{
              width: '80px',
              height: '4px',
              borderRadius: '2px',
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              outline: 'none',
              cursor: 'pointer'
            }}
          />
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleMute();
          }}
          style={{
            background: 'rgba(0, 0, 0, 0.7)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'white'
          }}
        >
          {isMuted ? <VolumeMutedIcon size={20} /> : <VolumeIcon size={20} />}
        </button>
      </div>

      {isActive && duration > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '60px',
          left: '20px',
          right: '20px',
          zIndex: 10
        }}>
          <div style={{
            height: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${(currentTime / duration) * 100}%`,
              backgroundColor: '#22c55e',
              transition: 'width 0.3s ease',
              borderRadius: '2px'
            }} />
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '4px',
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.8)',
            fontWeight: '600'
          }}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      )}

      {isActive && bufferProgress < 100 && loadingMode === 'full' && segmentsReady && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '2px',
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          zIndex: 10
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(bufferProgress, 100)}%`,
            backgroundColor: '#22c55e',
            transition: 'width 0.5s ease',
            boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)'
          }} />
        </div>
      )}

      {currentQuality && isActive && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '6px 12px',
          borderRadius: '8px',
          fontSize: '11px',
          fontWeight: '700',
          zIndex: 10,
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          {currentQuality}p
        </div>
      )}
    </div>
  );
};

// =================== MAIN COMPONENT WITH API INTEGRATION ===================
export default function ReelsPlayer() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoadingAPI, setIsLoadingAPI] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [direction, setDirection] = useState('forward');
  const [currentVideoId, setCurrentVideoId] = useState('1');
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isScrollingRef = useRef(false);
  const { networkQuality, bandwidth, effectiveType } = useNetworkSpeed();

  const videoPositionsRef = useRef<VideoPositions>({});
  const [videoPositions, setVideoPositions] = useState<VideoPositions>({});

  // Load videos from API on mount
  useEffect(() => {
    const loadVideos = async (): Promise<void> => {
      try {
        setIsLoadingAPI(true);
        setApiError(null);
        console.log('🔍 Fetching videos from API...');
        
        const fetchedVideos = await fetchVideosFromAPI();
        setVideos(fetchedVideos);
        
        // Initialize with URL parameter or default to first video
        const urlVideoId = getCurrentVideoIdFromUrl(fetchedVideos);
        const videoIndex = fetchedVideos.findIndex(v => v.id === urlVideoId);
        
        if (videoIndex !== -1) {
          setCurrentIndex(videoIndex);
          setCurrentVideoId(urlVideoId);
          console.log(`🎬 Initialized with video ID: ${urlVideoId} (index: ${videoIndex})`);
        } else {
          // If invalid ID in URL, default to first video and update URL
          setCurrentIndex(0);
          setCurrentVideoId(fetchedVideos[0].id);
          updateUrl(fetchedVideos[0].id);
          console.log(`⚠️ Invalid video ID in URL, defaulting to first video`);
        }
        
        setIsInitialized(true);
        console.log('✅ Reels Player initialized with API data');
        
      } catch (error: any) {
        console.error('❌ Failed to load videos from API:', error);
        setApiError(error.message);
      } finally {
        setIsLoadingAPI(false);
      }
    };

    loadVideos();
  }, []);

  // Listen for URL changes (back/forward navigation)
  useEffect(() => {
    if (videos.length === 0) return;

    const handlePopState = (): void => {
      const urlVideoId = getCurrentVideoIdFromUrl(videos);
      const videoIndex = videos.findIndex(v => v.id === urlVideoId);
      
      if (videoIndex !== -1 && videoIndex !== currentIndex) {
        const newDirection = videoIndex > currentIndex ? 'forward' : 'backward';
        setDirection(newDirection);
        setCurrentIndex(videoIndex);
        setCurrentVideoId(urlVideoId);
        setIsPaused(false);
        console.log(`🔗 URL changed to video ID: ${urlVideoId} (index: ${videoIndex})`);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentIndex, videos]);

  const handlePositionUpdate = useCallback((videoId: string, position: number): void => {
    const duration = videoPositionsRef.current[`${videoId}_duration`] || 0;
    
    if (duration > 0 && position > 5 && position < (duration - 5)) {
      videoPositionsRef.current[videoId] = position;
      videoPositionsRef.current[`${videoId}_duration`] = duration;
      setVideoPositions(prev => ({
        ...prev,
        [videoId]: position
      }));
      console.log(`[${videoId}] 💾 Position saved: ${Math.floor(position / 60)}:${(Math.floor(position % 60)).toString().padStart(2, '0')}`);
    }
  }, []);

  const handleVideoReady = useCallback((videoId: string, videoIndex: number): void => {
    console.log(`[${videoId}] Video ready for playback`);
  }, []);

  const getSavedPosition = useCallback((videoId: string): number => {
    const position = videoPositionsRef.current[videoId] || videoPositions[videoId] || 0;
    if (position < 2) {
      return 0;
    }
    return position;
  }, [videoPositions]);

  const shouldLoadVideo = useCallback((index: number): boolean => {
    return index === currentIndex;
  }, [currentIndex]);

  const shouldPreloadVideo = useCallback((index: number): boolean => {
    return index > currentIndex && index <= currentIndex + 2;
  }, [currentIndex]);

  // Navigate to specific video by ID
  const navigateToVideoId = useCallback((videoId: string, navigationDirection = 'forward'): void => {
    const videoIndex = videos.findIndex(v => v.id === videoId);
    if (videoIndex === -1) return;
    
    // Save current video position before navigating
    const currentVideo = containerRef.current?.querySelector(`[data-video-index="${currentIndex}"] video`) as HTMLVideoElement;
    if (currentVideo && currentVideo.currentTime > 0) {
      const currentVideoId = videos[currentIndex]?.id;
      if (currentVideoId) {
        handlePositionUpdate(currentVideoId, currentVideo.currentTime);
      }
    }
    
    setDirection(navigationDirection);
    setCurrentIndex(videoIndex);
    setCurrentVideoId(videoId);
    setIsPaused(false);
    
    // Update URL with video ID
    updateUrl(videoId);
    
    console.log(`🎬 Navigating to video ID: ${videoId} (index: ${videoIndex})`);
  }, [currentIndex, handlePositionUpdate, videos]);

  // Navigate to specific index (maintains original scroll behavior)
  const navigateToIndex = useCallback((index: number, navigationDirection = 'forward'): void => {
    if (index < 0 || index >= videos.length) return;
    
    const videoId = videos[index].id;
    navigateToVideoId(videoId, navigationDirection);
  }, [navigateToVideoId, videos]);

  useEffect(() => {
    if (videos.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      // Prevent default behavior for all our keyboard shortcuts
      if (['ArrowUp', 'ArrowDown', ' ', 'm', 'M'].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === 'ArrowUp') {
        navigateUp();
      } else if (e.key === 'ArrowDown') {
        navigateDown();
      } else if (e.key === ' ') {
        setIsPaused(prev => !prev);
      } else if (e.key === 'm' || e.key === 'M') {
        // Mute/unmute all videos
        const videos = containerRef.current?.querySelectorAll('video');
        videos?.forEach(video => {
          video.muted = !video.muted;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, videos]);

  useEffect(() => {
    if (videos.length === 0) return;

    const container = containerRef.current;
    if (!container) return;

    const handleScroll = (): void => {
      if (isScrollingRef.current) return;
      
      // Save current video position before changing
      const currentVideo = container.querySelector(`[data-video-index="${currentIndex}"] video`) as HTMLVideoElement;
      if (currentVideo && currentVideo.currentTime > 0) {
        const videoId = videos[currentIndex]?.id;
        if (videoId) {
          handlePositionUpdate(videoId, currentVideo.currentTime);
        }
      }
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        const scrollTop = container.scrollTop;
        const windowHeight = window.innerHeight;
        const newIndex = Math.round(scrollTop / windowHeight);
        
        if (newIndex !== currentIndex && newIndex >= 0 && newIndex < videos.length) {
          // Determine direction
          const newDirection = newIndex > currentIndex ? 'forward' : 'backward';
          const videoId = videos[newIndex].id;
          
          setDirection(newDirection);
          setCurrentIndex(newIndex);
          setCurrentVideoId(videoId);
          setIsPaused(false);
          
          // Update URL with new video ID
          updateUrl(videoId);
          
          console.log(`✅ ${newDirection} to video ${newIndex + 1} (ID: ${videoId})${getSavedPosition(videoId) > 0 && newDirection === 'forward' ? ' (resuming)' : ' (from start)'}`);
        }
      }, 80);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [currentIndex, handlePositionUpdate, getSavedPosition, videos]);

  const scrollToIndex = (index: number, e?: React.SyntheticEvent): void => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (index < 0 || index >= videos.length) return;
    
    // Determine direction
    const newDirection = index > currentIndex ? 'forward' : 'backward';
    
    // Save current video position before navigating
    const currentVideo = containerRef.current?.querySelector(`[data-video-index="${currentIndex}"] video`) as HTMLVideoElement;
    if (currentVideo && currentVideo.currentTime > 0) {
      const videoId = videos[currentIndex]?.id;
      if (videoId) {
        handlePositionUpdate(videoId, currentVideo.currentTime);
      }
    }
    
    isScrollingRef.current = true;
    const container = containerRef.current;
    const targetScroll = index * window.innerHeight;
    
    if (container) {
      container.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    }

    setTimeout(() => {
      isScrollingRef.current = false;
      const videoId = videos[index].id;
      setDirection(newDirection);
      setCurrentIndex(index);
      setCurrentVideoId(videoId);
      setIsPaused(false);
      
      // Update URL with new video ID
      updateUrl(videoId);
    }, 250);
  };

  const navigateUp = (): void => {
    if (currentIndex > 0) {
      scrollToIndex(currentIndex - 1);
    }
  };

  const navigateDown = (): void => {
    if (currentIndex < videos.length - 1) {
      scrollToIndex(currentIndex + 1);
    }
  };

  const handleTogglePlay = (e?: React.SyntheticEvent): void => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsPaused(prev => !prev);
  };

  // Show loading screen while fetching from API
  if (isLoadingAPI || videos.length === 0) {
    return <APILoadingScreen error={apiError} />;
  }

  return (
    <>
      {/* Global Styles */}
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          overflow: hidden;
          background: #000;
        }
        ::-webkit-scrollbar {
          display: none;
        }
        @keyframes fadeOut {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.2);
          }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Main Container */}
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          overflowY: 'scroll',
          overflowX: 'hidden',
          scrollSnapType: 'y mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          backgroundColor: '#000'
        }}
      >
        {videos.map((video, index) => (
          <div
            key={video.id}
            data-video-index={index}
            style={{
              position: 'relative',
              width: '100vw',
              height: '100vh',
              scrollSnapAlign: 'start',
              scrollSnapStop: 'always',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#000'
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#000'
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  maxWidth: 'calc(100vh * 9 / 16)',
                  aspectRatio: '9 / 16',
                  backgroundColor: '#000'
                }}
              >
                {isInitialized && (
                  <VideoPlayer
                    src={video.url}
                    isActive={index === currentIndex}
                    shouldLoad={shouldLoadVideo(index)}
                    shouldPreload={shouldPreloadVideo(index)}
                    onLoadedMetadata={() => console.log(`Video ${index + 1} ready`)}
                    isPaused={isPaused}
                    onTogglePlay={handleTogglePlay}
                    networkQuality={networkQuality}
                    videoId={video.id}
                    videoIndex={index}
                    currentIndex={currentIndex}
                    savedPosition={getSavedPosition(video.id)}
                    onPositionUpdate={handlePositionUpdate}
                    onVideoReady={handleVideoReady}
                    direction={direction}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* API Status Indicator */}
      

      {/* Network Quality Indicator */}

      {/* Navigation Buttons */}
      <div
        style={{
          position: 'fixed',
          right: 'max(16px, calc((100vw - calc(100vh * 9 / 16)) / 2 + 16px))',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          alignItems: 'center'
        }}
      >
        <button
          onClick={navigateUp}
          disabled={currentIndex === 0}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(12px)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
            opacity: currentIndex === 0 ? 0.3 : 1,
            transition: 'all 0.2s',
            WebkitBackdropFilter: 'blur(12px)'
          }}
        >
          <ChevronUp size={24} />
        </button>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxHeight: '320px',
          overflowY: 'auto',
          padding: '10px 0',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
        >
          {videos.map((video, index) => {
            const hasPosition = getSavedPosition(video.id) > 0;
            return (
              <button
                key={index}
                onClick={() => scrollToIndex(index)}
                style={{
                  width: index === currentIndex ? '14px' : '10px',
                  height: index === currentIndex ? '14px' : '10px',
                  borderRadius: '50%',
                  border: hasPosition && direction === 'forward' ? '2px solid #eab308' : 'none',
                  backgroundColor: index === currentIndex ? '#22c55e' : hasPosition && direction === 'forward' ? '#eab308' : 'rgba(255, 255, 255, 0.6)',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  padding: 0,
                  boxShadow: index === currentIndex 
                    ? '0 0 8px rgba(34, 197, 94, 0.6)' 
                    : hasPosition && direction === 'forward'
                      ? '0 0 6px rgba(234, 179, 8, 0.5)' 
                      : 'none'
                }}
              />
            );
          })}
        </div>

        <button
          onClick={navigateDown}
          disabled={currentIndex === videos.length - 1}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(12px)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: currentIndex === videos.length - 1 ? 'not-allowed' : 'pointer',
            opacity: currentIndex === videos.length - 1 ? 0.3 : 1,
            transition: 'all 0.2s',
            WebkitBackdropFilter: 'blur(12px)'
          }}
        >
          <ChevronDown size={24} />
        </button>
      </div>

      {/* Video Counter with ID Display */}

      {/* Pause State Indicator */}
      {isPaused && (
        <div
          style={{
            position: 'fixed',
            bottom: '30px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(12px)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '30px',
            fontSize: '13px',
            fontWeight: '700',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}
        >
          <PlayIcon size={20} />
          Tap to play
        </div>
      )}
    </>
  );
}