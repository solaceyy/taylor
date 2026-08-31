import { useEffect, useMemo, useRef, useState } from "react";
import {
  DURATIONS,
  ROUND_ORDER,
  TRACK_AUDIO,
  TRACKS,
  fmtDuration,
  pickRoundSongs,
  type Difficulty,
  type Track,
} from "./tracks";

const MAX_ATTEMPTS = 6;
const MAX_MISTAKES = 3;

type Phase = "playing" | "roundWon" | "revealed" | "finished";

const DIFFICULTY_STYLES: Record<
  Difficulty,
  { pillActive: string; play: string; glow: string; text: string; bar: string }
> = {
  Easy: {
    pillActive: "bg-[#39FF14] text-black",
    play: "bg-[#39FF14]",
    glow: "shadow-[0_0_35px_rgba(57,255,20,0.65)]",
    text: "text-[#39FF14]",
    bar: "bg-[#39FF14]",
  },
  Medium: {
    pillActive: "bg-[#FFF700] text-black",
    play: "bg-[#FFF700]",
    glow: "shadow-[0_0_35px_rgba(255,247,0,0.6)]",
    text: "text-[#FFF700]",
    bar: "bg-[#FFF700]",
  },
  Hard: {
    pillActive: "bg-[#FF6A00] text-black",
    play: "bg-[#FF6A00]",
    glow: "shadow-[0_0_35px_rgba(255,106,0,0.6)]",
    text: "text-[#FF6A00]",
    bar: "bg-[#FF6A00]",
  },
  Expert: {
    pillActive: "bg-[#FF0033] text-black",
    play: "bg-[#FF0033]",
    glow: "shadow-[0_0_35px_rgba(255,0,51,0.65)]",
    text: "text-[#FF0033]",
    bar: "bg-[#FF0033]",
  },
  Impossible: {
    pillActive: "bg-[#BF00FF] text-black",
    play: "bg-[#BF00FF]",
    glow: "shadow-[0_0_35px_rgba(191,0,255,0.6)]",
    text: "text-[#BF00FF]",
    bar: "bg-[#BF00FF]",
  },
};

function toneFrequency(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 220 + (h % 6) * 55;
}

