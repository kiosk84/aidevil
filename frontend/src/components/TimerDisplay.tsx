"use client";
import React, { useEffect, useState } from 'react';
import { getTimer, spinWheel } from '../lib/api';

interface TimerDisplayProps {
  initialTime?: number;
}

export default function TimerDisplay({ initialTime }: TimerDisplayProps) {
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let id: NodeJS.Timeout;
    if (initialTime !== undefined) {
      let current = initialTime;
      setTimer(current);
      id = setInterval(() => {
        current = Math.max(0, current - 1);
        setTimer(current);
        if (current === 0) spinWheel();
      }, 1000);
    } else {
      let mounted = true;
      const fetchTimer = async () => {
        try {
          const data = await getTimer();
          if (mounted) {
            setTimer(data.secondsRemaining);
            if (data.secondsRemaining === 0) spinWheel();
          }
        } catch (e) {
          console.error(e);
        }
      };
      fetchTimer();
      id = setInterval(fetchTimer, 1000);
      return () => {
        mounted = false;
        clearInterval(id);
      };
    }
    return () => clearInterval(id);
  }, [initialTime]);

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
