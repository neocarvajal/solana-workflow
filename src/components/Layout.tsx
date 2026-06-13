import React from 'react';
import Sidebar from './Sidebar';
import DraggableCanvas from './DraggableCanvas';
import BottomToolbar from './BottomToolbar';
import ThemeToggle from './ThemeToggle';

const Layout: React.FC = () => {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <div className="flex flex-1 overflow-hidden">
          <DraggableCanvas />
        </div>
        <BottomToolbar />
      </div>
      <ThemeToggle />
    </div>
  );
};

export default Layout;