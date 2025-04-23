"use client";
import React, { useEffect, useState } from 'react';
import { getTimer } from '../lib/api';

export default function TimerDisplay() {
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let current = 0;
    let mounted = true;
    const fetchTimer: () => Promise<void> = async () => {
      try {
        const data = await getTimer();
        if (mounted) {
          current = Math.max(0, data.secondsRemaining);
          setTimer(current);
        }
      } catch (e) {
        console.error('Failed to fetch timer:', e);
      }
    };
    fetchTimer();
    const id = setInterval(() => {
      if (current > 0) {
        current -= 1;
        setTimer(current);
        if (current === 0) {
          fetchTimer();
        }
      } else {
        fetchTimer();
      }
    }, 1000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const h = Math.floor(timer / 3600)
    .toString()
    .padStart(2, '0');
  const m = Math.floor((timer % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const s = (timer % 60).toString().padStart(2, '0');

  return (
    <div className="digital-timer font-mono text-3xl text-yellow-400">
      {h}:{m}:{s}
    </div>
  );
}
