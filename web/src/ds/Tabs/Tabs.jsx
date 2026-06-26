import React, { useState } from "react";

export const Tabs = ({ children }) => {
  const tabTitles = React.Children.toArray(children).filter(
    (child) => child.type.displayName === "TabItem",
  );
  const tabContents = React.Children.toArray(children).filter(
    (child) => child.type.displayName === "TabContent",
  );
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className='flex flex-col w-full'>
      <div className='mb-4 flex border-b border-dr-accent'>
        {tabTitles.map((tab, idx) => (
          <button
            key={idx}
            className={`cursor-pointer border-none bg-transparent px-6 py-3 text-base text-dr-text-muted transition-colors hover:bg-dr-surface-light/10 ${
              activeIndex === idx
                ? "rounded-t-lg border border-b-0 border-dr-accent bg-dr-surface text-dr-text"
                : ""
            }`}
            onClick={() => setActiveIndex(idx)}
          >
            {tab.props.children}
          </button>
        ))}
      </div>
      <div className='py-4 px-0'>{tabContents[activeIndex]}</div>
    </div>
  );
};

export const TabItem = ({ children }) => children;
TabItem.displayName = "TabItem";

export const TabContent = ({ children }) => <div>{children}</div>;
TabContent.displayName = "TabContent";
