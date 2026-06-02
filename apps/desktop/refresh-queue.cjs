function mergeChangesForRefresh(next, previous) {
  const merged = new Map();
  for (const change of next) {
    if (!change || typeof change.file !== "string") {
      continue;
    }
    merged.set(change.file, change);
  }
  for (const change of previous) {
    if (!change || typeof change.file !== "string" || merged.has(change.file)) {
      continue;
    }
    merged.set(change.file, change);
  }
  return [...merged.values()];
}

function createRefreshQueue(worker) {
  let inFlight = false;
  let queuedChanges = [];
  let queuedWaiters = [];
  let queuedRefreshRequested = false;

  const enqueue = async (changes = []) => {
    if (inFlight) {
      queuedChanges = mergeChangesForRefresh(changes, queuedChanges);
      if (changes.length === 0) {
        queuedRefreshRequested = true;
      }
      return new Promise((resolve, reject) => {
        queuedWaiters.push({ resolve, reject });
      });
    }

    inFlight = true;
    try {
      await worker(changes);
      while (queuedChanges.length > 0 || queuedRefreshRequested) {
        const nextChanges = queuedChanges;
        const waiters = queuedWaiters;
        queuedChanges = [];
        queuedWaiters = [];
        queuedRefreshRequested = false;
        try {
          await worker(nextChanges);
          for (const waiter of waiters) waiter.resolve();
        } catch (error) {
          for (const waiter of waiters) waiter.reject(error);
          throw error;
        }
      }
    } catch (error) {
      rejectQueued(error);
      throw error;
    } finally {
      inFlight = false;
    }
  };

  const cancelQueued = () => {
    const waiters = queuedWaiters;
    queuedWaiters = [];
    queuedChanges = [];
    queuedRefreshRequested = false;
    for (const waiter of waiters) waiter.resolve();
  };

  const rejectQueued = (error) => {
    const waiters = queuedWaiters;
    queuedWaiters = [];
    queuedChanges = [];
    queuedRefreshRequested = false;
    for (const waiter of waiters) waiter.reject(error);
  };

  return { cancelQueued, enqueue };
}

module.exports = {
  createRefreshQueue,
  mergeChangesForRefresh,
};
