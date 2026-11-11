// 효과음은 파일 없이 Web Audio로 합성한다. 끄기 설정은 브라우저에 저장한다.
type SoundName = "click" | "flip";

const STORAGE_KEY = "brain-arena-muted";
let muted = (() => { try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; } })();
let context: AudioContext | null = null;
let lastFlipAt = 0;

export const isMuted = () => muted;
export function setMuted(value: boolean) {
  muted = value;
  try { localStorage.setItem(STORAGE_KEY, value ? "1" : "0"); } catch { /* 저장이 막힌 환경에서는 이번 방문에만 적용한다 */ }
}

export function playSound(name: SoundName) {
  if (muted) return;
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
    const audio = context, now = audio.currentTime, gain = audio.createGain();
    gain.connect(audio.destination);
    if (name === "click") {
      const tone = audio.createOscillator();
      tone.type = "triangle";
      tone.frequency.setValueAtTime(720, now);
      tone.frequency.exponentialRampToValueAtTime(420, now + .05);
      gain.gain.setValueAtTime(.12, now);
      gain.gain.exponentialRampToValueAtTime(.001, now + .06);
      tone.connect(gain);
      tone.start(now);
      tone.stop(now + .07);
      return;
    }
    // 보드 16장이 함께 뒤집혀도 한 번만 들리게 한다.
    if (performance.now() - lastFlipAt < 150) return;
    lastFlipAt = performance.now();
    const length = .13, buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * length), audio.sampleRate), data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1;
    const noise = audio.createBufferSource(), filter = audio.createBiquadFilter();
    noise.buffer = buffer;
    filter.type = "bandpass";
    filter.Q.value = .9;
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(3200, now + length);
    gain.gain.setValueAtTime(.001, now);
    gain.gain.exponentialRampToValueAtTime(.22, now + .03);
    gain.gain.exponentialRampToValueAtTime(.001, now + length);
    noise.connect(filter);
    filter.connect(gain);
    noise.start(now);
  } catch { /* 소리를 낼 수 없는 환경에서는 조용히 넘어간다 */ }
}

/** 눌리는 모든 버튼에 클릭음을 붙인다. */
export function installClickSound() {
  document.addEventListener("click", event => {
    if (event.target instanceof Element && event.target.closest("button:not(:disabled)")) playSound("click");
  });
}
