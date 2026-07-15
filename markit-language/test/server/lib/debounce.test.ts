import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import createKeyedDebouncer from "../../../src/server/lib/debounce.ts";

describe("createKeyedDebouncer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls fn with the key and value after the delay", () => {
    const fn = vi.fn();
    const debouncer = createKeyedDebouncer<string, number>(200, fn);

    debouncer.trigger("a", 1);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledWith("a", 1);
  });

  it("resets the timer and keeps only the latest value on repeated triggers for the same key", () => {
    const fn = vi.fn();
    const debouncer = createKeyedDebouncer<string, number>(200, fn);

    debouncer.trigger("a", 1);
    vi.advanceTimersByTime(100);
    debouncer.trigger("a", 2);
    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("a", 2);
  });

  it("tracks separate keys independently", () => {
    const fn = vi.fn();
    const debouncer = createKeyedDebouncer<string, number>(200, fn);

    debouncer.trigger("a", 1);
    debouncer.trigger("b", 2);
    vi.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith("a", 1);
    expect(fn).toHaveBeenCalledWith("b", 2);
  });

  it("cancel prevents a pending call from firing", () => {
    const fn = vi.fn();
    const debouncer = createKeyedDebouncer<string, number>(200, fn);

    debouncer.trigger("a", 1);
    debouncer.cancel("a");
    vi.advanceTimersByTime(200);

    expect(fn).not.toHaveBeenCalled();
  });
});
