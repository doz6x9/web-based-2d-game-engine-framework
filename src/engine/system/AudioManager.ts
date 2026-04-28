export class AudioManager {
  private bgm: HTMLAudioElement | null = null;

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
}