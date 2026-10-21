export const isVideoFile = (file: File): boolean => {
  if (!file) return false;
  if (typeof file.type === 'string' && file.type.startsWith('video/')) return true;
  const ext = (file.name || '').toLowerCase().split('.').pop();
  return ['mp4', 'mov', 'webm', 'm4v', '3gp', 'avi', 'mkv', 'quicktime'].includes(ext || '');
};

export const extractFramesFromVideo = (file: File, framesPerSecond: number = 1): Promise<File[]> => {
  return new Promise((resolve, reject) => {
    if (!file || !(file instanceof Blob)) {
      return reject(new Error("Neplatný súbor videa."));
    }

    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.src = url;
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    (video as any).webkitPlaysInline = true;
    video.crossOrigin = 'anonymous';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    const frames: File[] = [];
    const MAX_FRAMES = 15;
    let isCleanedUp = false;
    let started = false;

    const cleanup = () => {
      if (!isCleanedUp) {
        isCleanedUp = true;
        clearTimeout(overallTimeoutId);
        clearTimeout(loadFallbackTimeoutId);
        video.pause();
        video.removeAttribute('src');
        video.load();
        URL.revokeObjectURL(url);
      }
    };

    // Overall safety timeout (30 seconds)
    const overallTimeoutId = setTimeout(() => {
      if (frames.length > 0) {
        cleanup();
        resolve(frames);
      } else {
        cleanup();
        reject(new Error("Časový limit extrakcie videa vypršal."));
      }
    }, 30000);

    const captureCurrentFrame = (targetTimeSec: number): Promise<boolean> => {
      return new Promise((res) => {
        if (!ctx || isCleanedUp) return res(false);
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob && blob.size > 500 && !isCleanedUp) {
              const frameFile = new File(
                [blob], 
                `${file.name.replace(/\.[^/.]+$/, '')}_frame_${targetTimeSec.toFixed(1)}s.jpg`, 
                { type: 'image/jpeg', lastModified: Date.now() }
              );
              frames.push(frameFile);
              res(true);
            } else {
              res(false);
            }
          }, 'image/jpeg', 0.88);
        } catch (e) {
          console.warn("Could not capture frame to canvas", e);
          res(false);
        }
      });
    };

    const seekToTime = (targetTime: number): Promise<void> => {
      return new Promise((res) => {
        if (isCleanedUp) return res();
        let seekTimer: any = null;

        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          if (seekTimer) clearTimeout(seekTimer);
          res();
        };

        video.addEventListener('seeked', onSeeked, { once: true });

        // Safety fallback if seeked doesn't fire within 1.5s
        seekTimer = setTimeout(() => {
          video.removeEventListener('seeked', onSeeked);
          res();
        }, 1500);

        try {
          video.currentTime = Math.max(0, targetTime);
        } catch {
          res();
        }
      });
    };

    const startExtraction = async () => {
      if (started || isCleanedUp) return;
      started = true;
      clearTimeout(loadFallbackTimeoutId);

      try {
        let duration = video.duration;
        if (!isFinite(duration) || isNaN(duration) || duration <= 0) {
          duration = 8;
        }

        let width = video.videoWidth || 1280;
        let height = video.videoHeight || 720;
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1080;

        if (width > MAX_WIDTH) {
          height = Math.round(height * (MAX_WIDTH / width));
          width = MAX_WIDTH;
        }
        if (height > MAX_HEIGHT) {
          width = Math.round(width * (MAX_HEIGHT / height));
          height = MAX_HEIGHT;
        }

        canvas.width = Math.max(320, width);
        canvas.height = Math.max(240, height);

        // 1. Capture the initial frame directly (video is ready at t = 0)
        await captureCurrentFrame(0);

        // 2. Compute sequence of subsequent timestamps
        const effectiveFps = Math.max(0.2, framesPerSecond);
        const step = Math.max(1, duration / Math.min(MAX_FRAMES, Math.max(3, Math.round(duration * effectiveFps))));

        for (let t = step; t < duration - 0.05 && frames.length < MAX_FRAMES; t += step) {
          if (isCleanedUp) break;
          await seekToTime(t);
          await captureCurrentFrame(t);
        }

        cleanup();
        if (frames.length > 0) {
          resolve(frames);
        } else {
          reject(new Error("Z videa sa nepodarilo extrahovať žiadne snímky."));
        }
      } catch (err: any) {
        cleanup();
        if (frames.length > 0) {
          resolve(frames);
        } else {
          reject(err);
        }
      }
    };

    const handleReady = () => {
      if (!started && !isCleanedUp) {
        startExtraction();
      }
    };

    video.addEventListener('loadeddata', handleReady, { once: true });
    video.addEventListener('canplay', handleReady, { once: true });
    video.addEventListener('canplaythrough', handleReady, { once: true });
    video.addEventListener('loadedmetadata', () => {
      setTimeout(() => {
        if (!started && video.readyState >= 1) {
          startExtraction();
        }
      }, 300);
    }, { once: true });

    video.addEventListener('error', () => {
      if (frames.length > 0) {
        cleanup();
        resolve(frames);
      } else {
        cleanup();
        reject(new Error("Prehliadač nedokázal dekódovať formát tohto videa."));
      }
    }, { once: true });

    // Fallback trigger if events don't fire within 12 seconds
    const loadFallbackTimeoutId = setTimeout(() => {
      if (!started && !isCleanedUp) {
        if (video.readyState >= 1 || video.videoWidth > 0) {
          startExtraction();
        } else if (frames.length > 0) {
          cleanup();
          resolve(frames);
        } else {
          cleanup();
          reject(new Error("Video sa nepodarilo načítať v stanovenom čase."));
        }
      }
    }, 12000);

    try {
      video.load();
    } catch {
      // Ignore load trigger error
    }
  });
};

