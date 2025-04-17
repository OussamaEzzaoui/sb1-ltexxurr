import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as lucide from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavItem {
  path: string;
  label: string;
  icon: keyof typeof lucide;
  children?: NavItem[];
}

export function Sidebar() {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth < 768);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Navigation items configuration
  const navItems: NavItem[] = [
    {
      path: '/',
      label: 'Safety Reports',
      icon: 'ClipboardList',
    },
    {
      path: '/stats',
      label: 'Statistics',
      icon: 'BarChart2',
      children: [
        {
          path: '/stats/monthly',
          label: 'Monthly Summary',
          icon: 'CalendarRange',
        },
        {
          path: '/stats/trends',
          label: 'Trend Analysis',
          icon: 'TrendingUp',
        },
      ],
    },
    {
      path: '/categories',
      label: 'Safety Categories',
      icon: 'Tags',
    },
    ...(isAdmin
      ? [
          {
            path: '/admin',
            label: 'Administration',
            icon: 'Settings',
            children: [
              {
                path: '/admin/users',
                label: 'Users',
                icon: 'Users',
              },
              {
                path: '/admin/projects',
                label: 'Projects',
                icon: 'Briefcase',
              },
              {
                path: '/admin/companies',
                label: 'Companies',
                icon: 'Building2',
              },
            ],
          },
        ]
      : []),
  ];

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsCollapsed(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      const Icon = lucide[item.icon];
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
              {!isCollapsed && (
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
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          )}
          {hasChildren && isExpanded && (
            <div className="mt-1">{renderNavItems(item.children, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-white border-r border-gray-200 transition-all z-50 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <lucide.Shield className="h-8 w-8 text-green-600" />
          {!isCollapsed && (
            <span className="font-semibold text-gray-900">Safety Portal</span>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 text-gray-500 hover:text-gray-700 rounded-lg"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <lucide.ChevronRight className="h-5 w-5" />
          ) : (
            <lucide.ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* New Report Button */}
      <div className="p-2">
        <Link
          to="/reports/new"
          className={`w-full flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors ${
            isCollapsed ? 'justify-center' : ''
          }`}
        >
          <lucide.Plus className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && <span>New Report</span>}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="p-2 space-y-1" role="navigation">
        {renderNavItems(navItems)}
      </nav>
    </aside>
  );
}