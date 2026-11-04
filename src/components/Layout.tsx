import React from 'react';
import Sidebar from './Sidebar';
import DraggableCanvas from './DraggableCanvas';
import BottomToolbar from './BottomToolbar';

const Layout: React.FC = () => {
  return (
    <div className="flex min-h-0 w-full flex-1">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <DraggableCanvas />
        </div>
        <BottomToolbar />
      </div>
    </div>
  );
};

export default Layout;
