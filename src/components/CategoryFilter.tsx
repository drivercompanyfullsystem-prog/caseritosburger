'use client';

import React from 'react';
import { Product } from '../types';

interface CategoryFilterProps {
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  categories: { id: string; label: string; icon: string }[];
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  activeCategory,
  onSelectCategory,
  categories,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      {categories.map((cat) => {
        const isActive = activeCategory === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`flex items-center space-x-1.5 sm:space-x-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
              isActive
                ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md shadow-orange-600/30 ring-2 ring-orange-500/50'
                : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
};