export default function App() {
  const [songs, setSongs] = useState<Track[]>(() => pickRoundSongs());
  const [roundIdx, setRoundIdx] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startOffsetRef = useRef<number | null>(null);
  const loadedSongIdRef = useRef<string | null>(null);

  const difficulty = ROUND_ORDER[roundIdx];
  const currentSong = songs[roundIdx];
  const durations = DURATIONS[difficulty];
  const currentDuration = durations[attempt];

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return TRACKS.filter((t) => t.title.toLowerCase().includes(q)).slice(0, 8);
  }, [query]);

  useEffect(() => {
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  // Lock in a single random start point per song — reused for every
  // play/skip within the round, only re-rolled when the round's song changes.
  useEffect(() => {
    startOffsetRef.current = null;
  }, [currentSong?.id]);

  function stopPlayback() {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    audioElRef.current?.pause();
    setIsPlaying(false);
  }

  function playSnippet() {
    if (!currentSong || phase !== "playing") return;
    stopPlayback();
    const url = TRACK_AUDIO[currentSong.id];
    setIsPlaying(true);

    if (url) {
      const el = audioElRef.current ?? new Audio();
      audioElRef.current = el;
      const longestDuration = Math.max(...durations);
      const doPlay = () => {
        if (startOffsetRef.current === null) {
          const dur = el.duration && isFinite(el.duration) ? el.duration : 30;
          const maxStart = Math.max(0, dur - longestDuration - 0.1);
          startOffsetRef.current = Math.random() * maxStart;
        }
        el.currentTime = startOffsetRef.current;
        el.play().catch(() => {});
        stopTimerRef.current = setTimeout(() => {
          el.pause();
          setIsPlaying(false);
        }, currentDuration * 1000);
      };
      if (loadedSongIdRef.current === currentSong.id && el.readyState >= 1) {
        doPlay();
      } else {
        loadedSongIdRef.current = currentSong.id;
        el.src = url;
        el.onloadedmetadata = doPlay;
      }
    } else {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = toneFrequency(currentSong.id);
      osc.type = "sine";
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
      gain.gain.setValueAtTime(0.15, ctx.currentTime + Math.max(0, currentDuration - 0.05));
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + currentDuration);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + currentDuration);
      stopTimerRef.current = setTimeout(() => setIsPlaying(false), currentDuration * 1000);
    }
  }

  function nextRoundOrFinish() {
    if (roundIdx + 1 >= ROUND_ORDER.length) {
      setPhase("finished");
    } else {
      setRoundIdx((r) => r + 1);
      setAttempt(0);
      setQuery("");
      setMessage(null);
      setPhase("playing");
    }
  }

  function restartWholeGame() {
    setSongs(pickRoundSongs());
    setRoundIdx(0);
    setAttempt(0);
    setScore(0);
    setMistakes(0);
    setQuery("");
    setMessage(null);
    setPhase("playing");
  }

  function submitGuess(picked: Track) {
    if (phase !== "playing" || !currentSong) return;
    stopPlayback();
    if (picked.id === currentSong.id) {
      setScore((s) => s + 1);
      setPhase("roundWon");
    } else {
      // Wrong guesses don't consume an attempt or extend the snippet — only
      // Skip does that. But 3 wrong guesses total (across the whole game,
      // regardless of which difficulty round it happens on) ends the game.
      const newMistakes = mistakes + 1;
      setQuery("");
      if (newMistakes >= MAX_MISTAKES) {
        setMistakes(newMistakes);
        setMessage(`Not quite. It was "${currentSong.title}".`);
        setPhase("revealed");
      } else {
        setMistakes(newMistakes);
        setMessage(`Not quite — try again or skip. (${newMistakes}/${MAX_MISTAKES} mistakes)`);
      }
    }
  }

  function skip() {
    if (phase !== "playing") return;
    stopPlayback();
    const nextAttempt = attempt + 1;
    if (nextAttempt >= MAX_ATTEMPTS) {
      setAttempt(MAX_ATTEMPTS - 1);
      setMessage(`It was "${currentSong.title}".`);
      setPhase("revealed");
    } else {
      setAttempt(nextAttempt);
      setMessage(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0c10] text-[#e9e9ee]">
      <main className="mx-auto max-w-xl px-4 pb-16 pt-10 text-center sm:px-6 sm:pb-24 sm:pt-16">
        <p className="text-xs font-semibold tracking-[0.25em] text-white/40">
          MUSIC GUESSING GAME · TAYLOR SWIFT EDITION
        </p>
        <p className="mt-3 text-sm text-white/60">
          Play 5 songs from Easy to Impossible. Guess each track and share your round score.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-1.5 sm:gap-2">
          {ROUND_ORDER.map((d, i) => (
            <span
              key={d}
              className={
                "rounded-full px-2.5 py-1.5 text-xs font-medium sm:px-4 sm:py-2 sm:text-sm " +
                (i === roundIdx
                  ? DIFFICULTY_STYLES[d].pillActive
                  : i < roundIdx
                    ? "bg-white/15 text-white/50"
                    : "bg-white/5 text-white/30")
              }
            >
              {d}
            </span>
          ))}
        </div>

        <div className="mt-6 flex gap-1">
          {ROUND_ORDER.map((d, i) => (
            <div
              key={i}
              className={
                "h-1.5 flex-1 rounded-full " +
                (i < roundIdx || phase === "finished"
                  ? DIFFICULTY_STYLES[d].bar
                  : i === roundIdx
                    ? "bg-blue-400"
                    : "bg-white/10")
              }
            />
          ))}
        </div>

        {phase === "finished" ? (
          <div className="mt-10 sm:mt-16">
            <p className="text-sm uppercase tracking-widest text-white/40">Round complete</p>
            <p className="mt-2 text-4xl font-bold">{score}/5</p>
            <p className="mt-2 text-white/60">songs guessed correctly</p>
            <button
              onClick={restartWholeGame}
              className="mt-8 rounded-full bg-emerald-400 px-6 py-3 font-semibold text-black"
            >
              Play again
            </button>
          </div>
        ) : (
          <>
            <div className="mt-10 flex items-center justify-center gap-4 sm:mt-16">
              <button
                onClick={playSnippet}
                disabled={phase !== "playing"}
                className={
                  "flex h-20 w-20 items-center justify-center rounded-full text-black disabled:opacity-40 " +
                  DIFFICULTY_STYLES[difficulty].play +
                  " " +
                  DIFFICULTY_STYLES[difficulty].glow
                }
                aria-label="Play snippet"
              >
                {isPlaying ? (
                  <div className="h-5 w-5 bg-black" />
                ) : (
                  <div className="ml-1 h-0 w-0 border-y-[12px] border-l-[20px] border-y-transparent border-l-black" />
                )}
              </button>
              <span className={"text-2xl font-semibold " + DIFFICULTY_STYLES[difficulty].text}>
                {fmtDuration(currentDuration)}
              </span>
            </div>

            {phase === "roundWon" && currentSong && (
              <div className="mt-8 flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
                  Correct · {difficulty}
                </p>
                <p className={"mt-2 text-5xl font-bold " + DIFFICULTY_STYLES[difficulty].text}>
                  +1
                </p>
                <p className="mt-1 text-sm text-white/50">
                  {attempt}/{MAX_ATTEMPTS} skips · Score: {score}/5
                </p>
                <img
                  src={currentSong.cover}
                  alt=""
                  className="mt-5 h-28 w-28 rounded-xl object-cover shadow-lg"
                />
                <p className="mt-4 text-xl font-semibold">{currentSong.title}</p>
                <p className="text-sm text-white/40">{currentSong.album}</p>
                <button
                  onClick={nextRoundOrFinish}
                  className={
                    "mt-5 rounded-full px-6 py-2.5 font-semibold text-black " +
                    (roundIdx + 1 >= ROUND_ORDER.length
                      ? "bg-white"
                      : DIFFICULTY_STYLES[ROUND_ORDER[roundIdx + 1]].play)
                  }
                >
                  {roundIdx + 1 >= ROUND_ORDER.length
                    ? "See your score"
                    : `Continue to ${ROUND_ORDER[roundIdx + 1]}`}
                </button>
              </div>
            )}

            {message && phase !== "roundWon" && (
              <p className="mt-4 text-sm text-white/60">{message}</p>
            )}

            <div className="relative mt-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <div className="relative flex-1">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search songs…"
                    disabled={phase !== "playing"}
                    className="w-full rounded-full bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-white/30 disabled:opacity-40 sm:px-5"
                  />
                  {suggestions.length > 0 && phase === "playing" && (
                    <ul className="absolute left-0 right-0 top-full z-10 mt-2 max-h-64 overflow-auto rounded-2xl bg-[#17181d] text-left shadow-xl">
                      {suggestions.map((t) => (
                        <li key={t.id}>
                          <button
                            onClick={() => submitGuess(t)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-white/5"
                          >
                            <img
                              src={t.cover}
                              alt=""
                              width={44}
                              height={44}
                              className="block aspect-square w-11 flex-none rounded-md object-cover"
                            />
                            <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 leading-tight">
                              <span className="block truncate">{t.title}</span>
                              <span className="block truncate text-xs text-white/30">{t.album}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  onClick={skip}
                  disabled={phase !== "playing"}
                  aria-label="Skip to a longer snippet"
                  className="flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-white/10 px-5 py-3 text-sm font-medium disabled:opacity-40"
                >
                  Skip
                  <svg
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M5 5v14l10-7L5 5z" fill="currentColor" />
                    <rect x="17" y="5" width="2.2" height="14" rx="0.5" fill="currentColor" />
                  </svg>
                </button>
              </div>
              <p className="mt-3 flex flex-wrap items-center justify-center gap-x-1.5 text-xs text-white/40">
                <span>{attempt}/{MAX_ATTEMPTS} skips</span>
                <span>·</span>
                <span>{mistakes}/{MAX_MISTAKES} mistakes</span>
                <span>·</span>
                <span>{difficulty}</span>
              </p>
            </div>

            {phase === "revealed" && (
              <div className="mt-8 flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-6">
                <img
                  src={currentSong.cover}
                  alt=""
                  className="h-24 w-24 rounded-xl object-cover shadow-lg"
                />
                <p className="mt-4 text-sm text-white/50">The song was</p>
                <p className="mt-1 text-xl font-semibold">{currentSong.title}</p>
                <p className="text-sm text-white/40">{currentSong.album}</p>
                <button
                  onClick={restartWholeGame}
                  className="mt-5 rounded-full bg-emerald-400 px-6 py-2.5 font-semibold text-black"
                >
                  Restart from Easy
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
