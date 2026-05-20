import { assert } from "./assert";

export class AsyncBatchReader<T> {
  #batches: Array<{ data: Generator<T>; last: boolean }> = [];
  #index: number = 0;
  #resolve: (() => void) | null = null;
  #current: { data: Generator<T>; last: boolean } | null = null;
  #requestNextBatch: () => void;

  constructor(requestNextBatch: () => void) {
    this.#requestNextBatch = requestNextBatch;
  }

  enqueueBatch(batch: Generator<T>, { last }: { last: boolean }) {
    this.#batches.push({ data: batch, last });
    if (this.#resolve) {
      this.#resolve();
      this.#resolve = null;
    }
  }

  async next(): Promise<IteratorResult<{ row: T; index: number }>> {
    if (!this.#current) {
      if (this.#batches.length === 0) {
        const promise: Promise<void> = new Promise((resolve) => {
          this.#resolve = resolve;
        });
        this.#requestNextBatch();
        await promise;
      }
      const next = this.#batches.shift();
      assert(next, "No next batch");
      this.#current = next;
    }
    const result = this.#current.data.next();
    if (result.done) {
      if (this.#current.last) {
        return { done: true, value: undefined };
      }
      this.#current = null;
      return this.next();
    }
    return {
      done: false,
      value: { row: result.value, index: this.#index++ },
    };
  }
}
