"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';

// =================== API CONFIGURATION ===================
const API_BASE_URL = 'https://dev-api.wedzat.com';
const MASTER_PLAYLISTS_ENDPOINT = '/hub/master-playlists';

// =================== API UTILITIES ===================
const fetchVideosFromAPI = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}${MASTER_PLAYLISTS_ENDPOINT}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add any required headers like Authorization if needed
        // 'Authorization': 'Bearer your-token-here',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const videoUrls = await response.json();
    
    // Transform the API response to match our video structure
    // Assuming the API returns an array of URLs as shown in your Postman response
    const transformedVideos = videoUrls.map((url, index) => ({
      id: String(index + 1), // Generate sequential IDs
      url: url.trim(), // Remove any whitespace
    }));

    console.log(`âœ… Fetched ${transformedVideos.length} videos from API`);
    return transformedVideos;
  } catch (error) {
    console.error('âŒ Failed to fetch videos from API:', error);
    throw error; // Re-throw the error to be handled by the component
  }
};

// =================== URL PARAMETER UTILITIES ===================
const getUrlParams = () => {
  if (typeof window === 'undefined') return {};
  const urlParams = new URLSearchParams(window.location.search);
  return Object.fromEntries(urlParams.entries());
};

const updateUrl = (videoId) => {
  if (typeof window === 'undefined') return;
  const newUrl = `${window.location.pathname}?id=${videoId}`;
  window.history.replaceState(null, '', newUrl);
};

const getCurrentVideoIdFromUrl = (videos) => {
  const params = getUrlParams();
  const urlId = params.id;
  
  // Check if the ID from URL exists in our videos
  if (urlId && videos.some(v => v.id === urlId)) {
    return urlId;
  }
  
  // Default to first video if no valid ID in URL
  return videos.length > 0 ? videos[0].id : '1';
};

// =================== NETWORK SPEED DETECTOR ===================
const useNetworkSpeed = () => {
  const [networkQuality, setNetworkQuality] = useState('high');
  const [bandwidth, setBandwidth] = useState(0);
  const [effectiveType, setEffectiveType] = useState('4g');

  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
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
const ChevronUp = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"></polyline>
  </svg>
);

const ChevronDown = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

