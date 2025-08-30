import React, { useState, useEffect, useRef } from "react";

export default function SearchableDropdown({ items, onSelect, placeholder }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter items case-insensitive by name
  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600"
        placeholder={placeholder}
        value={query}
        onFocus={() => setIsOpen(true)}
        onChange={e => setQuery(e.target.value)}
        autoComplete="off"
      />
      {isOpen && (
        <ul className="absolute z-10 w-full max-h-60 overflow-auto rounded border border-gray-600 bg-gray-700 text-white text-sm mt-1">
          {filteredItems.length === 0 ? (
            <li className="p-2 cursor-default select-none">No items found</li>
          ) : (
            filteredItems.map(item => (
              <li
                key={item.name}
                className="p-2 cursor-pointer hover:bg-gray-600"
                onClick={() => {
                  onSelect(item.name);
                  setQuery("");
                  setIsOpen(false);
                }}
              >
                {item.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
