"use client";
import React, { useState, useEffect } from 'react';
import { getParticipants, getTimer } from '../lib/api';
import WheelComponent from '../components/Wheel';

export default function Home() {
  const [participants, setParticipants] = useState<string[]>([]);
  const [timer, setTimer] = useState<number>(0);

  useEffect(() => {
    getParticipants().then(setParticipants).catch(console.error);
    getTimer().then(data => setTimer(data.secondsRemaining)).catch(console.error);

    const interval = setInterval(() => {
      getTimer().then(data => setTimer(data.secondsRemaining));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  function formatTime(sec: number) {
    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-4">Колесо Фортуны</h1>
      <div className="mb-6">
        <span>До следующего розыгрыша: </span>
        <span className="font-mono">{formatTime(timer)}</span>
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-2">Участники:</h2>
        <ul className="list-disc list-inside">
          {participants.length > 0 ? participants.map((name, idx) => (
            <li key={idx}>{name}</li>
          )) : <li>Нет участников</li>}
        </ul>
      </div>
      {/* Wheel component */}
      <div className="mt-8">
        <WheelComponent participants={participants} />
      </div>
    </div>
  );
}
