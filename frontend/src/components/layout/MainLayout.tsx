import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

function MainLayout() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <MobileNav
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuToggle={() => setIsMobileNavOpen(true)} />
        <main
          className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8"
          id="main-content"
          role="main"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
