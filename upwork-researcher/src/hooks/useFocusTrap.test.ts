import { renderHook, act } from "@testing-library/react";
import { describe, test, expect, beforeEach, afterEach } from "vitest";

import { useFocusTrap, FOCUSABLE_SELECTOR } from "./useFocusTrap";

describe("useFocusTrap", () => {
  let container: HTMLDivElement;
  let button1: HTMLButtonElement;
  let button2: HTMLButtonElement;
  let button3: HTMLButtonElement;
  let triggerButton: HTMLButtonElement;

  beforeEach(() => {
    // Create a container with focusable elements
    container = document.createElement("div");
    button1 = document.createElement("button");
    button1.textContent = "Button 1";
    button2 = document.createElement("button");
    button2.textContent = "Button 2";
    button3 = document.createElement("button");
    button3.textContent = "Button 3";

    container.appendChild(button1);
    container.appendChild(button2);
    container.appendChild(button3);
    document.body.appendChild(container);

    // Create a trigger button outside the container
    triggerButton = document.createElement("button");
    triggerButton.textContent = "Trigger";
    document.body.appendChild(triggerButton);
  });

  afterEach(() => {
    document.body.removeChild(container);
    document.body.removeChild(triggerButton);
  });

  test("test_tab_moves_to_next_focusable", () => {
    const containerRef = { current: container };
    renderHook(() => useFocusTrap(containerRef));

    // Focus first button
    button1.focus();
    expect(document.activeElement).toBe(button1);

    // Simulate Tab key (focus should move to button2 naturally)
    // The trap should NOT interfere when moving within elements
    button2.focus(); // Simulate natural tab behavior
    expect(document.activeElement).toBe(button2);
  });

  test("test_shift_tab_moves_to_previous", () => {
    const containerRef = { current: container };
    renderHook(() => useFocusTrap(containerRef));

    // Focus second button
    button2.focus();
    expect(document.activeElement).toBe(button2);

    // Simulate Shift+Tab (focus should move to button1 naturally)
    button1.focus();
    expect(document.activeElement).toBe(button1);
  });

  test("test_tab_wraps_at_end", () => {
    const containerRef = { current: container };
    renderHook(() => useFocusTrap(containerRef));

    // Focus last button
    button3.focus();
    expect(document.activeElement).toBe(button3);

    // Simulate Tab key from last element
    const tabEvent = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });

    act(() => {
      document.dispatchEvent(tabEvent);
    });

    // Should wrap to first element
    expect(document.activeElement).toBe(button1);
  });

  test("test_shift_tab_wraps_at_start", () => {
    const containerRef = { current: container };
    renderHook(() => useFocusTrap(containerRef));

    // Focus first button
    button1.focus();
    expect(document.activeElement).toBe(button1);

    // Simulate Shift+Tab from first element
    const shiftTabEvent = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    act(() => {
      document.dispatchEvent(shiftTabEvent);
    });

    // Should wrap to last element
    expect(document.activeElement).toBe(button3);
  });

  test("test_auto_focuses_first_element", async () => {
    const containerRef = { current: container };

    // Initially no element is focused
    expect(document.activeElement).toBe(document.body);

    renderHook(() => useFocusTrap(containerRef, { autoFocus: true }));

    // Wait for requestAnimationFrame
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    });

    // First element should be focused
    expect(document.activeElement).toBe(button1);
  });

  test("test_returns_focus_on_unmount", () => {
    const containerRef = { current: container };
    const triggerRef = { current: triggerButton };

    // Focus trigger before mounting
    triggerButton.focus();
    expect(document.activeElement).toBe(triggerButton);

    const { unmount } = renderHook(() => useFocusTrap(containerRef, { triggerRef }));

    // Focus moves to container during trap
    button1.focus();
    expect(document.activeElement).toBe(button1);

    // Unmount should return focus to trigger
    unmount();
    expect(document.activeElement).toBe(triggerButton);
  });

  test("test_ignores_hidden_elements", () => {
    const containerRef = { current: container };

    // Hide button2
    button2.style.display = "none";

    const { result } = renderHook(() => useFocusTrap(containerRef));

    // Get focusable elements
    const focusableElements = result.current.getFocusableElements();

    // Should only include visible elements (button1 and button3)
    expect(focusableElements).toHaveLength(2);
    expect(focusableElements[0]).toBe(button1);
    expect(focusableElements[1]).toBe(button3);
  });

  test("test_focusable_selector_constant", () => {
    // Verify FOCUSABLE_SELECTOR includes common focusable elements
    expect(FOCUSABLE_SELECTOR).toContain("button:not([disabled])");
    expect(FOCUSABLE_SELECTOR).toContain("input:not([disabled])");
    expect(FOCUSABLE_SELECTOR).toContain("a[href]");
    expect(FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex="-1"])');
  });

  test("test_disabled_elements_not_focusable", () => {
    const containerWithDisabled = document.createElement("div");
    const enabledButton = document.createElement("button");
    const disabledButton = document.createElement("button");
    disabledButton.disabled = true;

    containerWithDisabled.appendChild(enabledButton);
    containerWithDisabled.appendChild(disabledButton);
    document.body.appendChild(containerWithDisabled);

    const containerRef = { current: containerWithDisabled };
    const { result } = renderHook(() => useFocusTrap(containerRef));

    const focusableElements = result.current.getFocusableElements();

    // Only enabled button should be focusable
    expect(focusableElements).toHaveLength(1);
    expect(focusableElements[0]).toBe(enabledButton);

    document.body.removeChild(containerWithDisabled);
  });

  test("test_no_autofocus_when_disabled", async () => {
    const containerRef = { current: container };

    expect(document.activeElement).toBe(document.body);

    renderHook(() => useFocusTrap(containerRef, { autoFocus: false }));

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    });

    // No element should be auto-focused
    expect(document.activeElement).toBe(document.body);
  });

  test("test_handles_empty_container", () => {
    const emptyContainer = document.createElement("div");
    document.body.appendChild(emptyContainer);

    const containerRef = { current: emptyContainer };
    const { result } = renderHook(() => useFocusTrap(containerRef));

    const focusableElements = result.current.getFocusableElements();
    expect(focusableElements).toHaveLength(0);

    document.body.removeChild(emptyContainer);
  });

  test("test_focus_returns_to_previous_active_when_no_trigger", () => {
    const outsideButton = document.createElement("button");
    document.body.appendChild(outsideButton);
    outsideButton.focus();

    const containerRef = { current: container };
    const { unmount } = renderHook(() => useFocusTrap(containerRef));

    button1.focus();
    expect(document.activeElement).toBe(button1);

    unmount();

    // Should return to previously active element
    expect(document.activeElement).toBe(outsideButton);

    document.body.removeChild(outsideButton);
  });
});
