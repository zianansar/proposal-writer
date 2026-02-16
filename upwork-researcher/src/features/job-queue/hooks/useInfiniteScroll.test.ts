/**
 * useInfiniteScroll hook tests - Story 4b.9 Task 11
 * Tests AC-11.3, AC-11.4
 *
 * Note: Comprehensive testing of IntersectionObserver behavior is done through
 * integration tests in JobQueuePage.test.tsx. These unit tests focus on hook API.
 */

import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { useInfiniteScroll } from "./useInfiniteScroll";

describe("useInfiniteScroll", () => {
  describe("Hook API", () => {
    it("returns a ref object", () => {
      const { result } = renderHook(() =>
        useInfiniteScroll({
          hasMore: true,
          isLoading: false,
          onLoadMore: () => {},
        }),
      );

      expect(result.current).toBeDefined();
      expect(result.current).toHaveProperty("current");
    });

    it("initializes ref with null", () => {
      const { result } = renderHook(() =>
        useInfiniteScroll({
          hasMore: true,
          isLoading: false,
          onLoadMore: () => {},
        }),
      );

      expect(result.current.current).toBeNull();
    });

    it("accepts hasMore parameter", () => {
      const { result: result1 } = renderHook(() =>
        useInfiniteScroll({
          hasMore: true,
          isLoading: false,
          onLoadMore: () => {},
        }),
      );

      const { result: result2 } = renderHook(() =>
        useInfiniteScroll({
          hasMore: false,
          isLoading: false,
          onLoadMore: () => {},
        }),
      );

      expect(result1.current).toBeDefined();
      expect(result2.current).toBeDefined();
    });

    it("accepts isLoading parameter", () => {
      const { result: result1 } = renderHook(() =>
        useInfiniteScroll({
          hasMore: true,
          isLoading: false,
          onLoadMore: () => {},
        }),
      );

      const { result: result2 } = renderHook(() =>
        useInfiniteScroll({
          hasMore: true,
          isLoading: true,
          onLoadMore: () => {},
        }),
      );

      expect(result1.current).toBeDefined();
      expect(result2.current).toBeDefined();
    });

    it("accepts onLoadMore callback", () => {
      const mockCallback = () => {
        /* mock function */
      };

      const { result } = renderHook(() =>
        useInfiniteScroll({
          hasMore: true,
          isLoading: false,
          onLoadMore: mockCallback,
        }),
      );

      expect(result.current).toBeDefined();
    });

    it("accepts optional threshold parameter", () => {
      const { result: result1 } = renderHook(() =>
        useInfiniteScroll({
          hasMore: true,
          isLoading: false,
          onLoadMore: () => {},
        }),
      );

      const { result: result2 } = renderHook(() =>
        useInfiniteScroll({
          hasMore: true,
          isLoading: false,
          onLoadMore: () => {},
          threshold: 500,
        }),
      );

      expect(result1.current).toBeDefined();
      expect(result2.current).toBeDefined();
    });
  });

  describe("Re-render behavior", () => {
    it("maintains ref identity across re-renders", () => {
      const { result, rerender } = renderHook(
        ({ hasMore }) =>
          useInfiniteScroll({
            hasMore,
            isLoading: false,
            onLoadMore: () => {},
          }),
        { initialProps: { hasMore: true } },
      );

      const firstRef = result.current;

      rerender({ hasMore: false });

      expect(result.current).toBe(firstRef);
    });
  });
});
