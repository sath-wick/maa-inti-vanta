import React, { useState, useRef, useEffect, cloneElement, Children } from "react";

// Menu Context for internal state sharing
const MenuContext = React.createContext();

export function Menu({ children }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", handle);
    };
  }, [open]);

  return (
    <MenuContext.Provider value={{ open, setOpen }}>
      <div ref={menuRef} className="relative inline-block">
        {children}
      </div>
    </MenuContext.Provider>
  );
}

export function MenuButton({ children }) {
  const { open, setOpen } = React.useContext(MenuContext);
  return (
    <button
      type="button"
      className="p-2 rounded hover:bg-black focus:outline-none"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
    >
      {children}
    </button>
  );
}

export function MenuItem({ children, onClick }) {
  const { setOpen } = React.useContext(MenuContext);
  return (
    <button
      type="button"
      className="block w-full text-left px-4 py-2 hover:bg-black focus:bg-gray-100 focus:outline-none"
      onClick={(e) => {
        setOpen(false);
        if (onClick) onClick(e);
      }}
    >
      {children}
    </button>
  );
}

export function MenuList({ children }) {
  const { open } = React.useContext(MenuContext);
  if (!open) return null;
  return (
    <div
      className="absolute right-0 mt-2 min-w-[140px] rounded shadow-lg bg-white border z-50"
      role="menu"
      tabIndex={-1}
    >
      {children}
    </div>
  );
}
