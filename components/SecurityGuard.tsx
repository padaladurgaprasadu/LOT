"use client";

import React, { useEffect } from "react";

export const SecurityGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // 1. Disable Right Click Context Menu on the application
    const handleContextMenu = (e: MouseEvent) => {
      // Allow right-click on text inputs/textareas for normal editing
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      e.preventDefault();
    };

    // 2. Disable DevTools & Source Inspect Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12 key
      if (e.key === "F12" || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+Shift+I / Cmd+Option+I (Inspect Element)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "I" || e.key === "i" || e.keyCode === 73)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+Shift+J / Cmd+Option+J (Console)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "J" || e.key === "j" || e.keyCode === 74)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+Shift+C / Cmd+Option+C (Inspect Element Selector)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "C" || e.key === "c" || e.keyCode === 67)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+U / Cmd+U (View Page Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === "U" || e.key === "u" || e.keyCode === 85)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+S / Cmd+S (Save Page Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === "S" || e.key === "s" || e.keyCode === 83)) {
        // Prevent saving source
        const target = e.target as HTMLElement;
        if (!target || (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA")) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return <>{children}</>;
};
