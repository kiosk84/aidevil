"use client";
import React, { useState, useEffect } from 'react';
import { getWinners } from '../../lib/api';

export default function History() {
  const [winners, setWinners] = useState<string[]>([]);

  useEffect(() => {
    getWinners().then(setWinners).catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-2xl font-bold mb-4">История победителей</h1>
      <ul className="list-decimal list-inside">
        {winners.length > 0 ? 
          winners.map((name, idx) => (
            <li key={idx}>{name}</li>
          )) : <li>Нет данных о победителях</li>
        }
      </ul>
    </div>
  );
}
