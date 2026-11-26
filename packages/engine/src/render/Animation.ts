/**
 * Animation frame definition
 */
export interface AnimationFrame {
  spriteId: string;
  duration: number; // milliseconds
}

/**
 * Animation definition
 */
export interface AnimationDefinition {
  name: string;
  frames: AnimationFrame[];
  loop: boolean;
  speed: number; // playback speed multiplier
}

/**
 * Animatable object interface
 */
export interface IAnimatable {
  setCurrentSprite(spriteId: string): void;
  getAnimationState(): string;
}

/**
 * Animation Controller for individual objects
 */
export class AnimationController {
  private currentAnimation: AnimationDefinition | null = null;
  private currentFrameIndex: number = 0;
  private elapsedTime: number = 0;
  private isPlaying: boolean = false;
  private animatable: IAnimatable;

  constructor(animatable: IAnimatable) {
    this.animatable = animatable;
  }

  /**
   * Play animation
   */
  play(animation: AnimationDefinition, forceRestart: boolean = false): void {
    if (this.currentAnimation === animation && !forceRestart) return;

    this.currentAnimation = animation;
    this.currentFrameIndex = 0;
    this.elapsedTime = 0;
    this.isPlaying = true;

    this.updateCurrentFrame();
  }

  /**
   * Pause animation
   */
  pause(): void {
    this.isPlaying = false;
  }

  /**
   * Resume animation
   */
  resume(): void {
    this.isPlaying = true;
  }

  /**
   * Stop animation
   */
  stop(): void {
    this.isPlaying = false;
    this.currentAnimation = null;
    this.currentFrameIndex = 0;
    this.elapsedTime = 0;
  }

  /**
   * Update animation
   */
  update(deltaTime: number): void {
    if (!this.isPlaying || !this.currentAnimation) return;

    this.elapsedTime += deltaTime * this.currentAnimation.speed;

    const currentFrame = this.currentAnimation.frames[this.currentFrameIndex];
    if (this.elapsedTime >= currentFrame.duration) {
      this.elapsedTime -= currentFrame.duration;
      this.currentFrameIndex++;

      // Handle looping
      if (this.currentFrameIndex >= this.currentAnimation.frames.length) {
        if (this.currentAnimation.loop) {
          this.currentFrameIndex = 0;
        } else {
          this.stop();
          return;
        }
      }

      this.updateCurrentFrame();
    }
  }

  /**
   * Update current sprite
   */
  private updateCurrentFrame(): void {
    if (!this.currentAnimation) return;

    const frame = this.currentAnimation.frames[this.currentFrameIndex];
    this.animatable.setCurrentSprite(frame.spriteId);
  }

  /**
   * Get current animation name
   */
  getCurrentAnimationName(): string {
    return this.currentAnimation?.name || 'none';
  }

  /**
   * Check if animation is playing
   */
  isAnimationPlaying(): boolean {
    return this.isPlaying && this.currentAnimation !== null;
  }
}

/**
 * Animation Library for managing animation definitions
 */
export class AnimationLibrary {
  private animations: Map<string, AnimationDefinition> = new Map();

  /**
   * Register animation
   */
  register(animation: AnimationDefinition): void {
    this.animations.set(animation.name, animation);
  }

  /**
   * Get animation by name
   */
  get(name: string): AnimationDefinition | undefined {
    return this.animations.get(name);
  }

