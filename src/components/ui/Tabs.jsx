// src/components/ui/tabs.jsx
import { Children, cloneElement, isValidElement } from "react";

export function Tabs({ value, onValueChange, children, className = "" }) {
  // Separate triggers and content
  const triggers = [];
  const contents = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;

    if (child.type === TabsList) {
      const updated = {
        ...child.props,
        children: Children.map(child.props.children, (tabChild) => {
          if (!isValidElement(tabChild)) return tabChild;
          return tabChild.type === TabsTrigger
            ? cloneWithProps(tabChild, {
                activeValue: value,
                onChange: onValueChange,
              })
            : tabChild;
        }),
      };
      triggers.push(<TabsList {...updated} key="tabs-list" />);
    } else if (child.type === TabsContent) {
      contents.push(
        cloneWithProps(child, {
          activeValue: value,
          key: `content-${child.props.value}`,
        })
      );
    }
  });

  return (
    <div className={className}>
      {triggers}
      {contents}
    </div>
  );
}

export function TabsList({ children, className = "" }) {
  return <div className={`flex gap-2 ${className}`}>{children}</div>;
}

export function TabsTrigger({ value, activeValue, onChange, children }) {
  const isActive = value === activeValue;
  const handleClick = () => {
    if (typeof onChange === "function") onChange(value);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`px-4 py-2 rounded-t-md focus:outline-none transition ${
        isActive ? "bg-blue-600 text-white" : "bg-gray-200 text-black"
      }`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, activeValue, children, className = "" }) {
  if (value !== activeValue) return null;
  return <div className={className}>{children}</div>;
}

function cloneWithProps(element, props) {
  return isValidElement(element) ?  cloneElement(element, props) : element;
}
