import { Vector } from '../core/Vector';

/**
 * Particle definition
 */
export interface Particle {
  position: Vector;
  velocity: Vector;
  acceleration: Vector;
  lifetime: number;
  maxLifetime: number;
  size: number;
  color: number;
  alpha: number;
  rotation: number;
}

/**
 * Particle emitter configuration
 */
export interface ParticleEmitterConfig {
  maxParticles: number;
  emissionRate: number; // particles per second
  lifetime: { min: number; max: number }; // milliseconds
  speed: { min: number; max: number };
  size: { min: number; max: number };
  color: number[];
  angle: { min: number; max: number }; // degrees
  gravity: number;
  friction: number;
}

/**
 * Particle Emitter
 */
export class ParticleEmitter {
  private particles: Particle[] = [];
  private config: ParticleEmitterConfig;
  private position: Vector;
  private emissionCounter: number = 0;
  private isActive: boolean = true;
  private lifetime: number = Infinity;
  private elapsedTime: number = 0;

  constructor(position: Vector, config: ParticleEmitterConfig) {
    this.position = position;
    this.config = config;
  }

  /**
   * Update emitter
   */
  update(deltaTime: number): void {
    this.elapsedTime += deltaTime;

    // Check if emitter lifetime exceeded
    if (this.elapsedTime > this.lifetime) {
      this.isActive = false;
    }

    // Emit new particles
    if (this.isActive) {
      this.emissionCounter += (this.config.emissionRate * deltaTime) / 1000;

      while (this.emissionCounter >= 1 && this.particles.length < this.config.maxParticles) {
        this.emissionCounter--;
        this.createParticle();
      }
    }

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];

      // Apply physics
      particle.velocity = particle.velocity.add(particle.acceleration.scale(deltaTime / 1000));
      particle.velocity = particle.velocity.scale(this.config.friction);
      particle.position = particle.position.add(particle.velocity.scale(deltaTime / 1000));

      // Update lifetime
      particle.lifetime -= deltaTime;
      particle.alpha = particle.lifetime / particle.maxLifetime;

      // Remove dead particles
      if (particle.lifetime <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * Create a single particle
   */
  private createParticle(): void {
    const angleRad =
      ((Math.random() * (this.config.angle.max - this.config.angle.min) + this.config.angle.min) *
        Math.PI) /
      180;
    const speed =
      Math.random() * (this.config.speed.max - this.config.speed.min) + this.config.speed.min;

    const lifetime =
      Math.random() * (this.config.lifetime.max - this.config.lifetime.min) +
      this.config.lifetime.min;
    const size =
      Math.random() * (this.config.size.max - this.config.size.min) + this.config.size.min;
    const color = this.config.color[Math.floor(Math.random() * this.config.color.length)];

    const particle: Particle = {
      position: this.position.clone(),
      velocity: new Vector(Math.cos(angleRad) * speed, Math.sin(angleRad) * speed),
      acceleration: new Vector(0, this.config.gravity),
      lifetime,
      maxLifetime: lifetime,
      size,
      color,
      alpha: 1,
      rotation: Math.random() * Math.PI * 2,
    };

    this.particles.push(particle);
  }

  /**
   * Get all particles
   */
  getParticles(): Particle[] {
    return this.particles;
  }

  /**
   * Check if emitter is active
   */
  isEmitterActive(): boolean {
    return this.isActive || this.particles.length > 0;
  }

  /**
   * Stop emitting new particles
   */
  stop(): void {
    this.isActive = false;
  }

  /**
   * Set emitter lifetime
   */
  setLifetime(lifetime: number): void {
    this.lifetime = lifetime;
  }

  /**
   * Get particle count
   */
  getParticleCount(): number {
    return this.particles.length;
  }
}

/**
 * Particle System Manager
 */
export class ParticleSystem {
  private emitters: Map<string, ParticleEmitter> = new Map();
  private lastId: number = 0;

  /**
   * Create emitter
   */
  createEmitter(position: Vector, config: ParticleEmitterConfig): string {
    const id = `emitter_${this.lastId++}`;
    this.emitters.set(id, new ParticleEmitter(position, config));
    return id;
  }

  /**
   * Get emitter by ID
   */
  getEmitter(id: string): ParticleEmitter | undefined {
    return this.emitters.get(id);
  }

  /**
   * Remove emitter
   */
  removeEmitter(id: string): void {
    this.emitters.delete(id);
  }

  /**
   * Update all emitters
   */
  update(deltaTime: number): void {
    for (const [id, emitter] of this.emitters.entries()) {
      emitter.update(deltaTime);

      // Remove inactive emitters
      if (!emitter.isEmitterActive()) {
        this.emitters.delete(id);
      }
    }
  }

  /**
   * Get all particles from all emitters
   */
  getAllParticles(): Particle[] {
    const particles: Particle[] = [];
    for (const emitter of this.emitters.values()) {
      particles.push(...emitter.getParticles());
    }
    return particles;
  }

  /**
   * Get active emitter count
   */
  getEmitterCount(): number {
    return this.emitters.size;
  }

  /**
   * Clear all emitters
   */
  clear(): void {
    this.emitters.clear();
  }
}

/**
 * Preset particle configurations
 */
export class ParticlePresets {
  static EXPLOSION: ParticleEmitterConfig = {
    maxParticles: 100,
    emissionRate: 500,
    lifetime: { min: 500, max: 1000 },
    speed: { min: 100, max: 300 },
    size: { min: 2, max: 8 },
    color: [0xff6600, 0xff8800, 0xffaa00],
    angle: { min: 0, max: 360 },
    gravity: 100,
    friction: 0.95,
  };

  static SPARK: ParticleEmitterConfig = {
    maxParticles: 50,
    emissionRate: 200,
    lifetime: { min: 300, max: 600 },
    speed: { min: 50, max: 150 },
    size: { min: 1, max: 3 },
    color: [0xffff00, 0xffaa00],
    angle: { min: 0, max: 360 },
    gravity: 200,
    friction: 0.9,
  };

  static BLOOD: ParticleEmitterConfig = {
    maxParticles: 30,
    emissionRate: 100,
    lifetime: { min: 800, max: 1500 },
    speed: { min: 30, max: 100 },
    size: { min: 1, max: 4 },
    color: [0x8b0000, 0xaa0000, 0xcc0000],
    angle: { min: 0, max: 360 },
    gravity: 150,
    friction: 0.92,
  };

  static HEAL: ParticleEmitterConfig = {
    maxParticles: 40,
    emissionRate: 150,
    lifetime: { min: 600, max: 1000 },
    speed: { min: 40, max: 120 },
    size: { min: 2, max: 5 },
    color: [0x00ff00, 0x00ff88, 0x00ffff],
    angle: { min: 0, max: 360 },
    gravity: 0,
    friction: 0.98,
  };

  static MAGIC: ParticleEmitterConfig = {
    maxParticles: 60,
    emissionRate: 200,
    lifetime: { min: 800, max: 1200 },
    speed: { min: 50, max: 200 },
    size: { min: 1, max: 4 },
    color: [0x0088ff, 0x00ffff, 0xff00ff],
    angle: { min: 0, max: 360 },
    gravity: 50,
    friction: 0.93,
  };

  static DUST: ParticleEmitterConfig = {
    maxParticles: 80,
    emissionRate: 300,
    lifetime: { min: 600, max: 1500 },
    speed: { min: 20, max: 80 },
    size: { min: 1, max: 3 },
    color: [0xaa8844, 0xccaa66, 0xddbb77],
    angle: { min: 0, max: 360 },
    gravity: -50, // Rising dust
    friction: 0.97,
  };
}
