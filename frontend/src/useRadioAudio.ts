/* Shared live-radio playback: HLS (hls.js, Safari-native fallback, raw
   MP3 stream as last resort) with self-healing reconnect logic. */

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";

const HLS_URL = "/api/radio/hls/playlist.m3u8";
const RAW_URL = "/api/radio";

export function useRadioAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let destroyed = false;
    const startHls = () => {
      if (destroyed || !audioRef.current) return;
      const hls = new Hls({
        liveDurationInfinity: true,
        liveSyncDurationCount: 2,
        maxBufferLength: 90,
        fragLoadingMaxRetry: 5,
        manifestLoadingMaxRetry: 5,
      });
      hlsRef.current = hls;
      hls.loadSource(HLS_URL);
      hls.attachMedia(audioRef.current);
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad(); // transient network blip — just resume
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          // hard failure: tear down and rebuild after a beat
          hls.destroy();
          hlsRef.current = null;
          setTimeout(startHls, 1500);
        }
      });
    };

    if (Hls.isSupported()) {
      startHls();
    } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
      audio.src = HLS_URL; // native Safari HLS
    } else {
      audio.src = RAW_URL; // last resort: raw MP3 stream
    }

    return () => {
      destroyed = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, []);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play()
        .then(() => setPlaying(true))
        .catch((e) => setError(`Stream failed to start: ${e.message}`));
    } else {
      a.pause();
      setPlaying(false);
    }
  }, []);

  return { audioRef, playing, setPlaying, toggle, error };
}
