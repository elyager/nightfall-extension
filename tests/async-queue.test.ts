import { describe, expect, it } from 'vitest';
import { createSerialTaskQueue } from '../utils/async-queue';

describe('serial task queue', () => {
  it('preserves invocation order when earlier writes are slower', async () => {
    const enqueue = createSerialTaskQueue();
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = enqueue(async () => {
      events.push('first:start');
      await firstGate;
      events.push('first:end');
    });
    const second = enqueue(async () => {
      events.push('second:start');
      events.push('second:end');
    });

    await Promise.resolve();
    expect(events).toEqual(['first:start']);
    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual([
      'first:start',
      'first:end',
      'second:start',
      'second:end',
    ]);
  });

  it('continues after a failed task', async () => {
    const enqueue = createSerialTaskQueue();
    await expect(enqueue(async () => Promise.reject(new Error('failed')))).rejects.toThrow(
      'failed',
    );
    await expect(enqueue(async () => 'saved')).resolves.toBe('saved');
  });
});
