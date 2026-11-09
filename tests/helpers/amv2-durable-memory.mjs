import { AMV2_DURABLE_STORES } from "../../lib/amv2/durable-local-store.mjs";

const STORE_NAMES = Object.values(AMV2_DURABLE_STORES);
const clone = (value) => structuredClone(value);

function recordKey(store, value) {
  if (store === AMV2_DURABLE_STORES.ownerMeta) return value.scope;
  if (store === AMV2_DURABLE_STORES.workoutDays) return [value.scope, value.date];
  if (store === AMV2_DURABLE_STORES.personalExercises) return [value.scope, value.id];
  if (store === AMV2_DURABLE_STORES.outbox || store === AMV2_DURABLE_STORES.conflicts) {
    return [value.scope, value.operationKey];
  }
  if (store === AMV2_DURABLE_STORES.importBatches) return [value.scope, value.id];
  if (store === AMV2_DURABLE_STORES.localOnly) return [value.scope, value.identity];
  return value.id;
}

const serializedKey = (key) => JSON.stringify(key);

function cloneStores(source, selected) {
  const next = new Map(source);
  selected.forEach((store) => {
    next.set(store, new Map([...source.get(store).entries()].map(([key, value]) => [key, clone(value)])));
  });
  return next;
}

export function createAmv2DurableMemoryBackend() {
  let stores = new Map(STORE_NAMES.map((name) => [name, new Map()]));
  let failure = null;

  const backend = {
    failNext(predicate = () => true, error = new Error("Injected durable storage failure")) {
      failure = { predicate, error };
    },
    clearFailure() {
      failure = null;
    },
    snapshot(store) {
      return [...stores.get(store).values()].map(clone);
    },
    seed(store, value) {
      stores.get(store).set(serializedKey(recordKey(store, value)), clone(value));
    },
    async runTransaction(storeNames, mode, callback) {
      const transactionStores = mode === "readwrite" ? cloneStores(stores, storeNames) : stores;
      const maybeFail = (action, store, value) => {
        if (!failure || !failure.predicate({ action, store, value })) return;
        const { error } = failure;
        failure = null;
        throw error;
      };
      const tx = {
        async get(store, key) {
          maybeFail("get", store, key);
          const value = transactionStores.get(store).get(serializedKey(key));
          return value === undefined ? undefined : clone(value);
        },
        async put(store, value) {
          maybeFail("put", store, value);
          transactionStores.get(store).set(serializedKey(recordKey(store, value)), clone(value));
        },
        async delete(store, key) {
          maybeFail("delete", store, key);
          transactionStores.get(store).delete(serializedKey(key));
        },
        async getAllByScope(store, scope) {
          maybeFail("getAllByScope", store, scope);
          return [...transactionStores.get(store).values()]
            .filter((value) => value.scope === scope)
            .map(clone);
        },
        async getWorkoutDays(scope, startDate, endDate) {
          maybeFail("getWorkoutDays", AMV2_DURABLE_STORES.workoutDays, { scope, startDate, endDate });
          return [...transactionStores.get(AMV2_DURABLE_STORES.workoutDays).values()]
            .filter((value) => value.scope === scope && value.date >= startDate && value.date <= endDate)
            .sort((left, right) => left.date.localeCompare(right.date, "en"))
            .map(clone);
        },
        async deleteByScope(store, scope) {
          maybeFail("deleteByScope", store, scope);
          for (const [key, value] of transactionStores.get(store)) {
            if (value.scope === scope) transactionStores.get(store).delete(key);
          }
        },
      };
      const result = await callback(tx);
      if (mode === "readwrite") stores = transactionStores;
      return result;
    },
    close() {},
  };
  return backend;
}
