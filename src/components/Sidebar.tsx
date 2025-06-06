import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as lucide from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LucideIcon } from 'lucide-react';
import safetyBLineLogo from '../images/safety_b_line_logo.png';

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  children?: NavItem[];
}

export function Sidebar({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Navigation items configuration
  const navItems: NavItem[] = [
    {
      path: '/',
      label: 'Safety Reports',
      icon: lucide.ClipboardList,
    },
    {
      path: '/my-reports',
      label: 'My Reports',
      icon: lucide.User,
    },
    {
      path: '/stats',
      label: 'Statistics',
      icon: lucide.BarChart2,
      children: [
        {
          path: '/stats/monthly',
          label: 'Monthly Summary',
          icon: lucide.CalendarRange,
        },
        {
          path: '/weekly-report',
          label: 'Weekly Report',
          icon: lucide.Calendar,
        },
      ],
    },
    ...(isAdmin
      ? [
          {
            path: '/admin',
            label: 'Administration',
            icon: lucide.Settings,
            children: [
              {
                path: '/admin/users',
                label: 'Users',
                icon: lucide.Users,
              },
              {
                path: '/admin/projects',
                label: 'Projects',
                icon: lucide.Briefcase,
              },
              {
                path: '/admin/companies',
                label: 'Companies',
                icon: lucide.Building2,
              },
            ],
          },
        ]
      : []),
  ];

  // Toggle submenu expansion
  const toggleExpanded = (path: string) => {
    setExpandedItems((prev) =>
      prev.includes(path)
        ? prev.filter((p) => p !== path)
        : [...prev, path]
    );
  };

  // Check if a nav item is active
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // Render nav items recursively
  const renderNavItems = (items: NavItem[], level = 0) => {
    return items.map((item) => {
      const Icon = item.icon;
      const active = isActive(item.path);
      const hasChildren = item.children && item.children.length > 0;
      const isExpanded = expandedItems.includes(item.path);

      return (
        <div key={item.path} className={`${level > 0 ? 'ml-4' : ''}`}>
          {hasChildren ? (
            <button
              onClick={() => toggleExpanded(item.path)}
              className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                active
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              aria-expanded={isExpanded}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {isOpen && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {hasChildren && (
                    <lucide.ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  )}
                </>
              )}
            </button>
          ) : (
            <Link
              to={item.path}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                active
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {isOpen && <span>{item.label}</span>}
            </Link>
          )}
          {hasChildren && isExpanded && (
            <div className="mt-1">{renderNavItems(item.children || [], level + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-white border-r border-gray-200 z-50 w-[250px] transition-all duration-300 ease-in-out
        ${isOpen ? 'left-0' : '-left-[250px]'}
        min-w-0 overflow-x-hidden overflow-y-auto flex flex-col`}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 shadow-md hover:bg-red-50 hover:text-red-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-200"
        aria-label="Close sidebar"
        type="button"
      >
        <lucide.X className="h-6 w-6" />
      </button>

      {/* Header */}
      <div className="flex flex-col items-center justify-center px-4 border-b border-gray-200 py-6">
        <img
          src={safetyBLineLogo}
          alt="Safety B Line by ASPC Logo"
          className="h-36 w-auto mb-0 drop-shadow-lg"
        />
        <span className={`font-semibold text-gray-900 text-xl text-center mt-0 transition-opacity duration-200 ${isOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'}`}>Safety Portal</span>
      </div>

      {/* New Report Button */}
      <div className="p-2">
        <Link
          to="/reports/new"
          className={`w-full flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors ${
            !isOpen ? 'justify-center' : ''
          }`}
        >
          <lucide.Plus className="h-5 w-5 flex-shrink-0" />
          {isOpen && <span>New Report</span>}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="p-2 space-y-1" role="navigation">
        {renderNavItems(navItems)}
      </nav>
    </aside>
  );
}