const PlayIcon = ({ size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="white" opacity="0.9">
    <path d="M8 5v14l11-7z"/>
  </svg>
);

const PauseIcon = ({ size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="white" opacity="0.9">
    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
  </svg>
);

const LoadingSpinner = () => (
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
const APILoadingScreen = ({ error }) => (
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
          âŒ Failed to load videos
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
        <div style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>
          Loading videos from API...
        </div>
        <div style={{ color: '#999', fontSize: '12px' }}>
          Fetching from {API_BASE_URL}{MASTER_PLAYLISTS_ENDPOINT}
        </div>
      </>
    )}
  </div>
);

// =================== VIDEO PLAYER COMPONENT ===================
const VideoPlayer = ({ 
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
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [error, setError] = useState(null);
  const [showIcon, setShowIcon] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuality, setCurrentQuality] = useState(null);
  const [bufferProgress, setBufferProgress] = useState(0);
  const [isPreloaded, setIsPreloaded] = useState(false);
  const [manifestLoaded, setManifestLoaded] = useState(false);
  const [segmentsReady, setSegmentsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasResumed, setHasResumed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Play promise management to prevent interruption errors
  const playPromiseRef = useRef(null);
  
  const initializationStateRef = useRef({
    hlsInitialized: false,
    segmentsLoaded: 0,
    isPreloadComplete: false,
    loadStarted: false
  });

  const getLoadingMode = () => {
    if (!shouldLoad && !shouldPreload) return 'none';
    if (shouldPreload) return 'preload';
    return 'full';
  };

  const loadingMode = getLoadingMode();

  const formatTime = (timeInSeconds) => {
    if (!timeInSeconds || isNaN(timeInSeconds)) return '0:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Enhanced play function with promise management
  const attemptPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video || playPromiseRef.current) return;

    try {
      // Set video attributes for better autoplay support
      video.muted = false;
      video.setAttribute('autoplay', '');
      video.setAttribute('playsinline', '');
      
      console.log(`[${videoId}] ðŸš€ Starting playback`);
      
      const playPromise = video.play();
      playPromiseRef.current = playPromise;

      await playPromise;
      
      setIsPlaying(true);
      playPromiseRef.current = null;
      
      console.log(`[${videoId}] âœ… Playing successfully`);

    } catch (error) {
      playPromiseRef.current = null;
      setIsPlaying(false);
      
      if (error.name === 'AbortError') {
        console.log(`[${videoId}] Play was aborted, retrying...`);
        // Retry after a short delay
        setTimeout(() => attemptPlay(), 200);
        return;
      }
      
      console.log(`[${videoId}] Play failed:`, error.message);
    }
  }, [videoId]);

  // Safe pause function
  const attemptPause = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      // Wait for any pending play promise to resolve
      if (playPromiseRef.current) {
        try {
          await playPromiseRef.current;
        } catch (err) {
          // Ignore promise rejection
        }
        playPromiseRef.current = null;
      }

      video.pause();
      setIsPlaying(false);
      console.log(`[${videoId}] â¸ï¸ Paused`);
      
      // Save position when pausing
      if (video.currentTime > 0) {
        onPositionUpdate?.(videoId, video.currentTime);
      }
    } catch (error) {
      console.log(`[${videoId}] Pause error:`, error.message);
    }
  }, [videoId, onPositionUpdate]);

  const getHlsConfig = useCallback((quality, mode) => {
    const baseConfig = {
      debug: false,
      enableWorker: true,
      lowLatencyMode: false,
      autoStartLoad: mode === 'full',
      
      maxBufferLength: mode === 'preload' ? 3 : 6,
      maxMaxBufferLength: mode === 'preload' ? 5 : 10,
      maxBufferSize: mode === 'preload' ? 2 * 1000 * 1000 : 4 * 1000 * 1000,
      maxBufferHole: 0.3,
      
      backBufferLength: 5,
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
      
      progressive: true,
      
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

  const handleVideoReady = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    console.log(`[${videoId}] Video ready - direction: ${direction}, savedPosition: ${savedPosition}`);

    // Always reset hasResumed when video becomes ready
    setHasResumed(false);
    
    // Only resume if going forward and has meaningful saved position
    if (savedPosition && savedPosition > 3 && isActive && direction === 'forward') {
      console.log(`[${videoId}] ðŸ”„ Resuming from ${formatTime(savedPosition)}`);
      
      const seekToPosition = () => {
        try {
          video.currentTime = savedPosition;
          setCurrentTime(savedPosition);
          setHasResumed(true);
        } catch (err) {
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
    }
    
    onVideoReady?.(videoId, videoIndex);
  }, [savedPosition, videoId, videoIndex, hasResumed, isActive, onVideoReady, direction]);

  // Initialize HLS player
  useEffect(() => {
    const video = videoRef.current;
    if (!video || loadingMode === 'none') return;

    if (initializationStateRef.current.hlsInitialized) {
      if (isActive && segmentsReady) {
        handleVideoReady();
      }
      return;
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
    video.muted = false;

    if (isHLS) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
        video.preload = isPreloadMode ? 'metadata' : 'auto';
        
        if (!isPreloadMode) {
          video.load();
        }
        
        const handleLoadedData = () => {
          setIsLoading(false);
          setSegmentsReady(true);
          if (isPreloadMode) {
            setIsPreloaded(true);
            console.log(`[${videoId}] âœ… Safari preload complete`);
          }
          handleVideoReady();
        };

        const handleLoadedMetadata = () => {
          setManifestLoaded(true);
          setDuration(video.duration || 0);
          onLoadedMetadata?.();
        };

        const handleTimeUpdate = () => {
          const newTime = video.currentTime || 0;
          setCurrentTime(newTime);
          
          if (isActive && Math.floor(newTime) % 2 === 0 && newTime > 0) {
            onPositionUpdate?.(videoId, newTime);
          }
        };

        const handlePlay = () => {
          setIsPlaying(true);
          console.log(`[${videoId}] â–¶ï¸ Started playing`);
        };

        const handlePause = () => {
          setIsPlaying(false);
          console.log(`[${videoId}] â¸ï¸ Paused`);
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
      } else if (Hls.isSupported()) {
        const hls = new Hls(getHlsConfig(networkQuality, loadingMode));

        hls.loadSource(src);
        hls.attachMedia(video);

        let segmentCount = 0;

        const handleTimeUpdate = () => {
          const newTime = video.currentTime || 0;
          setCurrentTime(newTime);
          
          if (isActive && Math.floor(newTime) % 2 === 0 && newTime > 0) {
            onPositionUpdate?.(videoId, newTime);
          }
        };

        const handlePlay = () => {
          setIsPlaying(true);
          console.log(`[${videoId}] â–¶ï¸ HLS Started playing`);
        };

        const handlePause = () => {
          setIsPlaying(false);
          console.log(`[${videoId}] â¸ï¸ HLS Paused`);
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
          
          console.log(`[${videoId}] âœ… Segment ${data.frag.sn} loaded (total: ${segmentCount})`);
          
          if (isPreloadMode && segmentCount >= 1 && !initializationStateRef.current.isPreloadComplete) {
            setIsPreloaded(true);
            setSegmentsReady(true);
            initializationStateRef.current.isPreloadComplete = true;
            console.log(`[${videoId}] âœ… Preload complete`);
          }
          
          if (video.buffered.length > 0) {
            const buffered = video.buffered.end(0);
            const duration = video.duration || 1;
            setBufferProgress((buffered / duration) * 100);
          }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          console.log(`[${videoId}] âœ… Manifest parsed - ${data.levels.length} quality levels`);
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
          
          setTimeout(() => {
            setSegmentsReady(true);
            handleVideoReady();
          }, 100);
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
          const level = hls.levels[data.level];
          setCurrentQuality(level.height);
          console.log(`[${videoId}] Quality: ${level.height}p`);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.warn(`[${videoId}] HLS Error:`, data.type, data.details);
          
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log(`[${videoId}] Network error, retrying...`);
                setTimeout(() => {
                  if (hls) hls.startLoad();
                }, 1000);
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
      } else {
        setError('HLS not supported');
        setIsLoading(false);
      }
    } else {
      video.src = src;
      video.preload = isPreloadMode ? 'metadata' : 'auto';
      if (!isPreloadMode) video.load();
      
      const handleLoadedData = () => {
        setIsLoading(false);
        setSegmentsReady(true);
        handleVideoReady();
      };
      
      video.addEventListener('loadeddata', handleLoadedData);
      initializationStateRef.current.hlsInitialized = true;
      
      return () => {
        video.removeEventListener('loadeddata', handleLoadedData);
      };
    }
  }, [src, loadingMode, networkQuality, videoId, getHlsConfig, onLoadedMetadata, handleVideoReady, isActive, segmentsReady, onPositionUpdate]);

  // Reset video state on navigation
  useEffect(() => {
    if (isActive && segmentsReady) {
      setShowIcon(false);
      setIsPlaying(!isPaused);
      
      // Reset HLS loading if needed
      if (hlsRef.current && !initializationStateRef.current.loadStarted) {
        hlsRef.current.startLoad(0);
        initializationStateRef.current.loadStarted = true;
      }
    }
  }, [isActive, segmentsReady, isPaused]);

  // Enhanced play/pause handling with promise management
  useEffect(() => {
    const video = videoRef.current;
    if (!video || loadingMode === 'none' || !manifestLoaded || !segmentsReady) return;

    const handlePlayPause = async () => {
      if (isActive && !isPaused && hasResumed) {
        // Only attempt play if video is fully ready
        if (video.readyState >= 2) {
          await attemptPlay();
        } else {
          video.addEventListener('canplay', attemptPlay, { once: true });
        }
      } else if (isActive && isPaused) {
        await attemptPause();
      } else if (!isActive) {
        // Pause when not active
        await attemptPause();
      }
    };

    const timeoutId = setTimeout(handlePlayPause, 100);
    return () => clearTimeout(timeoutId);
  }, [isActive, isPaused, manifestLoaded, segmentsReady, hasResumed, attemptPlay, attemptPause]);

  // Buffer monitoring
  useEffect(() => {
    const video = videoRef.current;
    if (!video || loadingMode === 'none') return;

    const updateBuffer = () => {
      if (video.buffered.length > 0) {
        const buffered = video.buffered.end(0);
        const current = video.currentTime;
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

  const handleClick = () => {
    onTogglePlay();
    setShowIcon(true);
    setTimeout(() => setShowIcon(false), 500);
  };

  // Cleanup on unmount
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
  }, []);

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

  if (loadingMode === 'none') {
    return (
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ color: '#666', fontSize: '14px' }}>Scroll to load</div>
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
        muted
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
          âš¡ Ready {savedPosition > 0 && direction === 'forward' && `@ ${formatTime(savedPosition)}`}
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
  const [videos, setVideos] = useState([]);
  const [isLoadingAPI, setIsLoadingAPI] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [direction, setDirection] = useState('forward');
  const [currentVideoId, setCurrentVideoId] = useState('1');
  const containerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const isScrollingRef = useRef(false);
  const { networkQuality, bandwidth, effectiveType } = useNetworkSpeed();

  interface VideoPositions {
    [key: string]: number;
  }
  
  const videoPositionsRef = useRef({});
  const [videoPositions, setVideoPositions] = useState({});

  // Load videos from API on mount
  useEffect(() => {
    const loadVideos = async () => {
      try {
        setIsLoadingAPI(true);
        setApiError(null);
        console.log('ðŸ”„ Fetching videos from API...');
        
        const fetchedVideos = await fetchVideosFromAPI();
        setVideos(fetchedVideos);
        
        // Initialize with URL parameter or default to first video
        const urlVideoId = getCurrentVideoIdFromUrl(fetchedVideos);
        const videoIndex = fetchedVideos.findIndex(v => v.id === urlVideoId);
        
        if (videoIndex !== -1) {
          setCurrentIndex(videoIndex);
          setCurrentVideoId(urlVideoId);
          console.log(`ðŸŽ¯ Initialized with video ID: ${urlVideoId} (index: ${videoIndex})`);
        } else {
          // If invalid ID in URL, default to first video and update URL
          setCurrentIndex(0);
          setCurrentVideoId(fetchedVideos[0].id);
          updateUrl(fetchedVideos[0].id);
          console.log(`âš ï¸ Invalid video ID in URL, defaulting to first video`);
        }
        
        setIsInitialized(true);
        console.log('âœ… Reels Player initialized with API data');
        
      } catch (error) {
        console.error('âŒ Failed to load videos from API:', error);
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

    const handlePopState = () => {
      const urlVideoId = getCurrentVideoIdFromUrl(videos);
      const videoIndex = videos.findIndex(v => v.id === urlVideoId);
      
      if (videoIndex !== -1 && videoIndex !== currentIndex) {
        const newDirection = videoIndex > currentIndex ? 'forward' : 'backward';
        setDirection(newDirection);
        setCurrentIndex(videoIndex);
        setCurrentVideoId(urlVideoId);
        setIsPaused(false);
        console.log(`ðŸ”„ URL changed to video ID: ${urlVideoId} (index: ${videoIndex})`);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentIndex, videos]);

  const handlePositionUpdate = useCallback((videoId, position) => {
    const duration = videoPositionsRef.current[`${videoId}_duration`] || 0;
    
    if (duration > 0 && position > 5 && position < (duration - 5)) {
      videoPositionsRef.current[videoId] = position;
      videoPositionsRef.current[`${videoId}_duration`] = duration;
      setVideoPositions(prev => ({
        ...prev,
        [videoId]: position
      }));
      console.log(`[${videoId}] ðŸ’¾ Position saved: ${Math.floor(position / 60)}:${(Math.floor(position % 60)).toString().padStart(2, '0')}`);
    }
  }, []);

  const handleVideoReady = useCallback((videoId, videoIndex) => {
    console.log(`[${videoId}] Video ready for playback`);
  }, []);

  const getSavedPosition = useCallback((videoId) => {
    const position = videoPositionsRef.current[videoId] || videoPositions[videoId] || 0;
    if (position < 2) {
      return 0;
    }
    return position;
  }, [videoPositions]);

  const shouldLoadVideo = useCallback((index) => {
    return index === currentIndex;
  }, [currentIndex]);

  const shouldPreloadVideo = useCallback((index) => {
    return index > currentIndex && index <= currentIndex + 2;
  }, [currentIndex]);

  // Navigate to specific video by ID
  const navigateToVideoId = useCallback((videoId, navigationDirection = 'forward') => {
    const videoIndex = videos.findIndex(v => v.id === videoId);
    if (videoIndex === -1) return;
    
    // Save current video position before navigating
    const currentVideo = containerRef.current?.querySelector(`[data-video-index="${currentIndex}"] video`);
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
    
    console.log(`ðŸŽ¯ Navigating to video ID: ${videoId} (index: ${videoIndex})`);
  }, [currentIndex, handlePositionUpdate, videos]);

  // Navigate to specific index (maintains original scroll behavior)
  const navigateToIndex = useCallback((index, navigationDirection = 'forward') => {
    if (index < 0 || index >= videos.length) return;
    
    const videoId = videos[index].id;
    navigateToVideoId(videoId, navigationDirection);
  }, [navigateToVideoId, videos]);

  useEffect(() => {
    if (videos.length === 0) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateUp();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateDown();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPaused(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, videos]);

  useEffect(() => {
    if (videos.length === 0) return;

    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isScrollingRef.current) return;
      
      // Save current video position before changing
      const currentVideo = container.querySelector(`[data-video-index="${currentIndex}"] video`);
      if (currentVideo && currentVideo.currentTime > 0) {
        const videoId = videos[currentIndex]?.id;
        if (videoId) {
          handlePositionUpdate(videoId, currentVideo.currentTime);
        }
      }
      
      clearTimeout(scrollTimeoutRef.current);
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
          
          console.log(`âœ… ${newDirection} to video ${newIndex + 1} (ID: ${videoId})${getSavedPosition(videoId) > 0 && newDirection === 'forward' ? ' (resuming)' : ' (from start)'}`);
        }
      }, 80);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeoutRef.current);
    };
  }, [currentIndex, handlePositionUpdate, getSavedPosition, videos]);

  const scrollToIndex = (index) => {
    if (index < 0 || index >= videos.length) return;
    
    // Determine direction
    const newDirection = index > currentIndex ? 'forward' : 'backward';
    
    // Save current video position before navigating
    const currentVideo = containerRef.current?.querySelector(`[data-video-index="${currentIndex}"] video`);
    if (currentVideo && currentVideo.currentTime > 0) {
      const videoId = videos[currentIndex]?.id;
      if (videoId) {
        handlePositionUpdate(videoId, currentVideo.currentTime);
      }
    }
    
    isScrollingRef.current = true;
    const container = containerRef.current;
    const targetScroll = index * window.innerHeight;
    
    container.scrollTo({
      top: targetScroll,
      behavior: 'smooth'
    });

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

  const navigateUp = () => {
    if (currentIndex > 0) {
      scrollToIndex(currentIndex - 1);
    }
  };

  const navigateDown = () => {
    if (currentIndex < videos.length - 1) {
      scrollToIndex(currentIndex + 1);
    }
  };

  const handleTogglePlay = () => {
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
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 50,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(12px)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: '#22c55e',
          boxShadow: '0 0 6px #22c55e'
        }} />
        API â€¢ {videos.length} videos
      </div>

      {/* Network Quality Indicator */}
      <div
        style={{
          position: 'fixed',
          top: '70px',
          right: '20px',
          zIndex: 50,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(12px)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: networkQuality === 'high' ? '#22c55e' : networkQuality === 'medium' ? '#eab308' : '#ef4444',
          boxShadow: `0 0 6px ${networkQuality === 'high' ? '#22c55e' : networkQuality === 'medium' ? '#eab308' : '#ef4444'}`
        }} />
        {effectiveType.toUpperCase()}
        {bandwidth > 0 && ` (${bandwidth.toFixed(1)} Mbps)`}
      </div>

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
      <div
        style={{
          position: 'fixed',
          top: '20px',
          left: 'max(20px, calc((100vw - calc(100vh * 9 / 16)) / 2 + 20px))',
          zIndex: 50,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(12px)',
          color: 'white',
          padding: '10px 18px',
          borderRadius: '24px',
          fontSize: '14px',
          fontWeight: '700',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{currentIndex + 1} / {videos.length}</span>
          <span style={{ color: '#60a5fa', fontSize: '12px' }}>ID: {currentVideoId}</span>
        </div>
        {getSavedPosition(videos[currentIndex]?.id) > 0 && direction === 'forward' && (
          <span style={{ marginLeft: '8px', color: '#eab308' }}>ðŸ”„</span>
        )}
        <span style={{ marginLeft: '8px', color: direction === 'forward' ? '#22c55e' : '#ff6b6b' }}>
          {direction === 'forward' ? 'â¬‡ï¸' : 'â¬†ï¸'}
        </span>
      </div>

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