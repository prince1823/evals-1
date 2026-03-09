import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/lib/constants';
import {
  LayoutDashboard,
  AlertTriangle,
  Target,
} from 'lucide-react';
import clsx from 'clsx';

const ICONS = [LayoutDashboard, AlertTriangle, Target];

export function Sidebar() {
  return (
    <aside className="w-56 bg-gray-900 text-gray-300 flex flex-col min-h-screen shrink-0">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold text-white">AP Classifier</h1>
        <p className="text-xs text-gray-400 mt-1">Eval Dashboard</p>
      </div>
      <nav className="flex-1 py-4">
        {NAV_ITEMS.map((item, i) => {
          const Icon = ICONS[i];
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-800 hover:text-white',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
