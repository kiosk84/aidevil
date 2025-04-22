"use client";
import React from 'react';
import { HiMenu } from 'react-icons/hi';

interface NavbarProps {
  onMenuToggleAction: () => void;
}

export default function Navbar({ onMenuToggleAction }: NavbarProps) {
  return (
    <div className="fixed top-0 left-0 w-full flex items-center justify-center p-4 bg-gray-700 shadow-md z-50">
      <button
        onClick={onMenuToggleAction}
        className="text-white focus:outline-none p-1 rounded flex items-center absolute left-4 top-1/2 -translate-y-1/2 z-70 hover:bg-transparent active:bg-transparent"
        aria-label="Меню"
      >
        {/* Burger menu icon from react-icons */}
        <HiMenu size={36} />
      </button>
      <h1 className="text-white text-xl font-bold">Колесо Фортуны</h1>
    </div>
  );
}
