export class AudioManager {
  private bgm: HTMLAudioElement | null = null;
  private isMuted: boolean = false; // Added to track mute state

  constructor() {}

  /**
   * Plays a background music track, looping it indefinitely.
   * Handles browser autoplay block by waiting for user interaction if necessary.
   * @param url The path to the audio file
   * @param volume Volume from 0.0 to 1.0
   */
  public playBGM(url: string, volume: number = 0.3): void {
    // Stop any existing music first
    if (this.bgm) {
      this.bgm.pause();
    }

    this.bgm = new Audio(url);
    this.bgm.loop = true;
    this.bgm.volume = volume;
    this.bgm.muted = this.isMuted; // Ensure the new track respects current mute state

    // Attempt to play immediately
    this.bgm.play().catch((error) => {
      console.warn("Browser blocked autoplay. Waiting for user interaction...", error);

      // If blocked, wait for the user to click or press a key anywhere on the page
      const startAudio = () => {
        this.bgm?.play();
        window.removeEventListener('click', startAudio);
        window.removeEventListener('keydown', startAudio);
      };

      window.addEventListener('click', startAudio);
      window.addEventListener('keydown', startAudio);
    });
  }

  public stopBGM(): void {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm.currentTime = 0; // Reset to beginning
    }
  }

  public setVolume(volume: number): void {
    if (this.bgm) {
      this.bgm.volume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
    }
  }

  /**
   * Mutes or unmutes the audio
   * @param mute true to mute, false to unmute
   */
  public setMute(mute: boolean): void {
    this.isMuted = mute;
    if (this.bgm) {
      this.bgm.muted = this.isMuted;
    }
  }

  /**
   * Returns current mute state
   */
  public getMuted(): boolean {
    return this.isMuted;
  }
}