import { useCallback, useEffect, useRef, useState } from "react";
import {
  Globe,
  Landmark,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Timer,
  Volume2,
  X,
} from "lucide-react";

export default function POIDetailPanel({ poi, onClose, autoPlayTrigger = 0 }) {
  const audioRef = useRef(null);
  const speechRef = useRef(null);
  const progressRafRef = useRef(null);
  const playbackRateRef = useRef(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMarked, setIsMarked] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const descriptionText = poi.description || poi.descriptionVi || "";
  const descriptionLanguage = poi.description ? "en-US" : "vi-VN";

  const stopDescription = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    speechRef.current = null;
    setIsSpeaking(false);
  }, []);

  const speakDescription = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (!descriptionText.trim()) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(descriptionText);
    utterance.lang = descriptionLanguage;
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => {
      speechRef.current = null;
      setIsSpeaking(false);
    };
    utterance.onerror = () => {
      speechRef.current = null;
      setIsSpeaking(false);
    };

    speechRef.current = utterance;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [descriptionLanguage, descriptionText]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.log("Cannot play audio:", err);
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleSpeedChange = (speed) => {
    setPlaybackRate(speed);
    playbackRateRef.current = speed;
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleProgressChange = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleSkip = (seconds) => {
    if (!audioRef.current) return;

    const maxTime = Number.isFinite(audioRef.current.duration)
      ? audioRef.current.duration
      : Number.MAX_SAFE_INTEGER;
    const nextTime = Math.min(
      Math.max(audioRef.current.currentTime + seconds, 0),
      maxTime,
    );

    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleVolumeChange = (e) => {
    const nextVolume = Math.min(1, Math.max(0, parseFloat(e.target.value)));
    setVolume(nextVolume);

    if (audioRef.current) {
      audioRef.current.volume = nextVolume;
    }
  };

  const formatTime = (time) => {
    if (!time || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  useEffect(() => {
    if (!autoPlayTrigger || !audioRef.current) return;

    audioRef.current.playbackRate = playbackRateRef.current;
    audioRef.current
      .play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch(() => {
        setIsPlaying(false);
      });
  }, [autoPlayTrigger]);

  useEffect(() => {
    if (!isPlaying || !audioRef.current) {
      if (progressRafRef.current) {
        window.cancelAnimationFrame(progressRafRef.current);
        progressRafRef.current = null;
      }
      return undefined;
    }

    const tick = () => {
      if (!audioRef.current) return;

      setCurrentTime(audioRef.current.currentTime);
      progressRafRef.current = window.requestAnimationFrame(tick);
    };

    progressRafRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (progressRafRef.current) {
        window.cancelAnimationFrame(progressRafRef.current);
        progressRafRef.current = null;
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      stopDescription();
    };
  }, [stopDescription]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  const handleClose = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    stopDescription();
    onClose();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white shadow-2xl z-50 max-h-[90vh] overflow-y-auto">
      {/* Close Button */}
      <button
        onClick={handleClose}
        className="fixed right-5 top-24 z-70 bg-orange-500/70 hover:bg-orange-500/90 backdrop-blur-md text-white cursor-pointer rounded-full w-11 h-11 flex items-center justify-center shadow-xl ring-2 ring-white/85 transition poi-close-button-breathe"
        aria-label="Close POI panel"
      >
        <X size={20} />
      </button>

      {/* Hero Banner Image */}
      {poi.image && (
        <div className="w-full h-48 overflow-hidden">
          <img
            src={poi.image}
            alt={poi.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Content Container */}
      <div className="p-6">
        {/* Title and Badge */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Landmark className="text-orange-500" size={18} />
            <span className="text-orange-500 font-medium text-sm">
              Narration point
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{poi.name}</h1>
        </div>

        {/* Description */}
        <div className="mb-6 rounded-2xl bg-orange-50/70 border border-orange-100 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-600">
              Description voice
            </p>
            <button
              type="button"
              onClick={isSpeaking ? stopDescription : speakDescription}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                isSpeaking
                  ? "bg-slate-900 text-white"
                  : "bg-orange-500 text-white hover:bg-orange-600"
              }`}
            >
              <Volume2 size={14} />
              {isSpeaking ? "Stop voice" : "Read description"}
            </button>
          </div>
          <p className="text-gray-700 text-base leading-relaxed">
            {poi.description}
          </p>
        </div>

        {/* Language Indicator */}
        <div className="flex items-center gap-2 mb-6 pb-6 border-b border-gray-200">
          <Globe className="text-orange-500" size={16} />
          <span className="text-orange-500 font-medium text-sm">
            EN TRANSLATED
          </span>
        </div>

        {/* Timeline/Progress Bar */}
        <div className="mb-8">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleProgressChange}
            step="0.01"
            className="w-full h-3 bg-orange-200 rounded-lg appearance-none cursor-pointer accent-orange-500 transition-all duration-75"
          />
          <div className="flex justify-between text-sm text-gray-600 mt-2">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control Panel */}
        <div className="mb-8">
          {/* Speed Controls - Left Side */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => handleSpeedChange(0.8)}
              className={`px-3 py-1 rounded text-sm font-medium transition ${
                playbackRate === 0.8
                  ? "bg-orange-500 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              0.8x
            </button>
            <button
              onClick={() => handleSpeedChange(1)}
              className={`px-3 py-1 rounded text-sm font-medium transition ${
                playbackRate === 1
                  ? "bg-orange-500 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              1x
            </button>
            <button
              onClick={() => handleSpeedChange(1.5)}
              className={`px-3 py-1 rounded text-sm font-medium transition ${
                playbackRate === 1.5
                  ? "bg-orange-500 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              1.5x
            </button>
            <button
              onClick={() => handleSpeedChange(2)}
              className={`px-3 py-1 rounded text-sm font-medium transition ${
                playbackRate === 2
                  ? "bg-orange-500 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              2x
            </button>
          </div>

          {/* Large Play Button - Center */}
          <div className="flex justify-center mb-8">
            <button
              onClick={handlePlayPause}
              className={`relative rounded-full p-7 text-white shadow-xl transition active:scale-95 ${
                isPlaying
                  ? "bg-linear-to-br from-orange-500 to-orange-600 ring-8 ring-orange-200/60"
                  : "bg-linear-to-br from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700"
              }`}
              aria-label={isPlaying ? "Pause audio" : "Play audio"}
            >
              {isPlaying ? <Pause size={42} /> : <Play size={42} />}
            </button>
          </div>

          {/* Navigation and Extra Controls */}
          <div className="mb-6 grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleSkip(-5)}
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:text-orange-500"
              aria-label="Back 5 seconds"
            >
              <SkipBack size={18} />
            </button>
            <button
              type="button"
              onClick={() => handleSkip(-currentTime)}
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:text-orange-500"
              aria-label="Replay from start"
            >
              <Timer size={18} />
            </button>
            <button
              type="button"
              onClick={() => handleSkip(5)}
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:text-orange-500"
              aria-label="Forward 5 seconds"
            >
              <SkipForward size={18} />
            </button>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-orange-100 bg-orange-50/70 p-3">
            <Volume2 size={16} className="text-orange-600" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-orange-200 accent-orange-500"
              aria-label="Volume"
            />
            <span className="w-12 text-right text-xs font-semibold text-orange-700">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>

        {/* Stop & Mark Button */}
        <button
          onClick={() => setIsMarked(!isMarked)}
          className={`w-full py-3 rounded-lg font-medium transition ${
            isMarked
              ? "bg-orange-500 text-white"
              : "bg-gray-900 text-white hover:bg-gray-800"
          }`}
        >
          {isMarked ? "Marked" : "Stop & Mark"}
        </button>

        {/* Vietnamese Translation */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase">
            VI VĂN BẢN GỐC (TIẾNG VIỆT)
          </h3>
          <p className="text-gray-700 text-sm leading-relaxed">
            {poi.descriptionVi || poi.description}
          </p>
        </div>
      </div>

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      >
        <source src={poi.audioUrl} type="audio/mpeg" />
      </audio>
    </div>
  );
}