  /**
   * Create default animations for a sprite
   */
  createDefaultAnimations(spriteId: string): void {
    // Idle animation
    this.register({
      name: `${spriteId}_idle`,
      frames: [
        { spriteId: `${spriteId}_idle_0`, duration: 300 },
        { spriteId: `${spriteId}_idle_1`, duration: 300 },
      ],
      loop: true,
      speed: 1,
    });

    // Walk animation
    this.register({
      name: `${spriteId}_walk`,
      frames: [
        { spriteId: `${spriteId}_walk_0`, duration: 150 },
        { spriteId: `${spriteId}_walk_1`, duration: 150 },
        { spriteId: `${spriteId}_walk_2`, duration: 150 },
        { spriteId: `${spriteId}_walk_3`, duration: 150 },
      ],
      loop: true,
      speed: 1,
    });

    // Attack animation
    this.register({
      name: `${spriteId}_attack`,
      frames: [
        { spriteId: `${spriteId}_attack_0`, duration: 100 },
        { spriteId: `${spriteId}_attack_1`, duration: 100 },
        { spriteId: `${spriteId}_attack_2`, duration: 100 },
      ],
      loop: false,
      speed: 1,
    });

    // Damage animation
    this.register({
      name: `${spriteId}_damage`,
      frames: [
        { spriteId: `${spriteId}_damage_0`, duration: 75 },
        { spriteId: `${spriteId}_damage_0`, duration: 75 },
        { spriteId: `${spriteId}_idle_0`, duration: 75 },
      ],
      loop: false,
      speed: 1,
    });
  }

  /**
   * Create transition animation
   */
  createTransition(
    spriteId: string,
    name: string,
    frames: string[],
    frameDuration: number = 100
  ): void {
    this.register({
      name,
      frames: frames.map((frameId) => ({
        spriteId: frameId,
        duration: frameDuration,
      })),
      loop: false,
      speed: 1,
    });
  }
}

/**
 * Tween animation for smooth position/scale/rotation changes
 */
export class Tween {
  private startValue: number;
  private endValue: number;
  private duration: number;
  private elapsedTime: number = 0;
  private isComplete: boolean = false;
  private onUpdate: (value: number) => void;
  private onComplete: (() => void) | null = null;
  private easing: (t: number) => number;

  constructor(
    startValue: number,
    endValue: number,
    duration: number,
    onUpdate: (value: number) => void,
    easing: (t: number) => number = Tween.linear
  ) {
    this.startValue = startValue;
    this.endValue = endValue;
    this.duration = duration;
    this.onUpdate = onUpdate;
    this.easing = easing;
  }

  /**
   * Update tween
   */
  update(deltaTime: number): void {
    if (this.isComplete) return;

    this.elapsedTime += deltaTime;
    let progress = this.elapsedTime / this.duration;

    if (progress >= 1) {
      progress = 1;
      this.isComplete = true;
    }

    const easedProgress = this.easing(progress);
    const currentValue =
      this.startValue + (this.endValue - this.startValue) * easedProgress;
    this.onUpdate(currentValue);

    if (this.isComplete && this.onComplete) {
      this.onComplete();
    }
  }

  /**
   * Check if complete
   */
  isFinished(): boolean {
    return this.isComplete;
  }

  /**
   * Set completion callback
   */
  onFinish(callback: () => void): void {
    this.onComplete = callback;
  }

  /**
   * Easing functions
   */
  static linear(t: number): number {
    return t;
  }

  static easeInQuad(t: number): number {
    return t * t;
  }

  static easeOutQuad(t: number): number {
    return t * (2 - t);
  }

  static easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  static easeInCubic(t: number): number {
    return t * t * t;
  }

  static easeOutCubic(t: number): number {
    return 1 + (t - 1) * (t - 1) * (t - 1);
  }

  static easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 + (t - 1) * (2 * (t - 2)) * (2 * (t - 2));
  }
}

/**
 * Tween Manager for managing multiple tweens
 */
export class TweenManager {
  private tweens: Tween[] = [];

  /**
   * Create and add tween
   */
  addTween(tween: Tween): Tween {
    this.tweens.push(tween);
    return tween;
  }

  /**
   * Update all tweens
   */
  update(deltaTime: number): void {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      this.tweens[i].update(deltaTime);
      if (this.tweens[i].isFinished()) {
        this.tweens.splice(i, 1);
      }
    }
  }

  /**
   * Get active tween count
   */
  getActiveTweenCount(): number {
    return this.tweens.length;
  }

  /**
   * Clear all tweens
   */
  clear(): void {
    this.tweens = [];
  }
}
