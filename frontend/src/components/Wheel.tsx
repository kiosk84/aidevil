"use client";
import React, { useRef } from 'react';

export interface Participant {
  id: string;
  color: string;
}

interface WheelProps {
  participants: Participant[];
}

const Wheel: React.FC<WheelProps> = ({ participants }) => {
  const wheelRef = useRef<SVGGElement>(null);

  const radius = 150;
  const center = 200;
  const sliceAngle = 360 / participants.length;

  return (
    <div className="flex flex-col items-center">
      <svg width="400" height="400" viewBox="0 0 400 400">
        <g ref={wheelRef} style={{ transformOrigin: `${center}px ${center}px` }}>
          {participants.map((p, i) => {
            const startAngle = sliceAngle * i;
            const endAngle = sliceAngle * (i + 1);
            const x1 = center + radius * Math.cos((Math.PI / 180) * startAngle);
            const y1 = center + radius * Math.sin((Math.PI / 180) * startAngle);
            const x2 = center + radius * Math.cos((Math.PI / 180) * endAngle);
            const y2 = center + radius * Math.sin((Math.PI / 180) * endAngle);
            return (
              <path
                key={p.id}
                d={`M${center},${center} L${x1},${y1} A${radius},${radius} 0 0,1 ${x2},${y2} Z`}
                fill={p.color}
              />
            );
          })}
          {/* Pointer */}
          <polygon points="190,10 200,30 210,10" fill="red" />
        </g>
      </svg>
    </div>
  );
};

export default Wheel;
// Removed gsap import since automatic spin handled by backend/timer
