import React, { useState } from 'react';
import { useAuth } from '../App';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import NotificationBell from './NotificationBell';
import {
  Plane,
  Package,
  MessageCircle,
  User,
  LogOut,
  Plus,
  Home,
  ShoppingCart,
  LogIn,
  Menu,
  X
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu';

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    setMobileMenuOpen(false);
    logout();
    navigate('/marketplace');
  };

  const go = (path) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  const isActive = (path) => location.pathname === path;

  const navItems = isAuthenticated
    ? [
        { path: '/dashboard', icon: Home, label: 'Dashboard' },
        { path: '/marketplace', icon: ShoppingCart, label: 'Marketplace' },
        { path: '/match-requests', icon: Package, label: 'My Requests' },
        { path: '/direct-messages', icon: MessageCircle, label: 'Messages' },
        ...(user?.role === 'admin' ? [{ path: '/admin', icon: User, label: 'Admin' }] : []),
      ]
    : [
        { path: '/marketplace', icon: ShoppingCart, label: 'Marketplace' },
      ];

  const createActions = !isAuthenticated || user?.role === 'admin'
    ? []
    : [
        { path: '/create-trip', icon: Plane, label: 'Post Trip' },
        { path: '/create-shipment', icon: Package, label: 'Post Shipment' },
      ];

  return (
    <nav className="bg-white/90 backdrop-blur-md border-b border-orange-100 sticky top-0 z-50 shadow-soft">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16 gap-2">
          {/* Logo */}
          <button
            type="button"
            className="flex items-center flex-shrink-0 min-w-0"
            onClick={() => go(isAuthenticated ? '/marketplace' : '/')}
            data-testid="navbar-logo"
            aria-label="SendJet home"
          >
            <img
              src="/sendjet-wordmark.png?v=4"
              alt="SendJet"
              className="h-9 sm:h-12 w-auto max-w-[118px] sm:max-w-none select-none"
              draggable="false"
            />
          </button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 min-w-0">
            {navItems.map((item) => (
              <Button
                key={item.path}
                variant={isActive(item.path) ? 'default' : 'ghost'}
                size="sm"
                className={`flex items-center space-x-2 ${
                  isActive(item.path)
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                    : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50'
                }`}
                onClick={() => go(item.path)}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Button>
            ))}
          </div>

          {/* Desktop right actions + compact mobile controls */}
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            {isAuthenticated ? (
              <>
                <NotificationBell />

                {createActions.map((action) => (
                  <Button
                    key={action.path}
                    size="sm"
                    className="hidden lg:flex items-center space-x-2 btn-primary text-white"
                    onClick={() => go(action.path)}
                  >
                    <Plus className="h-4 w-4" />
                    <span>{action.label}</span>
                  </Button>
                ))}

                {/* Desktop user menu only. On phones it lives inside the hamburger menu. */}
                <div className="hidden md:block">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="flex items-center gap-2 hover:bg-orange-50 px-2.5">
                        <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                          {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : <User className="h-4 w-4 text-white" />}
                        </div>
                        <p className="text-sm font-medium text-gray-700 max-w-[180px] truncate" title={user?.full_name || ''}>
                          {user?.full_name}
                        </p>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <div className="px-2 py-1.5 min-w-0">
                        <p className="text-sm font-medium break-words">{user?.full_name}</p>
                        <p className="text-xs text-gray-500 break-all">{user?.email}</p>
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => go(`/profile/${user?.id}`)}>
                        <User className="h-4 w-4 mr-2" /> My Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => go('/dashboard')}>
                        <Home className="h-4 w-4 mr-2" /> Dashboard
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => go('/direct-messages')}>
                        <MessageCircle className="h-4 w-4 mr-2" /> Messages
                      </DropdownMenuItem>
                      {createActions.length > 0 && <DropdownMenuSeparator />}
                      {createActions.map((action) => (
                        <DropdownMenuItem key={action.path} onClick={() => go(action.path)}>
                          <action.icon className="h-4 w-4 mr-2" /> {action.label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                        <LogOut className="h-4 w-4 mr-2" /> Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 hover:text-orange-600"
                  onClick={() => go('/auth')}
                  data-testid="navbar-signin-btn"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
                <Button
                  size="sm"
                  className="btn-primary text-white"
                  onClick={() => go('/auth?tab=signup')}
                  data-testid="navbar-signup-btn"
                >
                  Sign Up
                </Button>
              </div>
            )}

            {/* One mobile menu for both logged-in and logged-out states avoids cramped headers. */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden p-2 h-9 w-9"
              onClick={() => setMobileMenuOpen((open) => !open)}
              data-testid="mobile-menu-toggle"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-orange-100 py-2.5 space-y-1 animate-in slide-in-from-top-2 max-h-[calc(100dvh-3.5rem)] overflow-y-auto" data-testid="mobile-menu">
            {isAuthenticated && (
              <button type="button" onClick={() => go(`/profile/${user?.id}`)} className="w-full px-3 py-2 mb-1 rounded-xl bg-orange-50/70 min-w-0 text-left flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 text-white flex items-center justify-center overflow-hidden flex-shrink-0">
                  {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : <User className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 break-words">{user?.full_name}</p>
                  <p className="text-xs text-gray-500 break-all mt-0.5">View profile</p>
                </div>
              </button>
            )}

            {navItems.map((item) => (
              <button
                key={item.path}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-colors ${
                  isActive(item.path)
                    ? 'bg-orange-50 text-orange-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => go(item.path)}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {item.label}
              </button>
            ))}

            {isAuthenticated ? (
              <>
                {createActions.length > 0 && (
                  <div className="border-t border-gray-100 pt-2 mt-1 space-y-1">
                    {createActions.map((action) => (
                      <button
                        key={action.path}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-orange-600 font-medium hover:bg-orange-50 transition-colors"
                        onClick={() => go(action.path)}
                      >
                        <Plus className="h-4 w-4 flex-shrink-0" />
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="border-t border-gray-100 pt-2 mt-1">
                  <button
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4 flex-shrink-0" />
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              <div className="border-t border-gray-100 pt-2 mt-1 grid grid-cols-2 gap-2 px-1">
                <Button variant="outline" onClick={() => go('/auth')} className="w-full">
                  Sign In
                </Button>
                <Button onClick={() => go('/auth?tab=signup')} className="w-full btn-primary text-white">
                  Sign Up
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
