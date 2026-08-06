export function createSerialTaskQueue() {
  let pending: Promise<void> = Promise.resolve();

  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = pending.then(task, task);
    pending = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
