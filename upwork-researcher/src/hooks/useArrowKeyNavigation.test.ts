/**
 * Story 8.2 Task 6: useArrowKeyNavigation Tests (AC8)
 */

import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { useArrowKeyNavigation } from "./useArrowKeyNavigation";

describe("useArrowKeyNavigation (Story 8.2 AC8)", () => {
  describe("Arrow Down/Up Navigation", () => {
    it("test_arrow_down_moves_to_next", () => {
      const onIndexChange = vi.fn();
      const { result } = renderHook(() =>
        useArrowKeyNavigation({
          itemCount: 5,
          currentIndex: 2,
          onIndexChange,
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "ArrowDown" }) as any;
      result.current.handleKeyDown(event);

      expect(onIndexChange).toHaveBeenCalledWith(3);
    });

    it("test_arrow_up_moves_to_previous", () => {
      const onIndexChange = vi.fn();
      const { result } = renderHook(() =>
        useArrowKeyNavigation({
          itemCount: 5,
          currentIndex: 2,
          onIndexChange,
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "ArrowUp" }) as any;
      result.current.handleKeyDown(event);

      expect(onIndexChange).toHaveBeenCalledWith(1);
    });
  });

  describe("Home/End Keys", () => {
    it("test_home_moves_to_first", () => {
      const onIndexChange = vi.fn();
      const { result } = renderHook(() =>
        useArrowKeyNavigation({
          itemCount: 5,
          currentIndex: 3,
          onIndexChange,
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Home" }) as any;
      result.current.handleKeyDown(event);

      expect(onIndexChange).toHaveBeenCalledWith(0);
    });

    it("test_end_moves_to_last", () => {
      const onIndexChange = vi.fn();
      const { result } = renderHook(() =>
        useArrowKeyNavigation({
          itemCount: 5,
          currentIndex: 1,
          onIndexChange,
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "End" }) as any;
      result.current.handleKeyDown(event);

      expect(onIndexChange).toHaveBeenCalledWith(4);
    });
  });

  describe("Wrapping Behavior", () => {
    it("test_wrapping_enabled_down_from_last_goes_to_first", () => {
      const onIndexChange = vi.fn();
      const { result } = renderHook(() =>
        useArrowKeyNavigation({
          itemCount: 5,
          currentIndex: 4, // last item
          onIndexChange,
          wrap: true,
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "ArrowDown" }) as any;
      result.current.handleKeyDown(event);

      expect(onIndexChange).toHaveBeenCalledWith(0);
    });

    it("test_wrapping_enabled_up_from_first_goes_to_last", () => {
      const onIndexChange = vi.fn();
      const { result } = renderHook(() =>
        useArrowKeyNavigation({
          itemCount: 5,
          currentIndex: 0, // first item
          onIndexChange,
          wrap: true,
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "ArrowUp" }) as any;
      result.current.handleKeyDown(event);

      expect(onIndexChange).toHaveBeenCalledWith(4);
    });

    it("test_wrapping_disabled_down_from_last_stays_at_last", () => {
      const onIndexChange = vi.fn();
      const { result } = renderHook(() =>
        useArrowKeyNavigation({
          itemCount: 5,
          currentIndex: 4, // last item
          onIndexChange,
          wrap: false,
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "ArrowDown" }) as any;
      result.current.handleKeyDown(event);

      // Should not call onIndexChange when at boundary with wrap=false
      expect(onIndexChange).not.toHaveBeenCalled();
    });

    it("test_wrapping_disabled_up_from_first_stays_at_first", () => {
      const onIndexChange = vi.fn();
      const { result } = renderHook(() =>
        useArrowKeyNavigation({
          itemCount: 5,
          currentIndex: 0, // first item
          onIndexChange,
          wrap: false,
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "ArrowUp" }) as any;
      result.current.handleKeyDown(event);

      // Should not call onIndexChange when at boundary with wrap=false
      expect(onIndexChange).not.toHaveBeenCalled();
    });
  });

  describe("Horizontal Navigation", () => {
    it("test_horizontal_mode_uses_left_right_arrows", () => {
      const onIndexChange = vi.fn();
      const { result } = renderHook(() =>
        useArrowKeyNavigation({
          itemCount: 5,
          currentIndex: 2,
          onIndexChange,
          horizontal: true,
        }),
      );

      // ArrowRight should move forward
      const rightEvent = new KeyboardEvent("keydown", { key: "ArrowRight" }) as any;
      result.current.handleKeyDown(rightEvent);
      expect(onIndexChange).toHaveBeenCalledWith(3);

      // ArrowLeft should move backward
      const leftEvent = new KeyboardEvent("keydown", { key: "ArrowLeft" }) as any;
      result.current.handleKeyDown(leftEvent);
      expect(onIndexChange).toHaveBeenCalledWith(1);
    });
  });

  describe("Event Prevention", () => {
    it("test_prevents_default_on_arrow_keys", () => {
      const onIndexChange = vi.fn();
      const { result } = renderHook(() =>
        useArrowKeyNavigation({
          itemCount: 5,
          currentIndex: 2,
          onIndexChange,
        }),
      );

      const event = {
        key: "ArrowDown",
        preventDefault: vi.fn(),
      } as any;

      result.current.handleKeyDown(event);

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("test_prevents_default_on_home_end_keys", () => {
      const onIndexChange = vi.fn();
      const { result } = renderHook(() =>
        useArrowKeyNavigation({
          itemCount: 5,
          currentIndex: 2,
          onIndexChange,
        }),
      );

      const homeEvent = {
        key: "Home",
        preventDefault: vi.fn(),
      } as any;

      result.current.handleKeyDown(homeEvent);
      expect(homeEvent.preventDefault).toHaveBeenCalled();

      const endEvent = {
        key: "End",
        preventDefault: vi.fn(),
      } as any;

      result.current.handleKeyDown(endEvent);
      expect(endEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("test_single_item_list_wrapping_enabled", () => {
      const onIndexChange = vi.fn();
      const { result } = renderHook(() =>
        useArrowKeyNavigation({
          itemCount: 1,
          currentIndex: 0,
          onIndexChange,
          wrap: true,
        }),
      );

      const downEvent = new KeyboardEvent("keydown", { key: "ArrowDown" }) as any;
      result.current.handleKeyDown(downEvent);

      // Should wrap to itself (index 0)
      expect(onIndexChange).toHaveBeenCalledWith(0);
    });

    it("test_empty_list", () => {
      const onIndexChange = vi.fn();
      const { result } = renderHook(() =>
        useArrowKeyNavigation({
          itemCount: 0,
          currentIndex: 0,
          onIndexChange,
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "ArrowDown" }) as any;
      result.current.handleKeyDown(event);

      // Should not call onIndexChange for empty list
      expect(onIndexChange).not.toHaveBeenCalled();
    });
  });
});
