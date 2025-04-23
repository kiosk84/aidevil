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

  const radius = 120;
  const center = 120;
  // Fallback to single gray segment when no participants
  const items = participants.length > 0 ? participants : [{ id: 'placeholder', color: '#555' }];
  const sliceAngle = 360 / items.length;

  return (
    <div className="flex flex-col items-center">
      <svg width="240" height="240" viewBox="0 0 240 240">
        {/* Dark background behind wheel segments */}
        <circle cx={center} cy={center} r={radius} fill="#222" />
        <g ref={wheelRef} style={{ transformOrigin: `${center}px ${center}px` }}>
          {items.length === 1 ? (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill={items[0].color}
            />
          ) : (
            items.map((p, i) => {
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
            })
          )}
          {/* Pointer */}
          <polygon points="110,10 120,30 130,10" fill="red" stroke="#000" strokeWidth={2} />
        </g>
      </svg>
    </div>
  );
};

export default Wheel;
// Removed gsap import since automatic spin handled by backend/timer
